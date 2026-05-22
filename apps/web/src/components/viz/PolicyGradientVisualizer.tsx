import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// A one-step (contextless) decision: pick one of four actions, get a noisy
// reward. The policy is a softmax over learnable preferences (logits) theta.
// REINFORCE nudges up the probability of actions that beat the baseline.
const ACTION_REWARDS = [0.2, 0.9, 0.5, 0.35]; // true mean reward per action
const ACTION_COLORS = ['#38bdf8', '#10b981', '#fbbf24', '#8b5cf6'];
const BEST = ACTION_REWARDS.indexOf(Math.max(...ACTION_REWARDS)); // action 2
const NA = ACTION_REWARDS.length;
const STD = 0.12;
const ALPHA = 0.15; // policy learning rate
const EPISODES = 300;
const FRAMES = 80;

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rng: () => number, mean: number): number {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return mean + STD * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function softmax(theta: number[]): number[] {
  const m = Math.max(...theta);
  const exps = theta.map((t) => Math.exp(t - m));
  const z = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / z);
}

function sample(probs: number[], r: number): number {
  let acc = 0;
  for (let i = 0; i < probs.length; i++) {
    acc += probs[i];
    if (r <= acc) return i;
  }
  return probs.length - 1;
}

type Frame = { probs: number[]; episode: number; avgReturn: number };

// REINFORCE on softmax preferences with a running-average baseline.
// gradient of log-prob for a softmax: d/dtheta_i log pi(a) = [i==a] - pi(i)
function train(seed: number): Frame[] {
  const rng = mulberry32(seed);
  const theta = new Array(NA).fill(0);
  let baseline = 0;
  let runningReturn = 0;
  const frames: Frame[] = [{ probs: softmax(theta), episode: 0, avgReturn: 0 }];
  const snapEvery = Math.max(1, Math.floor(EPISODES / FRAMES));

  for (let ep = 1; ep <= EPISODES; ep++) {
    const probs = softmax(theta);
    const a = sample(probs, rng());
    const G = gauss(rng, ACTION_REWARDS[a]); // return for this one-step episode
    const advantage = G - baseline;
    // theta_i <- theta_i + alpha * advantage * ( [i==a] - pi(i) )
    for (let i = 0; i < NA; i++) {
      theta[i] += ALPHA * advantage * ((i === a ? 1 : 0) - probs[i]);
    }
    baseline += 0.05 * (G - baseline); // slow EMA baseline
    runningReturn += 0.02 * (G - runningReturn);
    if (ep % snapEvery === 0 || ep === EPISODES) {
      frames.push({ probs: softmax(theta), episode: ep, avgReturn: runningReturn });
    }
  }
  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function PolicyGradientVisualizer() {
  const [seed, setSeed] = useState(4);
  const frames = useMemo(() => train(seed), [seed]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 10);
  const i = Math.min(index, frames.length - 1);
  const frame = frames[i];

  const reseed = () => setSeed((s) => s + 1);

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={reseed}>
          <Icon name="shuffle" size={16} /> New run
        </button>
        <span className="font-mono text-xs text-muted">softmax policy &pi;(a) over 4 actions</span>
      </div>

      {/* Action probabilities: filled bar = current pi(a), dashed = true reward */}
      <div className="flex h-52 items-end gap-3 sm:gap-5" role="img" aria-label="policy probabilities over actions">
        {ACTION_REWARDS.map((mu, a) => {
          const p = frame.probs[a];
          return (
            <div key={a} className="relative flex flex-1 flex-col items-center justify-end">
              {/* true mean-reward reference (scaled to bar height) */}
              <div
                className="pointer-events-none absolute left-0 right-0 border-t border-dashed opacity-60"
                style={{ bottom: `${mu * 100}%`, borderColor: ACTION_COLORS[a] }}
              />
              <span className="mb-1 font-mono text-xs text-muted">{(p * 100).toFixed(0)}%</span>
              <div
                className="w-full rounded-t-sm transition-[height] duration-100"
                style={{ height: `${p * 100}%`, background: ACTION_COLORS[a], opacity: a === BEST ? 1 : 0.7 }}
              />
              <span className="mt-1 font-mono text-sm" style={{ color: a === BEST ? '#10b981' : 'var(--fg)' }}>
                a{a + 1}
              </span>
              <span className="font-mono text-[10px] text-muted">r&#773;={mu.toFixed(2)}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-1 text-center font-mono text-[10px] text-muted">
        bars = policy probability &pi;(a) &middot; dashed = each action's true mean reward
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
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Learn'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= frames.length - 1}>
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
            max={24}
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
          max={Math.max(frames.length - 1, 0)}
          value={index}
          onChange={(e) => seek(Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
          aria-label="Timeline"
        />
        <span className="shrink-0 font-mono text-xs text-muted">episode {frame.episode}/{EPISODES}</span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">
        running average return = {frame.avgReturn.toFixed(2)}. REINFORCE pushes probability toward
        actions whose return beats the baseline; the policy concentrates on action 2 (best mean reward).
      </div>
    </div>
  );
}
