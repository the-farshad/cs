/** A small, correct propositional-logic engine: parse a well-formed formula,
 *  evaluate it under an assignment, build truth tables, and test argument validity.
 *  Connectives (precedence high→low): ¬ , ∧ , ∨ , → (right-assoc) , ↔ .
 *  ASCII input is accepted too: ~ ! for ¬, & for ∧, | for ∨, -> for →, <-> for ↔. */

export type Node =
  | { t: 'var'; name: string }
  | { t: 'not'; a: Node }
  | { t: 'and'; a: Node; b: Node }
  | { t: 'or'; a: Node; b: Node }
  | { t: 'imp'; a: Node; b: Node }
  | { t: 'iff'; a: Node; b: Node };

function tokenize(input: string): string[] {
  const s = input.replace(/<->|<=>/g, '↔').replace(/->|=>|⊃/g, '→');
  const toks: string[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    if (c === '(' || c === ')') { toks.push(c); i++; continue; }
    if (c === '¬' || c === '~' || c === '!') { toks.push('¬'); i++; continue; }
    if (c === '∧' || c === '&') { toks.push('∧'); i++; continue; }
    if (c === '∨' || c === '|') { toks.push('∨'); i++; continue; }
    if (c === '→') { toks.push('→'); i++; continue; }
    if (c === '↔') { toks.push('↔'); i++; continue; }
    if (/[A-Za-z]/.test(c)) {
      let j = i + 1;
      while (j < s.length && /[A-Za-z0-9]/.test(s[j]!)) j++;
      toks.push(s.slice(i, j));
      i = j;
      continue;
    }
    throw new Error(`unexpected character "${c}"`);
  }
  return toks;
}

/** Parse a formula into an AST, or throw on a syntax error. */
export function parse(input: string): Node {
  const toks = tokenize(input);
  let pos = 0;
  const peek = (): string | undefined => toks[pos];
  const eat = (expected?: string): void => {
    const x = toks[pos];
    if (expected && x !== expected) throw new Error(`expected "${expected}"`);
    pos++;
  };

  const parseIff = (): Node => {
    let n = parseImp();
    while (peek() === '↔') { eat(); n = { t: 'iff', a: n, b: parseImp() }; }
    return n;
  };
  const parseImp = (): Node => {
    const a = parseOr();
    if (peek() === '→') { eat(); return { t: 'imp', a, b: parseImp() }; } // right-associative
    return a;
  };
  const parseOr = (): Node => {
    let n = parseAnd();
    while (peek() === '∨') { eat(); n = { t: 'or', a: n, b: parseAnd() }; }
    return n;
  };
  const parseAnd = (): Node => {
    let n = parseNot();
    while (peek() === '∧') { eat(); n = { t: 'and', a: n, b: parseNot() }; }
    return n;
  };
  const parseNot = (): Node => {
    if (peek() === '¬') { eat(); return { t: 'not', a: parseNot() }; }
    return parseAtom();
  };
  const parseAtom = (): Node => {
    const x = peek();
    if (x === '(') { eat('('); const n = parseIff(); eat(')'); return n; }
    if (x && /^[A-Za-z][A-Za-z0-9]*$/.test(x)) { eat(); return { t: 'var', name: x }; }
    throw new Error(`unexpected token "${x ?? 'end of input'}"`);
  };

  const node = parseIff();
  if (pos !== toks.length) throw new Error('unexpected trailing input');
  return node;
}

export function evaluate(n: Node, env: Record<string, boolean>): boolean {
  switch (n.t) {
    case 'var': return env[n.name] === true;
    case 'not': return !evaluate(n.a, env);
    case 'and': return evaluate(n.a, env) && evaluate(n.b, env);
    case 'or': return evaluate(n.a, env) || evaluate(n.b, env);
    case 'imp': return !evaluate(n.a, env) || evaluate(n.b, env);
    case 'iff': return evaluate(n.a, env) === evaluate(n.b, env);
  }
}

export function variables(...nodes: Node[]): string[] {
  const set = new Set<string>();
  const walk = (x: Node): void => {
    if (x.t === 'var') set.add(x.name);
    else if (x.t === 'not') walk(x.a);
    else { walk(x.a); walk(x.b); }
  };
  nodes.forEach(walk);
  return [...set].sort();
}

/** Every assignment over `vars`, in standard top-to-bottom truth-table order (T first). */
export function assignments(vars: string[]): Record<string, boolean>[] {
  const rows: Record<string, boolean>[] = [];
  const total = 1 << vars.length;
  for (let i = 0; i < total; i++) {
    const env: Record<string, boolean> = {};
    vars.forEach((v, k) => {
      env[v] = (i & (1 << (vars.length - 1 - k))) === 0; // leftmost var toggles slowest, T before F
    });
    rows.push(env);
  }
  return rows;
}

export type Classification = 'tautology' | 'contradiction' | 'contingent';

export function truthTable(formula: string): {
  vars: string[];
  rows: { env: Record<string, boolean>; value: boolean }[];
  classification: Classification;
} {
  const ast = parse(formula);
  const vars = variables(ast);
  const rows = assignments(vars).map((env) => ({ env, value: evaluate(ast, env) }));
  const allTrue = rows.every((r) => r.value);
  const allFalse = rows.every((r) => !r.value);
  return { vars, rows, classification: allTrue ? 'tautology' : allFalse ? 'contradiction' : 'contingent' };
}

export function argument(premises: string[], conclusion: string): {
  vars: string[];
  rows: { env: Record<string, boolean>; premiseVals: boolean[]; conclusionVal: boolean; counterexample: boolean }[];
  valid: boolean;
} {
  const premAsts = premises.map(parse);
  const concAst = parse(conclusion);
  const vars = variables(...premAsts, concAst);
  let valid = true;
  const rows = assignments(vars).map((env) => {
    const premiseVals = premAsts.map((p) => evaluate(p, env));
    const conclusionVal = evaluate(concAst, env);
    const counterexample = premiseVals.every(Boolean) && !conclusionVal;
    if (counterexample) valid = false;
    return { env, premiseVals, conclusionVal, counterexample };
  });
  return { vars, rows, valid };
}
