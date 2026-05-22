import { useMemo, useState } from 'react';

// Two-class points in a 0..10 x 0..10 space. Tiny + deterministic.
type Pt = { x: number; y: number; c: 0 | 1 };

const DATA: Pt[] = [
  { x: 2.0, y: 2.5, c: 0 }, { x: 3.0, y: 1.5, c: 0 }, { x: 1.5, y: 4.0, c: 0 },
  { x: 3.5, y: 3.0, c: 0 }, { x: 2.5, y: 5.5, c: 0 }, { x: 4.0, y: 4.5, c: 0 },
  { x: 6.5, y: 2.0, c: 1 }, { x: 8.0, y: 1.5, c: 1 }, { x: 7.0, y: 3.5, c: 1 },
  { x: 8.5, y: 3.0, c: 1 }, { x: 6.0, y: 4.0, c: 1 }, { x: 9.0, y: 4.5, c: 1 },
  { x: 2.0, y: 7.5, c: 1 }, { x: 3.5, y: 8.5, c: 1 }, { x: 1.5, y: 9.0, c: 1 },
  { x: 7.5, y: 7.0, c: 0 }, { x: 8.5, y: 8.5, c: 0 }, { x: 6.5, y: 8.0, c: 0 },
  { x: 9.0, y: 7.5, c: 0 }, { x: 7.0, y: 9.0, c: 0 },
];

const DOM = 10;
const COLORS = ['#38bdf8', '#f43f5e']; // class 0 sky, class 1 rose

type Region = { x0: number; x1: number; y0: number; y1: number; pts: Pt[] };
type Node = {
  region: Region;
  axis?: 'x' | 'y';
  thr?: number;
  gini: number;
  pred: 0 | 1;
  left?: Node;
  right?: Node;
  depth: number;
};

const gini = (pts: Pt[]) => {
  if (!pts.length) return 0;
  const p1 = pts.filter((p) => p.c === 1).length / pts.length;
  const p0 = 1 - p1;
  return 1 - p0 * p0 - p1 * p1;
};

const majority = (pts: Pt[]): 0 | 1 => (pts.filter((p) => p.c === 1).length > pts.length / 2 ? 1 : 0);

// Greedy CART: try every midpoint split on x and y, keep the lowest weighted Gini.
function bestSplit(r: Region) {
  let best: { axis: 'x' | 'y'; thr: number; g: number; l: Region; rg: Region } | null = null;
  for (const axis of ['x', 'y'] as const) {
    const vals = [...new Set(r.pts.map((p) => p[axis]))].sort((a, b) => a - b);
    for (let i = 0; i < vals.length - 1; i++) {
      const thr = (vals[i] + vals[i + 1]) / 2;
      const lp = r.pts.filter((p) => p[axis] < thr);
      const rp = r.pts.filter((p) => p[axis] >= thr);
      if (!lp.length || !rp.length) continue;
      const g = (lp.length * gini(lp) + rp.length * gini(rp)) / r.pts.length;
      const l: Region = axis === 'x' ? { ...r, x1: thr, pts: lp } : { ...r, y1: thr, pts: lp };
      const rg: Region = axis === 'x' ? { ...r, x0: thr, pts: rp } : { ...r, y0: thr, pts: rp };
      if (!best || g < best.g - 1e-9) best = { axis, thr, g, l, rg };
    }
  }
  return best;
}

function build(region: Region, depth: number, maxDepth: number): Node {
  const node: Node = { region, gini: gini(region.pts), pred: majority(region.pts), depth };
  if (depth >= maxDepth || node.gini === 0 || region.pts.length < 2) return node;
  const s = bestSplit(region);
  if (!s) return node;
  node.axis = s.axis;
  node.thr = s.thr;
  node.left = build(s.l, depth + 1, maxDepth);
  node.right = build(s.rg, depth + 1, maxDepth);
  return node;
}

function leaves(n: Node): Node[] {
  return n.left && n.right ? [...leaves(n.left), ...leaves(n.right)] : [n];
}

// ---- left panel: feature-space partition ----
const PW = 360;
const PH = 360;
const PAD = 24;
const sx = (x: number) => PAD + (x / DOM) * (PW - 2 * PAD);
const sy = (y: number) => PH - PAD - (y / DOM) * (PH - 2 * PAD);

// ---- right panel: tree diagram (assign x by in-order leaf slot, y by depth) ----
const TW = 360;
const TH = 360;

export default function DecisionTreeVisualizer() {
  const [maxDepth, setMaxDepth] = useState(2);

  const root = useMemo(
    () => build({ x0: 0, x1: DOM, y0: 0, y1: DOM, pts: DATA }, 0, maxDepth),
    [maxDepth],
  );
  const regions = useMemo(() => leaves(root), [root]);

  // lay the tree out: leaves get evenly spaced columns, internal nodes centered over children.
  const layout = useMemo(() => {
    const pos = new Map<Node, { x: number; y: number }>();
    const order: Node[] = [];
    (function collectLeaves(n: Node) {
      if (n.left && n.right) {
        collectLeaves(n.left);
        collectLeaves(n.right);
      } else order.push(n);
    })(root);
    const depthY = (d: number) => 36 + (d / Math.max(maxDepth, 1)) * (TH - 80);
    order.forEach((leaf, i) => {
      pos.set(leaf, { x: ((i + 0.5) / order.length) * (TW - 40) + 20, y: depthY(leaf.depth) });
    });
    (function place(n: Node): number {
      if (n.left && n.right) {
        const lx = place(n.left);
        const rx = place(n.right);
        const x = (lx + rx) / 2;
        pos.set(n, { x, y: depthY(n.depth) });
        return x;
      }
      return pos.get(n)!.x;
    })(root);
    return pos;
  }, [root, maxDepth]);

  const edges: { a: Node; b: Node }[] = [];
  (function walk(n: Node) {
    if (n.left && n.right) {
      edges.push({ a: n, b: n.left });
      edges.push({ a: n, b: n.right });
      walk(n.left);
      walk(n.right);
    }
  })(root);

  const leafCount = regions.length;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-muted">
          max depth = {maxDepth}
          <input type="range" min={0} max={4} step={1} value={maxDepth} onChange={(e) => setMaxDepth(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
        <span className="font-mono text-xs text-muted">
          leaves (regions) = <span className="text-accent">{leafCount}</span>
        </span>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row">
        {/* feature-space partition */}
        <svg viewBox={`0 0 ${PW} ${PH}`} className="mx-auto block w-full max-w-sm" role="img" aria-label="feature space split into regions">
          {regions.map((leaf, i) => {
            const r = leaf.region;
            return (
              <rect
                key={i}
                x={sx(r.x0)}
                y={sy(r.y1)}
                width={sx(r.x1) - sx(r.x0)}
                height={sy(r.y0) - sy(r.y1)}
                fill={COLORS[leaf.pred]}
                fillOpacity={0.14}
                stroke={COLORS[leaf.pred]}
                strokeOpacity={0.5}
                strokeWidth={1}
              />
            );
          })}
          <rect x={PAD} y={PAD} width={PW - 2 * PAD} height={PH - 2 * PAD} fill="none" style={{ stroke: 'var(--border)' }} strokeWidth={1} />
          {DATA.map((p, i) => (
            <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={5} fill={COLORS[p.c]} stroke="var(--bg)" strokeWidth={1.5} />
          ))}
        </svg>

        {/* tree diagram */}
        <svg viewBox={`0 0 ${TW} ${TH}`} className="mx-auto block w-full max-w-sm" role="img" aria-label="decision tree diagram">
          {edges.map((e, i) => {
            const a = layout.get(e.a)!;
            const b = layout.get(e.b)!;
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={{ stroke: 'var(--border)' }} strokeWidth={1.5} />;
          })}
          {[...layout.entries()].map(([n, p], i) => {
            const isLeaf = !(n.left && n.right);
            return (
              <g key={i} transform={`translate(${p.x} ${p.y})`}>
                {isLeaf ? (
                  <rect x={-12} y={-12} width={24} height={24} rx={4} fill={COLORS[n.pred]} stroke="var(--bg)" strokeWidth={2} />
                ) : (
                  <>
                    <circle r={14} fill="var(--surface)" style={{ stroke: 'var(--accent)' }} strokeWidth={2} />
                    <text textAnchor="middle" dy={4} className="font-mono" style={{ fill: 'var(--fg)', fontSize: 9 }}>
                      {n.axis}&lt;{n.thr!.toFixed(1)}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-edge pt-4 text-sm">
        <span className="inline-flex items-center gap-1.5 text-muted">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: COLORS[0] }} /> class A
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: COLORS[1] }} /> class B
        </span>
        <span className="text-muted">Each internal node is a threshold rule; the squares are leaf predictions.</span>
      </div>

      <div className="mt-3 font-mono text-xs text-muted">
        root Gini impurity = {root.gini.toFixed(3)} · deeper trees carve more (and risk overfitting)
      </div>
    </div>
  );
}
