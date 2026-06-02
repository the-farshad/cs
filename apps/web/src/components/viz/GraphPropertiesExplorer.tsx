import { useMemo, useState } from 'react';

type Mode = 'degree' | 'connectivity' | 'coloring';

type Node = { id: number; x: number; y: number; label: string };

// A small fixed graph: a hub A inside an even 4-cycle B-C-D-E, plus a pendant F
// hanging off E. Connected, contains cycles (not a tree), and 3-colorable.
const NODES: Node[] = [
  { id: 0, x: 160, y: 110, label: 'A' }, // center hub
  { id: 1, x: 160, y: 30, label: 'B' },
  { id: 2, x: 255, y: 95, label: 'C' },
  { id: 3, x: 200, y: 185, label: 'D' },
  { id: 4, x: 95, y: 170, label: 'E' },
  { id: 5, x: 35, y: 90, label: 'F' }, // pendant off E
];
const EDGES: [number, number][] = [
  [0, 1], [0, 2], [0, 3], [0, 4], // hub spokes
  [1, 2], [2, 3], [3, 4], [4, 1], // outer 4-cycle B-C-D-E
  [4, 5], // pendant edge E-F
];

// A proper 3-coloring (no edge joins same color). Verified against every edge above.
const COLORS = ['#38bdf8', '#fbbf24', '#10b981'];
const COLORING = [0, 1, 2, 1, 2, 0]; // index = node id → color index

const key = (u: number, v: number) => (u < v ? `${u}-${v}` : `${v}-${u}`);

export default function GraphPropertiesExplorer() {
  const [mode, setMode] = useState<Mode>('degree');
  const [selected, setSelected] = useState(0); // for degree mode
  // For connectivity mode: which node is "removed" to test if the graph stays connected.
  const [removed, setRemoved] = useState<number | null>(null);

  const degree = useMemo(() => {
    const d = NODES.map(() => 0);
    for (const [u, v] of EDGES) {
      d[u]++;
      d[v]++;
    }
    return d;
  }, []);

  const neighborsOf = (id: number) =>
    EDGES.filter(([u, v]) => u === id || v === id).map(([u, v]) => (u === id ? v : u));

  // Connected components when (optionally) one node is removed.
  const { compOf, componentCount, connected } = useMemo(() => {
    const present = NODES.filter((n) => n.id !== removed).map((n) => n.id);
    const comp: Record<number, number> = {};
    let c = 0;
    const adj: Record<number, number[]> = {};
    for (const id of present) adj[id] = [];
    for (const [u, v] of EDGES) {
      if (u === removed || v === removed) continue;
      adj[u].push(v);
      adj[v].push(u);
    }
    for (const id of present) {
      if (comp[id] !== undefined) continue;
      // BFS flood fill
      const q = [id];
      comp[id] = c;
      while (q.length) {
        const x = q.pop()!;
        for (const y of adj[x]) {
          if (comp[y] === undefined) {
            comp[y] = c;
            q.push(y);
          }
        }
      }
      c++;
    }
    return { compOf: comp, componentCount: c, connected: c <= 1 };
  }, [removed]);

  const sumDeg = degree.reduce((a, b) => a + b, 0);

  // Visual style per node depends on the active mode.
  function nodeFill(id: number): string {
    if (mode === 'coloring') return COLORS[COLORING[id]];
    if (mode === 'degree') return id === selected ? 'var(--accent)' : 'var(--surface)';
    // connectivity
    if (id === removed) return 'var(--bg)';
    const palette = ['#10b981', '#f43f5e', '#8b5cf6'];
    return palette[(compOf[id] ?? 0) % palette.length];
  }
  function nodeStroke(id: number): string {
    if (mode === 'degree' && id === selected) return 'var(--accent)';
    if (mode === 'connectivity' && id === removed) return '#f43f5e';
    return 'var(--border)';
  }
  // Label color: dark text on bright fills, theme foreground on surface/bg fills.
  function nodeTextFill(id: number): string {
    if (mode === 'degree') return id === selected ? 'var(--accent-fg)' : 'var(--fg)';
    if (mode === 'connectivity' && id === removed) return 'var(--fg)';
    return '#0b0b0f'; // bright color fill behind it
  }

  const selDegNeighbors = mode === 'degree' ? neighborsOf(selected) : [];

  function edgeStyle(u: number, v: number) {
    if (mode === 'degree') {
      const inc = u === selected || v === selected;
      return { stroke: inc ? 'var(--accent)' : 'var(--border)', width: inc ? 3.5 : 1.5, dim: false };
    }
    if (mode === 'connectivity') {
      const gone = u === removed || v === removed;
      return { stroke: gone ? 'var(--border)' : 'var(--accent)', width: gone ? 1 : 2.5, dim: gone };
    }
    // coloring: highlight nothing special, edges just structural
    return { stroke: 'var(--border)', width: 2, dim: false };
  }

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 inline-flex overflow-hidden rounded border border-edge">
        {(
          [
            { id: 'degree', label: 'Degree' },
            { id: 'connectivity', label: 'Connectivity' },
            { id: 'coloring', label: 'Proper coloring' },
          ] as { id: Mode; label: string }[]
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            aria-pressed={mode === m.id}
            className={`px-3 py-1 text-sm transition ${mode === m.id ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-[2fr_3fr]">
        <div className="rounded-lg border border-edge bg-bg/40 p-2">
          <svg viewBox="0 0 320 220" className="block w-full" role="img" aria-label="graph">
            {EDGES.map(([u, v]) => {
              const a = NODES[u];
              const b = NODES[v];
              const st = edgeStyle(u, v);
              return (
                <line
                  key={key(u, v)}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  style={{ stroke: st.stroke, opacity: st.dim ? 0.25 : 1 }}
                  strokeWidth={st.width}
                />
              );
            })}
            {NODES.map((nd) => {
              const dimNode = mode === 'connectivity' && nd.id === removed;
              const onClick = () => {
                if (mode === 'degree') setSelected(nd.id);
                else if (mode === 'connectivity') setRemoved((r) => (r === nd.id ? null : nd.id));
              };
              return (
                <g key={nd.id} onClick={onClick} style={{ cursor: mode === 'coloring' ? 'default' : 'pointer' }}>
                  <circle
                    cx={nd.x}
                    cy={nd.y}
                    r={17}
                    style={{
                      fill: nodeFill(nd.id),
                      stroke: nodeStroke(nd.id),
                      opacity: dimNode ? 0.35 : 1,
                      strokeDasharray: dimNode ? '4 3' : undefined,
                    }}
                    strokeWidth={2.5}
                  />
                  <text
                    x={nd.x}
                    y={nd.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={13}
                    style={{
                      fill: nodeTextFill(nd.id),
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      opacity: dimNode ? 0.5 : 1,
                    }}
                  >
                    {nd.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="flex flex-col gap-3 text-sm">
          {mode === 'degree' && (
            <div className="rounded-lg border border-edge bg-bg/40 p-3">
              <p className="text-muted">Click a vertex to inspect its degree.</p>
              <p className="mt-2 font-mono">
                deg(<span className="text-accent">{NODES[selected].label}</span>) ={' '}
                <span className="text-accent">{degree[selected]}</span> — neighbors{' '}
                {selDegNeighbors.map((id) => NODES[id].label).join(', ')}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-xs">
                {NODES.map((nd) => (
                  <span key={nd.id} className="rounded border border-edge px-2 py-0.5 text-muted">
                    {nd.label}:{degree[nd.id]}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted">
                Handshake lemma: Σ deg = {sumDeg} = 2 × {EDGES.length} edges. The total is always even.
              </p>
            </div>
          )}

          {mode === 'connectivity' && (
            <div className="rounded-lg border border-edge bg-bg/40 p-3">
              <p className="text-muted">Click a vertex to remove it and test connectivity.</p>
              <p className="mt-2 font-mono">
                {removed === null ? 'no vertex removed' : `removed ${NODES[removed].label}`} ·{' '}
                <span style={{ color: connected ? '#10b981' : '#f43f5e' }}>
                  {connected ? 'still connected' : `${componentCount} components`}
                </span>
              </p>
              <p className="mt-3 text-xs text-muted">
                A graph is <em>connected</em> when a path joins every pair of vertices. A vertex whose removal splits
                the graph is a <em>cut vertex</em>. Removing the hub A leaves the ring intact, but removing E strands
                the pendant F — so E is a cut vertex. Try both.
              </p>
            </div>
          )}

          {mode === 'coloring' && (
            <div className="rounded-lg border border-edge bg-bg/40 p-3">
              <p className="text-muted">A proper coloring gives adjacent vertices different colors.</p>
              <div className="mt-2 flex items-center gap-3 font-mono text-xs">
                {COLORS.map((c, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-sm" style={{ background: c }} /> color {i + 1}
                  </span>
                ))}
              </div>
              <p className="mt-3 font-mono">
                colors used: <span className="text-accent">3</span> (chromatic number)
              </p>
              <p className="mt-3 text-xs text-muted">
                The hub A forms triangles with adjacent ring vertices (e.g. A–B–C), and a triangle cannot be
                2-colored, so at least 3 colors are needed — and 3 suffice. A graph is <em>bipartite</em> exactly when
                it can be 2-colored, i.e. it has no odd cycle.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">
        {NODES.length} vertices · {EDGES.length} edges · the graph contains cycles (e.g. A–B–C–A), so it is not a tree
      </div>
    </div>
  );
}
