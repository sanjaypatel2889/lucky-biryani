// Tiny API client. Server-side calls go direct; browser calls hit Next.js
// rewrites which proxy to the backend. Auth via JWT cookie OR Authorization
// header (the latter is what the auth-store uses on the client).

const SERVER_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

function browserBase() {
  // browser → use rewrite path so cookies are first-party
  return '';
}

export type ApiOpts = RequestInit & { token?: string };

export async function api<T = any>(path: string, opts: ApiOpts = {}): Promise<T> {
  const isBrowser = typeof window !== 'undefined';
  const base = isBrowser ? browserBase() : SERVER_BASE;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> | undefined),
  };
  const token = opts.token ?? (isBrowser ? localStorage.getItem('lbc_token') : null);
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${base}${path}`, {
    ...opts,
    headers,
    credentials: 'include',
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: r.statusText }));
    throw Object.assign(new Error(err.error || 'request_failed'), { status: r.status, detail: err });
  }
  return r.json() as Promise<T>;
}
