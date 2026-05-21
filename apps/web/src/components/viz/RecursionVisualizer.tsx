import { useMemo, useState } from 'react';
import TreeCanvas, { type VizNode, type VizEdge } from './TreeCanvas';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

type RNode = { id: number; n: number; value: number; children: RNode[]; cache: boolean };

const WIDTH_PER_LEAF = 56;
const LEVEL = 62;
const TOP = 26;

function buildCallTree(n: number, memo: boolean): RNode {
  let id = 0;
  const fibv: number[] = [0, 1];
  for (let i = 2; i <= n; i++) fibv[i] = fibv[i - 1] + fibv[i - 2];
  const computed = new Set<number>();
  const build = (k: number): RNode => {
    const node: RNode = { id: id++, n: k, value: fibv[k] ?? 0, children: [], cache: false };
    if (memo && computed.has(k)) {
      node.cache = true;
      return node;
    }
    if (k > 1) node.children = [build(k - 1), build(k - 2)];
    computed.add(k);
    return node;
  };
  return build(n);
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function RecursionVisualizer() {
  const [n, setN] = useState(6);
  const [memo, setMemo] = useState(false);

  const { nodesBase, edges, frames, width, height, calls } = useMemo(() => {
    const root = buildCallTree(n, memo);

    const pos = new Map<number, { x: number; depth: number }>();
    let leaf = 0;
    let maxDepth = 0;
    const place = (node: RNode, depth: number) => {
      maxDepth = Math.max(maxDepth, depth);
      if (node.children.length === 0) {
        pos.set(node.id, { x: leaf++, depth });
      } else {
        node.children.forEach((c) => place(c, depth + 1));
        const xs = node.children.map((c) => pos.get(c.id)!.x);
        pos.set(node.id, { x: (Math.min(...xs) + Math.max(...xs)) / 2, depth });
      }
    };
    place(root, 0);

    const leaves = Math.max(leaf, 1);
    const width = Math.max(leaves * WIDTH_PER_LEAF, 320);
    const height = TOP * 2 + maxDepth * LEVEL;

    const nodesBase: { id: number; n: number; value: number; cache: boolean; x: number; y: number }[] = [];
    const edges: VizEdge[] = [];
    const collect = (node: RNode) => {
      const p = pos.get(node.id)!;
      nodesBase.push({ id: node.id, n: node.n, value: node.value, cache: node.cache, x: ((p.x + 0.5) / leaves) * width, y: TOP + p.depth * LEVEL });
      node.children.forEach((c) => {
        edges.push({ from: node.id, to: c.id });
        collect(c);
      });
    };
    collect(root);

    const events: { id: number; type: 'enter' | 'exit' }[] = [];
    const dfs = (node: RNode) => {
      events.push({ id: node.id, type: 'enter' });
      node.children.forEach(dfs);
      events.push({ id: node.id, type: 'exit' });
    };
    dfs(root);

    const frames: { active: number; stack: number[]; returned: number[] }[] = [];
    const stack: number[] = [];
    const returned = new Set<number>();
    for (const e of events) {
      if (e.type === 'enter') {
        stack.push(e.id);
        frames.push({ active: e.id, stack: [...stack], returned: [...returned] });
      } else {
        returned.add(e.id);
        frames.push({ active: e.id, stack: [...stack], returned: [...returned] });
        stack.pop();
      }
    }

    return { nodesBase, edges, frames, width, height, calls: nodesBase.length };
  }, [n, memo]);

  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 6);
  const frame = frames[Math.min(index, frames.length - 1)] ?? { active: -1, stack: [], returned: [] };
  const returnedSet = new Set(frame.returned);

  const nodes: VizNode[] = nodesBase.map((nb) => {
    let state = 'default';
    if (nb.cache) state = 'cache';
    if (returnedSet.has(nb.id)) state = 'done';
    if (nb.id === frame.active) state = 'active';
    return {
      id: nb.id,
      x: nb.x,
      y: nb.y,
      label: String(nb.n),
      sub: returnedSet.has(nb.id) || nb.cache ? `=${nb.value}` : undefined,
      state,
    };
  });

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          fib(n), n = {n}
          <input type="range" min={1} max={8} value={n} onChange={(e) => setN(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={memo} onChange={(e) => setMemo(e.target.checked)} className="accent-[var(--accent)]" />
          Memoize
        </label>
      </div>

      <TreeCanvas nodes={nodes} edges={edges} width={width} height={height} r={16} />

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
          <input type="range" min={1} max={30} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
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

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">
        total calls: {calls}
        {memo ? ' (memoized — repeated subproblems are cached, not recomputed)' : ' (naive — the same subproblems are recomputed many times)'}
      </div>
    </div>
  );
}
