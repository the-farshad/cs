import { useMemo, useState } from 'react';

// Fixed scored examples: each has a model score (0..1) and a true label.
// Deterministic; chosen so the two classes overlap in the middle.
type Ex = { score: number; label: 0 | 1 };

const DATA: Ex[] = [
  { score: 0.05, label: 0 },
  { score: 0.12, label: 0 },
  { score: 0.2, label: 0 },
  { score: 0.28, label: 0 },
  { score: 0.34, label: 1 },
  { score: 0.41, label: 0 },
  { score: 0.46, label: 1 },
  { score: 0.52, label: 0 },
  { score: 0.58, label: 1 },
  { score: 0.63, label: 0 },
  { score: 0.69, label: 1 },
  { score: 0.74, label: 1 },
  { score: 0.81, label: 0 },
  { score: 0.87, label: 1 },
  { score: 0.93, label: 1 },
  { score: 0.98, label: 1 },
];

const POS = '#10b981'; // actual positive (emerald)
const NEG = '#38bdf8'; // actual negative (sky)

const W = 520;
const H = 110;
const PAD = 24;

export default function ThresholdExplorer() {
  const [t, setT] = useState(0.5);

  const m = useMemo(() => {
    let tp = 0;
    let fp = 0;
    let tn = 0;
    let fn = 0;
    for (const d of DATA) {
      const pred = d.score >= t ? 1 : 0;
      if (pred === 1 && d.label === 1) tp++;
      else if (pred === 1 && d.label === 0) fp++;
      else if (pred === 0 && d.label === 0) tn++;
      else fn++;
    }
    const acc = (tp + tn) / DATA.length;
    const precision = tp + fp === 0 ? null : tp / (tp + fp);
    const recall = tp + fn === 0 ? null : tp / (tp + fn);
    return { tp, fp, tn, fn, acc, precision, recall };
  }, [t]);

  const toPx = (s: number) => PAD + s * (W - 2 * PAD);
  const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(0)}%`);

  const cell = 'rounded border p-3 text-center';

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      {/* score number line */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="example scores along a threshold line">
        <line x1={PAD} y1={H - 34} x2={W - PAD} y2={H - 34} style={{ stroke: 'var(--border)' }} strokeWidth={1} />
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <g key={tick}>
            <line x1={toPx(tick)} y1={H - 38} x2={toPx(tick)} y2={H - 30} style={{ stroke: 'var(--muted)' }} strokeWidth={1} />
            <text x={toPx(tick)} y={H - 16} textAnchor="middle" style={{ fontSize: 11, fontFamily: 'monospace', fill: 'var(--muted)' }}>
              {tick}
            </text>
          </g>
        ))}
        {/* threshold marker */}
        <line x1={toPx(t)} y1={14} x2={toPx(t)} y2={H - 28} style={{ stroke: 'var(--accent)' }} strokeWidth={2} />
        <text x={toPx(t)} y={10} textAnchor="middle" style={{ fontSize: 11, fontFamily: 'monospace', fill: 'var(--accent)' }}>
          t = {t.toFixed(2)}
        </text>
        {/* example dots: above line = actual positive, below = actual negative */}
        {DATA.map((d, i) => {
          const correct = (d.score >= t ? 1 : 0) === d.label;
          return (
            <circle
              key={i}
              cx={toPx(d.score)}
              cy={d.label === 1 ? H - 48 : H - 20}
              r={6}
              fill={d.label === 1 ? POS : NEG}
              stroke={correct ? 'var(--bg)' : 'var(--fg)'}
              strokeWidth={correct ? 1.5 : 2.5}
              opacity={correct ? 0.9 : 1}
            />
          );
        })}
      </svg>

      <label className="mt-2 flex items-center gap-3 text-sm text-muted">
        decision threshold
        <input type="range" min={0} max={1} step={0.01} value={t} onChange={(e) => setT(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
        <span className="shrink-0 font-mono text-xs">{t.toFixed(2)}</span>
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: POS }} /> actual positive (above line)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: NEG }} /> actual negative (below line)
        </span>
      </div>

      {/* confusion matrix */}
      <div className="mt-4 grid grid-cols-2 gap-2" style={{ maxWidth: '24rem' }}>
        <div className={cell} style={{ borderColor: POS, color: 'var(--fg)' }}>
          <div className="text-2xl font-semibold">{m.tp}</div>
          <div className="text-xs text-muted">True Positive</div>
        </div>
        <div className={cell} style={{ borderColor: '#f43f5e', color: 'var(--fg)' }}>
          <div className="text-2xl font-semibold">{m.fp}</div>
          <div className="text-xs text-muted">False Positive</div>
        </div>
        <div className={cell} style={{ borderColor: '#f43f5e', color: 'var(--fg)' }}>
          <div className="text-2xl font-semibold">{m.fn}</div>
          <div className="text-xs text-muted">False Negative</div>
        </div>
        <div className={cell} style={{ borderColor: NEG, color: 'var(--fg)' }}>
          <div className="text-2xl font-semibold">{m.tn}</div>
          <div className="text-xs text-muted">True Negative</div>
        </div>
      </div>

      {/* metrics */}
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-edge pt-4 text-center" style={{ maxWidth: '24rem' }}>
        <div>
          <div className="text-lg font-semibold text-fg">{pct(m.acc)}</div>
          <div className="text-xs text-muted">accuracy</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-fg">{pct(m.precision)}</div>
          <div className="text-xs text-muted">precision</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-fg">{pct(m.recall)}</div>
          <div className="text-xs text-muted">recall</div>
        </div>
      </div>

      <div className="mt-3 font-mono text-xs text-muted">
        Lower the threshold → catches more positives (recall up) but more false alarms (precision down).
      </div>
    </div>
  );
}
