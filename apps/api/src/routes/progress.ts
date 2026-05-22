/** Progress routes: read and merge the user's completed lesson/problem refs. */
import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { pool } from '../db.js';

export const progressRouter = Router();

/** Read all completed ref ids for a user, sorted for stable output. */
async function listCompleted(userId: string): Promise<string[]> {
  const { rows } = await pool.query<{ ref_id: string }>(
    `select ref_id from progress where user_id = $1 order by ref_id`,
    [userId],
  );
  return rows.map((r) => r.ref_id);
}

/** Coerce a request body's `completed` field to a clean string[]. */
function parseCompleted(body: unknown): string[] | null {
  const raw = (body as { completed?: unknown } | undefined)?.completed;
  if (!Array.isArray(raw)) return null;
  const ids = raw.filter((v): v is string => typeof v === 'string' && v.length > 0);
  // De-dupe while preserving order.
  return [...new Set(ids)];
}

/**
 * GET /progress  (Bearer)
 * Returns { completed: string[] }.
 */
progressRouter.get('/', requireAuth, async (req, res) => {
  const completed = await listCompleted(req.user!.id);
  res.json({ completed });
});

/**
 * GET /progress/recent  (Bearer)
 * Returns the most recently completed refs with timestamps (newest first) plus
 * the last-active time: { items: [{ ref, completedAt }], lastActive }.
 */
progressRouter.get('/recent', requireAuth, async (req, res) => {
  const { rows } = await pool.query<{ ref_id: string; completed_at: Date }>(
    `select ref_id, completed_at from progress where user_id = $1 order by completed_at desc limit 12`,
    [req.user!.id],
  );
  const items = rows.map((r) => ({ ref: r.ref_id, completedAt: r.completed_at }));
  res.json({ items, lastActive: items[0]?.completedAt ?? null });
});

/**
 * POST /progress  (Bearer)
 * Body: { completed: string[] }
 * Stores the UNION of existing + provided ids, returns the full union.
 */
progressRouter.post('/', requireAuth, async (req, res) => {
  const incoming = parseCompleted(req.body);
  if (incoming === null) {
    res.status(400).json({ error: 'completed must be an array of strings' });
    return;
  }

  const userId = req.user!.id;

  if (incoming.length > 0) {
    // Bulk upsert; existing rows are left untouched (union semantics).
    const values = incoming.map((_, i) => `($1, $${i + 2})`).join(', ');
    await pool.query(
      `insert into progress (user_id, ref_id)
         values ${values}
       on conflict (user_id, ref_id) do nothing`,
      [userId, ...incoming],
    );
  }

  const completed = await listCompleted(userId);
  res.json({ completed });
});
