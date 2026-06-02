import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// Double-ended queue backed by a fixed circular buffer (ring).
// head points at the front element; tail points one past the back.
// All four operations are O(1); indices wrap with modulo CAP.

const CAP = 8;

type Op = { type: 'pushFront' | 'pushBack'; value: number } | { type: 'popFront' | 'popBack' };
type Cell = number | null;
type Frame = {
  buf: Cell[];
  head: number;
  tail: number;
  size: number;
  active?: number; // slot touched this step
  marker?: 'push' | 'pop' | 'full' | 'empty';
  note?: string;
};

const mod = (x: number) => ((x % CAP) + CAP) % CAP;

function buildFrames(ops: Op[]): Frame[] {
  const buf: Cell[] = new Array(CAP).fill(null);
  let head = 0; // index of front element (when size > 0)
  let tail = 0; // index one past the back element
  let size = 0;
  const frames: Frame[] = [{ buf: [...buf], head, tail, size }];
  const snap = (f: Partial<Frame>) => frames.push({ buf: [...buf], head, tail, size, ...f });

  for (const op of ops) {
    if (op.type === 'pushFront') {
      if (size === CAP) {
        snap({ marker: 'full', note: 'buffer full — cannot push front' });
        continue;
      }
      head = mod(head - 1);
      buf[head] = op.value;
      size++;
      snap({ active: head, marker: 'push', note: `pushFront(${op.value}) → head moves left to slot ${head}` });
    } else if (op.type === 'pushBack') {
      if (size === CAP) {
        snap({ marker: 'full', note: 'buffer full — cannot push back' });
        continue;
      }
      const at = tail;
      buf[tail] = op.value;
      tail = mod(tail + 1);
      size++;
      snap({ active: at, marker: 'push', note: `pushBack(${op.value}) → written at slot ${at}, tail → ${tail}` });
    } else if (op.type === 'popFront') {
      if (size === 0) {
        snap({ marker: 'empty', note: 'empty — nothing to pop' });
        continue;
      }
      const at = head;
      const v = buf[head];
      buf[head] = null;
      head = mod(head + 1);
      size--;
      snap({ active: at, marker: 'pop', note: `popFront() → ${v} from slot ${at}, head → ${head}` });
    } else {
      if (size === 0) {
        snap({ marker: 'empty', note: 'empty — nothing to pop' });
        continue;
      }
      tail = mod(tail - 1);
      const v = buf[tail];
      buf[tail] = null;
      size--;
      snap({ active: tail, marker: 'pop', note: `popBack() → ${v} from slot ${tail}, tail → ${tail}` });
    }
  }
  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const DEFAULT_OPS: Op[] = [
  { type: 'pushBack', value: 1 },
  { type: 'pushBack', value: 2 },
  { type: 'pushFront', value: 9 },
  { type: 'pushFront', value: 8 },
  { type: 'popBack' },
];

export default function DequeVisualizer() {
  const [ops, setOps] = useState<Op[]>(DEFAULT_OPS);
  const [input, setInput] = useState('');

  const frames = useMemo(() => buildFrames(ops), [ops]);
  const { index, playing, fps, setFps, play, pause, next, prev, seek } = useStepper(frames.length);
  const frame = frames[Math.min(index, frames.length - 1)] ?? { buf: new Array(CAP).fill(null), head: 0, tail: 0, size: 0 };

  const val = () => Number(input);
  const ok = () => input.trim() !== '' && !Number.isNaN(val());
  const push = (op: Op) => {
    setOps((o) => [...o, op]);
    setInput('');
  };

  // Ring geometry
  const C = 280;
  const cx = C / 2;
  const cy = C / 2;
  const R = 100;
  const slotAngle = (i: number) => (i / CAP) * 2 * Math.PI - Math.PI / 2; // slot 0 at top
  const slotPos = (i: number) => ({ x: cx + R * Math.cos(slotAngle(i)), y: cy + R * Math.sin(slotAngle(i)) });
  // pointer label sits a bit further out
  const ptrPos = (i: number) => ({ x: cx + (R + 34) * Math.cos(slotAngle(i)), y: cy + (R + 34) * Math.sin(slotAngle(i)) });

  const cellStroke = (i: number) => {
    if (frame.active === i) {
      if (frame.marker === 'push') return 'var(--accent)';
      if (frame.marker === 'pop') return '#f43f5e';
    }
    if (frame.buf[i] !== null) return '#38bdf8';
    return 'var(--border)';
  };
  const cellFill = (i: number) => {
    if (frame.active === i && frame.marker === 'push') return 'color-mix(in oklab, var(--accent) 20%, var(--surface))';
    if (frame.active === i && frame.marker === 'pop') return 'color-mix(in oklab, #f43f5e 18%, var(--surface))';
    if (frame.buf[i] !== null) return 'color-mix(in oklab, #38bdf8 14%, var(--surface))';
    return 'var(--surface)';
  };

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="value"
          inputMode="numeric"
          className="w-20 rounded border border-edge bg-bg px-2 py-1 text-fg"
        />
        <button type="button" className={btn} onClick={() => ok() && push({ type: 'pushFront', value: val() })}>
          <Icon name="arrow-left" size={16} /> Push front
        </button>
        <button type="button" className={btn} onClick={() => ok() && push({ type: 'pushBack', value: val() })}>
          Push back <Icon name="arrow-right" size={16} />
        </button>
        <button type="button" className={btn} onClick={() => push({ type: 'popFront' })}>
          Pop front
        </button>
        <button type="button" className={btn} onClick={() => push({ type: 'popBack' })}>
          Pop back
        </button>
        <button type="button" className={btn} onClick={() => setOps([])}>
          <Icon name="rotate-ccw" size={16} /> Clear
        </button>
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-around">
        {/* Ring view */}
        <svg viewBox={`0 0 ${C} ${C}`} className="w-full max-w-[280px]" role="img" aria-label="circular buffer">
          <circle cx={cx} cy={cy} r={R} fill="none" style={{ stroke: 'var(--border)' }} strokeWidth={1} strokeDasharray="2 4" />
          {frame.buf.map((v, i) => {
            const p = slotPos(i);
            const isHead = frame.size > 0 && i === frame.head;
            const isTail = i === frame.tail;
            return (
              <g key={i}>
                <rect x={p.x - 16} y={p.y - 16} width={32} height={32} rx={6} style={{ fill: cellFill(i), stroke: cellStroke(i) }} strokeWidth={2.5} />
                <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize={13} style={{ fill: v === null ? 'var(--muted)' : 'var(--fg)', fontFamily: 'var(--font-mono)' }}>
                  {v ?? ''}
                </text>
                <text x={p.x} y={p.y + 26} textAnchor="middle" fontSize={8} style={{ fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                  {i}
                </text>
                {isHead && (
                  <text x={ptrPos(i).x} y={ptrPos(i).y} textAnchor="middle" dominantBaseline="central" fontSize={10} style={{ fill: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                    head
                  </text>
                )}
                {isTail && (
                  <text x={ptrPos(i).x} y={ptrPos(i).y + (isHead ? 12 : 0)} textAnchor="middle" dominantBaseline="central" fontSize={10} style={{ fill: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                    tail
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Logical front-to-back order */}
        <div className="flex w-full max-w-xs flex-col gap-2">
          <span className="font-mono text-[10px] uppercase text-muted">logical order (front → back)</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {frame.size === 0 ? (
              <span className="font-mono text-xs text-muted">empty</span>
            ) : (
              Array.from({ length: frame.size }, (_, k) => {
                const slot = mod(frame.head + k);
                return (
                  <div key={k} className="flex h-9 min-w-9 items-center justify-center rounded border border-edge bg-bg/40 px-1.5 font-mono text-sm text-fg">
                    {frame.buf[slot]}
                  </div>
                );
              })
            )}
          </div>
          <div className="mt-2 font-mono text-xs text-muted">
            size {frame.size}/{CAP} · head={frame.head} · tail={frame.tail}
          </div>
        </div>
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
          <input type="range" min={1} max={12} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input type="range" min={0} max={Math.max(frames.length - 1, 0)} value={index} onChange={(e) => seek(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Timeline" />
        <span className="shrink-0 font-mono text-xs text-muted">{index + 1}/{frames.length}</span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">{frame.note ?? `size ${frame.size}/${CAP}`}</div>
    </div>
  );
}
