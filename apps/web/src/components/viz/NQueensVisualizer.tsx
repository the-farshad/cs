import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

type Action = 'try' | 'place' | 'reject' | 'remove' | 'solved';

type Frame = {
  queens: number[]; // queens[row] = col, or -1 if empty
  row: number; // row currently being worked on
  col: number; // column under consideration (-1 when none)
  action: Action;
  note: string;
};

/** Solve N-Queens with backtracking, recording every try / place / reject / remove. */
function solveFrames(n: number): Frame[] {
  const queens = new Array(n).fill(-1);
  const frames: Frame[] = [];

  const safe = (row: number, col: number): boolean => {
    for (let r = 0; r < row; r++) {
      const c = queens[r];
      if (c === col) return false;
      if (Math.abs(c - col) === Math.abs(r - row)) return false;
    }
    return true;
  };

  const place = (row: number): boolean => {
    if (row === n) {
      frames.push({ queens: [...queens], row, col: -1, action: 'solved', note: `solution found — all ${n} queens safe` });
      return true;
    }
    for (let col = 0; col < n; col++) {
      frames.push({ queens: [...queens], row, col, action: 'try', note: `row ${row}: try column ${col}` });
      if (safe(row, col)) {
        queens[row] = col;
        frames.push({ queens: [...queens], row, col, action: 'place', note: `place queen at (${row}, ${col})` });
        if (place(row + 1)) return true;
        queens[row] = -1;
        frames.push({ queens: [...queens], row, col, action: 'remove', note: `dead end below — backtrack, remove (${row}, ${col})` });
      } else {
        frames.push({ queens: [...queens], row, col, action: 'reject', note: `(${row}, ${col}) attacked — reject` });
      }
    }
    return false;
  };

  place(0);
  return frames;
}

const ACCENT = 'var(--accent)';

export default function NQueensVisualizer() {
  const [n, setN] = useState(6);
  const frames = useMemo(() => solveFrames(n), [n]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 6);
  const frame = frames[Math.min(index, frames.length - 1)] ?? { queens: new Array(n).fill(-1), row: 0, col: -1, action: 'try' as Action, note: '' };

  const placed = frame.queens.filter((c) => c >= 0).length;

  const cellState = (r: number, c: number): { bg: string; queen: boolean; mark: '' | 'try' | 'reject' } => {
    const queen = frame.queens[r] === c;
    let mark: '' | 'try' | 'reject' = '';
    if (frame.row === r && frame.col === c) {
      if (frame.action === 'try' || frame.action === 'place' || frame.action === 'remove') mark = 'try';
      if (frame.action === 'reject') mark = 'reject';
    }
    const dark = (r + c) % 2 === 1;
    return { bg: dark ? 'var(--surface)' : 'var(--bg)', queen, mark };
  };

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          Board N {n}
          <input type="range" min={4} max={8} value={n} onChange={(e) => setN(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
        <span className="text-sm text-muted">Place N queens so none attack another.</span>
      </div>

      <div className="mx-auto" style={{ maxWidth: 360 }}>
        <div className="grid overflow-hidden rounded-md border-2 border-edge" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
          {Array.from({ length: n * n }, (_, idx) => {
            const r = Math.floor(idx / n);
            const c = idx % n;
            const { bg, queen, mark } = cellState(r, c);
            const ring =
              mark === 'try'
                ? 'inset 0 0 0 3px #fbbf24'
                : mark === 'reject'
                  ? 'inset 0 0 0 3px #f43f5e'
                  : 'none';
            return (
              <div
                key={idx}
                className="relative flex aspect-square items-center justify-center"
                style={{ background: bg, boxShadow: ring }}
              >
                {queen && (
                  <svg viewBox="0 0 24 24" width="62%" height="62%" aria-label="queen">
                    <path
                      d="M5 16h14l-1.2 4H6.2L5 16zm0-1 1.6-7.5L9.5 11 12 4l2.5 7 2.9-3.5L19 15H5z"
                      style={{
                        fill: frame.action === 'solved' ? '#10b981' : ACCENT,
                        stroke: frame.action === 'solved' ? '#10b981' : ACCENT,
                      }}
                      strokeWidth={1}
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
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
          <input type="range" min={1} max={30} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
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
        <span className="font-mono">queens placed {placed}/{n}</span>
      </div>
    </div>
  );
}
