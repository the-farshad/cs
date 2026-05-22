import { Fragment, useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

/** Animates CPython list operations and the cost behind them.
 *  append is amortized O(1); insert(0,x) and pop(0) are O(n) because every
 *  following element shifts. We surface the over-allocated capacity too. */

type Op =
  | { type: 'append'; value: number }
  | { type: 'insertFront'; value: number }
  | { type: 'popFront' };

type Frame = {
  items: number[];
  capacity: number;
  active?: number;
  marker?: 'write' | 'shift' | 'grow';
  note: string;
};

// CPython list growth: new_allocated = newsize + (newsize >> 3) + 6, rounded.
function grow(n: number): number {
  return n + (n >> 3) + (n < 9 ? 3 : 6);
}

function buildFrames(ops: Op[]): Frame[] {
  let items: number[] = [];
  let capacity = 0;
  const frames: Frame[] = [{ items: [], capacity: 0, note: 'empty list — size 0, capacity 0' }];
  const snap = (f: Partial<Frame>) => frames.push({ items: [...items], capacity, ...f } as Frame);

  for (const op of ops) {
    if (op.type === 'append') {
      if (items.length === capacity) {
        capacity = grow(items.length + 1);
        snap({ marker: 'grow', note: `full — reallocate buffer to capacity ${capacity}` });
      }
      items.push(op.value);
      snap({ active: items.length - 1, marker: 'write', note: `append ${op.value} into the open slot — amortized O(1)` });
    } else if (op.type === 'insertFront') {
      if (items.length === capacity) {
        capacity = grow(items.length + 1);
        snap({ marker: 'grow', note: `full — reallocate buffer to capacity ${capacity}` });
      }
      for (let i = items.length - 1; i >= 0; i--) {
        snap({ active: i, marker: 'shift', note: `shift element at index ${i} right to make room — this is the O(n) cost` });
      }
      items.unshift(op.value);
      snap({ active: 0, marker: 'write', note: `insert(0, ${op.value}) — O(n) because everything moved` });
    } else {
      if (items.length === 0) {
        snap({ note: 'pop from empty list would raise IndexError' });
        continue;
      }
      const removed = items[0];
      snap({ active: 0, marker: 'shift', note: `pop(0) removes ${removed} — now shift everyone left` });
      items.shift();
      snap({ note: `pop(0) done — O(n). For a queue use collections.deque instead` });
    }
  }
  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function PyListVisualizer() {
  const [ops, setOps] = useState<Op[]>(() => [4, 8, 15, 16].map((v) => ({ type: 'append', value: v }) as Op));
  const [input, setInput] = useState('');

  const frames = useMemo(() => buildFrames(ops), [ops]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 8, true);
  const frame = frames[Math.min(index, frames.length - 1)] ?? { items: [], capacity: 0, note: '' };

  const ok = () => input.trim() !== '' && !Number.isNaN(Number(input));
  const push = (op: Op) => {
    setOps((o) => [...o, op]);
    setInput('');
  };

  const slots = Array.from({ length: Math.max(frame.capacity, frame.items.length) }, (_, i) => i);

  const slotCls = (i: number) => {
    const filled = i < frame.items.length;
    if (frame.active === i) {
      if (frame.marker === 'write') return 'border-accent text-accent';
      if (frame.marker === 'shift') return 'border-amber-400 text-amber-300';
    }
    if (frame.marker === 'grow' && filled) return 'border-violet-500 text-violet-300';
    return filled ? 'border-edge text-fg' : 'border-dashed border-edge/50 text-muted/40';
  };

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ok() && push({ type: 'append', value: Number(input) })}
          placeholder="value"
          inputMode="numeric"
          className="w-20 rounded border border-edge bg-bg px-2 py-1 text-fg"
        />
        <button type="button" className={btn} onClick={() => ok() && push({ type: 'append', value: Number(input) })}>
          append
        </button>
        <button type="button" className={btn} onClick={() => ok() && push({ type: 'insertFront', value: Number(input) })}>
          insert(0, x)
        </button>
        <button type="button" className={btn} onClick={() => push({ type: 'popFront' })}>
          pop(0)
        </button>
        <button type="button" className={btn} onClick={() => setOps([])}>
          <Icon name="rotate-ccw" size={16} /> Clear
        </button>
      </div>

      <div className="flex min-h-20 flex-wrap items-center gap-1.5 py-2">
        {slots.length === 0 && <span className="font-mono text-xs text-muted">[]</span>}
        {slots.map((i) => (
          <Fragment key={i}>
            <div className="flex flex-col items-center gap-1">
              <div className={`flex h-12 min-w-12 items-center justify-center rounded border font-mono transition ${slotCls(i)}`}>
                {i < frame.items.length ? frame.items[i] : ''}
              </div>
              <span className="font-mono text-[10px] text-muted">{i}</span>
            </div>
          </Fragment>
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
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={1} max={20} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input type="range" min={0} max={Math.max(frames.length - 1, 0)} value={index} onChange={(e) => seek(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Timeline" />
        <span className="shrink-0 font-mono text-xs text-muted">{index + 1}/{frames.length}</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-edge pt-4 font-mono text-xs text-muted">
        <span>len {frame.items.length} · capacity {frame.capacity}</span>
        <span className="flex-1 text-right">{frame.note}</span>
      </div>
    </div>
  );
}
