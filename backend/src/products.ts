import { requireRole } from './auth';
import type { AuthPrincipal, Env, ProductRow } from './types';
import { ApiError, booleanValue, nowIso, numberValue, ok, pagination, readJson, stringValue, uuid } from './utils';
import { auditStatement, requestId, syncStatement, vnDayRange } from './db';

export async function handleDashboard(request: Request, env: Env, principal: AuthPrincipal): Promise<Response> {
  const { start, end, date } = vnDayRange();
  const [productCount, lowStock, orderCount, revenue, expense, recentOrders] = await env.DB.batch([
    env.DB.prepare('SELECT COUNT(*) AS count FROM products WHERE shop_id = ? AND is_active = 1').bind(principal.shopId),
    env.DB.prepare('SELECT COUNT(*) AS count FROM products WHERE shop_id = ? AND is_active = 1 AND stock <= min_stock').bind(principal.shopId),
    env.DB.prepare('SELECT COUNT(*) AS count FROM orders WHERE shop_id = ? AND created_at BETWEEN ? AND ? AND status != ?')
      .bind(principal.shopId, start, end, 'cancelled'),
    env.DB.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total FROM cash_transactions
      WHERE shop_id = ? AND transaction_type = 'income' AND occurred_at BETWEEN ? AND ?
    `).bind(principal.shopId, start, end),
    env.DB.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total FROM cash_transactions
      WHERE shop_id = ? AND transaction_type = 'expense' AND occurred_at BETWEEN ? AND ?
    `).bind(principal.shopId, start, end),
    env.DB.prepare(`
      SELECT id, platform, order_sn, customer_name, total_amount, status, created_at
      FROM orders WHERE shop_id = ? ORDER BY created_at DESC LIMIT 10
    `).bind(principal.shopId),
  ]);

  return ok(request, env, {
    date,
    products: productCount.results[0]?.count || 0,
    lowStock: lowStock.results[0]?.count || 0,
    ordersToday: orderCount.results[0]?.count || 0,
    revenueToday: revenue.results[0]?.total || 0,
    expenseToday: expense.results[0]?.total || 0,
    netCashflowToday: (Number(revenue.results[0]?.total) || 0) - (Number(expense.results[0]?.total) || 0),
    recentOrders: recentOrders.results,
  });
}

export async function listProducts(request: Request, env: Env, principal: AuthPrincipal, url: URL): Promise<Response> {
  const { page, limit, offset } = pagination(url);
  const search = (url.searchParams.get('search') || '').trim();
  const includeInactive = url.searchParams.get('includeInactive') === 'true';
  const conditions = ['shop_id = ?'];
  const values: unknown[] = [principal.shopId];

  if (!includeInactive) conditions.push('is_active = 1');
  if (search) {
    conditions.push('(name LIKE ? OR sku LIKE ? OR barcode LIKE ?)');
    const term = `%${search}%`;
    values.push(term, term, term);
  }

  const where = conditions.join(' AND ');
  const [rows, count] = await env.DB.batch([
    env.DB.prepare(`
      SELECT * FROM products WHERE ${where}
      ORDER BY is_active DESC, name COLLATE NOCASE ASC LIMIT ? OFFSET ?
    `).bind(...values, limit, offset),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM products WHERE ${where}`).bind(...values),
  ]);

  return ok(request, env, rows.results, {
    page,
    limit,
    total: count.results[0]?.count || 0,
  });
}

export async function createProduct(request: Request, env: Env, principal: AuthPrincipal): Promise<Response> {
  requireRole(principal, 'manager');
  const body = await readJson<Record<string, unknown>>(request);
  const id = uuid();
  const timestamp = nowIso();
  const sku = stringValue(body.sku, 'SKU', { min: 1, max: 80 }).toUpperCase();
  const name = stringValue(body.name, 'Tên sản phẩm', { min: 1, max: 250 });
  const barcode = stringValue(body.barcode, 'Mã vạch', { max: 100, optional: true }) || null;
  const unit = stringValue(body.unit || 'cái', 'Đơn vị', { min: 1, max: 50 });
  const salePrice = numberValue(body.salePrice ?? 0, 'Giá bán', { min: 0, integer: true });
  const costPrice = numberValue(body.costPrice ?? 0, 'Giá vốn', { min: 0, integer: true });
  const stock = numberValue(body.stock ?? 0, 'Tồn kho', { min: 0 });
  const minStock = numberValue(body.minStock ?? 0, 'Tồn tối thiểu', { min: 0 });
  const shopeeStock = numberValue(body.shopeeStock ?? stock, 'Tồn Shopee', { min: 0 });
  const tiktokStock = numberValue(body.tiktokStock ?? stock, 'Tồn TikTok', { min: 0 });

  const existing = await env.DB.prepare('SELECT id FROM products WHERE shop_id = ? AND sku = ?')
    .bind(principal.shopId, sku).first<{ id: string }>();
  if (existing) throw new ApiError(409, 'SKU_EXISTS', 'SKU đã tồn tại trong cửa hàng.');

  const statements: D1PreparedStatement[] = [
    env.DB.prepare(`
      INSERT INTO products (
        id, shop_id, sku, barcode, name, unit, sale_price, cost_price,
        stock, min_stock, shopee_stock, tiktok_stock, is_active, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)
    `).bind(
      id, principal.shopId, sku, barcode, name, unit, salePrice, costPrice,
      stock, minStock, shopeeStock, tiktokStock, timestamp, timestamp,
    ),
    syncStatement(env, principal.shopId, 'product', id),
    auditStatement(env, principal, 'product.create', 'product', id, undefined, { sku, name, stock }, requestId(request)),
  ];

  if (stock !== 0) {
    statements.splice(1, 0, env.DB.prepare(`
      INSERT INTO inventory_movements (
        id, shop_id, product_id, movement_type, quantity_delta, quantity_before, quantity_after,
        unit_cost, reference, note, created_by_type, created_by_id, created_at
      ) VALUES (?, ?, ?, 'opening', ?, 0, ?, ?, 'OPENING', 'Tồn đầu khi tạo sản phẩm', ?, ?, ?)
    `).bind(uuid(), principal.shopId, id, stock, stock, costPrice, principal.type, principal.actorId, timestamp));
  }

  await env.DB.batch(statements);
  const product = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<ProductRow>();
  return ok(request, env, product, undefined, 201);
}

export async function updateProduct(request: Request, env: Env, principal: AuthPrincipal, productId: string): Promise<Response> {
  requireRole(principal, 'manager');
  const existing = await env.DB.prepare('SELECT * FROM products WHERE id = ? AND shop_id = ?')
    .bind(productId, principal.shopId).first<ProductRow>();
  if (!existing) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm.');

  const body = await readJson<Record<string, unknown>>(request);
  const sku = body.sku === undefined ? existing.sku : stringValue(body.sku, 'SKU', { min: 1, max: 80 }).toUpperCase();
  const name = body.name === undefined ? existing.name : stringValue(body.name, 'Tên sản phẩm', { min: 1, max: 250 });
  const barcode = body.barcode === undefined ? existing.barcode : stringValue(body.barcode, 'Mã vạch', { max: 100, optional: true }) || null;
  const unit = body.unit === undefined ? existing.unit : stringValue(body.unit, 'Đơn vị', { min: 1, max: 50 });
  const salePrice = body.salePrice === undefined ? existing.sale_price : numberValue(body.salePrice, 'Giá bán', { min: 0, integer: true });
  const costPrice = body.costPrice === undefined ? existing.cost_price : numberValue(body.costPrice, 'Giá vốn', { min: 0, integer: true });
  const minStock = body.minStock === undefined ? existing.min_stock : numberValue(body.minStock, 'Tồn tối thiểu', { min: 0 });
  const isActive = body.isActive === undefined ? Boolean(existing.is_active) : booleanValue(body.isActive, true);
  const timestamp = nowIso();

  const duplicate = await env.DB.prepare('SELECT id FROM products WHERE shop_id = ? AND sku = ? AND id != ?')
    .bind(principal.shopId, sku, productId).first<{ id: string }>();
  if (duplicate) throw new ApiError(409, 'SKU_EXISTS', 'SKU đã thuộc về sản phẩm khác.');

  await env.DB.batch([
    env.DB.prepare(`
      UPDATE products SET sku = ?, barcode = ?, name = ?, unit = ?, sale_price = ?, cost_price = ?,
        min_stock = ?, is_active = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND shop_id = ?
    `).bind(sku, barcode, name, unit, salePrice, costPrice, minStock, isActive ? 1 : 0, timestamp, productId, principal.shopId),
    syncStatement(env, principal.shopId, 'product', productId),
    auditStatement(env, principal, 'product.update', 'product', productId, existing, {
      ...existing,
      sku,
      barcode,
      name,
      unit,
      sale_price: salePrice,
      cost_price: costPrice,
      min_stock: minStock,
      is_active: isActive ? 1 : 0,
    }, requestId(request)),
  ]);

  const product = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(productId).first<ProductRow>();
  return ok(request, env, product);
}

export async function adjustInventory(request: Request, env: Env, principal: AuthPrincipal): Promise<Response> {
  requireRole(principal, 'manager');
  const body = await readJson<Record<string, unknown>>(request);
  const productId = stringValue(body.productId, 'Mã sản phẩm', { min: 1, max: 100 });
  const delta = numberValue(body.quantityDelta, 'Số lượng điều chỉnh');
  if (delta === 0) throw new ApiError(400, 'ZERO_ADJUSTMENT', 'Số lượng điều chỉnh phải khác 0.');

  const product = await env.DB.prepare('SELECT * FROM products WHERE id = ? AND shop_id = ? AND is_active = 1')
    .bind(productId, principal.shopId).first<ProductRow>();
  if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm đang hoạt động.');

  const type = String(body.movementType || 'adjustment');
  const allowedTypes = ['purchase', 'return', 'adjustment', 'transfer_in', 'transfer_out', 'opening'];
  if (!allowedTypes.includes(type)) throw new ApiError(400, 'INVALID_MOVEMENT_TYPE', 'Loại nhập xuất kho không hợp lệ.');
  const note = stringValue(body.note || 'Điều chỉnh tồn kho', 'Ghi chú', { max: 500, optional: true });
  const reference = stringValue(body.reference || '', 'Tham chiếu', { max: 120, optional: true }) || null;
  const unitCost = body.unitCost === undefined ? product.cost_price : numberValue(body.unitCost, 'Giá vốn', { min: 0, integer: true });
  const timestamp = nowIso();
  const movementId = uuid();

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO inventory_movements (
        id, shop_id, product_id, movement_type, quantity_delta, quantity_before, quantity_after,
        unit_cost, reference, note, created_by_type, created_by_id, created_at
      )
      SELECT ?, ?, id, ?, CASE WHEN stock + ? < 0 THEN -stock ELSE ? END, stock, MAX(0, stock + ?), ?, ?, ?, ?, ?, ?
      FROM products WHERE id = ? AND shop_id = ?
    `).bind(
      movementId, principal.shopId, type, delta, delta, delta, unitCost, reference, note,
      principal.type, principal.actorId, timestamp, productId, principal.shopId,
    ),
    env.DB.prepare(`
      UPDATE products SET stock = MAX(0, stock + ?), version = version + 1, updated_at = ?
      WHERE id = ? AND shop_id = ?
    `).bind(delta, timestamp, productId, principal.shopId),
    syncStatement(env, principal.shopId, 'product', productId),
    syncStatement(env, principal.shopId, 'inventory_movement', movementId),
    auditStatement(env, principal, 'inventory.adjust', 'product', productId, { stock: product.stock }, {
      requestedDelta: delta,
      resultingStock: Math.max(0, product.stock + delta),
      movementId,
    }, requestId(request)),
  ]);

  const updated = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(productId).first<ProductRow>();
  return ok(request, env, { product: updated, movementId });
}

export async function listInventoryMovements(request: Request, env: Env, principal: AuthPrincipal, url: URL): Promise<Response> {
  const { page, limit, offset } = pagination(url);
  const productId = url.searchParams.get('productId');
  const conditions = ['m.shop_id = ?'];
  const values: unknown[] = [principal.shopId];
  if (productId) {
    conditions.push('m.product_id = ?');
    values.push(productId);
  }
  const where = conditions.join(' AND ');
  const [rows, count] = await env.DB.batch([
    env.DB.prepare(`
      SELECT m.*, p.sku, p.name AS product_name, p.unit
      FROM inventory_movements m JOIN products p ON p.id = m.product_id
      WHERE ${where} ORDER BY m.created_at DESC LIMIT ? OFFSET ?
    `).bind(...values, limit, offset),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM inventory_movements m WHERE ${where}`).bind(...values),
  ]);
  return ok(request, env, rows.results, { page, limit, total: count.results[0]?.count || 0 });
}

