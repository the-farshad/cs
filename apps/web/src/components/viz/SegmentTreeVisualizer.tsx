import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// Fixed-size array so the tree is a clean perfect binary tree of 4 leaves.
const BASE = [3, 1, 4, 1, 5, 9, 2, 6];
const SIZE = BASE.length; // 8 leaves

type SegNode = {
  id: number; // 1-based heap index
  lo: number;
  hi: number; // inclusive segment [lo, hi]
  x: number;
  y: number;
  depth: number;
};

type Op =
  | { type: 'query'; l: number; r: number }
  | { type: 'update'; i: number; value: number };

type STFrame = {
  values: number[]; // current leaf values
  sums: number[]; // sum stored at each tree node (1-based)
  visiting?: number; // node currently inspected
  contributing: number[]; // nodes whose full sum is taken (query) or recomputed (update)
  partial: number[]; // nodes split / recomputed along the path
  acc?: number; // running answer for a query
  updatedLeaf?: number; // array index changed by an update
  marker?: 'take' | 'recompute' | 'skip' | 'done';
  note: string;
};

// Build static node geometry once: positions for a segment tree over SIZE leaves.
function buildNodes(): { nodes: Map<number, SegNode>; width: number; height: number; leafOf: number[] } {
  const nodes = new Map<number, SegNode>();
  const leafOf: number[] = []; // array index -> node id
  let leaf = 0;
  let maxDepth = 0;
  const LEVEL = 70;
  const build = (id: number, lo: number, hi: number, depth: number): number => {
    maxDepth = Math.max(maxDepth, depth);
    let x: number;
    if (lo === hi) {
      x = leaf * 80 + 40;
      leaf += 1;
      leafOf[lo] = id;
    } else {
      const mid = (lo + hi) >> 1;
      const lx = build(2 * id, lo, mid, depth + 1);
      const rx = build(2 * id + 1, mid + 1, hi, depth + 1);
      x = (lx + rx) / 2;
    }
    nodes.set(id, { id, lo, hi, x, y: depth * LEVEL + 28, depth });
    return x;
  };
  build(1, 0, SIZE - 1, 0);
  return { nodes, width: leaf * 80, height: (maxDepth + 1) * LEVEL, leafOf };
}

const GEO = buildNodes();

function computeSums(values: number[]): number[] {
  const sums = new Array<number>(GEO.nodes.size * 2 + 4).fill(0);
  const fill = (id: number) => {
    const node = GEO.nodes.get(id)!;
    if (node.lo === node.hi) {
      sums[id] = values[node.lo];
      return sums[id];
    }
    sums[id] = fill(2 * id) + fill(2 * id + 1);
    return sums[id];
  };
  fill(1);
  return sums;
}

function buildFrames(ops: Op[]): STFrame[] {
  const values = [...BASE];
  let sums = computeSums(values);
  const frames: STFrame[] = [
    { values: [...values], sums: [...sums], contributing: [], partial: [], note: 'segment tree — each node stores the sum of its range' },
  ];

  for (const op of ops) {
    if (op.type === 'query') {
      const { l, r } = op;
      let acc = 0;
      const contributing: number[] = [];
      frames.push({
        values: [...values],
        sums: [...sums],
        contributing: [],
        partial: [],
        acc: 0,
        note: `query sum[${l}, ${r}]`,
      });
      const go = (id: number, lo: number, hi: number) => {
        frames.push({
          values: [...values],
          sums: [...sums],
          visiting: id,
          contributing: [...contributing],
          partial: [],
          acc,
          marker: undefined,
          note: `visit [${lo}, ${hi}]`,
        });
        if (r < lo || hi < l) {
          frames.push({
            values: [...values],
            sums: [...sums],
            visiting: id,
            contributing: [...contributing],
            partial: [],
            acc,
            marker: 'skip',
            note: `[${lo}, ${hi}] is outside — skip`,
          });
          return;
        }
        if (l <= lo && hi <= r) {
          acc += sums[id];
          contributing.push(id);
          frames.push({
            values: [...values],
            sums: [...sums],
            visiting: id,
            contributing: [...contributing],
            partial: [],
            acc,
            marker: 'take',
            note: `[${lo}, ${hi}] fully inside — add ${sums[id]} → ${acc}`,
          });
          return;
        }
        const mid = (lo + hi) >> 1;
        go(2 * id, lo, mid);
        go(2 * id + 1, mid + 1, hi);
      };
      go(1, 0, SIZE - 1);
      frames.push({
        values: [...values],
        sums: [...sums],
        contributing: [...contributing],
        partial: [],
        acc,
        marker: 'done',
        note: `sum[${l}, ${r}] = ${acc} (touched ${contributing.length} nodes, O(log n))`,
      });
    } else {
      const { i, value } = op;
      values[i] = value;
      const path: number[] = [];
      // Find the path of nodes from root to leaf i.
      let id = GEO.leafOf[i];
      while (id >= 1) {
        path.unshift(id);
        id = Math.floor(id / 2);
      }
      frames.push({
        values: [...values],
        sums: [...sums],
        partial: [...path],
        contributing: [GEO.leafOf[i]],
        note: `update a[${i}] = ${value} — recompute the path to the root`,
      });
      // Recompute bottom-up along the path.
      sums = [...sums];
      for (let k = path.length - 1; k >= 0; k--) {
        const node = GEO.nodes.get(path[k])!;
        if (node.lo === node.hi) sums[node.id] = values[node.lo];
        else sums[node.id] = sums[2 * node.id] + sums[2 * node.id + 1];
        frames.push({
          values: [...values],
          sums: [...sums],
          visiting: node.id,
          partial: path.slice(0, k + 1),
          contributing: [],
          marker: 'recompute',
          note: `node [${node.lo}, ${node.hi}] = ${sums[node.id]}`,
        });
      }
      frames.push({
        values: [...values],
        sums: [...sums],
        partial: [],
        contributing: [],
        updatedLeaf: i,
        marker: 'done',
        note: `update done — only ${path.length} nodes changed (O(log n))`,
      });
    }
  }
  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function SegmentTreeVisualizer() {
  const [ops, setOps] = useState<Op[]>(() => [{ type: 'query', l: 2, r: 5 }]);
  const [l, setL] = useState(2);
  const [r, setR] = useState(5);
  const [idx, setIdx] = useState(4);
  const [val, setVal] = useState(7);

  const frames = useMemo(() => buildFrames(ops), [ops]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(
    frames.length,
    3,
  );
  const frame = frames[Math.min(index, frames.length - 1)] ?? {
    values: [...BASE],
    sums: computeSums(BASE),
    contributing: [],
    partial: [],
    note: '',
  };

  const idxOpts = Array.from({ length: SIZE }, (_, i) => i);
  const runQuery = () => {
    const lo = Math.min(l, r);
    const hi = Math.max(l, r);
    setOps((o) => [...o, { type: 'query', l: lo, r: hi }]);
  };
  const runUpdate = () => setOps((o) => [...o, { type: 'update', i: idx, value: val }]);
  const clear = () => setOps([]);

  const contributing = new Set(frame.contributing);
  const partial = new Set(frame.partial);

  const fillFor = (id: number): string => {
    if (id === frame.visiting && frame.marker === 'skip') return 'color-mix(in oklab, #f43f5e 16%, var(--surface))';
    if (contributing.has(id)) return frame.marker === 'recompute' || partial.has(id) ? 'color-mix(in oklab, #8b5cf6 20%, var(--surface))' : '#10b981';
    if (id === frame.visiting && frame.marker === 'recompute') return 'color-mix(in oklab, #8b5cf6 24%, var(--surface))';
    if (partial.has(id)) return 'color-mix(in oklab, #8b5cf6 16%, var(--surface))';
    if (id === frame.visiting) return 'color-mix(in oklab, var(--accent) 14%, var(--surface))';
    return 'var(--surface)';
  };
  const strokeFor = (id: number): string => {
    if (id === frame.visiting && frame.marker === 'skip') return '#f43f5e';
    if (contributing.has(id) && frame.marker !== 'recompute' && !partial.has(id)) return '#10b981';
    if (partial.has(id) || (id === frame.visiting && frame.marker === 'recompute')) return '#8b5cf6';
    if (id === frame.visiting) return 'var(--accent)';
    return 'var(--border)';
  };
  const textFill = (id: number): string =>
    contributing.has(id) && frame.marker !== 'recompute' && !partial.has(id) ? '#04140d' : 'var(--fg)';

  const nodeList = [...GEO.nodes.values()];

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 rounded border border-edge px-2 py-1">
          <span className="text-sm text-muted">sum</span>
          <select value={l} onChange={(e) => setL(Number(e.target.value))} className="rounded border border-edge bg-bg px-1.5 py-0.5 text-fg">
            {idxOpts.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
          <span className="text-muted">..</span>
          <select value={r} onChange={(e) => setR(Number(e.target.value))} className="rounded border border-edge bg-bg px-1.5 py-0.5 text-fg">
            {idxOpts.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
          <button type="button" className={btn} onClick={runQuery}>
            <Icon name="target" size={16} /> Query
          </button>
        </div>
        <div className="flex items-center gap-1.5 rounded border border-edge px-2 py-1">
          <span className="text-sm text-muted">a[</span>
          <select value={idx} onChange={(e) => setIdx(Number(e.target.value))} className="rounded border border-edge bg-bg px-1.5 py-0.5 text-fg">
            {idxOpts.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
          <span className="text-sm text-muted">] =</span>
          <input
            type="number"
            value={val}
            onChange={(e) => setVal(Number(e.target.value))}
            className="w-16 rounded border border-edge bg-bg px-1.5 py-0.5 font-mono text-fg"
          />
          <button type="button" className={btn} onClick={runUpdate}>
            Update
          </button>
        </div>
        <button type="button" className={btn} onClick={clear}>
          <Icon name="rotate-ccw" size={16} /> Clear
        </button>
      </div>

      <svg
        viewBox={`0 0 ${GEO.width} ${GEO.height}`}
        className="mx-auto block w-full"
        style={{ maxHeight: '24rem' }}
        role="img"
        aria-label="segment tree"
      >
        {nodeList.map((node) => {
          if (node.lo === node.hi) return null;
          const a = node;
          const lc = GEO.nodes.get(2 * node.id)!;
          const rc = GEO.nodes.get(2 * node.id + 1)!;
          const onL = (partial.has(a.id) && partial.has(lc.id)) || (contributing.has(lc.id) && contributing.has(a.id));
          const onR = (partial.has(a.id) && partial.has(rc.id)) || (contributing.has(rc.id) && contributing.has(a.id));
          return (
            <g key={`e${node.id}`}>
              <line x1={a.x} y1={a.y} x2={lc.x} y2={lc.y} style={{ stroke: onL ? 'var(--accent)' : 'var(--border)' }} strokeWidth={onL ? 3 : 2} />
              <line x1={a.x} y1={a.y} x2={rc.x} y2={rc.y} style={{ stroke: onR ? 'var(--accent)' : 'var(--border)' }} strokeWidth={onR ? 3 : 2} />
            </g>
          );
        })}
        {nodeList.map((node) => (
          <g key={node.id}>
            <rect
              x={node.x - 26}
              y={node.y - 15}
              width={52}
              height={30}
              rx={6}
              style={{ fill: fillFor(node.id), stroke: strokeFor(node.id) }}
              strokeWidth={2.5}
            />
            <text x={node.x} y={node.y - 2} textAnchor="middle" dominantBaseline="central" fontSize={13} style={{ fill: textFill(node.id), fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              {frame.sums[node.id]}
            </text>
            <text x={node.x} y={node.y + 9} textAnchor="middle" fontSize={8} style={{ fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
              [{node.lo},{node.hi}]
            </text>
          </g>
        ))}
      </svg>

      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {frame.values.map((v, i) => (
          <div
            key={i}
            className={`flex h-10 w-10 flex-col items-center justify-center rounded border font-mono text-sm ${frame.updatedLeaf === i ? 'border-violet-500 text-violet-300' : 'border-edge text-fg'}`}
          >
            <span>{v}</span>
            <span className="text-[10px] text-muted/60">{i}</span>
          </div>
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
          <input type="range" min={1} max={16} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input type="range" min={0} max={Math.max(frames.length - 1, 0)} value={index} onChange={(e) => seek(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Timeline" />
        <span className="shrink-0 font-mono text-xs text-muted">
          {index + 1}/{frames.length}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-edge pt-4 text-xs text-muted">
        <div className="flex flex-wrap gap-3">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: '#10b981' }} /> full segment (counted)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: '#8b5cf6' }} /> recomputed path
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: '#f43f5e' }} /> skipped
          </span>
        </div>
        <span className="font-mono">{frame.acc != null ? `acc = ${frame.acc} · ` : ''}{frame.note}</span>
      </div>
    </div>
  );
}
