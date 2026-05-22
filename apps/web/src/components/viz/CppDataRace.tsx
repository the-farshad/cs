import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

/** Two threads each run counter++ a few times. The increment is really three
 *  steps — load, add 1, store — so without synchronization the interleaving can
 *  lose updates (a data race). Toggle the mutex on to serialize the section.
 *
 *  Unlocked: both threads interleave their load/store and clobber each other,
 *    so the final counter is less than the expected total.
 *  Locked:   lock_guard makes the read-modify-write atomic as a unit, so every
 *    increment counts and the result is correct.                               */

type Mode = 'race' | 'mutex';

type ThreadId = 'A' | 'B';
type Phase = 'idle' | 'wait' | 'load' | 'add' | 'store' | 'done';

const PER_THREAD = 2;
const EXPECTED = PER_THREAD * 2;

type Frame = {
  active: ThreadId | null;
  counter: number;
  regA: number | null; // thread A's local register copy
  regB: number | null;
  phaseA: Phase;
  phaseB: Phase;
  lockHeldBy: ThreadId | null; // mutex owner (mutex mode only)
  note: string;
};

// A hand-picked unlucky interleaving that loses an update in race mode.
// Each tuple: which thread acts, and which micro-step.
const RACE_SCHEDULE: { t: ThreadId; step: 'load' | 'add' | 'store' }[] = [
  { t: 'A', step: 'load' }, // A reads 0
  { t: 'B', step: 'load' }, // B reads 0 (stale!)
  { t: 'A', step: 'add' }, // A: 0 -> 1
  { t: 'A', step: 'store' }, // counter = 1
  { t: 'B', step: 'add' }, // B: 0 -> 1 (based on stale read)
  { t: 'B', step: 'store' }, // counter = 1 (A's update lost)
  { t: 'A', step: 'load' }, // A reads 1
  { t: 'A', step: 'add' }, // A: 1 -> 2
  { t: 'A', step: 'store' }, // counter = 2
  { t: 'B', step: 'load' }, // B reads 2
  { t: 'B', step: 'add' }, // B: 2 -> 3
  { t: 'B', step: 'store' }, // counter = 3 (expected 4)
];

function buildRace(): Frame[] {
  const frames: Frame[] = [];
  let counter = 0;
  let regA: number | null = null;
  let regB: number | null = null;
  let phaseA: Phase = 'idle';
  let phaseB: Phase = 'idle';

  frames.push({
    active: null,
    counter,
    regA,
    regB,
    phaseA,
    phaseB,
    lockHeldBy: null,
    note: 'No mutex. Each counter++ is load -> add -> store. The OS may switch threads between any two micro-steps.',
  });

  for (const ev of RACE_SCHEDULE) {
    if (ev.t === 'A') {
      if (ev.step === 'load') {
        regA = counter;
        phaseA = 'load';
      } else if (ev.step === 'add') {
        regA = (regA ?? 0) + 1;
        phaseA = 'add';
      } else {
        counter = regA ?? counter;
        phaseA = 'store';
      }
    } else {
      if (ev.step === 'load') {
        regB = counter;
        phaseB = 'load';
      } else if (ev.step === 'add') {
        regB = (regB ?? 0) + 1;
        phaseB = 'add';
      } else {
        counter = regB ?? counter;
        phaseB = 'store';
      }
    }
    const noteMap: Record<typeof ev.step, string> = {
      load: `Thread ${ev.t} loads counter (${counter}) into its register.`,
      add: `Thread ${ev.t} adds 1 in its register (now ${ev.t === 'A' ? regA : regB}).`,
      store: `Thread ${ev.t} stores its register back to counter (${counter}).`,
    };
    let extra = '';
    if (ev.t === 'B' && ev.step === 'store' && counter === 1) {
      extra = ' Thread A’s increment was overwritten — a lost update.';
    }
    frames.push({
      active: ev.t,
      counter,
      regA,
      regB,
      phaseA,
      phaseB,
      lockHeldBy: null,
      note: noteMap[ev.step] + extra,
    });
  }

  frames.push({
    active: null,
    counter,
    regA,
    regB,
    phaseA: 'done',
    phaseB: 'done',
    lockHeldBy: null,
    note: `Final counter = ${counter}, but we expected ${EXPECTED}. Interleaved load/store lost an update: this is a data race (undefined behavior).`,
  });
  return frames;
}

function buildMutex(): Frame[] {
  const frames: Frame[] = [];
  let counter = 0;
  let regA: number | null = null;
  let regB: number | null = null;

  frames.push({
    active: null,
    counter,
    regA,
    regB,
    phaseA: 'idle',
    phaseB: 'idle',
    lockHeldBy: null,
    note: 'With a mutex, lock_guard makes the whole load-add-store run as one indivisible critical section.',
  });

  // A grabs the lock, completes its full increment, releases. Then B. Repeat.
  const order: ThreadId[] = ['A', 'B', 'A', 'B'];
  for (const t of order) {
    const isA = t === 'A';
    // acquire
    if (isA) {
      regA = null;
    } else {
      regB = null;
    }
    frames.push({
      active: t,
      counter,
      regA,
      regB,
      phaseA: isA ? 'wait' : frames[frames.length - 1].phaseA,
      phaseB: isA ? frames[frames.length - 1].phaseB : 'wait',
      lockHeldBy: t,
      note: `Thread ${t} locks the mutex (lock_guard). The other thread blocks until it is released.`,
    });
    // load
    if (isA) {
      regA = counter;
    } else {
      regB = counter;
    }
    frames.push({
      active: t,
      counter,
      regA,
      regB,
      phaseA: isA ? 'load' : frames[frames.length - 1].phaseA,
      phaseB: isA ? frames[frames.length - 1].phaseB : 'load',
      lockHeldBy: t,
      note: `Thread ${t} loads counter (${counter}). No other thread can touch it now.`,
    });
    // add + store
    if (isA) {
      regA = (regA ?? 0) + 1;
      counter = regA;
    } else {
      regB = (regB ?? 0) + 1;
      counter = regB;
    }
    frames.push({
      active: t,
      counter,
      regA,
      regB,
      phaseA: isA ? 'store' : frames[frames.length - 1].phaseA,
      phaseB: isA ? frames[frames.length - 1].phaseB : 'store',
      lockHeldBy: t,
      note: `Thread ${t} adds 1 and stores: counter = ${counter}. Then lock_guard releases the mutex at scope exit.`,
    });
  }

  frames.push({
    active: null,
    counter,
    regA,
    regB,
    phaseA: 'done',
    phaseB: 'done',
    lockHeldBy: null,
    note: `Final counter = ${counter} = expected ${EXPECTED}. Serializing the critical section makes every increment count.`,
  });
  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const ROSE = '#f43f5e';
const EMERALD = '#10b981';
const AMBER = '#fbbf24';
const SKY = '#38bdf8';

function ThreadCard({
  id,
  reg,
  phase,
  active,
  holdsLock,
  mode,
}: {
  id: ThreadId;
  reg: number | null;
  phase: Phase;
  active: boolean;
  holdsLock: boolean;
  mode: Mode;
}) {
  const phaseColor =
    phase === 'store' ? EMERALD : phase === 'wait' ? AMBER : phase === 'done' ? 'var(--muted)' : SKY;
  return (
    <div
      className="rounded-lg border bg-bg/40 p-3 transition-colors"
      style={{ borderColor: active ? SKY : 'var(--edge)' }}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-semibold text-fg">thread {id}</span>
        {mode === 'mutex' && holdsLock && (
          <span
            className="rounded-full border px-2 py-0.5 text-[10px]"
            style={{ borderColor: EMERALD, color: EMERALD }}
          >
            holds lock
          </span>
        )}
        {mode === 'mutex' && !holdsLock && phase === 'wait' && (
          <span
            className="rounded-full border px-2 py-0.5 text-[10px]"
            style={{ borderColor: AMBER, color: AMBER }}
          >
            blocked
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-xs">
        <span className="text-muted">register</span>
        <span style={{ color: reg === null ? 'var(--muted)' : SKY }}>{reg ?? '—'}</span>
      </div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-wide" style={{ color: phaseColor }}>
        {phase}
      </div>
    </div>
  );
}

export default function CppDataRace() {
  const [mode, setMode] = useState<Mode>('race');
  const raceFrames = useMemo(() => buildRace(), []);
  const mutexFrames = useMemo(() => buildMutex(), []);
  const frames = mode === 'race' ? raceFrames : mutexFrames;
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(
    frames.length,
    2,
  );
  const frame = frames[Math.min(index, frames.length - 1)];
  const correct = frame.counter === EXPECTED && (frame.phaseA === 'done' || frame.phaseB === 'done');

  const code =
    mode === 'race'
      ? ['int counter = 0;          // shared, unprotected', 'void work() {', '  for (int i = 0; i < 2; ++i)', '    counter++;            // load, add, store', '}']
      : ['int counter = 0;', 'std::mutex m;', 'void work() {', '  for (int i = 0; i < 2; ++i) {', '    std::lock_guard<std::mutex> g(m);', '    counter++;            // critical section', '  }', '}'];

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {(['race', 'mutex'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              reset();
            }}
            className={`rounded border px-3 py-1 text-sm transition ${
              mode === m
                ? 'border-accent bg-accent text-accent-fg'
                : 'border-edge text-fg hover:border-accent hover:text-accent'
            }`}
          >
            {m === 'race' ? 'No mutex (data race)' : 'std::mutex + lock_guard'}
          </button>
        ))}
      </div>

      {/* Source listing. */}
      <div className="mb-4 overflow-x-auto rounded-lg border border-edge bg-bg/40 p-3 font-mono text-xs leading-relaxed">
        {code.map((line, i) => (
          <div key={i} className="whitespace-pre rounded px-2 py-0.5 text-muted">
            {' '}
            {line}
          </div>
        ))}
      </div>

      {/* Threads + shared counter. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ThreadCard
          id="A"
          reg={frame.regA}
          phase={frame.phaseA}
          active={frame.active === 'A'}
          holdsLock={frame.lockHeldBy === 'A'}
          mode={mode}
        />
        <div className="flex flex-col items-center justify-center rounded-lg border border-edge bg-bg/40 p-3">
          <span className="text-[10px] uppercase tracking-wide text-muted">shared counter</span>
          <span
            className="my-1 font-mono text-4xl font-bold"
            style={{ color: frame.active ? AMBER : 'var(--fg)' }}
          >
            {frame.counter}
          </span>
          <span className="font-mono text-[10px] text-muted">expected {EXPECTED}</span>
        </div>
        <ThreadCard
          id="B"
          reg={frame.regB}
          phase={frame.phaseB}
          active={frame.active === 'B'}
          holdsLock={frame.lockHeldBy === 'B'}
          mode={mode}
        />
      </div>

      {/* Result banner once finished. */}
      {(frame.phaseA === 'done' || frame.phaseB === 'done') && (
        <div
          className="mt-3 rounded-lg border px-3 py-2 text-center font-mono text-sm"
          style={{
            borderColor: correct ? EMERALD : ROSE,
            color: correct ? EMERALD : ROSE,
          }}
        >
          {correct
            ? `correct: counter == ${EXPECTED}`
            : `lost update: counter == ${frame.counter} != ${EXPECTED}`}
        </div>
      )}

      {/* Controls. */}
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
            max={8}
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

      <div className="mt-4 border-t border-edge pt-4 text-xs text-muted">{frame.note}</div>
    </div>
  );
}
