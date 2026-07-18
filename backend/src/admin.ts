import { requireAnyRole, requireRole, requireScope } from './auth';
import type { AuthPrincipal, Env, UserRole } from './types';
import { ApiError, booleanValue, hashPassword, json, normalizeEmail, nowIso, ok, pagination, readJson, stringValue, uuid } from './utils';
import { auditStatement, requestId, validateRole } from './db';

interface SyncRow { id: number; entity_type: string; entity_id: string; operation: string; changed_at: string }

export async function listUsers(request: Request, env: Env, principal: AuthPrincipal): Promise<Response> {
  requireRole(principal, 'manager');
  const result = await env.DB.prepare(`
    SELECT id, email, display_name, role, is_active, last_login_at, created_at, updated_at
    FROM users WHERE shop_id = ? ORDER BY role DESC, display_name COLLATE NOCASE
  `).bind(principal.shopId).all();
  return ok(request, env, result.results);
}

export async function createUser(request: Request, env: Env, principal: AuthPrincipal): Promise<Response> {
  requireRole(principal, 'owner');
  const body = await readJson<Record<string, unknown>>(request);
  const role = validateRole(body.role);
  if (role === 'owner') throw new ApiError(400, 'OWNER_CREATION_FORBIDDEN', 'Không thể tạo thêm chủ cửa hàng qua API này.');
  const email = normalizeEmail(stringValue(body.email, 'Email', { min: 5, max: 254 }));
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new ApiError(400, 'INVALID_EMAIL', 'Email không đúng định dạng.');
  const password = stringValue(body.password, 'Mật khẩu', { min: 10, max: 200 });
  const displayName = stringValue(body.displayName, 'Tên nhân viên', { min: 2, max: 120 });
  const passwordData = await hashPassword(password);
  const id = uuid();
  const timestamp = nowIso();

  const duplicate = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (duplicate) throw new ApiError(409, 'EMAIL_EXISTS', 'Email đã được sử dụng.');

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO users (
        id, shop_id, email, display_name, password_hash, password_salt, password_iterations,
        role, is_active, failed_login_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)
    `).bind(id, principal.shopId, email, displayName, passwordData.hash, passwordData.salt, passwordData.iterations, role, timestamp, timestamp),
    auditStatement(env, principal, 'user.create', 'user', id, undefined, { email, displayName, role }, requestId(request)),
  ]);
  return ok(request, env, { id, email, displayName, role, isActive: true }, undefined, 201);
}

export async function updateUser(request: Request, env: Env, principal: AuthPrincipal, userId: string): Promise<Response> {
  requireRole(principal, 'owner');
  const current = await env.DB.prepare(`
    SELECT id, email, display_name, role, is_active FROM users WHERE id = ? AND shop_id = ?
  `).bind(userId, principal.shopId).first<Record<string, unknown>>();
  if (!current) throw new ApiError(404, 'USER_NOT_FOUND', 'Không tìm thấy người dùng.');
  const body = await readJson<Record<string, unknown>>(request);
  const role = body.role === undefined ? String(current.role) as UserRole : validateRole(body.role);
  const isActive = body.isActive === undefined ? Boolean(current.is_active) : booleanValue(body.isActive);
  if (userId === principal.actorId && !isActive) throw new ApiError(400, 'CANNOT_DISABLE_SELF', 'Không thể tự vô hiệu hóa tài khoản đang đăng nhập.');
  if (String(current.role) === 'owner' && role !== 'owner') throw new ApiError(400, 'CANNOT_DEMOTE_OWNER', 'Không thể hạ quyền tài khoản chủ cửa hàng.');

  await env.DB.batch([
    env.DB.prepare('UPDATE users SET role = ?, is_active = ?, updated_at = ? WHERE id = ? AND shop_id = ?')
      .bind(role, isActive ? 1 : 0, nowIso(), userId, principal.shopId),
    auditStatement(env, principal, 'user.update', 'user', userId, current, { ...current, role, is_active: isActive ? 1 : 0 }, requestId(request)),
  ]);
  return ok(request, env, { id: userId, role, isActive });
}

export async function listIntegrationTokens(request: Request, env: Env, principal: AuthPrincipal): Promise<Response> {
  requireRole(principal, 'owner');
  const result = await env.DB.prepare(`
    SELECT id, name, scopes, expires_at, last_used_at, revoked_at, created_at
    FROM integration_tokens WHERE shop_id = ? ORDER BY created_at DESC
  `).bind(principal.shopId).all();
  return ok(request, env, result.results);
}

export async function syncEvents(request: Request, env: Env, principal: AuthPrincipal, url: URL): Promise<Response> {
  requireScope(principal, 'sync:read');
  const cursor = Math.max(0, Number.parseInt(url.searchParams.get('cursor') || '0', 10) || 0);
  const result = await env.DB.prepare(`
    SELECT id, entity_type, entity_id, operation, changed_at
    FROM sync_events WHERE shop_id = ? AND id > ? ORDER BY id ASC LIMIT 500
  `).bind(principal.shopId, cursor).all<SyncRow>();
  const nextCursor = result.results.length ? result.results[result.results.length - 1].id : cursor;
  return ok(request, env, result.results, { cursor, nextCursor, hasMore: result.results.length === 500 });
}

export async function backup(request: Request, env: Env, principal: AuthPrincipal): Promise<Response> {
  requireAnyRole(principal, ['owner', 'accountant']);
  const [shop, users, products, partners, orders, items, movements, transactions, appState] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM shops WHERE id = ?').bind(principal.shopId),
    env.DB.prepare(`SELECT id, email, display_name, role, is_active, created_at, updated_at FROM users WHERE shop_id = ?`).bind(principal.shopId),
    env.DB.prepare('SELECT * FROM products WHERE shop_id = ?').bind(principal.shopId),
    env.DB.prepare('SELECT * FROM partners WHERE shop_id = ?').bind(principal.shopId),
    env.DB.prepare('SELECT * FROM orders WHERE shop_id = ? ORDER BY created_at').bind(principal.shopId),
    env.DB.prepare('SELECT oi.* FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.shop_id = ?').bind(principal.shopId),
    env.DB.prepare('SELECT * FROM inventory_movements WHERE shop_id = ? ORDER BY created_at').bind(principal.shopId),
    env.DB.prepare('SELECT * FROM cash_transactions WHERE shop_id = ? ORDER BY occurred_at').bind(principal.shopId),
    env.DB.prepare('SELECT version, state_json, checksum, device_id, updated_at FROM app_state_snapshots WHERE shop_id = ?').bind(principal.shopId),
  ]);
  const generatedAt = nowIso();
  const stateRow = appState.results[0] as { version?: number; state_json?: string; checksum?: string; device_id?: string; updated_at?: string } | undefined;
  let compatibilityState: unknown = null;
  if (stateRow?.state_json) {
    try {
      compatibilityState = JSON.parse(stateRow.state_json);
    } catch {
      compatibilityState = { error: 'CORRUPT_APP_STATE', raw: stateRow.state_json };
    }
  }

  return json(request, env, {
    success: true,
    data: {
      format: 'pmkthkd-backup-v2',
      generatedAt,
      shop: shop.results[0] || null,
      users: users.results,
      products: products.results,
      partners: partners.results,
      orders: orders.results,
      orderItems: items.results,
      inventoryMovements: movements.results,
      cashTransactions: transactions.results,
      appState: stateRow ? {
        version: stateRow.version,
        checksum: stateRow.checksum,
        deviceId: stateRow.device_id,
        updatedAt: stateRow.updated_at,
        state: compatibilityState,
      } : null,
    },
  }, 200, {
    'Content-Disposition': `attachment; filename="pmkthkd-backup-${generatedAt.slice(0, 10)}.json"`,
  });
}

export async function listAuditLogs(request: Request, env: Env, principal: AuthPrincipal, url: URL): Promise<Response> {
  requireRole(principal, 'manager');
  const { page, limit, offset } = pagination(url);
  const result = await env.DB.prepare(`
    SELECT a.*, u.display_name AS actor_name
    FROM audit_logs a LEFT JOIN users u ON a.actor_type = 'user' AND u.id = a.actor_id
    WHERE a.shop_id = ? ORDER BY a.created_at DESC LIMIT ? OFFSET ?
  `).bind(principal.shopId, limit, offset).all();
  return ok(request, env, result.results, { page, limit });
}
