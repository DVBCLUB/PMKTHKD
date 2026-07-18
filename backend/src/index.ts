import {
  authenticate,
  bootstrapOwner,
  clearSessionCookie,
  createIntegrationToken,
  login,
  logout,
  revokeIntegrationToken,
  sessionCookie,
} from './auth';
import type { Env } from './types';
import { ApiError, corsHeaders, errorResponse, json, nowIso, ok, pathMatch, readJson } from './utils';
import { handleDashboard, listProducts, createProduct, updateProduct, adjustInventory, listInventoryMovements } from './products';
import { importOrder, listOrders, orderDetail } from './orders';
import { listCashTransactions, createCashTransaction, listPartners, createPartner } from './accounting';
import { listUsers, createUser, updateUser, listIntegrationTokens, syncEvents, backup, listAuditLogs } from './admin';
import { auditStatement, requestId } from './db';

async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });

  if (method === 'GET' && pathname === '/api/health') {
    const db = await env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();
    return ok(request, env, {
      status: db?.ok === 1 ? 'ok' : 'degraded',
      environment: env.APP_ENV,
      time: nowIso(),
      service: 'pmkthkd-api',
    });
  }

  if (method === 'POST' && pathname === '/api/auth/bootstrap') {
    const body = await readJson<Record<string, unknown>>(request);
    const result = await bootstrapOwner(env, request, body);
    return ok(request, env, result, undefined, 201);
  }

  if (method === 'POST' && pathname === '/api/auth/login') {
    const body = await readJson<Record<string, unknown>>(request);
    const result = await login(env, request, body);
    return json(request, env, { success: true, data: result }, 200, {
      'Set-Cookie': sessionCookie(result.token, result.expiresAt),
    });
  }

  const principal = await authenticate(env, request, ctx);

  if (method === 'POST' && pathname === '/api/auth/logout') {
    await logout(env, principal);
    return json(request, env, { success: true, data: { loggedOut: true } }, 200, {
      'Set-Cookie': clearSessionCookie(),
    });
  }

  if (method === 'GET' && pathname === '/api/me') {
    const shop = await env.DB.prepare('SELECT id, name, timezone, currency FROM shops WHERE id = ?')
      .bind(principal.shopId).first();
    return ok(request, env, { principal, shop });
  }

  if (method === 'GET' && pathname === '/api/dashboard') return handleDashboard(request, env, principal);
  if (method === 'GET' && pathname === '/api/products') return listProducts(request, env, principal, url);
  if (method === 'POST' && pathname === '/api/products') return createProduct(request, env, principal);

  const productMatch = pathMatch(pathname, /^\/api\/products\/([^/]+)$/);
  if (method === 'PATCH' && productMatch) return updateProduct(request, env, principal, decodeURIComponent(productMatch[1]));

  if (method === 'POST' && pathname === '/api/inventory/adjust') return adjustInventory(request, env, principal);
  if (method === 'GET' && pathname === '/api/inventory/movements') return listInventoryMovements(request, env, principal, url);

  if (method === 'POST' && pathname === '/api/orders/import') return importOrder(request, env, principal);
  if (method === 'GET' && pathname === '/api/orders') return listOrders(request, env, principal, url);
  const orderMatch = pathMatch(pathname, /^\/api\/orders\/([^/]+)$/);
  if (method === 'GET' && orderMatch) return orderDetail(request, env, principal, decodeURIComponent(orderMatch[1]));

  if (method === 'GET' && pathname === '/api/cash-transactions') return listCashTransactions(request, env, principal, url);
  if (method === 'POST' && pathname === '/api/cash-transactions') return createCashTransaction(request, env, principal);

  if (method === 'GET' && pathname === '/api/partners') return listPartners(request, env, principal, url);
  if (method === 'POST' && pathname === '/api/partners') return createPartner(request, env, principal);

  if (method === 'GET' && pathname === '/api/users') return listUsers(request, env, principal);
  if (method === 'POST' && pathname === '/api/users') return createUser(request, env, principal);
  const userMatch = pathMatch(pathname, /^\/api\/users\/([^/]+)$/);
  if (method === 'PATCH' && userMatch) return updateUser(request, env, principal, decodeURIComponent(userMatch[1]));

  if (method === 'GET' && pathname === '/api/integrations/tokens') return listIntegrationTokens(request, env, principal);
  if (method === 'POST' && pathname === '/api/integrations/tokens') {
    const body = await readJson<Record<string, unknown>>(request);
    const token = await createIntegrationToken(env, principal, body);
    await env.DB.batch([
      auditStatement(env, principal, 'integration_token.create', 'integration_token', token.id, undefined, {
        name: token.name, scopes: token.scopes, expiresAt: token.expiresAt,
      }, requestId(request)),
    ]);
    return ok(request, env, token, undefined, 201);
  }
  const integrationMatch = pathMatch(pathname, /^\/api\/integrations\/tokens\/([^/]+)$/);
  if (method === 'DELETE' && integrationMatch) {
    const tokenId = decodeURIComponent(integrationMatch[1]);
    await revokeIntegrationToken(env, principal, tokenId);
    await env.DB.batch([
      auditStatement(env, principal, 'integration_token.revoke', 'integration_token', tokenId, undefined, { revoked: true }, requestId(request)),
    ]);
    return ok(request, env, { revoked: true });
  }

  if (method === 'GET' && pathname === '/api/sync/events') return syncEvents(request, env, principal, url);
  if (method === 'GET' && pathname === '/api/backup') return backup(request, env, principal);
  if (method === 'GET' && pathname === '/api/audit-logs') return listAuditLogs(request, env, principal, url);

  throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy API được yêu cầu.');
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await route(request, env, ctx);
    } catch (error) {
      return errorResponse(request, env, error);
    }
  },
} satisfies ExportedHandler<Env>;
