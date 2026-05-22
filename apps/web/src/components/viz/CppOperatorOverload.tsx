import { useMemo } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

/** Shows how an operator expression on a custom Vector2 desugars into ordinary
 *  function calls.
 *
 *  struct Vec2 { double x, y; };
 *  Vec2 a{1,2}, b{3,4};
 *  Vec2 c = a + b;            // -> operator+(a, b)
 *  bool same = (c == b);      // -> operator==(c, b)
 *  std::cout << c;            // -> operator<<(std::cout, c)
 *
 *  Each step rewrites the source expression into the equivalent call and shows
 *  the resulting value, so the "magic" of operators becomes visible.            */

type Frame = {
  code: number;
  expr: string; // what the programmer wrote
  call: string; // what the compiler actually calls
  kind: 'free/friend' | 'member' | 'free (<<)';
  result: { label: string; value: string } | null;
  a: { x: number; y: number };
  b: { x: number; y: number };
  c: { x: number; y: number } | null;
  output: string | null;
  note: string;
};

const A = { x: 1, y: 2 };
const B = { x: 3, y: 4 };

function buildFrames(): Frame[] {
  const c = { x: A.x + B.x, y: A.y + B.y }; // {4, 6}
  return [
    {
      code: 0,
      expr: 'Vec2 a{1, 2}, b{3, 4};',
      call: '// two Vec2 values constructed',
      kind: 'member',
      result: null,
      a: A,
      b: B,
      c: null,
      output: null,
      note: 'Two Vec2 objects exist. Operators are just functions named operator@; the compiler picks one by the operand types.',
    },
    {
      code: 1,
      expr: 'Vec2 c = a + b;',
      call: 'operator+(a, b)',
      kind: 'free/friend',
      result: { label: 'c', value: `{${c.x}, ${c.y}}` },
      a: A,
      b: B,
      c,
      output: null,
      note: 'a + b rewrites to operator+(a, b). As a free (often friend) function it treats both operands symmetrically and returns a new Vec2 by value.',
    },
    {
      code: 2,
      expr: 'bool same = (c == b);',
      call: 'operator==(c, b)',
      kind: 'free/friend',
      result: { label: 'same', value: `${c.x === B.x && c.y === B.y}` },
      a: A,
      b: B,
      c,
      output: null,
      note: 'c == b rewrites to operator==(c, b), returning false here. Since C++20 you can default it (= default) and the compiler derives != for free.',
    },
    {
      code: 3,
      expr: 'double m = c[0];',
      call: 'c.operator[](0)',
      kind: 'member',
      result: { label: 'm', value: `${c.x}` },
      a: A,
      b: B,
      c,
      output: null,
      note: 'Subscript operator[] must be a member function. c[0] becomes c.operator[](0), returning a reference to the x component.',
    },
    {
      code: 4,
      expr: 'std::cout << c;',
      call: 'operator<<(std::cout, c)',
      kind: 'free (<<)',
      result: null,
      a: A,
      b: B,
      c,
      output: `(${c.x}, ${c.y})`,
      note: 'Stream insertion is a free function taking std::ostream& first, so it cannot be a member of Vec2. It returns the stream to allow chaining (<< a << b).',
    },
  ];
}

const CODE = [
  'Vec2 a{1, 2}, b{3, 4};',
  'Vec2 c = a + b;',
  'bool same = (c == b);',
  'double m = c[0];',
  'std::cout << c;',
];

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const VIOLET = '#8b5cf6';
const EMERALD = '#10b981';
const SKY = '#38bdf8';

function VecBox({
  name,
  v,
  color,
}: {
  name: string;
  v: { x: number; y: number } | null;
  color: string;
}) {
  return (
    <div
      className="flex flex-col rounded-lg border bg-bg/40 p-3"
      style={{ borderColor: v ? color : 'var(--edge)' }}
    >
      <span className="font-mono text-sm font-semibold text-fg">{name}</span>
      <div className="mt-1 font-mono text-xs" style={{ color: v ? color : 'var(--muted)' }}>
        {v ? `{ x: ${v.x}, y: ${v.y} }` : '—'}
      </div>
    </div>
  );
}

export default function CppOperatorOverload() {
  const frames = useMemo(() => buildFrames(), []);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(
    frames.length,
    2,
  );
  const frame = frames[Math.min(index, frames.length - 1)];

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

      {/* Desugaring: what you wrote -> what the compiler calls. */}
      <div className="mb-4 rounded-lg border border-edge bg-bg/40 p-4">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-4">
          <code className="rounded border border-edge px-3 py-2 font-mono text-sm text-fg">
            {frame.expr}
          </code>
          <Icon name="arrow-right" size={18} className="rotate-90 text-muted sm:rotate-0" />
          <code
            className="rounded border px-3 py-2 font-mono text-sm"
            style={{ borderColor: VIOLET, color: VIOLET }}
          >
            {frame.call}
          </code>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xs">
          <span className="rounded-full border border-edge px-2 py-0.5 text-muted">
            kind: {frame.kind}
          </span>
          {frame.result && (
            <span
              className="rounded-full border px-2 py-0.5 font-mono"
              style={{ borderColor: EMERALD, color: EMERALD }}
            >
              {frame.result.label} = {frame.result.value}
            </span>
          )}
        </div>
      </div>

      {/* Operand / result values. */}
      <div className="grid grid-cols-3 gap-3">
        <VecBox name="a" v={frame.a} color={SKY} />
        <VecBox name="b" v={frame.b} color={SKY} />
        <VecBox name="c" v={frame.c} color={EMERALD} />
      </div>

      {/* Simulated console for operator<<. */}
      <div className="mt-3 rounded-lg border border-edge bg-bg/40 p-3">
        <div className="mb-1 flex items-center gap-2 text-xs">
          <Icon name="code" size={14} className="text-muted" />
          <span className="font-semibold text-fg">std::cout</span>
        </div>
        <div className="font-mono text-sm" style={{ color: frame.output ? VIOLET : 'var(--muted)' }}>
          {frame.output ?? '(no output yet)'}
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
