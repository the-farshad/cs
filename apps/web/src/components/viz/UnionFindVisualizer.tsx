import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const N = 8;

type Op = { type: 'union'; a: number; b: number } | { type: 'find'; a: number };

type UFFrame = {
  parent: number[];
  rank: number[];
  active: number[]; // nodes on the current find path
  root?: number; // representative just resolved
  linkFrom?: number; // edge added by a union (child root)
  linkTo?: number; // new parent
  compressed?: number[]; // nodes whose parent was rewired to root
  marker?: 'find' | 'link' | 'compress' | 'same';
  note: string;
};

function find(parent: number[], x: number): { root: number; path: number[] } {
  const path: number[] = [];
  let cur = x;
  while (parent[cur] !== cur) {
    path.push(cur);
    cur = parent[cur];
  }
  return { root: cur, path };
}

function buildFrames(ops: Op[]): UFFrame[] {
  const parent = Array.from({ length: N }, (_, i) => i);
  const rank = Array.from({ length: N }, () => 0);
  const snap = (f: Partial<UFFrame> & { note: string }): UFFrame => ({
    parent: [...parent],
    rank: [...rank],
    active: [],
    ...f,
  });
  const frames: UFFrame[] = [snap({ note: `${N} singleton sets — each node is its own root` })];

  for (const op of ops) {
    if (op.type === 'find') {
      const { root, path } = find(parent, op.a);
      frames.push(snap({ active: [...path, root], marker: 'find', note: `find(${op.a}) walks to root ${root}` }));
      // Path compression: point everyone on the path straight at root.
      const toFix = path.filter((p) => parent[p] !== root);
      for (const p of toFix) parent[p] = root;
      if (toFix.length)
        frames.push(
          snap({ active: [root], root, compressed: toFix, marker: 'compress', note: `compress: ${toFix.join(', ')} now point at ${root}` }),
        );
    } else {
      const ra = find(parent, op.a);
      const rb = find(parent, op.b);
      frames.push(
        snap({ active: [...ra.path, ra.root, ...rb.path, rb.root], marker: 'find', note: `union(${op.a}, ${op.b}) → roots ${ra.root}, ${rb.root}` }),
      );
      if (ra.root === rb.root) {
        frames.push(snap({ active: [ra.root], marker: 'same', note: `already in the same set` }));
        continue;
      }
      // Union by rank: hang the shorter tree under the taller one.
      let lo = ra.root;
      let hi = rb.root;
      if (rank[lo] > rank[hi]) [lo, hi] = [hi, lo];
      parent[lo] = hi;
      if (rank[lo] === rank[hi]) rank[hi] += 1;
      frames.push(
        snap({ active: [lo, hi], linkFrom: lo, linkTo: hi, marker: 'link', note: `link root ${lo} under ${hi} (rank ${rank[hi]})` }),
      );
    }
  }
  return frames;
}

/** Lay out the forest: roots across the top, children below their parent. */
function forestLayout(parent: number[]) {
  const children: number[][] = Array.from({ length: N }, () => []);
  const roots: number[] = [];
  for (let i = 0; i < N; i++) {
    if (parent[i] === i) roots.push(i);
    else children[parent[i]].push(i);
  }
  const pos = new Map<number, { x: number; y: number; depth: number }>();
  let leaf = 0;
  let maxDepth = 0;
  const place = (i: number, depth: number): number => {
    maxDepth = Math.max(maxDepth, depth);
    const kids = children[i];
    let x: number;
    if (kids.length === 0) {
      x = leaf * 70 + 36;
      leaf += 1;
    } else {
      const xs = kids.map((k) => place(k, depth + 1));
      x = xs.reduce((s, v) => s + v, 0) / xs.length;
    }
    pos.set(i, { x, y: depth * 70 + 30, depth });
    return x;
  };
  roots.forEach((r) => place(r, 0));
  const width = Math.max(leaf * 70, 140);
  const height = (maxDepth + 1) * 70;
  return { pos, width, height };
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function UnionFindVisualizer() {
  const [ops, setOps] = useState<Op[]>(() => [
    { type: 'union', a: 0, b: 1 },
    { type: 'union', a: 2, b: 3 },
    { type: 'union', a: 1, b: 3 },
    { type: 'union', a: 4, b: 5 },
    { type: 'find', a: 0 },
  ]);
  const [a, setA] = useState(6);
  const [b, setB] = useState(7);

  const frames = useMemo(() => buildFrames(ops), [ops]);
  const { index, playing, fps, setFps, play, pause, next, prev, seek } = useStepper(
    frames.length,
    2,
  );
  const frame = frames[Math.min(index, frames.length - 1)] ?? {
    parent: Array.from({ length: N }, (_, i) => i),
    rank: Array.from({ length: N }, () => 0),
    active: [],
    note: '',
  };

  const { pos, width, height } = useMemo(() => forestLayout(frame.parent), [frame.parent]);
  const activeSet = new Set(frame.active);
  const compressedSet = new Set(frame.compressed ?? []);

  const numOpts = Array.from({ length: N }, (_, i) => i);
  const doUnion = () => setOps((o) => [...o, { type: 'union', a, b }]);
  const doFind = () => setOps((o) => [...o, { type: 'find', a }]);
  const reset8 = () => setOps([]);

  const nodeFill = (i: number): string => {
    if (frame.marker === 'compress' && compressedSet.has(i)) return 'color-mix(in oklab, #8b5cf6 24%, var(--surface))';
    if (i === frame.root) return '#10b981';
    if (i === frame.linkTo) return 'var(--accent)';
    if (activeSet.has(i)) return 'color-mix(in oklab, #fbbf24 22%, var(--surface))';
    return 'var(--surface)';
  };
  const nodeStroke = (i: number): string => {
    if (frame.marker === 'compress' && compressedSet.has(i)) return '#8b5cf6';
    if (i === frame.root) return '#10b981';
    if (i === frame.linkTo || i === frame.linkFrom) return 'var(--accent)';
    if (activeSet.has(i)) return '#fbbf24';
    if (frame.parent[i] === i) return 'var(--accent)';
    return 'var(--border)';
  };

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-sm text-muted">
          a
          <select value={a} onChange={(e) => setA(Number(e.target.value))} className="rounded border border-edge bg-bg px-2 py-1 text-fg">
            {numOpts.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-sm text-muted">
          b
          <select value={b} onChange={(e) => setB(Number(e.target.value))} className="rounded border border-edge bg-bg px-2 py-1 text-fg">
            {numOpts.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={btn} onClick={doUnion}>
          Union(a, b)
        </button>
        <button type="button" className={btn} onClick={doFind}>
          <Icon name="target" size={16} /> Find(a)
        </button>
        <button type="button" className={btn} onClick={reset8}>
          <Icon name="rotate-ccw" size={16} /> Clear
        </button>
      </div>

      <svg
        viewBox={`0 0 ${width} ${Math.max(height, 60)}`}
        className="mx-auto block w-full"
        style={{ maxHeight: '22rem' }}
        role="img"
        aria-label="disjoint-set forest"
      >
        {/* parent edges, drawn child -> parent */}
        {frame.parent.map((p, i) => {
          if (p === i) return null;
          const c = pos.get(i);
          const par = pos.get(p);
          if (!c || !par) return null;
          const isLink = frame.linkFrom === i && frame.linkTo === p;
          const onPath = activeSet.has(i) && activeSet.has(p);
          const isComp = compressedSet.has(i);
          return (
            <line
              key={i}
              x1={c.x}
              y1={c.y}
              x2={par.x}
              y2={par.y}
              style={{ stroke: isComp ? '#8b5cf6' : isLink || onPath ? 'var(--accent)' : 'var(--border)' }}
              strokeWidth={isLink || onPath || isComp ? 3 : 2}
              strokeDasharray={isComp ? '5 4' : undefined}
            />
          );
        })}
        {Array.from({ length: N }, (_, i) => {
          const p = pos.get(i);
          if (!p) return null;
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={18} style={{ fill: nodeFill(i), stroke: nodeStroke(i) }} strokeWidth={2.5} />
              <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize={14} style={{ fill: i === frame.root ? '#04140d' : 'var(--fg)', fontFamily: 'var(--font-mono)' }}>
                {i}
              </text>
              {frame.parent[i] === i && (
                <text x={p.x} y={p.y - 26} textAnchor="middle" fontSize={10} style={{ fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                  r{frame.rank[i]}
                </text>
              )}
            </g>
          );
        })}
      </svg>

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
        <span className="shrink-0 font-mono text-xs text-muted">
          {index + 1}/{frames.length}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-edge pt-4 text-xs text-muted">
        <div className="flex flex-wrap gap-3">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: '#fbbf24' }} /> find path
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: 'var(--accent)' }} /> new link
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: '#8b5cf6' }} /> compressed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: '#10b981' }} /> root
          </span>
        </div>
        <span className="font-mono">{frame.note}</span>
      </div>
    </div>
  );
}
