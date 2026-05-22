import { useMemo } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

/** Animates throw -> stack unwinding -> catch, running destructors on the way:
 *
 *  void c() { Lock lk; throw std::runtime_error("boom"); }  // lk must be freed
 *  void b() { File f("x"); c(); }                           // f must be freed
 *  void a() { try { b(); } catch (const std::exception& e) { ... } }
 *
 *  When c() throws, the runtime unwinds frame by frame back to a()'s matching
 *  catch, destroying each frame's RAII objects along the way. That is why RAII
 *  makes exception-safe code: cleanup happens automatically during unwinding.   */

type Local = { name: string; resource: string; freed: boolean };
type StackFrame = { fn: string; locals: Local[]; unwound: boolean };

type Frame = {
  code: number;
  stack: StackFrame[];
  exception: boolean; // is an exception in flight?
  caught: boolean;
  marker?: 'throw' | 'destruct' | 'unwind' | 'catch';
  note: string;
};

const CODE = [
  'void c() {',
  '  Lock lk;                 // RAII: holds a mutex',
  '  throw std::runtime_error("boom");',
  '}',
  'void b() {',
  '  File f("data.txt");      // RAII: holds a file handle',
  '  c();',
  '}',
  'void a() {',
  '  try { b(); }',
  '  catch (const std::exception& e) { /* handle */ }',
  '}',
];

function buildFrames(): Frame[] {
  const frames: Frame[] = [];
  let stack: StackFrame[] = [];
  let exception = false;
  let caught = false;
  const snap = (code: number, marker: Frame['marker'], note: string) =>
    frames.push({
      code,
      exception,
      caught,
      marker,
      stack: stack.map((s) => ({ ...s, locals: s.locals.map((l) => ({ ...l })) })),
      note,
    });

  // a() calls b() inside try
  stack = [{ fn: 'a()  [try]', locals: [], unwound: false }];
  snap(9, undefined, 'a() enters its try block and calls b(). The try sets up a place to catch exceptions.');

  stack = [...stack, { fn: 'b()', locals: [{ name: 'f', resource: 'File handle', freed: false }], unwound: false }];
  snap(5, undefined, 'b() is pushed. It builds a File object f — an RAII handle that owns an open file.');

  stack = [...stack, { fn: 'c()', locals: [{ name: 'lk', resource: 'mutex lock', freed: false }], unwound: false }];
  snap(1, undefined, 'c() is pushed. It builds a Lock lk — an RAII object that holds a mutex.');

  // throw
  exception = true;
  snap(2, 'throw', 'c() throws a runtime_error. Normal execution stops; the runtime begins searching up the stack for a matching catch.');

  // unwind c(): destroy lk
  stack = stack.map((s) => (s.fn === 'c()' ? { ...s, locals: s.locals.map((l) => ({ ...l, freed: true })) } : s));
  snap(2, 'destruct', 'Unwinding c(): before the frame is discarded, lk’s destructor runs and releases the mutex. No leaked lock.');
  stack = stack.filter((s) => s.fn !== 'c()');
  snap(2, 'unwind', 'c()’s frame is popped. The exception keeps propagating because c() had no catch.');

  // unwind b(): destroy f
  stack = stack.map((s) => (s.fn === 'b()' ? { ...s, locals: s.locals.map((l) => ({ ...l, freed: true })) } : s));
  snap(6, 'destruct', 'Unwinding b(): f’s destructor runs and closes the file handle automatically. Again cleanup happens with no extra code.');
  stack = stack.filter((s) => s.fn !== 'b()');
  snap(6, 'unwind', 'b()’s frame is popped. b() also had no catch, so propagation continues up to a().');

  // a() catches
  caught = true;
  exception = false;
  snap(10, 'catch', 'a()’s catch matches std::exception, so unwinding stops here. The handler runs with all RAII resources already released — this is exception safety.');

  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const ROSE = '#f43f5e';
const EMERALD = '#10b981';
const AMBER = '#fbbf24';

const MARKER_LABEL: Record<NonNullable<Frame['marker']>, { text: string; color: string }> = {
  throw: { text: 'exception thrown', color: ROSE },
  destruct: { text: 'destructor runs', color: AMBER },
  unwind: { text: 'frame popped', color: ROSE },
  catch: { text: 'caught — unwinding stops', color: EMERALD },
};

export default function CppStackUnwinding() {
  const frames = useMemo(() => buildFrames(), []);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(
    frames.length,
    2,
  );
  const frame = frames[Math.min(index, frames.length - 1)];
  const marker = frame.marker ? MARKER_LABEL[frame.marker] : null;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      {/* Source listing. */}
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

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        {/* Call stack — newest frame on top, unwinding pops from the top. */}
        <div className="rounded-lg border border-edge bg-bg/40 p-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-fg">Call stack</span>
            <span className="text-muted">unwinds top &rarr; down to the catch</span>
          </div>
          <div className="flex min-h-44 flex-col gap-2">
            {[...frame.stack].reverse().map((sf, i) => {
              const top = i === 0;
              return (
                <div
                  key={sf.fn}
                  className="rounded border-2 px-3 py-2 transition-colors"
                  style={{
                    borderColor: frame.exception && top ? ROSE : top ? 'var(--accent)' : 'var(--edge)',
                  }}
                >
                  <div className="font-mono text-xs font-semibold text-fg">{sf.fn}</div>
                  <div className="mt-1 space-y-0.5">
                    {sf.locals.length === 0 && (
                      <div className="font-mono text-[11px] text-muted/60">(no RAII locals)</div>
                    )}
                    {sf.locals.map((l) => (
                      <div
                        key={l.name}
                        className="flex items-center gap-1.5 font-mono text-[11px]"
                        style={{ color: l.freed ? EMERALD : 'var(--muted)' }}
                      >
                        {l.freed && <Icon name="check" size={12} />}
                        {l.name} ({l.resource}){l.freed ? ' — released' : ''}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {frame.caught && (
              <div
                className="rounded border-2 px-3 py-2 font-mono text-xs"
                style={{ borderColor: EMERALD, color: EMERALD }}
              >
                catch handler running
              </div>
            )}
          </div>
        </div>

        {/* Exception state panel. */}
        <div className="flex min-w-44 flex-col items-center justify-center gap-2 rounded-lg border border-edge bg-bg/40 p-3">
          <div className="text-xs text-muted">exception</div>
          <div
            className="flex h-16 w-full items-center justify-center whitespace-pre-line rounded border-2 text-center font-mono text-xs transition-colors"
            style={{
              borderColor: frame.caught ? EMERALD : frame.exception ? ROSE : 'var(--edge)',
              color: frame.caught ? EMERALD : frame.exception ? ROSE : 'var(--muted)',
            }}
          >
            {frame.caught
              ? 'caught\nin a()'
              : frame.exception
                ? 'in flight\nruntime_error'
                : 'none'}
          </div>
          {marker && (
            <div
              className="rounded-full border px-2 py-0.5 text-center text-[10px] uppercase tracking-wide"
              style={{ borderColor: marker.color, color: marker.color }}
            >
              {marker.text}
            </div>
          )}
        </div>
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
