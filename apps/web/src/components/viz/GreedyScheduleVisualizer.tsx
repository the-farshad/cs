import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

type Interval = { id: number; start: number; end: number };

type Status = 'pending' | 'considering' | 'picked' | 'skipped';

type Frame = {
  status: Status[];
  lastEnd: number; // end time of the most recently picked interval, -Infinity start
  considering: number; // index into sorted order, -1 when none
  note: string;
};

const DAY = 16; // timeline units (e.g. hours 0..16)

function randomIntervals(n: number): Interval[] {
  const out: Interval[] = [];
  for (let i = 0; i < n; i++) {
    const start = Math.floor(Math.random() * (DAY - 3));
    const len = 1 + Math.floor(Math.random() * 4);
    out.push({ id: i, start, end: Math.min(DAY, start + len) });
  }
  return out;
}

/** Greedy interval scheduling: sort by end time, take each that starts after the
 *  last picked one ends. This is optimal for "max non-overlapping intervals". */
function scheduleFrames(intervals: Interval[]): { frames: Frame[]; order: Interval[] } {
  const order = [...intervals].sort((a, b) => a.end - b.end || a.start - b.start);
  const status = new Map<number, Status>();
  intervals.forEach((iv) => status.set(iv.id, 'pending'));

  const snapshot = (): Status[] => intervals.map((iv) => status.get(iv.id)!);
  const frames: Frame[] = [
    { status: snapshot(), lastEnd: -1, considering: -1, note: 'sorted by finish time — earliest finish first' },
  ];

  let lastEnd = -1;
  order.forEach((iv, idx) => {
    status.set(iv.id, 'considering');
    frames.push({
      status: snapshot(),
      lastEnd,
      considering: idx,
      note: `consider [${iv.start}, ${iv.end}] — starts ${iv.start}, last pick ends ${lastEnd < 0 ? '—' : lastEnd}`,
    });
    if (iv.start >= lastEnd) {
      status.set(iv.id, 'picked');
      lastEnd = iv.end;
      frames.push({
        status: snapshot(),
        lastEnd,
        considering: idx,
        note: `pick it — no overlap; next free at ${lastEnd}`,
      });
    } else {
      status.set(iv.id, 'skipped');
      frames.push({
        status: snapshot(),
        lastEnd,
        considering: idx,
        note: `skip — overlaps a chosen interval`,
      });
    }
  });

  const picked = intervals.filter((iv) => status.get(iv.id) === 'picked').length;
  frames.push({
    status: snapshot(),
    lastEnd,
    considering: -1,
    note: `done — ${picked} non-overlapping intervals (the maximum)`,
  });
  return { frames, order };
}

const COLOR: Record<Status, string> = {
  pending: 'var(--border)',
  considering: '#fbbf24',
  picked: '#10b981',
  skipped: '#f43f5e',
};

export default function GreedyScheduleVisualizer() {
  const [intervals, setIntervals] = useState<Interval[]>(() => randomIntervals(7));
  const { frames } = useMemo(() => scheduleFrames(intervals), [intervals]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 3);
  const frame = frames[Math.min(index, frames.length - 1)] ?? frames[0];

  const W = 480;
  const padL = 16;
  const padR = 16;
  const rowH = 30;
  const gap = 8;
  const trackW = W - padL - padR;
  const xOf = (t: number) => padL + (t / DAY) * trackW;
  const H = intervals.length * (rowH + gap) + gap + 22;

  const shuffle = () => setIntervals(randomIntervals(7));

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted">Pick the most non-overlapping meetings in a day.</span>
        <button type="button" className={`${btn} ml-auto`} onClick={shuffle}>
          <Icon name="shuffle" size={16} /> Shuffle
        </button>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="interval scheduling">
        {/* hour gridlines */}
        {Array.from({ length: DAY + 1 }, (_, t) => (
          <line
            key={t}
            x1={xOf(t)}
            y1={18}
            x2={xOf(t)}
            y2={H - 4}
            style={{ stroke: 'var(--border)' }}
            strokeWidth={t % 4 === 0 ? 1 : 0.4}
            opacity={t % 4 === 0 ? 0.7 : 0.4}
          />
        ))}
        {Array.from({ length: DAY / 4 + 1 }, (_, i) => (
          <text key={i} x={xOf(i * 4)} y={12} textAnchor="middle" fontSize={10} style={{ fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
            {i * 4}
          </text>
        ))}
        {/* "free at" marker = lastEnd */}
        {frame.lastEnd >= 0 && (
          <line
            x1={xOf(frame.lastEnd)}
            y1={18}
            x2={xOf(frame.lastEnd)}
            y2={H - 4}
            style={{ stroke: 'var(--accent)' }}
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        )}
        {intervals.map((iv, i) => {
          const st = frame.status[i];
          const y = 22 + i * (rowH + gap);
          const x = xOf(iv.start);
          const w = Math.max(2, xOf(iv.end) - xOf(iv.start));
          const color = COLOR[st];
          const filled = st === 'picked' || st === 'considering';
          return (
            <g key={iv.id}>
              <rect
                x={x}
                y={y}
                width={w}
                height={rowH}
                rx={5}
                style={{
                  fill: filled ? color : 'var(--surface)',
                  stroke: color,
                  opacity: st === 'skipped' ? 0.6 : 1,
                }}
                strokeWidth={2}
              />
              <text
                x={x + w / 2}
                y={y + rowH / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11}
                style={{
                  fill: st === 'picked' ? '#04140d' : st === 'considering' ? '#1a1303' : 'var(--fg)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {iv.start}–{iv.end}
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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-edge pt-4 text-xs text-muted">
        <span className="font-mono">{frame.note}</span>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: '#fbbf24' }} /> considering</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: '#10b981' }} /> picked</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: '#f43f5e' }} /> skipped</span>
        </div>
      </div>
    </div>
  );
}
