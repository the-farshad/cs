import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

// A Turing machine that increments a binary number by 1.
// The number is written most-significant-bit first. The machine first walks
// to the rightmost bit, then adds 1 with carry walking left.
//
// Blank symbol is '_'.  States: seek (go to right end), add (ripple carry), done.
type Dir = 'L' | 'R' | 'S';
type TMState = 'seek' | 'add' | 'done';

// transition: (state, symbol) -> [write, move, nextState, description]
function delta(state: TMState, sym: string): [string, Dir, TMState, string] {
  if (state === 'seek') {
    if (sym === '_') return ['_', 'L', 'add', 'hit blank past the last bit — move left to start adding'];
    return [sym, 'R', 'seek', `scan right over '${sym}' to find the right end`];
  }
  // state === 'add' : ripple the carry leftward
  if (sym === '0') return ['1', 'S', 'done', "0 + carry = 1, no further carry — halt"];
  if (sym === '1') return ['0', 'L', 'add', '1 + carry = 0, carry continues left'];
  // sym === '_' : carried off the front, write a leading 1
  return ['1', 'S', 'done', 'carry past the front — write a new leading 1, halt'];
}

type Frame = {
  tape: string[];
  head: number;
  state: TMState;
  note: string;
  fired: { write: string; move: Dir } | null;
};

function run(initial: string): Frame[] {
  // pad with blanks on both ends so the head can wander.
  const tape = ['_', '_', ...initial.split(''), '_', '_'];
  let head = 2; // first real bit
  let state: TMState = 'seek';
  const frames: Frame[] = [
    { tape: [...tape], head, state, note: 'start in "seek": walk to the right end of the number', fired: null },
  ];
  let guard = 0;
  while (state !== 'done' && guard++ < 100) {
    const sym = tape[head] ?? '_';
    const [write, move, nextState, note] = delta(state, sym);
    tape[head] = write;
    const newHead = move === 'L' ? head - 1 : move === 'R' ? head + 1 : head;
    state = nextState;
    head = Math.max(0, Math.min(tape.length - 1, newHead));
    frames.push({ tape: [...tape], head, state, note, fired: { write, move } });
  }
  return frames;
}

export default function TuringMachineVisualizer() {
  const [input, setInput] = useState('1011');

  const clean = useMemo(() => {
    const c = input.replace(/[^01]/g, '').slice(0, 8);
    return c.length ? c : '0';
  }, [input]);
  const frames = useMemo(() => run(clean), [clean]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 3);
  const frame = frames[Math.min(index, frames.length - 1)] ?? frames[0];

  const valueIn = useMemo(() => parseInt(clean, 2), [clean]);

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3 text-sm text-muted">
        A Turing machine that <span className="text-fg">increments a binary number</span>. It seeks the right end, then
        ripples a carry leftward. Enter a binary number.
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          Binary
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            className="w-36 rounded border border-edge bg-bg px-2 py-1 font-mono text-fg"
            aria-label="binary input"
          />
        </label>
        <span className="font-mono text-xs text-muted">= {valueIn} in decimal, so the result should be {valueIn + 1}</span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {['1011', '111', '0', '10011'].map((ex) => (
            <button key={ex} type="button" className={btn} onClick={() => setInput(ex)}>
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Tape */}
      <div className="overflow-x-auto pb-2">
        <div className="relative inline-flex flex-col items-start">
          {/* Head pointer */}
          <div className="mb-1 flex">
            {frame.tape.map((_, i) => (
              <div key={i} className="flex w-11 justify-center">
                {i === frame.head && <Icon name="arrow-down" size={18} className="text-accent" />}
              </div>
            ))}
          </div>
          <div className="flex">
            {frame.tape.map((cell, i) => {
              const isHead = i === frame.head;
              return (
                <div
                  key={i}
                  className={`flex h-11 w-11 items-center justify-center border font-mono text-base ${
                    isHead ? 'border-accent text-accent' : 'border-edge text-fg'
                  } ${i === 0 ? 'rounded-l' : ''} ${i === frame.tape.length - 1 ? 'rounded-r' : ''}`}
                  style={{
                    marginLeft: i === 0 ? 0 : -1,
                    background: isHead ? 'color-mix(in oklab, var(--accent) 16%, var(--surface))' : 'var(--bg)',
                  }}
                >
                  {cell === '_' ? <span className="text-muted">␣</span> : cell}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* State chips */}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">state:</span>
        {(['seek', 'add', 'done'] as TMState[]).map((st) => {
          const on = frame.state === st;
          return (
            <span
              key={st}
              className={`rounded border px-2 py-0.5 font-mono ${
                on ? 'border-accent bg-accent text-accent-fg' : 'border-edge text-muted'
              }`}
            >
              {st}
            </span>
          );
        })}
        {frame.fired && (
          <span className="ml-2 font-mono text-xs text-muted">
            wrote '{frame.fired.write === '_' ? '␣' : frame.fired.write}', move {frame.fired.move}
          </span>
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
          <input type="range" min={1} max={12} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
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

      <div className="mt-4 flex items-center gap-3 border-t border-edge pt-4 font-mono text-xs">
        <span className="text-muted">{frame.note}</span>
        {frame.state === 'done' && (
          <span className="ml-auto rounded border px-2 py-0.5 font-medium" style={{ color: '#10b981', borderColor: '#10b981' }}>
            HALT — result {frame.tape.join('').replace(/_/g, '') || '0'}
          </span>
        )}
      </div>
    </div>
  );
}
