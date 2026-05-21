import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

type Node = { id: number; x: number; y: number; label: string };

const NODES: Node[] = [
  { id: 0, x: 60, y: 60, label: 'shirt' },
  { id: 1, x: 60, y: 170, label: 'tie' },
  { id: 2, x: 230, y: 50, label: 'belt' },
  { id: 3, x: 230, y: 160, label: 'jacket' },
  { id: 4, x: 230, y: 250, label: 'pants' },
  { id: 5, x: 410, y: 110, label: 'shoes' },
  { id: 6, x: 410, y: 240, label: 'socks' },
];

// directed edges u -> v means "u must come before v"
const EDGES: [number, number][] = [
  [0, 1], // shirt -> tie
  [0, 2], // shirt -> belt
  [1, 3], // tie -> jacket
  [2, 3], // belt -> jacket
  [4, 2], // pants -> belt
  [4, 5], // pants -> shoes
  [6, 5], // socks -> shoes
];

type Frame = {
  inDeg: number[];
  removed: boolean[];
  queue: number[]; // current zero-in-degree set (ids)
  active: number; // node being removed this step, -1 none
  order: number[]; // emitted order so far
  note: string;
};

function kahn(): Frame[] {
  const n = NODES.length;
  const adj: number[][] = NODES.map(() => []);
  const inDeg = new Array(n).fill(0);
  for (const [u, v] of EDGES) {
    adj[u].push(v);
    inDeg[v]++;
  }

  const removed = new Array(n).fill(false);
  const order: number[] = [];
  // initial zero-in-degree set (stable by id)
  let queue = NODES.filter((nd) => inDeg[nd.id] === 0).map((nd) => nd.id);

  const frames: Frame[] = [
    {
      inDeg: [...inDeg],
      removed: [...removed],
      queue: [...queue],
      active: -1,
      order: [],
      note: `start — ready set (in-degree 0): ${queue.map((i) => NODES[i].label).join(', ')}`,
    },
  ];

  while (queue.length) {
    const cur = queue[0];
    queue = queue.slice(1);
    // highlight removal
    frames.push({
      inDeg: [...inDeg],
      removed: [...removed],
      queue: [...queue],
      active: cur,
      order: [...order],
      note: `remove ${NODES[cur].label} (in-degree 0) and add it to the order`,
    });
    removed[cur] = true;
    order.push(cur);
    // decrement neighbors
    const newlyReady: number[] = [];
    for (const nb of adj[cur]) {
      if (!removed[nb]) {
        inDeg[nb]--;
        if (inDeg[nb] === 0) newlyReady.push(nb);
      }
    }
    queue = [...queue, ...newlyReady.sort((a, b) => a - b)];
    frames.push({
      inDeg: [...inDeg],
      removed: [...removed],
      queue: [...queue],
      active: -1,
      order: [...order],
      note:
        newlyReady.length > 0
          ? `its edges drop — now ready: ${newlyReady.map((i) => NODES[i].label).join(', ')}`
          : `no new nodes freed up`,
    });
  }

  frames.push({
    inDeg: [...inDeg],
    removed: [...removed],
    queue: [],
    active: -1,
    order: [...order],
    note: `done — a valid order: ${order.map((i) => NODES[i].label).join(' → ')}`,
  });
  return frames;
}

export default function TopologicalSortVisualizer() {
  const frames = useMemo(() => kahn(), []);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 2);
  const frame = frames[Math.min(index, frames.length - 1)] ?? frames[0];

  const W = 480;
  const H = 300;
  const r = 22;
  const queueSet = new Set(frame.queue);

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3 text-sm text-muted">
        Each arrow means &ldquo;must come first.&rdquo; Repeatedly remove a node with no remaining prerequisites.
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block w-full" style={{ maxHeight: '24rem' }} role="img" aria-label="topological sort">
        <defs>
          <marker id="topo-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: 'var(--border)' }} />
          </marker>
        </defs>
        {EDGES.map(([u, v], i) => {
          const a = NODES[u];
          const b = NODES[v];
          const gone = frame.removed[u];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          const x1 = a.x + ux * r;
          const y1 = a.y + uy * r;
          const x2 = b.x - ux * (r + 6);
          const y2 = b.y - uy * (r + 6);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              markerEnd="url(#topo-arrow)"
              style={{ stroke: 'var(--border)', opacity: gone ? 0.18 : 1 }}
              strokeWidth={2}
            />
          );
        })}
        {NODES.map((n) => {
          const removed = frame.removed[n.id];
          const active = frame.active === n.id;
          const ready = queueSet.has(n.id);
          let fill = 'var(--surface)';
          let stroke = 'var(--border)';
          let text = 'var(--fg)';
          if (ready) stroke = '#fbbf24';
          if (active) {
            fill = 'var(--accent)';
            stroke = 'var(--accent)';
            text = 'var(--accent-fg)';
          }
          if (removed) {
            fill = 'color-mix(in oklab, #10b981 22%, var(--surface))';
            stroke = '#10b981';
          }
          const orderPos = frame.order.indexOf(n.id);
          return (
            <g key={n.id} style={{ opacity: removed && !active ? 0.85 : 1 }}>
              <circle cx={n.x} cy={n.y} r={r} style={{ fill, stroke }} strokeWidth={2.5} />
              <text x={n.x} y={n.y - 3} textAnchor="middle" dominantBaseline="central" fontSize={10} style={{ fill: text, fontFamily: 'var(--font-mono)' }}>
                {n.label}
              </text>
              <text x={n.x} y={n.y + 9} textAnchor="middle" dominantBaseline="central" fontSize={9} style={{ fill: removed ? '#10b981' : 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                {removed ? `#${orderPos + 1}` : `in ${frame.inDeg[n.id]}`}
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

      <div className="mt-4 space-y-1 border-t border-edge pt-4 font-mono text-xs text-muted">
        <div>{frame.note}</div>
        <div>order: {frame.order.map((i) => NODES[i].label).join(' → ') || '—'}</div>
      </div>
    </div>
  );
}
