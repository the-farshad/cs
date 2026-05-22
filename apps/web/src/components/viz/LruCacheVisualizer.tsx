import { Fragment, useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// LRU cache = hash map (key -> node) + doubly linked list ordered by recency.
// Front = most-recently used, back = least-recently used (evicted first).

const CAP = 3;

type Op =
  | { type: 'get'; key: string }
  | { type: 'put'; key: string; value: number };

type Frame = {
  // order[0] is most-recent (front), last is least-recent (back)
  order: { key: string; value: number }[];
  active?: string; // key currently touched
  marker?: 'hit' | 'miss' | 'put' | 'move' | 'evict';
  evicting?: string;
  note?: string;
};

function buildFrames(ops: Op[]): Frame[] {
  let order: { key: string; value: number }[] = [];
  const frames: Frame[] = [{ order: [] }];
  const snap = (f: Partial<Frame>) => frames.push({ order: order.map((n) => ({ ...n })), ...f });

  for (const op of ops) {
    const idx = order.findIndex((n) => n.key === op.key);
    if (op.type === 'get') {
      if (idx === -1) {
        snap({ active: op.key, marker: 'miss', note: `get(${op.key}) → miss (key not in cache)` });
        continue;
      }
      snap({ active: op.key, marker: 'hit', note: `get(${op.key}) → hit, value ${order[idx].value}` });
      const [node] = order.splice(idx, 1);
      order.unshift(node);
      snap({ active: op.key, marker: 'move', note: `move ${op.key} to front (most-recent)` });
    } else {
      if (idx !== -1) {
        order[idx].value = op.value;
        snap({ active: op.key, marker: 'hit', note: `put(${op.key}) exists → update value to ${op.value}` });
        const [node] = order.splice(idx, 1);
        order.unshift(node);
        snap({ active: op.key, marker: 'move', note: `move ${op.key} to front` });
        continue;
      }
      // new key
      order.unshift({ key: op.key, value: op.value });
      snap({ active: op.key, marker: 'put', note: `put(${op.key}) new → insert at front` });
      if (order.length > CAP) {
        const victim = order[order.length - 1];
        snap({ evicting: victim.key, marker: 'evict', note: `capacity ${CAP} exceeded → evict LRU (${victim.key}) from back` });
        order.pop();
        snap({ note: `evicted ${victim.key}` });
      }
    }
  }
  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const DEFAULT_OPS: Op[] = [
  { type: 'put', key: 'A', value: 1 },
  { type: 'put', key: 'B', value: 2 },
  { type: 'put', key: 'C', value: 3 },
  { type: 'get', key: 'A' },
  { type: 'put', key: 'D', value: 4 },
];

export default function LruCacheVisualizer() {
  const [ops, setOps] = useState<Op[]>(DEFAULT_OPS);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');

  const frames = useMemo(() => buildFrames(ops), [ops]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length);
  const frame = frames[Math.min(index, frames.length - 1)] ?? { order: [] };

  const k = () => key.trim().toUpperCase();
  const doGet = () => {
    if (k()) {
      setOps((o) => [...o, { type: 'get', key: k() }]);
      setKey('');
    }
  };
  const doPut = () => {
    const v = Number(value);
    if (k() && value.trim() !== '' && !Number.isNaN(v)) {
      setOps((o) => [...o, { type: 'put', key: k(), value: v }]);
      setKey('');
      setValue('');
    }
  };

  const nodeCls = (key: string) => {
    if (frame.evicting === key) return 'border-rose-500 text-rose-300 opacity-70';
    if (frame.active === key) {
      if (frame.marker === 'hit') return 'border-emerald-500 text-emerald-300';
      if (frame.marker === 'miss') return 'border-rose-500 text-rose-300';
      if (frame.marker === 'put') return 'border-accent text-accent';
      if (frame.marker === 'move') return 'border-violet-500 text-violet-300';
    }
    return 'border-edge text-fg';
  };

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="key"
          maxLength={2}
          className="w-16 rounded border border-edge bg-bg px-2 py-1 text-fg"
        />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doPut()}
          placeholder="value"
          inputMode="numeric"
          className="w-20 rounded border border-edge bg-bg px-2 py-1 text-fg"
        />
        <button type="button" className={btn} onClick={doPut}>
          Put
        </button>
        <button type="button" className={btn} onClick={doGet}>
          <Icon name="target" size={16} /> Get
        </button>
        <button type="button" className={btn} onClick={() => setOps([])}>
          <Icon name="rotate-ccw" size={16} /> Clear
        </button>
        <span className="ml-auto font-mono text-xs text-muted">capacity {CAP}</span>
      </div>

      <div className="flex min-h-24 items-center gap-1.5 overflow-x-auto py-2">
        <span className="shrink-0 font-mono text-[10px] uppercase text-accent">most-recent</span>
        <Icon name="arrow-right" size={16} className="shrink-0 text-muted" />
        {frame.order.length === 0 && <span className="font-mono text-xs text-muted">empty</span>}
        {frame.order.map((n, i) => (
          <Fragment key={n.key}>
            <div className={`flex h-14 min-w-16 shrink-0 flex-col items-center justify-center rounded border px-2 font-mono transition ${nodeCls(n.key)}`}>
              <span className="text-sm font-semibold">{n.key}</span>
              <span className="text-[11px] text-muted">val {n.value}</span>
            </div>
            {i < frame.order.length - 1 && <Icon name="arrow-right" size={14} className="shrink-0 text-muted" />}
          </Fragment>
        ))}
        {frame.order.length > 0 && (
          <>
            <Icon name="arrow-right" size={16} className="shrink-0 text-muted opacity-40" />
            <span className="shrink-0 font-mono text-[10px] uppercase text-rose-300">least-recent</span>
          </>
        )}
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
          <input type="range" min={1} max={12} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input type="range" min={0} max={Math.max(frames.length - 1, 0)} value={index} onChange={(e) => seek(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Timeline" />
        <span className="shrink-0 font-mono text-xs text-muted">{index + 1}/{frames.length}</span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">{frame.note ?? `${frame.order.length}/${CAP} entries`}</div>
    </div>
  );
}
