import { useMemo, useState } from 'react';

const factorial = (n: number) => {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
};

const CURVES: { key: string; f: (n: number) => number; color: string }[] = [
  { key: 'O(1)', f: () => 1, color: '#8b949e' },
  { key: 'O(log n)', f: (n) => Math.log2(n), color: '#38bdf8' },
  { key: 'O(n)', f: (n) => n, color: '#10b981' },
  { key: 'O(n log n)', f: (n) => n * Math.log2(n), color: '#fdc114' },
  { key: 'O(n²)', f: (n) => n * n, color: '#fb923c' },
  { key: 'O(2ⁿ)', f: (n) => Math.pow(2, n), color: '#f43f5e' },
  { key: 'O(n!)', f: (n) => factorial(n), color: '#a78bfa' },
];

const W = 560;
const H = 300;
const PAD = 34;

const fmt = (v: number) => (v >= 1e6 ? v.toExponential(1) : v >= 100 ? Math.round(v).toString() : v.toFixed(v < 10 ? 1 : 0));

export default function BigOChart() {
  const [maxN, setMaxN] = useState(20);
  const [on, setOn] = useState<Record<string, boolean>>({ 'O(log n)': true, 'O(n)': true, 'O(n log n)': true, 'O(n²)': true });

  const enabled = CURVES.filter((c) => on[c.key]);
  const { lines, yMax } = useMemo(() => {
    let yMax = 1;
    const lines = enabled.map((c) => {
      const pts: { n: number; y: number }[] = [];
      for (let n = 1; n <= maxN; n++) {
        const y = Math.log10(Math.max(c.f(n), 1));
        yMax = Math.max(yMax, y);
        pts.push({ n, y });
      }
      return { key: c.key, color: c.color, pts };
    });
    return { lines, yMax };
  }, [enabled, maxN]);

  const toPx = (n: number) => PAD + ((n - 1) / Math.max(maxN - 1, 1)) * (W - 2 * PAD);
  const toPy = (y: number) => H - PAD - (y / (yMax || 1)) * (H - 2 * PAD);

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {CURVES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setOn((o) => ({ ...o, [c.key]: !o[c.key] }))}
            className={`flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-xs transition ${on[c.key] ? 'border-edge text-fg' : 'border-edge text-muted/50'}`}
          >
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: on[c.key] ? c.color : 'transparent', border: `1px solid ${c.color}` }} />
            {c.key}
          </button>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '20rem' }} role="img" aria-label="growth rate comparison">
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} style={{ stroke: 'var(--border)' }} strokeWidth={1} />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} style={{ stroke: 'var(--border)' }} strokeWidth={1} />
        {lines.map((l) => (
          <polyline key={l.key} points={l.pts.map((p) => `${toPx(p.n).toFixed(1)},${toPy(p.y).toFixed(1)}`).join(' ')} fill="none" style={{ stroke: l.color }} strokeWidth={2.5} />
        ))}
      </svg>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          n = {maxN}
          <input type="range" min={5} max={40} value={maxN} onChange={(e) => setMaxN(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
        <span className="font-mono text-xs text-muted">y-axis: operations (log scale)</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-edge pt-3 font-mono text-xs">
        <span className="text-muted">at n = {maxN}:</span>
        {enabled.map((c) => (
          <span key={c.key} style={{ color: c.color }}>
            {c.key} ≈ {fmt(c.f(maxN))}
          </span>
        ))}
      </div>
    </div>
  );
}
