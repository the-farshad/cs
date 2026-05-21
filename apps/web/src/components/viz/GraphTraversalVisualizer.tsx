import { useMemo, useState } from 'react';
import TreeCanvas, { type VizNode, type VizEdge } from './TreeCanvas';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const NODES = [
  { id: 0, x: 60, y: 150, label: 'A' },
  { id: 1, x: 170, y: 70, label: 'B' },
  { id: 2, x: 170, y: 235, label: 'C' },
  { id: 3, x: 300, y: 60, label: 'D' },
  { id: 4, x: 300, y: 245, label: 'E' },
  { id: 5, x: 430, y: 120, label: 'F' },
  { id: 6, x: 430, y: 240, label: 'G' },
];
const EDGES: [number, number][] = [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4], [3, 5], [4, 5], [4, 6], [5, 6]];

const adj: number[][] = (() => {
  const a = NODES.map(() => [] as number[]);
  for (const [u, v] of EDGES) {
    a[u].push(v);
    a[v].push(u);
  }
  a.forEach((l) => l.sort((x, y) => x - y));
  return a;
})();

type GFrame = { current: number; visited: number[]; frontier: number[] };

function bfs(start: number): GFrame[] {
  const frames: GFrame[] = [{ current: -1, visited: [], frontier: [start] }];
  const q = [start];
  const seen = new Set([start]);
  const done: number[] = [];
  while (q.length) {
    const cur = q.shift()!;
    done.push(cur);
    frames.push({ current: cur, visited: [...done], frontier: [...q] });
    for (const nb of adj[cur]) {
      if (!seen.has(nb)) {
        seen.add(nb);
        q.push(nb);
      }
    }
    frames.push({ current: cur, visited: [...done], frontier: [...q] });
  }
  return frames;
}

function dfs(start: number): GFrame[] {
  const frames: GFrame[] = [{ current: -1, visited: [], frontier: [start] }];
  const st = [start];
  const seen = new Set<number>();
  const done: number[] = [];
  while (st.length) {
    const cur = st.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    done.push(cur);
    frames.push({ current: cur, visited: [...done], frontier: [...st] });
    for (const nb of [...adj[cur]].reverse()) {
      if (!seen.has(nb)) st.push(nb);
    }
    frames.push({ current: cur, visited: [...done], frontier: [...st] });
  }
  return frames;
}

const lbl = (id: number) => NODES[id]?.label ?? '';
const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function GraphTraversalVisualizer() {
  const [algo, setAlgo] = useState<'bfs' | 'dfs'>('bfs');
  const [start, setStart] = useState(0);

  const frames = useMemo(() => (algo === 'bfs' ? bfs(start) : dfs(start)), [algo, start]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 4);
  const frame = frames[Math.min(index, frames.length - 1)] ?? { current: -1, visited: [], frontier: [] };

  const visitedSet = new Set(frame.visited);
  const frontierSet = new Set(frame.frontier);
  const nodes: VizNode[] = NODES.map((nd) => {
    let state = 'default';
    if (frontierSet.has(nd.id)) state = 'compare';
    if (visitedSet.has(nd.id)) state = 'done';
    if (nd.id === frame.current) state = 'active';
    return { id: nd.id, x: nd.x, y: nd.y, label: nd.label, state };
  });
  const edges: VizEdge[] = EDGES.map(([u, v]) => ({ from: u, to: v }));

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded border border-edge">
          {(['bfs', 'dfs'] as const).map((a) => (
            <button key={a} type="button" onClick={() => setAlgo(a)} aria-pressed={algo === a} className={`px-3 py-1 text-sm uppercase transition ${algo === a ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}>
              {a}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          Start
          <select value={start} onChange={(e) => setStart(Number(e.target.value))} className="rounded border border-edge bg-bg px-2 py-1 text-fg">
            {NODES.map((nd) => (
              <option key={nd.id} value={nd.id}>
                {nd.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <TreeCanvas nodes={nodes} edges={edges} width={490} height={300} />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={prev} disabled={index <= 0}>
          <Icon name="chevron-left" size={16} /> Step
        </button>
        <button type="button" onClick={() => (playing ? pause() : play())} className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90">
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
        <input type="range" min={0} max={Math.max(frames.length - 1, 0)} value={index} onChange={(e) => seek(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Timeline" />
        <span className="shrink-0 font-mono text-xs text-muted">{index + 1}/{frames.length}</span>
      </div>

      <div className="mt-4 space-y-1 border-t border-edge pt-4 font-mono text-xs text-muted">
        <div>visited: {frame.visited.map(lbl).join(' ') || '—'}</div>
        <div>{algo === 'bfs' ? 'queue' : 'stack'}: [{frame.frontier.map(lbl).join(', ')}]</div>
      </div>
    </div>
  );
}
