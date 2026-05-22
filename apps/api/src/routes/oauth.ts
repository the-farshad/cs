/** OAuth sign-in: Google and GitHub authorization-code flows.
 *
 *  Browser hits GET /auth/{google,github} → we redirect to the provider with a
 *  random `state` (stored in a short-lived cookie). The provider redirects back
 *  to /auth/{provider}/callback, where we verify state, exchange the code for an
 *  access token, fetch the user's email, upsert the user, mint our own JWT, and
 *  redirect to APP_ORIGIN/auth?token=<jwt>. On any failure we redirect with
 *  ?error=<reason> so the frontend can show a message.
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { signJwt } from '../auth.js';
import { pool } from '../db.js';

const APP_ORIGIN = process.env.APP_ORIGIN ?? 'https://cs.thefarshad.com';
const API_BASE_URL = process.env.API_BASE_URL ?? 'https://csapi.thefarshad.com';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID ?? '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET ?? '';

const STATE_COOKIE = 'cs_oauth_state';

export const oauthRouter = Router();

type UserRow = { id: string; email: string; handle: string };

function handleFrom(email: string, fallback?: string): string {
  const local = email.split('@')[0];
  return local && local.length > 0 ? local : (fallback ?? email);
}

async function upsertUser(email: string, handle: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(
    `insert into users (email, handle)
       values ($1, $2)
     on conflict (email) do update set email = excluded.email
     returning id, email, handle`,
    [email.toLowerCase(), handle],
  );
  return rows[0] ?? null;
}

function setStateCookie(res: Response, state: string): void {
  res.setHeader('Set-Cookie', `${STATE_COOKIE}=${state}; Max-Age=600; Path=/auth; HttpOnly; Secure; SameSite=Lax`);
}

function readStateCookie(req: Request): string | null {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, v] = part.trim().split('=');
    if (k === STATE_COOKIE) return v ?? null;
  }
  return null;
}

function fail(res: Response, reason: string): void {
  res.redirect(`${APP_ORIGIN}/auth?error=${encodeURIComponent(reason)}`);
}

function succeed(res: Response, token: string): void {
  res.redirect(`${APP_ORIGIN}/auth?token=${encodeURIComponent(token)}`);
}

// --- Google -----------------------------------------------------------------

oauthRouter.get('/google', (_req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return fail(res, 'google_not_configured');
  const state = randomUUID();
  setStateCookie(res, state);
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  u.searchParams.set('redirect_uri', `${API_BASE_URL}/auth/google/callback`);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', 'openid email profile');
  u.searchParams.set('state', state);
  u.searchParams.set('prompt', 'select_account');
  res.redirect(u.toString());
});

oauthRouter.get('/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (typeof code !== 'string' || typeof state !== 'string') return fail(res, 'bad_callback');
    if (state !== readStateCookie(req)) return fail(res, 'bad_state');

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        redirect_uri: `${API_BASE_URL}/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) return fail(res, 'token_exchange');
    const tok = (await tokenRes.json()) as { access_token?: string };
    if (!tok.access_token) return fail(res, 'no_access_token');

    const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    if (!infoRes.ok) return fail(res, 'userinfo');
    const info = (await infoRes.json()) as { email?: string; email_verified?: boolean };
    if (!info.email) return fail(res, 'no_email');

    const user = await upsertUser(info.email, handleFrom(info.email));
    if (!user) return fail(res, 'user');
    succeed(res, signJwt(user.id, user.email));
  } catch (err) {
    console.error('[oauth google]', err);
    fail(res, 'google');
  }
});

// --- GitHub -----------------------------------------------------------------

oauthRouter.get('/github', (_req, res) => {
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) return fail(res, 'github_not_configured');
  const state = randomUUID();
  setStateCookie(res, state);
  const u = new URL('https://github.com/login/oauth/authorize');
  u.searchParams.set('client_id', GITHUB_CLIENT_ID);
  u.searchParams.set('redirect_uri', `${API_BASE_URL}/auth/github/callback`);
  u.searchParams.set('scope', 'read:user user:email');
  u.searchParams.set('state', state);
  res.redirect(u.toString());
});

oauthRouter.get('/github/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (typeof code !== 'string' || typeof state !== 'string') return fail(res, 'bad_callback');
    if (state !== readStateCookie(req)) return fail(res, 'bad_state');

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${API_BASE_URL}/auth/github/callback`,
      }),
    });
    if (!tokenRes.ok) return fail(res, 'token_exchange');
    const tok = (await tokenRes.json()) as { access_token?: string };
    if (!tok.access_token) return fail(res, 'no_access_token');

    const ghHeaders = {
      Authorization: `Bearer ${tok.access_token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'cs.thefarshad.com',
    };
    const userRes = await fetch('https://api.github.com/user', { headers: ghHeaders });
    if (!userRes.ok) return fail(res, 'userinfo');
    const gh = (await userRes.json()) as { login?: string; email?: string | null };

    let email = gh.email ?? null;
    if (!email) {
      const emailsRes = await fetch('https://api.github.com/user/emails', { headers: ghHeaders });
      if (emailsRes.ok) {
        const emails = (await emailsRes.json()) as { email: string; primary: boolean; verified: boolean }[];
        email = emails.find((e) => e.primary && e.verified)?.email ?? emails.find((e) => e.verified)?.email ?? null;
      }
    }
    if (!email) return fail(res, 'no_email');

    const user = await upsertUser(email, handleFrom(email, gh.login));
    if (!user) return fail(res, 'user');
    succeed(res, signJwt(user.id, user.email));
  } catch (err) {
    console.error('[oauth github]', err);
    fail(res, 'github');
  }
});
