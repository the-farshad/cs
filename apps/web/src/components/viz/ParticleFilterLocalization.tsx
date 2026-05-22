import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// Monte Carlo (particle filter) localization on a 1D corridor.
// A robot drives right past three doors. Its only sensor reports "door"
// or "wall" (noisily). A cloud of particles — each a hypothesis of where
// the robot is — is reweighted and resampled every step until it collapses
// onto the true pose. Everything is precomputed so the stepper can scrub.

const CORRIDOR = 100; // corridor length in world units
const N = 240; // number of particles
const STEPS = 26;
const MOVE = 3.4; // commanded motion per step (world units)
const MOTION_NOISE = 1.3; // std-dev added to each particle's motion
const SENSE_RANGE = 5; // a particle "sees a door" within this distance
const HIT = 0.85; // P(report door | actually near a door)
const MISS = 0.16; // P(report door | actually near a wall) — false alarm

const DOORS = [18, 50, 82]; // door centres along the corridor
const START_TRUTH = 8; // true starting pose

// Plot geometry.
const W = 560;
const H = 220;
const PAD_L = 16;
const PAD_R = 16;
const PAD_T = 40;
const PAD_B = 46;

// Deterministic PRNG (mulberry32): a given seed always yields the same run.
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

// Box-Muller: two uniforms into a standard-normal sample.
function gaussian(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// True if pose x is within SENSE_RANGE of any door centre.
function nearDoor(x: number): boolean {
  return DOORS.some((d) => Math.abs(x - d) <= SENSE_RANGE);
}

type Frame = {
  t: number;
  truth: number;
  reading: boolean; // sensor said "door" this step
  particles: number[]; // resampled particle positions
  weights: number[]; // pre-resample weights (for the heat shading)
  estimate: number; // weighted-mean pose
  spread: number; // weighted std-dev of the cloud
};

function simulate(seed: number): Frame[] {
  const rng = makeRng(seed);
  // Start with particles spread uniformly across the whole corridor:
  // total ignorance about where the robot is.
  let particles = Array.from({ length: N }, () => rng() * CORRIDOR);
  let truth = START_TRUTH;
  const frames: Frame[] = [];

  for (let t = 0; t < STEPS; t++) {
    // 1. Move the true robot.
    truth = Math.min(CORRIDOR, truth + MOVE);

    // 2. Predict: push every particle by the same command + its own noise.
    particles = particles.map((p) =>
      Math.max(0, Math.min(CORRIDOR, p + MOVE + gaussian(rng) * MOTION_NOISE)),
    );

    // 3. Sense: noisy door/wall reading from the TRUE pose.
    const trueNear = nearDoor(truth);
    const pDoor = trueNear ? HIT : MISS;
    const reading = rng() < pDoor;

    // 4. Weight each particle by how well it explains the reading.
    const weights = particles.map((p) => {
      const pNear = nearDoor(p);
      const likelihood = reading
        ? pNear
          ? HIT
          : MISS
        : pNear
          ? 1 - HIT
          : 1 - MISS;
      return likelihood;
    });
    const wsum = weights.reduce((a, b) => a + b, 0) || 1;
    const norm = weights.map((w) => w / wsum);

    // Weighted statistics of the (pre-resample) belief.
    const estimate = particles.reduce((a, p, i) => a + p * norm[i], 0);
    const variance = particles.reduce((a, p, i) => a + norm[i] * (p - estimate) ** 2, 0);
    const spread = Math.sqrt(variance);

    // 5. Resample: low-variance (systematic) resampling, with a touch of
    //    roughening so the cloud never fully collapses to a single point.
    const next: number[] = [];
    const r0 = rng() / N;
    let c = norm[0];
    let i = 0;
    for (let m = 0; m < N; m++) {
      const u = r0 + m / N;
      while (u > c && i < N - 1) {
        i++;
        c += norm[i];
      }
      next.push(Math.max(0, Math.min(CORRIDOR, particles[i] + gaussian(rng) * 0.4)));
    }

    frames.push({
      t,
      truth,
      reading,
      particles: next.slice(),
      weights: norm.slice(),
      estimate,
      spread,
    });
    particles = next;
  }
  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const SEEDS = [7, 42, 91, 128, 314];

export default function ParticleFilterLocalization() {
  const [seedIdx, setSeedIdx] = useState(0);
  const frames = useMemo(() => simulate(SEEDS[seedIdx]), [seedIdx]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 4);
  const k = Math.min(index, frames.length - 1);
  const f = frames[k];

  const innerW = W - PAD_L - PAD_R;
  const wx = (x: number) => PAD_L + (x / CORRIDOR) * innerW;
  const corridorY = PAD_T;
  const corridorH = H - PAD_T - PAD_B;
  const maxW = Math.max(...f.weights, 1e-9);

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '15rem' }} role="img" aria-label="Particle filter localizing a robot in a 1D corridor with doors">
        {/* corridor walls */}
        <rect x={wx(0)} y={corridorY} width={innerW} height={corridorH} fill="var(--bg)" stroke="var(--border)" strokeWidth={1} rx={3} />

        {/* doors: gaps in the wall the sensor can detect */}
        {DOORS.map((d, i) => (
          <g key={i}>
            <rect
              x={wx(d - SENSE_RANGE)}
              y={corridorY}
              width={wx(d + SENSE_RANGE) - wx(d - SENSE_RANGE)}
              height={corridorH}
              fill="color-mix(in oklab, #38bdf8 14%, transparent)"
            />
            <rect x={wx(d) - 6} y={corridorY - 5} width={12} height={10} fill="#38bdf8" rx={1.5} />
            <text x={wx(d)} y={corridorY - 9} textAnchor="middle" fontSize={9} style={{ fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
              door
            </text>
          </g>
        ))}

        {/* particle cloud — opacity by weight, stacked with vertical jitter */}
        {f.particles.map((p, i) => {
          const w = f.weights[i] / maxW;
          const jitter = ((i * 2654435761) % 1000) / 1000; // deterministic vertical scatter
          return (
            <circle
              key={i}
              cx={wx(p)}
              cy={corridorY + 8 + jitter * (corridorH - 16)}
              r={1.6}
              fill="#fbbf24"
              opacity={0.28 + 0.62 * w}
            />
          );
        })}

        {/* weighted estimate + uncertainty span (±1 spread) */}
        <line
          x1={wx(Math.max(0, f.estimate - f.spread))}
          y1={corridorY + corridorH + 12}
          x2={wx(Math.min(CORRIDOR, f.estimate + f.spread))}
          y2={corridorY + corridorH + 12}
          stroke="#8b5cf6"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <circle cx={wx(f.estimate)} cy={corridorY + corridorH + 12} r={3} fill="#8b5cf6" />

        {/* true robot pose */}
        <polygon
          points={`${wx(f.truth)},${corridorY + corridorH + 4} ${wx(f.truth) - 5},${corridorY + corridorH + 14} ${wx(f.truth) + 5},${corridorY + corridorH + 14}`}
          fill="#10b981"
        />

        {/* sensor reading badge */}
        <text x={wx(f.truth)} y={corridorY + corridorH + 30} textAnchor="middle" fontSize={9} style={{ fill: f.reading ? '#38bdf8' : 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
          sees: {f.reading ? 'DOOR' : 'wall'}
        </text>
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
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Drive robot'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= frames.length - 1}>
          Step <Icon name="chevron-right" size={16} />
        </button>
        <button type="button" className={btn} onClick={() => setSeedIdx((i) => (i + 1) % SEEDS.length)}>
          <Icon name="shuffle" size={15} /> New run
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
          step {k + 1}/{frames.length}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-edge pt-4 text-xs text-muted">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#fbbf24' }} /> particles</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-0 w-0" style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '8px solid #10b981' }} /> true pose</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: '#8b5cf6' }} /> estimate ±spread</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: '#38bdf8' }} /> door</span>
        </div>
        <div className="font-mono">
          spread {f.spread.toFixed(1)} · error {Math.abs(f.estimate - f.truth).toFixed(1)}
        </div>
      </div>

      <p className="mt-3 text-sm text-muted">
        Each step the particles move with the robot (predict), get weighted by how well they explain the door/wall reading (correct), then are resampled so survivors cluster where the data fits. The cloud starts spread across the whole corridor and collapses onto the true pose as successive readings rule out inconsistent hypotheses — and a wrong reading can briefly scatter the belief again.
      </p>
    </div>
  );
}
