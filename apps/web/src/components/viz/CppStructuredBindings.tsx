import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

/** Two modern-C++ features, switchable:
 *
 *  "bindings" — structured bindings unpack an aggregate into named locals:
 *      struct Point { int x; int y; };
 *      auto [a, b] = Point{3, 7};   // a binds to x, b binds to y
 *    We light up each member as it is bound to its new name. Also works for
 *    std::pair / std::tuple and map iteration (auto [k, v] : m).
 *
 *  "optional" — std::optional<int> models "a value or nothing" without sentinels:
 *      empty -> has_value() == false -> calling value() would throw
 *      engaged -> has_value() == true -> value() returns the contained int
 *    We step through constructing, querying, and safely reading it.            */

type Mode = 'bindings' | 'optional';

type Member = { name: string; value: number; bound: string | null };

type BindFrame = {
  code: number;
  members: Member[];
  active: number | null;
  note: string;
};

function buildBindings(): BindFrame[] {
  const base: Member[] = [
    { name: 'x', value: 3, bound: null },
    { name: 'y', value: 7, bound: null },
  ];
  const frames: BindFrame[] = [];
  const snap = (f: Omit<BindFrame, 'members'>, m: Member[]) =>
    frames.push({ ...f, members: m.map((x) => ({ ...x })) });

  let m = base.map((x) => ({ ...x }));
  snap(
    {
      code: 0,
      active: null,
      note: 'A Point aggregate holds two members in declaration order: x = 3, then y = 7.',
    },
    m,
  );
  m = m.map((x) => (x.name === 'x' ? { ...x, bound: 'a' } : x));
  snap(
    {
      code: 1,
      active: 0,
      note: 'auto [a, b] introduces names positionally. The first name, a, binds to the first member, x (3).',
    },
    m,
  );
  m = m.map((x) => (x.name === 'y' ? { ...x, bound: 'b' } : x));
  snap(
    {
      code: 1,
      active: 1,
      note: 'The second name, b, binds to the second member, y (7). The names are not new copies — by default they alias the members.',
    },
    m,
  );
  snap(
    {
      code: 2,
      active: null,
      note: 'Now a and b are ordinary locals you can use directly — far clearer than p.first / p.second or std::get<0>(p).',
    },
    m,
  );
  return frames;
}

const BIND_CODE = [
  'struct Point { int x; int y; };',
  'auto [a, b] = Point{3, 7};',
  'int sum = a + b;   // 10',
];

type OptState = 'empty' | 'engaged';
type OptFrame = {
  code: number;
  state: OptState;
  hasValue: boolean;
  stored: number | null;
  read: string | null;
  danger: boolean;
  note: string;
};

function buildOptional(): OptFrame[] {
  return [
    {
      code: 0,
      state: 'empty',
      hasValue: false,
      stored: null,
      read: null,
      danger: false,
      note: 'std::optional<int> starts empty (std::nullopt). It models "maybe an int" with no magic sentinel like -1.',
    },
    {
      code: 1,
      state: 'empty',
      hasValue: false,
      stored: null,
      read: null,
      danger: true,
      note: 'has_value() is false. Calling .value() now would throw std::bad_optional_access — always check first, or use value_or.',
    },
    {
      code: 2,
      state: 'engaged',
      hasValue: true,
      stored: 42,
      read: null,
      danger: false,
      note: 'Assigning a value engages the optional: it now holds 42, in-place (no heap allocation). has_value() becomes true.',
    },
    {
      code: 3,
      state: 'engaged',
      hasValue: true,
      stored: 42,
      read: '42',
      danger: false,
      note: 'Because has_value() is true, .value() (or *opt) safely returns the contained 42.',
    },
    {
      code: 4,
      state: 'empty',
      hasValue: false,
      stored: null,
      read: '0',
      danger: false,
      note: 'After reset() the optional is empty again. value_or(0) returns the fallback 0 instead of throwing — a safe default.',
    },
  ];
}

const OPT_CODE = [
  'std::optional<int> opt;        // empty',
  'if (opt.has_value()) use(*opt);',
  'opt = 42;                      // engaged',
  'int v = opt.value();           // 42',
  'opt.reset();  int w = opt.value_or(0);',
];

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const EMERALD = '#10b981';
const ROSE = '#f43f5e';
const VIOLET = '#8b5cf6';
const SKY = '#38bdf8';

export default function CppStructuredBindings() {
  const [mode, setMode] = useState<Mode>('bindings');
  const bindFrames = useMemo(() => buildBindings(), []);
  const optFrames = useMemo(() => buildOptional(), []);
  const count = mode === 'bindings' ? bindFrames.length : optFrames.length;
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(count, 2);

  const bf = bindFrames[Math.min(index, bindFrames.length - 1)];
  const of = optFrames[Math.min(index, optFrames.length - 1)];
  const code = mode === 'bindings' ? BIND_CODE : OPT_CODE;
  const activeCode = mode === 'bindings' ? bf.code : of.code;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {(['bindings', 'optional'] as Mode[]).map((m) => (
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
            {m === 'bindings' ? 'Structured bindings' : 'std::optional'}
          </button>
        ))}
      </div>

      {/* Source listing. */}
      <div className="mb-4 overflow-x-auto rounded-lg border border-edge bg-bg/40 p-3 font-mono text-xs leading-relaxed">
        {code.map((line, i) => {
          const active = activeCode === i;
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

      {mode === 'bindings' ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-edge bg-bg/40 p-3">
            <div className="mb-2 text-xs font-semibold text-fg">Point aggregate</div>
            <div className="grid grid-cols-2 gap-3">
              {bf.members.map((m, i) => (
                <div
                  key={m.name}
                  className="flex flex-col rounded-lg border bg-surface p-3 transition-colors"
                  style={{ borderColor: bf.active === i ? VIOLET : 'var(--edge)' }}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-sm font-semibold text-fg">.{m.name}</span>
                    <span className="text-[10px] uppercase tracking-wide text-muted">member {i}</span>
                  </div>
                  <div className="mt-1 font-mono text-2xl text-fg">{m.value}</div>
                  <div className="mt-2 h-5 font-mono text-xs">
                    {m.bound ? (
                      <span style={{ color: VIOLET }}>
                        &larr; bound to {m.bound}
                      </span>
                    ) : (
                      <span className="text-muted/50">unbound</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-edge bg-bg/40 p-3">
            <div className="mb-2 text-xs font-semibold text-fg">New names in scope</div>
            <div className="flex gap-2">
              {bf.members
                .filter((m) => m.bound)
                .map((m) => (
                  <span
                    key={m.bound}
                    className="rounded border px-3 py-1 font-mono text-sm"
                    style={{ borderColor: EMERALD, color: EMERALD }}
                  >
                    {m.bound} = {m.value}
                  </span>
                ))}
              {bf.members.every((m) => !m.bound) && (
                <span className="text-xs text-muted/60">(none yet)</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-edge bg-bg/40 p-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold text-fg">std::optional&lt;int&gt;</span>
              <span
                className="rounded-full border px-2 py-0.5 font-mono"
                style={{
                  borderColor: of.hasValue ? EMERALD : 'var(--muted)',
                  color: of.hasValue ? EMERALD : 'var(--muted)',
                }}
              >
                has_value() = {String(of.hasValue)}
              </span>
            </div>
            <div
              className="flex h-20 items-center justify-center rounded-lg border-2 font-mono text-2xl transition-colors"
              style={{
                borderColor: of.hasValue ? EMERALD : 'var(--edge)',
                color: of.hasValue ? EMERALD : 'var(--muted)',
              }}
            >
              {of.state === 'engaged' ? of.stored : 'nullopt (empty)'}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-edge bg-bg/40 p-3">
              <div className="mb-1 text-xs font-semibold text-fg">read result</div>
              <div className="font-mono text-lg" style={{ color: of.read ? SKY : 'var(--muted)' }}>
                {of.read ?? '—'}
              </div>
            </div>
            <div
              className="flex flex-col justify-center rounded-lg border bg-bg/40 p-3"
              style={{ borderColor: of.danger ? ROSE : 'var(--edge)' }}
            >
              <div className="text-xs font-semibold text-fg">.value() safety</div>
              <div className="mt-1 font-mono text-xs" style={{ color: of.danger ? ROSE : EMERALD }}>
                {of.danger ? 'would throw bad_optional_access' : 'safe'}
              </div>
            </div>
          </div>
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
        <button type="button" className={btn} onClick={next} disabled={index >= count - 1}>
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
          max={Math.max(count - 1, 0)}
          value={index}
          onChange={(e) => seek(Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
          aria-label="Timeline"
        />
        <span className="shrink-0 font-mono text-xs text-muted">
          {index + 1}/{count}
        </span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 text-xs text-muted">
        {mode === 'bindings' ? bf.note : of.note}
      </div>
    </div>
  );
}
