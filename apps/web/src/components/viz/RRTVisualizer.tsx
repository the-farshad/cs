import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// --- Geometry: a 100x70 planning area (C-space), rendered into an SVG viewBox.
const W = 100;
const H = 70;
const START = { x: 8, y: 60 };
const GOAL = { x: 90, y: 10 };
const GOAL_RADIUS = 6; // tree reaches the goal once a node lands within this.
const STEP = 5; // how far we extend toward each sample.
const MAX_NODES = 220; // safety cap on tree size.

type Pt = { x: number; y: number };
type Rect = { x: number; y: number; w: number; h: number };

// Two rectangular obstacles the tree must route around.
const OBSTACLES: Rect[] = [
  { x: 30, y: 0, w: 14, h: 44 },
  { x: 58, y: 28, w: 14, h: 42 },
];

// Deterministic PRNG (mulberry32) so the same seed always grows the same tree.
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pointInRect(p: Pt, r: Rect, pad = 1.5): boolean {
  return p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;
}

// Sample a few points along a→b; reject the motion if any lands in an obstacle.
function segmentClear(a: Pt, b: Pt): boolean {
  const samples = 6;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    for (const o of OBSTACLES) if (pointInRect(p, o)) return false;
  }
  return true;
}

// One recorded step of growth, enough to redraw the whole scene at that point.
type Frame = {
  nodes: { x: number; y: number; parent: number }[];
  sample: Pt | null; // the random point picked this step
  nearest: number | null; // index of the node we steered from
  added: number | null; // index of the new node, if the motion was collision-free
  rejected: boolean; // motion hit an obstacle and was skipped
  reachedAt: number | null; // index of the node that first reached the goal
};

function buildFrames(seed: number): Frame[] {
  const rng = makeRng(seed);
  const nodes: { x: number; y: number; parent: number }[] = [{ x: START.x, y: START.y, parent: -1 }];
  const frames: Frame[] = [];
  let reachedAt: number | null = null;

  while (nodes.length < MAX_NODES && reachedAt === null) {
    // Goal bias: occasionally aim straight at the goal to speed convergence.
    const goalBias = rng() < 0.1;
    const sample: Pt = goalBias ? { x: GOAL.x, y: GOAL.y } : { x: rng() * W, y: rng() * H };

    // Nearest existing node to the sample.
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const dx = nodes[i].x - sample.x;
      const dy = nodes[i].y - sample.y;
      const d = dx * dx + dy * dy;
      if (d < best) {
        best = d;
        nearest = i;
      }
    }

    // Steer one STEP from the nearest node toward the sample.
    const from = nodes[nearest];
    const dist = Math.hypot(sample.x - from.x, sample.y - from.y) || 1;
    const newPt: Pt = {
      x: from.x + ((sample.x - from.x) / dist) * Math.min(STEP, dist),
      y: from.y + ((sample.y - from.y) / dist) * Math.min(STEP, dist),
    };

    const inObstacle = OBSTACLES.some((o) => pointInRect(newPt, o));
    const clear = !inObstacle && segmentClear(from, newPt);

    if (clear) {
      nodes.push({ x: newPt.x, y: newPt.y, parent: nearest });
      const added = nodes.length - 1;
      if (Math.hypot(newPt.x - GOAL.x, newPt.y - GOAL.y) <= GOAL_RADIUS) reachedAt = added;
      frames.push({ nodes: nodes.map((n) => ({ ...n })), sample, nearest, added, rejected: false, reachedAt });
    } else {
      frames.push({ nodes: nodes.map((n) => ({ ...n })), sample, nearest, added: null, rejected: true, reachedAt });
    }
  }

  // Ensure at least one frame even in degenerate cases.
  if (frames.length === 0) {
    frames.push({ nodes: nodes.map((n) => ({ ...n })), sample: null, nearest: null, added: null, rejected: false, reachedAt: null });
  }
  return frames;
}

// Walk parent pointers from the goal-reaching node back to the root.
function pathFrom(nodes: { x: number; y: number; parent: number }[], leaf: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  let i = leaf;
  let guard = 0;
  while (i >= 0 && guard++ < MAX_NODES + 1) {
    out.push({ x: nodes[i].x, y: nodes[i].y });
    i = nodes[i].parent;
  }
  return out.reverse();
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const SEEDS = [7, 21, 42, 88, 137];

export default function RRTVisualizer() {
  const [seedIdx, setSeedIdx] = useState(0);
  const frames = useMemo(() => buildFrames(SEEDS[seedIdx]), [seedIdx]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 18);
  const frame = frames[Math.min(index, frames.length - 1)];

  const reached = frame.reachedAt !== null;
  const path = reached ? pathFrom(frame.nodes, frame.reachedAt as number) : null;
  const pathPoints = path ? path.map((p) => `${p.x},${p.y}`).join(' ') : '';

  const sx = (x: number) => x;
  const sy = (y: number) => y;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '24rem' }} role="img" aria-label="RRT growing a tree from start to goal around obstacles">
        {/* play area */}
        <rect x={0} y={0} width={W} height={H} fill="var(--bg)" stroke="var(--border)" strokeWidth={0.4} />

        {/* obstacles */}
        {OBSTACLES.map((o, i) => (
          <rect key={i} x={o.x} y={o.y} width={o.w} height={o.h} fill="color-mix(in oklab, #f43f5e 22%, var(--surface))" stroke="#f43f5e" strokeWidth={0.4} rx={1} />
        ))}

        {/* tree edges */}
        {frame.nodes.map((n, i) =>
          n.parent >= 0 ? (
            <line key={`e${i}`} x1={sx(frame.nodes[n.parent].x)} y1={sy(frame.nodes[n.parent].y)} x2={sx(n.x)} y2={sy(n.y)} stroke="var(--muted)" strokeWidth={0.35} opacity={0.8} />
          ) : null,
        )}

        {/* tree nodes */}
        {frame.nodes.map((n, i) => (
          <circle key={`n${i}`} cx={sx(n.x)} cy={sy(n.y)} r={0.7} fill="var(--muted)" />
        ))}

        {/* this step: sample point + steer indicator */}
        {frame.sample && (
          <>
            {frame.nearest !== null && (
              <line
                x1={sx(frame.nodes[frame.nearest].x)}
                y1={sy(frame.nodes[frame.nearest].y)}
                x2={sx(frame.sample.x)}
                y2={sy(frame.sample.y)}
                stroke={frame.rejected ? '#f43f5e' : '#38bdf8'}
                strokeWidth={0.35}
                strokeDasharray="1.4 1.2"
                opacity={0.85}
              />
            )}
            <circle cx={sx(frame.sample.x)} cy={sy(frame.sample.y)} r={1.3} fill="none" stroke={frame.rejected ? '#f43f5e' : '#38bdf8'} strokeWidth={0.5} />
          </>
        )}

        {/* newly added node, emphasised */}
        {frame.added !== null && <circle cx={sx(frame.nodes[frame.added].x)} cy={sy(frame.nodes[frame.added].y)} r={1.4} fill="#38bdf8" />}

        {/* found path */}
        {pathPoints && <polyline points={pathPoints} fill="none" stroke="var(--accent)" strokeWidth={1.1} strokeLinejoin="round" strokeLinecap="round" />}

        {/* goal region */}
        <circle cx={sx(GOAL.x)} cy={sy(GOAL.y)} r={GOAL_RADIUS} fill="color-mix(in oklab, #10b981 18%, transparent)" stroke="#10b981" strokeWidth={0.4} strokeDasharray="1.5 1.2" />
        <circle cx={sx(GOAL.x)} cy={sy(GOAL.y)} r={1.6} fill="#10b981" />

        {/* start */}
        <circle cx={sx(START.x)} cy={sy(START.y)} r={1.8} fill="var(--accent)" stroke="var(--bg)" strokeWidth={0.5} />
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
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Grow tree'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= frames.length - 1}>
          Step <Icon name="chevron-right" size={16} />
        </button>
        <button type="button" className={btn} onClick={() => setSeedIdx((i) => (i + 1) % SEEDS.length)}>
          <Icon name="shuffle" size={15} /> New samples
        </button>
        <button type="button" className={btn} onClick={reset} disabled={index === 0}>
          <Icon name="rotate-ccw" size={15} /> Reset
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={1} max={60} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input type="range" min={0} max={Math.max(frames.length - 1, 0)} value={index} onChange={(e) => seek(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Timeline" />
        <span className="shrink-0 font-mono text-xs text-muted">
          step {Math.min(index + 1, frames.length)}/{frames.length}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-edge pt-4 text-xs text-muted">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: 'var(--accent)' }} /> start</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#10b981' }} /> goal</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#38bdf8' }} /> sample / new node</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: '#f43f5e' }} /> obstacle (rejected)</span>
        </div>
        <div className="font-mono">
          nodes {frame.nodes.length}
          {reached ? ` · reached goal · path ${path ? path.length : 0} nodes` : ' · searching…'}
        </div>
      </div>

      <p className="mt-3 text-sm text-muted">
        Each step samples a random point (blue ring), finds the nearest tree node, and steers one increment toward it. A red dashed line means the motion crossed an obstacle and was skipped. The tree fills free space until a node lands inside the goal region, then the route back to the start is highlighted.
      </p>
    </div>
  );
}
