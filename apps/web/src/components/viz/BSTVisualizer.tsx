import { useMemo, useState } from 'react';
import { buildTree, searchFrames, type TreeFrame } from './tree';
import TreeCanvas from './TreeCanvas';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const EMPTY: TreeFrame = { nodes: [], edges: [], width: 760, height: 80 };

export default function BSTVisualizer() {
  const [values, setValues] = useState<number[]>([50, 30, 70, 20, 40, 60, 80]);
  const [avl, setAvl] = useState(false);
  const [mode, setMode] = useState<'build' | 'search'>('build');
  const [target, setTarget] = useState<number | null>(null);
  const [input, setInput] = useState('');

  const { frames: buildF, root } = useMemo(() => buildTree(values, avl), [values, avl]);
  const searchF = useMemo(() => (mode === 'search' && target != null ? searchFrames(root, target) : []), [mode, target, root]);
  const frames = mode === 'search' ? searchF : buildF;

  const { index, playing, fps, setFps, play, pause, next, prev, seek } = useStepper(frames.length, 12, true);
  const frame = frames[Math.min(index, frames.length - 1)] ?? EMPTY;

  const add = () => {
    const v = Number(input);
    if (input.trim() !== '' && !Number.isNaN(v)) {
      setValues((s) => [...s, v]);
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
    setValues((s) => [...s, Math.floor(Math.random() * 99) + 1]);
    setMode('build');
  };
  const clear = () => {
    setValues([]);
    setTarget(null);
    setMode('build');
  };

  const swatch = (style: React.CSSProperties, label: string) => (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-3 w-3 rounded-full" style={style} /> {label}
    </span>
  );

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded border border-edge">
          {[
            { id: false, label: 'BST' },
            { id: true, label: 'AVL (balanced)' },
          ].map((m) => (
            <button
              key={String(m.id)}
              type="button"
              onClick={() => setAvl(m.id)}
              aria-pressed={avl === m.id}
              className={`px-3 py-1 text-sm transition ${avl === m.id ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="value"
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
        <div className="flex h-40 items-center justify-center text-muted">Insert values to build the tree.</div>
      ) : (
        <TreeCanvas nodes={frame.nodes} edges={frame.edges} width={frame.width} height={frame.height} />
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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-edge pt-4 text-xs text-muted">
        <div className="flex flex-wrap gap-3">
          {swatch({ background: '#fbbf24' }, 'compare')}
          {swatch({ background: 'var(--accent)' }, 'inserted')}
          {swatch({ background: '#10b981' }, 'found')}
          {swatch({ background: '#8b5cf6' }, 'rotation')}
        </div>
        <span className="font-mono">{avl ? 'AVL' : 'BST'} · {mode === 'search' ? `search ${target}` : `${values.length} values`}</span>
      </div>
    </div>
  );
}
