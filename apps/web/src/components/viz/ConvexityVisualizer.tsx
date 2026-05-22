import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

type Mode = 'convex' | 'nonconvex';

// Convex bowl: single global minimum at x = 0.
const convex = {
  f: (x: number) => 0.25 * x * x,
  df: (x: number) => 0.5 * x,
  label: 'Convex bowl',
};

// Non-convex wiggle: a parabola plus a sine ripple → several local minima.
const nonconvex = {
  f: (x: number) => 0.06 * x * x + Math.cos(1.5 * x) + 1,
  df: (x: number) => 0.12 * x - 1.5 * Math.sin(1.5 * x),
  label: 'Non-convex wiggle',
};

const MODES: Record<Mode, typeof convex> = { convex, nonconvex };

const XMIN = -7;
const XMAX = 7;
const STEPS = 50;
const W = 560;
const H = 300;
const PAD = 30;

// Four fixed starting points, plus a user-controlled one (in violet).
const SEEDS = [-6, -2.5, 2.5, 6];
const SEED_COLORS = ['#fbbf24', '#38bdf8', '#10b981', '#f43f5e']; // amber, sky, emerald, rose
const USER_COLOR = '#8b5cf6'; // violet

function trajectory(mode: Mode, start: number, lr: number): number[] {
  const { df } = MODES[mode];
  const xs = [start];
  let x = start;
  for (let i = 0; i < STEPS; i++) {
    x = x - lr * df(x);
    if (!Number.isFinite(x)) {
      xs.push(xs[xs.length - 1]);
      break;
    }
    x = Math.max(Math.min(x, XMAX + 1), XMIN - 1);
    xs.push(x);
  }
  return xs;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function ConvexityVisualizer() {
  const [mode, setMode] = useState<Mode>('nonconvex');
  const [lr, setLr] = useState(0.6);
  const [userStart, setUserStart] = useState(1.2);

  const fn = MODES[mode];

  const runs = useMemo(() => SEEDS.map((s) => trajectory(mode, s, lr)), [mode, lr]);
  const userRun = useMemo(() => trajectory(mode, userStart, lr), [mode, userStart, lr]);
  const frameCount = STEPS + 1;

  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frameCount, 8);
  const i = Math.min(index, frameCount - 1);

  const samples = useMemo(() => {
    const arr: { x: number; y: number }[] = [];
    for (let k = 0; k <= 160; k++) {
      const x = XMIN + ((XMAX - XMIN) * k) / 160;
      arr.push({ x, y: fn.f(x) });
    }
    return arr;
  }, [mode]);

  const ys = samples.map((s) => s.y);
  const FMIN = Math.min(...ys);
  const FMAX = Math.max(...ys);
  const span = FMAX - FMIN || 1;
  const toPx = (x: number) => PAD + ((x - XMIN) / (XMAX - XMIN)) * (W - 2 * PAD);
  const toPy = (y: number) => PAD + ((FMAX - y) / span) * (H - 2 * PAD);

  const curvePts = samples.map((s) => `${toPx(s.x).toFixed(1)},${toPy(s.y).toFixed(1)}`).join(' ');

  // The global minimum (for reference): convex at 0; non-convex found by scanning.
  const globalMin = useMemo(() => {
    let best = samples[0];
    for (const s of samples) if (s.y < best.y) best = s;
    return best;
  }, [samples]);

  // Where each run currently sits.
  const ballAt = (run: number[]) => {
    const idx = Math.min(i, run.length - 1);
    return run[idx];
  };

  // After settling, how many distinct minima did the fixed runs reach?
  const settledXs = runs.map((r) => r[r.length - 1]);
  const distinct = settledXs.reduce<number[]>((acc, x) => {
    if (!acc.some((a) => Math.abs(a - x) < 0.4)) acc.push(x);
    return acc;
  }, []);

  const allRuns = [...runs, userRun];
  const allColors = [...SEED_COLORS, USER_COLOR];

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded border border-edge">
          {(Object.keys(MODES) as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-3 py-1 text-sm transition ${mode === m ? 'bg-accent text-accent-fg' : 'text-fg hover:text-accent'}`}
            >
              {MODES[m].label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          Learning rate = {lr.toFixed(2)}
          <input type="range" min={0.05} max={1.6} step={0.05} value={lr} onChange={(e) => setLr(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted" style={{ color: USER_COLOR }}>
          Your start x = {userStart.toFixed(1)}
          <input type="range" min={XMIN} max={XMAX} step={0.1} value={userStart} onChange={(e) => setUserStart(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '22rem' }} role="img" aria-label="convex vs non-convex gradient descent">
        {/* global minimum marker */}
        <line x1={toPx(globalMin.x)} y1={PAD} x2={toPx(globalMin.x)} y2={H - PAD} style={{ stroke: 'var(--border)' }} strokeDasharray="4 4" strokeWidth={1} />
        <text x={toPx(globalMin.x)} y={PAD - 6} textAnchor="middle" fontSize="10" style={{ fill: 'var(--muted)' }}>
          global min
        </text>
        {/* the function curve */}
        <polyline points={curvePts} fill="none" style={{ stroke: 'var(--muted)' }} strokeWidth={2} />
        {/* descending balls + trails, one per start */}
        {allRuns.map((run, r) => {
          const visited = run.slice(0, Math.min(i, run.length - 1) + 1);
          const trail = visited.map((x) => `${toPx(x).toFixed(1)},${toPy(fn.f(x)).toFixed(1)}`).join(' ');
          const cur = ballAt(run);
          const isUser = r === allRuns.length - 1;
          return (
            <g key={r}>
              <polyline points={trail} fill="none" stroke={allColors[r]} strokeWidth={1.2} opacity={0.45} />
              {/* start marker */}
              <circle cx={toPx(run[0])} cy={toPy(fn.f(run[0]))} r={3} fill="none" stroke={allColors[r]} strokeWidth={1.5} opacity={0.7} />
              {/* current ball */}
              <circle cx={toPx(cur)} cy={toPy(fn.f(cur))} r={isUser ? 7 : 5.5} fill={allColors[r]} style={{ stroke: 'var(--bg)' }} strokeWidth={1.5} />
            </g>
          );
        })}
      </svg>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={prev} disabled={index <= 0}>
          <Icon name="chevron-left" size={16} /> Step
        </button>
        <button type="button" onClick={() => (playing ? pause() : play())} className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90">
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Descend'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= frameCount - 1}>
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
        <input type="range" min={0} max={frameCount - 1} value={index} onChange={(e) => seek(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Timeline" />
        <span className="shrink-0 font-mono text-xs text-muted">
          step {i}/{frameCount - 1}
        </span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">
        {mode === 'convex'
          ? 'Convex: every start slides into the one global minimum.'
          : `Non-convex: the ${SEEDS.length} fixed starts settle into ${distinct.length} different ${distinct.length === 1 ? 'minimum' : 'minima'} — where you land depends on where you began.`}
      </div>
    </div>
  );
}
