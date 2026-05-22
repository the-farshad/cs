/** Unit tests for the propositional-logic engine. Run: npx tsx scripts/check-logic.ts */
import { argument, truthTable } from '../src/components/viz/logic';

let fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
  if (!ok) fail++;
};

// Classifications
eq('P → P is a tautology', truthTable('P → P').classification, 'tautology');
eq('P ∨ ¬P is a tautology', truthTable('P ∨ ¬P').classification, 'tautology');
eq('P ∧ ¬P is a contradiction', truthTable('P ∧ ¬P').classification, 'contradiction');
eq('P ∧ Q is contingent', truthTable('P ∧ Q').classification, 'contingent');
eq('((P → Q) ∧ P) → Q is a tautology (modus ponens)', truthTable('((P → Q) ∧ P) → Q').classification, 'tautology');
eq('((P → Q) ∧ ¬Q) → ¬P is a tautology (modus tollens)', truthTable('((P → Q) ∧ ¬Q) → ¬P').classification, 'tautology');
eq('De Morgan ¬(P ∧ Q) ↔ (¬P ∨ ¬Q) is a tautology', truthTable('¬(P ∧ Q) ↔ (¬P ∨ ¬Q)').classification, 'tautology');
eq('ASCII: (P -> Q) <-> (~P | Q) tautology', truthTable('(P -> Q) <-> (~P | Q)').classification, 'tautology');

// Implication is right-associative: P → P → P should be a tautology (P → (P → P))
eq('P → P → P is a tautology (right-assoc)', truthTable('P → P → P').classification, 'tautology');

// Argument validity
eq('modus ponens {P→Q, P} ⊨ Q valid', argument(['P → Q', 'P'], 'Q').valid, true);
eq('affirming the consequent {P→Q, Q} ⊨ P invalid', argument(['P → Q', 'Q'], 'P').valid, false);
eq('disjunctive syllogism {P∨Q, ¬P} ⊨ Q valid', argument(['P ∨ Q', '¬P'], 'Q').valid, true);
eq('hypothetical syllogism {P→Q, Q→R} ⊨ P→R valid', argument(['P → Q', 'Q → R'], 'P → R').valid, true);
eq('denying antecedent {P→Q, ¬P} ⊨ ¬Q invalid', argument(['P → Q', '¬P'], '¬Q').valid, false);

// Row counts
eq('2 vars -> 4 rows', truthTable('P ∧ Q').rows.length, 4);
eq('3 vars -> 8 rows', truthTable('P ∧ Q ∧ R').rows.length, 8);

console.log(fail ? `\n${fail} FAILED` : '\nAll logic-engine tests pass');
process.exit(fail ? 1 : 0);
