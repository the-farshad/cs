import { useMemo } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

type Node = { id: number; x: number; y: number; label: string };

const NODES: Node[] = [
  { id: 0, x: 70, y: 70, label: 'A' },
  { id: 1, x: 210, y: 60, label: 'B' },
  { id: 2, x: 140, y: 170, label: 'C' },
  { id: 3, x: 350, y: 70, label: 'D' },
  { id: 4, x: 470, y: 140, label: 'E' },
  { id: 5, x: 360, y: 210, label: 'F' },
  { id: 6, x: 210, y: 260, label: 'G' },
];

// Directed edges. Designed to yield three SCCs:
//   {A,B,C} (a 3-cycle), {D,E,F} (a 3-cycle), {G} (singleton).
// Cross-edges only ever point "downhill" SCC2 -> SCC1 and -> G, so no two
// components merge: {A,B,C} is a sink, G is a sink, and {A,B,C} can never reach
// {D,E,F} or G.
const EDGES: [number, number][] = [
  [0, 1], // A->B
  [1, 2], // B->C
  [2, 0], // C->A   (closes cycle 1: {A,B,C})
  [3, 4], // D->E
  [4, 5], // E->F
  [5, 3], // F->D   (closes cycle 2: {D,E,F})
  [3, 0], // D->A   (bridge SCC2 -> SCC1, one direction only)
  [5, 6], // F->G   (bridge SCC2 -> singleton G)
  [6, 2], // G->C   (back-edge into SCC1; G is a sink so SCCs stay separate)
];

// Distinct colors for components.
const COMP_COLORS = ['#38bdf8', '#fbbf24', '#8b5cf6', '#10b981', '#f43f5e'];

type Phase = 'pass1' | 'pass2';

type Frame = {
  phase: Phase;
  active: number; // node currently visited, -1 none
  visited1: Set<number>; // pass-1 visited
  order: number[]; // finish stack so far (pass 1)
  comp: Record<number, number>; // node -> component index (pass 2)
  activeEdge: number; // edge index highlighted, -1
  note: string;
};

function kosaraju(): Frame[] {
  const n = NODES.length;
  const adj: number[][] = NODES.map(() => []);
  const radj: number[][] = NODES.map(() => []);
  EDGES.forEach(([u, v]) => {
    adj[u].push(v);
    radj[v].push(u);
  });
  adj.forEach((l) => l.sort((a, b) => a - b));
  radj.forEach((l) => l.sort((a, b) => a - b));

  const frames: Frame[] = [];
  const visited1 = new Set<number>();
  const order: number[] = [];
  const comp: Record<number, number> = {};

  const snap = (active: number, activeEdge: number, note: string, phase: Phase) =>
    frames.push({
      phase,
      active,
      visited1: new Set(visited1),
      order: [...order],
      comp: { ...comp },
      activeEdge,
      note,
    });

  const edgeIdx = (u: number, v: number) => EDGES.findIndex(([a, b]) => a === u && b === v);

  snap(-1, -1, 'Pass 1: run DFS on the original graph; push each node onto a stack when it finishes.', 'pass1');

  // ---- Pass 1: DFS, record finish order (iterative to keep frames linear) ----
  function dfs1(start: number) {
    const stack: { node: number; idx: number }[] = [{ node: start, idx: 0 }];
    visited1.add(start);
    snap(start, -1, `visit ${NODES[start].label}`, 'pass1');
    while (stack.length) {
      const top = stack[stack.length - 1];
      if (top.idx < adj[top.node].length) {
        const next = adj[top.node][top.idx++];
        if (!visited1.has(next)) {
          visited1.add(next);
          snap(next, edgeIdx(top.node, next), `follow ${NODES[top.node].label}→${NODES[next].label}, visit ${NODES[next].label}`, 'pass1');
          stack.push({ node: next, idx: 0 });
        }
      } else {
        order.push(top.node);
        snap(top.node, -1, `${NODES[top.node].label} finished — push onto stack (order: ${order.map((i) => NODES[i].label).join(' ')})`, 'pass1');
        stack.pop();
      }
    }
  }
  for (let i = 0; i < n; i++) if (!visited1.has(i)) dfs1(i);

  snap(-1, -1, `Pass 1 done. Finish stack (top last): ${order.map((i) => NODES[i].label).join(' ')}.`, 'pass1');
  snap(-1, -1, 'Pass 2: pop nodes from the stack; DFS on the REVERSED graph. Each tree is one SCC.', 'pass2');

  // ---- Pass 2: DFS on transpose, in reverse finish order ----
  const visited2 = new Set<number>();
  let compCount = 0;
  function dfs2(start: number, c: number) {
    const stack = [start];
    visited2.add(start);
    comp[start] = c;
    snap(start, -1, `new component ${c + 1}: start at ${NODES[start].label}`, 'pass2');
    while (stack.length) {
      const u = stack.pop()!;
      for (const v of radj[u]) {
        if (!visited2.has(v)) {
          visited2.add(v);
          comp[v] = c;
          snap(v, edgeIdx(v, u), `reversed edge reaches ${NODES[v].label} — add to component ${c + 1}`, 'pass2');
          stack.push(v);
        }
      }
    }
  }
  for (let k = order.length - 1; k >= 0; k--) {
    const node = order[k];
    if (!visited2.has(node)) {
      dfs2(node, compCount);
      compCount++;
    }
  }

  snap(-1, -1, `Done — found ${compCount} strongly-connected components, each shown in its own color.`, 'pass2');
  return frames;
}

export default function SccVisualizer() {
  const frames = useMemo(kosaraju, []);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 3);
  const frame = frames[Math.min(index, frames.length - 1)] ?? frames[0];

  const W = 540;
  const H = 300;
  const r = 18;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3 text-sm text-muted">
        A strongly-connected component is a maximal set of nodes where every node can reach every
        other. Kosaraju runs two DFS passes.
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block w-full" style={{ maxHeight: '24rem' }} role="img" aria-label="strongly connected components">
        <defs>
          <marker id="scc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: 'var(--border)' }} />
          </marker>
          <marker id="scc-arrow-hot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: 'var(--accent)' }} />
          </marker>
        </defs>
        {EDGES.map(([u, v], i) => {
          const a = NODES[u];
          const b = NODES[v];
          if (u === v) return null;
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
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              markerEnd={active ? 'url(#scc-arrow-hot)' : 'url(#scc-arrow)'}
              style={{ stroke: active ? 'var(--accent)' : 'var(--border)' }}
              strokeWidth={active ? 3 : 1.8}
            />
          );
        })}
        {NODES.map((n) => {
          const active = frame.active === n.id;
          const compId = frame.comp[n.id];
          const inComp = compId !== undefined;
          const visited1 = frame.phase === 'pass1' && frame.visited1.has(n.id);
          let fill = 'var(--surface)';
          let stroke = 'var(--border)';
          let text = 'var(--fg)';
          if (visited1) {
            stroke = '#38bdf8';
          }
          if (inComp) {
            const c = COMP_COLORS[compId % COMP_COLORS.length];
            fill = `color-mix(in oklab, ${c} 30%, var(--surface))`;
            stroke = c;
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

      <div className="mt-4 space-y-1 border-t border-edge pt-4 font-mono text-xs text-muted">
        <div>
          phase: {frame.phase === 'pass1' ? 'DFS on original (record finish order)' : 'DFS on reversed graph (label components)'}
        </div>
        <div>{frame.note}</div>
      </div>
    </div>
  );
}
