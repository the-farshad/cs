import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// Four slot machines (arms) with fixed, deterministic true mean payouts.
// The learner doesn't know these — it must estimate them by pulling.
const TRUE_MEANS = [0.3, 0.55, 0.7, 0.45];
const ARM_COLORS = ['#38bdf8', '#fbbf24', '#10b981', '#8b5cf6'];
const BEST = TRUE_MEANS.indexOf(Math.max(...TRUE_MEANS)); // arm 2
const STD = 0.18; // reward noise
const PULLS = 400;
const FRAMES = 80;

type Strategy = 'epsilon' | 'ucb';

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller for Gaussian reward noise (clamped to [0,1]).
function gauss(rng: () => number, mean: number): number {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.min(1, Math.max(0, mean + STD * z));
}

type Step = {
  pulls: number;
  counts: number[];
  estimates: number[];
  regret: number; // cumulative
};

// Play out one full run; record a snapshot at FRAMES checkpoints.
function run(seed: number, strategy: Strategy, epsilon: number): Step[] {
  const rng = mulberry32(seed);
  const k = TRUE_MEANS.length;
  const counts = new Array(k).fill(0);
  const sums = new Array(k).fill(0);
  const est = () => counts.map((c, i) => (c === 0 ? 0 : sums[i] / c));
  let regret = 0;
  const optimal = TRUE_MEANS[BEST];
  const snapEvery = Math.max(1, Math.floor(PULLS / FRAMES));
  const steps: Step[] = [{ pulls: 0, counts: [...counts], estimates: est(), regret: 0 }];

  for (let t = 1; t <= PULLS; t++) {
    const Q = est();
    let arm: number;
    if (strategy === 'ucb') {
      // pull each arm once first, then UCB1: Q + sqrt(2 ln t / N)
      const unseen = counts.indexOf(0);
      if (unseen >= 0) {
        arm = unseen;
      } else {
        let best = 0;
        let bv = -Infinity;
        for (let i = 0; i < k; i++) {
          const ucb = Q[i] + Math.sqrt((2 * Math.log(t)) / counts[i]);
          if (ucb > bv) {
            bv = ucb;
            best = i;
          }
        }
        arm = best;
      }
    } else {
      // epsilon-greedy
      if (rng() < epsilon) {
        arm = Math.floor(rng() * k);
      } else {
        let best = 0;
        let bv = -Infinity;
        for (let i = 0; i < k; i++) {
          if (Q[i] > bv) {
            bv = Q[i];
            best = i;
          }
        }
        arm = best;
      }
    }
    const reward = gauss(rng, TRUE_MEANS[arm]);
    counts[arm]++;
    sums[arm] += reward;
    regret += optimal - TRUE_MEANS[arm];
    if (t % snapEvery === 0 || t === PULLS) {
      steps.push({ pulls: t, counts: [...counts], estimates: est(), regret });
    }
  }
  return steps;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const W = 520;
const H = 130;
const PAD = 28;

export default function BanditVisualizer() {
  const [seed, setSeed] = useState(2);
  const [strategy, setStrategy] = useState<Strategy>('epsilon');
  const [epsilon, setEpsilon] = useState(0.1);
  const steps = useMemo(() => run(seed, strategy, epsilon), [seed, strategy, epsilon]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(steps.length, 12);
  const i = Math.min(index, steps.length - 1);
  const step = steps[i];

  // regret curve over time (use every snapshot up to now)
  const maxRegret = Math.max(steps[steps.length - 1].regret, 0.001);
  const toRx = (k: number) => PAD + (k / (steps.length - 1)) * (W - 2 * PAD);
  const toRy = (r: number) => H - PAD - (r / maxRegret) * (H - 2 * PAD);
  const regretPts = steps
    .slice(0, i + 1)
    .map((s, k) => `${toRx(k).toFixed(1)},${toRy(s.regret).toFixed(1)}`)
    .join(' ');

  const reseed = () => setSeed((s) => s + 1);

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setStrategy('epsilon')}
            aria-pressed={strategy === 'epsilon'}
            className={`rounded border px-2.5 py-1 text-sm transition ${strategy === 'epsilon' ? 'border-accent bg-accent text-accent-fg' : 'border-edge text-muted hover:text-fg'}`}
          >
            &epsilon;-greedy
          </button>
          <button
            type="button"
            onClick={() => setStrategy('ucb')}
            aria-pressed={strategy === 'ucb'}
            className={`rounded border px-2.5 py-1 text-sm transition ${strategy === 'ucb' ? 'border-accent bg-accent text-accent-fg' : 'border-edge text-muted hover:text-fg'}`}
          >
            UCB
          </button>
        </div>
        {strategy === 'epsilon' && (
          <label className="flex items-center gap-2 text-sm text-muted">
            &epsilon; = {epsilon.toFixed(2)}
            <input
              type="range"
              min={0}
              max={0.5}
              step={0.05}
              value={epsilon}
              onChange={(e) => setEpsilon(Number(e.target.value))}
              className="accent-[var(--accent)]"
            />
          </label>
        )}
        <button type="button" className={btn} onClick={reseed}>
          <Icon name="shuffle" size={16} /> New run
        </button>
      </div>

      {/* Arms: estimated mean bar (filled) vs true mean (dashed line) */}
      <div className="flex h-44 items-end gap-3 sm:gap-5" role="img" aria-label="estimated vs true arm means">
        {TRUE_MEANS.map((mu, a) => {
          const est = step.estimates[a];
          return (
            <div key={a} className="relative flex flex-1 flex-col items-center justify-end">
              {/* true-mean reference line */}
              <div
                className="pointer-events-none absolute left-0 right-0 border-t border-dashed"
                style={{ bottom: `${mu * 100}%`, borderColor: ARM_COLORS[a] }}
              />
              <span className="mb-1 font-mono text-xs text-muted">{est.toFixed(2)}</span>
              <div
                className="w-full rounded-t-sm transition-[height] duration-100"
                style={{ height: `${est * 100}%`, background: ARM_COLORS[a], opacity: a === BEST ? 1 : 0.7 }}
              />
              <span className="mt-1 font-mono text-xs" style={{ color: a === BEST ? '#10b981' : 'var(--fg)' }}>
                arm {a + 1}
              </span>
              <span className="font-mono text-[10px] text-muted">{step.counts[a]} pulls</span>
            </div>
          );
        })}
      </div>

      {/* Cumulative regret curve */}
      <div className="mt-4">
        <div className="mb-1 font-mono text-xs text-muted">cumulative regret</div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="cumulative regret over pulls">
          <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} style={{ stroke: 'var(--border)' }} strokeWidth={1} />
          <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} style={{ stroke: 'var(--border)' }} strokeWidth={1} />
          <polyline points={regretPts} fill="none" style={{ stroke: '#f43f5e' }} strokeWidth={2} />
        </svg>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={prev} disabled={index <= 0}>
          <Icon name="chevron-left" size={16} /> Step
        </button>
        <button
          type="button"
          onClick={() => (playing ? pause() : play())}
          className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90"
        >
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Pull'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= steps.length - 1}>
          Step <Icon name="chevron-right" size={16} />
        </button>
        <button type="button" className={btn} onClick={reset} disabled={index === 0}>
          <Icon name="rotate-ccw" size={16} /> Reset
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input
            type="range"
            min={1}
            max={30}
            value={fps}
            onChange={(e) => setFps(Number(e.target.value))}
            className="accent-[var(--accent)]"
          />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={Math.max(steps.length - 1, 0)}
          value={index}
          onChange={(e) => seek(Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
          aria-label="Timeline"
        />
        <span className="shrink-0 font-mono text-xs text-muted">{step.pulls}/{PULLS} pulls</span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">
        regret = {step.regret.toFixed(2)} &middot; arm 3 is best (true mean {TRUE_MEANS[BEST].toFixed(2)}). Bars are
        estimates; dashed lines are the unknown true means &mdash; estimates of well-pulled arms converge.
      </div>
    </div>
  );
}
