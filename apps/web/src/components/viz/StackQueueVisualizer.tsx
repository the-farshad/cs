import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

type Mode = 'stack' | 'queue';
type Op = { type: 'push'; value: number } | { type: 'pop' };
type SQFrame = { arr: number[]; active?: number; marker?: string; note?: string };

function buildFrames(ops: Op[], mode: Mode): SQFrame[] {
  const arr: number[] = [];
  const frames: SQFrame[] = [{ arr: [] }];
  const snap = (f: Partial<SQFrame>) => frames.push({ arr: [...arr], ...f });
  for (const op of ops) {
    if (op.type === 'push') {
      arr.push(op.value);
      snap({ active: arr.length - 1, marker: 'push', note: `${mode === 'stack' ? 'push' : 'enqueue'} ${op.value}` });
    } else if (arr.length) {
      const removeIdx = mode === 'stack' ? arr.length - 1 : 0;
      const v = arr[removeIdx];
      snap({ active: removeIdx, marker: 'pop', note: `${mode === 'stack' ? 'pop' : 'dequeue'} ${v}` });
      arr.splice(removeIdx, 1);
      snap({ note: `removed ${v}` });
    } else {
      snap({ note: 'empty' });
    }
  }
  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function StackQueueVisualizer() {
  const [mode, setMode] = useState<Mode>('stack');
  const [ops, setOps] = useState<Op[]>(() => [5, 8, 2].map((v) => ({ type: 'push', value: v }) as Op));
  const [input, setInput] = useState('');

  const frames = useMemo(() => buildFrames(ops, mode), [ops, mode]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 12, true);
  const frame = frames[Math.min(index, frames.length - 1)] ?? { arr: [] };

  const cls = (i: number) => {
    if (frame.active === i) {
      if (frame.marker === 'push') return 'border-accent text-accent';
      if (frame.marker === 'pop') return 'border-rose-500 text-rose-300';
      return 'border-amber-400 text-amber-300';
    }
    return 'border-edge text-fg';
  };

  const pushVal = () => {
    const v = Number(input);
    if (input.trim() !== '' && !Number.isNaN(v)) {
      setOps((o) => [...o, { type: 'push', value: v }]);
      setInput('');
    }
  };

  // Stack: index 0 at the bottom, top at the top. Queue: front (0) at the left.
  const items = frame.arr.map((v, i) => ({ v, i }));
  const stackItems = [...items].reverse();

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded border border-edge">
          {(['stack', 'queue'] as Mode[]).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m} className={`px-3 py-1 text-sm capitalize transition ${mode === m ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}>
              {m} ({m === 'stack' ? 'LIFO' : 'FIFO'})
            </button>
          ))}
        </div>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && pushVal()} placeholder="value" inputMode="numeric" className="w-20 rounded border border-edge bg-bg px-2 py-1 text-fg" />
        <button type="button" className={btn} onClick={pushVal}>
          {mode === 'stack' ? 'Push' : 'Enqueue'}
        </button>
        <button type="button" className={btn} onClick={() => setOps((o) => [...o, { type: 'pop' }])}>
          {mode === 'stack' ? 'Pop' : 'Dequeue'}
        </button>
        <button type="button" className={btn} onClick={() => setOps([])}>
          <Icon name="rotate-ccw" size={16} /> Clear
        </button>
      </div>

      <div className="flex min-h-44 items-center justify-center rounded-lg border border-edge bg-bg/40 p-4">
        {frame.arr.length === 0 ? (
          <span className="text-muted">empty</span>
        ) : mode === 'stack' ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-center font-mono text-[10px] text-muted">top</span>
            {stackItems.map(({ v, i }) => (
              <div key={i} className={`flex h-10 w-24 items-center justify-center rounded border font-mono ${cls(i)}`}>{v}</div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-end gap-1.5">
              {items.map(({ v, i }) => (
                <div key={i} className={`flex h-10 w-12 items-center justify-center rounded border font-mono ${cls(i)}`}>{v}</div>
              ))}
            </div>
            <div className="flex w-full justify-between font-mono text-[10px] text-muted">
              <span>front</span>
              <span>back</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={prev} disabled={index <= 0}>
          <Icon name="chevron-left" size={16} /> Step
        </button>
        <button type="button" onClick={() => (playing ? pause() : play())} className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90">
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

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">{frame.note ?? `size ${frame.arr.length}`}</div>
    </div>
  );
}
