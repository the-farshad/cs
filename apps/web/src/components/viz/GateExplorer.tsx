import { useState } from 'react';
import Icon from '@/components/ui/Icon';

// Complex number as {re, im}. We keep amplitudes exact enough for display and
// compute probabilities as |amp|^2 = re^2 + im^2.
type Cx = { re: number; im: number };

const c = (re: number, im = 0): Cx => ({ re, im });
const add = (x: Cx, y: Cx): Cx => ({ re: x.re + y.re, im: x.im + y.im });
const mul = (x: Cx, y: Cx): Cx => ({ re: x.re * y.re - x.im * y.im, im: x.re * y.im + x.im * y.re });
const scale = (x: Cx, k: number): Cx => ({ re: x.re * k, im: x.im * k });
const abs2 = (x: Cx): number => x.re * x.re + x.im * x.im;

const S = 1 / Math.SQRT2;
const I = c(0, 1); // i
const EXP_PI4 = c(Math.cos(Math.PI / 4), Math.sin(Math.PI / 4)); // e^{iπ/4}

type GateName = 'X' | 'Y' | 'Z' | 'H' | 'S' | 'T';
type InputName = '|0⟩' | '|1⟩' | '|+⟩';

// Apply a single-qubit gate to a 2-vector [a0, a1] of complex amplitudes.
function applyGate(g: GateName, a0: Cx, a1: Cx): [Cx, Cx] {
  switch (g) {
    case 'X':
      return [a1, a0];
    case 'Y':
      // [[0,-i],[i,0]]: new0 = -i·a1, new1 = i·a0
      return [mul(c(0, -1), a1), mul(I, a0)];
    case 'Z':
      return [a0, scale(a1, -1)];
    case 'H':
      return [scale(add(a0, a1), S), scale(add(a0, scale(a1, -1)), S)];
    case 'S':
      // [[1,0],[0,i]]
      return [a0, mul(I, a1)];
    case 'T':
      // [[1,0],[0,e^{iπ/4}]]
      return [a0, mul(EXP_PI4, a1)];
  }
}

// 2x2 matrices as KaTeX-free display strings (rendered in a small grid).
const MATRIX: Record<GateName, [string, string, string, string]> = {
  X: ['0', '1', '1', '0'],
  Y: ['0', '−i', 'i', '0'],
  Z: ['1', '0', '0', '−1'],
  H: ['1', '1', '1', '−1'],
  S: ['1', '0', '0', 'i'],
  T: ['1', '0', '0', 'e^(iπ/4)'],
};

// Scalar prefactor shown in front of the matrix (only H carries 1/√2).
const PREFACTOR: Record<GateName, string | null> = {
  X: null,
  Y: null,
  Z: null,
  H: '1/√2',
  S: null,
  T: null,
};

const GATE_NOTE: Record<GateName, string> = {
  X: 'Bit flip (quantum NOT): swaps the |0⟩ and |1⟩ amplitudes. Real-valued.',
  Y: 'Bit-and-phase flip: swaps amplitudes and adds ±i phases. Complex entries.',
  Z: 'Phase flip: leaves |0⟩ alone, negates the |1⟩ amplitude.',
  H: 'Hadamard: maps |0⟩→|+⟩ and |1⟩→|−⟩, creating equal superposition.',
  S: 'Phase gate (√Z): adds a +i (90°) phase to the |1⟩ amplitude only.',
  T: 'T gate (π/8): adds a 45° phase (e^{iπ/4}) to |1⟩ — a non-Clifford gate.',
};

const INPUTS: Record<InputName, [Cx, Cx]> = {
  '|0⟩': [c(1), c(0)],
  '|1⟩': [c(0), c(1)],
  '|+⟩': [c(S), c(S)],
};

const GATES: GateName[] = ['X', 'Y', 'Z', 'H', 'S', 'T'];
const INPUT_KEYS: InputName[] = ['|0⟩', '|1⟩', '|+⟩'];

const fmt = (n: number) => (Math.abs(n) < 1e-9 ? '0' : Number(n.toFixed(3)).toString());

// Render a complex amplitude like "0.707", "i", "−0.707i", "0.5 + 0.5i".
function cxStr(x: Cx): string {
  const re = Math.abs(x.re) < 1e-9 ? 0 : x.re;
  const im = Math.abs(x.im) < 1e-9 ? 0 : x.im;
  if (re === 0 && im === 0) return '0';
  if (im === 0) return fmt(re);
  const imStr = `${Math.abs(im) === 1 ? '' : fmt(Math.abs(im))}i`;
  if (re === 0) return `${im < 0 ? '−' : ''}${imStr}`;
  return `${fmt(re)} ${im < 0 ? '−' : '+'} ${imStr}`;
}

// Phase angle in degrees for a complex amplitude (for the relative-phase note).
function phaseDeg(x: Cx): number | null {
  if (abs2(x) < 1e-12) return null;
  let d = (Math.atan2(x.im, x.re) * 180) / Math.PI;
  if (Math.abs(d) < 1e-6) d = 0;
  return Math.round(d);
}

const btn =
  'inline-flex items-center justify-center rounded border px-3 py-1 font-mono text-sm transition';

export default function GateExplorer() {
  const [gate, setGate] = useState<GateName>('H');
  const [input, setInput] = useState<InputName>('|0⟩');

  const [in0, in1] = INPUTS[input];
  const [out0, out1] = applyGate(gate, in0, in1);
  const p0 = abs2(out0);
  const p1 = abs2(out1);

  const hasComplex = gate === 'Y' || gate === 'S' || gate === 'T';
  const ph0 = phaseDeg(out0);
  const ph1 = phaseDeg(out1);
  // Relative phase between the two amplitudes (only meaningful when both nonzero).
  const relPhase = ph0 !== null && ph1 !== null ? ph1 - ph0 : null;

  const matrix = MATRIX[gate];
  const pref = PREFACTOR[gate];

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">gate:</span>
        {GATES.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGate(g)}
            className={`${btn} ${
              g === gate ? 'border-accent bg-accent text-accent-fg' : 'border-edge text-fg hover:border-accent hover:text-accent'
            }`}
            title={GATE_NOTE[g]}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">input:</span>
        {INPUT_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setInput(k)}
            className={`${btn} ${
              k === input ? 'border-accent bg-accent text-accent-fg' : 'border-edge text-fg hover:border-accent hover:text-accent'
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {/* Matrix card */}
        <div className="flex items-center gap-2 rounded-lg border border-edge bg-bg p-3">
          <span className="font-mono text-lg text-accent">{gate}</span>
          {pref && <span className="font-mono text-xs text-muted">{pref} ·</span>}
          <div className="flex items-stretch">
            <span className="text-2xl text-muted">[</span>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 px-1 text-center font-mono text-sm text-fg">
              <span>{matrix[0]}</span>
              <span>{matrix[1]}</span>
              <span>{matrix[2]}</span>
              <span>{matrix[3]}</span>
            </div>
            <span className="text-2xl text-muted">]</span>
          </div>
        </div>

        <Icon name="arrow-right" size={20} className="text-muted" />

        {/* Output amplitudes */}
        <div className="rounded-lg border border-edge bg-bg p-3 font-mono text-xs">
          <div className="text-muted">
            {gate} {input} =
          </div>
          <div className="mt-1 text-fg">
            (<span className="text-accent">{cxStr(out0)}</span>) |0⟩ + (<span className="text-accent">{cxStr(out1)}</span>) |1⟩
          </div>
        </div>
      </div>

      {/* Probability bars */}
      <div className="mt-4 space-y-3">
        {[
          { k: '|0⟩', p: p0, amp: out0, ph: ph0 },
          { k: '|1⟩', p: p1, amp: out1, ph: ph1 },
        ].map(({ k, p, amp, ph }) => (
          <div key={k} className="flex items-center gap-3">
            <span className="w-8 font-mono text-sm text-fg">{k}</span>
            <div className="h-6 flex-1 overflow-hidden rounded bg-bg">
              <div className="h-full bg-accent transition-all" style={{ width: `${(p * 100).toFixed(1)}%` }} />
            </div>
            <span className="w-20 text-right font-mono text-xs text-muted">{(p * 100).toFixed(1)}%</span>
            {hasComplex && abs2(amp) > 1e-9 && ph !== null && (
              <span className="w-16 text-right font-mono text-[10px]" style={{ color: '#8b5cf6' }}>
                ∠{ph}°
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-1 border-t border-edge pt-4 text-xs text-muted">
        <p className="leading-relaxed">{GATE_NOTE[gate]}</p>
        {hasComplex ? (
          <p className="leading-relaxed">
            This gate writes a <span style={{ color: '#8b5cf6' }}>complex phase</span> onto an amplitude. The bars (probabilities) are
            unchanged by a phase, and a single measurement cannot see it — but the{' '}
            {relPhase !== null ? (
              <>
                relative phase <span style={{ color: '#8b5cf6' }}>{relPhase}°</span> between |0⟩ and |1⟩
              </>
            ) : (
              'relative phase'
            )}{' '}
            steers later interference (e.g. after another Hadamard).
          </p>
        ) : (
          <p className="leading-relaxed">All amplitudes here are real, so the bars fully describe the state up to a sign.</p>
        )}
      </div>
    </div>
  );
}
