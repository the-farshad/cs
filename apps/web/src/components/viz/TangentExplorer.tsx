import { useMemo, useState } from 'react';

type FnKey = 'parabola' | 'cubic' | 'sin' | 'exp';

const FUNCS: Record<
  FnKey,
  { label: string; f: (x: number) => number; df: (x: number) => number; expr: string; dexpr: string }
> = {
  parabola: { label: 'f(x) = x²', f: (x) => x * x, df: (x) => 2 * x, expr: 'x²', dexpr: '2x' },
  cubic: {
    label: 'f(x) = x³ − 3x',
    f: (x) => x * x * x - 3 * x,
    df: (x) => 3 * x * x - 3,
    expr: 'x³ − 3x',
    dexpr: '3x² − 3',
  },
  sin: { label: 'f(x) = sin x', f: (x) => Math.sin(x), df: (x) => Math.cos(x), expr: 'sin x', dexpr: 'cos x' },
  exp: { label: 'f(x) = eˣ', f: (x) => Math.exp(x), df: (x) => Math.exp(x), expr: 'eˣ', dexpr: 'eˣ' },
};

const W = 560;
const H = 340;
const PAD = 30;
const XMIN = -4;
const XMAX = 4;

export default function TangentExplorer() {
  const [key, setKey] = useState<FnKey>('parabola');
  const [x0, setX0] = useState(1);

  const fn = FUNCS[key];

  const { points, yMin, yMax, toPx, toPy } = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= 240; i++) {
      const x = XMIN + ((XMAX - XMIN) * i) / 240;
      pts.push({ x, y: fn.f(x) });
    }
    const finite = pts.map((p) => p.y).filter((y) => Number.isFinite(y));
    let yMax = Math.min(Math.max(...finite, 1), 12);
    let yMin = Math.max(Math.min(...finite, -1), -12);
    const padY = (yMax - yMin) * 0.12 || 1;
    yMax += padY;
    yMin -= padY;
    const toPx = (x: number) => PAD + ((x - XMIN) / (XMAX - XMIN)) * (W - 2 * PAD);
    const toPy = (y: number) => PAD + ((yMax - y) / (yMax - yMin)) * (H - 2 * PAD);
    return { points: pts, yMin, yMax, toPx, toPy };
  }, [key]);

  // Build curve polyline, clipping segments that leave the view box.
  const segments: string[][] = [];
  let cur: string[] = [];
  for (const p of points) {
    if (Number.isFinite(p.y) && p.y <= yMax + 0.5 && p.y >= yMin - 0.5) {
      cur.push(`${toPx(p.x).toFixed(1)},${toPy(p.y).toFixed(1)}`);
    } else if (cur.length) {
      segments.push(cur);
      cur = [];
    }
  }
  if (cur.length) segments.push(cur);

  const y0 = fn.f(x0);
  const slope = fn.df(x0);

  // Tangent line: y = y0 + slope·(x − x0). Draw across the full x range.
  const tx1 = XMIN;
  const ty1 = y0 + slope * (tx1 - x0);
  const tx2 = XMAX;
  const ty2 = y0 + slope * (tx2 - x0);

  const onPt = Number.isFinite(y0) && y0 <= yMax && y0 >= yMin;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <select
          value={key}
          onChange={(e) => setKey(e.target.value as FnKey)}
          className="rounded border border-edge bg-bg px-2 py-1 text-fg"
        >
          {(Object.keys(FUNCS) as FnKey[]).map((k) => (
            <option key={k} value={k}>
              {FUNCS[k].label}
            </option>
          ))}
        </select>
        <label className="flex flex-1 items-center gap-2 text-sm text-muted">
          x = {x0.toFixed(2)}
          <input
            type="range"
            min={XMIN + 0.1}
            max={XMAX - 0.1}
            step={0.05}
            value={x0}
            onChange={(e) => setX0(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
        </label>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '22rem' }} role="img" aria-label="curve with tangent line">
        {/* axes */}
        {toPy(0) >= PAD && toPy(0) <= H - PAD && (
          <line x1={PAD} y1={toPy(0)} x2={W - PAD} y2={toPy(0)} style={{ stroke: 'var(--border)' }} strokeWidth={1} />
        )}
        {toPx(0) >= PAD && toPx(0) <= W - PAD && (
          <line x1={toPx(0)} y1={PAD} x2={toPx(0)} y2={H - PAD} style={{ stroke: 'var(--border)' }} strokeWidth={1} />
        )}
        {/* curve */}
        {segments.map((seg, i) => (
          <polyline key={i} points={seg.join(' ')} fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth={2.5} />
        ))}
        {/* tangent line */}
        {onPt && (
          <line
            x1={toPx(tx1)}
            y1={toPy(ty1)}
            x2={toPx(tx2)}
            y2={toPy(ty2)}
            style={{ stroke: '#fbbf24' }}
            strokeWidth={2}
            strokeDasharray="6 4"
          />
        )}
        {/* slope triangle (rise over run = 1) */}
        {onPt && x0 + 1 <= XMAX && (
          <g style={{ stroke: '#10b981' }} strokeWidth={1.5} fill="none">
            <line x1={toPx(x0)} y1={toPy(y0)} x2={toPx(x0 + 1)} y2={toPy(y0)} />
            <line x1={toPx(x0 + 1)} y1={toPy(y0)} x2={toPx(x0 + 1)} y2={toPy(y0 + slope)} />
          </g>
        )}
        {/* point of tangency */}
        {onPt && <circle cx={toPx(x0)} cy={toPy(y0)} r={6} style={{ fill: 'var(--accent)' }} />}
      </svg>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-edge pt-4 font-mono text-sm">
        <span className="text-muted">f(x) = {fn.expr}</span>
        <span className="text-accent">f({x0.toFixed(2)}) = {Number.isFinite(y0) ? y0.toFixed(2) : '—'}</span>
        <span style={{ color: '#fbbf24' }}>
          f′(x) = {fn.dexpr} → slope = {slope.toFixed(2)}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted">
        The dashed gold line is the tangent — the instantaneous slope at x. Where the curve is steep,
        f′(x) is large; at a flat peak or valley, the tangent is horizontal and f′(x) = 0.
      </p>
    </div>
  );
}
