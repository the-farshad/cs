import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// Two threads each run counter++ three times. counter++ is really three steps:
//   READ counter -> local; ADD 1 to local; WRITE local -> counter.
// Without a lock the scheduler can interleave those steps, so an update is lost.
// With a lock, a thread that wants the critical section while it is held must
// WAIT until the holder releases — serialising the increments.

const PER_THREAD = 3; // how many times each thread increments
const T1 = 'T1';
const T2 = 'T2';
const C1 = '#38bdf8'; // sky — thread 1
const C2 = '#fbbf24'; // amber — thread 2

type Phase = 'read' | 'add' | 'write';
type Op = { thread: string; phase: Phase; round: number };

type Frame = {
  counter: number; // value in shared memory
  local: Record<string, number | null>; // each thread's register copy
  active: string | null; // thread acting this step
  phase: Phase | null;
  holder: string | null; // who holds the lock (locked mode only)
  waiting: string | null; // a thread blocked on the lock
  doneOps: number; // increments fully written so far
  note: string;
};

// One ordered list of micro-ops. In "race" mode we hand-pick an interleaving
// that loses an update; in "lock" mode each thread runs its trio atomically.
function buildOps(locked: boolean): Op[] {
  if (locked) {
    // Lock forces non-overlapping critical sections: all of T1, then all of T2.
    const ops: Op[] = [];
    for (const t of [T1, T2]) {
      for (let r = 0; r < PER_THREAD; r++) {
        ops.push({ thread: t, phase: 'read', round: r });
        ops.push({ thread: t, phase: 'add', round: r });
        ops.push({ thread: t, phase: 'write', round: r });
      }
    }
    return ops;
  }
  // A deliberately bad interleaving: both threads READ the same value before
  // either WRITES, so the two writes clobber each other (a lost update).
  return [
    { thread: T1, phase: 'read', round: 0 },
    { thread: T2, phase: 'read', round: 0 },
    { thread: T1, phase: 'add', round: 0 },
    { thread: T2, phase: 'add', round: 0 },
    { thread: T1, phase: 'write', round: 0 },
    { thread: T2, phase: 'write', round: 0 }, // overwrites T1's write -> lost update
    { thread: T1, phase: 'read', round: 1 },
    { thread: T1, phase: 'add', round: 1 },
    { thread: T1, phase: 'write', round: 1 },
    { thread: T2, phase: 'read', round: 1 },
    { thread: T2, phase: 'add', round: 1 },
    { thread: T2, phase: 'write', round: 1 },
    { thread: T1, phase: 'read', round: 2 },
    { thread: T2, phase: 'read', round: 2 },
    { thread: T1, phase: 'add', round: 2 },
    { thread: T1, phase: 'write', round: 2 },
    { thread: T2, phase: 'add', round: 2 },
    { thread: T2, phase: 'write', round: 2 }, // overwrites again
  ];
}

function simulate(locked: boolean): Frame[] {
  const ops = buildOps(locked);
  let counter = 0;
  const local: Record<string, number | null> = { [T1]: null, [T2]: null };
  let holder: string | null = null;
  let doneOps = 0;
  const frames: Frame[] = [];

  const snap = (f: Omit<Frame, 'counter' | 'local' | 'holder' | 'doneOps'>) =>
    frames.push({
      counter,
      local: { ...local },
      holder,
      doneOps,
      ...f,
    });

  snap({
    active: null,
    phase: null,
    waiting: null,
    note: locked
      ? 'Shared counter starts at 0. A mutex guards it: only the lock holder may run its read-add-write.'
      : 'Shared counter starts at 0. Two threads each run counter++ three times — no lock.',
  });

  for (const op of ops) {
    if (locked) {
      // Acquire the lock at the start of a round (the read step).
      if (op.phase === 'read' && holder === null) {
        holder = op.thread;
        const other = op.thread === T1 ? T2 : T1;
        snap({
          active: op.thread,
          phase: null,
          waiting: other,
          note: `${op.thread} acquires the lock. ${other} would have to WAIT to enter the critical section.`,
        });
      }
    }

    if (op.phase === 'read') {
      local[op.thread] = counter;
      snap({
        active: op.thread,
        phase: 'read',
        waiting: locked ? (op.thread === T1 ? T2 : T1) : null,
        note: `${op.thread} READS counter (${counter}) into its own register.`,
      });
    } else if (op.phase === 'add') {
      local[op.thread] = (local[op.thread] ?? 0) + 1;
      snap({
        active: op.thread,
        phase: 'add',
        waiting: locked ? (op.thread === T1 ? T2 : T1) : null,
        note: `${op.thread} ADDS 1 in its register → ${local[op.thread]} (shared counter unchanged).`,
      });
    } else {
      const prev = counter;
      const written = local[op.thread] ?? 0;
      counter = written;
      local[op.thread] = null;
      doneOps += 1;
      const lost = !locked && written <= prev; // wrote a value that didn't advance
      snap({
        active: op.thread,
        phase: 'write',
        waiting: locked ? (op.thread === T1 ? T2 : T1) : null,
        note: lost
          ? `${op.thread} WRITES ${written} back — but counter was already ${prev}. An update was LOST.`
          : `${op.thread} WRITES ${written} back to the shared counter.`,
      });
      // Release the lock after the write completes.
      if (locked && holder === op.thread) {
        holder = null;
        snap({
          active: null,
          phase: null,
          waiting: null,
          note: `${op.thread} releases the lock. A waiting thread may now acquire it.`,
        });
      }
    }
  }

  const expected = PER_THREAD * 2;
  snap({
    active: null,
    phase: null,
    waiting: null,
    note:
      counter === expected
        ? `Done. counter = ${counter}, which equals ${expected} — every increment was applied.`
        : `Done. counter = ${counter}, but it should be ${expected}. ${expected - counter} increment(s) vanished.`,
  });

  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const PHASE_LABEL: Record<Phase, string> = { read: 'READ', add: 'ADD 1', write: 'WRITE' };

function ThreadCard({
  id,
  color,
  local,
  active,
  phase,
  holder,
  waiting,
}: {
  id: string;
  color: string;
  local: number | null;
  active: boolean;
  phase: Phase | null;
  holder: string | null;
  waiting: string | null;
}) {
  const isWaiting = waiting === id;
  const holds = holder === id;
  return (
    <div
      className="rounded-lg border bg-bg p-3 transition"
      style={{
        borderColor: active ? color : isWaiting ? '#f43f5e' : 'var(--edge)',
        background: active ? 'color-mix(in oklab, ' + color + ' 10%, var(--bg))' : 'var(--bg)',
        opacity: isWaiting ? 0.85 : 1,
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 font-mono text-sm">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: color }} />
          {id}
        </span>
        {holds && (
          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
            <LockGlyph open={false} /> holds lock
          </span>
        )}
        {isWaiting && (
          <span className="rounded px-1.5 py-0.5 font-mono text-[10px] text-rose-400">waiting…</span>
        )}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">register</span>
        <span className="font-mono text-lg" style={{ color: local != null ? color : 'var(--muted)' }}>
          {local != null ? local : '—'}
        </span>
      </div>
      <div className="mt-2 flex gap-1">
        {(['read', 'add', 'write'] as Phase[]).map((p) => (
          <span
            key={p}
            className="flex-1 rounded border px-1 py-0.5 text-center font-mono text-[10px] transition"
            style={{
              borderColor: active && phase === p ? color : 'var(--edge)',
              color: active && phase === p ? color : 'var(--muted)',
              background:
                active && phase === p ? 'color-mix(in oklab, ' + color + ' 16%, transparent)' : 'transparent',
            }}
          >
            {PHASE_LABEL[p]}
          </span>
        ))}
      </div>
    </div>
  );
}

// Small inline padlock (no matching icon in the shared set).
function LockGlyph({ open }: { open: boolean }) {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      {open ? <path d="M8 11V7a4 4 0 0 1 8 0" /> : <path d="M8 11V7a4 4 0 0 1 8 0v4" />}
    </svg>
  );
}

export default function RaceConditionVisualizer() {
  const [locked, setLocked] = useState(false);
  const frames = useMemo(() => simulate(locked), [locked]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 3);
  const frame = frames[Math.min(index, frames.length - 1)] ?? frames[0];

  const expected = PER_THREAD * 2;
  const correct = frame.counter === expected && index === frames.length - 1;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded border border-edge">
          <button
            type="button"
            onClick={() => setLocked(false)}
            aria-pressed={!locked}
            className={`px-3 py-1 text-sm transition ${!locked ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}
          >
            No lock
          </button>
          <button
            type="button"
            onClick={() => setLocked(true)}
            aria-pressed={locked}
            className={`px-3 py-1 text-sm transition ${locked ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}
          >
            With mutex
          </button>
        </div>
        <span className="text-xs text-muted">
          Each thread runs <code className="font-mono text-fg">counter++</code> ×{PER_THREAD} (= READ, ADD, WRITE).
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
        <ThreadCard
          id={T1}
          color={C1}
          local={frame.local[T1]}
          active={frame.active === T1}
          phase={frame.phase}
          holder={frame.holder}
          waiting={frame.waiting}
        />

        {/* Shared memory in the middle */}
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-edge bg-bg px-5 py-3">
          <span className="font-mono text-[11px] uppercase tracking-wide text-muted">shared</span>
          <span className="font-mono text-xs text-muted">counter</span>
          <span
            className="font-mono text-3xl font-semibold transition"
            style={{ color: frame.phase === 'write' ? 'var(--accent)' : 'var(--fg)' }}
          >
            {frame.counter}
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-[11px]" style={{ color: frame.holder ? '#10b981' : 'var(--muted)' }}>
            <LockGlyph open={!frame.holder} /> {frame.holder ? `locked by ${frame.holder}` : locked ? 'unlocked' : 'no lock'}
          </span>
        </div>

        <ThreadCard
          id={T2}
          color={C2}
          local={frame.local[T2]}
          active={frame.active === T2}
          phase={frame.phase}
          holder={frame.holder}
          waiting={frame.waiting}
        />
      </div>

      {/* Result banner */}
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-edge bg-bg p-3 text-sm">
        <span className="text-muted">Expected after all increments:</span>
        <span className="font-mono text-fg">{expected}</span>
        <span className="text-muted">·</span>
        <span className="text-muted">Actual:</span>
        <span
          className="font-mono font-semibold"
          style={{ color: index === frames.length - 1 ? (correct ? '#10b981' : '#f43f5e') : 'var(--fg)' }}
        >
          {frame.counter}
        </span>
        {index === frames.length - 1 && (
          <span
            className="ml-auto inline-flex items-center gap-1.5 rounded px-2 py-0.5 font-mono text-xs font-medium"
            style={{ background: correct ? '#10b981' : '#f43f5e', color: correct ? '#04140d' : '#1a0408' }}
          >
            {correct ? <Icon name="check" size={14} /> : null}
            {correct ? 'consistent' : 'lost update'}
          </span>
        )}
      </div>

      {/* Playback controls */}
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
          <input type="range" min={1} max={12} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
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

      {/* Deadlock cycle — static reference diagram */}
      <div className="mt-4 rounded-lg border border-edge bg-bg p-3">
        <div className="mb-2 font-mono text-[11px] uppercase tracking-wide text-muted">deadlock cycle</div>
        <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-xs">
          <span className="rounded border px-2 py-1" style={{ borderColor: C1, color: C1 }}>{T1}</span>
          <span className="text-muted">holds A, wants B</span>
          <Icon name="arrow-right" size={16} className="text-rose-400" />
          <span className="rounded border px-2 py-1" style={{ borderColor: C2, color: C2 }}>{T2}</span>
          <span className="text-muted">holds B, wants A</span>
          <Icon name="arrow-right" size={16} className="rotate-180 text-rose-400" />
        </div>
        <p className="mt-2 text-xs text-muted">
          When each thread holds one lock and waits for the other, the wait-for graph forms a cycle and neither
          can proceed. Breaking any of the four conditions (mutual exclusion, hold-and-wait, no preemption,
          circular wait) prevents it — e.g. always acquire locks in a fixed global order.
        </p>
      </div>
    </div>
  );
}
