import { useMemo, useState } from 'react';
import { SORTS, type SortKey } from './sortingAlgorithms';
import type { SortFrame } from './types';
import { useStepper } from './useStepper';

function randomArray(n: number): number[] {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 96) + 4);
}

const LEGEND: { key: string; label: string; cls: string }[] = [
  { key: 'compare', label: 'compare', cls: 'bg-amber-400' },
  { key: 'swap', label: 'write / swap', cls: 'bg-rose-500' },
  { key: 'pivot', label: 'pivot', cls: 'bg-violet-500' },
  { key: 'sorted', label: 'sorted', cls: 'bg-emerald-500' },
];

export default function SortVisualizer() {
  const [algo, setAlgo] = useState<SortKey>('quick');
  const [size, setSize] = useState(28);
  const [data, setData] = useState<number[]>(() => randomArray(28));

  const frames = useMemo<SortFrame[]>(() => Array.from(SORTS[algo].gen(data)), [algo, data]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length);

  const frame = frames[Math.min(index, frames.length - 1)] ?? { array: data };
  const meta = SORTS[algo];
  const max = Math.max(...frame.array, 1);

  const shuffle = () => setData(randomArray(size));
  const onSize = (n: number) => {
    setSize(n);
    setData(randomArray(n));
  };

  const colorFor = (i: number): string => {
    if (frame.sorted?.includes(i)) return 'bg-emerald-500';
    if (frame.swap?.includes(i)) return 'bg-rose-500';
    if (frame.pivot === i) return 'bg-violet-500';
    if (frame.compare?.includes(i)) return 'bg-amber-400';
    return 'bg-[var(--viz-bar)]';
  };

  const btn =
    'rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          Algorithm
          <select
            value={algo}
            onChange={(e) => setAlgo(e.target.value as SortKey)}
            className="rounded border border-edge bg-bg px-2 py-1 text-fg"
          >
            {(Object.keys(SORTS) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORTS[k].label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-muted">
          Size {size}
          <input
            type="range"
            min={6}
            max={60}
            value={size}
            onChange={(e) => onSize(Number(e.target.value))}
            className="accent-[var(--accent)]"
          />
        </label>

        <button type="button" className={btn} onClick={shuffle}>
          Shuffle
        </button>
      </div>

      {/* Bars */}
      <div className="flex h-64 items-end gap-[2px]" role="img" aria-label={`${meta.label} visualization`}>
        {frame.array.map((v, i) => (
          <div
            key={i}
            className={`flex-1 rounded-t-sm transition-[height] duration-100 ${colorFor(i)}`}
            style={{ height: `${(v / max) * 100}%` }}
          />
        ))}
      </div>

      {/* Transport */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={prev} disabled={index <= 0} aria-label="Step back">
          ‹ Step
        </button>
        <button
          type="button"
          className="rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90"
          onClick={() => (playing ? pause() : play())}
        >
          {playing ? '❚❚ Pause' : '▶ Play'}
        </button>
        <button
          type="button"
          className={btn}
          onClick={next}
          disabled={index >= frames.length - 1}
          aria-label="Step forward"
        >
          Step ›
        </button>
        <button type="button" className={btn} onClick={reset} disabled={index === 0}>
          Reset
        </button>

        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input
            type="range"
            min={1}
            max={60}
            value={fps}
            onChange={(e) => setFps(Number(e.target.value))}
            className="accent-[var(--accent)]"
          />
        </label>
      </div>

      {/* Scrubber */}
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

      {/* Legend + complexity */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-edge pt-4 text-xs text-muted">
        <div className="flex flex-wrap items-center gap-3">
          {LEGEND.map((l) => (
            <span key={l.key} className="flex items-center gap-1.5">
              <span className={`inline-block h-3 w-3 rounded-sm ${l.cls}`} />
              {l.label}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 font-mono">
          <span>best {meta.best}</span>
          <span>avg {meta.average}</span>
          <span>worst {meta.worst}</span>
          <span>space {meta.space}</span>
          <span>{meta.stable ? 'stable' : 'unstable'}</span>
        </div>
      </div>
    </div>
  );
}
