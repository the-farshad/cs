import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// Bloom filter: a bit array of M bits + K independent hash functions.
// add(x): set bits h1..hK. query(x): all K bits set => "maybe"; any clear => "definitely not".

const M = 16;
const K = 3;

// K deterministic, well-spread hash functions over a string.
function hashes(s: string): number[] {
  const out: number[] = [];
  for (let f = 0; f < K; f++) {
    let h = 2166136261 ^ (f * 0x9e3779b1);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    out.push(((h >>> 0) % M));
  }
  return out;
}

type Op = { type: 'add' | 'query'; key: string };
type Frame = {
  bits: boolean[];
  probing?: number; // bit index being touched this step
  hashIdx?: number; // which hash function (0..K-1)
  setThisStep?: boolean; // for add: did this bit flip 0->1
  result?: 'maybe' | 'no'; // final query verdict
  failedAt?: number; // query: first clear bit
  marker?: 'add' | 'query';
  note?: string;
};

function buildFrames(ops: Op[]): Frame[] {
  const bits = new Array(M).fill(false);
  const frames: Frame[] = [{ bits: [...bits] }];
  const snap = (f: Partial<Frame>) => frames.push({ bits: [...bits], ...f });

  for (const op of ops) {
    const hs = hashes(op.key);
    if (op.type === 'add') {
      snap({ marker: 'add', note: `add("${op.key}") → bits ${hs.join(', ')}` });
      for (let i = 0; i < hs.length; i++) {
        const b = hs[i];
        const flipped = !bits[b];
        bits[b] = true;
        snap({
          probing: b,
          hashIdx: i,
          setThisStep: flipped,
          marker: 'add',
          note: `h${i + 1}("${op.key}") = ${b} → set bit ${b}${flipped ? '' : ' (already set)'}`,
        });
      }
      snap({ marker: 'add', note: `"${op.key}" added` });
    } else {
      snap({ marker: 'query', note: `query("${op.key}") → check bits ${hs.join(', ')}` });
      let allSet = true;
      let failedAt: number | undefined;
      for (let i = 0; i < hs.length; i++) {
        const b = hs[i];
        const isSet = bits[b];
        if (!isSet && allSet) {
          allSet = false;
          failedAt = b;
        }
        snap({
          probing: b,
          hashIdx: i,
          failedAt: !isSet ? b : undefined,
          marker: 'query',
          note: `h${i + 1}("${op.key}") = ${b} → bit ${b} is ${isSet ? '1' : '0'}${isSet ? '' : ' → definitely NOT present'}`,
        });
        if (!isSet) break;
      }
      snap({
        result: allSet ? 'maybe' : 'no',
        failedAt,
        marker: 'query',
        note: allSet
          ? `all ${K} bits set → "${op.key}" is POSSIBLY present (could be a false positive)`
          : `a bit was 0 → "${op.key}" is DEFINITELY not present (no false negatives)`,
      });
    }
  }
  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const DEFAULT_OPS: Op[] = [
  { type: 'add', key: 'cat' },
  { type: 'add', key: 'dog' },
  { type: 'query', key: 'cat' },
  { type: 'query', key: 'fox' },
];

export default function BloomFilterVisualizer() {
  const [ops, setOps] = useState<Op[]>(DEFAULT_OPS);
  const [input, setInput] = useState('');

  const frames = useMemo(() => buildFrames(ops), [ops]);
  const { index, playing, fps, setFps, play, pause, next, prev, seek } = useStepper(frames.length);
  const frame = frames[Math.min(index, frames.length - 1)] ?? { bits: new Array(M).fill(false) };

  const word = () => input.trim().toLowerCase();
  const add = () => {
    if (word()) {
      setOps((o) => [...o, { type: 'add', key: word() }]);
      setInput('');
    }
  };
  const query = () => {
    if (word()) {
      setOps((o) => [...o, { type: 'query', key: word() }]);
      setInput('');
    }
  };

  const bitCls = (i: number) => {
    if (frame.probing === i) {
      if (frame.marker === 'query' && frame.failedAt === i) return 'border-rose-500 bg-rose-500/20 text-rose-300';
      if (frame.marker === 'add') return 'border-accent bg-accent/20 text-accent';
      return 'border-amber-400 bg-amber-400/20 text-amber-300';
    }
    if (frame.bits[i]) return 'border-emerald-500 bg-emerald-500/10 text-emerald-300';
    return 'border-edge text-muted';
  };

  const setCount = frame.bits.filter(Boolean).length;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="word"
          className="w-28 rounded border border-edge bg-bg px-2 py-1 text-fg"
        />
        <button type="button" className={btn} onClick={add}>
          Add
        </button>
        <button type="button" className={btn} onClick={query}>
          <Icon name="target" size={16} /> Query
        </button>
        <button type="button" className={btn} onClick={() => setOps([])}>
          <Icon name="rotate-ccw" size={16} /> Clear
        </button>
        <span className="ml-auto font-mono text-xs text-muted">m={M} bits · k={K} hashes</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {frame.bits.map((on, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className={`flex h-9 w-9 items-center justify-center rounded border font-mono text-sm transition ${bitCls(i)}`}>
              {on ? 1 : 0}
            </div>
            <span className="font-mono text-[9px] text-muted">{i}</span>
          </div>
        ))}
      </div>

      {frame.result && (
        <div className={`mt-4 inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm font-medium ${frame.result === 'maybe' ? 'border-amber-400 text-amber-300' : 'border-rose-500 text-rose-300'}`}>
          <Icon name={frame.result === 'maybe' ? 'check' : 'rotate-ccw'} size={16} />
          {frame.result === 'maybe' ? 'possibly present' : 'definitely not present'}
        </div>
      )}

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

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">
        {setCount}/{M} bits set{frame.note ? ` · ${frame.note}` : ''}
      </div>
    </div>
  );
}
