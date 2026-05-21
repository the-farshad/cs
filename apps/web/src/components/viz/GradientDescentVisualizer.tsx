import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// A double-well loss: two minima at x = ±√2, a flat critical point at x = 0.
const f = (x: number) => x ** 4 - 4 * x ** 2;
const df = (x: number) => 4 * x ** 3 - 8 * x;
const XMIN = -2.6;
const XMAX = 2.6;
const STEPS = 40;
const W = 560;
const H = 280;
const PAD = 30;

function trajectory(start: number, lr: number): number[] {
  const xs = [start];
  let x = start;
  for (let i = 0; i < STEPS; i++) {
    x = x - lr * df(x);
    if (!Number.isFinite(x) || Math.abs(x) > 6) {
      xs.push(Math.max(Math.min(x, 6), -6));
      break;
    }
    xs.push(x);
  }
  return xs;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function GradientDescentVisualizer() {
  const [start, setStart] = useState(2.2);
  const [lr, setLr] = useState(0.03);

  const xs = useMemo(() => trajectory(start, lr), [start, lr]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(xs.length, 6);
  const i = Math.min(index, xs.length - 1);
  const cur = xs[i];

  const samples = useMemo(() => {
    const arr: { x: number; y: number }[] = [];
    for (let k = 0; k <= 120; k++) {
      const x = XMIN + ((XMAX - XMIN) * k) / 120;
      arr.push({ x, y: f(x) });
    }
    return arr;
  }, []);
  const ys = samples.map((s) => s.y);
  const FMIN = Math.min(...ys);
  const FMAX = Math.max(...ys);
  const toPx = (x: number) => PAD + ((x - XMIN) / (XMAX - XMIN)) * (W - 2 * PAD);
  const toPy = (y: number) => PAD + ((FMAX - y) / (FMAX - FMIN)) * (H - 2 * PAD);

  const curvePts = samples.map((s) => `${toPx(s.x).toFixed(1)},${toPy(s.y).toFixed(1)}`).join(' ');
  const visited = xs.slice(0, i + 1);
  const trailPts = visited.map((x) => `${toPx(x).toFixed(1)},${toPy(f(x)).toFixed(1)}`).join(' ');
  const diverged = Math.abs(cur) > 5;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-muted">
          Start x = {start.toFixed(1)}
          <input type="range" min={-2.5} max={2.5} step={0.1} value={start} onChange={(e) => setStart(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          Learning rate = {lr.toFixed(3)}
          <input type="range" min={0.005} max={0.14} step={0.005} value={lr} onChange={(e) => setLr(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '22rem' }} role="img" aria-label="gradient descent on a loss curve">
        {/* zero line */}
        <line x1={toPx(XMIN)} y1={toPy(0)} x2={toPx(XMAX)} y2={toPy(0)} style={{ stroke: 'var(--border)' }} strokeDasharray="4 4" strokeWidth={1} />
        {/* loss curve */}
        <polyline points={curvePts} fill="none" style={{ stroke: 'var(--muted)' }} strokeWidth={2} />
        {/* descent trail */}
        <polyline points={trailPts} fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth={1.5} opacity={0.5} />
        {visited.map((x, k) => (
          <circle key={k} cx={toPx(x)} cy={toPy(f(x))} r={2.5} style={{ fill: 'var(--accent)' }} opacity={0.5} />
        ))}
        {/* current point */}
        <circle cx={toPx(cur)} cy={toPy(f(cur))} r={7} style={{ fill: 'var(--accent)', stroke: 'var(--bg)' }} strokeWidth={2} />
      </svg>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={prev} disabled={index <= 0}>
          <Icon name="chevron-left" size={16} /> Step
        </button>
        <button
          type="button"
          onClick={() => (playing ? pause() : play())}
          className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90"
        >
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Descend'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= xs.length - 1}>
          Step <Icon name="chevron-right" size={16} />
        </button>
        <button type="button" className={btn} onClick={reset} disabled={index === 0}>
          <Icon name="rotate-ccw" size={16} /> Reset
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={1} max={20} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input type="range" min={0} max={Math.max(xs.length - 1, 0)} value={index} onChange={(e) => seek(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Timeline" />
        <span className="shrink-0 font-mono text-xs text-muted">
          step {i}/{xs.length - 1}
        </span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">
        x = {cur.toFixed(3)} · loss = {f(cur).toFixed(3)} · gradient = {df(cur).toFixed(3)}
        {diverged ? ' · diverged — lower the learning rate' : ''}
      </div>
    </div>
  );
}
