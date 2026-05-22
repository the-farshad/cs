import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

/** Three STL containers side by side, one mode at a time:
 *  - vector<int>: push_back with capacity doubling (amortized O(1)).
 *  - set<int>:    ordered insert kept sorted via a balanced tree (O(log n)).
 *  - unordered_set<int>: hash into a fixed bucket count (O(1) average).
 *
 *  Each mode replays the SAME input sequence so the cost contrast is obvious.  */

type Mode = 'vector' | 'set' | 'unordered';

const INPUT = [5, 2, 8, 2, 1, 9, 3, 7];
const BUCKETS = 8;

// ---- vector<int> -----------------------------------------------------------

type VecFrame = {
  kind: 'vector';
  slots: (number | null)[];
  size: number;
  capacity: number;
  active?: number;
  copying?: number[];
  cost: string;
  note: string;
};

function vectorFrames(values: number[]): VecFrame[] {
  let capacity = 1;
  let size = 0;
  let slots: (number | null)[] = Array.from({ length: capacity }, () => null);
  const frames: VecFrame[] = [
    {
      kind: 'vector',
      slots: [...slots],
      size,
      capacity,
      cost: '—',
      note: `empty vector, capacity ${capacity}`,
    },
  ];

  for (const v of values) {
    if (size === capacity) {
      const newCap = capacity * 2;
      const copied = Array.from({ length: size }, (_, i) => i);
      const grown: (number | null)[] = Array.from({ length: newCap }, (_, i) =>
        i < size ? slots[i] : null,
      );
      frames.push({
        kind: 'vector',
        slots: grown,
        size,
        capacity: newCap,
        copying: copied,
        cost: `O(${size}) copy`,
        note: `full at ${capacity} — reallocate to ${newCap} and copy ${size} elements`,
      });
      capacity = newCap;
      slots = grown;
    }
    slots = [...slots];
    slots[size] = v;
    size += 1;
    frames.push({
      kind: 'vector',
      slots: [...slots],
      size,
      capacity,
      active: size - 1,
      cost: 'O(1)',
      note: `push_back(${v}) into slot ${size - 1}`,
    });
  }
  return frames;
}

// ---- set<int> (ordered, kept sorted) --------------------------------------

type SetFrame = {
  kind: 'set';
  items: number[];
  active?: number; // value just placed
  scanning?: number; // index being compared
  dup?: boolean;
  cost: string;
  note: string;
};

function setFrames(values: number[]): SetFrame[] {
  const items: number[] = [];
  const frames: SetFrame[] = [
    { kind: 'set', items: [], cost: '—', note: 'empty ordered set' },
  ];

  for (const v of values) {
    // Find the sorted insertion point, comparing along the way (~log n in a real tree).
    let pos = 0;
    let dup = false;
    while (pos < items.length && items[pos] < v) {
      frames.push({
        kind: 'set',
        items: [...items],
        scanning: pos,
        cost: 'O(log n)',
        note: `insert ${v}: ${items[pos]} < ${v}, look right`,
      });
      pos += 1;
    }
    if (pos < items.length && items[pos] === v) dup = true;

    if (dup) {
      frames.push({
        kind: 'set',
        items: [...items],
        scanning: pos,
        dup: true,
        cost: 'O(log n)',
        note: `${v} already present — set keeps unique keys, insert is a no-op`,
      });
      continue;
    }

    items.splice(pos, 0, v);
    frames.push({
      kind: 'set',
      items: [...items],
      active: pos,
      cost: 'O(log n)',
      note: `placed ${v} at sorted position ${pos} — the set is always in order`,
    });
  }
  return frames;
}

// ---- unordered_set<int> (hash buckets) ------------------------------------

type HashFrame = {
  kind: 'unordered';
  buckets: number[][];
  activeBucket?: number;
  activeItem?: [number, number];
  dup?: boolean;
  collision?: boolean;
  cost: string;
  note: string;
};

function hashFrames(values: number[]): HashFrame[] {
  const buckets: number[][] = Array.from({ length: BUCKETS }, () => []);
  const frames: HashFrame[] = [
    {
      kind: 'unordered',
      buckets: buckets.map((b) => [...b]),
      cost: '—',
      note: `empty unordered_set with ${BUCKETS} buckets`,
    },
  ];

  for (const v of values) {
    const h = ((v % BUCKETS) + BUCKETS) % BUCKETS;
    frames.push({
      kind: 'unordered',
      buckets: buckets.map((b) => [...b]),
      activeBucket: h,
      cost: 'O(1) avg',
      note: `hash(${v}) = ${v} % ${BUCKETS} = ${h} — jump straight to bucket ${h}`,
    });

    if (buckets[h].includes(v)) {
      frames.push({
        kind: 'unordered',
        buckets: buckets.map((b) => [...b]),
        activeBucket: h,
        activeItem: [h, buckets[h].indexOf(v)],
        dup: true,
        cost: 'O(1) avg',
        note: `${v} already in bucket ${h} — unique key, nothing to add`,
      });
      continue;
    }

    const collision = buckets[h].length > 0;
    buckets[h].push(v);
    frames.push({
      kind: 'unordered',
      buckets: buckets.map((b) => [...b]),
      activeBucket: h,
      activeItem: [h, buckets[h].length - 1],
      collision,
      cost: 'O(1) avg',
      note: collision
        ? `collision: bucket ${h} was occupied — chain ${v} onto it`
        : `stored ${v} in bucket ${h}`,
    });
  }
  return frames;
}

type AnyFrame = VecFrame | SetFrame | HashFrame;

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const MODES: { key: Mode; label: string; type: string; lookup: string }[] = [
  { key: 'vector', label: 'vector', type: 'contiguous array', lookup: 'amortized O(1) push_back' },
  { key: 'set', label: 'set', type: 'balanced tree', lookup: 'O(log n), kept sorted' },
  { key: 'unordered', label: 'unordered_set', type: 'hash buckets', lookup: 'O(1) average, unordered' },
];

export default function CppStlContainers() {
  const [mode, setMode] = useState<Mode>('vector');

  const frames = useMemo<AnyFrame[]>(() => {
    if (mode === 'vector') return vectorFrames(INPUT);
    if (mode === 'set') return setFrames(INPUT);
    return hashFrames(INPUT);
  }, [mode]);

  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(
    frames.length,
    3,
  );
  const frame = frames[Math.min(index, frames.length - 1)];
  const meta = MODES.find((m) => m.key === mode)!;

  // ---- per-mode rendering helpers ------------------------------------------

  const vectorSlotCls = (f: VecFrame, i: number): string => {
    if (f.copying?.includes(i)) return 'border-violet-500 text-violet-300';
    if (f.active === i) return 'border-accent text-accent';
    if (f.slots[i] != null) return 'border-edge text-fg';
    return 'border-dashed border-edge/50 text-muted/40';
  };

  const setItemCls = (f: SetFrame, i: number): string => {
    if (f.active === i) return 'border-accent text-accent';
    if (f.scanning === i) return 'border-amber-400 text-amber-300';
    return 'border-edge text-fg';
  };

  const hashItemCls = (f: HashFrame, b: number, j: number): string => {
    if (f.activeItem && f.activeItem[0] === b && f.activeItem[1] === j) {
      if (f.dup) return 'border-amber-400 text-amber-300';
      if (f.collision) return 'border-[#f43f5e] text-[#f43f5e]';
      return 'border-accent text-accent';
    }
    return 'border-edge text-fg';
  };

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      {/* Mode tabs. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMode(m.key)}
            className={
              mode === m.key
                ? 'inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-3 py-1 text-sm font-medium text-accent-fg'
                : btn
            }
          >
            {m.label}
          </button>
        ))}
        <span className="ml-auto font-mono text-xs text-muted">
          inserting [{INPUT.join(', ')}]
        </span>
      </div>

      {/* Container body. */}
      <div className="min-h-32 rounded-lg border border-edge bg-bg/40 p-4">
        {frame.kind === 'vector' && (
          <div className="flex flex-wrap items-center gap-1.5">
            {frame.slots.map((v, i) => (
              <div
                key={i}
                className={`flex h-12 w-12 flex-col items-center justify-center rounded border font-mono text-sm transition-colors ${vectorSlotCls(
                  frame,
                  i,
                )}`}
              >
                <span>{v ?? '·'}</span>
                <span className="text-[10px] text-muted/60">{i}</span>
              </div>
            ))}
          </div>
        )}

        {frame.kind === 'set' && (
          <div className="flex flex-wrap items-center gap-1.5">
            {frame.items.length === 0 && <span className="text-xs text-muted/50">empty</span>}
            {frame.items.map((v, i) => (
              <div key={i} className="flex items-center gap-1.5">
                {i > 0 && <Icon name="chevron-right" size={12} className="text-muted/40" />}
                <div
                  className={`flex h-11 min-w-11 items-center justify-center rounded border px-2 font-mono text-sm transition-colors ${setItemCls(
                    frame,
                    i,
                  )}`}
                >
                  {v}
                </div>
              </div>
            ))}
          </div>
        )}

        {frame.kind === 'unordered' && (
          <div className="space-y-1">
            {frame.buckets.map((chain, b) => (
              <div
                key={b}
                className={`flex items-center gap-2 rounded border px-2 py-1 ${
                  frame.activeBucket === b ? 'border-accent bg-accent/5' : 'border-edge'
                }`}
              >
                <span className="w-6 shrink-0 text-right font-mono text-[11px] text-muted">{b}</span>
                <Icon name="arrow-right" size={12} className="shrink-0 text-muted/60" />
                <div className="flex flex-wrap gap-1.5">
                  {chain.length === 0 && (
                    <span className="font-mono text-[11px] text-muted/40">empty</span>
                  )}
                  {chain.map((v, j) => (
                    <div
                      key={j}
                      className={`flex h-7 min-w-7 items-center justify-center rounded border px-1.5 font-mono text-xs transition-colors ${hashItemCls(
                        frame,
                        b,
                        j,
                      )}`}
                    >
                      {v}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stat strip. */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(frame.kind === 'vector'
          ? [
              { label: 'size', value: frame.size },
              { label: 'capacity', value: frame.capacity },
              {
                label: 'load',
                value: frame.capacity
                  ? `${Math.round((frame.size / frame.capacity) * 100)}%`
                  : '—',
              },
              { label: 'this op', value: frame.cost },
            ]
          : frame.kind === 'set'
            ? [
                { label: 'size', value: frame.items.length },
                { label: 'order', value: 'sorted' },
                { label: 'unique', value: 'yes' },
                { label: 'this op', value: frame.cost },
              ]
            : [
                {
                  label: 'size',
                  value: frame.buckets.reduce((s, b) => s + b.length, 0),
                },
                { label: 'buckets', value: BUCKETS },
                { label: 'order', value: 'none' },
                { label: 'this op', value: frame.cost },
              ]
        ).map((s) => (
          <div key={s.label} className="rounded border border-edge bg-bg/40 px-3 py-2 text-center">
            <div className="font-mono text-base text-fg">{s.value}</div>
            <div className="text-xs text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Controls. */}
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
          <input
            type="range"
            min={1}
            max={20}
            value={fps}
            onChange={(e) => setFps(Number(e.target.value))}
            className="accent-[var(--accent)]"
          />
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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-edge pt-4 text-xs text-muted">
        <span className="font-mono">
          {meta.label}: {meta.type} · {meta.lookup}
        </span>
        <span>{frame.note}</span>
      </div>
    </div>
  );
}
