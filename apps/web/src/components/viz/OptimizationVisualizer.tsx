import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// A line of three-address-code IR:  dst = a op b   (op '' means a copy/const)
type IRLine = { dst: string; a: string; op: '' | '+' | '-' | '*' | '/'; b: string };

type Mark = 'none' | 'folded' | 'dead';
type Row = { line: IRLine; mark: Mark };
type Frame = { rows: Row[]; note: string };

const isNum = (s: string) => /^-?\d+$/.test(s);
const apply = (a: number, op: string, b: number) => (op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : Math.trunc(a / b));

function render(line: IRLine): string {
  if (line.op === '') return `${line.dst} = ${line.a}`;
  return `${line.dst} = ${line.a} ${line.op} ${line.b}`;
}

// Run two passes over the IR, recording a frame after each transformation so the
// "before" and "after" can be scrubbed.
function optimize(program: IRLine[], used: Set<string>): Frame[] {
  const frames: Frame[] = [];
  // Work on a mutable copy; track which lines are alive.
  let lines = program.map((l) => ({ ...l }));
  const consts: Record<string, number> = {};

  // Clone each line so frames are immutable snapshots — later in-place edits
  // (constant propagation) must not retroactively alter earlier frames.
  const snapshot = (note: string, marks: Record<number, Mark> = {}) => {
    frames.push({ rows: lines.map((line, i) => ({ line: { ...line }, mark: marks[i] ?? 'none' })), note });
  };

  snapshot('Original IR — three-address code, one operation per line.');

  // --- Pass 1: constant folding & propagation ---
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    // Propagate known constants into operands.
    if (consts[l.a] !== undefined) l.a = String(consts[l.a]);
    if (l.op !== '' && consts[l.b] !== undefined) l.b = String(consts[l.b]);

    if (l.op === '' && isNum(l.a)) {
      consts[l.dst] = Number(l.a);
    } else if (l.op !== '' && isNum(l.a) && isNum(l.b)) {
      const v = apply(Number(l.a), l.op, Number(l.b));
      lines[i] = { dst: l.dst, a: String(v), op: '', b: '' };
      consts[l.dst] = v;
      snapshot(`Constant folding: ${render(l)} is fully known → ${render(lines[i])}.`, { [i]: 'folded' });
    }
  }
  snapshot('After constant folding: every all-constant expression is precomputed.');

  // --- Pass 2: dead-code elimination ---
  // A line is live if its result is used by an output or by a live line.
  const live = new Set<string>(used);
  const keep = new Array(lines.length).fill(true);
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    if (!live.has(l.dst)) {
      keep[i] = false;
      continue;
    }
    if (!isNum(l.a)) live.add(l.a);
    if (l.op !== '' && !isNum(l.b)) live.add(l.b);
  }
  const deadIdx = keep.map((k, i) => (k ? -1 : i)).filter((i) => i >= 0);
  if (deadIdx.length) {
    const marks: Record<number, Mark> = {};
    deadIdx.forEach((i) => (marks[i] = 'dead'));
    snapshot(`Dead-code elimination: results never used by ${[...used].join(', ')} are marked dead.`, marks);
    lines = lines.filter((_, i) => keep[i]);
    snapshot('After DCE: dead lines removed. Fewer instructions, same result.');
  } else {
    snapshot('Dead-code elimination: every result is used — nothing to remove.');
  }

  return frames;
}

type Preset = { label: string; program: IRLine[]; used: string[] };

const PRESETS: Record<string, Preset> = {
  a: {
    label: 'fold + DCE',
    used: ['out'],
    program: [
      { dst: 't1', a: '3', op: '+', b: '4' },
      { dst: 't2', a: 't1', op: '*', b: '2' },
      { dst: 'dead', a: '9', op: '-', b: '1' }, // never used
      { dst: 'out', a: 't2', op: '', b: '' },
    ],
  },
  b: {
    label: 'propagation',
    used: ['out'],
    program: [
      { dst: 'a', a: '10', op: '', b: '' },
      { dst: 'b', a: 'a', op: '*', b: '5' },
      { dst: 'c', a: 'b', op: '+', b: 'x' }, // x is unknown → stays
      { dst: 'out', a: 'c', op: '', b: '' },
    ],
  },
  c: {
    label: 'all dead but one',
    used: ['out'],
    program: [
      { dst: 'p', a: '2', op: '*', b: '8' },
      { dst: 'q', a: '100', op: '/', b: '4' }, // unused
      { dst: 'r', a: 'p', op: '-', b: '6' }, // unused
      { dst: 'out', a: 'p', op: '', b: '' },
    ],
  },
};

const markCls: Record<Mark, string> = {
  none: 'border-edge text-fg',
  folded: 'border-emerald-400 bg-emerald-400/15 text-emerald-200',
  dead: 'border-rose-400 bg-rose-400/10 text-rose-300 line-through opacity-70',
};

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function OptimizationVisualizer() {
  const [key, setKey] = useState('a');
  const preset = PRESETS[key];
  const frames = useMemo(() => optimize(preset.program, new Set(preset.used)), [preset]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 2);
  const frame = frames[Math.min(index, frames.length - 1)];

  const original = frames[0];

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {Object.entries(PRESETS).map(([k, p]) => (
          <button
            key={k}
            type="button"
            onClick={() => setKey(k)}
            className={`rounded border px-2 py-0.5 font-mono text-xs transition ${
              k === key ? 'border-accent text-accent' : 'border-edge text-muted hover:border-accent hover:text-accent'
            }`}
          >
            {p.label}
          </button>
        ))}
        <span className="ml-auto font-mono text-xs text-muted">output: {preset.used.join(', ')}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Before (frozen original) */}
        <div className="rounded-lg border border-edge bg-bg p-3">
          <div className="mb-2 text-xs uppercase tracking-wide text-muted">Before</div>
          <div className="flex flex-col gap-1 font-mono text-sm">
            {original.rows.map((r, i) => (
              <div key={i} className="rounded border border-edge px-2 py-0.5 text-muted">
                {render(r.line)}
              </div>
            ))}
          </div>
        </div>

        {/* Current pass state */}
        <div className="rounded-lg border border-edge bg-bg p-3">
          <div className="mb-2 text-xs uppercase tracking-wide text-muted">After (step {index})</div>
          <div className="flex flex-col gap-1 font-mono text-sm">
            {frame.rows.map((r, i) => (
              <div key={i} className={`rounded border px-2 py-0.5 transition ${markCls[r.mark]}`}>
                {render(r.line)}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border border-emerald-400 bg-emerald-400/15" /> folded constant
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border border-rose-400 bg-rose-400/10" /> dead code
        </span>
      </div>

      <div className="mt-3 min-h-[1.5rem] font-mono text-sm text-muted">{frame.note}</div>

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
          <input type="range" min={1} max={8} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>
    </div>
  );
}
