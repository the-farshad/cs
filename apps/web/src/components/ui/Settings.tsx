import { useEffect, useMemo, useState } from 'react';
import { getCompleted, PROGRESS_EVENT } from '@/lib/progress';

type TrackInfo = { slug: string; title: string; total: number };
type Props = {
  tracks: TrackInfo[];
  totalLessons: number;
  totalProblems: number;
};

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

export default function Settings({ tracks, totalLessons, totalProblems }: Props) {
  const [checked, setChecked] = useState(false);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  useEffect(() => {
    const refresh = () => setCompleted(getCompleted());
    refresh();
    setChecked(true);
    // Keep the dashboard live as lessons are completed (this tab or another).
    window.addEventListener(PROGRESS_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(PROGRESS_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const stats = useMemo(() => {
    let problemsSolved = 0;
    for (const id of completed) if (id.startsWith('problems/')) problemsSolved++;
    const per = tracks
      .map((t) => {
        let done = 0;
        for (const id of completed) if (id.startsWith(`${t.slug}/`)) done++;
        return { ...t, done: Math.min(done, t.total) };
      })
      .sort((a, b) => b.done / b.total - a.done / a.total || a.title.localeCompare(b.title));
    const totalDone = per.reduce((s, t) => s + t.done, 0);
    const pct = totalLessons > 0 ? Math.round((100 * totalDone) / totalLessons) : 0;
    return {
      per,
      totalDone,
      pct,
      started: per.filter((t) => t.done > 0).length,
      problemsSolved: Math.min(problemsSolved, totalProblems),
    };
  }, [completed, tracks, totalLessons, totalProblems]);

  if (!checked) return <p className="text-muted">Loading…</p>;

  return (
    <div className="space-y-6">
      {/* Progress dashboard */}
      <section className="rounded-xl border border-edge bg-surface p-5">
        <h2 className="font-display text-lg text-fg">Your progress</h2>
        <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row">
          <Ring pct={stats.pct} />
          <div className="grid w-full flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard value={`${stats.totalDone}/${totalLessons}`} label="lessons completed" />
            <StatCard value={`${stats.problemsSolved}/${totalProblems}`} label="problems solved" />
            <StatCard value={`${stats.started}/${tracks.length}`} label="tracks started" />
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

      <p className="text-center text-xs text-muted">Progress is saved in this browser only.</p>
    </div>
  );
}
