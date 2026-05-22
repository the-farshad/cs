import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

/** A Fitch-style natural-deduction proof PLAYER. Each proof is hand-verified; the
 *  component reveals it line by line with justifications and highlights cited lines.
 *  Notation is modern (¬ ∧ ∨ → ↔ ∀ ∃); Teller's primer writes these as ~ & ∨ ⊃ ≡. */

type Line = { f: string; rule: string; refs: number[]; depth: number; assume?: boolean };
type Proof = { id: string; title: string; seq: string; lines: Line[] };

const PROOFS: Proof[] = [
  {
    id: 'mp-chain',
    title: 'Chaining conditionals',
    seq: 'P → Q,  Q → R,  P  ⊢  R',
    lines: [
      { f: 'P → Q', rule: 'Premise', refs: [], depth: 0 },
      { f: 'Q → R', rule: 'Premise', refs: [], depth: 0 },
      { f: 'P', rule: 'Premise', refs: [], depth: 0 },
      { f: 'Q', rule: '→E 1, 3', refs: [1, 3], depth: 0 },
      { f: 'R', rule: '→E 2, 4', refs: [2, 4], depth: 0 },
    ],
  },
  {
    id: 'conditional-proof',
    title: 'Conditional proof (→I)',
    seq: 'P → Q,  Q → R  ⊢  P → R',
    lines: [
      { f: 'P → Q', rule: 'Premise', refs: [], depth: 0 },
      { f: 'Q → R', rule: 'Premise', refs: [], depth: 0 },
      { f: 'P', rule: 'Assumption', refs: [], depth: 1, assume: true },
      { f: 'Q', rule: '→E 1, 3', refs: [1, 3], depth: 1 },
      { f: 'R', rule: '→E 2, 4', refs: [2, 4], depth: 1 },
      { f: 'P → R', rule: '→I 3–5', refs: [3, 5], depth: 0 },
    ],
  },
  {
    id: 'modus-tollens',
    title: 'Modus tollens (via ¬I)',
    seq: 'P → Q,  ¬Q  ⊢  ¬P',
    lines: [
      { f: 'P → Q', rule: 'Premise', refs: [], depth: 0 },
      { f: '¬Q', rule: 'Premise', refs: [], depth: 0 },
      { f: 'P', rule: 'Assumption', refs: [], depth: 1, assume: true },
      { f: 'Q', rule: '→E 1, 3', refs: [1, 3], depth: 1 },
      { f: '⊥', rule: '¬E 4, 2', refs: [4, 2], depth: 1 },
      { f: '¬P', rule: '¬I 3–5', refs: [3, 5], depth: 0 },
    ],
  },
  {
    id: 'proof-by-cases',
    title: 'Proof by cases (∨E)',
    seq: 'P ∨ Q,  P → R,  Q → R  ⊢  R',
    lines: [
      { f: 'P ∨ Q', rule: 'Premise', refs: [], depth: 0 },
      { f: 'P → R', rule: 'Premise', refs: [], depth: 0 },
      { f: 'Q → R', rule: 'Premise', refs: [], depth: 0 },
      { f: 'P', rule: 'Assumption', refs: [], depth: 1, assume: true },
      { f: 'R', rule: '→E 2, 4', refs: [2, 4], depth: 1 },
      { f: 'Q', rule: 'Assumption', refs: [], depth: 1, assume: true },
      { f: 'R', rule: '→E 3, 6', refs: [3, 6], depth: 1 },
      { f: 'R', rule: '∨E 1, 4–5, 6–7', refs: [1, 4, 5, 6, 7], depth: 0 },
    ],
  },
  {
    id: 'demorgan',
    title: "De Morgan: ¬(P ∨ Q) ⊢ ¬P ∧ ¬Q",
    seq: '¬(P ∨ Q)  ⊢  ¬P ∧ ¬Q',
    lines: [
      { f: '¬(P ∨ Q)', rule: 'Premise', refs: [], depth: 0 },
      { f: 'P', rule: 'Assumption', refs: [], depth: 1, assume: true },
      { f: 'P ∨ Q', rule: '∨I 2', refs: [2], depth: 1 },
      { f: '⊥', rule: '¬E 3, 1', refs: [3, 1], depth: 1 },
      { f: '¬P', rule: '¬I 2–4', refs: [2, 4], depth: 0 },
      { f: 'Q', rule: 'Assumption', refs: [], depth: 1, assume: true },
      { f: 'P ∨ Q', rule: '∨I 6', refs: [6], depth: 1 },
      { f: '⊥', rule: '¬E 7, 1', refs: [7, 1], depth: 1 },
      { f: '¬Q', rule: '¬I 6–8', refs: [6, 8], depth: 0 },
      { f: '¬P ∧ ¬Q', rule: '∧I 5, 9', refs: [5, 9], depth: 0 },
    ],
  },
  {
    id: 'commute-and',
    title: 'Conjunction commutes (∧E, ∧I)',
    seq: 'P ∧ Q  ⊢  Q ∧ P',
    lines: [
      { f: 'P ∧ Q', rule: 'Premise', refs: [], depth: 0 },
      { f: 'P', rule: '∧E 1', refs: [1], depth: 0 },
      { f: 'Q', rule: '∧E 1', refs: [1], depth: 0 },
      { f: 'Q ∧ P', rule: '∧I 3, 2', refs: [3, 2], depth: 0 },
    ],
  },
  {
    id: 'pred-instantiate',
    title: 'Universal instantiation (∀E)',
    seq: '∀x (Px → Qx),  Pa  ⊢  Qa',
    lines: [
      { f: '∀x (Px → Qx)', rule: 'Premise', refs: [], depth: 0 },
      { f: 'Pa', rule: 'Premise', refs: [], depth: 0 },
      { f: 'Pa → Qa', rule: '∀E 1', refs: [1], depth: 0 },
      { f: 'Qa', rule: '→E 3, 2', refs: [3, 2], depth: 0 },
    ],
  },
  {
    id: 'pred-exists',
    title: 'Existential reasoning (∃E, ∃I)',
    seq: '∀x (Px → Qx),  ∃x Px  ⊢  ∃x Qx',
    lines: [
      { f: '∀x (Px → Qx)', rule: 'Premise', refs: [], depth: 0 },
      { f: '∃x Px', rule: 'Premise', refs: [], depth: 0 },
      { f: 'Pa', rule: 'Assumption (a new)', refs: [], depth: 1, assume: true },
      { f: 'Pa → Qa', rule: '∀E 1', refs: [1], depth: 1 },
      { f: 'Qa', rule: '→E 4, 3', refs: [4, 3], depth: 1 },
      { f: '∃x Qx', rule: '∃I 5', refs: [5], depth: 1 },
      { f: '∃x Qx', rule: '∃E 2, 3–6', refs: [2, 3, 6], depth: 0 },
    ],
  },
];

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function NaturalDeductionViz({ proof: initialId = 'conditional-proof' }: { proof?: string }) {
  const [id, setId] = useState(initialId);
  const proof = PROOFS.find((p) => p.id === id) ?? PROOFS[0]!;
  const total = proof.lines.length;
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(total, 2);
  const step = Math.min(index, total - 1);
  const cur = proof.lines[step]!;
  const refs = useMemo(() => new Set(cur.refs), [cur]);

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select value={id} onChange={(e) => setId(e.target.value)} className="rounded border border-edge bg-bg px-2 py-1 text-sm text-fg">
          {PROOFS.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
        <span className="font-mono text-xs text-muted">{proof.seq}</span>
      </div>

      <div className="rounded-lg border border-edge bg-bg/40 p-3">
        {proof.lines.map((ln, i) => {
          const n = i + 1;
          const shown = i <= step;
          const isCur = i === step;
          const isRef = refs.has(n) && !isCur;
          return (
            <div
              key={i}
              className="flex items-stretch gap-2 font-mono text-sm transition"
              style={{ opacity: shown ? 1 : 0.18 }}
            >
              <span className="w-6 shrink-0 text-right text-xs text-muted/70 select-none" style={{ alignSelf: 'center' }}>{n}</span>
              {/* Fitch scope bars */}
              <span className="flex shrink-0" style={{ width: ln.depth * 14 }}>
                {Array.from({ length: ln.depth }, (_, d) => (
                  <span key={d} className="block w-[14px] self-stretch" style={{ borderLeft: '2px solid var(--border)' }} />
                ))}
              </span>
              <span
                className={`flex-1 rounded px-2 py-1 ${ln.assume ? 'border-b border-dashed border-edge' : ''}`}
                style={{
                  background: isCur ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : isRef ? 'rgba(56,189,248,0.12)' : 'transparent',
                  color: 'var(--fg)',
                }}
              >
                {ln.f}
              </span>
              <span className="w-32 shrink-0 self-center text-right text-xs text-muted" style={{ opacity: shown ? 1 : 0 }}>{ln.rule}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={prev} disabled={index <= 0}>
          <Icon name="chevron-left" size={16} /> Prev
        </button>
        <button type="button" onClick={() => (playing ? pause() : play())} className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90">
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Play proof'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= total - 1}>
          Next <Icon name="chevron-right" size={16} />
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
        <input type="range" min={0} max={total - 1} value={index} onChange={(e) => seek(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Timeline" />
        <span className="shrink-0 font-mono text-xs text-muted">line {step + 1}/{total}</span>
      </div>

      <div className="mt-3 border-t border-edge pt-3 text-xs text-muted">
        <span className="font-mono text-fg">{cur.rule}</span>
        {cur.refs.length > 0 ? ` — derived from line${cur.refs.length > 1 ? 's' : ''} ${cur.refs.join(', ')} (highlighted).` : cur.assume ? ' — opens a subderivation; it must be discharged before the proof ends.' : ' — given.'}
      </div>
    </div>
  );
}
