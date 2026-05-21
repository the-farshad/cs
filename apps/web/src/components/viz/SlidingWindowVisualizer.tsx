import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

type Mode = 'window' | 'pair';

type Frame = {
  lo: number;
  hi: number;
  // window mode
  sum?: number;
  best?: number;
  bestLo?: number;
  bestHi?: number;
  // pair mode
  pairSum?: number;
  found?: boolean;
  note: string;
};

function randomArray(n: number, max = 9): number[] {
  return Array.from({ length: n }, () => Math.floor(Math.random() * max) + 1);
}

/** Max-sum subarray of fixed size k via a sliding window. */
function windowFrames(arr: number[], k: number): Frame[] {
  const frames: Frame[] = [];
  const n = arr.length;
  if (k > n || k <= 0) return [{ lo: 0, hi: -1, sum: 0, best: 0, note: 'window larger than array' }];

  let sum = 0;
  for (let i = 0; i < k; i++) sum += arr[i];
  let best = sum;
  let bestLo = 0;
  let bestHi = k - 1;
  frames.push({
    lo: 0,
    hi: k - 1,
    sum,
    best,
    bestLo,
    bestHi,
    note: `seed first window of size ${k}: sum = ${sum}`,
  });

  for (let hi = k; hi < n; hi++) {
    const lo = hi - k + 1;
    sum += arr[hi] - arr[lo - 1];
    frames.push({
      lo,
      hi,
      sum,
      best,
      bestLo,
      bestHi,
      note: `slide: +${arr[hi]} (in) −${arr[lo - 1]} (out) → sum = ${sum}`,
    });
    if (sum > best) {
      best = sum;
      bestLo = lo;
      bestHi = hi;
      frames.push({
        lo,
        hi,
        sum,
        best,
        bestLo,
        bestHi,
        note: `new best window: sum = ${best}`,
      });
    }
  }
  frames.push({
    lo: bestLo,
    hi: bestHi,
    sum: best,
    best,
    bestLo,
    bestHi,
    note: `done — max sum of ${k} consecutive = ${best}`,
  });
  return frames;
}

/** Two pointers from both ends find a pair summing to target in a sorted array. */
function pairFrames(arr: number[], target: number): Frame[] {
  const sorted = [...arr].sort((a, b) => a - b);
  const frames: Frame[] = [];
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo < hi) {
    const s = sorted[lo] + sorted[hi];
    if (s === target) {
      frames.push({ lo, hi, pairSum: s, found: true, note: `found ${sorted[lo]} + ${sorted[hi]} = ${target}` });
      return frames;
    }
    if (s < target) {
      frames.push({
        lo,
        hi,
        pairSum: s,
        note: `sum ${s} < ${target} → move left pointer right`,
      });
      lo++;
    } else {
      frames.push({
        lo,
        hi,
        pairSum: s,
        note: `sum ${s} > ${target} → move right pointer left`,
      });
      hi--;
    }
  }
  frames.push({ lo: -1, hi: -1, found: false, note: `no pair sums to ${target}` });
  return frames;
}

export default function SlidingWindowVisualizer() {
  const [mode, setMode] = useState<Mode>('window');
  const [data, setData] = useState<number[]>(() => randomArray(11));
  const [k, setK] = useState(3);
  const target = useMemo(() => {
    // pick a target that is usually reachable for the pair demo
    const sorted = [...data].sort((a, b) => a - b);
    return sorted[1] + sorted[sorted.length - 2];
  }, [data]);

  const sortedForPair = useMemo(() => [...data].sort((a, b) => a - b), [data]);
  const frames = useMemo(
    () => (mode === 'window' ? windowFrames(data, k) : pairFrames(data, target)),
    [mode, data, k, target],
  );
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 4);
  const frame = frames[Math.min(index, frames.length - 1)] ?? { lo: 0, hi: -1, note: '' };

  const display = mode === 'window' ? data : sortedForPair;
  const shuffle = () => setData(randomArray(11));

  const cellClass = (i: number): string => {
    if (mode === 'window') {
      const inBest =
        frame.bestLo !== undefined &&
        frame.bestHi !== undefined &&
        i >= frame.bestLo &&
        i <= frame.bestHi;
      const inWindow = i >= frame.lo && i <= frame.hi;
      if (inWindow) return 'border-accent bg-accent text-accent-fg';
      if (inBest) return 'border-emerald-500 text-fg';
      return 'border-edge text-muted';
    }
    if (i === frame.lo || i === frame.hi) {
      return frame.found
        ? 'border-emerald-500 bg-emerald-500 text-[#04140d]'
        : 'border-accent bg-accent text-accent-fg';
    }
    if (frame.lo >= 0 && i > frame.lo && i < frame.hi) return 'border-edge text-fg';
    return 'border-edge text-muted opacity-50';
  };

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded border border-edge">
          {(
            [
              ['window', 'Sliding window'],
              ['pair', 'Two pointers'],
            ] as [Mode, string][]
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`px-3 py-1 text-sm transition ${mode === m ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'window' && (
          <label className="flex items-center gap-2 text-sm text-muted">
            Window k {k}
            <input
              type="range"
              min={2}
              max={Math.max(2, data.length - 1)}
              value={k}
              onChange={(e) => setK(Number(e.target.value))}
              className="accent-[var(--accent)]"
            />
          </label>
        )}
        {mode === 'pair' && <span className="text-sm text-muted">target = {target} (array is sorted)</span>}

        <button type="button" className={btn} onClick={shuffle}>
          <Icon name="shuffle" size={16} /> Shuffle
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5" role="img" aria-label={`${mode} visualization`}>
        {display.map((v, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-md border-2 font-mono text-base transition-colors ${cellClass(i)}`}
            >
              {v}
            </div>
            <div className="h-4 text-xs text-accent">
              {i === frame.lo && i === frame.hi ? 'lo hi' : i === frame.lo ? 'lo' : i === frame.hi ? 'hi' : ''}
            </div>
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
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= frames.length - 1}>
          Step <Icon name="chevron-right" size={16} />
        </button>
        <button type="button" className={btn} onClick={reset} disabled={index === 0}>
          <Icon name="rotate-ccw" size={16} /> Reset
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={1} max={20} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
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
        <span className="shrink-0 font-mono text-xs text-muted">
          {index + 1}/{frames.length}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-edge pt-4 text-xs text-muted">
        <span className="font-mono">{frame.note}</span>
        <span className="font-mono">
          {mode === 'window'
            ? `window sum ${frame.sum ?? 0} · best ${frame.best ?? 0}`
            : frame.pairSum !== undefined
              ? `pair sum ${frame.pairSum}`
              : ''}
        </span>
      </div>
    </div>
  );
}
