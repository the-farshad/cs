import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

type Node = { id: number; x: number; y: number; label: string };
type Edge = { u: number; v: number; w: number };

const NODES: Node[] = [
  { id: 0, x: 70, y: 60, label: 'A' },
  { id: 1, x: 230, y: 50, label: 'B' },
  { id: 2, x: 410, y: 70, label: 'C' },
  { id: 3, x: 60, y: 220, label: 'D' },
  { id: 4, x: 240, y: 200, label: 'E' },
  { id: 5, x: 420, y: 230, label: 'F' },
];

const EDGES: Edge[] = [
  { u: 0, v: 1, w: 4 },
  { u: 0, v: 3, w: 3 },
  { u: 1, v: 2, w: 5 },
  { u: 1, v: 3, w: 6 },
  { u: 1, v: 4, w: 2 },
  { u: 2, v: 4, w: 7 },
  { u: 2, v: 5, w: 4 },
  { u: 3, v: 4, w: 8 },
  { u: 4, v: 5, w: 1 },
];

type EdgeState = 'idle' | 'consider' | 'tree' | 'skip';

type Frame = {
  edgeStates: EdgeState[]; // indexed like EDGES
  nodeInTree: boolean[];
  active: number; // edge index under consideration, -1 none
  totalWeight: number;
  note: string;
};

const edgeKey = (e: Edge) => `${Math.min(e.u, e.v)}-${Math.max(e.u, e.v)}`;
const edgeIndex = new Map(EDGES.map((e, i) => [edgeKey(e), i]));

/** Kruskal: sort edges by weight, add an edge if it joins two different components. */
function kruskal(): Frame[] {
  const sorted = [...EDGES].sort((a, b) => a.w - b.w);
  const parent = NODES.map((n) => n.id);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };

  const edgeStates: EdgeState[] = EDGES.map(() => 'idle');
  const nodeInTree = NODES.map(() => false);
  let total = 0;
  const frames: Frame[] = [
    { edgeStates: [...edgeStates], nodeInTree: [...nodeInTree], active: -1, totalWeight: 0, note: 'edges sorted by weight (ascending)' },
  ];

  for (const e of sorted) {
    const idx = edgeIndex.get(edgeKey(e))!;
    edgeStates[idx] = 'consider';
    frames.push({
      edgeStates: [...edgeStates],
      nodeInTree: [...nodeInTree],
      active: idx,
      totalWeight: total,
      note: `consider ${NODES[e.u].label}-${NODES[e.v].label} (w=${e.w})`,
    });
    if (find(e.u) !== find(e.v)) {
      union(e.u, e.v);
      edgeStates[idx] = 'tree';
      nodeInTree[e.u] = true;
      nodeInTree[e.v] = true;
      total += e.w;
      frames.push({
        edgeStates: [...edgeStates],
        nodeInTree: [...nodeInTree],
        active: idx,
        totalWeight: total,
        note: `add it — connects two components; total = ${total}`,
      });
    } else {
      edgeStates[idx] = 'skip';
      frames.push({
        edgeStates: [...edgeStates],
        nodeInTree: [...nodeInTree],
        active: idx,
        totalWeight: total,
        note: `skip — both endpoints already connected (would form a cycle)`,
      });
    }
  }
  frames.push({
    edgeStates: [...edgeStates],
    nodeInTree: [...nodeInTree],
    active: -1,
    totalWeight: total,
    note: `MST complete — ${NODES.length - 1} edges, total weight ${total}`,
  });
  return frames;
}

/** Prim: grow a tree from one node, repeatedly taking the cheapest edge that
 *  leaves the current tree. */
function prim(start = 0): Frame[] {
  const inTree = NODES.map(() => false);
  const edgeStates: EdgeState[] = EDGES.map(() => 'idle');
  inTree[start] = true;
  let total = 0;
  const frames: Frame[] = [
    { edgeStates: [...edgeStates], nodeInTree: [...inTree], active: -1, totalWeight: 0, note: `start the tree at ${NODES[start].label}` },
  ];

  for (let step = 0; step < NODES.length - 1; step++) {
    // candidate edges crossing the cut, cheapest first
    let bestIdx = -1;
    let bestW = Infinity;
    const candidates: number[] = [];
    EDGES.forEach((e, i) => {
      const crosses = inTree[e.u] !== inTree[e.v];
      if (crosses) {
        candidates.push(i);
        if (e.w < bestW) {
          bestW = e.w;
          bestIdx = i;
        }
      }
    });
    // mark all crossing candidates as "consider"
    const considerStates = [...edgeStates];
    candidates.forEach((i) => {
      if (considerStates[i] !== 'tree') considerStates[i] = 'consider';
    });
    frames.push({
      edgeStates: considerStates,
      nodeInTree: [...inTree],
      active: bestIdx,
      totalWeight: total,
      note: `cheapest edge leaving the tree: ${NODES[EDGES[bestIdx].u].label}-${NODES[EDGES[bestIdx].v].label} (w=${bestW})`,
    });
    // commit
    const e = EDGES[bestIdx];
    candidates.forEach((i) => {
      if (edgeStates[i] !== 'tree') edgeStates[i] = 'idle';
    });
    edgeStates[bestIdx] = 'tree';
    inTree[e.u] = true;
    inTree[e.v] = true;
    total += e.w;
    frames.push({
      edgeStates: [...edgeStates],
      nodeInTree: [...inTree],
      active: bestIdx,
      totalWeight: total,
      note: `add ${NODES[e.u].label}-${NODES[e.v].label}; total = ${total}`,
    });
  }
  frames.push({
    edgeStates: [...edgeStates],
    nodeInTree: [...inTree],
    active: -1,
    totalWeight: total,
    note: `MST complete — total weight ${total}`,
  });
  return frames;
}

const EDGE_COLOR: Record<EdgeState, string> = {
  idle: 'var(--border)',
  consider: '#fbbf24',
  tree: '#10b981',
  skip: '#f43f5e',
};

export default function MSTVisualizer() {
  const [algo, setAlgo] = useState<'kruskal' | 'prim'>('kruskal');
  const frames = useMemo(() => (algo === 'kruskal' ? kruskal() : prim(0)), [algo]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 3);
  const frame = frames[Math.min(index, frames.length - 1)] ?? frames[0];

  const W = 490;
  const H = 290;
  const r = 18;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded border border-edge">
          {(['kruskal', 'prim'] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAlgo(a)}
              aria-pressed={algo === a}
              className={`px-3 py-1 text-sm capitalize transition ${algo === a ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}
            >
              {a}
            </button>
          ))}
        </div>
        <span className="text-sm text-muted">
          {algo === 'kruskal' ? 'Sort edges; add unless it makes a cycle.' : 'Grow from one node; take the cheapest crossing edge.'}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block w-full" style={{ maxHeight: '24rem' }} role="img" aria-label="minimum spanning tree">
        {EDGES.map((e, i) => {
          const a = NODES[e.u];
          const b = NODES[e.v];
          const st = frame.edgeStates[i];
          const active = i === frame.active;
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          return (
            <g key={i}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                style={{ stroke: EDGE_COLOR[st], opacity: st === 'skip' ? 0.5 : 1 }}
                strokeWidth={st === 'tree' ? 4 : active ? 3 : 2}
                strokeDasharray={st === 'skip' ? '5 4' : undefined}
              />
              <rect x={mx - 10} y={my - 9} width={20} height={18} rx={4} style={{ fill: 'var(--bg)', stroke: EDGE_COLOR[st] }} strokeWidth={1} />
              <text x={mx} y={my} textAnchor="middle" dominantBaseline="central" fontSize={11} style={{ fill: 'var(--fg)', fontFamily: 'var(--font-mono)' }}>
                {e.w}
              </text>
            </g>
          );
        })}
        {NODES.map((n) => {
          const inTree = frame.nodeInTree[n.id];
          return (
            <g key={n.id}>
              <circle
                cx={n.x}
                cy={n.y}
                r={r}
                style={{ fill: inTree ? '#10b981' : 'var(--surface)', stroke: inTree ? '#10b981' : 'var(--border)' }}
                strokeWidth={2.5}
              />
              <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central" fontSize={14} style={{ fill: inTree ? '#04140d' : 'var(--fg)', fontFamily: 'var(--font-mono)' }}>
                {n.label}
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
          <input type="range" min={1} max={20} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-edge pt-4 text-xs text-muted">
        <span className="font-mono">{frame.note}</span>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: '#fbbf24' }} /> considering</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: '#10b981' }} /> in tree</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: '#f43f5e' }} /> skipped</span>
          <span className="font-mono">total {frame.totalWeight}</span>
        </div>
      </div>
    </div>
  );
}
