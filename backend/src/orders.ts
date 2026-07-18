import { requireScope } from './auth';
import type { AuthPrincipal, Env, ProductRow } from './types';
import { ApiError, nowIso, numberValue, ok, pagination, readJson, stringValue, uuid } from './utils';
import { auditStatement, normalizePlatform, requestId, syncStatement } from './db';

export async function importOrder(request: Request, env: Env, principal: AuthPrincipal): Promise<Response> {
  requireScope(principal, 'orders:import');
  const body = await readJson<Record<string, unknown>>(request);
  const platform = normalizePlatform(body.platform);
  const orderSn = stringValue(body.orderSn, 'Mã đơn hàng', { min: 1, max: 120 });
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0 || rawItems.length > 20) {
    throw new ApiError(400, 'INVALID_ORDER_ITEMS', 'Đơn hàng phải có từ 1 đến 20 dòng sản phẩm để không vượt giới hạn D1 Free.');
  }

  const items = rawItems.map((raw, index) => {
    const item = raw as Record<string, unknown>;
    return {
      sku: stringValue(item.sku, `SKU dòng ${index + 1}`, { min: 1, max: 80 }).toUpperCase(),
      name: stringValue(item.name, `Tên sản phẩm dòng ${index + 1}`, { min: 1, max: 250 }),
      quantity: numberValue(item.quantity, `Số lượng dòng ${index + 1}`, { min: 0.000001 }),
      price: numberValue(item.price ?? 0, `Đơn giá dòng ${index + 1}`, { min: 0, integer: true }),
    };
  });

  const totalAmount = body.totalAmount === undefined
    ? items.reduce((sum, item) => sum + Math.round(item.quantity * item.price), 0)
    : numberValue(body.totalAmount, 'Tổng tiền', { min: 0, integer: true });
  const idempotencyKey = stringValue(
    request.headers.get('idempotency-key') || body.idempotencyKey || `${platform}:${orderSn}`,
    'Idempotency key',
    { min: 1, max: 200 },
  );

  const existing = await env.DB.prepare(`
    SELECT id, order_sn, status, created_at FROM orders
    WHERE shop_id = ? AND (idempotency_key = ? OR (platform = ? AND order_sn = ?)) LIMIT 1
  `).bind(principal.shopId, idempotencyKey, platform, orderSn).first<Record<string, unknown>>();
  if (existing) return ok(request, env, { order: existing, duplicate: true });

  const uniqueSkus = [...new Set(items.map((item) => item.sku))];
  const placeholders = uniqueSkus.map(() => '?').join(', ');
  const productResult = await env.DB.prepare(`
    SELECT * FROM products WHERE shop_id = ? AND is_active = 1 AND sku IN (${placeholders})
  `).bind(principal.shopId, ...uniqueSkus).all<ProductRow>();
  const productBySku = new Map(productResult.results.map((product) => [product.sku.toUpperCase(), product]));

  const orderId = uuid();
  const timestamp = nowIso();
  const suppliedCreatedAt = body.createdAt ? new Date(String(body.createdAt)) : new Date();
  const createdAt = Number.isNaN(suppliedCreatedAt.getTime()) ? timestamp : suppliedCreatedAt.toISOString();
  const customerName = stringValue(body.customerName || 'Khách hàng', 'Tên khách hàng', { max: 200, optional: true }) || null;
  const phone = stringValue(body.phone || '', 'Số điện thoại', { max: 50, optional: true }) || null;
  const address = stringValue(body.address || '', 'Địa chỉ', { max: 500, optional: true }) || null;
  const carrier = stringValue(body.carrier || '', 'Đơn vị vận chuyển', { max: 100, optional: true }) || null;
  const trackingNumber = stringValue(body.trackingNumber || '', 'Mã vận đơn', { max: 120, optional: true }) || null;
  const source = principal.type === 'integration' ? 'extension' : 'api';
  const createdBy = principal.type === 'user' ? principal.actorId : null;
  const statements: D1PreparedStatement[] = [];

  statements.push(env.DB.prepare(`
    INSERT INTO orders (
      id, shop_id, platform, order_sn, customer_name, phone, address, total_amount,
      status, source, carrier, tracking_number, idempotency_key, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    orderId, principal.shopId, platform, orderSn, customerName, phone, address, totalAmount,
    source, carrier, trackingNumber, idempotencyKey, createdBy, createdAt, timestamp,
  ));

  const unmatchedSkus: string[] = [];
  const itemRows = items.map((item) => {
    const product = productBySku.get(item.sku);
    if (!product) unmatchedSkus.push(item.sku);
    return {
      id: uuid(),
      item,
      product,
      lineTotal: Math.round(item.quantity * item.price),
    };
  });

  // D1 Free allows 50 queries per Worker invocation and 100 bound parameters per query.
  // Insert order items in chunks of 10 (90 parameters) to preserve room for stock updates.
  for (let start = 0; start < itemRows.length; start += 10) {
    const chunk = itemRows.slice(start, start + 10);
    const valueGroups = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const bindings: unknown[] = [];
    for (const row of chunk) {
      bindings.push(
        row.id,
        orderId,
        row.product?.id || null,
        row.item.sku,
        row.item.name,
        row.item.quantity,
        row.item.price,
        row.lineTotal,
        timestamp,
      );
    }
    statements.push(env.DB.prepare(`
      INSERT INTO order_items (id, order_id, product_id, sku, product_name, quantity, unit_price, line_total, created_at)
      VALUES ${valueGroups}
    `).bind(...bindings));
  }

  for (const row of itemRows) {
    const { item, product } = row;
    if (!product) continue;

    const movementId = uuid();
    statements.push(env.DB.prepare(`
      INSERT INTO inventory_movements (
        id, shop_id, product_id, order_id, movement_type, quantity_delta,
        quantity_before, quantity_after, unit_cost, reference, note,
        created_by_type, created_by_id, created_at
      )
      SELECT ?, ?, id, ?, 'sale', -MIN(stock, ?), stock, MAX(0, stock - ?), cost_price, ?, ?, ?, ?, ?
      FROM products WHERE id = ? AND shop_id = ?
    `).bind(
      movementId, principal.shopId, orderId, item.quantity, item.quantity,
      `${platform}:${orderSn}`, `Bán hàng ${platform.toUpperCase()}`,
      principal.type, principal.actorId, timestamp, product.id, principal.shopId,
    ));

    const shopeeDelta = platform === 'shopee' ? item.quantity : 0;
    const tiktokDelta = platform === 'tiktok' ? item.quantity : 0;
    statements.push(env.DB.prepare(`
      UPDATE products SET
        stock = MAX(0, stock - ?),
        shopee_stock = MAX(0, shopee_stock - ?),
        tiktok_stock = MAX(0, tiktok_stock - ?),
        version = version + 1,
        updated_at = ?
      WHERE id = ? AND shop_id = ?
    `).bind(item.quantity, shopeeDelta, tiktokDelta, timestamp, product.id, principal.shopId));
  }

  let transactionId: string | null = null;
  if (totalAmount > 0) {
    transactionId = uuid();
    statements.push(env.DB.prepare(`
      INSERT INTO cash_transactions (
        id, shop_id, transaction_type, category, amount, payment_method, description,
        order_id, is_estimated, occurred_at, created_by_type, created_by_id, created_at, updated_at
      ) VALUES (?, ?, 'income', 'Doanh thu bán hàng', ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
    `).bind(
      transactionId,
      principal.shopId,
      totalAmount,
      platform === 'shopee' ? 'shopeepay' : platform === 'tiktok' ? 'tiktok_shop' : 'cash',
      `Doanh thu đơn ${platform.toUpperCase()} ${orderSn}`,
      orderId,
      createdAt,
      principal.type,
      principal.actorId,
      timestamp,
      timestamp,
    ));
    statements.push(syncStatement(env, principal.shopId, 'cash_transaction', transactionId));
  }

  statements.push(syncStatement(env, principal.shopId, 'order', orderId));
  statements.push(auditStatement(env, principal, 'order.import', 'order', orderId, undefined, {
    platform,
    orderSn,
    totalAmount,
    itemCount: items.length,
    unmatchedSkus,
  }, requestId(request)));

  await env.DB.batch(statements);

  return ok(request, env, {
    order: { id: orderId, platform, orderSn, totalAmount, status: 'pending', createdAt },
    transactionId,
    unmatchedSkus,
    duplicate: false,
  }, undefined, 201);
}

export async function listOrders(request: Request, env: Env, principal: AuthPrincipal, url: URL): Promise<Response> {
  const { page, limit, offset } = pagination(url);
  const status = url.searchParams.get('status');
  const platform = url.searchParams.get('platform');
  const conditions = ['shop_id = ?'];
  const values: unknown[] = [principal.shopId];
  if (status) { conditions.push('status = ?'); values.push(status); }
  if (platform) { conditions.push('platform = ?'); values.push(platform); }
  const where = conditions.join(' AND ');
  const [rows, count] = await env.DB.batch([
    env.DB.prepare(`SELECT * FROM orders WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).bind(...values, limit, offset),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM orders WHERE ${where}`).bind(...values),
  ]);
  return ok(request, env, rows.results, { page, limit, total: count.results[0]?.count || 0 });
}

export async function orderDetail(request: Request, env: Env, principal: AuthPrincipal, orderId: string): Promise<Response> {
  const [order, items] = await Promise.all([
    env.DB.prepare('SELECT * FROM orders WHERE id = ? AND shop_id = ?').bind(orderId, principal.shopId).first<Record<string, unknown>>(),
    env.DB.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY rowid').bind(orderId).all<Record<string, unknown>>(),
  ]);
  if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
  return ok(request, env, { ...order, items: items.results });
}

