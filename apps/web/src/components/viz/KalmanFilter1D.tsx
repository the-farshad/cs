import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// 1D Kalman filter tracking an object moving along a line.
// We precompute every timestep so the stepper can scrub deterministically.
const STEPS = 60;
const DT = 1;
const PROCESS_VAR = 0.6; // q: how much we trust the constant-velocity model
const VEL = 1.15; // true speed (units per step)

// Plot geometry.
const W = 560;
const H = 280;
const PAD_L = 30;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 28;
const POS_MIN = -4;
const POS_MAX = 80;

type Step = {
  t: number;
  truth: number;
  meas: number;
  estimate: number; // posterior mean after correction
  variance: number; // posterior variance after correction
  predMean: number; // prior mean before correction
  predVar: number; // prior variance before correction
  gain: number; // Kalman gain this step
};

// Deterministic PRNG (mulberry32) so a given seed always yields the same noise.
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

// Box-Muller: turn two uniforms into a standard-normal sample.
function gaussian(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function simulate(measVar: number, seed: number): Step[] {
  const rng = makeRng(seed);
  const steps: Step[] = [];

  // True trajectory: roughly constant velocity with a gentle wobble.
  let truth = 2;
  // Filter belief: start uncertain and slightly off.
  let mean = 0;
  let variance = 16;

  for (let t = 0; t < STEPS; t++) {
    // Advance ground truth.
    truth += VEL * DT + Math.sin(t * 0.25) * 0.5;

    // Noisy measurement of the true position.
    const meas = truth + gaussian(rng) * Math.sqrt(measVar);

    // Predict: constant-velocity guess (here we model position drift by VEL).
    const predMean = mean + VEL * DT;
    const predVar = variance + PROCESS_VAR;

    // Correct: blend prediction with measurement by the Kalman gain.
    const gain = predVar / (predVar + measVar);
    const estimate = predMean + gain * (meas - predMean);
    const newVar = (1 - gain) * predVar;

    steps.push({ t, truth, meas, estimate, variance: newVar, predMean, predVar, gain });

    mean = estimate;
    variance = newVar;
  }
  return steps;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function KalmanFilter1D() {
  const [measVar, setMeasVar] = useState(9); // measurement-noise variance
  const seed = 1337;
  const steps = useMemo(() => simulate(measVar, seed), [measVar]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(steps.length, 10);
  const k = Math.min(index, steps.length - 1);
  const cur = steps[k];
  const shown = steps.slice(0, k + 1);

  const tx = (t: number) => PAD_L + (t / (STEPS - 1)) * (W - PAD_L - PAD_R);
  const py = (p: number) => PAD_T + ((POS_MAX - p) / (POS_MAX - POS_MIN)) * (H - PAD_T - PAD_B);

  // Uncertainty band = estimate ± 2 standard deviations, as a filled area.
  const bandUpper = shown.map((s) => `${tx(s.t).toFixed(1)},${py(s.estimate + 2 * Math.sqrt(s.variance)).toFixed(1)}`);
  const bandLower = shown.map((s) => `${tx(s.t).toFixed(1)},${py(s.estimate - 2 * Math.sqrt(s.variance)).toFixed(1)}`).reverse();
  const bandPath = bandUpper.length > 1 ? `${bandUpper.join(' ')} ${bandLower.join(' ')}` : '';

  const truthPath = shown.map((s) => `${tx(s.t).toFixed(1)},${py(s.truth).toFixed(1)}`).join(' ');
  const estPath = shown.map((s) => `${tx(s.t).toFixed(1)},${py(s.estimate).toFixed(1)}`).join(' ');

  const std = Math.sqrt(cur.variance);
  const err = Math.abs(cur.estimate - cur.truth);

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-muted">
          measurement noise (variance) = {measVar.toFixed(0)}
          <input type="range" min={1} max={40} step={1} value={measVar} onChange={(e) => setMeasVar(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '20rem' }} role="img" aria-label="1D Kalman filter tracking a moving object with a shrinking uncertainty band">
        {/* axes */}
        <line x1={PAD_L} y1={py(POS_MIN)} x2={W - PAD_R} y2={py(POS_MIN)} stroke="var(--border)" strokeWidth={1} />
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={py(POS_MIN)} stroke="var(--border)" strokeWidth={1} />
        <text x={PAD_L - 4} y={py(0) + 3} textAnchor="end" fontSize={9} style={{ fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>0</text>
        <text x={W - PAD_R} y={py(POS_MIN) + 16} textAnchor="end" fontSize={9} style={{ fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>time →</text>
        <text x={PAD_L - 4} y={PAD_T + 8} textAnchor="end" fontSize={9} style={{ fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>pos</text>

        {/* uncertainty band (±2σ around the estimate) */}
        {bandPath && <polygon points={bandPath} fill="color-mix(in oklab, #8b5cf6 22%, transparent)" stroke="none" />}

        {/* true position */}
        {truthPath && <polyline points={truthPath} fill="none" stroke="#10b981" strokeWidth={2} strokeDasharray="5 4" />}

        {/* noisy measurements */}
        {shown.map((s) => (
          <circle key={s.t} cx={tx(s.t)} cy={py(s.meas)} r={2} fill="#f43f5e" opacity={s.t === cur.t ? 1 : 0.5} />
        ))}

        {/* filter estimate */}
        {estPath && <polyline points={estPath} fill="none" stroke="var(--accent)" strokeWidth={2.5} />}

        {/* current estimate marker */}
        <circle cx={tx(cur.t)} cy={py(cur.estimate)} r={3.5} fill="var(--accent)" stroke="var(--bg)" strokeWidth={1.5} />
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
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Run filter'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= steps.length - 1}>
          Step <Icon name="chevron-right" size={16} />
        </button>
        <button type="button" className={btn} onClick={reset} disabled={index === 0}>
          <Icon name="rotate-ccw" size={15} /> Reset
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={1} max={40} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input type="range" min={0} max={Math.max(steps.length - 1, 0)} value={index} onChange={(e) => seek(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Timeline" />
        <span className="shrink-0 font-mono text-xs text-muted">
          t = {k}/{STEPS - 1}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-edge pt-4 text-xs text-muted">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: '#10b981' }} /> true position</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#f43f5e' }} /> measurement</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: 'var(--accent)' }} /> estimate</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: 'color-mix(in oklab, #8b5cf6 45%, transparent)' }} /> ±2σ band</span>
        </div>
        <div className="font-mono">
          gain {cur.gain.toFixed(2)} · σ {std.toFixed(2)} · error {err.toFixed(2)}
        </div>
      </div>

      <p className="mt-3 text-sm text-muted">
        Each step the filter predicts (uncertainty grows), then corrects with the new measurement (uncertainty shrinks). The Kalman gain decides the blend: with noisier measurements the gain drops, so the estimate leans on its prediction and the violet band stays wider. Watch the band tighten as the estimate locks onto the true track.
      </p>
    </div>
  );
}
