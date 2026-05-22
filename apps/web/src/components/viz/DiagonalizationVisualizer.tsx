import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

// Diagonalization: suppose every program could be listed M0, M1, M2, ...
// Row i, column j is M_i(j): does program i accept input j? (1 = accept, 0 = reject).
// We build a NEW program D where D(i) = NOT M_i(i) — flip the diagonal.
// D differs from every M_i at input i, so D is not in the list. Contradiction.
const N = 6;

// A fixed pseudo-random but deterministic table so the picture is stable.
function tableCell(i: number, j: number): 0 | 1 {
  const h = (i * 73856093) ^ (j * 19349663) ^ ((i + 1) * (j + 3) * 83492791);
  return (((h >>> 5) & 1) as 0 | 1);
}

type Phase = 'scan-diag' | 'flip' | 'compare' | 'done';
type Frame = {
  phase: Phase;
  k: number; // diagonal index currently considered (-1 none)
  built: (0 | 1 | null)[]; // D's row as we construct it
  compareRow: number; // which M_i we are contrasting with D (-1 none)
  note: string;
};

function buildFrames(): Frame[] {
  const frames: Frame[] = [];
  const built: (0 | 1 | null)[] = new Array(N).fill(null);
  frames.push({
    phase: 'scan-diag',
    k: -1,
    built: [...built],
    compareRow: -1,
    note: 'Assume every program is listed: M0, M1, M2, … Cell (i, j) = does Mi accept input j?',
  });
  for (let k = 0; k < N; k++) {
    const d = tableCell(k, k);
    frames.push({
      phase: 'scan-diag',
      k,
      built: [...built],
      compareRow: -1,
      note: `Look at the diagonal cell M${k}(${k}) = ${d}.`,
    });
    built[k] = (d === 1 ? 0 : 1) as 0 | 1;
    frames.push({
      phase: 'flip',
      k,
      built: [...built],
      compareRow: -1,
      note: `Define D(${k}) = NOT M${k}(${k}) = ${built[k]}. D disagrees with M${k} on input ${k}.`,
    });
  }
  for (let k = 0; k < N; k++) {
    frames.push({
      phase: 'compare',
      k,
      built: [...built],
      compareRow: k,
      note: `D(${k}) = ${built[k]} ≠ M${k}(${k}) = ${tableCell(k, k)}, so D ≠ M${k}.`,
    });
  }
  frames.push({
    phase: 'done',
    k: -1,
    built: [...built],
    compareRow: -1,
    note: 'D differs from every Mi, so D is missing from the list — but the list was supposed to contain all programs. Contradiction.',
  });
  return frames;
}

export default function DiagonalizationVisualizer() {
  const frames = useMemo(() => buildFrames(), []);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 2);
  const frame = frames[Math.min(index, frames.length - 1)] ?? frames[0];
  const [showWhy, setShowWhy] = useState(false);

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 text-sm text-muted">
        <span className="text-fg">Diagonalization.</span> Imagine listing every program in a table: row{' '}
        <span className="font-mono">i</span> is program <span className="font-mono">Mi</span>, column{' '}
        <span className="font-mono">j</span> is input <span className="font-mono">j</span>, and the cell is whether{' '}
        <span className="font-mono">Mi</span> accepts <span className="font-mono">j</span> (1) or not (0). We build a row
        that cannot be anywhere in the table.
      </div>

      <div className="overflow-x-auto">
        <table className="border-collapse font-mono text-sm">
          <thead>
            <tr>
              <th className="px-2 py-1" />
              {Array.from({ length: N }, (_, j) => (
                <th key={j} className="w-10 px-1 py-1 text-center text-xs text-muted">
                  in {j}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: N }, (_, i) => {
              const rowCompared = frame.compareRow === i;
              return (
                <tr key={i}>
                  <td className={`pr-2 text-right text-xs ${rowCompared ? 'text-accent' : 'text-muted'}`}>M{i}</td>
                  {Array.from({ length: N }, (_, j) => {
                    const v = tableCell(i, j);
                    const onDiag = i === j;
                    const scanned = onDiag && frame.phase === 'scan-diag' && frame.k === i;
                    const flipped = onDiag && (frame.phase === 'flip' ? frame.k >= i : frame.phase !== 'scan-diag');
                    const comparing = onDiag && rowCompared;
                    let style: React.CSSProperties = {};
                    let cls = 'text-fg';
                    if (onDiag) {
                      cls = 'font-bold text-fg';
                      style = { outline: '2px solid var(--accent)', outlineOffset: -2 };
                    }
                    if (scanned || comparing) {
                      style = { ...style, background: 'color-mix(in oklab, var(--accent) 22%, var(--bg))' };
                    } else if (flipped) {
                      style = { ...style, background: 'color-mix(in oklab, #8b5cf6 14%, var(--bg))' };
                    }
                    return (
                      <td
                        key={j}
                        className={`h-9 w-10 border border-edge text-center ${cls}`}
                        style={style}
                      >
                        {v}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* Constructed row D */}
            <tr>
              <td className="pr-2 pt-2 text-right text-xs font-bold" style={{ color: '#8b5cf6' }}>
                D
              </td>
              {Array.from({ length: N }, (_, j) => {
                const v = frame.built[j];
                const hot = frame.phase === 'flip' && frame.k === j;
                const comparing = frame.compareRow === j;
                return (
                  <td
                    key={j}
                    className="h-9 w-10 border text-center font-bold"
                    style={{
                      marginTop: 8,
                      borderColor: '#8b5cf6',
                      color: v === null ? 'var(--muted)' : '#8b5cf6',
                      background:
                        hot || comparing ? 'color-mix(in oklab, #8b5cf6 22%, var(--bg))' : 'transparent',
                    }}
                  >
                    {v === null ? '·' : v}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted">
        Diagonal cells are boxed. Row <span style={{ color: '#8b5cf6' }}>D</span> is the flip of the diagonal:{' '}
        <span className="font-mono">D(i) = NOT Mi(i)</span>.
      </p>

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
          <input type="range" min={1} max={8} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
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

      <div className="mt-4 border-t border-edge pt-4 text-xs">
        <span className="text-muted" style={frame.phase === 'done' ? { color: '#f43f5e' } : undefined}>
          {frame.note}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setShowWhy((s) => !s)}
        className="mt-3 text-xs text-accent underline-offset-2 hover:underline"
      >
        {showWhy ? 'Hide' : 'How this implies the halting problem is undecidable'}
      </button>
      {showWhy && (
        <p className="mt-2 text-xs text-muted">
          The same flip works on a hypothetical halting-decider <span className="font-mono">H</span>. Build{' '}
          <span className="font-mono">D</span> that asks <span className="font-mono">H</span> whether{' '}
          <span className="font-mono">D</span> halts on its own description, then does the opposite — loop if{' '}
          <span className="font-mono">H</span> says halt, halt if <span className="font-mono">H</span> says loop. Either
          answer makes <span className="font-mono">H</span> wrong, so no such <span className="font-mono">H</span> can
          exist.
        </p>
      )}
    </div>
  );
}
