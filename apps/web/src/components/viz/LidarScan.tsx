import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// A 2D LIDAR sweeping a room: it fires a fan of beams, each measuring the
// distance to the nearest surface. Real range readings are noisy, so each
// returned point is the true hit perturbed by Gaussian sensor noise. The
// stepper sweeps the beam around; the noise slider widens or tightens the
// scatter of the returned point cloud. Seeded so a run is reproducible.

const W = 360; // world is W x H units, rendered 1:1 into the SVG
const H = 300;
const SENSOR = { x: 180, y: 165 }; // LIDAR position
const NUM_BEAMS = 120; // angular resolution of one full scan
const MAX_RANGE = 240;

type Seg = { x1: number; y1: number; x2: number; y2: number };

// Room walls + a couple of obstacles, as line segments.
const SEGMENTS: Seg[] = [
  // outer walls
  { x1: 30, y1: 30, x2: 330, y2: 30 },
  { x1: 330, y1: 30, x2: 330, y2: 270 },
  { x1: 330, y1: 270, x2: 30, y2: 270 },
  { x1: 30, y1: 270, x2: 30, y2: 30 },
  // a box obstacle
  { x1: 70, y1: 90, x2: 130, y2: 90 },
  { x1: 130, y1: 90, x2: 130, y2: 150 },
  { x1: 130, y1: 150, x2: 70, y2: 150 },
  { x1: 70, y1: 150, x2: 70, y2: 90 },
  // an angled wall
  { x1: 230, y1: 200, x2: 300, y2: 245 },
  // a pillar (triangle)
  { x1: 250, y1: 70, x2: 290, y2: 85 },
  { x1: 290, y1: 85, x2: 260, y2: 120 },
  { x1: 260, y1: 120, x2: 250, y2: 70 },
];

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

// Ray–segment intersection; returns distance along the ray, or null.
function raySegment(ox: number, oy: number, dx: number, dy: number, s: Seg): number | null {
  const ex = s.x2 - s.x1;
  const ey = s.y2 - s.y1;
  const denom = dx * ey - dy * ex;
  if (Math.abs(denom) < 1e-9) return null; // parallel
  const t2 = ((s.x1 - ox) * dy - (s.y1 - oy) * dx) / denom; // along the segment
  const t1 = ((s.x1 - ox) * ey - (s.y1 - oy) * ex) / denom; // along the ray
  if (t1 > 0 && t2 >= 0 && t2 <= 1) return t1;
  return null;
}

// Closest hit distance for one beam angle.
function castRay(angle: number): number {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let best = MAX_RANGE;
  for (const s of SEGMENTS) {
    const d = raySegment(SENSOR.x, SENSOR.y, dx, dy, s);
    if (d !== null && d < best) best = d;
  }
  return best;
}

type Beam = { angle: number; trueDist: number; measDist: number };

function buildScan(noise: number, seed: number): Beam[] {
  const rng = makeRng(seed);
  const beams: Beam[] = [];
  for (let i = 0; i < NUM_BEAMS; i++) {
    const angle = (i / NUM_BEAMS) * Math.PI * 2;
    const trueDist = castRay(angle);
    // Range noise grows mildly with distance, like a real time-of-flight sensor.
    const sigma = noise * (1 + trueDist / 200);
    const measDist = Math.max(2, trueDist + gaussian(rng) * sigma);
    beams.push({ angle, trueDist, measDist });
  }
  return beams;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function LidarScan() {
  const [noise, setNoise] = useState(4);
  const seed = 777;
  const beams = useMemo(() => buildScan(noise, seed), [noise]);

  // The stepper sweeps the beam index; the final frame shows the whole scan.
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(NUM_BEAMS + 1, 40);
  const swept = Math.min(index, NUM_BEAMS);
  const shown = beams.slice(0, swept);
  const active = swept < NUM_BEAMS ? beams[swept] : null;

  const pt = (b: Beam, dist: number) => ({
    x: SENSOR.x + Math.cos(b.angle) * dist,
    y: SENSOR.y + Math.sin(b.angle) * dist,
  });

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-muted">
          measurement noise σ = {noise.toFixed(0)}
          <input type="range" min={0} max={20} step={1} value={noise} onChange={(e) => setNoise(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block w-full" style={{ maxHeight: '24rem' }} role="img" aria-label="2D LIDAR sweeping a room, beams hitting walls and obstacles with noisy returns">
        <rect x={0} y={0} width={W} height={H} fill="var(--bg)" />

        {/* environment surfaces */}
        {SEGMENTS.map((s, i) => (
          <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="var(--muted)" strokeWidth={2.5} strokeLinecap="round" />
        ))}

        {/* swept beams (faint) */}
        {shown.map((b, i) => {
          const e = pt(b, b.measDist);
          return <line key={i} x1={SENSOR.x} y1={SENSOR.y} x2={e.x} y2={e.y} stroke="#38bdf8" strokeWidth={0.4} opacity={0.18} />;
        })}

        {/* returned point cloud (noisy hits) */}
        {shown.map((b, i) => {
          const e = pt(b, b.measDist);
          return <circle key={`p${i}`} cx={e.x} cy={e.y} r={1.7} fill="#fbbf24" />;
        })}

        {/* active beam being measured right now */}
        {active && (
          <>
            <line x1={SENSOR.x} y1={SENSOR.y} x2={pt(active, active.measDist).x} y2={pt(active, active.measDist).y} stroke="#38bdf8" strokeWidth={1.2} />
            <circle cx={pt(active, active.measDist).x} cy={pt(active, active.measDist).y} r={3} fill="#38bdf8" stroke="var(--bg)" strokeWidth={1} />
          </>
        )}

        {/* the LIDAR itself */}
        <circle cx={SENSOR.x} cy={SENSOR.y} r={5} fill="#10b981" stroke="var(--bg)" strokeWidth={1.5} />
      </svg>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={prev} disabled={index <= 0}>
          <Icon name="chevron-left" size={16} /> Beam
        </button>
        <button
          type="button"
          onClick={() => (playing ? pause() : play())}
          className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90"
        >
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Sweep'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= NUM_BEAMS}>
          Beam <Icon name="chevron-right" size={16} />
        </button>
        <button type="button" className={btn} onClick={() => seek(NUM_BEAMS)} disabled={index >= NUM_BEAMS}>
          <Icon name="check" size={15} /> Full scan
        </button>
        <button type="button" className={btn} onClick={reset} disabled={index === 0}>
          <Icon name="rotate-ccw" size={15} /> Reset
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={5} max={80} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input type="range" min={0} max={NUM_BEAMS} value={index} onChange={(e) => seek(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Sweep" />
        <span className="shrink-0 font-mono text-xs text-muted">
          {swept}/{NUM_BEAMS} beams
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-edge pt-4 text-xs text-muted">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#10b981' }} /> sensor</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: '#38bdf8' }} /> beam</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#fbbf24' }} /> range return</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: 'var(--muted)' }} /> surface</span>
        </div>
        <div className="font-mono">
          {active ? `range ${active.measDist.toFixed(0)} (true ${active.trueDist.toFixed(0)})` : `scan complete · ${NUM_BEAMS} returns`}
        </div>
      </div>

      <p className="mt-3 text-sm text-muted">
        A LIDAR measures distance by timing reflected light. Each beam returns the range to the nearest surface, and the fan of returns forms a point cloud the robot uses to perceive its surroundings. With noise at zero the points sit exactly on the walls; raise it and the returns scatter around the true surface — and the scatter grows with range, just like a real sensor. Encoders, IMUs, and cameras each carry their own noise model in the same way.
      </p>
    </div>
  );
}
