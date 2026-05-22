import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// A B-tree of a given order (max children). A node holds up to order-1 keys.
type BNode = {
  id: number;
  keys: number[];
  children: BNode[]; // empty => leaf
  parent: BNode | null;
};

type RenderNode = { id: number; x: number; y: number; keys: number[]; state?: string };
type RenderEdge = { from: number; to: number };
type Frame = {
  nodes: RenderNode[];
  edges: RenderEdge[];
  width: number;
  height: number;
  note: string;
  highlightKey?: number; // a key cell to emphasize within a node
  highlightNode?: number;
};

const NODE_H = 30;
const KEY_W = 30;
const LEVEL = 78;
const TOP = 26;

// Lay the tree out: x by in-order leaf position, y by depth. Recompute every snapshot.
function layout(root: BNode | null, opts: { note: string; highlightNode?: number; highlightKey?: number; nodeState?: Record<number, string> } ): Frame {
  const note = opts.note;
  const nodeState = opts.nodeState ?? {};
  if (!root) return { nodes: [], edges: [], width: 720, height: 80, note };

  // Assign each node a horizontal slot based on the order of leaves under it.
  let leafCounter = 0;
  let maxDepth = 0;
  const xOf = new Map<number, number>();
  const depthOf = new Map<number, number>();

  const assign = (n: BNode, depth: number): number => {
    depthOf.set(n.id, depth);
    maxDepth = Math.max(maxDepth, depth);
    if (n.children.length === 0) {
      const slot = leafCounter++;
      xOf.set(n.id, slot);
      return slot;
    }
    const childSlots = n.children.map((c) => assign(c, depth + 1));
    const center = (childSlots[0] + childSlots[childSlots.length - 1]) / 2;
    xOf.set(n.id, center);
    return center;
  };
  assign(root, 0);

  const slots = Math.max(leafCounter, 1);
  const gap = 90; // horizontal spacing per leaf slot
  const width = Math.max(slots * gap, 360);

  const nodes: RenderNode[] = [];
  const edges: RenderEdge[] = [];

  const place = (n: BNode) => {
    const slot = xOf.get(n.id)!;
    const depth = depthOf.get(n.id)!;
    const cx = ((slot + 0.5) / slots) * width;
    const cy = TOP + depth * LEVEL;
    nodes.push({ id: n.id, x: cx, y: cy, keys: n.keys, state: nodeState[n.id] });
    for (const c of n.children) {
      edges.push({ from: n.id, to: c.id });
      place(c);
    }
  };
  place(root);

  return {
    nodes,
    edges,
    width,
    height: TOP * 2 + maxDepth * LEVEL + NODE_H,
    note,
    highlightNode: opts.highlightNode,
    highlightKey: opts.highlightKey,
  };
}

// deep clone for an independent, parent-free snapshot (parent pointers would
// create cycles and aren't needed for layout).
function cloneTree(n: BNode | null): BNode | null {
  if (!n) return null;
  return { id: n.id, keys: [...n.keys], children: n.children.map((c) => cloneTree(c)!), parent: null };
}

// Bottom-up insert: drop the key into a leaf, then split any node that overflows
// (more than order-1 keys), pushing the median up. Correct for any order.
function buildInsertFrames(keys: number[], order: number): { frames: Frame[]; root: BNode | null } {
  const maxKeys = order - 1;
  let idc = 0;
  let root: BNode | null = null;
  const frames: Frame[] = [];

  const snap = (o: Parameters<typeof layout>[1]) => frames.push(layout(cloneTree(root), o));

  snap({ note: 'Empty tree. Insert keys to watch nodes fill and split.' });

  // Walk down to the correct leaf for `key`, snapping each comparison.
  const findLeaf = (key: number): BNode | null => {
    let node = root!;
    while (node.children.length > 0) {
      let i = 0;
      while (i < node.keys.length && key > node.keys[i]) i++;
      if (node.keys[i] === key) return null; // duplicate
      snap({ note: `Compare ${key} against [${node.keys.join(', ')}] — descend to child ${i + 1}.`, nodeState: { [node.id]: 'compare' } });
      node = node.children[i];
    }
    return node;
  };

  // Split an overflowing node; recurse upward if the parent now overflows too.
  const splitIfNeeded = (node: BNode) => {
    if (node.keys.length <= maxKeys) return;
    const mid = Math.floor(node.keys.length / 2);
    const upKey = node.keys[mid];
    const rightKeys = node.keys.slice(mid + 1);
    const rightChildren = node.children.length ? node.children.slice(mid + 1) : [];
    node.keys = node.keys.slice(0, mid);
    const right: BNode = { id: idc++, keys: rightKeys, children: rightChildren, parent: node.parent };
    node.children = node.children.length ? node.children.slice(0, mid + 1) : [];
    right.children.forEach((c) => (c.parent = right));

    if (!node.parent) {
      // grow a new root — the tree gets one level taller
      const newRoot: BNode = { id: idc++, keys: [upKey], children: [node, right], parent: null };
      node.parent = newRoot;
      right.parent = newRoot;
      root = newRoot;
      snap({ note: `Node overflowed — median ${upKey} becomes a new root; the tree grows taller.`, nodeState: { [newRoot.id]: 'active' } });
      return;
    }

    const parent = node.parent;
    const idx = parent.children.indexOf(node);
    parent.keys.splice(idx, 0, upKey);
    parent.children.splice(idx + 1, 0, right);
    snap({ note: `Node overflowed — split it and push median ${upKey} up into the parent.`, nodeState: { [parent.id]: 'active', [right.id]: 'split' } });
    splitIfNeeded(parent);
  };

  for (const key of keys) {
    if (!root) {
      root = { id: idc++, keys: [key], children: [], parent: null };
      snap({ note: `Create the root with ${key}.`, highlightNode: root.id, highlightKey: key, nodeState: { [root.id]: 'active' } });
      continue;
    }
    snap({ note: `Insert ${key}: start at the root.`, nodeState: { [root.id]: 'compare' } });
    const leaf = findLeaf(key);
    if (!leaf) {
      snap({ note: `${key} is already present — B-trees hold each key once.`, highlightKey: key });
      continue;
    }
    let i = leaf.keys.length - 1;
    while (i >= 0 && key < leaf.keys[i]) i--;
    leaf.keys.splice(i + 1, 0, key);
    snap({ note: `Place ${key} into a leaf (keys stay sorted).`, highlightNode: leaf.id, highlightKey: key, nodeState: { [leaf.id]: 'active' } });
    splitIfNeeded(leaf);
  }

  snap({ note: `All keys inserted. The tree stays balanced — every leaf is at the same depth.` });
  return { frames, root: cloneTree(root) };
}

// Search-path frames over the final tree.
function buildSearchFrames(root: BNode | null, target: number): Frame[] {
  const frames: Frame[] = [];
  const snap = (o: Parameters<typeof layout>[1]) => frames.push(layout(cloneTree(root), o));
  if (!root) {
    snap({ note: 'Tree is empty.' });
    return frames;
  }
  snap({ note: `Search for ${target}: begin at the root.` });
  let node: BNode | null = root;
  while (node) {
    let i = 0;
    while (i < node.keys.length && target > node.keys[i]) i++;
    if (i < node.keys.length && node.keys[i] === target) {
      snap({ note: `Found ${target}.`, highlightNode: node.id, highlightKey: target, nodeState: { [node.id]: 'found' } });
      return frames;
    }
    if (node.children.length === 0) {
      snap({ note: `${target} is not in the tree (reached a leaf without a match).`, nodeState: { [node.id]: 'miss' } });
      return frames;
    }
    snap({ note: `${target} ${i < node.keys.length ? `< ${node.keys[i]}` : `> ${node.keys[node.keys.length - 1]}`} — follow child ${i + 1}.`, nodeState: { [node.id]: 'compare' } });
    node = node.children[i];
  }
  return frames;
}

const STATE_STYLE: Record<string, { fill: string; stroke: string; text: string }> = {
  default: { fill: 'var(--surface)', stroke: 'var(--border)', text: 'var(--fg)' },
  compare: { fill: 'var(--surface)', stroke: '#fbbf24', text: 'var(--fg)' },
  active: { fill: 'var(--accent)', stroke: 'var(--accent)', text: 'var(--accent-fg)' },
  split: { fill: 'var(--surface)', stroke: '#8b5cf6', text: 'var(--fg)' },
  found: { fill: '#10b981', stroke: '#10b981', text: '#04140d' },
  miss: { fill: 'var(--surface)', stroke: '#f43f5e', text: 'var(--fg)' },
};

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function BTreeVisualizer() {
  const [keys, setKeys] = useState<number[]>([10, 20, 5, 6, 12, 30, 7, 17, 3, 25]);
  const [order, setOrder] = useState(3);
  const [mode, setMode] = useState<'build' | 'search'>('build');
  const [target, setTarget] = useState<number | null>(null);
  const [input, setInput] = useState('');

  const { frames: buildF, root } = useMemo(() => buildInsertFrames(keys, order), [keys, order]);
  const searchF = useMemo(() => (mode === 'search' && target != null ? buildSearchFrames(root, target) : []), [mode, target, root]);
  const frames = mode === 'search' ? searchF : buildF;

  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 3);
  const frame = frames[Math.min(index, frames.length - 1)] ?? { nodes: [], edges: [], width: 720, height: 80, note: '' };

  const nodeById = new Map(frame.nodes.map((n) => [n.id, n]));

  const add = () => {
    const v = Number(input);
    if (input.trim() !== '' && !Number.isNaN(v)) {
      setKeys((s) => [...s, v]);
      setMode('build');
      setInput('');
    }
  };
  const find = () => {
    const v = Number(input);
    if (input.trim() !== '' && !Number.isNaN(v)) {
      setTarget(v);
      setMode('search');
    }
  };
  const addRandom = () => {
    setKeys((s) => [...s, Math.floor(Math.random() * 98) + 1]);
    setMode('build');
  };
  const clear = () => {
    setKeys([]);
    setTarget(null);
    setMode('build');
  };

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded border border-edge">
          {[3, 4].map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOrder(o)}
              aria-pressed={order === o}
              className={`px-3 py-1 text-sm transition ${order === o ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}
            >
              order {o}
            </button>
          ))}
        </div>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="key"
          inputMode="numeric"
          className="w-20 rounded border border-edge bg-bg px-2 py-1 text-fg"
        />
        <button type="button" className={btn} onClick={add}>
          Insert
        </button>
        <button type="button" className={btn} onClick={find}>
          <Icon name="target" size={16} /> Find
        </button>
        <button type="button" className={btn} onClick={addRandom}>
          <Icon name="shuffle" size={16} /> Random
        </button>
        <button type="button" className={btn} onClick={clear}>
          <Icon name="rotate-ccw" size={16} /> Clear
        </button>
      </div>

      {frame.nodes.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-muted">Insert keys to build the B-tree.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-edge bg-bg/40">
          <svg viewBox={`0 0 ${frame.width} ${Math.max(frame.height, 1)}`} className="mx-auto block w-full" style={{ minWidth: frame.width > 720 ? frame.width : undefined, maxHeight: '26rem' }} role="img" aria-label="B-tree">
            {frame.edges.map((e, i) => {
              const a = nodeById.get(e.from);
              const b = nodeById.get(e.to);
              if (!a || !b) return null;
              return <line key={i} x1={a.x} y1={a.y + NODE_H / 2} x2={b.x} y2={b.y - NODE_H / 2} style={{ stroke: 'var(--border)' }} strokeWidth={2} />;
            })}
            {frame.nodes.map((n) => {
              const style = STATE_STYLE[n.state ?? 'default'] ?? STATE_STYLE.default;
              const w = Math.max(n.keys.length, 1) * KEY_W;
              const x0 = n.x - w / 2;
              return (
                <g key={n.id}>
                  <rect x={x0} y={n.y - NODE_H / 2} width={w} height={NODE_H} rx={5} style={{ fill: style.fill, stroke: style.stroke }} strokeWidth={2.5} />
                  {n.keys.map((k, ki) => {
                    const cellX = x0 + ki * KEY_W;
                    const isHi = frame.highlightNode === n.id && frame.highlightKey === k;
                    return (
                      <g key={ki}>
                        {ki > 0 && <line x1={cellX} y1={n.y - NODE_H / 2} x2={cellX} y2={n.y + NODE_H / 2} style={{ stroke: style.stroke }} strokeWidth={1} opacity={0.5} />}
                        <text
                          x={cellX + KEY_W / 2}
                          y={n.y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={13}
                          fontWeight={isHi ? 700 : 400}
                          style={{ fill: style.text, fontFamily: 'var(--font-mono)' }}
                        >
                          {k}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>
      )}

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

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-fg">{frame.note}</div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <div className="flex flex-wrap gap-3">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm border-2" style={{ borderColor: '#fbbf24' }} /> compare
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: 'var(--accent)' }} /> inserted
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm border-2" style={{ borderColor: '#8b5cf6' }} /> split
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: '#10b981' }} /> found
          </span>
        </div>
        <span className="font-mono">
          order {order} (max {order - 1} keys/node) · {mode === 'search' ? `search ${target}` : `${keys.length} keys`}
        </span>
      </div>
    </div>
  );
}
