import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

/** A lambda is applied across a vector with std::transform, and we mutate the
 *  captured variable mid-iteration so capture-by-value vs by-reference diverge:
 *
 *    int factor = 2;
 *    auto scale = [CAP](int v) { return v * factor; };
 *    std::transform(data.begin(), data.end(), out.begin(), scale);
 *    // ...and somewhere factor is bumped to 10 partway through.
 *
 *  By value ([=] / [factor]): the closure froze a copy of factor (2) at creation,
 *    so every element uses 2 regardless of later changes.
 *  By reference ([&]): the closure holds a reference to the live factor, so once
 *    it changes to 10 the remaining elements use 10.                            */

type Mode = 'value' | 'ref';

const DATA = [5, 8, 3, 6];
const INITIAL = 2;
const BUMPED = 10;
const BUMP_AT = 2; // factor changes right before element index 2 is processed

type Frame = {
  code: number;
  i: number; // element being processed (-1 = setup)
  out: (number | null)[];
  capturedFactor: number; // the value the closure currently sees
  liveFactor: number; // the actual variable in the enclosing scope
  note: string;
};

function buildFrames(mode: Mode): Frame[] {
  const frames: Frame[] = [];
  const out: (number | null)[] = DATA.map(() => null);

  let captured = INITIAL; // what the lambda body reads
  let live = INITIAL; // the real variable

  frames.push({
    code: 0,
    i: -1,
    out: [...out],
    capturedFactor: captured,
    liveFactor: live,
    note:
      mode === 'value'
        ? 'Capture by value [=]: the closure stores its OWN copy of factor (2), taken at the moment the lambda is created.'
        : 'Capture by reference [&]: the closure stores a reference to the enclosing factor — no copy. It always reads the live value.',
  });

  for (let i = 0; i < DATA.length; i++) {
    // Mutate the enclosing factor partway through.
    if (i === BUMP_AT) {
      live = BUMPED;
      if (mode === 'ref') captured = BUMPED; // reference sees the change
      frames.push({
        code: 3,
        i: -1, // marker step: no element highlighted while factor changes
        out: [...out],
        capturedFactor: captured,
        liveFactor: live,
        note:
          mode === 'value'
            ? 'factor = 10 in the outer scope. The by-value closure is unaffected — it still holds its frozen copy (2).'
            : 'factor = 10 in the outer scope. The by-reference closure points at the same variable, so it now reads 10.',
      });
    }

    out[i] = DATA[i] * captured;
    frames.push({
      code: 2,
      i,
      out: [...out],
      capturedFactor: captured,
      liveFactor: live,
      note: `transform applies the lambda to data[${i}] = ${DATA[i]}: ${DATA[i]} * ${captured} = ${out[i]}.`,
    });
  }

  frames.push({
    code: 4,
    i: DATA.length,
    out: [...out],
    capturedFactor: captured,
    liveFactor: live,
    note:
      mode === 'value'
        ? 'Done. Every result used factor = 2, because the value capture froze it. Predictable, copy-safe.'
        : 'Done. The first results used 2, the rest used 10 — the reference followed the live variable. Powerful, but beware dangling references after the scope ends.',
  });

  return frames;
}

function codeFor(mode: Mode): string[] {
  const cap = mode === 'value' ? '=' : '&';
  return [
    'int factor = 2;',
    `auto scale = [${cap}](int v) { return v * factor; };`,
    'std::transform(data.begin(), data.end(), out.begin(), scale);',
    'factor = 10;   // changes mid-run',
    '// out now holds the scaled values',
  ];
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const VIOLET = '#8b5cf6';
const EMERALD = '#10b981';
const AMBER = '#fbbf24';

export default function CppLambdaCapture() {
  const [mode, setMode] = useState<Mode>('value');
  const frames = useMemo(() => buildFrames(mode), [mode]);
  const code = useMemo(() => codeFor(mode), [mode]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(
    frames.length,
    2,
  );
  const frame = frames[Math.min(index, frames.length - 1)];
  const activeIdx = frame.i;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {(['value', 'ref'] as Mode[]).map((m) => (
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
            {m === 'value' ? 'Capture by value [=]' : 'Capture by reference [&]'}
          </button>
        ))}
      </div>

      {/* Source listing. */}
      <div className="mb-4 overflow-x-auto rounded-lg border border-edge bg-bg/40 p-3 font-mono text-xs leading-relaxed">
        {code.map((line, i) => {
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

      {/* The closure and the live variable, side by side. */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border bg-bg/40 p-3" style={{ borderColor: VIOLET }}>
          <div className="mb-1 text-xs font-semibold" style={{ color: VIOLET }}>
            closure (scale)
          </div>
          <div className="font-mono text-xs text-muted">
            captures factor {mode === 'value' ? 'by value (copy)' : 'by reference (alias)'}
          </div>
          <div className="mt-2 font-mono text-lg" style={{ color: VIOLET }}>
            factor = {frame.capturedFactor}
          </div>
        </div>
        <div className="rounded-lg border border-edge bg-bg/40 p-3">
          <div className="mb-1 text-xs font-semibold text-fg">enclosing scope</div>
          <div className="font-mono text-xs text-muted">the real variable</div>
          <div
            className="mt-2 font-mono text-lg"
            style={{ color: frame.liveFactor === BUMPED ? AMBER : 'var(--fg)' }}
          >
            factor = {frame.liveFactor}
          </div>
        </div>
      </div>

      {/* Input -> output mapping. */}
      <div className="rounded-lg border border-edge bg-bg/40 p-3">
        <div className="mb-2 text-xs font-semibold text-fg">data &rarr; out (via std::transform)</div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {DATA.map((d, i) => (
              <div
                key={i}
                className="flex h-9 w-12 items-center justify-center rounded border font-mono text-sm"
                style={{
                  borderColor: i === activeIdx ? AMBER : 'var(--edge)',
                  color: i === activeIdx ? AMBER : 'var(--fg)',
                }}
              >
                {d}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            {frame.out.map((o, i) => (
              <div
                key={i}
                className="flex h-9 w-12 items-center justify-center rounded border font-mono text-sm"
                style={{
                  borderColor: o === null ? 'var(--edge)' : EMERALD,
                  color: o === null ? 'var(--muted)' : EMERALD,
                  opacity: o === null ? 0.5 : 1,
                }}
              >
                {o ?? '·'}
              </div>
            ))}
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
