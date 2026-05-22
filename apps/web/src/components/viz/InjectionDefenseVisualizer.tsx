import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

type Mode = 'unsafe' | 'safe';

type Frame = { note: string; danger: boolean };

const TEMPLATE_PREFIX = "SELECT * FROM users WHERE name = '";
const TEMPLATE_SUFFIX = "'";

// Build the explanation steps for the chosen mode and user input.
function buildFrames(mode: Mode, input: string): Frame[] {
  if (mode === 'unsafe') {
    return [
      { note: `User types a name into a form: "${input}"`, danger: false },
      { note: 'The app builds SQL by gluing the raw input into the query string.', danger: false },
      {
        note: 'The database receives ONE blob of text and cannot tell code from data — quotes in the input can end the string early and add new clauses.',
        danger: true,
      },
      {
        note: "If the input contains SQL syntax (like ' OR 1=1 --), the WHERE condition becomes always true, returning every row. This is SQL injection.",
        danger: true,
      },
    ];
  }
  return [
    { note: `User types the same name: "${input}"`, danger: false },
    { note: 'The query uses a placeholder (?) instead of the value. The SQL structure is fixed and sent first.', danger: false },
    {
      note: 'The input travels separately as a bound parameter — the driver/database always treats it as pure data, never as code.',
      danger: false,
    },
    {
      note: "Even ' OR 1=1 -- is just a (weird) literal name to search for. It matches no user. The injection is neutralized.",
      danger: false,
    },
  ];
}

// Naive client-side preview of what concatenation would produce — purely to
// illustrate the danger, not to execute anything.
function previewUnsafe(input: string): string {
  return `${TEMPLATE_PREFIX}${input}${TEMPLATE_SUFFIX}`;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const EXAMPLES = ["alice", "' OR 1=1 --", "Robert'); DROP TABLE users; --"];

export default function InjectionDefenseVisualizer() {
  const [mode, setMode] = useState<Mode>('unsafe');
  const [input, setInput] = useState("' OR 1=1 --");

  const frames = useMemo(() => buildFrames(mode, input), [mode, input]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 1.2);
  const frame = frames[Math.min(index, frames.length - 1)] ?? frames[0];

  const tab = (m: Mode, label: string, color: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className="rounded border px-3 py-1 text-sm transition"
      style={
        mode === m
          ? { borderColor: color, color, background: 'color-mix(in oklab, var(--surface), transparent 0%)' }
          : { borderColor: 'var(--border)', color: 'var(--muted)' }
      }
    >
      {label}
    </button>
  );

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tab('unsafe', 'Unsafe: string concatenation', '#f43f5e')}
        {tab('safe', 'Safe: parameterized query', '#10b981')}
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-xs text-muted">Form input (the "name" field)</label>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full rounded border border-edge bg-bg px-3 py-2 font-mono text-sm text-fg"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className={btn} onClick={() => setInput(ex)}>
              {ex}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-edge bg-bg/40 p-3 font-mono text-sm">
        {mode === 'unsafe' ? (
          <>
            <div className="mb-1 text-xs uppercase tracking-wide" style={{ color: '#f43f5e' }}>
              query sent to the database
            </div>
            <div className="break-all">
              <span className="text-muted">{TEMPLATE_PREFIX}</span>
              <span style={{ color: index >= 1 ? '#f43f5e' : 'var(--fg)' }}>{input}</span>
              <span className="text-muted">{TEMPLATE_SUFFIX}</span>
            </div>
            {index >= 3 && (
              <div className="mt-2 text-xs" style={{ color: '#f43f5e' }}>
                effective: {previewUnsafe(input)}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mb-1 text-xs uppercase tracking-wide" style={{ color: '#10b981' }}>
              parameterized query
            </div>
            <div className="break-all">
              <span className="text-muted">SELECT * FROM users WHERE name = </span>
              <span style={{ color: '#10b981' }}>?</span>
            </div>
            <div className="mt-2 text-xs text-muted">
              bound parameter: <span style={{ color: index >= 2 ? '#10b981' : 'var(--fg)' }}>[{JSON.stringify(input)}]</span>{' '}
              <span className="text-muted/70">(always treated as data)</span>
            </div>
          </>
        )}
      </div>

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
          <input type="range" min={1} max={6} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
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

      <div
        className="mt-4 flex items-start gap-2 border-t border-edge pt-4 font-mono text-xs"
        style={{ color: frame.danger ? '#f43f5e' : 'var(--fg)' }}
      >
        <Icon name={frame.danger ? 'target' : 'check'} size={15} className="mt-0.5 shrink-0" />
        <span>{frame.note}</span>
      </div>
    </div>
  );
}
