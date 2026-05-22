import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// Binary Indexed Tree (Fenwick tree) over an array of N values, 1-indexed.
// We animate the i & -i jumps for an update and for a prefix query.

const N = 8;
const BASE = [3, 1, 4, 1, 5, 9, 2, 6];

type Mode = 'update' | 'query';
type Frame = {
  tree: number[]; // 1-indexed, length N+1
  active?: number; // currently visited tree index
  visited: number[]; // path so far (excluding active)
  lsb?: number; // i & -i value at this step
  acc?: number; // running sum during a query
  note?: string;
  done?: boolean;
};

const lowbit = (i: number) => i & -i;

function buildFrames(tree: number[], mode: Mode, idx: number, delta: number): Frame[] {
  const t = [...tree];
  const frames: Frame[] = [];
  const snap = (f: Partial<Frame>) =>
    frames.push({ tree: [...t], visited: [], ...f });

  if (mode === 'update') {
    snap({
      active: idx,
      note: `update index ${idx} by +${delta} — walk UP via i += i & -i`,
    });
    const visited: number[] = [];
    let i = idx;
    while (i <= N) {
      const lsb = lowbit(i);
      t[i] += delta;
      frames.push({
        tree: [...t],
        active: i,
        visited: [...visited],
        lsb,
        note: `tree[${i}] += ${delta} · i & -i = ${lsb} · next i = ${i + lsb}`,
      });
      visited.push(i);
      i += lsb;
    }
    snap({ visited, done: true, note: `done — touched ${visited.length} cells (O(log n))` });
  } else {
    snap({
      active: idx,
      acc: 0,
      note: `prefix sum of [1..${idx}] — walk DOWN via i -= i & -i`,
    });
    const visited: number[] = [];
    let i = idx;
    let acc = 0;
    while (i > 0) {
      const lsb = lowbit(i);
      acc += t[i];
      frames.push({
        tree: [...t],
        active: i,
        visited: [...visited],
        lsb,
        acc,
        note: `sum += tree[${i}] (${t[i]}) = ${acc} · i & -i = ${lsb} · next i = ${i - lsb}`,
      });
      visited.push(i);
      i -= lsb;
    }
    snap({ visited, acc, done: true, note: `prefix(${idx}) = ${acc} — touched ${visited.length} cells (O(log n))` });
  }
  return frames;
}

// Build a Fenwick tree from a base array (1-indexed).
function fenwickFrom(values: number[]): number[] {
  const t = new Array(N + 1).fill(0);
  for (let i = 1; i <= N; i++) {
    t[i] += values[i - 1];
    const parent = i + lowbit(i);
    if (parent <= N) t[parent] += t[i];
  }
  return t;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

// The horizontal span each tree[i] covers: [i - (i&-i) + 1, i].
function coverStart(i: number) {
  return i - lowbit(i) + 1;
}

export default function FenwickTreeVisualizer() {
  const [mode, setMode] = useState<Mode>('update');
  const [idx, setIdx] = useState(5);
  const [delta, setDelta] = useState(3);

  const tree = useMemo(() => fenwickFrom(BASE), []);
  const frames = useMemo(() => buildFrames(tree, mode, idx, delta), [tree, mode, idx, delta]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length);
  const frame = frames[Math.min(index, frames.length - 1)] ?? { tree, visited: [] };

  const cellState = (i: number) => {
    if (frame.active === i) return 'active';
    if (frame.visited.includes(i)) return 'visited';
    return 'idle';
  };
  const cellCls = (i: number) => {
    const s = cellState(i);
    if (s === 'active') return 'border-accent bg-accent/15 text-accent';
    if (s === 'visited') return 'border-emerald-500 text-emerald-300';
    return 'border-edge text-fg';
  };

  // SVG layout for the implicit tree bars.
  const W = 560;
  const cellW = W / N;
  const rowH = 26;
  const maxLevel = 3; // levels 0..3 for N=8 (spans 1,2,4,8)
  const levelOf = (i: number) => Math.log2(lowbit(i)); // 0,1,2,3
  const H = (maxLevel + 1) * rowH + 8;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded border border-edge">
          {(['update', 'query'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`px-3 py-1 text-sm capitalize transition ${mode === m ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}
            >
              {m === 'update' ? 'Update' : 'Prefix query'}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          index
          <select
            value={idx}
            onChange={(e) => setIdx(Number(e.target.value))}
            className="rounded border border-edge bg-bg px-2 py-1 text-fg"
          >
            {Array.from({ length: N }, (_, k) => k + 1).map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>
        {mode === 'update' && (
          <label className="flex items-center gap-2 text-sm text-muted">
            delta
            <input
              type="number"
              value={delta}
              onChange={(e) => setDelta(Number(e.target.value) || 0)}
              className="w-16 rounded border border-edge bg-bg px-2 py-1 text-fg"
            />
          </label>
        )}
        <button type="button" className={btn} onClick={reset}>
          <Icon name="rotate-ccw" size={16} /> Reset
        </button>
      </div>

      {/* Implicit tree: each tree[i] is a bar spanning the indices it covers. */}
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Fenwick tree spans">
        {Array.from({ length: N }, (_, k) => k + 1).map((i) => {
          const lvl = levelOf(i);
          const x = (coverStart(i) - 1) * cellW;
          const w = lowbit(i) * cellW;
          const y = (maxLevel - lvl) * rowH;
          const s = cellState(i);
          const stroke = s === 'active' ? 'var(--accent)' : s === 'visited' ? '#10b981' : 'var(--border)';
          const fill =
            s === 'active'
              ? 'color-mix(in oklab, var(--accent) 18%, var(--surface))'
              : s === 'visited'
                ? 'color-mix(in oklab, #10b981 16%, var(--surface))'
                : 'var(--surface)';
          return (
            <g key={i}>
              <rect
                x={x + 2}
                y={y + 2}
                width={w - 4}
                height={rowH - 6}
                rx={4}
                style={{ fill, stroke }}
                strokeWidth={2}
              />
              <text
                x={x + w / 2}
                y={y + rowH / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11}
                style={{ fill: 'var(--fg)', fontFamily: 'var(--font-mono)' }}
              >
                t[{i}]={frame.tree[i]}
              </text>
            </g>
          );
        })}
      </svg>

      {/* The underlying 1-indexed array slots. */}
      <div className="mt-3 grid" style={{ gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))` }}>
        {BASE.map((v, k) => {
          const i = k + 1;
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className={`flex h-9 w-full items-center justify-center border-y border-l font-mono text-sm ${cellCls(i)} ${i === N ? 'border-r' : ''}`}>
                {v}
              </div>
              <span className="font-mono text-[10px] text-muted">{i}</span>
            </div>
          );
        })}
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

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">{frame.note ?? 'pick a mode and step through'}</div>
    </div>
  );
}
