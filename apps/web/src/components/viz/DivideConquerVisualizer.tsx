import { useMemo } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const INPUT = [5, 2, 8, 1, 9, 3, 7, 4];

type TreeNode = {
  id: number;
  lo: number; // inclusive index in original array
  hi: number; // exclusive
  depth: number;
  values: number[]; // unsorted slice
  sorted: number[]; // sorted slice (filled on combine)
  left?: number;
  right?: number;
  x: number; // layout
  y: number;
};

type Phase = 'idle' | 'split' | 'solve' | 'combine' | 'done';

type Frame = {
  // per-node status keyed by node id
  status: Record<number, Phase>;
  active: number; // node id currently acted on, -1 none
  showSorted: Set<number>; // node ids whose sorted slice is known
  note: string;
  kind: 'split' | 'combine' | 'base' | 'init' | 'done';
};

/** Build the merge-sort recursion tree with simple layout coords. */
function buildTree(): { nodes: TreeNode[]; root: number } {
  const nodes: TreeNode[] = [];
  let nextId = 0;

  function rec(lo: number, hi: number, depth: number): number {
    const id = nextId++;
    const node: TreeNode = {
      id,
      lo,
      hi,
      depth,
      values: INPUT.slice(lo, hi),
      sorted: [],
      x: 0,
      y: 0,
    };
    nodes.push(node);
    if (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      node.left = rec(lo, mid, depth + 1);
      node.right = rec(mid, hi, depth + 1);
    }
    return id;
  }
  const root = rec(0, INPUT.length, 0);

  // Layout: x by leaf order, y by depth.
  let leafX = 0;
  const W = 720;
  const slot = W / INPUT.length;
  function layout(id: number): number {
    const n = nodes[id];
    n.y = 40 + n.depth * 78;
    if (n.left === undefined || n.right === undefined) {
      n.x = leafX * slot + slot / 2;
      leafX++;
      return n.x;
    }
    const lx = layout(n.left);
    const rx = layout(n.right);
    n.x = (lx + rx) / 2;
    return n.x;
  }
  layout(root);
  return { nodes, root };
}

function merge(a: number[], b: number[]): number[] {
  const out: number[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) out.push(a[i] <= b[j] ? a[i++] : b[j++]);
  while (i < a.length) out.push(a[i++]);
  while (j < b.length) out.push(b[j++]);
  return out;
}

function buildFrames(nodes: TreeNode[], root: number): Frame[] {
  const frames: Frame[] = [];
  const status: Record<number, Phase> = {};
  nodes.forEach((n) => (status[n.id] = 'idle'));
  const shown = new Set<number>();

  const snap = (active: number, note: string, kind: Frame['kind']) =>
    frames.push({ status: { ...status }, active, showSorted: new Set(shown), note, kind });

  snap(root, `Start: sort the whole array of ${INPUT.length}. Recurse: split → solve → combine.`, 'init');

  // recursive walk that emits split (pre) and combine (post) frames
  function go(id: number): number[] {
    const n = nodes[id];
    if (n.left === undefined || n.right === undefined) {
      status[id] = 'solve';
      n.sorted = [...n.values];
      shown.add(id);
      snap(id, `Base case: a single element [${n.values.join(', ')}] is already sorted.`, 'base');
      return n.sorted;
    }
    status[id] = 'split';
    snap(id, `Split [${n.values.join(', ')}] into two halves.`, 'split');
    const ls = go(n.left);
    const rs = go(n.right);
    status[id] = 'combine';
    n.sorted = merge(ls, rs);
    shown.add(id);
    snap(id, `Combine: merge [${ls.join(', ')}] and [${rs.join(', ')}] → [${n.sorted.join(', ')}].`, 'combine');
    return n.sorted;
  }
  go(root);
  nodes.forEach((n) => (status[n.id] = 'done'));
  snap(-1, `Done: the merged result is fully sorted in O(n log n) time.`, 'done');
  return frames;
}

const PHASE_STROKE: Record<Phase, string> = {
  idle: 'var(--border)',
  split: '#fbbf24',
  solve: '#38bdf8',
  combine: '#10b981',
  done: '#10b981',
};

export default function DivideConquerVisualizer() {
  const { nodes, root } = useMemo(buildTree, []);
  const frames = useMemo(() => buildFrames(nodes, root), [nodes, root]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 2);
  const frame = frames[Math.min(index, frames.length - 1)] ?? frames[0];

  const W = 720;
  const H = 40 + (Math.ceil(Math.log2(INPUT.length)) + 1) * 78;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3 text-sm text-muted">
        Merge sort as a recursion tree. Going <span style={{ color: '#fbbf24' }}>down</span> the
        problem splits in half; coming <span style={{ color: '#10b981' }}>up</span> the sorted
        halves merge together.
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block w-full" style={{ maxHeight: '24rem' }} role="img" aria-label="recursion tree">
        {nodes.map((n) =>
          n.left !== undefined ? (
            <g key={`e${n.id}`}>
              <line x1={n.x} y1={n.y + 14} x2={nodes[n.left].x} y2={nodes[n.left].y - 14} style={{ stroke: 'var(--border)' }} strokeWidth={1.5} />
              <line x1={n.x} y1={n.y + 14} x2={nodes[n.right!].x} y2={nodes[n.right!].y - 14} style={{ stroke: 'var(--border)' }} strokeWidth={1.5} />
            </g>
          ) : null,
        )}
        {nodes.map((n) => {
          const ph = frame.status[n.id];
          const active = n.id === frame.active;
          const showSorted = frame.showSorted.has(n.id);
          const label = showSorted ? n.sorted.join(' ') : n.values.join(' ');
          const stroke = PHASE_STROKE[ph];
          const boxW = Math.max(26, label.length * 8.5 + 10);
          return (
            <g key={n.id}>
              <rect
                x={n.x - boxW / 2}
                y={n.y - 13}
                width={boxW}
                height={26}
                rx={5}
                style={{
                  fill: active ? 'color-mix(in oklab, var(--accent) 18%, var(--surface))' : 'var(--bg)',
                  stroke,
                }}
                strokeWidth={active ? 3 : 1.8}
              />
              <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central" fontSize={12} style={{ fill: 'var(--fg)', fontFamily: 'var(--font-mono)' }}>
                {label}
              </text>
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
        <button type="button" className={btn} onClick={reset} disabled={index === 0}>
          <Icon name="rotate-ccw" size={16} /> Reset
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={1} max={12} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
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
        <span className="font-mono">{frame.note}</span>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: '#fbbf24' }} /> split</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: '#38bdf8' }} /> base case</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: '#10b981' }} /> combine</span>
        </div>
      </div>
    </div>
  );
}
