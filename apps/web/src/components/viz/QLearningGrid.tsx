import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// A tiny deterministic 4x3 gridworld. Agent starts bottom-left, +1 goal and
// -1 pit in the top-right corner, one wall. Q-learning learns the Q-table.
const ROWS = 3;
const COLS = 4;
type Tile = 'empty' | 'wall' | 'goal' | 'pit';
const LAYOUT: Tile[] = [
  'empty', 'empty', 'empty', 'goal',
  'empty', 'wall', 'empty', 'pit',
  'empty', 'empty', 'empty', 'empty',
];
const START = 8; // bottom-left
const GAMMA = 0.9;
const ALPHA = 0.5;
const STEP_COST = -0.04;
// up, down, left, right
const D = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
const ARROWS = ['arrow-up', 'arrow-down', 'arrow-left', 'arrow-right'];
const EPISODES = 220;
const FRAMES = 80; // sampled snapshots across training

const isTerm = (i: number) => LAYOUT[i] === 'goal' || LAYOUT[i] === 'pit';
const reward = (i: number) => (LAYOUT[i] === 'goal' ? 1 : LAYOUT[i] === 'pit' ? -1 : STEP_COST);

function move(i: number, a: number): number {
  const r = Math.floor(i / COLS);
  const c = i % COLS;
  const nr = r + D[a][0];
  const nc = c + D[a][1];
  if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return i;
  const ni = nr * COLS + nc;
  return LAYOUT[ni] === 'wall' ? i : ni;
}

// Deterministic PRNG so scrubbing the timeline is reproducible.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Frame = { Q: number[][]; episode: number };

function argmax(row: number[]): number {
  let best = 0;
  let bv = -Infinity;
  for (let a = 0; a < 4; a++) {
    if (row[a] > bv) {
      bv = row[a];
      best = a;
    }
  }
  return best;
}

// Run epsilon-greedy Q-learning, snapshotting the Q-table at FRAMES checkpoints.
function train(seed: number, epsilon: number): Frame[] {
  const rng = mulberry32(seed);
  const n = ROWS * COLS;
  const Q: number[][] = Array.from({ length: n }, () => [0, 0, 0, 0]);
  const frames: Frame[] = [{ Q: Q.map((r) => [...r]), episode: 0 }];
  const snapEvery = Math.max(1, Math.floor(EPISODES / FRAMES));

  for (let ep = 1; ep <= EPISODES; ep++) {
    let s = START;
    for (let t = 0; t < 60; t++) {
      // epsilon-greedy action selection
      const a = rng() < epsilon ? Math.floor(rng() * 4) : argmax(Q[s]);
      const sp = move(s, a);
      const r = reward(sp);
      const maxNext = isTerm(sp) ? 0 : Math.max(...Q[sp]);
      // Q(s,a) <- Q(s,a) + alpha [ r + gamma max_a' Q(s',a') - Q(s,a) ]
      Q[s][a] += ALPHA * (r + GAMMA * maxNext - Q[s][a]);
      s = sp;
      if (isTerm(s)) break;
    }
    if (ep % snapEvery === 0 || ep === EPISODES) {
      frames.push({ Q: Q.map((r) => [...r]), episode: ep });
    }
  }
  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function QLearningGrid() {
  const [seed, setSeed] = useState(3);
  const [epsilon, setEpsilon] = useState(0.2);
  const frames = useMemo(() => train(seed, epsilon), [seed, epsilon]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 8);
  const i = Math.min(index, frames.length - 1);
  const frame = frames[i];

  const maxQ = (s: number) => Math.max(...frame.Q[s]);

  const cellBg = (s: number): string => {
    if (LAYOUT[s] === 'wall') return 'var(--border)';
    if (LAYOUT[s] === 'goal') return 'rgba(16,185,129,0.85)';
    if (LAYOUT[s] === 'pit') return 'rgba(244,63,94,0.85)';
    const v = maxQ(s);
    const pct = Math.min(Math.abs(v), 1) * 55;
    return v >= 0
      ? `color-mix(in oklab, #10b981 ${pct}%, var(--surface))`
      : `color-mix(in oklab, #f43f5e ${pct}%, var(--surface))`;
  };

  const reseed = () => setSeed((s) => s + 1);

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <button type="button" className={btn} onClick={reseed}>
          <Icon name="shuffle" size={16} /> New run
        </button>
        <label className="flex items-center gap-2 text-sm text-muted">
          exploration &epsilon; = {epsilon.toFixed(2)}
          <input
            type="range"
            min={0}
            max={0.6}
            step={0.05}
            value={epsilon}
            onChange={(e) => setEpsilon(Number(e.target.value))}
            className="accent-[var(--accent)]"
          />
        </label>
      </div>

      <div
        className="mx-auto grid max-w-md gap-1.5"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
      >
        {LAYOUT.map((tile, s) => (
          <div
            key={s}
            className="relative flex aspect-square flex-col items-center justify-center rounded border border-edge text-fg"
            style={{ background: cellBg(s) }}
          >
            {tile === 'goal' ? (
              <span className="font-mono text-sm font-semibold text-white">+1</span>
            ) : tile === 'pit' ? (
              <span className="font-mono text-sm font-semibold text-white">&minus;1</span>
            ) : tile === 'wall' ? null : (
              <>
                <span className="font-mono text-xs">{maxQ(s).toFixed(2)}</span>
                <Icon name={ARROWS[argmax(frame.Q[s])]} size={16} className="mt-0.5 text-accent" />
                {s === START && (
                  <span className="absolute left-1 top-1 font-mono text-[10px] text-muted">S</span>
                )}
              </>
            )}
          </div>
        ))}
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
        Each cell shows max&#8201;Q(s,&middot;) with the greedy arrow. The agent starts at S and learns
        purely from rewards &mdash; a coherent policy emerges as episodes accumulate.
      </div>
    </div>
  );
}
