import { requireAnyRole, requireRole } from './auth';
import { auditStatement, requestId, syncStatement } from './db';
import type { AuthPrincipal, Env } from './types';
import { ApiError, nowIso, numberValue, readJson, uuid } from './utils';

const DEFAULT_MAX_STATE_BYTES = 2_000_000;
const HISTORY_LIMIT = 30;

interface AppStateRow {
  shop_id: string;
  version: number;
  state_json: string;
  checksum: string | null;
  device_id: string | null;
  updated_by: string | null;
  updated_at: string;
}

interface HistoryRow {
  id: string;
  version: number;
  label: string | null;
  state_json: string;
  checksum: string | null;
  created_by: string | null;
  created_at: string;
}

function maxStateBytes(env: Env): number {
  const configured = Number.parseInt(env.MAX_STATE_BYTES || '', 10);
  if (!Number.isFinite(configured)) return DEFAULT_MAX_STATE_BYTES;
  return Math.min(5_000_000, Math.max(250_000, configured));
}

async function checksum(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const data = new Uint8Array(digest);
  let binary = '';
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function parseStoredState(stateJson: string): unknown {
  try {
    return JSON.parse(stateJson);
  } catch {
    throw new ApiError(500, 'CORRUPT_APP_STATE', 'Dữ liệu đồng bộ trên máy chủ không đọc được.');
  }
}

function ensureUser(principal: AuthPrincipal): void {
  if (principal.type !== 'user') {
    throw new ApiError(403, 'USER_SESSION_REQUIRED', 'Chức năng này yêu cầu tài khoản người dùng.');
  }
}

async function currentRow(env: Env, shopId: string): Promise<AppStateRow | null> {
  return env.DB.prepare(`
    SELECT shop_id, version, state_json, checksum, device_id, updated_by, updated_at
    FROM app_state_snapshots
    WHERE shop_id = ?
  `).bind(shopId).first<AppStateRow>();
}

export async function getAppState(env: Env, principal: AuthPrincipal): Promise<{
  version: number;
  updatedAt: string | null;
  checksum: string | null;
  deviceId: string | null;
  state: unknown | null;
}> {
  ensureUser(principal);
  const row = await currentRow(env, principal.shopId);
  if (!row) {
    return { version: 0, updatedAt: null, checksum: null, deviceId: null, state: null };
  }

  return {
    version: row.version,
    updatedAt: row.updated_at,
    checksum: row.checksum,
    deviceId: row.device_id,
    state: parseStoredState(row.state_json),
  };
}

export async function putAppState(
  request: Request,
  env: Env,
  principal: AuthPrincipal,
): Promise<{ version: number; updatedAt: string; checksum: string; state: unknown }> {
  ensureUser(principal);
  requireAnyRole(principal, ['owner', 'manager', 'accountant', 'cashier']);

  const body = await readJson<Record<string, unknown>>(request, maxStateBytes(env) + 100_000);
  const baseVersion = numberValue(body.baseVersion ?? 0, 'Phiên bản dữ liệu', { min: 0, integer: true });
  const force = body.force === true;
  const deviceId = String(body.deviceId || '').trim().slice(0, 120) || null;
  const state = body.state;
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new ApiError(400, 'INVALID_APP_STATE', 'Dữ liệu phần mềm phải là một đối tượng JSON.');
  }

  const stateJson = JSON.stringify(state);
  const bytes = new TextEncoder().encode(stateJson).byteLength;
  if (bytes > maxStateBytes(env)) {
    throw new ApiError(413, 'APP_STATE_TOO_LARGE', 'Dữ liệu đồng bộ quá lớn. Hãy xóa ảnh hóa đơn Base64 hoặc xuất ảnh ra Google Drive.', {
      bytes,
      maxBytes: maxStateBytes(env),
    });
  }

  const stateChecksum = await checksum(stateJson);
  const existing = await currentRow(env, principal.shopId);
  const timestamp = nowIso();

  if (!existing) {
    if (baseVersion !== 0 && !force) {
      throw new ApiError(409, 'STATE_CONFLICT', 'Dữ liệu máy chủ chưa tồn tại nhưng thiết bị gửi phiên bản không hợp lệ.', {
        currentVersion: 0,
        updatedAt: null,
      });
    }

    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO app_state_snapshots (
          shop_id, version, state_json, checksum, device_id, updated_by, updated_at
        ) VALUES (?, 1, ?, ?, ?, ?, ?)
      `).bind(principal.shopId, stateJson, stateChecksum, deviceId, principal.actorId, timestamp),
      auditStatement(env, principal, 'app_state.create', 'app_state', principal.shopId, undefined, {
        version: 1,
        checksum: stateChecksum,
        deviceId,
      }, requestId(request)),
      syncStatement(env, principal.shopId, 'app_state', principal.shopId),
    ]);

    return { version: 1, updatedAt: timestamp, checksum: stateChecksum, state };
  }

  if (!force && existing.version !== baseVersion) {
    throw new ApiError(409, 'STATE_CONFLICT', 'Dữ liệu đã được thay đổi trên thiết bị khác.', {
      currentVersion: existing.version,
      updatedAt: existing.updated_at,
      deviceId: existing.device_id,
    });
  }

  if (existing.checksum === stateChecksum) {
    return {
      version: existing.version,
      updatedAt: existing.updated_at,
      checksum: stateChecksum,
      state,
    };
  }

  const nextVersion = existing.version + 1;
  const update = env.DB.prepare(`
    UPDATE app_state_snapshots
    SET version = ?, state_json = ?, checksum = ?, device_id = ?, updated_by = ?, updated_at = ?
    WHERE shop_id = ? AND version = ?
  `).bind(
    nextVersion,
    stateJson,
    stateChecksum,
    deviceId,
    principal.actorId,
    timestamp,
    principal.shopId,
    existing.version,
  );

  const results = await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO app_state_history (
        id, shop_id, version, label, state_json, checksum, created_by, created_at
      )
      SELECT ?, shop_id, version, NULL, state_json, checksum, ?, ?
      FROM app_state_snapshots
      WHERE shop_id = ? AND version = ?
    `).bind(
      uuid(),
      principal.actorId,
      timestamp,
      principal.shopId,
      existing.version,
    ),
    update,
    auditStatement(env, principal, force ? 'app_state.force_update' : 'app_state.update', 'app_state', principal.shopId, {
      version: existing.version,
      checksum: existing.checksum,
      deviceId: existing.device_id,
    }, {
      version: nextVersion,
      checksum: stateChecksum,
      deviceId,
    }, requestId(request)),
    syncStatement(env, principal.shopId, 'app_state', principal.shopId),
  ]);

  const updateResult = results[1];
  const changedRows = Number((updateResult.meta as { changes?: number }).changes || 0);
  if (changedRows === 0) {
    const current = await currentRow(env, principal.shopId);
    throw new ApiError(409, 'STATE_CONFLICT', 'Dữ liệu đã được thay đổi trong lúc đồng bộ.', {
      currentVersion: current?.version || 0,
      updatedAt: current?.updated_at || null,
      deviceId: current?.device_id || null,
    });
  }

  await env.DB.prepare(`
    DELETE FROM app_state_history
    WHERE shop_id = ? AND id NOT IN (
      SELECT id FROM app_state_history WHERE shop_id = ? ORDER BY created_at DESC LIMIT ?
    )
  `).bind(principal.shopId, principal.shopId, HISTORY_LIMIT).run();

  return { version: nextVersion, updatedAt: timestamp, checksum: stateChecksum, state };
}

export async function createAppStateCheckpoint(
  request: Request,
  env: Env,
  principal: AuthPrincipal,
): Promise<{ id: string; version: number; createdAt: string }> {
  ensureUser(principal);
  requireAnyRole(principal, ['owner', 'manager', 'accountant']);
  const body = await readJson<Record<string, unknown>>(request);
  const label = String(body.label || '').trim().slice(0, 120) || null;
  const existing = await currentRow(env, principal.shopId);
  if (!existing) throw new ApiError(404, 'APP_STATE_NOT_FOUND', 'Chưa có dữ liệu để tạo điểm khôi phục.');

  const id = uuid();
  const createdAt = nowIso();
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO app_state_history (
        id, shop_id, version, label, state_json, checksum, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, principal.shopId, existing.version, label, existing.state_json, existing.checksum, principal.actorId, createdAt),
    auditStatement(env, principal, 'app_state.checkpoint', 'app_state_history', id, undefined, {
      version: existing.version,
      label,
    }, requestId(request)),
  ]);

  return { id, version: existing.version, createdAt };
}

export async function listAppStateHistory(
  env: Env,
  principal: AuthPrincipal,
  url: URL,
): Promise<Array<{ id: string; version: number; label: string | null; checksum: string | null; createdAt: string }>> {
  ensureUser(principal);
  requireAnyRole(principal, ['owner', 'manager', 'accountant']);
  const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get('limit') || '20', 10) || 20));
  const result = await env.DB.prepare(`
    SELECT id, version, label, checksum, created_at
    FROM app_state_history
    WHERE shop_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(principal.shopId, limit).all<Pick<HistoryRow, 'id' | 'version' | 'label' | 'checksum' | 'created_at'>>();

  return (result.results || []).map((row) => ({
    id: row.id,
    version: row.version,
    label: row.label,
    checksum: row.checksum,
    createdAt: row.created_at,
  }));
}

export async function restoreAppState(
  request: Request,
  env: Env,
  principal: AuthPrincipal,
  historyId: string,
): Promise<{ version: number; updatedAt: string; checksum: string | null; state: unknown }> {
  ensureUser(principal);
  requireRole(principal, 'manager');
  const history = await env.DB.prepare(`
    SELECT id, version, label, state_json, checksum, created_by, created_at
    FROM app_state_history
    WHERE id = ? AND shop_id = ?
  `).bind(historyId, principal.shopId).first<HistoryRow>();
  if (!history) throw new ApiError(404, 'CHECKPOINT_NOT_FOUND', 'Không tìm thấy điểm khôi phục.');

  const existing = await currentRow(env, principal.shopId);
  const nextVersion = (existing?.version || 0) + 1;
  const updatedAt = nowIso();

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO app_state_snapshots (
        shop_id, version, state_json, checksum, device_id, updated_by, updated_at
      ) VALUES (?, ?, ?, ?, NULL, ?, ?)
      ON CONFLICT(shop_id) DO UPDATE SET
        version = excluded.version,
        state_json = excluded.state_json,
        checksum = excluded.checksum,
        device_id = NULL,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
    `).bind(principal.shopId, nextVersion, history.state_json, history.checksum, principal.actorId, updatedAt),
    auditStatement(env, principal, 'app_state.restore', 'app_state', principal.shopId, {
      version: existing?.version || 0,
      checksum: existing?.checksum || null,
    }, {
      version: nextVersion,
      restoredFrom: history.id,
      restoredVersion: history.version,
      checksum: history.checksum,
    }, requestId(request)),
    syncStatement(env, principal.shopId, 'app_state', principal.shopId),
  ]);

  return {
    version: nextVersion,
    updatedAt,
    checksum: history.checksum,
    state: parseStoredState(history.state_json),
  };
}
