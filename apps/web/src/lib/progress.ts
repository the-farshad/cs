/** Lesson progress, stored client-side in localStorage. The minerva backend
 *  (Phase 2) will sync this for signed-in users; until then it's per-browser. */
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
