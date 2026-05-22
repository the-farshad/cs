import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

/** Pull-based generator model. A generator does nothing until you call next().
 *  Each next() resumes the function body, runs to the next `yield`, hands back
 *  one value, and SUSPENDS — local state frozen until the next pull. */

// Generator being traced:
//   def squares(n):
//       total = 0
//       for i in range(n):
//           total += i * i
//           yield total          # running sum of squares
const N = 4;
const SRC = ['def squares(n):', '    total = 0', '    for i in range(n):', '        total += i * i', '        yield total'];

type State = 'created' | 'suspended' | 'running' | 'exhausted';

type Frame = {
  produced: number[]; // values pulled so far
  i: number;
  total: number;
  state: State;
  hotLine: number; // index into SRC, -1 = none
  note: string;
};

function buildFrames(): Frame[] {
  const out: number[] = [];
  const frames: Frame[] = [];
  frames.push({ produced: [], i: -1, total: 0, state: 'created', hotLine: -1, note: 'squares(4) returns a generator object — NO code has run yet (lazy)' });

  let total = 0;
  for (let i = 0; i < N; i++) {
    frames.push({ produced: [...out], i, total, state: 'running', hotLine: 2, note: `next() #${i + 1}: resume — for-loop takes i = ${i}` });
    total += i * i;
    frames.push({ produced: [...out], i, total, state: 'running', hotLine: 3, note: `compute total += ${i}*${i} -> total = ${total}` });
    out.push(total);
    frames.push({ produced: [...out], i, total, state: 'suspended', hotLine: 4, note: `yield ${total} — hand back the value and SUSPEND (state frozen)` });
  }
  frames.push({ produced: [...out], i: N - 1, total, state: 'exhausted', hotLine: -1, note: 'next() again: loop ends -> raises StopIteration. Generator is exhausted' });
  return frames;
}

const stateColor: Record<State, string> = {
  created: '#38bdf8',
  suspended: '#fbbf24',
  running: '#8b5cf6',
  exhausted: '#f43f5e',
};

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function PyGeneratorVisualizer() {
  const [eager, setEager] = useState(false);
  const frames = useMemo(buildFrames, []);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 3);
  const frame = frames[Math.min(index, frames.length - 1)];

  // "Eager" comparison: a list would compute all values up front.
  const eagerAll = useMemo(() => {
    const out: number[] = [];
    let t = 0;
    for (let i = 0; i < N; i++) {
      t += i * i;
      out.push(t);
    }
    return out;
  }, []);

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" className={`${btn} ${!eager ? 'border-accent text-accent' : ''}`} onClick={() => setEager(false)}>
          generator (lazy)
        </button>
        <button type="button" className={`${btn} ${eager ? 'border-accent text-accent' : ''}`} onClick={() => setEager(true)}>
          list (eager)
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Source + state */}
        <div className="rounded border border-edge p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-xs text-muted">generator body</span>
            <span className="rounded px-1.5 py-0.5 font-mono text-[11px]" style={{ color: stateColor[frame.state], border: `1px solid ${stateColor[frame.state]}` }}>
              {frame.state}
            </span>
          </div>
          <pre className="overflow-x-auto font-mono text-sm leading-relaxed">
            {SRC.map((line, i) => (
              <div key={i} className={`-mx-1 rounded px-1 ${!eager && frame.hotLine === i ? 'bg-accent/15 text-accent' : 'text-fg'}`}>
                {line}
              </div>
            ))}
          </pre>
          <div className="mt-2 flex gap-3 font-mono text-[11px] text-muted">
            <span>i = {frame.i < 0 ? '—' : frame.i}</span>
            <span>total = {frame.total}</span>
          </div>
        </div>

        {/* Produced values */}
        <div className="rounded border border-edge p-3">
          <div className="mb-2 font-mono text-xs text-muted">{eager ? 'list — all values computed at once' : 'values pulled on demand'}</div>
          {eager ? (
            <div className="flex flex-wrap gap-1.5">
              {eagerAll.map((v, idx) => (
                <div key={idx} className="flex h-10 min-w-10 items-center justify-center rounded border border-violet-500/60 px-2 font-mono text-sm text-violet-300">
                  {v}
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="flex min-h-12 flex-wrap items-center gap-1.5">
                {frame.produced.length === 0 && <span className="font-mono text-xs text-muted/50">nothing yet — call next() to pull</span>}
                {frame.produced.map((v, idx) => {
                  const justYielded = frame.state === 'suspended' && idx === frame.produced.length - 1;
                  return (
                    <div key={idx} className={`flex h-10 min-w-10 items-center justify-center rounded border px-2 font-mono text-sm transition ${justYielded ? 'border-amber-400 text-amber-300' : 'border-emerald-500/60 text-emerald-300'}`}>
                      {v}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center gap-2 font-mono text-[11px] text-muted">
                <Icon name="arrow-left" size={14} />
                next() pulls one value, then the generator sleeps
              </div>
            </>
          )}
          {eager && <div className="mt-3 font-mono text-[11px] text-muted">memory holds every element — even ones you never read</div>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={prev} disabled={index <= 0 || eager}>
          <Icon name="chevron-left" size={16} /> Step
        </button>
        <button
          type="button"
          onClick={() => (playing ? pause() : play())}
          disabled={eager}
          className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-40"
        >
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'next()'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= frames.length - 1 || eager}>
          next() <Icon name="chevron-right" size={16} />
        </button>
        <button type="button" className={btn} onClick={reset} disabled={index === 0 || eager}>
          <Icon name="rotate-ccw" size={16} /> Reset
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={1} max={12} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" disabled={eager} />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input type="range" min={0} max={Math.max(frames.length - 1, 0)} value={index} onChange={(e) => seek(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Timeline" disabled={eager} />
        <span className="shrink-0 font-mono text-xs text-muted">{index + 1}/{frames.length}</span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">
        {eager ? 'A list comprehension [..] builds everything immediately. Switch back to the generator to see lazy evaluation.' : frame.note}
      </div>
    </div>
  );
}
