import { useMemo, useState } from 'react';

type FnKey = 'line' | 'parabola' | 'cubic' | 'exp' | 'log' | 'sqrt' | 'sin';

const FUNCS: Record<FnKey, { label: string; f: (x: number, a: number, b: number, c: number) => number; uses: string[] }> = {
  line: { label: 'Line:  a·x + b', f: (x, a, b) => a * x + b, uses: ['a', 'b'] },
  parabola: { label: 'Parabola:  a·x² + b·x + c', f: (x, a, b, c) => a * x * x + b * x + c, uses: ['a', 'b', 'c'] },
  cubic: { label: 'Cubic:  a·x³ + b·x', f: (x, a, b) => a * x * x * x + b * x, uses: ['a', 'b'] },
  exp: { label: 'Exponential:  2ˣ', f: (x) => Math.pow(2, x), uses: [] },
  log: { label: 'Logarithm:  log₂ x', f: (x) => (x > 0 ? Math.log2(x) : NaN), uses: [] },
  sqrt: { label: 'Square root:  √x', f: (x) => (x >= 0 ? Math.sqrt(x) : NaN), uses: [] },
  sin: { label: 'Sine:  sin x', f: (x) => Math.sin(x), uses: [] },
};

const W = 560;
const H = 320;
const PAD = 26;
const XMIN = -8;
const XMAX = 8;

export default function FunctionPlotter() {
  const [key, setKey] = useState<FnKey>('parabola');
  const [a, setA] = useState(1);
  const [b, setB] = useState(0);
  const [c, setC] = useState(0);

  const { segments, yMin, yMax, toPx, toPy } = useMemo(() => {
    const fn = FUNCS[key].f;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= 240; i++) {
      const x = XMIN + ((XMAX - XMIN) * i) / 240;
      pts.push({ x, y: fn(x, a, b, c) });
    }
    const finite = pts.map((p) => p.y).filter((y) => Number.isFinite(y));
    let yMax = Math.min(Math.max(...finite, 1), 50);
    let yMin = Math.max(Math.min(...finite, -1), -50);
    const padY = (yMax - yMin) * 0.1 || 1;
    yMax += padY;
    yMin -= padY;
    const toPx = (x: number) => PAD + ((x - XMIN) / (XMAX - XMIN)) * (W - 2 * PAD);
    const toPy = (y: number) => PAD + ((yMax - y) / (yMax - yMin)) * (H - 2 * PAD);
    // split into segments at non-finite / out-of-range points
    const segments: string[][] = [];
    let cur: string[] = [];
    for (const p of pts) {
      if (Number.isFinite(p.y) && p.y <= yMax + 1 && p.y >= yMin - 1) {
        cur.push(`${toPx(p.x).toFixed(1)},${toPy(p.y).toFixed(1)}`);
      } else if (cur.length) {
        segments.push(cur);
        cur = [];
      }
    }
    if (cur.length) segments.push(cur);
    return { segments, yMin, yMax, toPx, toPy };
  }, [key, a, b, c]);

  const uses = FUNCS[key].uses;
  const sliders: [string, number, (n: number) => void][] = [
    ['a', a, setA],
    ['b', b, setB],
    ['c', c, setC],
  ];

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <select value={key} onChange={(e) => setKey(e.target.value as FnKey)} className="rounded border border-edge bg-bg px-2 py-1 text-fg">
          {(Object.keys(FUNCS) as FnKey[]).map((k) => (
            <option key={k} value={k}>
              {FUNCS[k].label}
            </option>
          ))}
        </select>
        {sliders
          .filter(([name]) => uses.includes(name))
          .map(([name, val, set]) => (
            <label key={name} className="flex items-center gap-2 text-sm text-muted">
              {name} = {val.toFixed(1)}
              <input type="range" min={-4} max={4} step={0.1} value={val} onChange={(e) => set(Number(e.target.value))} className="accent-[var(--accent)]" />
            </label>
          ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '22rem' }} role="img" aria-label="function graph">
        {Number.isFinite(toPy(0)) && toPy(0) >= PAD && toPy(0) <= H - PAD && (
          <line x1={PAD} y1={toPy(0)} x2={W - PAD} y2={toPy(0)} style={{ stroke: 'var(--border)' }} strokeWidth={1} />
        )}
        {toPx(0) >= PAD && toPx(0) <= W - PAD && <line x1={toPx(0)} y1={PAD} x2={toPx(0)} y2={H - PAD} style={{ stroke: 'var(--border)' }} strokeWidth={1} />}
        {segments.map((seg, i) => (
          <polyline key={i} points={seg.join(' ')} fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth={2.5} />
        ))}
      </svg>

      <div className="mt-2 font-mono text-xs text-muted">
        x ∈ [{XMIN}, {XMAX}] · y ∈ [{yMin.toFixed(1)}, {yMax.toFixed(1)}]
      </div>
    </div>
  );
}
