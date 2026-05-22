import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

/** Shows how a virtual call is dispatched at run time through a vtable.
 *
 *  struct Shape { virtual double area() const; };
 *  struct Circle : Shape { double area() const override; };  // overrides
 *  struct Square : Shape { double area() const override; };  // overrides
 *  Shape* s = new Circle(...);   // static type Shape*, dynamic type Circle
 *  s->area();                    // resolved via the object's vptr -> vtable
 *
 *  Each concrete object holds a hidden vptr pointing at its class vtable.
 *  A virtual call reads the vptr, looks up the slot, and jumps to the override.
 *  Pick which object s points to and step through the lookup.                    */

type ShapeKind = 'Circle' | 'Square';

type Step = {
  stage: 0 | 1 | 2 | 3 | 4; // pipeline stage
  note: string;
};

const VTABLES: Record<ShapeKind, { slot: string; impl: string; result: string }> = {
  Circle: { slot: 'area()', impl: 'Circle::area', result: 'π·r²  = 28.27' },
  Square: { slot: 'area()', impl: 'Square::area', result: 'side²  = 16.00' },
};

const CODE = (kind: ShapeKind) => [
  'struct Shape  { virtual double area() const; };',
  'struct Circle : Shape { double area() const override; };',
  'struct Square : Shape { double area() const override; };',
  '',
  `Shape* s = new ${kind}(...);  // static type Shape*`,
  's->area();                 // which area() runs?',
];

function buildSteps(kind: ShapeKind): Step[] {
  const v = VTABLES[kind];
  return [
    { stage: 0, note: `s has static type Shape* but its dynamic type is ${kind}. The compiler cannot pick the function — the right override is decided at run time.` },
    { stage: 1, note: `The call s->area() is virtual, so the program first reads the hidden vptr stored inside the ${kind} object.` },
    { stage: 2, note: `The vptr points at ${kind}'s vtable: a per-class array of function pointers, one slot per virtual function.` },
    { stage: 3, note: `It looks up the area() slot. That slot was filled with ${v.impl} when ${kind} overrode it.` },
    { stage: 4, note: `Control jumps to ${v.impl} and returns ${v.result}. This indirection — vptr to vtable to override — is dynamic dispatch.` },
  ];
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const SKY = '#38bdf8';
const VIOLET = '#8b5cf6';
const EMERALD = '#10b981';

export default function CppVtable() {
  const [kind, setKind] = useState<ShapeKind>('Circle');
  const steps = useMemo(() => buildSteps(kind), [kind]);
  const code = useMemo(() => CODE(kind), [kind]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(
    steps.length,
    2,
  );
  const step = steps[Math.min(index, steps.length - 1)];
  const v = VTABLES[kind];
  const stage = step.stage;

  const other: ShapeKind = kind === 'Circle' ? 'Square' : 'Circle';

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted">Dynamic type of s:</span>
        {(['Circle', 'Square'] as ShapeKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded border px-3 py-1 font-mono text-sm transition ${
              kind === k
                ? 'border-accent bg-accent text-accent-fg'
                : 'border-edge text-fg hover:border-accent hover:text-accent'
            }`}
          >
            new {k}
          </button>
        ))}
      </div>

      {/* Source listing. */}
      <div className="mb-4 overflow-x-auto rounded-lg border border-edge bg-bg/40 p-3 font-mono text-xs leading-relaxed">
        {code.map((line, i) => {
          const active = (stage >= 1 && i === 5) || (stage === 0 && i === 4);
          return (
            <div
              key={i}
              className={`whitespace-pre rounded px-2 py-0.5 ${
                active ? 'bg-accent/15 text-accent' : 'text-muted'
              }`}
            >
              {active ? '>' : ' '} {line || ' '}
            </div>
          );
        })}
      </div>

      {/* Dispatch pipeline: object(vptr) -> vtable -> override. */}
      <div className="grid items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
        {/* The object with its hidden vptr. */}
        <div
          className="rounded-lg border-2 bg-bg/40 p-3 transition-colors"
          style={{ borderColor: stage >= 1 ? SKY : 'var(--edge)' }}
        >
          <div className="font-mono text-xs font-semibold text-fg">{kind} object</div>
          <div
            className={`mt-2 rounded border px-2 py-1 font-mono text-[11px] ${
              stage >= 1 ? 'border-[#38bdf8]' : 'border-edge/60'
            }`}
            style={{ color: stage >= 1 ? SKY : 'var(--muted)' }}
          >
            vptr &rarr; {kind} vtable
          </div>
          <div className="mt-1 rounded border border-edge/60 px-2 py-1 font-mono text-[11px] text-muted">
            ...data members...
          </div>
        </div>

        <div
          className="flex items-center justify-center"
          style={{ color: stage >= 2 ? SKY : 'var(--muted)' }}
        >
          <Icon name="arrow-right" size={18} className="rotate-90 sm:rotate-0" />
        </div>

        {/* The vtable for the chosen class. */}
        <div
          className="rounded-lg border-2 bg-bg/40 p-3 transition-colors"
          style={{ borderColor: stage >= 2 ? VIOLET : 'var(--edge)' }}
        >
          <div className="font-mono text-xs font-semibold text-fg">{kind} vtable</div>
          <div
            className={`mt-2 rounded border px-2 py-1 font-mono text-[11px] transition-colors ${
              stage >= 3 ? 'bg-accent/10' : ''
            }`}
            style={{ borderColor: stage >= 3 ? VIOLET : 'var(--edge)', color: stage >= 3 ? VIOLET : 'var(--fg)' }}
          >
            [0] {v.slot} &rarr; {v.impl}
          </div>
          <div className="mt-1 rounded border border-edge/60 px-2 py-1 font-mono text-[11px] text-muted">
            [1] ~{kind}() &rarr; ...
          </div>
        </div>

        <div
          className="flex items-center justify-center"
          style={{ color: stage >= 4 ? EMERALD : 'var(--muted)' }}
        >
          <Icon name="arrow-right" size={18} className="rotate-90 sm:rotate-0" />
        </div>

        {/* The override that actually runs. */}
        <div
          className="rounded-lg border-2 bg-bg/40 p-3 transition-colors"
          style={{ borderColor: stage >= 4 ? EMERALD : 'var(--edge)' }}
        >
          <div className="font-mono text-xs font-semibold text-fg">runs</div>
          <div
            className="mt-2 rounded border px-2 py-1 font-mono text-[11px]"
            style={{ borderColor: stage >= 4 ? EMERALD : 'var(--edge)', color: stage >= 4 ? EMERALD : 'var(--muted)' }}
          >
            {v.impl}
          </div>
          <div
            className="mt-1 font-mono text-[11px]"
            style={{ color: stage >= 4 ? EMERALD : 'var(--muted)' }}
          >
            {stage >= 4 ? `returns ${v.result}` : '...'}
          </div>
        </div>
      </div>

      <div className="mt-3 text-center font-mono text-[10px] text-muted">
        If s pointed at a {other}, the same call would follow {other}&apos;s vptr to {VTABLES[other].impl} instead.
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
        <button type="button" className={btn} onClick={next} disabled={index >= steps.length - 1}>
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
          max={Math.max(steps.length - 1, 0)}
          value={index}
          onChange={(e) => seek(Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
          aria-label="Timeline"
        />
        <span className="shrink-0 font-mono text-xs text-muted">
          {index + 1}/{steps.length}
        </span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 text-xs text-muted">{step.note}</div>
    </div>
  );
}
