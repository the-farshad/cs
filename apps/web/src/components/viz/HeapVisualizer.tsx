import { useMemo, useState } from 'react';
import { heapInsert, heapExtractMin, type HeapFrame } from './heap';
import TreeCanvas, { type VizNode, type VizEdge } from './TreeCanvas';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

type Op = { type: 'insert'; value: number } | { type: 'extract' };

function replay(ops: Op[]): HeapFrame[] {
  let heap: number[] = [];
  const frames: HeapFrame[] = [{ array: [] }];
  for (const op of ops) {
    const gen = op.type === 'insert' ? heapInsert(heap, op.value) : heapExtractMin(heap);
    let last = heap;
    for (const fr of gen) {
      frames.push(fr);
      last = fr.array;
    }
    heap = last;
  }
  return frames;
}

function heapTree(a: number[], marks: Record<number, string>) {
  const n = a.length;
  if (n === 0) return { nodes: [] as VizNode[], edges: [] as VizEdge[], width: 760, height: 80 };
  const order: { i: number; depth: number }[] = [];
  let maxDepth = 0;
  const walk = (i: number, depth: number) => {
    if (i >= n) return;
    walk(2 * i + 1, depth + 1);
    order.push({ i, depth });
    maxDepth = Math.max(maxDepth, depth);
    walk(2 * i + 2, depth + 1);
  };
  walk(0, 0);
  const pos = new Map<number, { x: number; y: number }>();
  order.forEach((o, k) => pos.set(o.i, { x: ((k + 0.5) / n) * 760, y: 28 + o.depth * 64 }));
  const nodes: VizNode[] = [];
  const edges: VizEdge[] = [];
  for (const { i } of order) {
    const p = pos.get(i)!;
    nodes.push({ id: i, x: p.x, y: p.y, label: String(a[i]), state: marks[i] });
    const l = 2 * i + 1;
    const r = 2 * i + 2;
    if (l < n) edges.push({ from: i, to: l });
    if (r < n) edges.push({ from: i, to: r });
  }
  return { nodes, edges, width: 760, height: 28 * 2 + maxDepth * 64 };
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function HeapVisualizer() {
  const [ops, setOps] = useState<Op[]>(() => [5, 3, 8, 1, 9, 2].map((v) => ({ type: 'insert', value: v }) as Op));
  const [input, setInput] = useState('');

  const frames = useMemo(() => replay(ops), [ops]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 12, true);
  const frame = frames[Math.min(index, frames.length - 1)] ?? { array: [] };

  const marks: Record<number, string> = {};
  frame.compare?.forEach((i) => (marks[i] = 'compare'));
  frame.swap?.forEach((i) => (marks[i] = 'active'));
  if (frame.active != null) marks[frame.active] = 'found';

  const tree = heapTree(frame.array, marks);

  const insert = () => {
    const v = Number(input);
    if (input.trim() !== '' && !Number.isNaN(v)) {
      setOps((o) => [...o, { type: 'insert', value: v }]);
      setInput('');
    }
  };
  const insertRandom = () => setOps((o) => [...o, { type: 'insert', value: Math.floor(Math.random() * 99) + 1 }]);
  const extract = () => setOps((o) => [...o, { type: 'extract' }]);
  const clear = () => setOps([]);

  const boxColor = (i: number) => {
    if (marks[i] === 'active') return 'border-accent text-accent';
    if (marks[i] === 'compare') return 'border-amber-400 text-amber-300';
    if (marks[i] === 'found') return 'border-emerald-500 text-emerald-300';
    return 'border-edge text-fg';
  };

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted">Min-heap</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && insert()}
          placeholder="value"
          inputMode="numeric"
          className="w-20 rounded border border-edge bg-bg px-2 py-1 text-fg"
        />
        <button type="button" className={btn} onClick={insert}>
          Insert
        </button>
        <button type="button" className={btn} onClick={insertRandom}>
          <Icon name="shuffle" size={16} /> Random
        </button>
        <button type="button" className={btn} onClick={extract}>
          Extract min
        </button>
        <button type="button" className={btn} onClick={clear}>
          <Icon name="rotate-ccw" size={16} /> Clear
        </button>
      </div>

      {frame.array.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-muted">Insert values to build the heap.</div>
      ) : (
        <TreeCanvas nodes={tree.nodes} edges={tree.edges} width={tree.width} height={tree.height} />
      )}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {frame.array.map((v, i) => (
          <div key={i} className={`flex h-11 w-11 flex-col items-center justify-center rounded border font-mono text-sm ${boxColor(i)}`}>
            <span>{v}</span>
            <span className="text-[10px] text-muted/60">{i}</span>
          </div>
        ))}
      </div>

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
        {frame.array.length > 0 ? `min = ${frame.array[0]}` : 'empty'}
        {frame.note ? ` · ${frame.note}` : ''}
      </div>
    </div>
  );
}
