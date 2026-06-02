import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

// We simulate the regex a(b|c)*d as an explicit NFA and run all live states
// in parallel (subset construction on the fly), which is exactly how a regex
// engine decides membership without backtracking.
//
// States:  S0 --a--> S1 ; S1 --b/c--> S1 (the (b|c)* loop) ; S1 --d--> S2 (accept)
// We model the (b|c)* as a self-loop on S1, and allow d at any point from S1.
const ACCEPT = 'S2';

// transition: returns the set of next states from one state on a symbol.
function step(state: string, sym: string): string[] {
  switch (state) {
    case 'S0':
      return sym === 'a' ? ['S1'] : [];
    case 'S1':
      if (sym === 'b' || sym === 'c') return ['S1'];
      if (sym === 'd') return ['S2'];
      return [];
    default:
      return [];
  }
}

type Frame = {
  pos: number; // symbol index just consumed (-1 before start)
  active: string[]; // set of live NFA states
  ok: boolean; // was the just-read symbol consumable by some state?
  done: boolean;
  accepted: boolean;
  note: string;
};

function simulate(input: string): Frame[] {
  const frames: Frame[] = [];
  let active = ['S0'];
  frames.push({ pos: -1, active: [...active], ok: true, done: false, accepted: false, note: 'start: only S0 is live' });
  for (let i = 0; i < input.length; i++) {
    const sym = input[i];
    const nextSet = new Set<string>();
    for (const s of active) for (const t of step(s, sym)) nextSet.add(t);
    const nextActive = [...nextSet];
    const ok = nextActive.length > 0;
    frames.push({
      pos: i,
      active: nextActive,
      ok,
      done: !ok,
      accepted: false,
      note: ok
        ? `read '${sym}' → live states {${nextActive.join(', ')}}`
        : `read '${sym}': no transition — the match dies here`,
    });
    active = nextActive;
    if (!ok) return frames;
  }
  const accepted = active.includes(ACCEPT);
  frames.push({
    pos: input.length - 1,
    active: [...active],
    ok: true,
    done: true,
    accepted,
    note: accepted
      ? `end of input; accepting state ${ACCEPT} is live — MATCH`
      : `end of input; no accepting state live — NO MATCH`,
  });
  return frames;
}

export default function RegexMatchVisualizer() {
  const [input, setInput] = useState('abbcd');

  const clean = useMemo(() => input.replace(/[^abcd]/g, '').slice(0, 14), [input]);
  const frames = useMemo(() => simulate(clean), [clean]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 3);
  const frame = frames[Math.min(index, frames.length - 1)] ?? frames[0];

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3 text-sm text-muted">
        Regex <code className="rounded bg-bg px-1 font-mono text-fg">a(b|c)*d</code> as an NFA. Each symbol advances{' '}
        <span className="text-fg">every live state at once</span> — no backtracking. Type a string over{' '}
        <code className="rounded bg-bg px-1 font-mono text-fg">{'{a,b,c,d}'}</code>.
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          Input
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            className="w-40 rounded border border-edge bg-bg px-2 py-1 font-mono text-fg"
            aria-label="regex test string"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {['abbcd', 'ad', 'abca', 'accccd'].map((ex) => (
            <button key={ex} type="button" className={btn} onClick={() => setInput(ex)}>
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Input characters with match coloring */}
      <div className="mb-5 flex flex-wrap gap-1">
        {clean.length === 0 ? (
          <div className="flex h-10 items-center px-2 font-mono text-sm text-muted">ε</div>
        ) : (
          clean.split('').map((ch, i) => {
            const consumed = i < frame.pos || (frame.done && frame.accepted && i <= frame.pos);
            const here = i === frame.pos;
            const failed = here && frame.done && !frame.accepted && !frame.ok;
            let cls = 'border-edge text-fg';
            let bg: string | undefined;
            if (failed) {
              cls = 'border-[#f43f5e] text-fg';
              bg = 'color-mix(in oklab, #f43f5e 22%, var(--bg))';
            } else if (here) {
              cls = 'border-accent text-accent';
              bg = 'color-mix(in oklab, var(--accent) 18%, var(--bg))';
            } else if (consumed) {
              cls = 'border-[#10b981] text-fg';
              bg = 'color-mix(in oklab, #10b981 16%, var(--bg))';
            }
            return (
              <div
                key={i}
                className={`flex h-10 w-9 items-center justify-center rounded border font-mono text-base ${cls}`}
                style={bg ? { background: bg } : undefined}
              >
                {ch}
              </div>
            );
          })
        )}
      </div>

      {/* NFA diagram */}
      <svg viewBox="0 0 460 150" width="100%" className="max-w-full" role="img" aria-label="NFA for a(b|c)*d">
        <defs>
          <marker id="rx-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6 Z" fill="var(--muted)" />
          </marker>
        </defs>

        {/* start arrow */}
        <line x1={20} y1={80} x2={54} y2={80} stroke="var(--muted)" strokeWidth={2} markerEnd="url(#rx-arrow)" />

        {/* S0 -> S1 on a */}
        <line x1={106} y1={80} x2={184} y2={80} stroke="var(--muted)" strokeWidth={2} markerEnd="url(#rx-arrow)" />
        <text x={145} y={70} fill="var(--muted)" fontSize={13} textAnchor="middle" fontFamily="monospace">
          a
        </text>

        {/* S1 self-loop b|c */}
        <path
          d="M198,56 C184,18 256,18 242,56"
          fill="none"
          stroke="var(--muted)"
          strokeWidth={2}
          markerEnd="url(#rx-arrow)"
        />
        <text x={220} y={20} fill="var(--muted)" fontSize={13} textAnchor="middle" fontFamily="monospace">
          b | c
        </text>

        {/* S1 -> S2 on d */}
        <line x1={246} y1={80} x2={324} y2={80} stroke="var(--muted)" strokeWidth={2} markerEnd="url(#rx-arrow)" />
        <text x={285} y={70} fill="var(--muted)" fontSize={13} textAnchor="middle" fontFamily="monospace">
          d
        </text>

        {[
          { id: 'S0', x: 80 },
          { id: 'S1', x: 220 },
          { id: 'S2', x: 350 },
        ].map(({ id, x }) => {
          const live = frame.active.includes(id);
          const stroke = live ? 'var(--accent)' : 'var(--muted)';
          return (
            <g key={id}>
              <circle
                cx={x}
                cy={80}
                r={26}
                fill={live ? 'color-mix(in oklab, var(--accent) 16%, var(--surface))' : 'var(--surface)'}
                stroke={stroke}
                strokeWidth={live ? 3 : 2}
              />
              {id === ACCEPT && <circle cx={x} cy={80} r={21} fill="none" stroke={stroke} strokeWidth={live ? 3 : 2} />}
              <text x={x} y={85} fill="var(--fg)" fontSize={14} textAnchor="middle" fontFamily="monospace">
                {id}
              </text>
            </g>
          );
        })}
      </svg>

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
        <span className="text-muted">live: {`{${frame.active.join(', ') || '∅'}}`}</span>
        <span className="text-muted">{frame.note}</span>
        {frame.done && (
          <span
            className="ml-auto rounded px-2 py-0.5 font-medium"
            style={{
              color: frame.accepted ? '#10b981' : '#f43f5e',
              border: `1px solid ${frame.accepted ? '#10b981' : '#f43f5e'}`,
            }}
          >
            {frame.accepted ? 'MATCH' : 'NO MATCH'}
          </span>
        )}
      </div>
    </div>
  );
}
