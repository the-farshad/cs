import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

type TokenType = 'ident' | 'number' | 'op' | 'punct' | 'keyword';
type Token = { type: TokenType; lexeme: string; start: number };

// Per-character snapshot of the scanner's progress.
type Frame = {
  pos: number; // index of the char being examined (or source.length at end)
  tokens: Token[]; // tokens emitted so far
  note: string; // human-readable description of the current action
  spanStart: number; // start of the lexeme currently being built (-1 if none)
};

const KEYWORDS = new Set(['let', 'if', 'else', 'return', 'while', 'fn']);

const isSpace = (c: string) => c === ' ' || c === '\t' || c === '\n';
const isDigit = (c: string) => c >= '0' && c <= '9';
const isAlpha = (c: string) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
const isAlnum = (c: string) => isAlpha(c) || isDigit(c);
const isOp = (c: string) => '+-*/<>=!'.includes(c);
const isPunct = (c: string) => '(){};,'.includes(c);

// A small hand-written scanner that yields a snapshot at every interesting step.
function* scan(src: string): Generator<Frame> {
  const tokens: Token[] = [];
  let i = 0;
  yield { pos: 0, tokens: [...tokens], note: 'Start at the first character.', spanStart: -1 };

  while (i < src.length) {
    const c = src[i];

    if (isSpace(c)) {
      yield { pos: i, tokens: [...tokens], note: `Whitespace '${c === '\n' ? '\\n' : c}' — skip it.`, spanStart: -1 };
      i++;
      continue;
    }

    const start = i;

    if (isDigit(c)) {
      while (i < src.length && isDigit(src[i])) i++;
      const lexeme = src.slice(start, i);
      tokens.push({ type: 'number', lexeme, start });
      yield { pos: i, tokens: [...tokens], note: `Digits run → NUMBER "${lexeme}".`, spanStart: -1 };
      continue;
    }

    if (isAlpha(c)) {
      while (i < src.length && isAlnum(src[i])) i++;
      const lexeme = src.slice(start, i);
      const kw = KEYWORDS.has(lexeme);
      tokens.push({ type: kw ? 'keyword' : 'ident', lexeme, start });
      yield {
        pos: i,
        tokens: [...tokens],
        note: kw ? `Reserved word → KEYWORD "${lexeme}".` : `Letters/digits run → IDENT "${lexeme}".`,
        spanStart: -1,
      };
      continue;
    }

    if (isOp(c)) {
      // Greedily take a two-char operator when it forms one (==, !=, <=, >=).
      const two = src.slice(i, i + 2);
      const take = ['==', '!=', '<=', '>='].includes(two) ? 2 : 1;
      i += take;
      const lexeme = src.slice(start, i);
      tokens.push({ type: 'op', lexeme, start });
      yield { pos: i, tokens: [...tokens], note: `Operator → OP "${lexeme}".`, spanStart: -1 };
      continue;
    }

    if (isPunct(c)) {
      i++;
      tokens.push({ type: 'punct', lexeme: c, start });
      yield { pos: i, tokens: [...tokens], note: `Punctuation → PUNCT "${c}".`, spanStart: -1 };
      continue;
    }

    // Unknown character — skip so the demo never stalls.
    i++;
    yield { pos: i, tokens: [...tokens], note: `Unexpected '${c}' — skipped.`, spanStart: -1 };
  }

  yield { pos: src.length, tokens: [...tokens], note: `End of input — ${tokens.length} tokens emitted.`, spanStart: -1 };
}

const SAMPLES = ['let x = 42 + y;', 'if (a >= 10) return a * 2;', 'fn add(p, q) { return p + q; }'];

const TYPE_STYLE: Record<TokenType, { label: string; cls: string }> = {
  keyword: { label: 'KEYWORD', cls: 'border-violet-400 text-violet-300' },
  ident: { label: 'IDENT', cls: 'border-sky-400 text-sky-300' },
  number: { label: 'NUMBER', cls: 'border-amber-400 text-amber-300' },
  op: { label: 'OP', cls: 'border-emerald-400 text-emerald-300' },
  punct: { label: 'PUNCT', cls: 'border-edge text-muted' },
};

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function LexerVisualizer() {
  const [src, setSrc] = useState(SAMPLES[0]);
  const frames = useMemo<Frame[]>(() => Array.from(scan(src)), [src]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 4);
  const frame = frames[Math.min(index, frames.length - 1)];

  const charClass = (i: number): string => {
    if (i === frame.pos) return 'bg-accent text-accent-fg';
    if (i < frame.pos) return 'text-muted';
    return 'text-fg';
  };

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {SAMPLES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSrc(s)}
            className={`rounded border px-2 py-0.5 font-mono text-xs transition ${
              s === src ? 'border-accent text-accent' : 'border-edge text-muted hover:border-accent hover:text-accent'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Source string with a moving read head */}
      <div className="rounded-lg border border-edge bg-bg p-3 font-mono text-base leading-relaxed">
        {src.split('').map((ch, i) => (
          <span key={i} className={`rounded px-[1px] transition ${charClass(i)}`}>
            {ch === ' ' ? ' ' : ch}
          </span>
        ))}
        <span className={`rounded px-[1px] ${frame.pos >= src.length ? 'bg-accent text-accent-fg' : 'text-muted'}`}>{'▕'}</span>
      </div>

      <div className="mt-3 min-h-[1.5rem] font-mono text-sm text-muted">{frame.note}</div>

      {/* Emitted tokens */}
      <div className="mt-3 flex min-h-[3rem] flex-wrap gap-2 rounded-lg border border-edge bg-bg p-3">
        {frame.tokens.length === 0 && <span className="font-mono text-sm text-muted/60">no tokens yet</span>}
        {frame.tokens.map((t, i) => {
          const s = TYPE_STYLE[t.type];
          return (
            <div key={i} className={`flex flex-col items-center rounded border px-2 py-1 ${s.cls}`}>
              <span className="font-mono text-sm text-fg">{t.lexeme}</span>
              <span className="text-[10px] tracking-wide">{s.label}</span>
            </div>
          );
        })}
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
          <input type="range" min={1} max={16} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <input
        type="range"
        min={0}
        max={frames.length - 1}
        value={index}
        onChange={(e) => seek(Number(e.target.value))}
        className="mt-3 w-full accent-[var(--accent)]"
        aria-label="scrub steps"
      />
    </div>
  );
}
