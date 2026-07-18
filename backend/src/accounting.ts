import { requireRole } from './auth';
import type { AuthPrincipal, Env } from './types';
import { ApiError, booleanValue, nowIso, numberValue, ok, pagination, readJson, stringValue, uuid } from './utils';
import { auditStatement, requestId, syncStatement } from './db';

export async function listCashTransactions(request: Request, env: Env, principal: AuthPrincipal, url: URL): Promise<Response> {
  const { page, limit, offset } = pagination(url);
  const type = url.searchParams.get('type');
  const conditions = ['shop_id = ?'];
  const values: unknown[] = [principal.shopId];
  if (type) { conditions.push('transaction_type = ?'); values.push(type); }
  const where = conditions.join(' AND ');
  const [rows, count] = await env.DB.batch([
    env.DB.prepare(`SELECT * FROM cash_transactions WHERE ${where} ORDER BY occurred_at DESC LIMIT ? OFFSET ?`)
      .bind(...values, limit, offset),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM cash_transactions WHERE ${where}`).bind(...values),
  ]);
  return ok(request, env, rows.results, { page, limit, total: count.results[0]?.count || 0 });
}

export async function createCashTransaction(request: Request, env: Env, principal: AuthPrincipal): Promise<Response> {
  requireRole(principal, 'cashier');
  const body = await readJson<Record<string, unknown>>(request);
  const type = String(body.type || 'expense');
  if (!['income', 'expense'].includes(type)) throw new ApiError(400, 'INVALID_TRANSACTION_TYPE', 'Loại giao dịch không hợp lệ.');
  const amount = numberValue(body.amount, 'Số tiền', { min: 0, integer: true });
  const category = stringValue(body.category, 'Danh mục', { min: 1, max: 150 });
  const paymentMethod = stringValue(body.paymentMethod || 'cash', 'Phương thức thanh toán', { min: 1, max: 80 });
  const description = stringValue(body.description || '', 'Diễn giải', { max: 500, optional: true }) || null;
  const occurredAtDate = body.occurredAt ? new Date(String(body.occurredAt)) : new Date();
  if (Number.isNaN(occurredAtDate.getTime())) throw new ApiError(400, 'INVALID_DATE', 'Ngày giao dịch không hợp lệ.');
  const id = uuid();
  const timestamp = nowIso();

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO cash_transactions (
        id, shop_id, transaction_type, category, amount, payment_method, description,
        partner_id, receipt_reference, is_estimated, occurred_at,
        created_by_type, created_by_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, principal.shopId, type, category, amount, paymentMethod, description,
      body.partnerId || null, body.receiptReference || null, booleanValue(body.isEstimated) ? 1 : 0,
      occurredAtDate.toISOString(), principal.type, principal.actorId, timestamp, timestamp,
    ),
    syncStatement(env, principal.shopId, 'cash_transaction', id),
    auditStatement(env, principal, 'cash_transaction.create', 'cash_transaction', id, undefined, {
      type, category, amount, paymentMethod,
    }, requestId(request)),
  ]);

  const transaction = await env.DB.prepare('SELECT * FROM cash_transactions WHERE id = ?').bind(id).first();
  return ok(request, env, transaction, undefined, 201);
}

export async function listPartners(request: Request, env: Env, principal: AuthPrincipal, url: URL): Promise<Response> {
  const { page, limit, offset } = pagination(url);
  const type = url.searchParams.get('type');
  const conditions = ['shop_id = ?', 'is_active = 1'];
  const values: unknown[] = [principal.shopId];
  if (type) { conditions.push('partner_type = ?'); values.push(type); }
  const where = conditions.join(' AND ');
  const [rows, count] = await env.DB.batch([
    env.DB.prepare(`SELECT * FROM partners WHERE ${where} ORDER BY name COLLATE NOCASE LIMIT ? OFFSET ?`).bind(...values, limit, offset),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM partners WHERE ${where}`).bind(...values),
  ]);
  return ok(request, env, rows.results, { page, limit, total: count.results[0]?.count || 0 });
}

export async function createPartner(request: Request, env: Env, principal: AuthPrincipal): Promise<Response> {
  requireRole(principal, 'cashier');
  const body = await readJson<Record<string, unknown>>(request);
  const type = String(body.type || 'customer');
  if (!['supplier', 'customer'].includes(type)) throw new ApiError(400, 'INVALID_PARTNER_TYPE', 'Loại đối tác không hợp lệ.');
  const id = uuid();
  const timestamp = nowIso();
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO partners (
        id, shop_id, partner_type, name, phone, address, debt_amount, debt_limit,
        due_date, notes, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).bind(
      id,
      principal.shopId,
      type,
      stringValue(body.name, 'Tên đối tác', { min: 1, max: 200 }),
      stringValue(body.phone || '', 'Số điện thoại', { max: 50, optional: true }) || null,
      stringValue(body.address || '', 'Địa chỉ', { max: 500, optional: true }) || null,
      numberValue(body.debtAmount ?? 0, 'Công nợ', { integer: true }),
      numberValue(body.debtLimit ?? 0, 'Hạn mức công nợ', { min: 0, integer: true }),
      body.dueDate || null,
      stringValue(body.notes || '', 'Ghi chú', { max: 500, optional: true }) || null,
      timestamp,
      timestamp,
    ),
    syncStatement(env, principal.shopId, 'partner', id),
    auditStatement(env, principal, 'partner.create', 'partner', id, undefined, body, requestId(request)),
  ]);
  const partner = await env.DB.prepare('SELECT * FROM partners WHERE id = ?').bind(id).first();
  return ok(request, env, partner, undefined, 201);
}

