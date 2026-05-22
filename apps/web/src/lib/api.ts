/** Minerva API client for optional sign-in + cross-device progress sync.
 *
 *  The site works fully without a backend (logged-out = localStorage only).
 *  Every network call here is wrapped in try/catch and typed so it NEVER throws
 *  uncaught: helpers return `null` / `{ ok: false }` on any failure, letting the
 *  UI degrade gracefully when the API is unreachable or down.
 */

/** Backend base URL. Override here if pointing at a different deployment. */
export const API_BASE = 'https://csapi.thefarshad.com';

/** localStorage key holding the signed-in user's JWT. */
const TOKEN_KEY = 'cs-token';

export type User = {
  id: string;
  email: string;
  handle: string;
  /** ISO timestamp the account was created (present from GET /me). */
  createdAt?: string;
};

export type RequestMagicLinkResult = {
  ok: boolean;
  /** Present only in dev when no email transport is configured; lets you click through locally. */
  devLink?: string;
};

export type VerifyResult = {
  token: string;
  user: User;
};

// ---------------------------------------------------------------------------
// Token storage
// ---------------------------------------------------------------------------

export function getToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearToken(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function isLoggedIn(): boolean {
  return getToken() !== null;
}

// ---------------------------------------------------------------------------
// Internal fetch helpers (never throw)
// ---------------------------------------------------------------------------

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Fetch + parse JSON, returning null on any network/HTTP/parse failure. */
async function fetchJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, init);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** Request a magic sign-in link for `email`. Returns `{ ok }` (+ `devLink` in dev). */
export async function requestMagicLink(email: string): Promise<RequestMagicLinkResult> {
  const data = await fetchJson<{ ok: boolean; devLink?: string }>('/auth/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!data || !data.ok) return { ok: false };
  return { ok: true, devLink: data.devLink };
}

/** Exchange a raw magic-link token for a JWT + user. Returns null on failure. */
export async function verify(rawToken: string): Promise<VerifyResult | null> {
  const data = await fetchJson<VerifyResult>(
    `/auth/verify?token=${encodeURIComponent(rawToken)}`,
  );
  if (!data || !data.token || !data.user) return null;
  return data;
}

/** Fetch the current signed-in user. Returns null if logged out or on failure. */
export async function getMe(): Promise<User | null> {
  if (!isLoggedIn()) return null;
  return fetchJson<User>('/me', { headers: authHeaders() });
}

/** Update the signed-in user's username (handle). Returns the updated user or null. */
export async function updateMe(handle: string): Promise<User | null> {
  if (!isLoggedIn()) return null;
  return fetchJson<User>('/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ handle }),
  });
}

/** Delete the signed-in account (and its server-side progress). Returns true on success. */
export async function deleteMe(): Promise<boolean> {
  if (!isLoggedIn()) return false;
  const data = await fetchJson<{ ok: boolean }>('/me', { method: 'DELETE', headers: authHeaders() });
  return Boolean(data?.ok);
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

/** Fetch the server-side completed lesson ids. Returns null on failure. */
export async function getProgress(): Promise<string[] | null> {
  if (!isLoggedIn()) return null;
  const data = await fetchJson<{ completed: string[] }>('/progress', {
    headers: authHeaders(),
  });
  if (!data || !Array.isArray(data.completed)) return null;
  return data.completed;
}

/** Push completed lesson ids; server returns the union. Returns null on failure. */
export async function pushProgress(ids: string[]): Promise<string[] | null> {
  if (!isLoggedIn()) return null;
  const data = await fetchJson<{ completed: string[] }>('/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ completed: ids }),
  });
  if (!data || !Array.isArray(data.completed)) return null;
  return data.completed;
}
