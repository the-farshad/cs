import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// modular exponentiation: base^exp mod m, done with small numbers for clarity.
function modPow(base: number, exp: number, m: number): number {
  let result = 1;
  let b = base % m;
  let e = exp;
  while (e > 0) {
    if (e & 1) result = (result * b) % m;
    b = (b * b) % m;
    e >>= 1;
  }
  return result;
}

// Small public parameters: prime modulus p and generator g.
const P = 23;
const G = 5;

type Highlight = 'g' | 'A' | 'B' | 'sa' | 'sb' | null;
type Who = 'shared' | 'alice' | 'bob' | 'eve';
type Step = { who: Who; text: string; highlight: Highlight };

// A party panel. Defined at module scope so its inputs keep focus across renders.
function Party({
  name,
  who,
  active,
  color,
  secret,
  onSecret,
  pub,
  pubReached,
  shared,
  sharedReached,
}: {
  name: string;
  who: Who;
  active: Who;
  color: string;
  secret: number;
  onSecret: (n: number) => void;
  pub: number;
  pubReached: boolean;
  shared: number;
  sharedReached: boolean;
}) {
  return (
    <div className="flex-1 rounded-lg border p-3" style={{ borderColor: active === who ? color : 'var(--border)' }}>
      <div className="mb-2 text-sm font-medium" style={{ color }}>
        {name}
      </div>
      <label className="mb-2 flex items-center justify-between gap-2 text-xs text-muted">
        secret
        <input
          type="number"
          min={2}
          max={P - 2}
          value={secret}
          onChange={(e) => onSecret(Math.max(2, Math.min(P - 2, Number(e.target.value) || 2)))}
          className="w-16 rounded border border-edge bg-bg px-2 py-1 text-right font-mono text-fg"
        />
      </label>
      <div className="font-mono text-xs text-muted">
        public: <span style={{ color: pubReached ? color : 'var(--muted)' }}>{pubReached ? pub : '—'}</span>
      </div>
      <div className="font-mono text-xs text-muted">
        shared: <span style={{ color: sharedReached ? '#10b981' : 'var(--muted)' }}>{sharedReached ? shared : '—'}</span>
      </div>
    </div>
  );
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function DiffieHellmanVisualizer() {
  const [a, setA] = useState(6); // Alice's secret
  const [b, setB] = useState(15); // Bob's secret

  const A = useMemo(() => modPow(G, a, P), [a]); // Alice's public value
  const B = useMemo(() => modPow(G, b, P), [b]); // Bob's public value
  const sA = useMemo(() => modPow(B, a, P), [B, a]); // Alice computes B^a
  const sB = useMemo(() => modPow(A, b, P), [A, b]); // Bob computes A^b

  const steps = useMemo<Step[]>(
    () => [
      { who: 'shared', text: `Public parameters agreed in the open: prime p = ${P}, generator g = ${G}.`, highlight: 'g' },
      { who: 'alice', text: `Alice picks a SECRET a = ${a}. She never sends this.`, highlight: null },
      { who: 'bob', text: `Bob picks a SECRET b = ${b}. He never sends this.`, highlight: null },
      { who: 'alice', text: `Alice sends her public value A = g^a mod p = ${G}^${a} mod ${P} = ${A}.`, highlight: 'A' },
      { who: 'bob', text: `Bob sends his public value B = g^b mod p = ${G}^${b} mod ${P} = ${B}.`, highlight: 'B' },
      { who: 'alice', text: `Alice computes B^a mod p = ${B}^${a} mod ${P} = ${sA}.`, highlight: 'sa' },
      { who: 'bob', text: `Bob computes A^b mod p = ${A}^${b} mod ${P} = ${sB}.`, highlight: 'sb' },
      {
        who: 'shared',
        text: `Both arrive at the SAME shared secret ${sA}, because (g^a)^b = (g^b)^a mod p.`,
        highlight: null,
      },
      {
        who: 'eve',
        text: `Eve saw p, g, A=${A}, B=${B} — but to find the secret she must solve the discrete log (recover a or b). That is infeasible for large p.`,
        highlight: null,
      },
    ],
    [a, b, A, B, sA, sB],
  );

  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(steps.length, 1.5);
  const step = steps[Math.min(index, steps.length - 1)] ?? steps[0];
  const reached = (s: Highlight) => steps.slice(0, index + 1).some((st) => st.highlight === s);
  const sharedReached = index >= 7;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap gap-2 font-mono text-sm">
        <span className="rounded border px-2 py-1" style={{ borderColor: reached('g') ? 'var(--accent)' : 'var(--border)', color: reached('g') ? 'var(--accent)' : 'var(--muted)' }}>
          p = {P}
        </span>
        <span className="rounded border px-2 py-1" style={{ borderColor: reached('g') ? 'var(--accent)' : 'var(--border)', color: reached('g') ? 'var(--accent)' : 'var(--muted)' }}>
          g = {G}
        </span>
        <span className="ml-auto self-center text-xs text-muted">public, sent in the clear</span>
      </div>

      <div className="flex gap-3">
        <Party name="Alice" who="alice" active={step.who} color="#38bdf8" secret={a} onSecret={setA} pub={A} pubReached={reached('A')} shared={sA} sharedReached={sharedReached} />
        <Party name="Bob" who="bob" active={step.who} color="#fbbf24" secret={b} onSecret={setB} pub={B} pubReached={reached('B')} shared={sB} sharedReached={sharedReached} />
      </div>

      <div className="mt-3 rounded-lg border p-3" style={{ borderColor: step.who === 'eve' ? '#f43f5e' : 'var(--border)' }}>
        <div className="flex items-center gap-2 text-sm font-medium" style={{ color: '#f43f5e' }}>
          <Icon name="target" size={15} /> Eve (eavesdropper)
        </div>
        <div className="mt-1 font-mono text-xs text-muted">
          sees: p, g, {reached('A') ? `A=${A}` : 'A=?'}, {reached('B') ? `B=${B}` : 'B=?'} · secret she can compute:{' '}
          <span style={{ color: '#f43f5e' }}>none</span>
        </div>
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
        <button type="button" className={btn} onClick={next} disabled={index >= steps.length - 1}>
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
          max={Math.max(steps.length - 1, 0)}
          value={index}
          onChange={(e) => seek(Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
          aria-label="Timeline"
        />
        <span className="shrink-0 font-mono text-xs text-muted">
          {index + 1}/{steps.length}
        </span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-fg">{step.text}</div>
    </div>
  );
}
