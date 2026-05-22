import { useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';

// Two-class training set in a 0..10 x 0..10 feature space. Tiny + deterministic.
type Point = { x: number; y: number; cls: 0 | 1 };

const TRAIN: Point[] = [
  { x: 1.5, y: 2.0, cls: 0 },
  { x: 2.4, y: 3.3, cls: 0 },
  { x: 1.0, y: 4.2, cls: 0 },
  { x: 3.1, y: 1.4, cls: 0 },
  { x: 2.8, y: 5.0, cls: 0 },
  { x: 3.9, y: 3.6, cls: 0 },
  { x: 1.8, y: 6.0, cls: 0 },
  { x: 4.6, y: 2.2, cls: 0 },
  { x: 8.4, y: 8.1, cls: 1 },
  { x: 7.2, y: 6.7, cls: 1 },
  { x: 9.0, y: 6.0, cls: 1 },
  { x: 6.6, y: 8.6, cls: 1 },
  { x: 8.0, y: 5.2, cls: 1 },
  { x: 6.0, y: 6.0, cls: 1 },
  { x: 9.2, y: 8.8, cls: 1 },
  { x: 5.6, y: 7.4, cls: 1 },
];

const DOM = 10; // feature range 0..10
const W = 460;
const H = 460;
const PAD = 32;

const COLORS = ['#38bdf8', '#f43f5e']; // class 0 sky, class 1 rose

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function KNNClassifier() {
  const [qx, setQx] = useState(5);
  const [qy, setQy] = useState(4.5);
  const [k, setK] = useState(3);

  const toPx = (x: number) => PAD + (x / DOM) * (W - 2 * PAD);
  const toPy = (y: number) => H - PAD - (y / DOM) * (H - 2 * PAD);

  const { ranked, vote, predicted } = useMemo(() => {
    const ranked = TRAIN.map((p, i) => ({
      ...p,
      i,
      d: Math.hypot(p.x - qx, p.y - qy),
    })).sort((a, b) => a.d - b.d);
    const nearest = ranked.slice(0, k);
    let c0 = 0;
    let c1 = 0;
    for (const n of nearest) n.cls === 0 ? c0++ : c1++;
    const predicted: 0 | 1 = c1 > c0 ? 1 : 0;
    return { ranked, vote: { c0, c1 }, predicted };
  }, [qx, qy, k]);

  const neighborIds = new Set(ranked.slice(0, k).map((n) => n.i));
  const kth = ranked[Math.min(k, ranked.length) - 1];

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-muted">
          query x = {qx.toFixed(1)}
          <input type="range" min={0} max={DOM} step={0.1} value={qx} onChange={(e) => setQx(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          query y = {qy.toFixed(1)}
          <input type="range" min={0} max={DOM} step={0.1} value={qy} onChange={(e) => setQy(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          k = {k}
          <input type="range" min={1} max={9} step={2} value={k} onChange={(e) => setK(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block w-full" style={{ maxWidth: '28rem' }} role="img" aria-label="k-nearest-neighbors scatter plot">
        {/* plot frame */}
        <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD} fill="none" style={{ stroke: 'var(--border)' }} strokeWidth={1} />

        {/* neighborhood circle (radius = distance to the kth neighbor) */}
        {kth && (
          <circle
            cx={toPx(qx)}
            cy={toPy(qy)}
            r={(kth.d / DOM) * (W - 2 * PAD)}
            fill="none"
            style={{ stroke: 'var(--muted)' }}
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.6}
          />
        )}

        {/* lines from query to its k neighbors */}
        {ranked.slice(0, k).map((n) => (
          <line key={`l${n.i}`} x1={toPx(qx)} y1={toPy(qy)} x2={toPx(n.x)} y2={toPy(n.y)} style={{ stroke: 'var(--accent)' }} strokeWidth={1.5} opacity={0.5} />
        ))}

        {/* training points */}
        {TRAIN.map((p, i) => {
          const isN = neighborIds.has(i);
          return (
            <circle
              key={i}
              cx={toPx(p.x)}
              cy={toPy(p.y)}
              r={isN ? 8 : 6}
              fill={COLORS[p.cls]}
              stroke={isN ? 'var(--fg)' : 'var(--bg)'}
              strokeWidth={isN ? 2.5 : 1.5}
              opacity={isN ? 1 : 0.6}
            />
          );
        })}

        {/* query point — diamond, colored by prediction */}
        <g transform={`translate(${toPx(qx)} ${toPy(qy)})`}>
          <rect x={-7} y={-7} width={14} height={14} transform="rotate(45)" fill={COLORS[predicted]} stroke="var(--fg)" strokeWidth={2} />
        </g>
      </svg>

      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-edge pt-4 text-sm">
        <span className="inline-flex items-center gap-1.5 text-muted">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: COLORS[0] }} /> class A
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: COLORS[1] }} /> class B
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted">
          <Icon name="target" size={14} /> query (diamond)
        </span>
      </div>

      <div className="mt-3 font-mono text-xs text-muted">
        votes among {k} nearest: A = {vote.c0} · B = {vote.c1} →{' '}
        <span className="text-accent">predicted class {predicted === 0 ? 'A' : 'B'}</span>
        {vote.c0 === vote.c1 ? ' (tie — try an odd k)' : ''}
      </div>
    </div>
  );
}
