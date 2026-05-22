import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

/** Shows a list comprehension and its equivalent for-loop in lockstep.
 *  For each input element we evaluate the filter, then (if kept) the map
 *  expression, appending to the growing output. */

const INPUT = [1, 2, 3, 4, 5, 6, 7, 8];

type Frame = {
  i: number; // index into INPUT, -1 before start / done after
  phase: 'filter-fail' | 'filter-pass' | 'append' | 'done' | 'start';
  output: number[];
  loopLine: number; // which line of the for-loop equivalent is hot
  note: string;
};

// Comprehension:  [n * n for n in nums if n % 2 == 0]
function keep(n: number) {
  return n % 2 === 0;
}
function mapExpr(n: number) {
  return n * n;
}

function buildFrames(): Frame[] {
  const out: number[] = [];
  const frames: Frame[] = [{ i: -1, phase: 'start', output: [], loopLine: 0, note: 'start with an empty result list' }];

  INPUT.forEach((n, idx) => {
    if (!keep(n)) {
      frames.push({ i: idx, phase: 'filter-fail', output: [...out], loopLine: 1, note: `n = ${n}: ${n} % 2 == 0 is False — skip (the if filters it out)` });
      return;
    }
    frames.push({ i: idx, phase: 'filter-pass', output: [...out], loopLine: 1, note: `n = ${n}: ${n} % 2 == 0 is True — keep it` });
    const v = mapExpr(n);
    out.push(v);
    frames.push({ i: idx, phase: 'append', output: [...out], loopLine: 2, note: `evaluate n * n = ${v}, append to result` });
  });

  frames.push({ i: -1, phase: 'done', output: [...out], loopLine: 3, note: `done — result is [${out.join(', ')}]` });
  return frames;
}

const FORLOOP = ['result = []', 'for n in nums:', '    if n % 2 == 0:', '        result.append(n * n)'];
const LOOP_HOT: Record<number, number[]> = { 0: [0], 1: [1, 2], 2: [3], 3: [] };

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function PyComprehensionVisualizer() {
  const [mode, setMode] = useState<'both' | 'comp' | 'loop'>('both');
  const frames = useMemo(buildFrames, []);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 3);
  const frame = frames[Math.min(index, frames.length - 1)];

  const hotLines = LOOP_HOT[frame.loopLine] ?? [];

  const inputCls = (idx: number) => {
    if (frame.i !== idx) return 'border-edge text-muted/60';
    if (frame.phase === 'filter-fail') return 'border-rose-500 text-rose-300';
    if (frame.phase === 'filter-pass') return 'border-amber-400 text-amber-300';
    if (frame.phase === 'append') return 'border-accent text-accent';
    return 'border-edge text-fg';
  };

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">view:</span>
        {(['both', 'comp', 'loop'] as const).map((m) => (
          <button key={m} type="button" className={`${btn} ${mode === m ? 'border-accent text-accent' : ''}`} onClick={() => setMode(m)}>
            {m === 'both' ? 'both' : m === 'comp' ? 'comprehension' : 'for-loop'}
          </button>
        ))}
      </div>

      <div className={`grid gap-4 ${mode === 'both' ? 'sm:grid-cols-2' : ''}`}>
        {mode !== 'loop' && (
          <div className="rounded border border-edge p-3">
            <div className="mb-2 font-mono text-xs text-muted">comprehension</div>
            <pre className="overflow-x-auto font-mono text-sm leading-relaxed">
              <span className="text-fg">result = [</span>
              <span className={frame.phase === 'append' ? 'rounded bg-accent/15 text-accent' : 'text-[var(--accent)]'}>n * n</span>
              <span className="text-fg"> for </span>
              <span className={frame.i >= 0 ? 'rounded bg-amber-400/15 text-amber-300' : 'text-fg'}>n</span>
              <span className="text-fg"> in nums </span>
              <span className={frame.phase === 'filter-fail' || frame.phase === 'filter-pass' ? 'rounded bg-amber-400/15 text-amber-300' : 'text-fg'}>if n % 2 == 0</span>
              <span className="text-fg">]</span>
            </pre>
          </div>
        )}

        {mode !== 'comp' && (
          <div className="rounded border border-edge p-3">
            <div className="mb-2 font-mono text-xs text-muted">equivalent for-loop</div>
            <pre className="overflow-x-auto font-mono text-sm leading-relaxed">
              {FORLOOP.map((line, i) => (
                <div key={i} className={`-mx-1 rounded px-1 ${hotLines.includes(i) ? 'bg-accent/15 text-accent' : 'text-fg'}`}>
                  {line || ' '}
                </div>
              ))}
            </pre>
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="mb-2 font-mono text-xs text-muted">nums (input)</div>
        <div className="flex flex-wrap gap-1.5">
          {INPUT.map((v, idx) => (
            <div key={idx} className={`flex h-9 min-w-9 items-center justify-center rounded border px-1.5 font-mono text-sm transition ${inputCls(idx)}`}>
              {v}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-2 font-mono text-xs text-muted">result (output)</div>
        <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded border border-edge bg-bg p-2">
          {frame.output.length === 0 && <span className="font-mono text-xs text-muted/50">[]</span>}
          {frame.output.map((v, idx) => {
            const justAdded = frame.phase === 'append' && idx === frame.output.length - 1;
            return (
              <div key={idx} className={`flex h-9 min-w-9 items-center justify-center rounded border px-1.5 font-mono text-sm ${justAdded ? 'border-accent text-accent' : 'border-emerald-500/60 text-emerald-300'}`}>
                {v}
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
          <input type="range" min={1} max={12} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input type="range" min={0} max={Math.max(frames.length - 1, 0)} value={index} onChange={(e) => seek(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Timeline" />
        <span className="shrink-0 font-mono text-xs text-muted">{index + 1}/{frames.length}</span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">{frame.note}</div>
    </div>
  );
}
