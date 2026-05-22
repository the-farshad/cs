import { useMemo } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

/** Shows how the compiler "stamps out" a function template into concrete
 *  versions, one per distinct type argument it encounters at a call site:
 *
 *    template <class T> T myMax(T a, T b) { return a > b ? a : b; }
 *    myMax(3, 9);          -> instantiate myMax<int>
 *    myMax(2.5, 1.5);      -> instantiate myMax<double>
 *    myMax(7, 4);          -> reuse myMax<int> (already generated)
 *    myMax(s1, s2);        -> instantiate myMax<string>
 *
 *  We walk the call sites; each new T produces a generated overload, repeats
 *  reuse the existing one. The point: templates are a compile-time code
 *  generator, not runtime polymorphism.                                        */

type CallSite = { src: string; type: string };

const TEMPLATE = ['template <class T>', 'T myMax(T a, T b) {', '  return a > b ? a : b;', '}'];

const CALLS: CallSite[] = [
  { src: 'myMax(3, 9);', type: 'int' },
  { src: 'myMax(2.5, 1.5);', type: 'double' },
  { src: 'myMax(7, 4);', type: 'int' },
  { src: 'myMax(s1, s2);', type: 'std::string' },
];

type Instance = { type: string; body: string[] };

type Frame = {
  callIndex: number; // which call site is active (-1 = intro)
  instances: Instance[]; // generated overloads so far
  highlightType?: string; // instance just created or reused
  reused: boolean;
  note: string;
};

function bodyFor(type: string): string[] {
  return [`${type} myMax(${type} a, ${type} b) {`, '  return a > b ? a : b;', '}'];
}

function buildFrames(): Frame[] {
  const frames: Frame[] = [];
  const instances: Instance[] = [];
  const seen = new Set<string>();

  frames.push({
    callIndex: -1,
    instances: [],
    reused: false,
    note: 'The template is a blueprint. By itself it generates no machine code — the compiler waits for call sites.',
  });

  CALLS.forEach((call, i) => {
    const already = seen.has(call.type);
    if (!already) {
      seen.add(call.type);
      instances.push({ type: call.type, body: bodyFor(call.type) });
    }
    frames.push({
      callIndex: i,
      instances: instances.map((x) => ({ type: x.type, body: [...x.body] })),
      highlightType: call.type,
      reused: already,
      note: already
        ? `${call.src} also needs T = ${call.type}, but myMax<${call.type}> already exists — the compiler reuses it (no duplicate code).`
        : `${call.src} deduces T = ${call.type}. The compiler stamps out a fresh myMax<${call.type}> from the blueprint.`,
    });
  });

  frames.push({
    callIndex: CALLS.length,
    instances: instances.map((x) => ({ type: x.type, body: [...x.body] })),
    reused: false,
    note: `Done: ${instances.length} concrete functions were generated from one template. Each is as fast as hand-written code — instantiation happens entirely at compile time.`,
  });

  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function CppTemplateInstantiation() {
  const frames = useMemo(() => buildFrames(), []);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(
    frames.length,
    2,
  );
  const frame = frames[Math.min(index, frames.length - 1)];

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="grid gap-3 lg:grid-cols-2">
        {/* Left: the blueprint and the call sites. */}
        <div className="space-y-3">
          <div className="rounded-lg border border-edge bg-bg/40 p-3">
            <div className="mb-2 text-xs font-semibold text-fg">Template (blueprint)</div>
            <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-violet-300">
              {TEMPLATE.join('\n')}
            </pre>
          </div>

          <div className="rounded-lg border border-edge bg-bg/40 p-3">
            <div className="mb-2 text-xs font-semibold text-fg">Call sites</div>
            <div className="space-y-0.5 font-mono text-xs leading-relaxed">
              {CALLS.map((c, i) => {
                const active = frame.callIndex === i;
                return (
                  <div
                    key={c.src}
                    className={`flex items-center justify-between rounded px-2 py-0.5 ${
                      active ? 'bg-accent/15 text-accent' : 'text-muted'
                    }`}
                  >
                    <span>
                      {active ? '>' : ' '} {c.src}
                    </span>
                    <span className="text-[10px] text-muted">T = {c.type}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: the generated concrete instantiations. */}
        <div className="rounded-lg border border-edge bg-bg/40 p-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-fg">Generated code</span>
            <span className="text-muted">{frame.instances.length} instantiation(s)</span>
          </div>
          <div className="flex min-h-44 flex-col gap-2">
            {frame.instances.length === 0 && (
              <span className="m-auto text-xs text-muted/50">nothing generated yet</span>
            )}
            {frame.instances.map((inst) => {
              const isHot = frame.highlightType === inst.type;
              const reuseHit = isHot && frame.reused;
              return (
                <div
                  key={inst.type}
                  className={`rounded border px-3 py-2 transition-colors ${
                    reuseHit
                      ? 'border-[#38bdf8]'
                      : isHot
                        ? 'border-accent ring-2 ring-accent/40'
                        : 'border-edge'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-mono text-[11px] font-semibold text-emerald-300">
                      myMax&lt;{inst.type}&gt;
                    </span>
                    {isHot && (
                      <span
                        className={`text-[10px] uppercase tracking-wide ${
                          reuseHit ? 'text-[#38bdf8]' : 'text-accent'
                        }`}
                      >
                        {reuseHit ? 'reused' : 'stamped out'}
                      </span>
                    )}
                  </div>
                  <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-fg">
                    {inst.body.join('\n')}
                  </pre>
                </div>
              );
            })}
          </div>
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
