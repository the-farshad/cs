import { useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';

type View = 'both' | 'list' | 'matrix';

const NODES = [
  { id: 0, x: 80, y: 40, label: 'A' },
  { id: 1, x: 200, y: 40, label: 'B' },
  { id: 2, x: 40, y: 150, label: 'C' },
  { id: 3, x: 160, y: 160, label: 'D' },
  { id: 4, x: 240, y: 150, label: 'E' },
];
// Undirected edges.
const EDGES: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 3],
  [1, 4],
  [2, 3],
  [3, 4],
];

const lbl = (i: number) => NODES[i].label;

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function GraphRepresentationVisualizer() {
  const [view, setView] = useState<View>('both');
  // Selected edge as a normalized "u-v" key (u < v), or null.
  const [sel, setSel] = useState<string | null>('1-3');

  const n = NODES.length;
  const key = (u: number, v: number) => (u < v ? `${u}-${v}` : `${v}-${u}`);

  // Adjacency list (sorted neighbours).
  const adj = useMemo(() => {
    const a: number[][] = NODES.map(() => []);
    for (const [u, v] of EDGES) {
      a[u].push(v);
      a[v].push(u);
    }
    a.forEach((l) => l.sort((x, y) => x - y));
    return a;
  }, []);

  // Adjacency matrix.
  const matrix = useMemo(() => {
    const m: number[][] = NODES.map(() => NODES.map(() => 0));
    for (const [u, v] of EDGES) {
      m[u][v] = 1;
      m[v][u] = 1;
    }
    return m;
  }, []);

  const isSel = (u: number, v: number) => sel === key(u, v);
  const toggle = (u: number, v: number) => {
    const k = key(u, v);
    setSel((s) => (s === k ? null : k));
  };

  const selPair = sel ? (sel.split('-').map(Number) as [number, number]) : null;

  const showList = view === 'both' || view === 'list';
  const showMatrix = view === 'both' || view === 'matrix';

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded border border-edge">
          {(
            [
              { id: 'both', label: 'Both' },
              { id: 'list', label: 'Adjacency list' },
              { id: 'matrix', label: 'Adjacency matrix' },
            ] as { id: View; label: string }[]
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setView(m.id)}
              aria-pressed={view === m.id}
              className={`px-3 py-1 text-sm transition ${view === m.id ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted">Click any edge to highlight it everywhere.</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* The graph itself */}
        <div className="rounded-lg border border-edge bg-bg/40 p-2">
          <svg viewBox="0 0 280 210" className="block w-full" role="img" aria-label="graph">
            {EDGES.map(([u, v]) => {
              const a = NODES[u];
              const b = NODES[v];
              const on = isSel(u, v);
              return (
                <line
                  key={`${u}-${v}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  onClick={() => toggle(u, v)}
                  style={{ stroke: on ? 'var(--accent)' : 'var(--border)', cursor: 'pointer' }}
                  strokeWidth={on ? 4 : 2}
                />
              );
            })}
            {NODES.map((nd) => {
              const touched = selPair ? selPair.includes(nd.id) : false;
              return (
                <g key={nd.id}>
                  <circle
                    cx={nd.x}
                    cy={nd.y}
                    r={18}
                    style={{
                      fill: touched ? 'var(--accent)' : 'var(--surface)',
                      stroke: touched ? 'var(--accent)' : 'var(--border)',
                    }}
                    strokeWidth={2.5}
                  />
                  <text
                    x={nd.x}
                    y={nd.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={14}
                    style={{ fill: touched ? 'var(--accent-fg)' : 'var(--fg)', fontFamily: 'var(--font-mono)' }}
                  >
                    {nd.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="flex flex-col gap-4">
          {/* Adjacency list */}
          {showList && (
            <div className="rounded-lg border border-edge bg-bg/40 p-3">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                Adjacency list
              </div>
              <div className="space-y-1 font-mono text-sm">
                {adj.map((nbrs, u) => (
                  <div key={u} className="flex items-center gap-2">
                    <span className="w-5 text-accent">{lbl(u)}</span>
                    <Icon name="arrow-right" size={14} className="text-muted" />
                    <div className="flex flex-wrap gap-1">
                      {nbrs.length === 0 && <span className="text-muted/50">∅</span>}
                      {nbrs.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => toggle(u, v)}
                          className={`flex h-7 w-7 items-center justify-center rounded border transition ${isSel(u, v) ? 'border-accent bg-accent/15 text-accent' : 'border-edge text-fg hover:border-accent'}`}
                        >
                          {lbl(v)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 font-mono text-[11px] text-muted">space O(V + E) · list neighbours O(deg)</div>
            </div>
          )}

          {/* Adjacency matrix */}
          {showMatrix && (
            <div className="rounded-lg border border-edge bg-bg/40 p-3">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                Adjacency matrix
              </div>
              <table className="border-collapse font-mono text-sm">
                <thead>
                  <tr>
                    <th className="h-7 w-7" />
                    {NODES.map((c) => (
                      <th key={c.id} className="h-7 w-7 text-center text-accent">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row, u) => (
                    <tr key={u}>
                      <th className="h-7 w-7 text-center text-accent">{lbl(u)}</th>
                      {row.map((cell, v) => {
                        const on = cell === 1 && isSel(u, v);
                        return (
                          <td key={v} className="p-0">
                            <button
                              type="button"
                              disabled={cell === 0}
                              onClick={() => toggle(u, v)}
                              className={`flex h-7 w-7 items-center justify-center border text-center transition ${
                                on
                                  ? 'border-accent bg-accent text-accent-fg'
                                  : cell === 1
                                    ? 'border-edge text-fg hover:border-accent'
                                    : 'border-edge/40 text-muted/40'
                              }`}
                            >
                              {cell}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-2 font-mono text-[11px] text-muted">space O(V²) · edge lookup O(1)</div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">
        {selPair
          ? `edge ${lbl(selPair[0])}–${lbl(selPair[1])} → list entry in both rows · matrix cells [${lbl(selPair[0])}][${lbl(selPair[1])}] and [${lbl(selPair[1])}][${lbl(selPair[0])}]`
          : `${NODES.length} vertices · ${EDGES.length} edges · select an edge`}
      </div>
    </div>
  );
}
