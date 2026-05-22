import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

/** A Fitch-style natural-deduction PRACTICE player. It shows the problem first —
 *  the given assumptions, the goal, and a strategy hint based on the goal's form —
 *  then reveals a hand-verified proof line by line. Notation is modern
 *  (¬ ∧ ∨ → ↔ ∀ ∃; ⊥ for a contradiction; ¬E: X,¬X ⊢ ⊥; ¬¬E: double-negation
 *  elimination; ⊥E: ex falso). Teller's primer writes the connectives ~ & ∨ ⊃ ≡. */

type Line = { f: string; rule: string; refs: number[]; depth: number; assume?: boolean };
type Proof = { id: string; title: string; group: string; strategy: string; lines: Line[] };

const P = (f: string): Line => ({ f, rule: 'Premise', refs: [], depth: 0 });

const PROOFS: Proof[] = [
  {
    id: 'mp-chain', title: 'Modus ponens, chained', group: 'Sentential · basics',
    strategy: 'The goal R is atomic, so work forward from the premises with →E (modus ponens).',
    lines: [P('P → Q'), P('Q → R'), P('P'),
      { f: 'Q', rule: '→E 1, 3', refs: [1, 3], depth: 0 },
      { f: 'R', rule: '→E 2, 4', refs: [2, 4], depth: 0 }],
  },
  {
    id: 'commute-and', title: 'Conjunction commutes', group: 'Sentential · basics',
    strategy: 'The goal is a conjunction: pull the parts out with ∧E, then recombine with ∧I.',
    lines: [P('P ∧ Q'),
      { f: 'P', rule: '∧E 1', refs: [1], depth: 0 },
      { f: 'Q', rule: '∧E 1', refs: [1], depth: 0 },
      { f: 'Q ∧ P', rule: '∧I 3, 2', refs: [3, 2], depth: 0 }],
  },
  {
    id: 'biconditional', title: 'Using a biconditional', group: 'Sentential · basics',
    strategy: 'A premise is a biconditional: eliminate it (↔E) to the conditional you need, then →E.',
    lines: [P('P ↔ Q'), P('P'),
      { f: 'P → Q', rule: '↔E 1', refs: [1], depth: 0 },
      { f: 'Q', rule: '→E 3, 2', refs: [3, 2], depth: 0 }],
  },
  {
    id: 'conditional-proof', title: 'Hypothetical syllogism (→I)', group: 'Sentential · subderivations',
    strategy: 'The goal is a conditional P → R, so assume P, derive R, then discharge with →I.',
    lines: [P('P → Q'), P('Q → R'),
      { f: 'P', rule: 'Assumption', refs: [], depth: 1, assume: true },
      { f: 'Q', rule: '→E 1, 3', refs: [1, 3], depth: 1 },
      { f: 'R', rule: '→E 2, 4', refs: [2, 4], depth: 1 },
      { f: 'P → R', rule: '→I 3–5', refs: [3, 5], depth: 0 }],
  },
  {
    id: 'weakening', title: 'A premise implies anything implies it', group: 'Sentential · subderivations',
    strategy: 'The goal is a conditional Q → P, so assume Q and just reiterate the premise P.',
    lines: [P('P'),
      { f: 'Q', rule: 'Assumption', refs: [], depth: 1, assume: true },
      { f: 'P', rule: 'Reit 1', refs: [1], depth: 1 },
      { f: 'Q → P', rule: '→I 2–3', refs: [2, 3], depth: 0 }],
  },
  {
    id: 'theorem-pp', title: 'Theorem: ⊢ P → P', group: 'Sentential · subderivations',
    strategy: 'No premises. The goal is a conditional, so assume P and reiterate it (→I).',
    lines: [
      { f: 'P', rule: 'Assumption', refs: [], depth: 1, assume: true },
      { f: 'P', rule: 'Reit 1', refs: [1], depth: 1 },
      { f: 'P → P', rule: '→I 1–2', refs: [1, 2], depth: 0 }],
  },
  {
    id: 'dn-intro', title: 'Double-negation introduction', group: 'Sentential · negation',
    strategy: 'The goal is a negation (¬¬P), so assume ¬P and drive it to a contradiction (¬I).',
    lines: [P('P'),
      { f: '¬P', rule: 'Assumption', refs: [], depth: 1, assume: true },
      { f: '⊥', rule: '¬E 1, 2', refs: [1, 2], depth: 1 },
      { f: '¬¬P', rule: '¬I 2–3', refs: [2, 3], depth: 0 }],
  },
  {
    id: 'modus-tollens', title: 'Modus tollens (reductio)', group: 'Sentential · negation',
    strategy: 'The goal is a negation ¬P, so assume P, reach a contradiction, conclude ¬P (¬I).',
    lines: [P('P → Q'), P('¬Q'),
      { f: 'P', rule: 'Assumption', refs: [], depth: 1, assume: true },
      { f: 'Q', rule: '→E 1, 3', refs: [1, 3], depth: 1 },
      { f: '⊥', rule: '¬E 4, 2', refs: [4, 2], depth: 1 },
      { f: '¬P', rule: '¬I 3–5', refs: [3, 5], depth: 0 }],
  },
  {
    id: 'contraposition', title: 'Contraposition', group: 'Sentential · negation',
    strategy: 'Goal ¬Q → ¬P is a conditional: assume ¬Q, then prove ¬P by a nested reductio.',
    lines: [P('P → Q'),
      { f: '¬Q', rule: 'Assumption', refs: [], depth: 1, assume: true },
      { f: 'P', rule: 'Assumption', refs: [], depth: 2, assume: true },
      { f: 'Q', rule: '→E 1, 3', refs: [1, 3], depth: 2 },
      { f: '⊥', rule: '¬E 4, 2', refs: [4, 2], depth: 2 },
      { f: '¬P', rule: '¬I 3–5', refs: [3, 5], depth: 1 },
      { f: '¬Q → ¬P', rule: '→I 2–6', refs: [2, 6], depth: 0 }],
  },
  {
    id: 'proof-by-cases', title: 'Proof by cases (∨E)', group: 'Sentential · disjunction',
    strategy: 'A premise is a disjunction, so argue by cases (∨E): get R in each case.',
    lines: [P('P ∨ Q'), P('P → R'), P('Q → R'),
      { f: 'P', rule: 'Assumption', refs: [], depth: 1, assume: true },
      { f: 'R', rule: '→E 2, 4', refs: [2, 4], depth: 1 },
      { f: 'Q', rule: 'Assumption', refs: [], depth: 1, assume: true },
      { f: 'R', rule: '→E 3, 6', refs: [3, 6], depth: 1 },
      { f: 'R', rule: '∨E 1, 4–5, 6–7', refs: [1, 4, 5, 6, 7], depth: 0 }],
  },
  {
    id: 'disj-syllogism', title: 'Disjunctive syllogism', group: 'Sentential · disjunction',
    strategy: 'Disjunction premise → cases. The P case contradicts ¬P, so ⊥E gives Q anyway.',
    lines: [P('P ∨ Q'), P('¬P'),
      { f: 'P', rule: 'Assumption', refs: [], depth: 1, assume: true },
      { f: '⊥', rule: '¬E 3, 2', refs: [3, 2], depth: 1 },
      { f: 'Q', rule: '⊥E 4', refs: [4], depth: 1 },
      { f: 'Q', rule: 'Assumption', refs: [], depth: 1, assume: true },
      { f: 'Q', rule: 'Reit 6', refs: [6], depth: 1 },
      { f: 'Q', rule: '∨E 1, 3–5, 6–7', refs: [1, 3, 5, 6, 7], depth: 0 }],
  },
  {
    id: 'constructive-dilemma', title: 'Constructive dilemma', group: 'Sentential · disjunction',
    strategy: 'Disjunction premise → cases; each case yields a disjunct of the goal via ∨I.',
    lines: [P('P ∨ Q'), P('P → R'), P('Q → S'),
      { f: 'P', rule: 'Assumption', refs: [], depth: 1, assume: true },
      { f: 'R', rule: '→E 2, 4', refs: [2, 4], depth: 1 },
      { f: 'R ∨ S', rule: '∨I 5', refs: [5], depth: 1 },
      { f: 'Q', rule: 'Assumption', refs: [], depth: 1, assume: true },
      { f: 'S', rule: '→E 3, 7', refs: [3, 7], depth: 1 },
      { f: 'R ∨ S', rule: '∨I 8', refs: [8], depth: 1 },
      { f: 'R ∨ S', rule: '∨E 1, 4–6, 7–9', refs: [1, 4, 6, 7, 9], depth: 0 }],
  },
  {
    id: 'demorgan', title: "De Morgan: ¬(P ∨ Q) ⊢ ¬P ∧ ¬Q", group: 'Sentential · harder',
    strategy: 'Goal is a conjunction; prove each ¬-conjunct by a reductio, then combine (∧I).',
    lines: [P('¬(P ∨ Q)'),
      { f: 'P', rule: 'Assumption', refs: [], depth: 1, assume: true },
      { f: 'P ∨ Q', rule: '∨I 2', refs: [2], depth: 1 },
      { f: '⊥', rule: '¬E 3, 1', refs: [3, 1], depth: 1 },
      { f: '¬P', rule: '¬I 2–4', refs: [2, 4], depth: 0 },
      { f: 'Q', rule: 'Assumption', refs: [], depth: 1, assume: true },
      { f: 'P ∨ Q', rule: '∨I 6', refs: [6], depth: 1 },
      { f: '⊥', rule: '¬E 7, 1', refs: [7, 1], depth: 1 },
      { f: '¬Q', rule: '¬I 6–8', refs: [6, 8], depth: 0 },
      { f: '¬P ∧ ¬Q', rule: '∧I 5, 9', refs: [5, 9], depth: 0 }],
  },
  {
    id: 'excluded-middle', title: 'Theorem: ⊢ P ∨ ¬P', group: 'Sentential · harder',
    strategy: 'No premises. Assume the negation of the whole goal, reach ⊥, then use ¬¬E.',
    lines: [
      { f: '¬(P ∨ ¬P)', rule: 'Assumption', refs: [], depth: 1, assume: true },
      { f: 'P', rule: 'Assumption', refs: [], depth: 2, assume: true },
      { f: 'P ∨ ¬P', rule: '∨I 2', refs: [2], depth: 2 },
      { f: '⊥', rule: '¬E 3, 1', refs: [3, 1], depth: 2 },
      { f: '¬P', rule: '¬I 2–4', refs: [2, 4], depth: 1 },
      { f: 'P ∨ ¬P', rule: '∨I 5', refs: [5], depth: 1 },
      { f: '⊥', rule: '¬E 6, 1', refs: [6, 1], depth: 1 },
      { f: '¬¬(P ∨ ¬P)', rule: '¬I 1–7', refs: [1, 7], depth: 0 },
      { f: 'P ∨ ¬P', rule: '¬¬E 8', refs: [8], depth: 0 }],
  },
  {
    id: 'pred-instantiate', title: 'Universal instantiation (∀E)', group: 'Predicate',
    strategy: 'A premise is universal: instantiate it to the name a (∀E), then →E.',
    lines: [P('∀x (Px → Qx)'), P('Pa'),
      { f: 'Pa → Qa', rule: '∀E 1', refs: [1], depth: 0 },
      { f: 'Qa', rule: '→E 3, 2', refs: [3, 2], depth: 0 }],
  },
  {
    id: 'pred-universal', title: 'Universal generalization (∀I)', group: 'Predicate',
    strategy: 'Goal is universal: prove it of an arbitrary name a, then generalize with ∀I.',
    lines: [P('∀x Px'),
      { f: 'Pa', rule: '∀E 1', refs: [1], depth: 0 },
      { f: 'Pa ∨ Qa', rule: '∨I 2', refs: [2], depth: 0 },
      { f: '∀x (Px ∨ Qx)', rule: '∀I 3 (a arbitrary)', refs: [3], depth: 0 }],
  },
  {
    id: 'pred-exists', title: 'Existential reasoning (∃E, ∃I)', group: 'Predicate',
    strategy: 'An ∃ premise: open a subderivation with a fresh name, derive the goal, export with ∃E.',
    lines: [P('∀x (Px → Qx)'), P('∃x Px'),
      { f: 'Pa', rule: 'Assumption (a new)', refs: [], depth: 1, assume: true },
      { f: 'Pa → Qa', rule: '∀E 1', refs: [1], depth: 1 },
      { f: 'Qa', rule: '→E 4, 3', refs: [4, 3], depth: 1 },
      { f: '∃x Qx', rule: '∃I 5', refs: [5], depth: 1 },
      { f: '∃x Qx', rule: '∃E 2, 3–6', refs: [2, 3, 6], depth: 0 }],
  },
];

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function NaturalDeductionViz({ proof: initialId = 'conditional-proof' }: { proof?: string }) {
  const [id, setId] = useState(initialId);
  const [solved, setSolved] = useState(false);
  const proof = PROOFS.find((p) => p.id === id) ?? PROOFS[0]!;
  const total = proof.lines.length;
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(total, 2);
  const step = Math.min(index, total - 1);
  const cur = proof.lines[step]!;
  const refs = useMemo(() => new Set(cur.refs), [cur]);

  const premises = proof.lines.filter((l) => l.rule === 'Premise').map((l) => l.f);
  const goal = proof.lines[total - 1]!.f;

  const pickProof = (newId: string) => {
    setId(newId);
    setSolved(false);
    seek(0);
  };

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3">
        <select value={id} onChange={(e) => pickProof(e.target.value)} className="w-full rounded border border-edge bg-bg px-2 py-1 text-sm text-fg sm:w-auto">
          {Array.from(new Set(PROOFS.map((p) => p.group))).map((g) => (
            <optgroup key={g} label={g}>
              {PROOFS.filter((p) => p.group === g).map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* The problem: assumptions + goal + strategy, shown before the solution */}
      <div className="rounded-lg border border-edge bg-bg/40 p-3 text-sm">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-xs tracking-wide text-muted uppercase">Given</span>
          {premises.length ? (
            premises.map((p, i) => <span key={i} className="rounded border border-edge px-2 py-0.5 font-mono text-fg">{p}</span>)
          ) : (
            <span className="text-muted">no premises — this is a theorem</span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
          <span className="text-xs tracking-wide text-muted uppercase">Prove</span>
          <span className="rounded px-2 py-0.5 font-mono font-medium" style={{ background: 'color-mix(in srgb, var(--accent) 16%, transparent)', color: 'var(--fg)' }}>{goal}</span>
        </div>
        <div className="mt-2 text-xs text-muted">
          <span className="text-accent">Strategy:</span> {proof.strategy}
        </div>
      </div>

      {!solved ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => { setSolved(true); seek(0); }} className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg transition hover:opacity-90">
            <Icon name="check" size={16} /> Show solution
          </button>
          <span className="text-xs text-muted">Try the derivation yourself first, then reveal the step-by-step proof.</span>
        </div>
      ) : (
        <>
          <div className="mt-3 rounded-lg border border-edge bg-bg/40 p-3">
            {proof.lines.map((ln, i) => {
              const n = i + 1;
              const shown = i <= step;
              const isCur = i === step;
              const isRef = refs.has(n) && !isCur;
              return (
                <div key={i} className="flex items-stretch gap-2 font-mono text-sm" style={{ opacity: shown ? 1 : 0.18 }}>
                  <span className="w-6 shrink-0 self-center text-right text-xs text-muted/70 select-none">{n}</span>
                  <span className="flex shrink-0" style={{ width: ln.depth * 14 }}>
                    {Array.from({ length: ln.depth }, (_, d) => (
                      <span key={d} className="block w-[14px] self-stretch" style={{ borderLeft: '2px solid var(--border)' }} />
                    ))}
                  </span>
                  <span className={`flex-1 rounded px-2 py-1 ${ln.assume ? 'border-b border-dashed border-edge' : ''}`} style={{ background: isCur ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : isRef ? 'rgba(56,189,248,0.12)' : 'transparent', color: 'var(--fg)' }}>
                    {ln.f}
                  </span>
                  <span className="w-32 shrink-0 self-center text-right text-xs text-muted" style={{ opacity: shown ? 1 : 0 }}>{ln.rule}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" className={btn} onClick={prev} disabled={index <= 0}><Icon name="chevron-left" size={16} /> Prev</button>
            <button type="button" onClick={() => (playing ? pause() : play())} className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90">
              <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Play proof'}
            </button>
            <button type="button" className={btn} onClick={next} disabled={index >= total - 1}>Next <Icon name="chevron-right" size={16} /></button>
            <button type="button" className={btn} onClick={() => { setSolved(false); reset(); }}>Hide</button>
            <label className="ml-auto flex items-center gap-2 text-sm text-muted">Speed
              <input type="range" min={1} max={6} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
            </label>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <input type="range" min={0} max={total - 1} value={index} onChange={(e) => seek(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Timeline" />
            <span className="shrink-0 font-mono text-xs text-muted">line {step + 1}/{total}</span>
          </div>
          <div className="mt-3 border-t border-edge pt-3 text-xs text-muted">
            <span className="font-mono text-fg">{cur.rule}</span>
            {cur.refs.length > 0 ? ` — from line${cur.refs.length > 1 ? 's' : ''} ${cur.refs.join(', ')} (highlighted).` : cur.assume ? ' — opens a subderivation; it must be discharged before the proof ends.' : ' — given.'}
          </div>
        </>
      )}
    </div>
  );
}
