/** Auth routes: passwordless magic-link request + verify, and the /me handler. */
import { Router } from 'express';
import type { RequestHandler } from 'express';
import {
  consumeMagicToken,
  createMagicToken,
  requireAuth,
  signJwt,
} from '../auth.js';
import { pool } from '../db.js';
import { sendMagicLink, smtpConfigured } from '../email.js';

const APP_ORIGIN = process.env.APP_ORIGIN ?? 'https://cs.thefarshad.com';

export const authRouter = Router();

type UserRow = { id: string; email: string; handle: string };

/** Best-effort email shape check. */
function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** The handle defaults to the email's local part. */
function defaultHandle(email: string): string {
  return email.split('@')[0] ?? email;
}

/**
 * POST /auth/request
 * Body: { email }
 * Creates a single-use magic token (15 min) and emails the link. When SMTP is
 * not configured, skips email and returns the link as `devLink`.
 */
authRouter.post('/request', async (req, res) => {
  const email = (req.body as { email?: unknown } | undefined)?.email;
  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'valid email required' });
    return;
  }

  const normalized = email.trim().toLowerCase();
  const token = await createMagicToken(normalized);
  const link = `${APP_ORIGIN}/auth?token=${encodeURIComponent(token)}`;

  if (smtpConfigured()) {
    await sendMagicLink(normalized, link);
    res.json({ ok: true });
    return;
  }

  // Dev mode: no email transport — hand the link back so it can be clicked.
  res.json({ ok: true, devLink: link });
});

/**
 * GET /auth/verify?token=RAW
 * Validates the magic token, marks it used, upserts the user by email, and
 * returns a JWT plus the user. 400 on any failure.
 */
authRouter.get('/verify', async (req, res) => {
  const token = req.query.token;
  if (typeof token !== 'string' || token.length === 0) {
    res.status(400).json({ error: 'token required' });
    return;
  }

  const email = await consumeMagicToken(token);
  if (!email) {
    res.status(400).json({ error: 'invalid or expired token' });
    return;
  }

  // Upsert: existing users keep their handle; new users get the email local part.
  const { rows } = await pool.query<UserRow>(
    `insert into users (email, handle)
       values ($1, $2)
     on conflict (email) do update set email = excluded.email
     returning id, email, handle`,
    [email, defaultHandle(email)],
  );
  const user = rows[0];
  if (!user) {
    res.status(400).json({ error: 'could not create user' });
    return;
  }

  const jwtToken = signJwt(user.id, user.email);
  res.json({
    token: jwtToken,
    user: { id: user.id, email: user.email, handle: user.handle },
  });
});

/**
 * GET /me  (Bearer) — mounted at the app root in index.ts, not under /auth.
 * Returns the signed-in user, or 401.
 *
 * Exported as a middleware chain so the root app can mount it directly.
 */
export const meHandlers: RequestHandler[] = [
  requireAuth,
  async (req, res) => {
    const userId = req.user!.id;
    const { rows } = await pool.query<UserRow>(
      `select id, email, handle from users where id = $1`,
      [userId],
    );
    const user = rows[0];
    if (!user) {
      res.status(401).json({ error: 'user not found' });
      return;
    }
    res.json({ id: user.id, email: user.email, handle: user.handle });
  },
];
