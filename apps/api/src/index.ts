/** Express app entry point: CORS, routes, startup migration, listen. */
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { migrate, pool } from './db.js';
import { authRouter, deleteMeHandlers, meHandlers, updateMeHandlers } from './routes/auth.js';
import { oauthRouter } from './routes/oauth.js';
import { progressRouter } from './routes/progress.js';

const PORT = Number(process.env.PORT ?? 8080);
const APP_ORIGIN = process.env.APP_ORIGIN ?? 'https://cs.thefarshad.com';

// Allowed CORS origins: the configured app origin plus local dev.
const ALLOWED_ORIGINS = new Set([APP_ORIGIN, 'http://localhost:4321']);

const app = express();
app.disable('x-powered-by');
app.use(express.json());

// --- CORS ---
// Reflect allowed origins only; permit the Authorization header and the verbs
// this API actually uses.
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.header('origin');
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// --- Routes ---
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// /auth/request and /auth/verify live under /auth.
app.use('/auth', authRouter);
// /auth/google, /auth/github and their callbacks (OAuth sign-in).
app.use('/auth', oauthRouter);
// /me lives at the root per the API contract (Bearer JWT).
app.get('/me', ...meHandlers);
app.patch('/me', ...updateMeHandlers);
app.delete('/me', ...deleteMeHandlers);
// /progress (GET + POST) lives at the root.
app.use('/progress', progressRouter);

// --- Error handler ---
// Keeps the process alive and returns JSON for unexpected failures.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[error]', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'internal server error' });
});

async function main(): Promise<void> {
  await migrate();
  app.listen(PORT, () => {
    console.log(`[api] listening on :${PORT} (origin: ${APP_ORIGIN})`);
  });
}

main().catch(async (err) => {
  console.error('[fatal] startup failed:', err);
  await pool.end().catch(() => {});
  process.exit(1);
});
