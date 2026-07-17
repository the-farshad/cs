/** Lesson & problem progress, stored client-side in localStorage (per-browser).
 *  The site is fully static — there is no backend and no cross-device sync. */

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
  return set;
}
