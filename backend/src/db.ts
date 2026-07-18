import type { AuthPrincipal, Env, ImportOrderInput, UserRole } from './types';
import { ApiError, nowIso, uuid } from './utils';

export function auditStatement(
  env: Env,
  principal: AuthPrincipal,
  action: string,
  entityType: string,
  entityId: string | null,
  before: unknown,
  after: unknown,
  requestId: string,
): D1PreparedStatement {
  return env.DB.prepare(`
    INSERT INTO audit_logs (
      id, shop_id, actor_type, actor_id, action, entity_type, entity_id,
      before_json, after_json, request_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    uuid(),
    principal.shopId,
    principal.type,
    principal.actorId,
    action,
    entityType,
    entityId,
    before === undefined ? null : JSON.stringify(before),
    after === undefined ? null : JSON.stringify(after),
    requestId,
    nowIso(),
  );
}

export function syncStatement(env: Env, shopId: string, entityType: string, entityId: string, operation = 'upsert'): D1PreparedStatement {
  return env.DB.prepare(`
    INSERT INTO sync_events (shop_id, entity_type, entity_id, operation, changed_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(shopId, entityType, entityId, operation, nowIso());
}

export function requestId(request: Request): string {
  return request.headers.get('cf-ray') || uuid();
}

export function normalizePlatform(value: unknown): ImportOrderInput['platform'] {
  const platform = String(value || '').toLowerCase();
  if (!['shopee', 'tiktok', 'pos', 'manual'].includes(platform)) {
    throw new ApiError(400, 'INVALID_PLATFORM', 'Nền tảng đơn hàng không hợp lệ.');
  }
  return platform as ImportOrderInput['platform'];
}

export function validateRole(value: unknown): UserRole {
  const role = String(value || 'viewer') as UserRole;
  if (!['owner', 'manager', 'accountant', 'cashier', 'viewer'].includes(role)) {
    throw new ApiError(400, 'INVALID_ROLE', 'Vai trò người dùng không hợp lệ.');
  }
  return role;
}

export function vnDayRange(): { start: string; end: string; date: string } {
  const shifted = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const date = shifted.toISOString().slice(0, 10);
  const start = new Date(`${date}T00:00:00.000+07:00`).toISOString();
  const end = new Date(`${date}T23:59:59.999+07:00`).toISOString();
  return { start, end, date };
}

