import type { Env } from './types';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function uuid(): string {
  return crypto.randomUUID();
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function stringValue(value: unknown, field: string, options: { min?: number; max?: number; optional?: boolean } = {}): string {
  if (value === undefined || value === null) {
    if (options.optional) return '';
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} là bắt buộc.`);
  }

  const result = String(value).trim();
  if (!result && !options.optional) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} là bắt buộc.`);
  }
  if (options.min && result.length < options.min) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} phải có ít nhất ${options.min} ký tự.`);
  }
  if (options.max && result.length > options.max) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} không được vượt quá ${options.max} ký tự.`);
  }
  return result;
}

export function numberValue(value: unknown, field: string, options: { min?: number; max?: number; integer?: boolean } = {}): number {
  const result = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(result)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} phải là số hợp lệ.`);
  }
  if (options.integer && !Number.isInteger(result)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} phải là số nguyên.`);
  }
  if (options.min !== undefined && result < options.min) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} phải lớn hơn hoặc bằng ${options.min}.`);
  }
  if (options.max !== undefined && result > options.max) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} phải nhỏ hơn hoặc bằng ${options.max}.`);
  }
  return result;
}

export function booleanValue(value: unknown, fallback = false): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return fallback;
}

export async function readJson<T>(request: Request, maxBytes = 1_000_000): Promise<T> {
  const contentLength = Number(request.headers.get('content-length') || '0');
  if (contentLength > maxBytes) {
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Dữ liệu gửi lên vượt quá giới hạn cho phép.');
  }

  const text = await request.text();
  if (text.length > maxBytes) {
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Dữ liệu gửi lên vượt quá giới hạn cho phép.');
  }

  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Nội dung JSON không hợp lệ.');
  }
}

export function parseOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGINS.split(',').map((item) => item.trim()).filter(Boolean);
}

export function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('origin');
  const allowed = parseOrigins(env);
  const matchedOrigin = origin && (allowed.includes(origin) || allowed.includes('*')) ? origin : null;

  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key, X-Bootstrap-Token',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };

  if (matchedOrigin) {
    headers['Access-Control-Allow-Origin'] = matchedOrigin;
    headers['Vary'] = 'Origin';
  }

  return headers;
}

export function json(request: Request, env: Env, data: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(request, env), ...extraHeaders },
  });
}

export function ok(request: Request, env: Env, data: unknown, meta?: unknown, status = 200): Response {
  return json(request, env, { success: true, data, ...(meta ? { meta } : {}) }, status);
}

export function getBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (!auth) return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
  return match ? match[1] : null;
}

export function getCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get('cookie');
  if (!cookie) return null;
  for (const part of cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return toBase64Url(new Uint8Array(digest));
}

export async function timingSafeStringEqual(a: string, b: string): Promise<boolean> {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.byteLength !== bBytes.byteLength) {
    const digestA = new Uint8Array(await crypto.subtle.digest('SHA-256', aBytes));
    const digestB = new Uint8Array(await crypto.subtle.digest('SHA-256', bBytes));
    return timingSafeBytesEqual(digestA, digestB) && false;
  }
  return timingSafeBytesEqual(aBytes, bBytes);
}

export function timingSafeBytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual?: (left: ArrayBufferView, right: ArrayBufferView) => boolean;
  };
  if (subtle.timingSafeEqual) return subtle.timingSafeEqual(a, b);

  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a[index] ^ b[index];
  return mismatch === 0;
}

export async function hashPassword(password: string, iterations = 25_000): Promise<{ hash: string; salt: string; iterations: number }> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256,
  );
  return { hash: toBase64Url(new Uint8Array(bits)), salt: toBase64Url(salt), iterations };
}

export async function verifyPassword(password: string, salt: string, iterations: number, expectedHash: string): Promise<boolean> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromBase64Url(salt), iterations, hash: 'SHA-256' },
    key,
    256,
  );
  return timingSafeBytesEqual(new Uint8Array(bits), fromBase64Url(expectedHash));
}

export function clientIpHashInput(request: Request): string {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
}

export function pagination(url: URL): { limit: number; offset: number; page: number } {
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('limit') || '50', 10) || 50));
  return { page, limit, offset: (page - 1) * limit };
}

export function pathMatch(pathname: string, pattern: RegExp): RegExpExecArray | null {
  return pattern.exec(pathname);
}

export function errorResponse(request: Request, env: Env, error: unknown): Response {
  if (error instanceof ApiError) {
    return json(request, env, {
      success: false,
      error: { code: error.code, message: error.message, ...(error.details !== undefined ? { details: error.details } : {}) },
    }, error.status);
  }

  console.error('Unhandled API error', error);
  return json(request, env, {
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Hệ thống gặp lỗi ngoài dự kiến.' },
  }, 500);
}

export function decodeText(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}
