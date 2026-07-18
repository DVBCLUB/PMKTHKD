import React, { useCallback, useEffect, useRef, useState } from 'react';
import App from './App';
import LoginScreen from './components/LoginScreen';
import { emptySnapshot, hasLocalBusinessData, normalizeSnapshot, readLocalSnapshot, snapshotFingerprint, writeLocalSnapshot, type AppSnapshot } from './lib/appSnapshot';
import { cacheKey, deleteOfflineValue, getOfflineValue, outboxKey, setOfflineValue } from './lib/offlineDb';
import { PmkApiError, pmkApi, type AppStateEnvelope, type PmkUser } from './lib/apiClient';

interface AuthState {
  user: PmkUser;
  shop: { id: string; name: string; timezone?: string; currency?: string };
}

interface PendingState {
  baseVersion: number;
  deviceId: string;
  state: AppSnapshot;
  queuedAt: string;
}

type SyncStatus = 'idle' | 'loading' | 'synced' | 'pending' | 'offline' | 'error' | 'conflict';

function deviceId(): string {
  const key = 'pmk_device_id';
  let value = localStorage.getItem(key);
  if (!value) {
    value = `web-${crypto.randomUUID()}`;
    localStorage.setItem(key, value);
  }
  return value;
}

function installLegacyApiCompatibility(): () => void {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    try {
      const url = new URL(raw, window.location.origin);
      if (url.origin === window.location.origin && url.pathname === '/api/scraped-orders') {
        if ((init?.method || 'GET').toUpperCase() === 'POST') {
          return new Response(JSON.stringify({ success: true, message: 'Cloud mode: hàng đợi Express đã tắt.' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ success: true, orders: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch {
      // Fall through to the real fetch implementation.
    }
    return originalFetch(input, init);
  };
  return () => {
    window.fetch = originalFetch;
  };
}

function errorText(error: unknown): string {
  if (error instanceof PmkApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Đã xảy ra lỗi ngoài dự kiến.';
}

const AUTH_CACHE_KEY = 'pmk_last_auth';

function readCachedAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthState;
    return parsed?.user?.id && parsed?.shop?.id ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedAuth(auth: AuthState | null): void {
  if (auth) localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(auth));
  else localStorage.removeItem(AUTH_CACHE_KEY);
}

export default function AppCloud() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [appReady, setAppReady] = useState(false);
  const [appRevision, setAppRevision] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [panelOpen, setPanelOpen] = useState(false);
  const [conflict, setConflict] = useState<AppStateEnvelope<AppSnapshot> | null>(null);

  const versionRef = useRef(0);
  const lastFingerprintRef = useRef('');
  const applyingRemoteRef = useRef(false);
  const flushTimerRef = useRef<number | null>(null);
  const authRef = useRef<AuthState | null>(null);

  useEffect(() => {
    authRef.current = auth;
    writeCachedAuth(auth);
  }, [auth]);

  const applySnapshot = useCallback((snapshot: AppSnapshot, version: number) => {
    applyingRemoteRef.current = true;
    writeLocalSnapshot(snapshot);
    lastFingerprintRef.current = snapshotFingerprint(snapshot);
    versionRef.current = version;
    localStorage.setItem('pmk_last_shop_id', authRef.current?.shop.id || '');
    setAppRevision((value) => value + 1);
    window.setTimeout(() => {
      applyingRemoteRef.current = false;
    }, 50);
  }, []);

  const authenticateFromServer = useCallback(async (): Promise<AuthState> => {
    const result = await pmkApi.me();
    return {
      user: {
        id: result.principal.actorId,
        shopId: result.principal.shopId,
        email: result.principal.email,
        displayName: result.principal.displayName,
        role: result.principal.role,
      },
      shop: result.shop,
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!pmkApi.hasBaseUrl() || !pmkApi.getToken()) {
        if (!cancelled) setCheckingSession(false);
        return;
      }
      try {
        const resolved = await authenticateFromServer();
        if (!cancelled) setAuth(resolved);
      } catch (error) {
        if (error instanceof PmkApiError && (error.code === 'NETWORK_ERROR' || error.status === 0)) {
          const cached = readCachedAuth();
          if (cached && !cancelled) {
            setAuth(cached);
            setSyncStatus('offline');
            setSyncMessage('Không kết nối được backend; đang mở phiên offline gần nhất.');
          }
        } else {
          pmkApi.setToken(null);
          writeCachedAuth(null);
        }
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, [authenticateFromServer]);

  const flushPending = useCallback(async (force = false) => {
    const currentAuth = authRef.current;
    if (!currentAuth) return;
    const key = outboxKey(currentAuth.shop.id);
    const pending = await getOfflineValue<PendingState>(key);
    if (!pending) {
      setSyncStatus(navigator.onLine ? 'synced' : 'offline');
      return;
    }
    if (!navigator.onLine) {
      setSyncStatus('offline');
      setSyncMessage('Dữ liệu đang chờ đồng bộ khi có Internet.');
      return;
    }

    setSyncStatus('pending');
    setSyncMessage('Đang đẩy thay đổi lên D1…');
    try {
      const saved = await pmkApi.saveAppState<AppSnapshot>({
        baseVersion: force ? versionRef.current : pending.baseVersion,
        state: pending.state,
        deviceId: pending.deviceId,
        force,
      });
      versionRef.current = saved.version;
      lastFingerprintRef.current = snapshotFingerprint(pending.state);
      await setOfflineValue(cacheKey(currentAuth.shop.id), saved);
      await deleteOfflineValue(key);
      setConflict(null);
      setSyncStatus('synced');
      setSyncMessage(`Đã đồng bộ phiên bản ${saved.version}.`);
    } catch (error) {
      if (error instanceof PmkApiError && error.code === 'STATE_CONFLICT') {
        const remote = await pmkApi.appState<AppSnapshot>();
        setConflict(remote);
        setSyncStatus('conflict');
        setSyncMessage('Có thay đổi từ thiết bị khác. Cần chọn dữ liệu giữ lại.');
        return;
      }
      setSyncStatus(error instanceof PmkApiError && error.code === 'NETWORK_ERROR' ? 'offline' : 'error');
      setSyncMessage(errorText(error));
    }
  }, []);

  const hydrate = useCallback(async (currentAuth: AuthState) => {
    setAppReady(false);
    setSyncStatus('loading');
    setSyncMessage('Đang tải dữ liệu cửa hàng…');

    const shopId = currentAuth.shop.id;
    const cached = await getOfflineValue<AppStateEnvelope<AppSnapshot>>(cacheKey(shopId));
    const pending = await getOfflineValue<PendingState>(outboxKey(shopId));

    if (pending?.state) {
      applySnapshot(normalizeSnapshot(pending.state), pending.baseVersion);
      setSyncStatus(navigator.onLine ? 'pending' : 'offline');
    } else if (cached?.state) {
      applySnapshot(normalizeSnapshot(cached.state), cached.version);
    }

    try {
      const remote = await pmkApi.appState<AppSnapshot>();
      if (remote.state) {
        if (pending && remote.version !== pending.baseVersion) {
          setConflict(remote);
          setSyncStatus('conflict');
          setSyncMessage('Máy chủ có dữ liệu mới hơn dữ liệu đang chờ trên máy này.');
        } else if (!pending) {
          const normalized = normalizeSnapshot(remote.state);
          applySnapshot(normalized, remote.version);
          await setOfflineValue(cacheKey(shopId), { ...remote, state: normalized });
          setSyncStatus('synced');
          setSyncMessage(`Đã tải phiên bản ${remote.version}.`);
        }
      } else {
        const local = readLocalSnapshot();
        const lastShopId = localStorage.getItem('pmk_last_shop_id');
        const shouldImport = hasLocalBusinessData(local) && (!lastShopId || lastShopId === shopId);
        const initial = shouldImport ? local : emptySnapshot();
        applySnapshot(initial, 0);
        await setOfflineValue(outboxKey(shopId), {
          baseVersion: 0,
          deviceId: deviceId(),
          state: initial,
          queuedAt: new Date().toISOString(),
        } satisfies PendingState);
        await flushPending();
        setSyncMessage(shouldImport ? 'Đã chuyển dữ liệu cũ lên D1.' : 'Đã tạo kho dữ liệu trống trên D1.');
      }
    } catch (error) {
      if (!cached && !pending) {
        const local = hasLocalBusinessData() ? readLocalSnapshot() : emptySnapshot();
        applySnapshot(local, 0);
      }
      setSyncStatus('offline');
      setSyncMessage(`Đang dùng dữ liệu offline: ${errorText(error)}`);
    } finally {
      setAppReady(true);
    }
  }, [applySnapshot, flushPending]);

  useEffect(() => {
    if (!auth) return;
    void hydrate(auth);
  }, [auth, hydrate]);

  useEffect(() => installLegacyApiCompatibility(), []);

  useEffect(() => {
    if (!auth || !appReady) return;
    const interval = window.setInterval(() => {
      if (applyingRemoteRef.current) return;
      const snapshot = readLocalSnapshot();
      const fingerprint = snapshotFingerprint(snapshot);
      if (fingerprint === lastFingerprintRef.current) return;

      lastFingerprintRef.current = fingerprint;
      const pending: PendingState = {
        baseVersion: versionRef.current,
        deviceId: deviceId(),
        state: snapshot,
        queuedAt: new Date().toISOString(),
      };
      void setOfflineValue(cacheKey(auth.shop.id), {
        version: versionRef.current,
        updatedAt: pending.queuedAt,
        checksum: null,
        deviceId: pending.deviceId,
        state: snapshot,
      } satisfies AppStateEnvelope<AppSnapshot>);
      void setOfflineValue(outboxKey(auth.shop.id), pending);
      setSyncStatus(navigator.onLine ? 'pending' : 'offline');
      setSyncMessage(navigator.onLine ? 'Có thay đổi mới, đang chờ đồng bộ…' : 'Đã lưu offline, chờ có Internet.');

      if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = window.setTimeout(() => void flushPending(), 1500);
    }, 1200);

    return () => {
      window.clearInterval(interval);
      if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current);
    };
  }, [auth, appReady, flushPending]);

  const pullRemote = useCallback(async () => {
    const currentAuth = authRef.current;
    if (!currentAuth || !navigator.onLine || conflict) return;
    const pending = await getOfflineValue<PendingState>(outboxKey(currentAuth.shop.id));
    if (pending) {
      await flushPending();
      return;
    }

    try {
      const remote = await pmkApi.appState<AppSnapshot>();
      if (remote.state && remote.version > versionRef.current) {
        const normalized = normalizeSnapshot(remote.state);
        applySnapshot(normalized, remote.version);
        await setOfflineValue(cacheKey(currentAuth.shop.id), { ...remote, state: normalized });
        setSyncStatus('synced');
        setSyncMessage(`Đã nhận thay đổi từ thiết bị khác, phiên bản ${remote.version}.`);
      }
    } catch (error) {
      setSyncStatus('offline');
      setSyncMessage(errorText(error));
    }
  }, [applySnapshot, conflict, flushPending]);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      void pullRemote();
    };
    const handleOffline = () => {
      setOnline(false);
      setSyncStatus('offline');
      setSyncMessage('Mất Internet; mọi thay đổi vẫn được lưu trên máy.');
    };
    const handleFocus = () => void pullRemote();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleFocus);
    const interval = window.setInterval(() => void pullRemote(), 60_000);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleFocus);
      window.clearInterval(interval);
    };
  }, [pullRemote]);

  const handleAuthenticated = async (result: { user: PmkUser; shop?: { id: string; name: string } }) => {
    try {
      const resolved = result.shop
        ? { user: result.user, shop: result.shop }
        : await authenticateFromServer();
      setAuth(resolved);
    } catch (error) {
      setSyncStatus('error');
      setSyncMessage(errorText(error));
    }
  };

  const logout = async () => {
    await flushPending();
    await pmkApi.logout();
    writeCachedAuth(null);
    setAuth(null);
    setAppReady(false);
    setPanelOpen(false);
    setConflict(null);
  };

  const keepLocal = async () => {
    if (!conflict) return;
    versionRef.current = conflict.version;
    await flushPending(true);
  };

  const useRemote = async () => {
    if (!auth || !conflict?.state) return;
    const normalized = normalizeSnapshot(conflict.state);
    const pending = await getOfflineValue<PendingState>(outboxKey(auth.shop.id));
    if (pending) {
      await setOfflineValue(`conflict-recovery:${auth.shop.id}:${Date.now()}`, pending);
    }
    await deleteOfflineValue(outboxKey(auth.shop.id));
    await setOfflineValue(cacheKey(auth.shop.id), { ...conflict, state: normalized });
    applySnapshot(normalized, conflict.version);
    setConflict(null);
    setSyncStatus('synced');
    setSyncMessage(`Đã dùng dữ liệu máy chủ phiên bản ${conflict.version}.`);
  };

  const createCheckpoint = async () => {
    try {
      await flushPending();
      const stamp = new Date().toLocaleString('vi-VN');
      await pmkApi.createCheckpoint(`Sao lưu thủ công ${stamp}`);
      setSyncStatus('synced');
      setSyncMessage('Đã tạo điểm khôi phục trên D1.');
    } catch (error) {
      setSyncStatus('error');
      setSyncMessage(errorText(error));
    }
  };

  const downloadBackup = async () => {
    try {
      await flushPending();
      const backup = await pmkApi.backup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `pmkthkd-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setSyncMessage('Đã tải bản sao lưu JSON.');
    } catch (error) {
      setSyncStatus('error');
      setSyncMessage(errorText(error));
    }
  };

  if (checkingSession) {
    return <div className="min-h-screen bg-bg-main flex items-center justify-center text-brand font-bold">Đang kiểm tra phiên đăng nhập…</div>;
  }

  if (!auth) return <LoginScreen onAuthenticated={handleAuthenticated} />;

  return (
    <div className="relative">
      {appReady ? <App key={appRevision} /> : <div className="min-h-screen bg-bg-main flex items-center justify-center text-brand font-bold">Đang tải dữ liệu cửa hàng…</div>}

      <div className="fixed bottom-3 right-3 z-[80] flex flex-col items-end gap-2">
        {conflict && (
          <div className="w-[min(92vw,420px)] rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-2xl text-sm text-amber-950">
            <div className="font-black">Phát hiện xung đột dữ liệu</div>
            <p className="mt-1 text-xs">Một thiết bị khác đã lưu phiên bản {conflict.version}. Chọn bản dữ liệu muốn giữ.</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => void useRemote()} className="flex-1 rounded-lg bg-white border border-amber-300 px-3 py-2 text-xs font-bold">Dùng dữ liệu máy chủ</button>
              <button onClick={() => void keepLocal()} className="flex-1 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white">Giữ dữ liệu máy này</button>
            </div>
          </div>
        )}

        {panelOpen && (
          <div className="w-72 rounded-xl border border-border-hairline bg-surface-card p-3 shadow-2xl text-xs text-ink">
            <div className="font-black text-brand">{auth.shop.name}</div>
            <div className="mt-1 text-ink-muted">{auth.user.displayName} · {auth.user.role}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => void flushPending()} className="rounded-lg border border-border-hairline px-2 py-2 font-bold hover:bg-bg-main">Đồng bộ ngay</button>
              {['owner', 'manager', 'accountant'].includes(auth.user.role) && (
                <button onClick={() => void createCheckpoint()} className="rounded-lg border border-border-hairline px-2 py-2 font-bold hover:bg-bg-main">Tạo điểm lưu</button>
              )}
              {['owner', 'accountant'].includes(auth.user.role) && (
                <button onClick={() => void downloadBackup()} className="rounded-lg border border-border-hairline px-2 py-2 font-bold hover:bg-bg-main">Tải backup</button>
              )}
              <button onClick={() => void logout()} className="rounded-lg bg-danger-light px-2 py-2 font-bold text-danger">Đăng xuất</button>
            </div>
            <div className="mt-3 break-words text-[10px] text-ink-muted">{syncMessage}</div>
          </div>
        )}

        <button
          onClick={() => setPanelOpen((value) => !value)}
          className={`rounded-full px-3 py-2 text-xs font-black text-white shadow-xl ${
            syncStatus === 'error' || syncStatus === 'conflict'
              ? 'bg-danger'
              : syncStatus === 'offline'
                ? 'bg-amber-600'
                : syncStatus === 'pending' || syncStatus === 'loading'
                  ? 'bg-blue-600'
                  : 'bg-emerald-600'
          }`}
          title={syncMessage}
        >
          {online ? '●' : '○'} {syncStatus === 'synced' ? 'Đã đồng bộ' : syncStatus === 'offline' ? 'Offline' : syncStatus === 'conflict' ? 'Xung đột' : syncStatus === 'error' ? 'Lỗi đồng bộ' : 'Đang đồng bộ'}
        </button>
      </div>
    </div>
  );
}
