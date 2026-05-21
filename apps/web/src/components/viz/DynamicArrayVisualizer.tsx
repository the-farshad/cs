import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

type DAFrame = {
  slots: (number | null)[]; // capacity-length array; null = unused slot
  size: number;
  capacity: number;
  active?: number; // index just written
  copying?: number[]; // indices being copied during a grow
  marker?: 'write' | 'grow' | 'copy';
  cost: string; // cost label for this push
  note?: string;
};

const INITIAL_CAP = 2;

/** Simulate a sequence of pushes onto a dynamic array that doubles capacity
 *  when full. Each push yields one or more frames so the copy is visible. */
function buildFrames(values: number[]): DAFrame[] {
  let capacity = INITIAL_CAP;
  let size = 0;
  let slots: (number | null)[] = Array.from({ length: capacity }, () => null);
  const frames: DAFrame[] = [
    { slots: [...slots], size, capacity, cost: '—', note: `empty array, capacity ${capacity}` },
  ];

  for (const v of values) {
    if (size === capacity) {
      // Grow: allocate double, copy every existing element.
      const newCap = capacity * 2;
      const copied = Array.from({ length: size }, (_, i) => i);
      const grown: (number | null)[] = Array.from({ length: newCap }, (_, i) =>
        i < size ? slots[i] : null,
      );
      frames.push({
        slots: grown,
        size,
        capacity: newCap,
        copying: copied,
        marker: 'grow',
        cost: `O(${size})`,
        note: `full — allocate ${newCap} slots and copy ${size} elements`,
      });
      capacity = newCap;
      slots = grown;
    }
    // Write into the next free slot — O(1).
    slots = [...slots];
    slots[size] = v;
    size += 1;
    frames.push({
      slots: [...slots],
      size,
      capacity,
      active: size - 1,
      marker: 'write',
      cost: 'O(1)',
      note: `push ${v} into slot ${size - 1}`,
    });
  }
  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function DynamicArrayVisualizer() {
  const [values, setValues] = useState<number[]>(() => [3, 7, 1, 9, 4, 6, 2]);

  const frames = useMemo(() => buildFrames(values), [values]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(
    frames.length,
    3,
  );
  const frame = frames[Math.min(index, frames.length - 1)] ?? {
    slots: [],
    size: 0,
    capacity: 0,
    cost: '—',
  };

  // Running total of writes (each push = 1 write + any copies on a grow).
  const totalWork = useMemo(() => {
    let writes = 0;
    let copies = 0;
    for (let k = 1; k <= index && k < frames.length; k++) {
      const f = frames[k];
      if (f.marker === 'write') writes += 1;
      if (f.marker === 'grow') copies += f.copying?.length ?? 0;
    }
    return { writes, copies };
  }, [index, frames]);

  const push = () => setValues((v) => [...v, Math.floor(Math.random() * 99) + 1]);
  const clear = () => setValues([]);
  const reseed = () =>
    setValues(Array.from({ length: 7 }, () => Math.floor(Math.random() * 99) + 1));

  const slotCls = (i: number): string => {
    if (frame.copying?.includes(i)) return 'border-violet-500 text-violet-300';
    if (frame.active === i) return 'border-accent text-accent';
    if (frame.slots[i] != null) return 'border-edge text-fg';
    return 'border-dashed border-edge/50 text-muted/40';
  };

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" className={btn} onClick={push}>
          <Icon name="arrow-right" size={16} /> Push
        </button>
        <button type="button" className={btn} onClick={reseed}>
          <Icon name="shuffle" size={16} /> New sequence
        </button>
        <button type="button" className={btn} onClick={clear}>
          <Icon name="rotate-ccw" size={16} /> Clear
        </button>
      </div>

      {/* The backing buffer: filled slots are solid, spare capacity is dashed. */}
      <div className="flex min-h-20 flex-wrap items-center gap-1.5 rounded-lg border border-edge bg-bg/40 p-4">
        {frame.slots.length === 0 && <span className="text-muted">empty</span>}
        {frame.slots.map((v, i) => (
          <div
            key={i}
            className={`flex h-12 w-12 flex-col items-center justify-center rounded border font-mono text-sm transition-colors ${slotCls(i)}`}
          >
            <span>{v ?? '·'}</span>
            <span className="text-[10px] text-muted/60">{i}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'size', value: frame.size },
          { label: 'capacity', value: frame.capacity },
          {
            label: 'load',
            value: frame.capacity ? `${Math.round((frame.size / frame.capacity) * 100)}%` : '—',
          },
          { label: 'this op', value: frame.cost },
        ].map((s) => (
          <div key={s.label} className="rounded border border-edge bg-bg/40 px-3 py-2 text-center">
            <div className="font-mono text-lg text-fg">{s.value}</div>
            <div className="text-xs text-muted">{s.label}</div>
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
        <button type="button" className={btn} onClick={reset} disabled={index === 0}>
          <Icon name="rotate-ccw" size={16} /> Reset
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
        <div className="flex flex-wrap gap-3">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm border border-accent" /> write
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm border border-violet-500" /> copy on grow
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm border border-dashed border-edge/60" />{' '}
            spare capacity
          </span>
        </div>
        <span className="font-mono">
          {totalWork.writes} writes + {totalWork.copies} copies
          {frame.note ? ` · ${frame.note}` : ''}
        </span>
      </div>
    </div>
  );
}
