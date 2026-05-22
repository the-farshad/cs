import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// SLAM sketch: a robot drives a loop through a room, firing a range sensor each
// pose. Hits mark cells occupied; the free space the beams pass through is carved
// out — together they fill an occupancy grid. Pose uncertainty (the growing
// ellipse) accumulates from odometry drift until a loop closure snaps it back.
// Every frame is precomputed so the stepper can scrub deterministically.

const GRID = 28; // GRID x GRID occupancy cells
const CELL = 13; // px per cell
const NUM_BEAMS = 24; // range readings per pose
const MAX_RANGE = 16; // sensor range in cell units

// Deterministic PRNG (mulberry32).
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
function gaussian(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

type Pt = { x: number; y: number };

// Ground-truth walls of the room: outer box plus an interior obstacle.
function isWall(x: number, y: number): boolean {
  if (x <= 1 || y <= 1 || x >= GRID - 2 || y >= GRID - 2) return true; // border
  if (x >= 12 && x <= 16 && y >= 11 && y <= 17) return true; // pillar
  return false;
}

// Robot's true path: a rounded rectangular loop through the free space.
function truePose(t: number): { p: Pt; heading: number } {
  const path: Pt[] = [
    { x: 6, y: 6 },
    { x: 21, y: 6 },
    { x: 21, y: 21 },
    { x: 6, y: 21 },
    { x: 6, y: 6 },
  ];
  const segs = path.length - 1;
  const u = (t % 1) * segs;
  const i = Math.min(Math.floor(u), segs - 1);
  const f = u - i;
  const a = path[i];
  const b = path[i + 1];
  const p = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  const heading = Math.atan2(b.y - a.y, b.x - a.x);
  return { p, heading };
}

// Cast one beam from p along angle; return the first wall cell hit (or max range).
function castBeam(p: Pt, angle: number): { hit: Pt; blocked: boolean } {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let r = 0.5; r <= MAX_RANGE; r += 0.5) {
    const x = p.x + dx * r;
    const y = p.y + dy * r;
    if (isWall(Math.round(x), Math.round(y))) return { hit: { x, y }, blocked: true };
  }
  return { hit: { x: p.x + dx * MAX_RANGE, y: p.y + dy * MAX_RANGE }, blocked: false };
}

type Frame = {
  t: number;
  truePos: Pt;
  estPos: Pt; // drifted (odometry) estimate
  uncertainty: number; // pose covariance radius (cells)
  log: Float32Array; // log-odds occupancy for the whole grid
  beams: { from: Pt; to: Pt; blocked: boolean }[];
  closed: boolean; // a loop closure just fired
};

const POSES = 64; // number of sensing poses around the loop

function simulate(seed: number, noiseScale: number): Frame[] {
  const rng = makeRng(seed);
  const log = new Float32Array(GRID * GRID); // 0 = unknown; + occupied, - free
  const idx = (x: number, y: number) => y * GRID + x;

  // Estimated pose drifts from truth via accumulated odometry error.
  let est = { x: 6, y: 6 };
  let drift = { x: 0, y: 0 };
  let uncertainty = 0.4;
  const frames: Frame[] = [];

  for (let s = 0; s < POSES; s++) {
    const t = s / (POSES - 1);
    const { p: truePos, heading } = truePose(t);

    // Accumulate odometry drift; uncertainty grows with distance travelled.
    drift = {
      x: drift.x + gaussian(rng) * 0.05 * noiseScale,
      y: drift.y + gaussian(rng) * 0.05 * noiseScale,
    };
    est = { x: truePos.x + drift.x, y: truePos.y + drift.y };
    uncertainty += 0.06 * noiseScale;

    // Loop closure: near the end, recognise the start and snap drift away.
    let closed = false;
    if (s >= POSES - 2) {
      drift = { x: 0, y: 0 };
      est = { x: truePos.x, y: truePos.y };
      uncertainty = 0.5;
      closed = true;
    }

    // Fire the range sensor; integrate hits/misses into the log-odds grid.
    const beams: { from: Pt; to: Pt; blocked: boolean }[] = [];
    for (let b = 0; b < NUM_BEAMS; b++) {
      const angle = heading + (b / NUM_BEAMS) * Math.PI * 2;
      const { hit, blocked } = castBeam(truePos, angle);
      beams.push({ from: truePos, to: hit, blocked });

      // Carve free space along the beam (everything before the hit).
      const dist = Math.hypot(hit.x - truePos.x, hit.y - truePos.y);
      for (let r = 0.5; r < dist - 0.5; r += 0.6) {
        const fx = Math.round(truePos.x + Math.cos(angle) * r);
        const fy = Math.round(truePos.y + Math.sin(angle) * r);
        if (fx >= 0 && fy >= 0 && fx < GRID && fy < GRID) {
          log[idx(fx, fy)] = Math.max(-6, log[idx(fx, fy)] - 0.7);
        }
      }
      // Mark the hit cell occupied.
      if (blocked) {
        const hx = Math.round(hit.x);
        const hy = Math.round(hit.y);
        if (hx >= 0 && hy >= 0 && hx < GRID && hy < GRID) {
          log[idx(hx, hy)] = Math.min(7, log[idx(hx, hy)] + 1.6);
        }
      }
    }

    frames.push({
      t,
      truePos,
      estPos: est,
      uncertainty,
      log: log.slice(),
      beams,
      closed,
    });
  }
  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function OccupancyGridSLAM() {
  const [noise, setNoise] = useState(1);
  const frames = useMemo(() => simulate(2024, noise), [noise]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 8);
  const k = Math.min(index, frames.length - 1);
  const f = frames[k];

  const SVG = GRID * CELL;
  const cc = (n: number) => n * CELL + CELL / 2;

  // Map log-odds → a fill: occupied dark, free light, unknown surface.
  const cellFill = (lo: number) => {
    if (lo > 0.5) {
      const a = Math.min(1, lo / 6);
      return `color-mix(in oklab, var(--fg) ${Math.round(30 + 60 * a)}%, var(--surface))`;
    }
    if (lo < -0.5) {
      const a = Math.min(1, -lo / 6);
      return `color-mix(in oklab, var(--bg) ${Math.round(40 + 55 * a)}%, var(--surface))`;
    }
    return 'var(--surface)';
  };

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-muted">
          odometry drift = {noise.toFixed(1)}×
          <input type="range" min={0.2} max={2.5} step={0.1} value={noise} onChange={(e) => setNoise(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <svg viewBox={`0 0 ${SVG} ${SVG}`} className="mx-auto block w-full" style={{ maxHeight: '24rem' }} role="img" aria-label="Robot driving a loop while filling an occupancy grid from range sensors">
        {/* occupancy grid */}
        {Array.from({ length: GRID }).map((_, y) =>
          Array.from({ length: GRID }).map((__, x) => {
            const lo = f.log[y * GRID + x];
            return <rect key={`${x}-${y}`} x={x * CELL} y={y * CELL} width={CELL} height={CELL} fill={cellFill(lo)} stroke="var(--border)" strokeWidth={0.3} />;
          }),
        )}

        {/* sensor beams from the true pose */}
        {f.beams.map((b, i) => (
          <line key={i} x1={cc(b.from.x)} y1={cc(b.from.y)} x2={cc(b.to.x)} y2={cc(b.to.y)} stroke={b.blocked ? '#f43f5e' : '#38bdf8'} strokeWidth={0.5} opacity={0.45} />
        ))}

        {/* path travelled so far (true) */}
        <polyline points={frames.slice(0, k + 1).map((fr) => `${cc(fr.truePos.x)},${cc(fr.truePos.y)}`).join(' ')} fill="none" stroke="#10b981" strokeWidth={1} opacity={0.7} strokeDasharray="2 2" />

        {/* pose uncertainty ellipse around the (drifted) estimate */}
        <circle cx={cc(f.estPos.x)} cy={cc(f.estPos.y)} r={f.uncertainty * CELL} fill="color-mix(in oklab, #8b5cf6 18%, transparent)" stroke="#8b5cf6" strokeWidth={0.6} strokeDasharray="2 1.5" />

        {/* estimated pose */}
        <circle cx={cc(f.estPos.x)} cy={cc(f.estPos.y)} r={2.6} fill="#8b5cf6" />
        {/* true pose */}
        <circle cx={cc(f.truePos.x)} cy={cc(f.truePos.y)} r={2.6} fill="#10b981" stroke="var(--bg)" strokeWidth={0.8} />

        {/* loop closure flash */}
        {f.closed && (
          <text x={SVG / 2} y={16} textAnchor="middle" fontSize={11} style={{ fill: '#fbbf24', fontFamily: 'var(--font-mono)' }}>
            loop closure — drift corrected
          </text>
        )}
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
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Drive & map'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= frames.length - 1}>
          Step <Icon name="chevron-right" size={16} />
        </button>
        <button type="button" className={btn} onClick={reset} disabled={index === 0}>
          <Icon name="rotate-ccw" size={15} /> Reset
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={1} max={20} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input type="range" min={0} max={Math.max(frames.length - 1, 0)} value={index} onChange={(e) => seek(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Timeline" />
        <span className="shrink-0 font-mono text-xs text-muted">
          pose {k + 1}/{frames.length}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-edge pt-4 text-xs text-muted">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#10b981' }} /> true pose</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#8b5cf6' }} /> estimate ± uncertainty</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: '#f43f5e' }} /> beam hit</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: 'var(--fg)' }} /> occupied cell</span>
        </div>
        <div className="font-mono">
          uncertainty {f.uncertainty.toFixed(1)} cells
        </div>
      </div>

      <p className="mt-3 text-sm text-muted">
        Each pose the robot fires range beams: cells a beam passes through are carved as free, the cell it strikes is marked occupied, and the grid sharpens into a map. Meanwhile the estimated pose drifts from the truth as odometry error builds (violet ellipse grows). When the robot returns to a place it has seen before, a loop closure snaps the estimate back and shrinks the uncertainty — that is the heart of SLAM.
      </p>
    </div>
  );
}
