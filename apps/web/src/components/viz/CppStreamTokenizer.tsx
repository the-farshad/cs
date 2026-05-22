import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

/** Two views of working with text in C++:
 *
 *  "extract" — a std::istringstream is consumed token by token with operator>>.
 *    Whitespace is skipped; each `iss >> word` pulls one whitespace-delimited
 *    token and advances the read position (the get pointer).
 *
 *  "string" — a std::string is transformed by a sequence of member calls
 *    (substr, find, append) so you can watch the buffer change.
 *
 *  The point: a stream has a moving cursor that is consumed, while a string is a
 *  resizable buffer you index, search, and slice.                              */

type Mode = 'extract' | 'string';

type ExtractFrame = {
  pos: number; // get-pointer index into the source text
  highlight: [number, number] | null; // [start, end) of the token just read
  tokens: string[]; // tokens extracted so far
  code: number;
  note: string;
};

type StringFrame = {
  buffer: string;
  highlight: [number, number] | null; // [start, end) region of interest
  code: number;
  vars: { name: string; value: string }[];
  note: string;
};

const SOURCE = 'pi = 3.14 rad';

function buildExtract(): ExtractFrame[] {
  const frames: ExtractFrame[] = [];
  frames.push({
    pos: 0,
    highlight: null,
    tokens: [],
    code: 0,
    note: 'An istringstream wraps the text "pi = 3.14 rad". The get pointer starts at index 0.',
  });

  // Token boundaries within SOURCE: "pi"(0..2) "="(3..4) "3.14"(5..9) "rad"(10..13)
  const steps: { start: number; end: number; value: string; into: string }[] = [
    { start: 0, end: 2, value: 'pi', into: 'key' },
    { start: 3, end: 4, value: '=', into: 'eq' },
    { start: 5, end: 9, value: '3.14', into: 'val' },
    { start: 10, end: 13, value: 'rad', into: 'unit' },
  ];

  const tokens: string[] = [];
  for (const s of steps) {
    tokens.push(s.value);
    frames.push({
      pos: s.end,
      highlight: [s.start, s.end],
      tokens: [...tokens],
      code: 1,
      note: `iss >> ${s.into}: skip leading whitespace, read "${s.value}", then advance the get pointer past it.`,
    });
  }

  frames.push({
    pos: SOURCE.length,
    highlight: null,
    tokens: [...tokens],
    code: 2,
    note: 'The next extraction hits end-of-stream, so iss converts to false — the canonical way to stop a `while (iss >> x)` loop.',
  });
  return frames;
}

const STR_CODE = [
  'std::string s = "rad/s";',
  'auto slash = s.find(\'/\');   // index 3',
  'std::string unit = s.substr(0, slash);',
  's.append(" SI");             // mutate buffer',
];

function buildString(): StringFrame[] {
  const frames: StringFrame[] = [];
  frames.push({
    buffer: 'rad/s',
    highlight: null,
    code: 0,
    vars: [{ name: 's', value: '"rad/s"' }],
    note: 'A std::string owns a contiguous, resizable character buffer. Short strings often live inline (SSO) with no heap allocation.',
  });
  frames.push({
    buffer: 'rad/s',
    highlight: [3, 4],
    code: 1,
    vars: [
      { name: 's', value: '"rad/s"' },
      { name: 'slash', value: '3' },
    ],
    note: "find('/') scans left to right and returns the index of the first match (3). On no match it returns std::string::npos.",
  });
  frames.push({
    buffer: 'rad/s',
    highlight: [0, 3],
    code: 2,
    vars: [
      { name: 's', value: '"rad/s"' },
      { name: 'slash', value: '3' },
      { name: 'unit', value: '"rad"' },
    ],
    note: 'substr(0, slash) copies the half-open range [0, 3) into a new string "rad". substr returns a copy; it does not modify s.',
  });
  frames.push({
    buffer: 'rad/s SI',
    highlight: [5, 8],
    code: 3,
    vars: [
      { name: 's', value: '"rad/s SI"' },
      { name: 'slash', value: '3' },
      { name: 'unit', value: '"rad"' },
    ],
    note: 'append(" SI") grows s in place. If the new length exceeds the current capacity, the buffer reallocates to a larger block.',
  });
  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const AMBER = '#fbbf24';
const EMERALD = '#10b981';
const SKY = '#38bdf8';

function CharRow({
  text,
  highlight,
  consumedUpTo,
}: {
  text: string;
  highlight: [number, number] | null;
  consumedUpTo?: number;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {text.split('').map((ch, i) => {
        const inHi = highlight ? i >= highlight[0] && i < highlight[1] : false;
        const consumed = consumedUpTo !== undefined && i < consumedUpTo && !inHi;
        const isSpace = ch === ' ';
        return (
          <div key={i} className="flex flex-col items-center">
            <div
              className="flex h-9 w-7 items-center justify-center rounded border font-mono text-sm"
              style={{
                borderColor: inHi ? AMBER : 'var(--edge)',
                color: inHi ? AMBER : consumed ? 'var(--muted)' : 'var(--fg)',
                background: inHi ? 'color-mix(in srgb, #fbbf24 12%, transparent)' : 'transparent',
                opacity: consumed ? 0.45 : 1,
              }}
            >
              {isSpace ? '·' : ch}
            </div>
            <span className="mt-0.5 font-mono text-[9px] text-muted">{i}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function CppStreamTokenizer() {
  const [mode, setMode] = useState<Mode>('extract');
  const extractFrames = useMemo(() => buildExtract(), []);
  const stringFrames = useMemo(() => buildString(), []);
  const count = mode === 'extract' ? extractFrames.length : stringFrames.length;
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(count, 2);

  const ef = extractFrames[Math.min(index, extractFrames.length - 1)];
  const sf = stringFrames[Math.min(index, stringFrames.length - 1)];
  const code = mode === 'extract' ? ['std::istringstream iss(s);', 'iss >> key >> eq >> val >> unit;', 'while (iss >> token) { ... }'] : STR_CODE;
  const activeCode = mode === 'extract' ? ef.code : sf.code;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {(['extract', 'string'] as Mode[]).map((m) => (
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
            {m === 'extract' ? 'Stream extraction (>>)' : 'String operations'}
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

      {mode === 'extract' ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-edge bg-bg/40 p-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold text-fg">Stream buffer</span>
              <span className="font-mono text-muted">get pointer @ {ef.pos}</span>
            </div>
            <CharRow text={SOURCE} highlight={ef.highlight} consumedUpTo={ef.pos} />
            <div className="mt-2 font-mono text-[10px] text-muted">
              <span style={{ color: AMBER }}>amber</span> = token read this step; dimmed = already
              consumed; {'·'} = whitespace (skipped).
            </div>
          </div>
          <div className="rounded-lg border border-edge bg-bg/40 p-3">
            <div className="mb-2 text-xs font-semibold text-fg">Extracted tokens</div>
            <div className="flex min-h-9 flex-wrap gap-2">
              {ef.tokens.length === 0 && <span className="text-xs text-muted/60">(none yet)</span>}
              {ef.tokens.map((t, i) => (
                <span
                  key={i}
                  className="rounded border px-2 py-1 font-mono text-xs"
                  style={{ borderColor: EMERALD, color: EMERALD }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-edge bg-bg/40 p-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold text-fg">std::string buffer</span>
              <span className="font-mono text-muted">size {sf.buffer.length}</span>
            </div>
            <CharRow text={sf.buffer} highlight={sf.highlight} />
          </div>
          <div className="rounded-lg border border-edge bg-bg/40 p-3">
            <div className="mb-2 text-xs font-semibold text-fg">Variables</div>
            <div className="flex flex-wrap gap-2">
              {sf.vars.map((v) => (
                <span
                  key={v.name}
                  className="rounded border px-2 py-1 font-mono text-xs"
                  style={{ borderColor: SKY, color: SKY }}
                >
                  {v.name} = {v.value}
                </span>
              ))}
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
        {mode === 'extract' ? ef.note : sf.note}
      </div>
    </div>
  );
}
