import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const SIZE = 8;
type Op = { type: 'insert'; value: number } | { type: 'search'; value: number };
type HFrame = { buckets: number[][]; activeBucket?: number; activeItem?: [number, number]; marker?: string; note?: string };

function buildFrames(ops: Op[]): HFrame[] {
  const buckets: number[][] = Array.from({ length: SIZE }, () => []);
  const frames: HFrame[] = [{ buckets: buckets.map((b) => [...b]) }];
  const snap = (f: Partial<HFrame>) => frames.push({ buckets: buckets.map((b) => [...b]), ...f });

  for (const op of ops) {
    const hash = ((op.value % SIZE) + SIZE) % SIZE;
    if (op.type === 'insert') {
      snap({ activeBucket: hash, note: `hash(${op.value}) = ${op.value} % ${SIZE} = ${hash}` });
      if (buckets[hash].length > 0) snap({ activeBucket: hash, marker: 'collision', note: `collision at bucket ${hash} — append to chain` });
      buckets[hash].push(op.value);
      snap({ activeBucket: hash, activeItem: [hash, buckets[hash].length - 1], marker: 'insert', note: `stored ${op.value}` });
    } else {
      snap({ activeBucket: hash, note: `hash(${op.value}) = ${hash} — scan the chain` });
      let found = false;
      for (let j = 0; j < buckets[hash].length; j++) {
        const hit = buckets[hash][j] === op.value;
        snap({ activeBucket: hash, activeItem: [hash, j], marker: hit ? 'found' : undefined, note: hit ? `found ${op.value}` : `compare ${buckets[hash][j]}` });
        if (hit) {
          found = true;
          break;
        }
      }
      if (!found) snap({ activeBucket: hash, note: `${op.value} not found` });
    }
  }
  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function HashTableVisualizer() {
  const [ops, setOps] = useState<Op[]>(() => [11, 3, 19, 8, 27].map((v) => ({ type: 'insert', value: v }) as Op));
  const [input, setInput] = useState('');

  const frames = useMemo(() => buildFrames(ops), [ops]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length);
  const frame = frames[Math.min(index, frames.length - 1)] ?? { buckets: Array.from({ length: SIZE }, () => []) };

  const count = frame.buckets.reduce((s, b) => s + b.length, 0);

  const insert = () => {
    const v = Number(input);
    if (input.trim() !== '' && !Number.isNaN(v)) {
      setOps((o) => [...o, { type: 'insert', value: v }]);
      setInput('');
    }
  };
  const search = () => {
    const v = Number(input);
    if (input.trim() !== '' && !Number.isNaN(v)) setOps((o) => [...o, { type: 'search', value: v }]);
  };

  const itemCls = (b: number, j: number) => {
    if (frame.activeItem && frame.activeItem[0] === b && frame.activeItem[1] === j) {
      if (frame.marker === 'insert') return 'border-accent text-accent';
      if (frame.marker === 'found') return 'border-emerald-500 text-emerald-300';
      return 'border-amber-400 text-amber-300';
    }
    return 'border-edge text-fg';
  };

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && insert()} placeholder="value" inputMode="numeric" className="w-20 rounded border border-edge bg-bg px-2 py-1 text-fg" />
        <button type="button" className={btn} onClick={insert}>
          Insert
        </button>
        <button type="button" className={btn} onClick={() => setOps((o) => [...o, { type: 'insert', value: Math.floor(Math.random() * 99) + 1 }])}>
          <Icon name="shuffle" size={16} /> Random
        </button>
        <button type="button" className={btn} onClick={search}>
          <Icon name="target" size={16} /> Search
        </button>
        <button type="button" className={btn} onClick={() => setOps([])}>
          <Icon name="rotate-ccw" size={16} /> Clear
        </button>
      </div>

      <div className="space-y-1">
        {frame.buckets.map((chain, b) => (
          <div key={b} className={`flex items-center gap-2 rounded border px-2 py-1.5 ${frame.activeBucket === b ? 'border-accent bg-accent/5' : 'border-edge'}`}>
            <span className="w-8 shrink-0 text-right font-mono text-xs text-muted">{b}</span>
            <Icon name="arrow-right" size={14} className="shrink-0 text-muted" />
            <div className="flex flex-wrap gap-1.5">
              {chain.length === 0 && <span className="font-mono text-xs text-muted/50">empty</span>}
              {chain.map((v, j) => (
                <div key={j} className={`flex h-8 min-w-8 items-center justify-center rounded border px-1.5 font-mono text-sm ${itemCls(b, j)}`}>{v}</div>
              ))}
            </div>
          </div>
        ))}
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

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">
        load factor {count}/{SIZE} = {(count / SIZE).toFixed(2)}
        {frame.note ? ` · ${frame.note}` : ''}
      </div>
    </div>
  );
}
