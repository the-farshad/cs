import { type ReactNode, useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// Two-qubit state vector ordered [|00⟩, |01⟩, |10⟩, |11⟩].
// Qubit 0 is the high bit (top wire / left digit), qubit 1 the low bit.
type Amps = [number, number, number, number];
const S = 1 / Math.SQRT2;
const LABELS = ['|00⟩', '|01⟩', '|10⟩', '|11⟩'];

type Gate =
  | { kind: 'X'; q: 0 | 1 }
  | { kind: 'H'; q: 0 | 1 }
  | { kind: 'Z'; q: 0 | 1 }
  | { kind: 'CNOT' }; // control q0, target q1

// Single-qubit gate application on the 4-vector.
// q0 pairs: |00⟩↔|10⟩ (0,2), |01⟩↔|11⟩ (1,3).
// q1 pairs: |00⟩↔|01⟩ (0,1), |10⟩↔|11⟩ (2,3).
const PAIRS: Record<0 | 1, [number, number][]> = {
  0: [
    [0, 2],
    [1, 3],
  ],
  1: [
    [0, 1],
    [2, 3],
  ],
};

function applyGate(a: Amps, g: Gate): Amps {
  const out = [...a] as Amps;
  if (g.kind === 'CNOT') {
    // when q0 = 1 (indices 2,3) flip q1: swap |10⟩↔|11⟩
    out[2] = a[3];
    out[3] = a[2];
    return out;
  }
  for (const [i, j] of PAIRS[g.q]) {
    if (g.kind === 'X') {
      out[i] = a[j];
      out[j] = a[i];
    } else if (g.kind === 'Z') {
      // Z flips the sign of the basis state where this qubit is 1.
      // For q0 the |1⟩ partner is index j; for q1 it is also j by construction.
      out[j] = -a[j];
    } else {
      // H
      out[i] = (a[i] + a[j]) * S;
      out[j] = (a[i] - a[j]) * S;
    }
  }
  return out;
}

const ZERO: Amps = [1, 0, 0, 0];

function buildFrames(gates: Gate[]): Amps[] {
  const frames: Amps[] = [ZERO];
  let cur: Amps = ZERO;
  for (const g of gates) {
    cur = applyGate(cur, g);
    frames.push(cur);
  }
  return frames;
}

function gateLabel(g: Gate): string {
  return g.kind === 'CNOT' ? 'CNOT' : `${g.kind}${g.q}`;
}

const fmt = (n: number) => (Math.abs(n) < 1e-9 ? '0' : n.toFixed(3));

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const palette: { g: Gate; label: string; title: string }[] = [
  { g: { kind: 'H', q: 0 }, label: 'H q0', title: 'Hadamard on qubit 0' },
  { g: { kind: 'X', q: 0 }, label: 'X q0', title: 'NOT on qubit 0' },
  { g: { kind: 'Z', q: 0 }, label: 'Z q0', title: 'phase flip on qubit 0' },
  { g: { kind: 'H', q: 1 }, label: 'H q1', title: 'Hadamard on qubit 1' },
  { g: { kind: 'X', q: 1 }, label: 'X q1', title: 'NOT on qubit 1' },
  { g: { kind: 'Z', q: 1 }, label: 'Z q1', title: 'phase flip on qubit 1' },
  { g: { kind: 'CNOT' }, label: 'CNOT', title: 'controlled-NOT: control q0, target q1' },
];

export default function CircuitBuilderVisualizer() {
  const [gates, setGates] = useState<Gate[]>([{ kind: 'H', q: 0 }, { kind: 'CNOT' }]);
  const frames = useMemo(() => buildFrames(gates), [gates]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 2);

  const i = Math.min(index, frames.length - 1);
  const amp = frames[i];
  const probs = amp.map((a) => a * a);
  // gatesApplied = number of gates whose effect is included in the current frame.
  const gatesApplied = i;

  const add = (g: Gate) => setGates((gs) => [...gs, g].slice(0, 8));
  const removeLast = () => setGates((gs) => gs.slice(0, -1));
  const clear = () => setGates([]);

  const stateStr = LABELS.map((lab, k) => ({ lab, a: amp[k] }))
    .filter((t) => Math.abs(t.a) > 1e-9)
    .map((t, idx) => `${idx > 0 ? (t.a >= 0 ? '+ ' : '− ') : t.a < 0 ? '−' : ''}${fmt(Math.abs(t.a))}${t.lab}`)
    .join(' ');

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">add gate:</span>
        {palette.map((p) => (
          <button key={p.label} type="button" className={btn} onClick={() => add(p.g)} disabled={gates.length >= 8} title={p.title}>
            {p.label}
          </button>
        ))}
        <button type="button" className={btn} onClick={removeLast} disabled={gates.length === 0}>
          undo
        </button>
        <button type="button" className={btn} onClick={clear} disabled={gates.length === 0}>
          <Icon name="rotate-ccw" size={15} /> clear
        </button>
      </div>

      {/* Circuit diagram: two wires, gates left to right. */}
      <div className="overflow-x-auto rounded-lg border border-edge bg-bg p-3">
        {([0, 1] as const).map((wire) => (
          <div key={wire} className="flex items-center gap-1">
            <span className="w-10 shrink-0 font-mono text-xs text-muted">q{wire}</span>
            <div className="relative flex flex-1 items-center">
              <div className="absolute left-0 right-0 top-1/2 h-px bg-edge" />
              {gates.map((g, gi) => {
                const active = gi < gatesApplied;
                const onWire =
                  g.kind === 'CNOT' ? true : g.q === wire;
                let cell: ReactNode = <span className="inline-block h-8 w-9" />;
                if (g.kind === 'CNOT') {
                  cell =
                    wire === 0 ? (
                      // control dot
                      <span className="z-10 inline-flex h-8 w-9 items-center justify-center">
                        <span className="h-3 w-3 rounded-full" style={{ background: active ? '#8b5cf6' : 'var(--muted)' }} />
                      </span>
                    ) : (
                      // target ⊕
                      <span
                        className="z-10 inline-flex h-8 w-9 items-center justify-center rounded-full border text-sm"
                        style={{ borderColor: active ? '#8b5cf6' : 'var(--edge)', color: active ? '#8b5cf6' : 'var(--muted)' }}
                      >
                        ⊕
                      </span>
                    );
                } else if (onWire) {
                  cell = (
                    <span
                      className="z-10 inline-flex h-8 w-9 items-center justify-center rounded border font-mono text-sm"
                      style={{
                        borderColor: active ? '#8b5cf6' : 'var(--edge)',
                        color: active ? '#8b5cf6' : 'var(--fg)',
                        background: 'var(--surface)',
                      }}
                    >
                      {g.kind}
                    </span>
                  );
                }
                return (
                  <span key={gi} className="relative flex items-center justify-center">
                    {cell}
                  </span>
                );
              })}
              <span className="z-10 ml-1 inline-flex h-8 w-9 items-center justify-center rounded border border-edge font-mono text-xs text-muted" title="measure">
                M
              </span>
            </div>
          </div>
        ))}
        {/* vertical connectors for CNOT */}
      </div>

      {/* Probability bars */}
      <div className="mt-4 space-y-2">
        {LABELS.map((lab, k) => {
          const p = probs[k];
          const neg = amp[k] < -1e-9;
          return (
            <div key={lab} className="flex items-center gap-3">
              <span className="w-12 font-mono text-sm text-fg">{lab}</span>
              <div className="h-5 flex-1 overflow-hidden rounded bg-bg">
                <div
                  className="h-full transition-all"
                  style={{ width: `${(p * 100).toFixed(1)}%`, background: neg ? '#f43f5e' : 'var(--accent)' }}
                  title={neg ? 'amplitude is negative' : ''}
                />
              </div>
              <span className="w-14 text-right font-mono text-xs text-muted">{(p * 100).toFixed(1)}%</span>
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
          disabled={frames.length <= 1}
          className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-40"
        >
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Run'}
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
          aria-label="circuit timeline"
        />
        <span className="shrink-0 font-mono text-xs text-muted">
          {gatesApplied === 0 ? 'start |00⟩' : `after ${gateLabel(gates[gatesApplied - 1])}`}
        </span>
      </div>

      <div className="mt-4 space-y-1 border-t border-edge pt-4 font-mono text-xs text-muted">
        <div>
          state: <span className="text-fg">{stateStr || '|00⟩'}</span>
        </div>
        <div>
          {gatesApplied}/{gates.length} gates applied · negative amplitudes shown in rose
        </div>
      </div>
    </div>
  );
}
