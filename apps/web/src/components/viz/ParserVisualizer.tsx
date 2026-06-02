import { useMemo, useState } from 'react';
import TreeCanvas, { type VizNode, type VizEdge } from './TreeCanvas';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// ---- AST ----
type Num = { kind: 'num'; value: number; id: number };
type Bin = { kind: 'bin'; op: string; left: Node; right: Node; id: number };
type Node = Num | Bin;

type Tok = { type: 'num' | 'op' | 'lparen' | 'rparen'; text: string };

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ') {
      i++;
      continue;
    }
    if (c >= '0' && c <= '9') {
      let j = i;
      while (j < src.length && src[j] >= '0' && src[j] <= '9') j++;
      toks.push({ type: 'num', text: src.slice(i, j) });
      i = j;
      continue;
    }
    if ('+-*/'.includes(c)) {
      toks.push({ type: 'op', text: c });
      i++;
      continue;
    }
    if (c === '(') {
      toks.push({ type: 'lparen', text: c });
      i++;
      continue;
    }
    if (c === ')') {
      toks.push({ type: 'rparen', text: c });
      i++;
      continue;
    }
    i++; // skip unknown
  }
  return toks;
}

// Each step reveals one more node of the final tree (in the order the parser
// creates them) and explains what just happened.
type Step = { note: string; revealId: number | null };

// Recursive-descent parser. It builds the complete AST and records, in creation
// order, the node revealed at each step. Frames then disclose the final tree one
// node at a time over a fixed layout, so nodes appear in place without jumping.
// Grammar:  expr := term (('+' | '-') term)*   term := factor (('*' | '/') factor)*
//           factor := NUMBER | '(' expr ')'
function parse(toks: Tok[]): { steps: Step[]; root: Node | null; ok: boolean } {
  const steps: Step[] = [];
  let pos = 0;
  let nextId = 0;
  let failed = false;

  const peek = () => toks[pos];

  function factor(): Node {
    const t = peek();
    if (!t) {
      failed = true;
      return { kind: 'num', value: 0, id: nextId++ };
    }
    if (t.type === 'lparen') {
      steps.push({ note: 'See "(" — parse a parenthesized sub-expression (it raises precedence).', revealId: null });
      pos++; // consume (
      const e = expr();
      if (peek()?.type === 'rparen') pos++; // consume )
      else failed = true;
      return e;
    }
    if (t.type === 'num') {
      pos++;
      const node: Num = { kind: 'num', value: Number(t.text), id: nextId++ };
      steps.push({ note: `factor: read NUMBER ${t.text} → leaf node.`, revealId: node.id });
      return node;
    }
    failed = true;
    return { kind: 'num', value: 0, id: nextId++ };
  }

  function term(): Node {
    let left = factor();
    while (peek()?.type === 'op' && (peek()!.text === '*' || peek()!.text === '/')) {
      const op = peek()!.text;
      pos++;
      const right = factor();
      const node: Bin = { kind: 'bin', op, left, right, id: nextId++ };
      steps.push({ note: `term: bind '${op}' tighter — make a '${op}' node over the two factors.`, revealId: node.id });
      left = node;
    }
    return left;
  }

  function expr(): Node {
    let left = term();
    while (peek()?.type === 'op' && (peek()!.text === '+' || peek()!.text === '-')) {
      const op = peek()!.text;
      pos++;
      const right = term();
      const node: Bin = { kind: 'bin', op, left, right, id: nextId++ };
      steps.push({ note: `expr: combine with '${op}' — lowest precedence, so it sits near the root.`, revealId: node.id });
      left = node;
    }
    return left;
  }

  steps.push({ note: 'Start: call expr() — the lowest-precedence rule first.', revealId: null });
  const tree = expr();
  steps.push({
    note: failed ? 'Parse error — check the expression.' : 'Done. The tree shape encodes precedence: deeper nodes bind tighter.',
    revealId: null,
  });
  return { steps, root: failed ? null : tree, ok: !failed };
}

// ---- Layout: positions come from the FINAL tree (x by in-order slot, y by
// depth) so they never move; only the `visible` nodes are emitted, which makes
// the tree grow in place as the parser reveals nodes. ----
function layout(
  root: Node | null,
  visible: Set<number>,
  activeId: number | null,
): { nodes: VizNode[]; edges: VizEdge[]; width: number; height: number } {
  if (!root) return { nodes: [], edges: [], width: 640, height: 80 };
  const nodes: VizNode[] = [];
  const edges: VizEdge[] = [];
  let col = 0;
  const colW = 64;
  const rowH = 78;

  const walk = (n: Node, depth: number): { x: number } => {
    let x: number;
    if (n.kind === 'num') {
      x = col * colW + 40;
      col++;
    } else {
      const l = walk(n.left, depth + 1);
      col++; // reserve a column slot for the operator between its children
      const r = walk(n.right, depth + 1);
      x = (l.x + r.x) / 2;
      if (visible.has(n.id) && visible.has(n.left.id)) edges.push({ from: n.id, to: n.left.id });
      if (visible.has(n.id) && visible.has(n.right.id)) edges.push({ from: n.id, to: n.right.id });
    }
    if (visible.has(n.id)) {
      nodes.push({
        id: n.id,
        x,
        y: depth * rowH + 36,
        label: n.kind === 'num' ? String(n.value) : n.op,
        state: n.id === activeId ? 'active' : n.kind === 'num' ? 'default' : 'rotated',
      });
    }
    return { x };
  };

  const depthOf = (n: Node): number => (n.kind === 'num' ? 1 : 1 + Math.max(depthOf(n.left), depthOf(n.right)));
  walk(root, 0);
  const width = Math.max(col * colW + 40, 320);
  const height = depthOf(root) * rowH + 24;
  return { nodes, edges, width, height };
}

const SAMPLES = ['2 + 3 * 4', '(2 + 3) * 4', '10 - 4 - 2', '2 * 3 + 4 * 5'];

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function ParserVisualizer() {
  const [src, setSrc] = useState(SAMPLES[0]);
  const { steps, root } = useMemo(() => parse(tokenize(src)), [src]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset } = useStepper(steps.length, 2);
  const i = Math.min(index, steps.length - 1);
  const step = steps[i];

  const { nodes, edges, width, height } = useMemo(() => {
    const visible = new Set<number>();
    for (let k = 0; k <= i; k++) {
      const id = steps[k].revealId;
      if (id !== null) visible.add(id);
    }
    return layout(root, visible, step.revealId);
  }, [root, steps, i, step]);

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {SAMPLES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSrc(s)}
            className={`rounded border px-2 py-0.5 font-mono text-xs transition ${
              s === src ? 'border-accent text-accent' : 'border-edge text-muted hover:border-accent hover:text-accent'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mb-3 rounded-lg border border-edge bg-bg p-3 text-center font-mono text-lg text-fg">{src}</div>

      <div className="rounded-lg border border-edge bg-bg p-3">
        {nodes.length === 0 ? (
          <div className="py-8 text-center font-mono text-sm text-muted/60">tree is empty — step forward</div>
        ) : (
          <TreeCanvas nodes={nodes} edges={edges} width={width} height={height} r={17} />
        )}
      </div>

      <div className="mt-3 min-h-[1.5rem] font-mono text-sm text-muted">{step.note}</div>

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
          <input type="range" min={1} max={10} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>
    </div>
  );
}
