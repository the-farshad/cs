import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

type TrieNode = {
  id: number;
  ch: string; // '' for the root
  end: boolean; // a word ends here
  children: Map<string, TrieNode>;
};

let _id = 0;
function makeNode(ch: string): TrieNode {
  return { id: _id++, ch, end: false, children: new Map() };
}

type Op = { type: 'insert' | 'search'; word: string };

type TFrame = {
  // Snapshot of the layout for this frame.
  nodes: LayoutNode[];
  edges: { from: number; to: number; on: boolean }[];
  pathIds: number[]; // nodes currently highlighted
  cursorId?: number; // node we are sitting on
  marker?: 'insert' | 'hit' | 'miss';
  note: string;
};

type LayoutNode = { id: number; x: number; y: number; ch: string; end: boolean };

const LEVEL_H = 64;
const NODE_R = 16;

/** Assign x by an in-order-ish sweep so siblings spread out; y by depth. */
function layout(root: TrieNode): { nodes: Map<number, LayoutNode>; width: number; height: number } {
  const nodes = new Map<number, LayoutNode>();
  let leaf = 0;
  let maxDepth = 0;
  const place = (n: TrieNode, depth: number): number => {
    maxDepth = Math.max(maxDepth, depth);
    const kids = [...n.children.values()].sort((a, b) => a.ch.localeCompare(b.ch));
    let x: number;
    if (kids.length === 0) {
      x = leaf * 56 + 28;
      leaf += 1;
    } else {
      const xs = kids.map((k) => place(k, depth + 1));
      x = xs.reduce((s, v) => s + v, 0) / xs.length;
    }
    nodes.set(n.id, { id: n.id, x, y: depth * LEVEL_H + 28, ch: n.ch, end: n.end });
    return x;
  };
  place(root, 0);
  const width = Math.max(leaf * 56, 120);
  const height = (maxDepth + 1) * LEVEL_H;
  return { nodes, width, height };
}

function snapshot(
  root: TrieNode,
  extra: { pathIds?: number[]; cursorId?: number; marker?: TFrame['marker']; note: string },
): TFrame {
  const { nodes } = layout(root);
  const layoutNodes = [...nodes.values()];
  const pathIds = extra.pathIds ?? [];
  const pathSet = new Set(pathIds);
  const edges: TFrame['edges'] = [];
  const walk = (n: TrieNode) => {
    for (const c of n.children.values()) {
      edges.push({ from: n.id, to: c.id, on: pathSet.has(n.id) && pathSet.has(c.id) });
      walk(c);
    }
  };
  walk(root);
  return {
    nodes: layoutNodes,
    edges,
    pathIds,
    cursorId: extra.cursorId,
    marker: extra.marker,
    note: extra.note,
  };
}

function buildFrames(ops: Op[]): TFrame[] {
  _id = 0;
  const root = makeNode('');
  const frames: TFrame[] = [snapshot(root, { note: 'empty trie (root)' })];

  for (const op of ops) {
    const w = op.word;
    if (op.type === 'insert') {
      let cur = root;
      const path = [root.id];
      frames.push(snapshot(root, { pathIds: [...path], cursorId: root.id, note: `insert "${w}"` }));
      for (const ch of w) {
        let nxt = cur.children.get(ch);
        const created = !nxt;
        if (!nxt) {
          nxt = makeNode(ch);
          cur.children.set(ch, nxt);
        }
        cur = nxt;
        path.push(cur.id);
        frames.push(
          snapshot(root, {
            pathIds: [...path],
            cursorId: cur.id,
            marker: 'insert',
            note: created ? `add node '${ch}'` : `'${ch}' already exists — descend`,
          }),
        );
      }
      cur.end = true;
      frames.push(
        snapshot(root, {
          pathIds: [...path],
          cursorId: cur.id,
          marker: 'insert',
          note: `mark end of word "${w}"`,
        }),
      );
    } else {
      let cur: TrieNode | undefined = root;
      const path = [root.id];
      frames.push(snapshot(root, { pathIds: [...path], cursorId: root.id, note: `search "${w}"` }));
      let failed = false;
      for (const ch of w) {
        const nxt: TrieNode | undefined = cur?.children.get(ch);
        if (!nxt) {
          failed = true;
          frames.push(
            snapshot(root, {
              pathIds: [...path],
              cursorId: cur?.id,
              marker: 'miss',
              note: `no edge '${ch}' — "${w}" is absent`,
            }),
          );
          break;
        }
        cur = nxt;
        path.push(cur.id);
        frames.push(
          snapshot(root, {
            pathIds: [...path],
            cursorId: cur.id,
            note: `follow '${ch}'`,
          }),
        );
      }
      if (!failed) {
        const isWord = cur?.end ?? false;
        frames.push(
          snapshot(root, {
            pathIds: [...path],
            cursorId: cur?.id,
            marker: isWord ? 'hit' : 'miss',
            note: isWord
              ? `found word "${w}"`
              : `"${w}" is only a prefix, not a stored word`,
          }),
        );
      }
    }
  }
  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function TrieVisualizer() {
  const [ops, setOps] = useState<Op[]>(() =>
    ['cat', 'car', 'card', 'dog'].map((word) => ({ type: 'insert', word }) as Op),
  );
  const [input, setInput] = useState('');

  const frames = useMemo(() => buildFrames(ops), [ops]);
  const { index, playing, fps, setFps, play, pause, next, prev, seek } = useStepper(
    frames.length,
    3,
  );
  const frame = frames[Math.min(index, frames.length - 1)] ?? {
    nodes: [],
    edges: [],
    pathIds: [],
    note: '',
  };

  const clean = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '').slice(0, 8);

  const insert = () => {
    const w = clean(input);
    if (w) {
      setOps((o) => [...o, { type: 'insert', word: w }]);
      setInput('');
    }
  };
  const search = () => {
    const w = clean(input);
    if (w) setOps((o) => [...o, { type: 'search', word: w }]);
  };
  const clear = () => setOps([]);

  const pathSet = new Set(frame.pathIds);
  const width = Math.max(...frame.nodes.map((n) => n.x), 120) + 28;
  const height = Math.max(...frame.nodes.map((n) => n.y), 28) + 36;

  const fillFor = (n: LayoutNode): string => {
    if (n.id === frame.cursorId) {
      if (frame.marker === 'hit') return '#10b981';
      if (frame.marker === 'miss') return '#f43f5e';
      if (frame.marker === 'insert') return 'var(--accent)';
      return 'var(--accent)';
    }
    if (pathSet.has(n.id)) return 'color-mix(in oklab, var(--accent) 16%, var(--surface))';
    return 'var(--surface)';
  };
  const strokeFor = (n: LayoutNode): string => {
    if (n.id === frame.cursorId) {
      if (frame.marker === 'hit') return '#10b981';
      if (frame.marker === 'miss') return '#f43f5e';
      return 'var(--accent)';
    }
    if (n.end) return '#10b981';
    if (pathSet.has(n.id)) return 'var(--accent)';
    return 'var(--border)';
  };
  const textFor = (n: LayoutNode): string =>
    n.id === frame.cursorId && (frame.marker === 'insert' || !frame.marker)
      ? 'var(--accent-fg)'
      : n.id === frame.cursorId && frame.marker === 'hit'
        ? '#04140d'
        : 'var(--fg)';

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && insert()}
          placeholder="word"
          className="w-28 rounded border border-edge bg-bg px-2 py-1 font-mono text-fg"
        />
        <button type="button" className={btn} onClick={insert}>
          Insert
        </button>
        <button type="button" className={btn} onClick={search}>
          <Icon name="target" size={16} /> Search
        </button>
        <button type="button" className={btn} onClick={clear}>
          <Icon name="rotate-ccw" size={16} /> Clear
        </button>
      </div>

      {frame.nodes.length <= 1 ? (
        <div className="flex h-40 items-center justify-center text-muted">
          Insert words to grow the trie.
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="mx-auto block w-full"
          style={{ maxHeight: '24rem' }}
          role="img"
          aria-label="trie"
        >
          {frame.edges.map((e, i) => {
            const a = frame.nodes.find((n) => n.id === e.from);
            const b = frame.nodes.find((n) => n.id === e.to);
            if (!a || !b) return null;
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                style={{ stroke: e.on ? 'var(--accent)' : 'var(--border)' }}
                strokeWidth={e.on ? 3 : 2}
              />
            );
          })}
          {frame.nodes.map((n) => (
            <g key={n.id}>
              {/* second ring marks end-of-word nodes */}
              {n.end && (
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={NODE_R + 3.5}
                  fill="none"
                  style={{ stroke: '#10b981' }}
                  strokeWidth={1.5}
                />
              )}
              <circle
                cx={n.x}
                cy={n.y}
                r={NODE_R}
                style={{ fill: fillFor(n), stroke: strokeFor(n) }}
                strokeWidth={2.5}
              />
              <text
                x={n.x}
                y={n.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={14}
                style={{ fill: n.ch === '' ? 'var(--muted)' : textFor(n), fontFamily: 'var(--font-mono)' }}
              >
                {n.ch === '' ? '•' : n.ch}
              </text>
            </g>
          ))}
        </svg>
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
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input
            type="range"
            min={1}
            max={20}
            value={fps}
            onChange={(e) => setFps(Number(e.target.value))}
            className="accent-[var(--accent)]"
          />
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
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full border-2" style={{ borderColor: '#10b981' }} />
          end of word
        </span>
        <span className="font-mono">{frame.note}</span>
      </div>
    </div>
  );
}
