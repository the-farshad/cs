import { useMemo } from 'react';
import { valueIteration, type Cell, type GridSpec } from './gridworld';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const ROWS = 4;
const COLS = 4;
const LAYOUT: Cell[] = [
  'empty', 'empty', 'empty', 'goal',
  'empty', 'wall', 'empty', 'pit',
  'empty', 'empty', 'empty', 'empty',
  'empty', 'empty', 'empty', 'empty',
];
const SPEC: GridSpec = { rows: ROWS, cols: COLS, cells: LAYOUT, gamma: 0.9, step: -0.04, goal: 1, pit: -1 };
const ARROWS = ['arrow-up', 'arrow-down', 'arrow-left', 'arrow-right'];

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function GridworldRL() {
  const frames = useMemo(() => valueIteration(SPEC), []);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 3);
  const frame = frames[Math.min(index, frames.length - 1)];

  const cellBg = (i: number): string => {
    if (LAYOUT[i] === 'wall') return 'var(--border)';
    if (LAYOUT[i] === 'goal') return 'rgba(16,185,129,0.85)';
    if (LAYOUT[i] === 'pit') return 'rgba(244,63,94,0.85)';
    const v = frame.values[i];
    const pct = Math.min(Math.abs(v), 1) * 55;
    return v >= 0 ? `color-mix(in oklab, #10b981 ${pct}%, var(--surface))` : `color-mix(in oklab, #f43f5e ${pct}%, var(--surface))`;
  };

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mx-auto grid max-w-sm gap-1.5" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
        {LAYOUT.map((cell, i) => (
          <div key={i} className="relative flex aspect-square flex-col items-center justify-center rounded border border-edge text-fg" style={{ background: cellBg(i) }}>
            {cell === 'goal' ? (
              <span className="font-mono text-sm font-semibold text-white">+1</span>
            ) : cell === 'pit' ? (
              <span className="font-mono text-sm font-semibold text-white">−1</span>
            ) : cell === 'wall' ? null : (
              <>
                <span className="font-mono text-xs">{frame.values[i].toFixed(2)}</span>
                {frame.policy[i] >= 0 && <Icon name={ARROWS[frame.policy[i]]} size={16} className="mt-0.5 text-accent" />}
              </>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={prev} disabled={index <= 0}>
          <Icon name="chevron-left" size={16} /> Step
        </button>
        <button type="button" onClick={() => (playing ? pause() : play())} className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90">
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Iterate'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= frames.length - 1}>
          Step <Icon name="chevron-right" size={16} />
        </button>
        <button type="button" className={btn} onClick={reset} disabled={index === 0}>
          <Icon name="rotate-ccw" size={16} /> Reset
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={1} max={12} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input type="range" min={0} max={Math.max(frames.length - 1, 0)} value={index} onChange={(e) => seek(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Timeline" />
        <span className="shrink-0 font-mono text-xs text-muted">iteration {index}/{frames.length - 1}</span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">
        Each cell shows its value V(s); the arrow is the greedy policy. Values spread out from the goal as iteration proceeds.
      </div>
    </div>
  );
}
