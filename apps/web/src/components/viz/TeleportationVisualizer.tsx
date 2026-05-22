import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// Quantum teleportation, told as a sequence of stages. We don't simulate the full
// 3-qubit state vector; instead we track the meaningful summary at each step:
// the unknown state |ψ⟩ = α|0⟩ + β|1⟩ that starts on Alice's qubit and is
// reconstructed on Bob's qubit after his correction.

const fmt = (n: number) => (Math.abs(n) < 1e-9 ? '0' : n.toFixed(3));

type Stage = {
  key: string;
  title: string;
  detail: string;
  // which actor holds the unknown |ψ⟩ amplitudes: 'alice' | 'bob' | 'none' (in transit / scrambled)
  holder: 'alice' | 'bob' | 'none';
  entangled: boolean;
  bits: [number | null, number | null]; // classical bits sent to Bob
  correction: string | null;
};

function buildStages(bits: [number, number]): Stage[] {
  const [m0, m1] = bits;
  // Bob's correction is determined by the two classical bits:
  //   m1 (target/X bit) → apply X if 1 ; m0 (control/Z bit) → apply Z if 1.
  const corr =
    (m0 === 1 ? 'Z' : '') + (m1 === 1 ? 'X' : '');
  return [
    {
      key: 'state',
      title: 'Alice has an unknown qubit',
      detail: 'Alice holds |ψ⟩ = α|0⟩ + β|1⟩. She does not know α or β — and measuring would destroy it. The goal: recreate |ψ⟩ on Bob’s far-away qubit without sending the qubit itself.',
      holder: 'alice',
      entangled: false,
      bits: [null, null],
      correction: null,
    },
    {
      key: 'bell',
      title: 'Share a Bell pair',
      detail: 'Ahead of time, Alice and Bob each take one half of an entangled Bell pair (1/√2)(|00⟩ + |11⟩). This shared entanglement is the channel teleportation runs over.',
      holder: 'alice',
      entangled: true,
      bits: [null, null],
      correction: null,
    },
    {
      key: 'measure',
      title: 'Alice does a Bell measurement',
      detail: 'Alice applies CNOT (her qubit → her Bell half) then H, and measures both of her qubits. This collapses her copy of |ψ⟩ — the amplitudes no longer live with her.',
      holder: 'none',
      entangled: false,
      bits: [m0, m1],
      correction: null,
    },
    {
      key: 'classical',
      title: 'Send 2 classical bits',
      detail: `Alice sends her two measurement outcomes (${m0}, ${m1}) to Bob over an ordinary classical channel. This step is limited by the speed of light — teleportation sends no information faster than light.`,
      holder: 'none',
      entangled: false,
      bits: [m0, m1],
      correction: null,
    },
    {
      key: 'correct',
      title: 'Bob applies the correction',
      detail: `Depending on the bits, Bob applies ${corr || 'no gate (already correct)'}: apply Z if the first bit is 1, then X if the second is 1. His qubit becomes exactly |ψ⟩.`,
      holder: 'bob',
      entangled: false,
      bits: [m0, m1],
      correction: corr || 'I',
    },
  ];
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

function Holder({
  who,
  active,
  psi,
  label,
}: {
  who: string;
  active: boolean;
  psi: { alpha: number; beta: number } | null;
  label: string;
}) {
  return (
    <div
      className="flex-1 rounded-lg border p-3 transition-colors"
      style={{ borderColor: active ? '#10b981' : 'var(--edge)', background: 'var(--bg)' }}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium text-fg">{who}</span>
        <span className="font-mono text-[10px] text-muted">{label}</span>
      </div>
      {active && psi ? (
        <div className="font-mono text-xs" style={{ color: '#10b981' }}>
          |ψ⟩ = {fmt(psi.alpha)}|0⟩ {psi.beta >= 0 ? '+' : '−'} {fmt(Math.abs(psi.beta))}|1⟩
        </div>
      ) : (
        <div className="font-mono text-xs text-muted">—</div>
      )}
    </div>
  );
}

export default function TeleportationVisualizer() {
  // The unknown state, parameterised by an angle so presets stay normalized.
  const [angleDeg, setAngleDeg] = useState(60);
  const [bits, setBits] = useState<[number, number]>([1, 0]);

  const theta = (angleDeg * Math.PI) / 180;
  const psi = { alpha: Math.cos(theta / 2), beta: Math.sin(theta / 2) };

  const stages = useMemo(() => buildStages(bits), [bits]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(stages.length, 1);
  const i = Math.min(index, stages.length - 1);
  const stage = stages[i];

  const reroll = () => {
    setBits([Math.random() < 0.5 ? 0 : 1, Math.random() < 0.5 ? 0 : 1]);
    reset();
  };

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          unknown |ψ⟩ angle
          <input
            type="range"
            min={0}
            max={180}
            value={angleDeg}
            onChange={(e) => {
              setAngleDeg(Number(e.target.value));
              reset();
            }}
            className="accent-[var(--accent)]"
          />
          <span className="font-mono text-xs text-fg">{angleDeg}°</span>
        </label>
        <button type="button" className={btn} onClick={reroll} title="randomize Alice’s measurement outcome">
          <Icon name="target" size={15} /> new measurement
        </button>
      </div>

      {/* Alice — channel — Bob */}
      <div className="flex items-stretch gap-2">
        <Holder
          who="Alice"
          label="2 qubits"
          active={stage.holder === 'alice'}
          psi={psi}
        />
        <div className="flex w-28 shrink-0 flex-col items-center justify-center gap-1">
          {stage.entangled && (
            <span className="font-mono text-[10px]" style={{ color: '#8b5cf6' }}>
              ⟨entangled⟩
            </span>
          )}
          <Icon name="arrow-right" size={20} className="text-muted" />
          {stage.bits[0] !== null && (
            <span className="rounded border border-edge px-2 py-0.5 font-mono text-[11px]" style={{ color: '#fbbf24' }}>
              bits {stage.bits[0]}{stage.bits[1]}
            </span>
          )}
          {stage.correction && (
            <span className="font-mono text-[10px]" style={{ color: '#10b981' }}>
              apply {stage.correction}
            </span>
          )}
        </div>
        <Holder
          who="Bob"
          label="1 qubit"
          active={stage.holder === 'bob'}
          psi={psi}
        />
      </div>

      {/* Stage tracker */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {stages.map((s, k) => (
          <button
            key={s.key}
            type="button"
            onClick={() => seek(k)}
            className="rounded px-2 py-1 font-mono text-[11px] transition"
            style={{
              background: k === i ? 'var(--accent)' : 'var(--bg)',
              color: k === i ? 'var(--accent-fg)' : 'var(--muted)',
              border: '1px solid var(--edge)',
            }}
          >
            {k + 1}. {s.title.split(' ').slice(0, 2).join(' ')}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={prev} disabled={index <= 0}>
          <Icon name="chevron-left" size={16} /> Back
        </button>
        <button
          type="button"
          onClick={() => (playing ? pause() : play())}
          className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90"
        >
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= stages.length - 1}>
          Next <Icon name="chevron-right" size={16} />
        </button>
        <button type="button" className={btn} onClick={reset} disabled={index === 0}>
          <Icon name="rotate-ccw" size={16} /> Reset
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={1} max={4} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="mt-4 space-y-1 border-t border-edge pt-4 text-xs text-muted">
        <div className="font-mono">
          step {i + 1}/{stages.length}: <span className="text-fg">{stage.title}</span>
        </div>
        <p className="leading-relaxed">{stage.detail}</p>
        {stage.holder === 'bob' && (
          <p style={{ color: '#10b981' }}>
            |ψ⟩ now lives on Bob’s qubit — and Alice’s copy is gone (no-cloning is respected).
          </p>
        )}
      </div>
    </div>
  );
}
