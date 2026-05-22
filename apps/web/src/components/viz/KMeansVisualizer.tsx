import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// Tiny deterministic 2D cloud in a 0..10 x 0..10 space, three natural blobs.
type Pt = { x: number; y: number };

const POINTS: Pt[] = [
  // blob A (lower-left)
  { x: 1.6, y: 2.0 }, { x: 2.4, y: 1.4 }, { x: 1.2, y: 3.1 }, { x: 2.9, y: 2.6 },
  { x: 2.0, y: 3.4 }, { x: 3.3, y: 1.8 }, { x: 1.0, y: 1.6 },
  // blob B (upper-left)
  { x: 2.2, y: 7.8 }, { x: 1.4, y: 8.6 }, { x: 3.0, y: 8.1 }, { x: 2.6, y: 9.2 },
  { x: 1.8, y: 7.0 }, { x: 3.4, y: 8.8 },
  // blob C (right)
  { x: 7.6, y: 5.2 }, { x: 8.4, y: 6.1 }, { x: 7.0, y: 6.4 }, { x: 8.8, y: 4.8 },
  { x: 9.0, y: 6.0 }, { x: 7.8, y: 4.4 }, { x: 8.2, y: 5.6 }, { x: 6.8, y: 5.0 },
];

// Fixed initial centroid positions per k (deterministic, no randomness).
const INIT: Record<number, Pt[]> = {
  2: [{ x: 3, y: 8 }, { x: 6, y: 3 }],
  3: [{ x: 4, y: 1 }, { x: 5, y: 9 }, { x: 9, y: 7 }],
  4: [{ x: 1, y: 1 }, { x: 1, y: 9 }, { x: 9, y: 9 }, { x: 9, y: 1 }],
  5: [{ x: 1, y: 1 }, { x: 1, y: 9 }, { x: 9, y: 9 }, { x: 9, y: 1 }, { x: 5, y: 5 }],
};

const PALETTE = ['#38bdf8', '#f43f5e', '#10b981', '#fbbf24', '#8b5cf6'];
const DOM = 10;
const W = 420;
const H = 420;
const PAD = 26;

type Frame = {
  centroids: Pt[];
  assign: number[]; // index of nearest centroid per point
  phase: 'assign' | 'move';
  moved: number; // total centroid movement this step
};

// Run Lloyd's algorithm to convergence, snapshotting each assign + move phase.
function buildFrames(k: number): Frame[] {
  let centroids = INIT[k].map((c) => ({ ...c }));
  const frames: Frame[] = [];
  const assignTo = (cs: Pt[]) =>
    POINTS.map((p) => {
      let best = 0;
      let bd = Infinity;
      for (let j = 0; j < cs.length; j++) {
        const d = (p.x - cs[j].x) ** 2 + (p.y - cs[j].y) ** 2;
        if (d < bd) {
          bd = d;
          best = j;
        }
      }
      return best;
    });

  let assign = assignTo(centroids);
  frames.push({ centroids: centroids.map((c) => ({ ...c })), assign, phase: 'assign', moved: 0 });

  for (let iter = 0; iter < 12; iter++) {
    // move: each centroid -> mean of its members (empty clusters stay put)
    const next = centroids.map((c, j) => {
      const members = POINTS.filter((_, i) => assign[i] === j);
      if (!members.length) return { ...c };
      const mx = members.reduce((s, p) => s + p.x, 0) / members.length;
      const my = members.reduce((s, p) => s + p.y, 0) / members.length;
      return { x: mx, y: my };
    });
    const moved = next.reduce((s, c, j) => s + Math.hypot(c.x - centroids[j].x, c.y - centroids[j].y), 0);
    centroids = next;
    frames.push({ centroids: centroids.map((c) => ({ ...c })), assign, phase: 'move', moved });
    if (moved < 1e-6) break;

    // re-assign with the new centroids
    const nextAssign = assignTo(centroids);
    const changed = nextAssign.some((a, i) => a !== assign[i]);
    assign = nextAssign;
    frames.push({ centroids: centroids.map((c) => ({ ...c })), assign, phase: 'assign', moved: 0 });
    if (!changed) break;
  }
  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function KMeansVisualizer() {
  const [k, setK] = useState(3);
  const frames = useMemo(() => buildFrames(k), [k]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 3);
  const i = Math.min(index, frames.length - 1);
  const frame = frames[i];
  const converged = i === frames.length - 1;

  const toPx = (x: number) => PAD + (x / DOM) * (W - 2 * PAD);
  const toPy = (y: number) => H - PAD - (y / DOM) * (H - 2 * PAD);

  // Within-cluster sum of squared distances (the objective k-means minimizes).
  const inertia = POINTS.reduce((s, p, idx) => {
    const c = frame.centroids[frame.assign[idx]];
    return s + (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
  }, 0);

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-muted">
          clusters k = {k}
          <input type="range" min={2} max={5} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
        <span className="font-mono text-xs text-muted">
          phase:{' '}
          <span className="text-accent">{frame.phase === 'assign' ? 'assign points' : 'move centroids'}</span>
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block w-full" style={{ maxWidth: '26rem' }} role="img" aria-label="k-means clustering of a 2D scatter">
        <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD} fill="none" style={{ stroke: 'var(--border)' }} strokeWidth={1} />

        {/* assignment links to centroid (only during the assign phase) */}
        {frame.phase === 'assign' &&
          POINTS.map((p, idx) => {
            const c = frame.centroids[frame.assign[idx]];
            return (
              <line key={`a${idx}`} x1={toPx(p.x)} y1={toPy(p.y)} x2={toPx(c.x)} y2={toPy(c.y)} stroke={PALETTE[frame.assign[idx]]} strokeWidth={1} opacity={0.3} />
            );
          })}

        {/* data points colored by current cluster */}
        {POINTS.map((p, idx) => (
          <circle key={idx} cx={toPx(p.x)} cy={toPy(p.y)} r={5} fill={PALETTE[frame.assign[idx]]} stroke="var(--bg)" strokeWidth={1.5} opacity={0.85} />
        ))}

        {/* centroids — large X markers */}
        {frame.centroids.map((c, j) => (
          <g key={`c${j}`} transform={`translate(${toPx(c.x)} ${toPy(c.y)})`}>
            <circle r={10} fill="var(--bg)" stroke={PALETTE[j]} strokeWidth={2.5} />
            <line x1={-5} y1={-5} x2={5} y2={5} stroke={PALETTE[j]} strokeWidth={2.5} />
            <line x1={-5} y1={5} x2={5} y2={-5} stroke={PALETTE[j]} strokeWidth={2.5} />
          </g>
        ))}
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
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Run'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= frames.length - 1}>
          Step <Icon name="chevron-right" size={16} />
        </button>
        <button type="button" className={btn} onClick={reset} disabled={index === 0}>
          <Icon name="rotate-ccw" size={16} /> Reset
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={1} max={12} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input type="range" min={0} max={Math.max(frames.length - 1, 0)} value={index} onChange={(e) => seek(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Timeline" />
        <span className="shrink-0 font-mono text-xs text-muted">
          step {i}/{frames.length - 1}
        </span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">
        inertia (within-cluster SSE) = {inertia.toFixed(2)}
        {converged ? ' · converged — assignments stopped changing' : ''}
      </div>
    </div>
  );
}
