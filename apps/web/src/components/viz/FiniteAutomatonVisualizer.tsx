import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

// A DFA over the alphabet {0,1} that accepts binary strings with an EVEN
// number of 1s. q0 = even (start + accepting), q1 = odd.
type State = { id: string; x: number; y: number; accept: boolean };
const STATES: State[] = [
  { id: 'q0', x: 130, y: 130, accept: true },
  { id: 'q1', x: 340, y: 130, accept: false },
];
const START = 'q0';

// delta[state][symbol] = nextState
const DELTA: Record<string, Record<string, string>> = {
  q0: { '0': 'q0', '1': 'q1' },
  q1: { '0': 'q1', '1': 'q0' },
};

type Frame = {
  pos: number; // index of the symbol just read (-1 = before start)
  state: string; // current state AFTER reading symbol at pos
  edge: [string, string, string] | null; // [from, via, to] transition that just fired
  done: boolean;
  accepted: boolean;
  note: string;
};

function run(input: string): Frame[] {
  const frames: Frame[] = [];
  let state = START;
  frames.push({
    pos: -1,
    state,
    edge: null,
    done: false,
    accepted: false,
    note: `start in ${START}; read input left to right`,
  });
  for (let i = 0; i < input.length; i++) {
    const sym = input[i];
    const next = DELTA[state]?.[sym];
    if (next === undefined) {
      frames.push({ pos: i, state, edge: null, done: true, accepted: false, note: `no transition on '${sym}' — reject` });
      return frames;
    }
    frames.push({
      pos: i,
      state: next,
      edge: [state, sym, next],
      done: false,
      accepted: false,
      note: `read '${sym}': ${state} → ${next}`,
    });
    state = next;
  }
  const accepted = STATES.find((s) => s.id === state)?.accept ?? false;
  frames.push({
    pos: input.length - 1,
    state,
    edge: null,
    done: true,
    accepted,
    note: accepted
      ? `input consumed; ${state} is accepting — ACCEPT`
      : `input consumed; ${state} is not accepting — REJECT`,
  });
  return frames;
}

const W = 470;
const H = 230;

export default function FiniteAutomatonVisualizer() {
  const [input, setInput] = useState('1011');

  const clean = useMemo(() => input.replace(/[^01]/g, '').slice(0, 12), [input]);
  const frames = useMemo(() => run(clean), [clean]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 3);
  const frame = frames[Math.min(index, frames.length - 1)] ?? frames[0];

  const byId = (id: string) => STATES.find((s) => s.id === id)!;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3 text-sm text-muted">
        A DFA that accepts binary strings with an <span className="text-fg">even number of 1s</span>. Type a string of
        0s and 1s, then step through it.
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          Input
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            className="w-40 rounded border border-edge bg-bg px-2 py-1 font-mono text-fg"
            aria-label="DFA input string"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {['1011', '110', '', '101010'].map((ex) => (
            <button key={ex || 'eps'} type="button" className={btn} onClick={() => setInput(ex)}>
              {ex === '' ? 'ε' : ex}
            </button>
          ))}
        </div>
      </div>

      {/* Input tape */}
      <div className="mb-4 flex flex-wrap gap-1">
        {clean.length === 0 ? (
          <div className="flex h-9 items-center px-2 font-mono text-sm text-muted">ε (empty string)</div>
        ) : (
          clean.split('').map((ch, i) => {
            const read = i < frame.pos || (frame.done && i <= frame.pos);
            const here = i === frame.pos && !frame.done;
            return (
              <div
                key={i}
                className={`flex h-9 w-9 items-center justify-center rounded border font-mono text-sm ${
                  here ? 'border-accent text-accent' : read ? 'border-edge text-muted' : 'border-edge text-fg'
                }`}
                style={here ? { background: 'color-mix(in oklab, var(--accent) 18%, var(--bg))' } : undefined}
              >
                {ch}
              </div>
            );
          })
        )}
      </div>

      {/* State diagram */}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="max-w-full" role="img" aria-label="DFA state diagram">
        <defs>
          <marker id="fa-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6 Z" fill="var(--muted)" />
          </marker>
          <marker id="fa-arrow-hot" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6 Z" fill="#10b981" />
          </marker>
        </defs>

        {/* Start arrow into q0 */}
        <line
          x1={byId(START).x - 70}
          y1={byId(START).y}
          x2={byId(START).x - 28}
          y2={byId(START).y}
          stroke="var(--muted)"
          strokeWidth={2}
          markerEnd="url(#fa-arrow)"
        />
        <text x={byId(START).x - 70} y={byId(START).y - 8} fill="var(--muted)" fontSize={12} textAnchor="start">
          start
        </text>

        {/* q0 -> q1 on '1' (top arc) */}
        {edge('q0', '1', 'q1', frame, byId, -1)}
        {/* q1 -> q0 on '1' (bottom arc) */}
        {edge('q1', '1', 'q0', frame, byId, 1)}
        {/* self loops on '0' */}
        {selfLoop('q0', '0', frame, byId)}
        {selfLoop('q1', '0', frame, byId)}

        {/* States */}
        {STATES.map((s) => {
          const active = s.id === frame.state;
          const stroke = active ? 'var(--accent)' : 'var(--muted)';
          return (
            <g key={s.id}>
              <circle
                cx={s.x}
                cy={s.y}
                r={26}
                fill={active ? 'color-mix(in oklab, var(--accent) 16%, var(--surface))' : 'var(--surface)'}
                stroke={stroke}
                strokeWidth={active ? 3 : 2}
              />
              {s.accept && <circle cx={s.x} cy={s.y} r={21} fill="none" stroke={stroke} strokeWidth={active ? 3 : 2} />}
              <text x={s.x} y={s.y + 5} fill="var(--fg)" fontSize={15} textAnchor="middle" fontFamily="monospace">
                {s.id}
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
        <span className="text-muted">{frame.note}</span>
        {frame.done && (
          <span
            className="ml-auto rounded px-2 py-0.5 font-medium"
            style={{
              color: frame.accepted ? '#10b981' : '#f43f5e',
              border: `1px solid ${frame.accepted ? '#10b981' : '#f43f5e'}`,
            }}
          >
            {frame.accepted ? 'ACCEPT' : 'REJECT'}
          </span>
        )}
      </div>
    </div>
  );
}

// A curved transition between two distinct states; `dir` curves it up (-1) or down (+1).
function edge(
  from: string,
  via: string,
  to: string,
  frame: Frame,
  byId: (id: string) => State,
  dir: number,
) {
  const a = byId(from);
  const b = byId(to);
  const hot = !!frame.edge && frame.edge[0] === from && frame.edge[1] === via && frame.edge[2] === to;
  const r = 26;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const sx = a.x + ux * r;
  const sy = a.y + uy * r;
  const ex = b.x - ux * r;
  const ey = b.y - uy * r;
  const mx = (sx + ex) / 2 + uy * 46 * dir;
  const my = (sy + ey) / 2 - ux * 46 * dir;
  const color = hot ? '#10b981' : 'var(--muted)';
  return (
    <g>
      <path
        d={`M${sx},${sy} Q${mx},${my} ${ex},${ey}`}
        fill="none"
        stroke={color}
        strokeWidth={hot ? 3 : 2}
        markerEnd={hot ? 'url(#fa-arrow-hot)' : 'url(#fa-arrow)'}
      />
      <text x={mx} y={my + (dir < 0 ? -4 : 12)} fill={color} fontSize={13} textAnchor="middle" fontFamily="monospace">
        {via}
      </text>
    </g>
  );
}

function selfLoop(id: string, via: string, frame: Frame, byId: (id: string) => State) {
  const s = byId(id);
  const hot = !!frame.edge && frame.edge[0] === id && frame.edge[1] === via && frame.edge[2] === id;
  const color = hot ? '#10b981' : 'var(--muted)';
  const cx = s.x;
  const cy = s.y - 26;
  return (
    <g>
      <path
        d={`M${cx - 12},${cy} C${cx - 26},${cy - 38} ${cx + 26},${cy - 38} ${cx + 12},${cy}`}
        fill="none"
        stroke={color}
        strokeWidth={hot ? 3 : 2}
        markerEnd={hot ? 'url(#fa-arrow-hot)' : 'url(#fa-arrow)'}
      />
      <text x={cx} y={cy - 34} fill={color} fontSize={13} textAnchor="middle" fontFamily="monospace">
        {via}
      </text>
    </g>
  );
}
