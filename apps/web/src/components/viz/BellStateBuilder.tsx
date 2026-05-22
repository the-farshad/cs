import { useState } from 'react';
import Icon from '@/components/ui/Icon';

const S = 1 / Math.SQRT2;

// Amplitudes ordered [|00⟩, |01⟩, |10⟩, |11⟩]. Qubit 0 is the high bit (left).
type Amps = [number, number, number, number];
const ZERO: Amps = [1, 0, 0, 0];

const LABELS = ['|00⟩', '|01⟩', '|10⟩', '|11⟩'];

// H on qubit 0 (the left/high bit): mixes states that differ only in q0.
// Pairs by index: |00⟩↔|10⟩ (0,2) and |01⟩↔|11⟩ (1,3).
function hadamardQ0([a00, a01, a10, a11]: Amps): Amps {
  return [(a00 + a10) * S, (a01 + a11) * S, (a00 - a10) * S, (a01 - a11) * S];
}

// CNOT with control q0, target q1: when q0 = 1, flip q1.
// Affects |10⟩↔|11⟩ (indices 2,3); leaves |00⟩,|01⟩ alone.
function cnot([a00, a01, a10, a11]: Amps): Amps {
  return [a00, a01, a11, a10];
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';
const primary =
  'inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-3 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-40';

const fmt = (n: number) => (Math.abs(n) < 1e-9 ? '0' : n.toFixed(3));

export default function BellStateBuilder() {
  const [amp, setAmp] = useState<Amps>(ZERO);
  const [measured, setMeasured] = useState<[number, number] | null>(null);
  const [log, setLog] = useState<string[]>([]);
  // Track which step of the recipe is done: 0 = nothing, 1 = H applied, 2 = CNOT applied.
  const [stage, setStage] = useState(0);

  const applyH = () => {
    setMeasured(null);
    setAmp((a) => hadamardQ0(a));
    setStage((s) => Math.max(s, 1));
    setLog((l) => [...l, 'H on q0'].slice(-10));
  };

  const applyCnot = () => {
    setMeasured(null);
    setAmp((a) => cnot(a));
    setStage((s) => Math.max(s, 2));
    setLog((l) => [...l, 'CNOT (q0→q1)'].slice(-10));
  };

  const measure = () => {
    const probs = amp.map((a) => a * a);
    // Sample a basis state from the probability distribution.
    let r = Math.random();
    let chosen = 0;
    for (let i = 0; i < 4; i++) {
      r -= probs[i];
      if (r <= 0) {
        chosen = i;
        break;
      }
    }
    const q0 = chosen >> 1;
    const q1 = chosen & 1;
    const collapsed: Amps = [0, 0, 0, 0];
    collapsed[chosen] = 1;
    setAmp(collapsed);
    setMeasured([q0, q1]);
    setLog((l) => [...l, `measure→${q0}${q1}`].slice(-10));
  };

  const reset = () => {
    setAmp(ZERO);
    setMeasured(null);
    setStage(0);
    setLog([]);
  };

  const probs = amp.map((a) => a * a);
  const isBell = stage >= 2 && probs[0] > 0.49 && probs[3] > 0.49;
  const stateStr = LABELS.map((lab, i) => ({ lab, a: amp[i] }))
    .filter((t) => Math.abs(t.a) > 1e-9)
    .map((t, idx) => `${idx > 0 ? (t.a >= 0 ? '+ ' : '− ') : ''}${fmt(Math.abs(t.a))}${t.lab}`)
    .join(' ');

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">build the Bell state:</span>
        <button type="button" className={btn} onClick={applyH} title="Hadamard on qubit 0 — creates superposition">
          1. H on q0
        </button>
        <button type="button" className={btn} onClick={applyCnot} title="CNOT, control q0, target q1 — entangles the qubits">
          2. CNOT (q0→q1)
        </button>
        <button type="button" className={primary} onClick={measure} title="collapse both qubits">
          <Icon name="target" size={15} /> measure
        </button>
        <button type="button" className={btn} onClick={reset}>
          <Icon name="rotate-ccw" size={15} /> reset to |00⟩
        </button>
      </div>

      <div className="space-y-3">
        {LABELS.map((lab, i) => {
          const p = probs[i];
          const lit = measured !== null && p > 0.5;
          return (
            <div key={lab} className="flex items-center gap-3">
              <span className="w-12 font-mono text-sm text-fg">{lab}</span>
              <div className="h-6 flex-1 overflow-hidden rounded bg-bg">
                <div
                  className="h-full transition-all"
                  style={{ width: `${(p * 100).toFixed(1)}%`, background: lit ? '#10b981' : 'var(--accent)' }}
                />
              </div>
              <span className="w-14 text-right font-mono text-xs text-muted">{(p * 100).toFixed(1)}%</span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 space-y-1 border-t border-edge pt-4 font-mono text-xs text-muted">
        <div>
          state: <span className="text-fg">{stateStr}</span>
        </div>
        {measured !== null ? (
          <div>
            measured: q0 = <span className="text-accent">{measured[0]}</span>, q1 = <span className="text-accent">{measured[1]}</span>
            {isBell || measured[0] === measured[1] ? (
              <span style={{ color: '#10b981' }}> — the two qubits agree (correlated)</span>
            ) : null}
          </div>
        ) : isBell ? (
          <div style={{ color: '#10b981' }}>entangled Bell state: 50% |00⟩ and 50% |11⟩ — measure to see the qubits always agree</div>
        ) : (
          <div>apply H then CNOT to entangle, then measure repeatedly</div>
        )}
        {log.length > 0 && <div>history: {log.join('  ')}</div>}
      </div>
    </div>
  );
}
