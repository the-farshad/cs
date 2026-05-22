import { useMemo } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

/** Walks an object through its whole lifetime to show class semantics:
 *
 *  struct Account {
 *      std::string owner;      // members laid out together
 *      int cents;
 *      Account(name, c) { ... }   // constructor runs at creation
 *      void deposit(d) { ... }    // a member function reads/writes members
 *      ~Account() { ... }         // destructor runs at scope end
 *  };
 *  { Account a("Ada", 500); a.deposit(250); }  // a destroyed here
 *
 *  Each frame highlights the current source line, the object's member layout,
 *  and whether the object is being constructed, used, or destructed.            */

type Member = { name: string; type: string; value: string };

type Phase = 'declared' | 'constructing' | 'alive' | 'destructing' | 'gone';

type Frame = {
  code: number; // index into CODE for highlighting
  phase: Phase;
  members: Member[];
  touched: string[]; // member names read/written this step
  note: string;
};

const CODE = [
  'struct Account {',
  '  std::string owner;   // member',
  '  int cents;           // member',
  '  Account(std::string n, int c)',
  '    : owner(n), cents(c) {}   // constructor',
  '  void deposit(int d) { cents += d; }',
  '  ~Account() { /* cleanup */ }  // destructor',
  '};',
  '{',
  '  Account a("Ada", 500);  // construct',
  '  a.deposit(250);         // use member fn',
  '}  // a goes out of scope -> destruct',
];

function buildFrames(): Frame[] {
  const frames: Frame[] = [];
  let members: Member[] = [
    { name: 'owner', type: 'std::string', value: '—' },
    { name: 'cents', type: 'int', value: '—' },
  ];
  let phase: Phase = 'declared';
  const set = (name: string, value: string) => {
    members = members.map((m) => (m.name === name ? { ...m, value } : m));
  };
  const snap = (code: number, touched: string[], note: string) =>
    frames.push({ code, phase, touched, members: members.map((m) => ({ ...m })), note });

  snap(0, [], 'A class bundles data (members) with the functions that operate on it. No object exists yet.');

  snap(9, [], 'Reaching the declaration of a. Storage for its members is set aside, but they are uninitialized.');

  phase = 'constructing';
  set('owner', '"Ada"');
  snap(4, ['owner'], 'The constructor runs first. The member initializer list sets owner before the body executes.');

  set('cents', '500');
  snap(4, ['cents'], 'cents is initialized to 500. Members are laid out side by side in the object.');

  phase = 'alive';
  snap(9, [], 'Construction is complete: a is now a fully-formed, valid object you can use.');

  set('cents', '750');
  snap(10, ['cents'], 'a.deposit(250) is a member function. It has direct access to the object’s members and updates cents to 750.');

  phase = 'destructing';
  snap(11, ['owner', 'cents'], 'Control reaches the closing brace. a goes out of scope, so its destructor ~Account() runs automatically.');

  phase = 'gone';
  members = members.map((m) => ({ ...m, value: 'freed' }));
  snap(11, [], 'The object is destroyed and its storage reclaimed. Encapsulation kept the data and its logic together for its whole life.');

  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const PHASE_META: Record<Phase, { label: string; color: string }> = {
  declared: { label: 'declared', color: '#fbbf24' },
  constructing: { label: 'constructing', color: '#38bdf8' },
  alive: { label: 'alive', color: '#10b981' },
  destructing: { label: 'destructing', color: '#f43f5e' },
  gone: { label: 'destroyed', color: '#8b5cf6' },
};

export default function CppObjectLifecycle() {
  const frames = useMemo(() => buildFrames(), []);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(
    frames.length,
    2,
  );
  const frame = frames[Math.min(index, frames.length - 1)];
  const meta = PHASE_META[frame.phase];
  const dim = frame.phase === 'declared' || frame.phase === 'gone';

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      {/* Source listing with the current line highlighted. */}
      <div className="mb-4 overflow-x-auto rounded-lg border border-edge bg-bg/40 p-3 font-mono text-xs leading-relaxed">
        {CODE.map((line, i) => {
          const active = frame.code === i;
          return (
            <div
              key={i}
              className={`whitespace-pre rounded px-2 py-0.5 ${
                active ? 'bg-accent/15 text-accent' : 'text-muted'
              }`}
            >
              {active ? '>' : ' '} {line}
            </div>
          );
        })}
      </div>

      {/* The object and its member layout. */}
      <div className="rounded-lg border border-edge bg-bg/40 p-3">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-mono font-semibold text-fg">Account a</span>
          <span
            className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide"
            style={{ borderColor: meta.color, color: meta.color }}
          >
            {meta.label}
          </span>
        </div>

        <div
          className="rounded border-2 p-2 transition-colors"
          style={{ borderColor: dim ? 'var(--edge)' : meta.color }}
        >
          <div className="grid grid-cols-2 gap-2">
            {frame.members.map((m) => {
              const hot = frame.touched.includes(m.name);
              return (
                <div
                  key={m.name}
                  className={`rounded border bg-surface p-2 transition-colors ${
                    hot ? 'border-accent' : 'border-edge/60'
                  }`}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-xs font-semibold text-fg">{m.name}</span>
                    <span className="font-mono text-[10px] text-muted">{m.type}</span>
                  </div>
                  <div
                    className={`mt-1 font-mono text-base ${
                      m.value === 'freed' || m.value === '—' ? 'text-muted/50' : 'text-fg'
                    }`}
                  >
                    {m.value}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 text-center font-mono text-[10px] text-muted">
            one contiguous object &mdash; members stored together
          </div>
        </div>
      </div>

      {/* Lifecycle track. */}
      <div className="mt-3 flex items-center justify-between gap-1 text-[10px]">
        {(['constructing', 'alive', 'destructing'] as Phase[]).map((p, i) => {
          const order: Phase[] = ['declared', 'constructing', 'alive', 'destructing', 'gone'];
          const reached = order.indexOf(frame.phase) >= order.indexOf(p);
          const c = PHASE_META[p];
          return (
            <div key={p} className="flex flex-1 items-center gap-1">
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full border font-mono"
                style={{
                  borderColor: reached ? c.color : 'var(--edge)',
                  color: reached ? c.color : 'var(--muted)',
                }}
              >
                {i + 1}
              </span>
              <span style={{ color: reached ? c.color : 'var(--muted)' }}>{c.label}</span>
            </div>
          );
        })}
      </div>

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
