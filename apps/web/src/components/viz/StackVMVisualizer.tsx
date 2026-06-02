import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// ---- AST (same shape the parser produces) ----
type Num = { kind: 'num'; value: number };
type Bin = { kind: 'bin'; op: string; left: Node; right: Node };
type Node = Num | Bin;

type Instr = { op: 'PUSH' | 'ADD' | 'SUB' | 'MUL' | 'DIV'; arg?: number };

// Post-order walk → stack-machine bytecode. Children before parent so operands
// are already on the stack when the operator instruction runs.
function compile(node: Node): Instr[] {
  if (node.kind === 'num') return [{ op: 'PUSH', arg: node.value }];
  const code = [...compile(node.left), ...compile(node.right)];
  const map: Record<string, Instr['op']> = { '+': 'ADD', '-': 'SUB', '*': 'MUL', '/': 'DIV' };
  code.push({ op: map[node.op] });
  return code;
}

type Frame = {
  pc: number; // instruction about to run (or code.length when finished)
  stack: number[];
  note: string;
};

// Execute the bytecode one instruction at a time, snapshotting the stack.
function run(code: Instr[]): Frame[] {
  const frames: Frame[] = [];
  const stack: number[] = [];
  frames.push({ pc: 0, stack: [], note: 'Stack starts empty. Execute top to bottom.' });

  for (let pc = 0; pc < code.length; pc++) {
    const ins = code[pc];
    if (ins.op === 'PUSH') {
      stack.push(ins.arg!);
      frames.push({ pc: pc + 1, stack: [...stack], note: `PUSH ${ins.arg} → put operand on the stack.` });
    } else {
      const b = stack.pop()!;
      const a = stack.pop()!;
      let r = 0;
      if (ins.op === 'ADD') r = a + b;
      else if (ins.op === 'SUB') r = a - b;
      else if (ins.op === 'MUL') r = a * b;
      else r = Math.trunc(a / b);
      stack.push(r);
      const sym = ins.op === 'ADD' ? '+' : ins.op === 'SUB' ? '-' : ins.op === 'MUL' ? '*' : '/';
      frames.push({ pc: pc + 1, stack: [...stack], note: `${ins.op}: pop ${a} and ${b}, push ${a} ${sym} ${b} = ${r}.` });
    }
  }
  frames[frames.length - 1] = { ...frames[frames.length - 1], note: `Done. Result = ${stack[0]} (the lone value left on the stack).` };
  return frames;
}

// Build the AST for a couple of fixed expressions (precedence baked in).
const PRESETS: Record<string, { label: string; ast: Node }> = {
  a: {
    label: '2 + 3 * 4',
    ast: { kind: 'bin', op: '+', left: { kind: 'num', value: 2 }, right: { kind: 'bin', op: '*', left: { kind: 'num', value: 3 }, right: { kind: 'num', value: 4 } } },
  },
  b: {
    label: '(2 + 3) * 4',
    ast: { kind: 'bin', op: '*', left: { kind: 'bin', op: '+', left: { kind: 'num', value: 2 }, right: { kind: 'num', value: 3 } }, right: { kind: 'num', value: 4 } },
  },
  c: {
    label: '20 - 6 / 2',
    ast: { kind: 'bin', op: '-', left: { kind: 'num', value: 20 }, right: { kind: 'bin', op: '/', left: { kind: 'num', value: 6 }, right: { kind: 'num', value: 2 } } },
  },
};

const fmt = (ins: Instr) => (ins.arg !== undefined ? `${ins.op} ${ins.arg}` : ins.op);

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function StackVMVisualizer() {
  const [key, setKey] = useState('a');
  const code = useMemo(() => compile(PRESETS[key].ast), [key]);
  const frames = useMemo(() => run(code), [code]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset } = useStepper(frames.length, 3);
  const frame = frames[Math.min(index, frames.length - 1)];

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
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Bytecode listing */}
        <div className="rounded-lg border border-edge bg-bg p-3">
          <div className="mb-2 text-xs uppercase tracking-wide text-muted">Bytecode</div>
          <div className="flex flex-col gap-1 font-mono text-sm">
            {code.map((ins, i) => {
              const isCurrent = i === frame.pc;
              const done = i < frame.pc;
              return (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded px-2 py-0.5 transition ${
                    isCurrent ? 'bg-accent text-accent-fg' : done ? 'text-muted' : 'text-fg'
                  }`}
                >
                  <span className="w-6 text-right opacity-60">{i}</span>
                  <span>{fmt(ins)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Operand stack — grows upward */}
        <div className="rounded-lg border border-edge bg-bg p-3">
          <div className="mb-2 text-xs uppercase tracking-wide text-muted">Operand stack</div>
          <div className="flex min-h-[8rem] flex-col-reverse items-center justify-start gap-1">
            {frame.stack.length === 0 && <span className="self-center font-mono text-sm text-muted/60">empty</span>}
            {frame.stack.map((v, i) => (
              <div
                key={i}
                className={`w-20 rounded border text-center font-mono text-sm ${
                  i === frame.stack.length - 1 ? 'border-accent bg-accent/15 text-fg' : 'border-edge bg-surface text-fg'
                } py-1`}
              >
                {v}
              </div>
            ))}
          </div>
          <div className="mt-2 text-center text-[10px] text-muted">top ↑</div>
        </div>
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
          <input type="range" min={1} max={12} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>
    </div>
  );
}
