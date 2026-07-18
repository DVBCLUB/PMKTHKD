import type { AuthPrincipal, Env, UserRole, UserRow } from './types';
import {
  ApiError,
  clientIpHashInput,
  getBearerToken,
  getCookie,
  hashPassword,
  normalizeEmail,
  nowIso,
  randomToken,
  sha256,
  stringValue,
  timingSafeStringEqual,
  uuid,
  verifyPassword,
} from './utils';

const ROLE_RANK: Record<UserRole, number> = {
  viewer: 10,
  cashier: 20,
  accountant: 30,
  manager: 40,
  owner: 50,
};

interface SessionPrincipalRow {
  token_hash: string;
  expires_at: string;
  user_id: string;
  shop_id: string;
  email: string;
  display_name: string;
  role: UserRole;
  is_active: number;
}

interface IntegrationPrincipalRow {
  id: string;
  shop_id: string;
  token_hash: string;
  scopes: string;
  revoked_at: string | null;
  expires_at: string | null;
}

export function requireRole(principal: AuthPrincipal, minimum: UserRole): void {
  if (principal.type !== 'user' || !principal.role || ROLE_RANK[principal.role] < ROLE_RANK[minimum]) {
    throw new ApiError(403, 'FORBIDDEN', 'Tài khoản không có quyền thực hiện thao tác này.');
  }
}

export function requireAnyRole(principal: AuthPrincipal, roles: UserRole[]): void {
  if (principal.type !== 'user' || !principal.role || !roles.includes(principal.role)) {
    throw new ApiError(403, 'FORBIDDEN', 'Tài khoản không có quyền thực hiện thao tác này.');
  }
}

export function requireScope(principal: AuthPrincipal, scope: string): void {
  if (principal.type === 'user') return;
  if (!principal.scopes.includes(scope) && !principal.scopes.includes('*')) {
    throw new ApiError(403, 'MISSING_SCOPE', `Token tích hợp thiếu quyền ${scope}.`);
  }
}

function sessionTtlDays(env: Env): number {
  const parsed = Number.parseInt(env.SESSION_TTL_DAYS || '14', 10);
  return Number.isFinite(parsed) ? Math.min(90, Math.max(1, parsed)) : 14;
}

export async function createSession(env: Env, request: Request, user: Pick<UserRow, 'id' | 'shop_id' | 'email' | 'display_name' | 'role'>): Promise<{
  token: string;
  expiresAt: string;
  principal: AuthPrincipal;
}> {
  const token = `pmk_sess_${randomToken(32)}`;
  const tokenHash = await sha256(token);
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + sessionTtlDays(env) * 86_400_000).toISOString();
  const ipHash = await sha256(clientIpHashInput(request));
  const userAgent = (request.headers.get('user-agent') || '').slice(0, 500);

  await env.DB.prepare(`
    INSERT INTO sessions (token_hash, user_id, expires_at, created_at, last_seen_at, user_agent, ip_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(tokenHash, user.id, expiresAt, createdAt, createdAt, userAgent, ipHash).run();

  return {
    token,
    expiresAt,
    principal: {
      type: 'user',
      actorId: user.id,
      shopId: user.shop_id,
      role: user.role,
      scopes: ['*'],
      email: user.email,
      displayName: user.display_name,
      tokenHash,
    },
  };
}

export async function bootstrapOwner(env: Env, request: Request, body: Record<string, unknown>): Promise<{
  shop: { id: string; name: string };
  user: { id: string; email: string; displayName: string; role: UserRole };
  token: string;
  expiresAt: string;
}> {
  const suppliedToken = request.headers.get('x-bootstrap-token') || '';
  if (!env.BOOTSTRAP_TOKEN || !(await timingSafeStringEqual(suppliedToken, env.BOOTSTRAP_TOKEN))) {
    throw new ApiError(401, 'INVALID_BOOTSTRAP_TOKEN', 'Bootstrap token không hợp lệ.');
  }

  const existing = await env.DB.prepare('SELECT COUNT(*) AS count FROM users').first<{ count: number }>();
  if ((existing?.count || 0) > 0) {
    throw new ApiError(409, 'ALREADY_BOOTSTRAPPED', 'Hệ thống đã có tài khoản quản trị.');
  }

  const shopName = stringValue(body.shopName, 'Tên cửa hàng', { min: 2, max: 150 });
  const displayName = stringValue(body.displayName, 'Tên người quản trị', { min: 2, max: 120 });
  const email = normalizeEmail(stringValue(body.email, 'Email', { min: 5, max: 254 }));
  const password = stringValue(body.password, 'Mật khẩu', { min: 10, max: 200 });

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new ApiError(400, 'INVALID_EMAIL', 'Email không đúng định dạng.');
  }

  const passwordData = await hashPassword(password);
  const shopId = uuid();
  const userId = uuid();
  const timestamp = nowIso();

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO shops (id, name, timezone, currency, created_at, updated_at)
      VALUES (?, ?, 'Asia/Ho_Chi_Minh', 'VND', ?, ?)
    `).bind(shopId, shopName, timestamp, timestamp),
    env.DB.prepare(`
      INSERT INTO users (
        id, shop_id, email, display_name, password_hash, password_salt,
        password_iterations, role, is_active, failed_login_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'owner', 1, 0, ?, ?)
    `).bind(
      userId,
      shopId,
      email,
      displayName,
      passwordData.hash,
      passwordData.salt,
      passwordData.iterations,
      timestamp,
      timestamp,
    ),
    env.DB.prepare(`
      INSERT INTO shop_settings (shop_id, low_stock_notifications, negative_stock_policy, created_at, updated_at)
      VALUES (?, 1, 'clamp_zero', ?, ?)
    `).bind(shopId, timestamp, timestamp),
  ]);

  const session = await createSession(env, request, {
    id: userId,
    shop_id: shopId,
    email,
    display_name: displayName,
    role: 'owner',
  });

  return {
    shop: { id: shopId, name: shopName },
    user: { id: userId, email, displayName, role: 'owner' },
    token: session.token,
    expiresAt: session.expiresAt,
  };
}

export async function login(env: Env, request: Request, body: Record<string, unknown>): Promise<{
  user: { id: string; shopId: string; email: string; displayName: string; role: UserRole };
  token: string;
  expiresAt: string;
}> {
  const email = normalizeEmail(stringValue(body.email, 'Email', { min: 5, max: 254 }));
  const password = stringValue(body.password, 'Mật khẩu', { min: 1, max: 200 });

  const user = await env.DB.prepare(`
    SELECT * FROM users WHERE email = ? LIMIT 1
  `).bind(email).first<UserRow>();

  if (!user || !user.is_active) {
    await fakePasswordCheck(password);
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.');
  }

  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    throw new ApiError(429, 'ACCOUNT_TEMPORARILY_LOCKED', 'Tài khoản đang tạm khóa do đăng nhập sai nhiều lần.');
  }

  const valid = await verifyPassword(password, user.password_salt, user.password_iterations, user.password_hash);
  if (!valid) {
    const failedCount = user.failed_login_count + 1;
    const lockedUntil = failedCount >= 5 ? new Date(Date.now() + 15 * 60_000).toISOString() : null;
    await env.DB.prepare(`
      UPDATE users SET failed_login_count = ?, locked_until = ?, updated_at = ? WHERE id = ?
    `).bind(failedCount >= 5 ? 0 : failedCount, lockedUntil, nowIso(), user.id).run();
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.');
  }

  await env.DB.prepare(`
    UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = ?, updated_at = ? WHERE id = ?
  `).bind(nowIso(), nowIso(), user.id).run();

  const session = await createSession(env, request, user);
  return {
    user: {
      id: user.id,
      shopId: user.shop_id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
    },
    token: session.token,
    expiresAt: session.expiresAt,
  };
}

async function fakePasswordCheck(password: string): Promise<void> {
  const salt = 'AAAAAAAAAAAAAAAAAAAAAA';
  try {
    await verifyPassword(password, salt, 25_000, 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  } catch {
    // Keep unknown-user responses closer to the password verification path.
  }
}

export async function authenticate(env: Env, request: Request, _ctx?: ExecutionContext): Promise<AuthPrincipal> {
  const token = getBearerToken(request) || getCookie(request, 'pmk_session');
  if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập.');

  if (token.startsWith('pmk_ext_')) {
    const tokenHash = await sha256(token);
    const integration = await env.DB.prepare(`
      SELECT id, shop_id, token_hash, scopes, revoked_at, expires_at
      FROM integration_tokens
      WHERE token_hash = ?
      LIMIT 1
    `).bind(tokenHash).first<IntegrationPrincipalRow>();

    if (!integration || integration.revoked_at || (integration.expires_at && new Date(integration.expires_at).getTime() <= Date.now())) {
      throw new ApiError(401, 'INVALID_INTEGRATION_TOKEN', 'Token tích hợp không hợp lệ hoặc đã bị thu hồi.');
    }

    return {
      type: 'integration',
      actorId: integration.id,
      shopId: integration.shop_id,
      scopes: integration.scopes.split(',').map((item) => item.trim()).filter(Boolean),
      tokenHash,
    };
  }

  if (!token.startsWith('pmk_sess_')) {
    throw new ApiError(401, 'INVALID_SESSION', 'Phiên đăng nhập không hợp lệ.');
  }

  const tokenHash = await sha256(token);
  const session = await env.DB.prepare(`
    SELECT
      s.token_hash, s.expires_at,
      u.id AS user_id, u.shop_id, u.email, u.display_name, u.role, u.is_active
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
    LIMIT 1
  `).bind(tokenHash).first<SessionPrincipalRow>();

  if (!session || !session.is_active || new Date(session.expires_at).getTime() <= Date.now()) {
    if (session) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    throw new ApiError(401, 'SESSION_EXPIRED', 'Phiên đăng nhập đã hết hạn.');
  }

  return {
    type: 'user',
    actorId: session.user_id,
    shopId: session.shop_id,
    role: session.role,
    scopes: ['*'],
    email: session.email,
    displayName: session.display_name,
    tokenHash,
  };
}

export async function logout(env: Env, principal: AuthPrincipal): Promise<void> {
  if (principal.type === 'user' && principal.tokenHash) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(principal.tokenHash).run();
  }
}

export async function createIntegrationToken(env: Env, principal: AuthPrincipal, body: Record<string, unknown>): Promise<{
  id: string;
  name: string;
  token: string;
  scopes: string[];
  expiresAt: string | null;
}> {
  requireRole(principal, 'owner');
  const name = stringValue(body.name, 'Tên token', { min: 2, max: 100 });
  const requestedScopes = Array.isArray(body.scopes) ? body.scopes.map(String) : ['orders:import'];
  const allowedScopes = new Set(['orders:import', 'sync:read']);
  const scopes = [...new Set(requestedScopes.filter((scope) => allowedScopes.has(scope)))];
  if (scopes.length === 0) scopes.push('orders:import');

  let expiresAt: string | null = null;
  if (body.expiresAt) {
    const parsed = new Date(String(body.expiresAt));
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
      throw new ApiError(400, 'INVALID_EXPIRY', 'Ngày hết hạn token không hợp lệ.');
    }
    expiresAt = parsed.toISOString();
  }

  const id = uuid();
  const token = `pmk_ext_${randomToken(32)}`;
  const tokenHash = await sha256(token);
  await env.DB.prepare(`
    INSERT INTO integration_tokens (id, shop_id, name, token_hash, scopes, expires_at, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, principal.shopId, name, tokenHash, scopes.join(','), expiresAt, principal.actorId, nowIso()).run();

  return { id, name, token, scopes, expiresAt };
}

export async function revokeIntegrationToken(env: Env, principal: AuthPrincipal, tokenId: string): Promise<void> {
  requireRole(principal, 'owner');
  const result = await env.DB.prepare(`
    UPDATE integration_tokens SET revoked_at = ? WHERE id = ? AND shop_id = ? AND revoked_at IS NULL
  `).bind(nowIso(), tokenId, principal.shopId).run();
  if (!result.success) throw new ApiError(500, 'TOKEN_REVOKE_FAILED', 'Không thể thu hồi token tích hợp.');
}

export function sessionCookie(token: string, expiresAt: string): string {
  return `pmk_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}`;
}

export function clearSessionCookie(): string {
  return 'pmk_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}
