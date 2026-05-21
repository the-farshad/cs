/** Lesson progress, stored client-side in localStorage. When the user is signed
 *  in to the minerva backend it is also synced cross-device; logged-out behavior
 *  is unchanged (per-browser localStorage only). */
import { getProgress, isLoggedIn, pushProgress } from '@/lib/api';

const KEY = 'cs-progress';
export const PROGRESS_EVENT = 'cs-progress-change';

export function getCompleted(): Set<string> {
  if (typeof localStorage === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(KEY);
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/** Overwrite the local completed set (no event, no server push). Internal helper. */
function writeLocal(set: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

export function setComplete(id: string, done: boolean): Set<string> {
  const set = getCompleted();
  if (done) set.add(id);
  else set.delete(id);
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]));
    window.dispatchEvent(new CustomEvent(PROGRESS_EVENT));
  } catch {
    /* ignore */
  }
  // When signed in, mirror the full local set to the server (fire-and-forget;
  // failures are ignored so progress always works offline / when the API is down).
  if (isLoggedIn()) {
    void pushProgress([...set]);
  }
  return set;
}

/** Reconcile local and server progress for signed-in users.
 *  GETs server progress, unions it with local, writes the union locally, POSTs
 *  it back, and notifies listeners. No-op (and harmless) when logged out or on
 *  any network failure — local progress is never lost. */
export async function syncProgress(): Promise<void> {
  if (!isLoggedIn()) return;

  const local = getCompleted();
  const remote = await getProgress();
  // If the server is unreachable, keep local as-is and bail.
  if (remote === null) return;

  const union = new Set<string>([...local, ...remote]);
  writeLocal(union);

  // Persist the union; prefer the server's authoritative response if present.
  const saved = await pushProgress([...union]);
  if (saved) writeLocal(new Set<string>(saved));

  try {
    window.dispatchEvent(new CustomEvent(PROGRESS_EVENT));
  } catch {
    /* ignore */
  }
}
