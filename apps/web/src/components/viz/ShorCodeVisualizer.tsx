import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// 9-qubit Shor code = bit-flip code concatenated with phase-flip code.
// Layout: 3 blocks of 3 physical qubits (q0..q2 | q3..q5 | q6..q8).
//   |0_L⟩ = (|000⟩+|111⟩)(|000⟩+|111⟩)(|000⟩+|111⟩) / (2√2)
//   |1_L⟩ = (|000⟩−|111⟩)(|000⟩−|111⟩)(|000⟩−|111⟩) / (2√2)
//
// Inner code (within each block): the 3-qubit bit-flip code corrects an X error,
//   located by two parity checks per block (Z_iZ_j).
// Outer code (across blocks): a Z error flips the sign of its whole block
//   (|000⟩+|111⟩ ↔ |000⟩−|111⟩); comparing block signs (X⊗X checks) locates the
//   phase error to one block, fixed with a Z. Concatenation corrects ANY single error.
//
// This is conceptual: we track which physical qubits carry an X error (bit) and
// which carry a Z error (phase), then run the two syndrome layers structurally.

type Phase = 'encode' | 'error' | 'inner' | 'outer' | 'correct';

type Frame = {
  phase: Phase;
  note: string;
};

const PHASE_LABELS: Record<Phase, string> = {
  encode: 'Encode',
  error: 'Error',
  inner: 'Bit syndrome',
  outer: 'Phase syndrome',
  correct: 'Correct',
};

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function ShorCodeVisualizer() {
  const [target, setTarget] = useState(4); // physical qubit 0..8 receiving the error
  const [bit, setBit] = useState(true); // inject X (bit flip)?
  const [phase, setPhase] = useState(true); // inject Z (phase flip)?

  const block = Math.floor(target / 3); // 0,1,2
  const pos = target % 3; // position within block 0,1,2

  // Inner (bit-flip) syndrome: per block, parities (qa⊕qb) of the two pairs.
  // A single X on `target` breaks the parity pairs in its block touching `pos`.
  // Pair A = (block*3+0, block*3+1), Pair B = (block*3+1, block*3+2).
  const innerA = bit && (pos === 0 || pos === 1) ? 1 : 0;
  const innerB = bit && (pos === 1 || pos === 2) ? 1 : 0;
  // Decode → which qubit within the block flipped.
  let bitDetected: number | null = null;
  if (innerA === 1 && innerB === 0) bitDetected = block * 3 + 0;
  else if (innerA === 1 && innerB === 1) bitDetected = block * 3 + 1;
  else if (innerA === 0 && innerB === 1) bitDetected = block * 3 + 2;

  // Outer (phase-flip) syndrome: a Z anywhere in a block flips that block's sign.
  // Compare block signs: pAB = sign(block0)⊕sign(block1), pBC = sign(block1)⊕sign(block2).
  const blockPhaseFlipped = [phase && block === 0, phase && block === 1, phase && block === 2];
  const outerAB = blockPhaseFlipped[0] !== blockPhaseFlipped[1] ? 1 : 0;
  const outerBC = blockPhaseFlipped[1] !== blockPhaseFlipped[2] ? 1 : 0;
  let phaseDetectedBlock: number | null = null;
  if (outerAB === 1 && outerBC === 0) phaseDetectedBlock = 0;
  else if (outerAB === 1 && outerBC === 1) phaseDetectedBlock = 1;
  else if (outerAB === 0 && outerBC === 1) phaseDetectedBlock = 2;

  const noError = !bit && !phase;

  const frames = useMemo<Frame[]>(() => {
    const errParts: string[] = [];
    if (bit) errParts.push('bit flip (X)');
    if (phase) errParts.push('phase flip (Z)');
    return [
      {
        phase: 'encode',
        note: 'Encode 1 logical qubit into 9: three blocks, each (|000⟩±|111⟩). The inner layer guards bit flips, the outer layer guards phase flips.',
      },
      {
        phase: 'error',
        note: noError ? 'No error injected — a clean round.' : `Inject ${errParts.join(' and ')} on qubit ${target} (block ${block}).`,
      },
      {
        phase: 'inner',
        note:
          `Inner bit-flip syndrome per block (Z_iZ_j parities). Block ${block}: sA=${innerA}, sB=${innerB}. ` +
          (bitDetected !== null ? `→ bit flip on qubit ${bitDetected}.` : 'no bit flip detected in any block.'),
      },
      {
        phase: 'outer',
        note:
          `Outer phase-flip syndrome compares block signs (X⊗X⊗X checks). pAB=${outerAB}, pBC=${outerBC}. ` +
          (phaseDetectedBlock !== null ? `→ phase flip in block ${phaseDetectedBlock}.` : 'no phase flip detected across blocks.'),
      },
      {
        phase: 'correct',
        note: noError
          ? 'Both syndromes zero — nothing to fix; the logical qubit was safe.'
          : `Apply ${bitDetected !== null ? `X to qubit ${bitDetected}` : ''}${bitDetected !== null && phaseDetectedBlock !== null ? ' and ' : ''}${phaseDetectedBlock !== null ? `Z to block ${phaseDetectedBlock}` : ''}. The logical state is restored — any single-qubit error is corrected.`,
      },
    ];
  }, [bit, phase, target, block, innerA, innerB, bitDetected, outerAB, outerBC, phaseDetectedBlock, noError]);

  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 1);
  const i = Math.min(index, frames.length - 1);
  const frame = frames[i];
  const ph = frame.phase;

  // Visual state of a qubit at the current phase.
  function qubitState(q: number) {
    const b = Math.floor(q / 3);
    const hasBit = bit && q === target;
    const hasPhase = phase && q === target;
    const showError = ph === 'error' || ph === 'inner' || ph === 'outer';
    const corrected = ph === 'correct';

    const bitActive = showError && hasBit;
    const phaseActive = showError && hasPhase;
    const innerSuspect = ph === 'inner' && bitDetected === q;

    return { b, bitActive, phaseActive, innerSuspect, corrected, hasBit, hasPhase };
  }

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted">error on qubit:</span>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: 9 }, (_, q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                setTarget(q);
                reset();
              }}
              className={`inline-flex h-7 w-7 items-center justify-center rounded border font-mono text-xs transition ${
                q === target ? 'border-accent bg-accent text-accent-fg' : 'border-edge text-fg hover:border-accent hover:text-accent'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5 text-muted">
          <input
            type="checkbox"
            checked={bit}
            onChange={(e) => {
              setBit(e.target.checked);
              reset();
            }}
            className="accent-[var(--accent)]"
          />
          bit flip <span style={{ color: '#f43f5e' }} className="font-mono">X</span>
        </label>
        <label className="flex items-center gap-1.5 text-muted">
          <input
            type="checkbox"
            checked={phase}
            onChange={(e) => {
              setPhase(e.target.checked);
              reset();
            }}
            className="accent-[var(--accent)]"
          />
          phase flip <span style={{ color: '#8b5cf6' }} className="font-mono">Z</span>
        </label>
      </div>

      {/* Three blocks of three qubits */}
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((b) => {
          const blockHasPhase = (ph === 'outer' || ph === 'correct') && phaseDetectedBlock === b;
          const blockSignFlipped = (ph === 'error' || ph === 'inner' || ph === 'outer') && blockPhaseFlipped[b];
          return (
            <div
              key={b}
              className="rounded-lg border p-2 transition-colors"
              style={{ borderColor: blockHasPhase ? '#8b5cf6' : blockSignFlipped ? '#8b5cf6' : 'var(--edge)', background: 'var(--bg)' }}
            >
              <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted">
                <span>block {b}</span>
                <span style={{ color: blockSignFlipped ? '#8b5cf6' : 'var(--muted)' }}>{blockSignFlipped ? '|000⟩−|111⟩' : '|000⟩+|111⟩'}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[0, 1, 2].map((p) => {
                  const q = b * 3 + p;
                  const st = qubitState(q);
                  let border = 'var(--edge)';
                  let label = 'ok';
                  let labelColor = 'var(--fg)';
                  if (st.bitActive && st.phaseActive) {
                    border = '#fbbf24';
                    label = 'X+Z';
                    labelColor = '#fbbf24';
                  } else if (st.bitActive) {
                    border = '#f43f5e';
                    label = 'X';
                    labelColor = '#f43f5e';
                  } else if (st.phaseActive) {
                    border = '#8b5cf6';
                    label = 'Z';
                    labelColor = '#8b5cf6';
                  } else if (st.corrected) {
                    border = '#10b981';
                    label = 'ok';
                    labelColor = '#10b981';
                  }
                  if (st.innerSuspect && !st.corrected) border = '#fbbf24';
                  return (
                    <div
                      key={q}
                      className="rounded border p-1 text-center transition-colors"
                      style={{ borderColor: border }}
                      title={`qubit ${q}`}
                    >
                      <div className="font-mono text-[9px] text-muted">q{q}</div>
                      <div className="font-mono text-xs" style={{ color: labelColor }}>
                        {label}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Inner syndrome readout for this block */}
              {(ph === 'inner' || ph === 'correct') && (
                <div className="mt-1 font-mono text-[9px]" style={{ color: b === block && (innerA || innerB) ? '#fbbf24' : 'var(--muted)' }}>
                  {b === block ? `sA=${innerA} sB=${innerB}` : 'sA=0 sB=0'}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Syndrome summary */}
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-edge bg-bg p-3 font-mono text-[11px]">
        <span className="text-muted">syndromes:</span>
        <span className="text-fg">
          inner (bit):{' '}
          <span style={{ color: ph === 'inner' || ph === 'outer' || ph === 'correct' ? (bitDetected !== null ? '#f43f5e' : 'var(--fg)') : 'var(--muted)' }}>
            {ph === 'inner' || ph === 'outer' || ph === 'correct' ? (bitDetected !== null ? `qubit ${bitDetected}` : 'clean') : '—'}
          </span>
        </span>
        <span className="text-fg">
          outer (phase):{' '}
          <span style={{ color: ph === 'outer' || ph === 'correct' ? (phaseDetectedBlock !== null ? '#8b5cf6' : 'var(--fg)') : 'var(--muted)' }}>
            {ph === 'outer' || ph === 'correct' ? (phaseDetectedBlock !== null ? `block ${phaseDetectedBlock}` : 'clean') : '—'}
          </span>
        </span>
      </div>

      {/* Phase tracker */}
      <div className="mt-3 flex gap-1.5">
        {frames.map((f, k) => (
          <button
            key={f.phase}
            type="button"
            onClick={() => seek(k)}
            className="flex-1 rounded px-1 py-1 font-mono text-[10px] transition"
            style={{
              background: k === i ? 'var(--accent)' : 'var(--bg)',
              color: k === i ? 'var(--accent-fg)' : 'var(--muted)',
              border: '1px solid var(--edge)',
            }}
          >
            {PHASE_LABELS[f.phase]}
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

      <div className="mt-4 border-t border-edge pt-4 text-xs text-muted">
        <p className="leading-relaxed">{frame.note}</p>
      </div>
    </div>
  );
}
