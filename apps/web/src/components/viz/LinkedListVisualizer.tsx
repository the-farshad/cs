import { Fragment, useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

type Op =
  | { type: 'insertHead'; value: number }
  | { type: 'insertTail'; value: number }
  | { type: 'search'; value: number }
  | { type: 'delete'; value: number };

type LLFrame = { nodes: { id: number; value: number }[]; active?: number; marker?: string; note?: string };

function buildFrames(ops: Op[]): LLFrame[] {
  let list: { id: number; value: number }[] = [];
  let idc = 0;
  const frames: LLFrame[] = [{ nodes: [] }];
  const snap = (f: Partial<LLFrame>) => frames.push({ nodes: list.map((n) => ({ ...n })), ...f });

  for (const op of ops) {
    if (op.type === 'insertHead') {
      list.unshift({ id: idc++, value: op.value });
      snap({ active: 0, marker: 'insert', note: `insert ${op.value} at head — O(1)` });
    } else if (op.type === 'insertTail') {
      for (let i = 0; i < list.length; i++) snap({ active: i, note: 'walk to the tail' });
      list.push({ id: idc++, value: op.value });
      snap({ active: list.length - 1, marker: 'insert', note: `insert ${op.value} at tail — O(n)` });
    } else if (op.type === 'search') {
      let found = false;
      for (let i = 0; i < list.length; i++) {
        const hit = list[i].value === op.value;
        snap({ active: i, marker: hit ? 'found' : undefined, note: hit ? `found ${op.value}` : `compare ${list[i].value}` });
        if (hit) {
          found = true;
          break;
        }
      }
      if (!found) snap({ note: `${op.value} not found` });
    } else if (op.type === 'delete') {
      let idx = -1;
      for (let i = 0; i < list.length; i++) {
        const hit = list[i].value === op.value;
        snap({ active: i, marker: hit ? 'delete' : undefined, note: hit ? `unlink ${op.value}` : `compare ${list[i].value}` });
        if (hit) {
          idx = i;
          break;
        }
      }
      if (idx >= 0) {
        list.splice(idx, 1);
        snap({ note: `removed` });
      } else snap({ note: `${op.value} not found` });
    }
  }
  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function LinkedListVisualizer() {
  const [ops, setOps] = useState<Op[]>(() => [3, 7, 1].map((v) => ({ type: 'insertTail', value: v }) as Op));
  const [input, setInput] = useState('');

  const frames = useMemo(() => buildFrames(ops), [ops]);
  const { index, playing, fps, setFps, play, pause, next, prev, seek } = useStepper(frames.length, 12, true);
  const frame = frames[Math.min(index, frames.length - 1)] ?? { nodes: [] };

  const val = () => Number(input);
  const ok = () => input.trim() !== '' && !Number.isNaN(val());
  const push = (op: Op) => {
    setOps((o) => [...o, op]);
    setInput('');
  };

  const cls = (i: number) => {
    if (frame.active === i) {
      if (frame.marker === 'insert') return 'border-accent text-accent';
      if (frame.marker === 'delete') return 'border-rose-500 text-rose-300';
      if (frame.marker === 'found') return 'border-emerald-500 text-emerald-300';
      return 'border-amber-400 text-amber-300';
    }
    return 'border-edge text-fg';
  };

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="value"
          inputMode="numeric"
          className="w-20 rounded border border-edge bg-bg px-2 py-1 text-fg"
        />
        <button type="button" className={btn} onClick={() => ok() && push({ type: 'insertHead', value: val() })}>
          Insert head
        </button>
        <button type="button" className={btn} onClick={() => ok() && push({ type: 'insertTail', value: val() })}>
          Insert tail
        </button>
        <button type="button" className={btn} onClick={() => ok() && push({ type: 'search', value: val() })}>
          <Icon name="target" size={16} /> Search
        </button>
        <button type="button" className={btn} onClick={() => ok() && push({ type: 'delete', value: val() })}>
          Delete
        </button>
        <button type="button" className={btn} onClick={() => setOps([])}>
          <Icon name="rotate-ccw" size={16} /> Clear
        </button>
      </div>

      <div className="flex min-h-20 items-center gap-1.5 overflow-x-auto py-2">
        <span className="shrink-0 font-mono text-xs text-muted">head</span>
        <Icon name="arrow-right" size={16} className="shrink-0 text-muted" />
        {frame.nodes.length === 0 && <span className="font-mono text-xs text-muted">null</span>}
        {frame.nodes.map((n, i) => (
          <Fragment key={n.id}>
            <div className={`flex h-12 min-w-12 shrink-0 items-center justify-center rounded border px-2 font-mono ${cls(i)}`}>{n.value}</div>
            <Icon name="arrow-right" size={16} className="shrink-0 text-muted" />
          </Fragment>
        ))}
        {frame.nodes.length > 0 && <span className="shrink-0 font-mono text-xs text-muted">null</span>}
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

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">{frame.note ?? `length ${frame.nodes.length}`}</div>
    </div>
  );
}
