import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { clearToken, deleteMe, getMe, getToken, updateMe, type User } from '@/lib/api';
import { getCompleted } from '@/lib/progress';

type Save = 'idle' | 'saving' | 'saved' | 'error';
type TrackInfo = { slug: string; title: string; total: number };

const HANDLE_RE = /^[A-Za-z0-9_-]{3,20}$/;

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-edge bg-bg/40 px-4 py-3">
      <div className="font-display text-2xl text-fg">{value}</div>
      <div className="mt-0.5 text-xs text-muted">{label}</div>
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  return (
    <svg width={132} height={132} viewBox="0 0 120 120" role="img" aria-label={`${pct}% complete`} className="shrink-0">
      <circle cx={60} cy={60} r={R} fill="none" stroke="var(--border)" strokeWidth={10} />
      <circle
        cx={60}
        cy={60}
        r={R}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * C} ${C}`}
        transform="rotate(-90 60 60)"
        style={{ transition: 'stroke-dasharray 600ms ease' }}
      />
      <text x={60} y={58} textAnchor="middle" style={{ fill: 'var(--fg)' }} fontSize={26} className="font-display">
        {pct}%
      </text>
      <text x={60} y={78} textAnchor="middle" style={{ fill: 'var(--muted)' }} fontSize={11}>
        complete
      </text>
    </svg>
  );
}

export default function Settings({ tracks, totalLessons }: { tracks: TrackInfo[]; totalLessons: number }) {
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);
  const [handle, setHandle] = useState('');
  const [save, setSave] = useState<Save>('idle');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    (async () => {
      if (getToken()) {
        const me = await getMe();
        if (active && me) {
          setUser(me);
          setHandle(me.handle);
        }
      }
      if (active) {
        setCompleted(getCompleted());
        setChecked(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const per = tracks
      .map((t) => {
        let done = 0;
        for (const id of completed) if (id.startsWith(`${t.slug}/`)) done++;
        return { ...t, done: Math.min(done, t.total) };
      })
      .sort((a, b) => b.done / b.total - a.done / a.total || a.title.localeCompare(b.title));
    const totalDone = per.reduce((s, t) => s + t.done, 0);
    const pct = totalLessons > 0 ? Math.round((100 * totalDone) / totalLessons) : 0;
    const started = per.filter((t) => t.done > 0).length;
    return { per, totalDone, pct, started };
  }, [completed, tracks, totalLessons]);

  if (!checked) return <p className="text-muted">Loading…</p>;

  if (!user) {
    return (
      <div className="rounded-xl border border-edge bg-surface p-6">
        <p className="text-fg">You're not signed in.</p>
        <a href="/" className="mt-3 inline-block text-accent underline underline-offset-2 hover:text-fg">
          Back home
        </a>
      </div>
    );
  }

  const valid = HANDLE_RE.test(handle);
  const dirty = handle !== user.handle;
  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';

  const onSave = async () => {
    if (!valid || !dirty) return;
    setSave('saving');
    const updated = await updateMe(handle);
    if (updated) {
      setUser(updated);
      setHandle(updated.handle);
      setSave('saved');
    } else {
      setSave('error');
    }
  };

  const onDelete = async () => {
    if (await deleteMe()) {
      clearToken();
      window.location.href = '/';
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress dashboard */}
      <section className="rounded-xl border border-edge bg-surface p-5">
        <h2 className="font-display text-lg text-fg">Your progress</h2>
        <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <Ring pct={stats.pct} />
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard value={`${stats.totalDone}/${totalLessons}`} label="lessons completed" />
            <StatCard value={`${stats.started}/${tracks.length}`} label="tracks started" />
            <StatCard value={memberSince} label="member since" />
          </div>
        </div>

        <h3 className="mt-6 mb-3 text-xs tracking-wide text-muted uppercase">By track</h3>
        <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {stats.per.map((t) => {
            const w = t.total > 0 ? (100 * t.done) / t.total : 0;
            const complete = t.done === t.total && t.total > 0;
            return (
              <a key={t.slug} href={`/learn/${t.slug}`} className="group flex items-center gap-3" title={`${t.title}: ${t.done}/${t.total}`}>
                <span className="w-32 shrink-0 truncate text-sm text-fg transition group-hover:text-accent">{t.title}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-bg">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${w}%`, background: complete ? '#10b981' : 'var(--accent)', transition: 'width 500ms ease' }}
                  />
                </span>
                <span className="w-12 shrink-0 text-right font-mono text-xs text-muted">
                  {t.done}/{t.total}
                </span>
              </a>
            );
          })}
        </div>
      </section>

      {/* Account */}
      <section className="rounded-xl border border-edge bg-surface p-5">
        <h2 className="font-display text-lg text-fg">Account</h2>
        <div className="mt-3 flex items-center justify-between gap-4 text-sm">
          <span className="text-muted">Email</span>
          <span className="text-fg">{user.email}</span>
        </div>
      </section>

      {/* Username */}
      <section className="rounded-xl border border-edge bg-surface p-5">
        <h2 className="font-display text-lg text-fg">Username</h2>
        <p className="mt-1 text-sm text-muted">
          Your public handle — 3–20 characters: letters, numbers, <code>_</code> or <code>-</code>.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-muted">@</span>
          <input
            value={handle}
            onChange={(e) => {
              setHandle(e.target.value);
              setSave('idle');
            }}
            maxLength={20}
            aria-label="Username"
            className="w-48 rounded border border-edge bg-bg px-2 py-1 text-fg outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={onSave}
            disabled={!valid || !dirty || save === 'saving'}
            className="rounded border border-accent bg-accent px-3 py-1 text-sm text-accent-fg transition hover:opacity-90 disabled:opacity-40"
          >
            {save === 'saving' ? 'Saving…' : 'Save'}
          </button>
          {save === 'saved' && <span className="text-sm text-emerald-400">Saved</span>}
          {save === 'error' && <span className="text-sm text-rose-400">Couldn't save</span>}
          {!valid && handle.length > 0 && save !== 'error' && <span className="text-sm text-rose-400">3–20 chars: a–z, 0–9, _ -</span>}
        </div>
      </section>

      {/* Session */}
      <section className="rounded-xl border border-edge bg-surface p-5">
        <h2 className="font-display text-lg text-fg">Session</h2>
        <div className="mt-3">
          <button
            type="button"
            onClick={() => {
              clearToken();
              window.location.href = '/';
            }}
            className="inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent"
          >
            <Icon name="log-out" size={14} /> Sign out
          </button>
        </div>
        <div className="mt-5 border-t border-edge pt-4">
          {!confirmDelete ? (
            <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm text-rose-400 transition hover:text-rose-300">
              Delete account
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-fg">Delete your account and synced progress? This can't be undone.</span>
              <button type="button" onClick={onDelete} className="rounded border border-rose-500 px-3 py-1 text-sm text-rose-300 transition hover:bg-rose-500/10">
                Yes, delete
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="rounded border border-edge px-3 py-1 text-sm text-muted transition hover:text-fg">
                Cancel
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
