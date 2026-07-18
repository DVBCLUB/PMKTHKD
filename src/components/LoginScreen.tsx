import React, { useState } from 'react';
import { PmkApiError, pmkApi, type PmkUser } from '../lib/apiClient';

interface LoginScreenProps {
  onAuthenticated: (result: { user: PmkUser; shop?: { id: string; name: string } }) => void;
}

function errorMessage(error: unknown): string {
  if (error instanceof PmkApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Đã xảy ra lỗi ngoài dự kiến.';
}

export default function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'bootstrap'>('login');
  const [apiUrl, setApiUrl] = useState(pmkApi.getBaseUrl());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bootstrapToken, setBootstrapToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const saveAndCheckApi = async () => {
    pmkApi.setBaseUrl(apiUrl);
    const health = await pmkApi.health();
    if (health.status !== 'ok') throw new Error('Backend đang ở trạng thái không ổn định.');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await saveAndCheckApi();
      if (mode === 'bootstrap') {
        const result = await pmkApi.bootstrap({ shopName, displayName, email, password, bootstrapToken });
        setMessage({ type: 'success', text: 'Đã tạo cửa hàng và tài khoản chủ thành công.' });
        onAuthenticated({ user: { ...result.user, shopId: result.user.shopId || result.shop.id }, shop: result.shop });
      } else {
        const result = await pmkApi.login(email, password);
        onAuthenticated({ user: result.user });
      }
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-bg-main text-ink flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-brand text-white flex items-center justify-center text-3xl shadow-lg">🏪</div>
          <h1 className="mt-4 text-2xl font-black text-brand">PMKTHKD</h1>
          <p className="mt-1 text-sm text-ink-muted">Bán hàng, kho và sổ kế toán đồng bộ Cloudflare</p>
        </div>

        <form onSubmit={submit} className="bg-surface-card border border-border-hairline rounded-2xl shadow-xl p-6 space-y-4">
          <div className="grid grid-cols-2 gap-2 bg-bg-main p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`rounded-lg px-3 py-2 text-sm font-bold ${mode === 'login' ? 'bg-brand text-white shadow' : 'text-ink-muted'}`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => setMode('bootstrap')}
              className={`rounded-lg px-3 py-2 text-sm font-bold ${mode === 'bootstrap' ? 'bg-brand text-white shadow' : 'text-ink-muted'}`}
            >
              Thiết lập lần đầu
            </button>
          </div>

          <label className="block">
            <span className="text-xs font-bold text-ink-muted">Địa chỉ Cloudflare Worker</span>
            <input
              value={apiUrl}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setApiUrl(event.target.value)}
              placeholder="https://pmkthkd-api.ten-ban.workers.dev"
              required
              inputMode="url"
              className="mt-1 w-full rounded-lg border border-border-hairline bg-bg-main px-3 py-2.5 text-sm outline-none focus:border-brand"
            />
          </label>

          {mode === 'bootstrap' && (
            <>
              <label className="block">
                <span className="text-xs font-bold text-ink-muted">Tên cửa hàng</span>
                <input value={shopName} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setShopName(event.target.value)} required minLength={2} className="mt-1 w-full rounded-lg border border-border-hairline bg-bg-main px-3 py-2.5 text-sm outline-none focus:border-brand" />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-ink-muted">Tên chủ cửa hàng</span>
                <input value={displayName} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setDisplayName(event.target.value)} required minLength={2} className="mt-1 w-full rounded-lg border border-border-hairline bg-bg-main px-3 py-2.5 text-sm outline-none focus:border-brand" />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-ink-muted">Bootstrap token</span>
                <input value={bootstrapToken} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setBootstrapToken(event.target.value)} required type="password" autoComplete="off" className="mt-1 w-full rounded-lg border border-border-hairline bg-bg-main px-3 py-2.5 text-sm outline-none focus:border-brand" />
                <span className="mt-1 block text-[11px] text-ink-muted">Token này được đặt bằng lệnh Wrangler và chỉ dùng một lần.</span>
              </label>
            </>
          )}

          <label className="block">
            <span className="text-xs font-bold text-ink-muted">Email</span>
            <input value={email} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)} required type="email" autoComplete="username" className="mt-1 w-full rounded-lg border border-border-hairline bg-bg-main px-3 py-2.5 text-sm outline-none focus:border-brand" />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-ink-muted">Mật khẩu</span>
            <input value={password} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)} required minLength={10} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className="mt-1 w-full rounded-lg border border-border-hairline bg-bg-main px-3 py-2.5 text-sm outline-none focus:border-brand" />
          </label>

          {message && (
            <div className={`rounded-lg px-3 py-2 text-sm ${message.type === 'error' ? 'bg-danger-light text-danger' : 'bg-emerald-50 text-emerald-700'}`}>
              {message.text}
            </div>
          )}

          <button disabled={busy} className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-black text-white shadow-md transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60">
            {busy ? 'Đang kết nối…' : mode === 'login' ? 'Đăng nhập hệ thống' : 'Tạo cửa hàng đầu tiên'}
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] text-ink-muted">
          Dữ liệu được lưu trên D1 và có bản sao offline trong trình duyệt. Không nhập token vào máy lạ.
        </p>
      </div>
    </main>
  );
}
