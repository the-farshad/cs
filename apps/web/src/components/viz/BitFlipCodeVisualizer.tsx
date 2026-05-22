import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// 3-qubit bit-flip code. One logical qubit |ψ⟩ = α|0⟩ + β|1⟩ is encoded into
// three physical qubits as α|000⟩ + β|111⟩ (via two CNOTs). If a single qubit
// flips, two parity checks (syndrome) locate it, and an X gate undoes it.
//
// For visualization we track which physical qubits are "flipped" relative to the
// majority — the logical amplitudes ride along unchanged once correction is done.

const fmt = (n: number) => (Math.abs(n) < 1e-9 ? '0' : n.toFixed(3));

type Phase = 'encode' | 'error' | 'syndrome' | 'correct';

type Frame = {
  phase: Phase;
  // flipped[i] = true if physical qubit i currently differs from the encoded value
  flipped: [boolean, boolean, boolean];
  // syndrome bits: parity of (q0,q1) and (q1,q2); null until measured
  s01: number | null;
  s12: number | null;
  note: string;
  detected: number | null; // index of the qubit identified as flipped
};

function buildFrames(errorQubit: number): Frame[] {
  const none: [boolean, boolean, boolean] = [false, false, false];
  const withErr: [boolean, boolean, boolean] = [false, false, false];
  if (errorQubit >= 0 && errorQubit < 3) withErr[errorQubit] = true;

  // Syndrome = parity checks on the *encoded* basis. With α|000⟩+β|111⟩, qubits
  // 0,1,2 should all agree; a flip on qubit k breaks the parity pairs touching k.
  const s01 = errorQubit === 0 || errorQubit === 1 ? 1 : 0;
  const s12 = errorQubit === 1 || errorQubit === 2 ? 1 : 0;

  // Decode syndrome → which qubit: (s01,s12) = (1,0)→q0, (1,1)→q1, (0,1)→q2, (0,0)→none.
  let detected: number | null = null;
  if (s01 === 1 && s12 === 0) detected = 0;
  else if (s01 === 1 && s12 === 1) detected = 1;
  else if (s01 === 0 && s12 === 1) detected = 2;

  return [
    {
      phase: 'encode',
      flipped: none,
      s01: null,
      s12: null,
      note: 'Encode: α|0⟩ + β|1⟩  →  α|000⟩ + β|111⟩ using two CNOTs. The three qubits now agree.',
      detected: null,
    },
    {
      phase: 'error',
      flipped: withErr,
      s01: null,
      s12: null,
      note: errorQubit < 0 ? 'No error this round — the channel was clean.' : `Noise flips qubit ${errorQubit}. The encoded state is now corrupted.`,
      detected: null,
    },
    {
      phase: 'syndrome',
      flipped: withErr,
      s01,
      s12,
      note: `Syndrome measurement reads parities without touching α,β: s₀₁ = ${s01}, s₁₂ = ${s12}.`,
      detected,
    },
    {
      phase: 'correct',
      flipped: none,
      s01,
      s12,
      note: detected === null ? 'Syndrome 00 → no correction needed. The logical qubit was safe.' : `Syndrome points at qubit ${detected}. Apply X to flip it back — the logical state α|0⟩ + β|1⟩ is restored.`,
      detected,
    },
  ];
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const phaseLabels: Record<Phase, string> = {
  encode: 'Encode',
  error: 'Error',
  syndrome: 'Syndrome',
  correct: 'Correct',
};

export default function BitFlipCodeVisualizer() {
  const [angleDeg, setAngleDeg] = useState(70);
  const [errorQubit, setErrorQubit] = useState(1);

  const theta = (angleDeg * Math.PI) / 180;
  const alpha = Math.cos(theta / 2);
  const beta = Math.sin(theta / 2);

  const frames = useMemo(() => buildFrames(errorQubit), [errorQubit]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 1);
  const i = Math.min(index, frames.length - 1);
  const frame = frames[i];

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          logical |ψ⟩ angle
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
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-muted">bit flip on:</span>
          {[0, 1, 2].map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                setErrorQubit(q);
                reset();
              }}
              className={`inline-flex h-7 w-7 items-center justify-center rounded border font-mono text-sm transition ${
                q === errorQubit ? 'border-accent bg-accent text-accent-fg' : 'border-edge text-fg hover:border-accent hover:text-accent'
              }`}
            >
              {q}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setErrorQubit(-1);
              reset();
            }}
            className={`inline-flex h-7 items-center justify-center rounded border px-2 font-mono text-xs transition ${
              errorQubit === -1 ? 'border-accent bg-accent text-accent-fg' : 'border-edge text-fg hover:border-accent hover:text-accent'
            }`}
          >
            none
          </button>
        </div>
      </div>

      {/* Three physical qubits */}
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((q) => {
          const flipped = frame.flipped[q];
          const isDetected = frame.phase !== 'encode' && frame.detected === q;
          let border = 'var(--edge)';
          if (flipped) border = '#f43f5e';
          else if (frame.phase === 'correct' && isDetected) border = '#10b981';
          return (
            <div key={q} className="rounded-lg border p-3 text-center transition-colors" style={{ borderColor: border, background: 'var(--bg)' }}>
              <div className="font-mono text-xs text-muted">qubit {q}</div>
              <div
                className="mt-1 font-mono text-lg"
                style={{ color: flipped ? '#f43f5e' : 'var(--fg)' }}
              >
                {flipped ? 'flipped' : 'ok'}
              </div>
              {isDetected && (
                <div className="mt-1 font-mono text-[10px]" style={{ color: frame.phase === 'correct' ? '#10b981' : '#fbbf24' }}>
                  {frame.phase === 'correct' ? 'X applied' : 'suspect'}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Syndrome readout */}
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-edge bg-bg p-3 font-mono text-xs">
        <span className="text-muted">syndrome:</span>
        <span className="text-fg">
          s₀₁ (q0⊕q1) = <span style={{ color: frame.s01 === 1 ? '#fbbf24' : 'var(--fg)' }}>{frame.s01 ?? '—'}</span>
        </span>
        <span className="text-fg">
          s₁₂ (q1⊕q2) = <span style={{ color: frame.s12 === 1 ? '#fbbf24' : 'var(--fg)' }}>{frame.s12 ?? '—'}</span>
        </span>
        {frame.detected !== null && frame.phase !== 'encode' && frame.phase !== 'error' && (
          <span style={{ color: '#fbbf24' }}>→ flip is on qubit {frame.detected}</span>
        )}
        {frame.phase === 'correct' && frame.detected === null && <span style={{ color: '#10b981' }}>→ no error</span>}
      </div>

      {/* Phase tracker */}
      <div className="mt-3 flex gap-1.5">
        {frames.map((f, k) => (
          <button
            key={f.phase}
            type="button"
            onClick={() => seek(k)}
            className="flex-1 rounded px-2 py-1 font-mono text-[11px] transition"
            style={{
              background: k === i ? 'var(--accent)' : 'var(--bg)',
              color: k === i ? 'var(--accent-fg)' : 'var(--muted)',
              border: '1px solid var(--edge)',
            }}
          >
            {phaseLabels[f.phase]}
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
        <button type="button" className={btn} onClick={next} disabled={index >= frames.length - 1}>
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
          logical state: <span className="text-fg">{fmt(alpha)}|0⟩ {beta >= 0 ? '+' : '−'} {fmt(Math.abs(beta))}|1⟩</span>
          {' '}→ encoded as <span className="text-fg">{fmt(alpha)}|000⟩ {beta >= 0 ? '+' : '−'} {fmt(Math.abs(beta))}|111⟩</span>
        </div>
        <p className="leading-relaxed">{frame.note}</p>
      </div>
    </div>
  );
}
