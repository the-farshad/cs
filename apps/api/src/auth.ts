/** Auth primitives: magic-token lifecycle, JWT sign/verify, and Bearer middleware. */
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { pool } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required');
}
// Narrow to a definite string for the rest of the module.
const SECRET: string = JWT_SECRET;

/** Magic tokens are valid for 15 minutes. */
const MAGIC_TOKEN_TTL_MS = 15 * 60 * 1000;
/** JWTs last ~30 days. */
const JWT_EXPIRES_IN = '30d';

export type JwtPayload = {
  sub: string;
  email: string;
};

export type AuthedUser = {
  id: string;
  email: string;
};

/** Express requests gain an optional `user` once the auth middleware runs. */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

// ---------------------------------------------------------------------------
// Magic tokens
// ---------------------------------------------------------------------------

/**
 * Create and persist a single-use magic token for `email`, expiring in 15 min.
 * Returns the raw token to embed in the magic link.
 */
export async function createMagicToken(email: string): Promise<string> {
  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + MAGIC_TOKEN_TTL_MS);
  await pool.query(
    `insert into magic_tokens (token, email, expires_at) values ($1, $2, $3)`,
    [token, email, expiresAt],
  );
  return token;
}

/**
 * Validate a raw magic token (exists, unused, unexpired) and atomically mark it
 * used. Returns the associated email, or null if the token is invalid.
 *
 * The update is conditional and returns the row only when it actually flips
 * `used` from false to true, so concurrent verifies can't both succeed.
 */
export async function consumeMagicToken(token: string): Promise<string | null> {
  const { rows } = await pool.query<{ email: string }>(
    `update magic_tokens
        set used = true
      where token = $1
        and used = false
        and expires_at > now()
      returning email`,
    [token],
  );
  return rows[0]?.email ?? null;
}

// ---------------------------------------------------------------------------
// JWT
// ---------------------------------------------------------------------------

/** Sign a JWT for a user. Payload is `{ sub: userId, email }`. */
export function signJwt(userId: string, email: string): string {
  const payload: JwtPayload = { sub: userId, email };
  return jwt.sign(payload, SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/** Verify and decode a JWT. Returns the payload, or null if invalid/expired. */
export function verifyJwt(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, SECRET);
    if (
      typeof decoded === 'object' &&
      decoded !== null &&
      typeof decoded.sub === 'string' &&
      typeof (decoded as Record<string, unknown>).email === 'string'
    ) {
      return { sub: decoded.sub, email: (decoded as { email: string }).email };
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Require a valid `Authorization: Bearer <jwt>` header. On success attaches
 * `req.user`; otherwise responds 401 and does not call `next()`.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('authorization') ?? '';
  const match = /^Bearer (.+)$/i.exec(header.trim());
  if (!match) {
    res.status(401).json({ error: 'missing bearer token' });
    return;
  }
  const payload = verifyJwt(match[1] as string);
  if (!payload) {
    res.status(401).json({ error: 'invalid token' });
    return;
  }
  req.user = { id: payload.sub, email: payload.email };
  next();
}
