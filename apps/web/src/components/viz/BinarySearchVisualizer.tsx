import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

type BSFrame = { lo: number; hi: number; mid: number; status: 'searching' | 'found' | 'notfound' };

function* search(arr: number[], target: number): Generator<BSFrame> {
  let lo = 0;
  let hi = arr.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    yield { lo, hi, mid, status: 'searching' };
    if (arr[mid] === target) {
      yield { lo, hi, mid, status: 'found' };
      return;
    }
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  yield { lo, hi, mid: -1, status: 'notfound' };
}

function sortedArray(n: number): number[] {
  const set = new Set<number>();
  while (set.size < n) set.add(Math.floor(Math.random() * 98) + 1);
  return [...set].sort((a, b) => a - b);
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function BinarySearchVisualizer() {
  const [{ data, target }, setState] = useState(() => {
    const d = sortedArray(15);
    return { data: d, target: d[Math.floor(Math.random() * d.length)] };
  });

  const frames = useMemo<BSFrame[]>(() => Array.from(search(data, target)), [data, target]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 3);
  const frame = frames[Math.min(index, frames.length - 1)];

  const newArray = () => {
    const d = sortedArray(15);
    setState({ data: d, target: d[Math.floor(Math.random() * d.length)] });
  };
  const pickTarget = () => setState((s) => ({ ...s, target: s.data[Math.floor(Math.random() * s.data.length)] }));

  const foundIndex = frame.status === 'found' ? frame.mid : -1;

  const cellClass = (i: number): string => {
    if (frame.status === 'found' && i === frame.mid) return 'border-emerald-500 bg-emerald-500/20 text-emerald-300';
    if (i === frame.mid) return 'border-amber-400 bg-amber-400/20 text-fg';
    if (i < frame.lo || i > frame.hi) return 'border-edge bg-surface text-muted/40';
    return 'border-edge bg-bg text-fg';
  };

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={newArray}>
          <Icon name="shuffle" size={16} /> New array
        </button>
        <button type="button" className={btn} onClick={pickTarget}>
          <Icon name="target" size={16} /> Random target
        </button>
        <label className="flex items-center gap-2 text-sm text-muted">
          Target
          <input
            type="number"
            value={target}
            onChange={(e) => setState((s) => ({ ...s, target: Number(e.target.value) }))}
            className="w-20 rounded border border-edge bg-bg px-2 py-1 text-fg"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {data.map((v, i) => (
          <div
            key={i}
            className={`flex h-12 w-10 flex-col items-center justify-center rounded border font-mono text-sm transition ${cellClass(i)}`}
          >
            <span>{v}</span>
            <span className="text-[10px] text-muted/60">{i}</span>
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

      <div className="mt-4 border-t border-edge pt-4 font-mono text-sm">
        <span className="text-muted">Searching for </span>
        <span className="text-accent">{target}</span>
        <span className="text-muted"> · range [{frame.lo}, {Math.max(frame.hi, 0)}]</span>
        {frame.mid >= 0 && <span className="text-muted"> · mid {frame.mid} = {data[frame.mid]}</span>}
        {frame.status === 'found' && <span className="ml-2 text-emerald-400">found at index {foundIndex}</span>}
        {frame.status === 'notfound' && <span className="ml-2 text-rose-400">not in array</span>}
      </div>
    </div>
  );
}
