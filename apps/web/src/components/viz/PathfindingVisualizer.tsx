import { useEffect, useMemo, useRef, useState } from 'react';
import { PATHFINDERS, type PathKey, type Grid } from './pathfinding';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const ROWS = 15;
const COLS = 29;
const DEFAULT_START = 7 * COLS + 4;
const DEFAULT_END = 7 * COLS + 24;

type Tool = 'wall' | 'erase' | 'start' | 'end';

const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: 'wall', label: 'Wall', icon: 'square' },
  { id: 'erase', label: 'Erase', icon: 'eraser' },
  { id: 'start', label: 'Start', icon: 'flag' },
  { id: 'end', label: 'End', icon: 'target' },
];

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function PathfindingVisualizer() {
  const [algo, setAlgo] = useState<PathKey>('astar');
  const [tool, setTool] = useState<Tool>('wall');
  const [walls, setWalls] = useState<Set<number>>(() => new Set());
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);
  const drawing = useRef(false);

  const trace = useMemo(() => {
    const grid: Grid = { rows: ROWS, cols: COLS, walls, start, end };
    return PATHFINDERS[algo].fn(grid);
  }, [algo, walls, start, end]);

  const total = trace.order.length + trace.path.length;
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(total, 30);

  useEffect(() => {
    reset();
  }, [algo, walls, start, end, reset]);

  useEffect(() => {
    const up = () => {
      drawing.current = false;
    };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  const exploreCount = Math.min(index + 1, trace.order.length);
  const visited = useMemo(() => new Set(trace.order.slice(0, exploreCount)), [trace, exploreCount]);
  const current = index < trace.order.length ? trace.order[index] : -1;
  const pathCount = index >= trace.order.length ? index - trace.order.length + 1 : 0;
  const pathSet = useMemo(() => new Set(trace.path.slice(0, pathCount)), [trace, pathCount]);

  const applyTool = (i: number) => {
    if (tool === 'wall') {
      if (i !== start && i !== end) setWalls((w) => new Set(w).add(i));
    } else if (tool === 'erase') {
      setWalls((w) => {
        const n = new Set(w);
        n.delete(i);
        return n;
      });
    } else if (tool === 'start') {
      if (i !== end && !walls.has(i)) setStart(i);
    } else if (tool === 'end') {
      if (i !== start && !walls.has(i)) setEnd(i);
    }
  };

  const onDown = (i: number) => {
    drawing.current = true;
    applyTool(i);
  };
  const onEnter = (i: number) => {
    if (drawing.current && (tool === 'wall' || tool === 'erase')) applyTool(i);
  };

  const cellClass = (i: number): string => {
    if (i === start) return 'bg-emerald-500';
    if (i === end) return 'bg-rose-500';
    if (walls.has(i)) return 'bg-slate-700';
    if (pathSet.has(i)) return 'bg-[var(--accent)]';
    if (i === current) return 'bg-amber-400';
    if (visited.has(i)) return 'bg-sky-500/40';
    return 'bg-[var(--surface)]';
  };

  const finished = total > 0 && index >= total - 1;
  const reachable = trace.path.length > 0;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          Algorithm
          <select value={algo} onChange={(e) => setAlgo(e.target.value as PathKey)} className="rounded border border-edge bg-bg px-2 py-1 text-fg">
            {(Object.keys(PATHFINDERS) as PathKey[]).map((k) => (
              <option key={k} value={k}>
                {PATHFINDERS[k].label}
              </option>
            ))}
          </select>
        </label>

        <div className="inline-flex overflow-hidden rounded border border-edge">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTool(t.id)}
              aria-pressed={tool === t.id}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-sm transition ${
                tool === t.id ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'
              }`}
            >
              <Icon name={t.icon} size={15} /> {t.label}
            </button>
          ))}
        </div>

        <button type="button" className={btn} onClick={() => setWalls(new Set())}>
          Clear walls
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => {
            setWalls(new Set());
            setStart(DEFAULT_START);
            setEnd(DEFAULT_END);
          }}
        >
          <Icon name="rotate-ccw" size={15} /> Reset grid
        </button>
      </div>

      <div
        className="grid w-full select-none gap-px overflow-hidden rounded-md"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
        onMouseLeave={() => {
          drawing.current = false;
        }}
      >
        {Array.from({ length: ROWS * COLS }, (_, i) => (
          <div
            key={i}
            onMouseDown={(e) => {
              e.preventDefault();
              onDown(i);
            }}
            onMouseEnter={() => onEnter(i)}
            className={`aspect-square cursor-pointer ${cellClass(i)}`}
          />
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
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Visualize'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= total - 1}>
          Step <Icon name="chevron-right" size={16} />
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={1} max={60} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={Math.max(total - 1, 0)}
          value={index}
          onChange={(e) => seek(Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
          aria-label="Timeline"
        />
        <span className="shrink-0 font-mono text-xs text-muted">
          {Math.min(index + 1, total)}/{total}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-edge pt-4 text-xs text-muted">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm bg-emerald-500" /> start</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm bg-rose-500" /> end</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm bg-slate-700" /> wall</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm bg-sky-500/40" /> visited</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm bg-[var(--accent)]" /> path</span>
        </div>
        <div className="font-mono">
          {PATHFINDERS[algo].label}: explored {visited.size}
          {finished ? (reachable ? ` · path ${trace.path.length}` : ' · no path') : ''}
        </div>
      </div>

      <p className="mt-3 text-sm text-muted">
        {PATHFINDERS[algo].note} Drag on the grid to draw walls; switch to the Start or End tool to move the endpoints.
      </p>
    </div>
  );
}
