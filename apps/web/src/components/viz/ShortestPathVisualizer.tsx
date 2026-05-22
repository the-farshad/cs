import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

type Node = { id: number; x: number; y: number; label: string };
type Edge = { u: number; v: number; w: number };

const NODES: Node[] = [
  { id: 0, x: 60, y: 150, label: 'A' },
  { id: 1, x: 200, y: 60, label: 'B' },
  { id: 2, x: 200, y: 240, label: 'C' },
  { id: 3, x: 350, y: 150, label: 'D' },
  { id: 4, x: 480, y: 80, label: 'E' },
];

// Two edge sets: one all-positive (works for both), one with a negative edge.
const POS_EDGES: Edge[] = [
  { u: 0, v: 1, w: 4 },
  { u: 0, v: 2, w: 2 },
  { u: 2, v: 1, w: 1 },
  { u: 1, v: 3, w: 5 },
  { u: 2, v: 3, w: 8 },
  { u: 3, v: 4, w: 3 },
  { u: 1, v: 4, w: 10 },
];

const NEG_EDGES: Edge[] = [
  { u: 0, v: 1, w: 4 },
  { u: 0, v: 2, w: 2 },
  { u: 2, v: 1, w: 1 },
  { u: 1, v: 3, w: 5 },
  { u: 2, v: 3, w: 8 },
  { u: 3, v: 4, w: 3 },
  { u: 1, v: 4, w: -6 }, // negative edge: Dijkstra cannot be trusted here
];

const SRC = 0;
const INF = Infinity;

type Frame = {
  dist: number[];
  settled: boolean[]; // Dijkstra only
  activeNode: number; // node picked / source of relaxation
  activeEdge: number; // index into the edge list, -1 none
  relaxed: boolean; // did the active edge improve a distance?
  note: string;
};

const fmt = (d: number) => (d === INF ? '∞' : String(d));

/** Dijkstra: repeatedly settle the closest unsettled node, relax its out-edges. */
function dijkstra(edges: Edge[]): Frame[] {
  const n = NODES.length;
  const dist = new Array(n).fill(INF);
  const settled = new Array(n).fill(false);
  dist[SRC] = 0;
  const out: Edge[][] = NODES.map(() => []);
  edges.forEach((e) => out[e.u].push(e));

  const frames: Frame[] = [
    {
      dist: [...dist],
      settled: [...settled],
      activeNode: SRC,
      activeEdge: -1,
      relaxed: false,
      note: `init: dist[${NODES[SRC].label}] = 0, all others ∞`,
    },
  ];

  for (let step = 0; step < n; step++) {
    // pick closest unsettled node
    let u = -1;
    let best = INF;
    for (let i = 0; i < n; i++) {
      if (!settled[i] && dist[i] < best) {
        best = dist[i];
        u = i;
      }
    }
    if (u === -1) break;
    settled[u] = true;
    frames.push({
      dist: [...dist],
      settled: [...settled],
      activeNode: u,
      activeEdge: -1,
      relaxed: false,
      note: `pick closest unsettled node: ${NODES[u].label} (dist ${fmt(dist[u])}) — settle it`,
    });
    // relax out-edges
    for (const e of out[u]) {
      const idx = edges.indexOf(e);
      const improved = dist[u] + e.w < dist[e.v];
      if (improved) dist[e.v] = dist[u] + e.w;
      frames.push({
        dist: [...dist],
        settled: [...settled],
        activeNode: u,
        activeEdge: idx,
        relaxed: improved,
        note: improved
          ? `relax ${NODES[e.u].label}→${NODES[e.v].label}: ${fmt(dist[u])}+${e.w} improves dist[${NODES[e.v].label}] to ${fmt(dist[e.v])}`
          : `relax ${NODES[e.u].label}→${NODES[e.v].label}: ${fmt(dist[u])}+${e.w} is no better — keep ${fmt(dist[e.v])}`,
      });
    }
  }
  frames.push({
    dist: [...dist],
    settled: [...settled],
    activeNode: -1,
    activeEdge: -1,
    relaxed: false,
    note: `done — every node settled; labels are final shortest distances`,
  });
  return frames;
}

/** Bellman-Ford: relax EVERY edge, |V|-1 rounds. Handles negative weights. */
function bellmanFord(edges: Edge[]): Frame[] {
  const n = NODES.length;
  const dist = new Array(n).fill(INF);
  dist[SRC] = 0;
  const settled = new Array(n).fill(false); // unused; kept for shape

  const frames: Frame[] = [
    {
      dist: [...dist],
      settled: [...settled],
      activeNode: SRC,
      activeEdge: -1,
      relaxed: false,
      note: `init: dist[${NODES[SRC].label}] = 0; will run ${n - 1} rounds over all edges`,
    },
  ];

  for (let round = 1; round <= n - 1; round++) {
    let anyChange = false;
    edges.forEach((e, idx) => {
      const reachable = dist[e.u] !== INF;
      const improved = reachable && dist[e.u] + e.w < dist[e.v];
      if (improved) {
        dist[e.v] = dist[e.u] + e.w;
        anyChange = true;
      }
      frames.push({
        dist: [...dist],
        settled: [...settled],
        activeNode: e.u,
        activeEdge: idx,
        relaxed: improved,
        note: improved
          ? `round ${round}: ${NODES[e.u].label}→${NODES[e.v].label} improves dist[${NODES[e.v].label}] to ${fmt(dist[e.v])}`
          : `round ${round}: ${NODES[e.u].label}→${NODES[e.v].label} — no improvement`,
      });
    });
    if (!anyChange) {
      frames.push({
        dist: [...dist],
        settled: [...settled],
        activeNode: -1,
        activeEdge: -1,
        relaxed: false,
        note: `round ${round} changed nothing — distances have converged early`,
      });
      break;
    }
  }
  frames.push({
    dist: [...dist],
    settled: [...settled],
    activeNode: -1,
    activeEdge: -1,
    relaxed: false,
    note: `done — final distances (correct even with negative edges)`,
  });
  return frames;
}

export default function ShortestPathVisualizer() {
  const [algo, setAlgo] = useState<'dijkstra' | 'bellman'>('dijkstra');
  const [hasNeg, setHasNeg] = useState(false);
  const edges = hasNeg ? NEG_EDGES : POS_EDGES;
  const frames = useMemo(
    () => (algo === 'dijkstra' ? dijkstra(edges) : bellmanFord(edges)),
    [algo, edges],
  );
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 3);
  const frame = frames[Math.min(index, frames.length - 1)] ?? frames[0];

  const W = 540;
  const H = 300;
  const r = 18;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded border border-edge">
          {([
            ['dijkstra', 'Dijkstra'],
            ['bellman', 'Bellman-Ford'],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setAlgo(k)}
              aria-pressed={algo === k}
              className={`px-3 py-1 text-sm transition ${algo === k ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={hasNeg} onChange={(e) => setHasNeg(e.target.checked)} className="accent-[var(--accent)]" />
          negative edge (B→E = -6)
        </label>
      </div>

      {hasNeg && algo === 'dijkstra' && (
        <div className="mb-3 rounded border px-3 py-2 text-xs" style={{ borderColor: '#f43f5e', color: '#f43f5e' }}>
          Dijkstra may return a wrong distance here: it settles a node permanently, but a later
          negative edge can still lower a "settled" distance. Switch to Bellman-Ford.
        </div>
      )}

      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block w-full" style={{ maxHeight: '24rem' }} role="img" aria-label="shortest path graph">
        <defs>
          <marker id="sp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: 'var(--border)' }} />
          </marker>
          <marker id="sp-arrow-hot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: '#fbbf24' }} />
          </marker>
        </defs>
        {edges.map((e, i) => {
          const a = NODES[e.u];
          const b = NODES[e.v];
          const active = i === frame.activeEdge;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          const x1 = a.x + ux * r;
          const y1 = a.y + uy * r;
          const x2 = b.x - ux * (r + 6);
          const y2 = b.y - uy * (r + 6);
          // offset label perpendicular to the edge so it doesn't sit on the line
          const mx = (x1 + x2) / 2 - uy * 12;
          const my = (y1 + y2) / 2 + ux * 12;
          const color = active ? (frame.relaxed ? '#10b981' : '#fbbf24') : 'var(--border)';
          return (
            <g key={i}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                markerEnd={active ? 'url(#sp-arrow-hot)' : 'url(#sp-arrow)'}
                style={{ stroke: color }}
                strokeWidth={active ? 3.5 : 2}
              />
              <rect x={mx - 11} y={my - 9} width={22} height={18} rx={4} style={{ fill: 'var(--bg)', stroke: color }} strokeWidth={1} />
              <text x={mx} y={my} textAnchor="middle" dominantBaseline="central" fontSize={11} style={{ fill: e.w < 0 ? '#f43f5e' : 'var(--fg)', fontFamily: 'var(--font-mono)' }}>
                {e.w}
              </text>
            </g>
          );
        })}
        {NODES.map((n) => {
          const settled = algo === 'dijkstra' && frame.settled[n.id];
          const active = frame.activeNode === n.id;
          let fill = 'var(--surface)';
          let stroke = 'var(--border)';
          let text = 'var(--fg)';
          if (settled) {
            fill = 'color-mix(in oklab, #10b981 22%, var(--surface))';
            stroke = '#10b981';
          }
          if (active) {
            fill = 'var(--accent)';
            stroke = 'var(--accent)';
            text = 'var(--accent-fg)';
          }
          return (
            <g key={n.id}>
              <circle cx={n.x} cy={n.y} r={r} style={{ fill, stroke }} strokeWidth={2.5} />
              <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central" fontSize={13} style={{ fill: text, fontFamily: 'var(--font-mono)' }}>
                {n.label}
              </text>
              <text x={n.x} y={n.y - r - 9} textAnchor="middle" dominantBaseline="central" fontSize={12} style={{ fill: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                {fmt(frame.dist[n.id])}
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
          <input type="range" min={1} max={16} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
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

      <div className="mt-4 space-y-2 border-t border-edge pt-4 text-xs text-muted">
        <div className="font-mono">{frame.note}</div>
        <div className="flex flex-wrap items-center gap-3 font-mono">
          {NODES.map((n) => (
            <span key={n.id} className="rounded border border-edge px-1.5 py-0.5">
              {n.label}: {fmt(frame.dist[n.id])}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: '#fbbf24' }} /> relaxing edge</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: '#10b981' }} /> improved</span>
          {algo === 'dijkstra' && (
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: 'color-mix(in oklab, #10b981 40%, var(--surface))' }} /> settled</span>
          )}
        </div>
      </div>
    </div>
  );
}
