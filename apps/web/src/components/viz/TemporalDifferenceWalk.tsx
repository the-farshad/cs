import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// Sutton & Barto's classic random walk. States A..E in a row; terminals at each
// end. Start in the middle (C). Each step goes left/right with prob 1/2.
// Reaching the RIGHT terminal pays +1, the LEFT pays 0. With gamma = 1 the true
// value of a state is its probability of ending on the right: 1/6 .. 5/6.
const LABELS = ['A', 'B', 'C', 'D', 'E'];
const N = LABELS.length;
const START = 2; // C
const TRUE = [1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6];
const ALPHA = 0.1;
const EPISODES = 120;
const FRAMES = 80;

type Method = 'td' | 'mc';

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Frame = { V: number[]; episode: number; rmse: number };

const rmse = (V: number[]) =>
  Math.sqrt(V.reduce((s, v, i) => s + (v - TRUE[i]) ** 2, 0) / N);

// Generate one random-walk episode: list of visited non-terminal states plus
// the final reward (1 if it exits right, 0 if left).
function episode(rng: () => number): { visited: number[]; reward: number } {
  let s = START;
  const visited: number[] = [];
  for (let t = 0; t < 200; t++) {
    visited.push(s);
    s += rng() < 0.5 ? -1 : 1;
    if (s < 0) return { visited, reward: 0 };
    if (s >= N) return { visited, reward: 1 };
  }
  return { visited, reward: 0 };
}

// Run TD(0) or constant-alpha Monte Carlo; snapshot V at FRAMES checkpoints.
function train(seed: number, method: Method): Frame[] {
  const rng = mulberry32(seed);
  const V = new Array(N).fill(0.5); // optimistic-ish init at 0.5
  const frames: Frame[] = [{ V: [...V], episode: 0, rmse: rmse(V) }];
  const snapEvery = Math.max(1, Math.floor(EPISODES / FRAMES));

  for (let ep = 1; ep <= EPISODES; ep++) {
    const { visited, reward } = episode(rng);
    if (method === 'td') {
      // TD(0): after each transition, V(s) <- V(s) + alpha [ r + gamma V(s') - V(s) ]
      for (let k = 0; k < visited.length; k++) {
        const s = visited[k];
        const next = visited[k + 1];
        const isLast = k === visited.length - 1;
        const r = isLast ? reward : 0;
        const vNext = isLast ? 0 : V[next]; // terminal value is 0
        V[s] += ALPHA * (r + vNext - V[s]);
      }
    } else {
      // Monte Carlo: wait for the full return G (= reward here, gamma=1), then
      // V(s) <- V(s) + alpha [ G - V(s) ] for each state visited in the episode.
      const G = reward;
      for (const s of visited) {
        V[s] += ALPHA * (G - V[s]);
      }
    }
    if (ep % snapEvery === 0 || ep === EPISODES) {
      frames.push({ V: [...V], episode: ep, rmse: rmse(V) });
    }
  }
  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function TemporalDifferenceWalk() {
  const [seed, setSeed] = useState(1);
  const [method, setMethod] = useState<Method>('td');
  const frames = useMemo(() => train(seed, method), [seed, method]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 8);
  const i = Math.min(index, frames.length - 1);
  const frame = frames[i];

  const reseed = () => setSeed((s) => s + 1);

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setMethod('td')}
            aria-pressed={method === 'td'}
            className={`rounded border px-2.5 py-1 text-sm transition ${method === 'td' ? 'border-accent bg-accent text-accent-fg' : 'border-edge text-muted hover:text-fg'}`}
          >
            TD(0)
          </button>
          <button
            type="button"
            onClick={() => setMethod('mc')}
            aria-pressed={method === 'mc'}
            className={`rounded border px-2.5 py-1 text-sm transition ${method === 'mc' ? 'border-accent bg-accent text-accent-fg' : 'border-edge text-muted hover:text-fg'}`}
          >
            Monte Carlo
          </button>
        </div>
        <button type="button" className={btn} onClick={reseed}>
          <Icon name="shuffle" size={16} /> New run
        </button>
        <span className="font-mono text-xs text-muted">
          updates {method === 'td' ? 'every step (bootstrapped)' : 'after the full episode'}
        </span>
      </div>

      {/* Value bars per state: estimate (filled) vs true value (dashed line) */}
      <div className="flex h-52 items-end gap-3 sm:gap-5" role="img" aria-label="value estimates along the random walk">
        {LABELS.map((label, s) => {
          const v = frame.V[s];
          return (
            <div key={s} className="relative flex flex-1 flex-col items-center justify-end">
              <div
                className="pointer-events-none absolute left-0 right-0 border-t border-dashed"
                style={{ bottom: `${TRUE[s] * 100}%`, borderColor: '#38bdf8' }}
              />
              <span className="mb-1 font-mono text-xs text-muted">{v.toFixed(2)}</span>
              <div
                className="w-full rounded-t-sm transition-[height] duration-100"
                style={{ height: `${Math.max(v, 0) * 100}%`, background: 'var(--accent)' }}
              />
              <span className="mt-1 font-mono text-sm text-fg">{label}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-1 text-center font-mono text-[10px]" style={{ color: '#38bdf8' }}>
        dashed = true value (1/6 &hellip; 5/6)
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
          <input
            type="range"
            min={1}
            max={20}
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
        RMSE vs true values = {frame.rmse.toFixed(3)}. TD(0) updates each state from the next state's
        estimate (bootstrapping); Monte Carlo waits for the episode's actual return.
      </div>
    </div>
  );
}
