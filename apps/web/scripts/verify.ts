/* Correctness checks for the pure visualizer logic (no React/JSX imported). */
import { SORTS } from '../src/components/viz/sortingAlgorithms';
import { buildTree, searchFrames } from '../src/components/viz/tree';
import { bfs, dfs, dijkstra, astar } from '../src/components/viz/pathfinding';
import { heapInsert, heapExtractMin } from '../src/components/viz/heap';
import { PROBLEMS } from '../src/lib/problems';
import { runJavaScript } from '../src/lib/runners';
import { valueIteration, type Cell } from '../src/components/viz/gridworld';

let pass = 0;
let fail = 0;
const ok = (cond: boolean, name: string) => {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.log('  FAIL:', name);
  }
};
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// --- sorting ---
for (const key of Object.keys(SORTS) as (keyof typeof SORTS)[]) {
  const arr = Array.from({ length: 40 }, () => Math.floor(Math.random() * 200) - 50);
  const frames = Array.from(SORTS[key].gen(arr));
  const out = frames[frames.length - 1].array;
  ok(eq(out, [...arr].sort((a, b) => a - b)), `sort ${key} sorts correctly`);
}

// --- BST / AVL ---
const vals = [50, 30, 70, 20, 40, 60, 80, 10, 25, 35, 45, 5, 90, 1, 100];
const inorder = (n: any, acc: number[]) => {
  if (!n) return;
  inorder(n.left, acc);
  acc.push(n.value);
  inorder(n.right, acc);
};
const heightBalance = (n: any): number => {
  if (!n) return 0;
  const l = heightBalance(n.left);
  const r = heightBalance(n.right);
  if (l < 0 || r < 0 || Math.abs(l - r) > 1) return -1;
  return 1 + Math.max(l, r);
};
for (const avl of [false, true]) {
  const { root } = buildTree(vals, avl);
  const acc: number[] = [];
  inorder(root, acc);
  ok(eq(acc, [...new Set(vals)].sort((a, b) => a - b)), `BST in-order sorted (avl=${avl})`);
  if (avl) ok(heightBalance(root) >= 0, 'AVL stays balanced');
}
{
  const { root } = buildTree(vals, true);
  const found = searchFrames(root, 45);
  ok(found[found.length - 1].nodes.some((n) => n.state === 'found'), 'BST search finds existing value');
  const missing = searchFrames(root, 999);
  ok(!missing[missing.length - 1].nodes.some((n) => n.state === 'found'), 'BST search reports missing value');
}

// --- pathfinding ---
{
  const rows = 6;
  const cols = 6;
  const g = { rows, cols, walls: new Set<number>(), start: 0, end: rows * cols - 1 };
  for (const fn of [bfs, dijkstra, astar]) {
    const t = fn(g);
    ok(t.path.length === rows - 1 + (cols - 1) + 1, `${fn.name} returns shortest path length`);
    ok(t.path[0] === 0 && t.path[t.path.length - 1] === 35, `${fn.name} path connects start and end`);
  }
  const td = dfs(g);
  ok(td.path[0] === 0 && td.path[td.path.length - 1] === 35, 'dfs reaches the end');
  const walls = new Set<number>();
  for (let r = 0; r < rows; r++) walls.add(r * cols + 3);
  ok(bfs({ rows, cols, walls, start: 0, end: 35 }).path.length === 0, 'bfs reports no path when blocked');
}

// --- heap ---
{
  const ins = [5, 3, 8, 1, 9, 2, 7, 4, 6, 0, 12, 11];
  let heap: number[] = [];
  for (const v of ins) {
    const fr = Array.from(heapInsert(heap, v));
    heap = fr[fr.length - 1].array;
  }
  let valid = true;
  for (let i = 0; i < heap.length; i++) {
    const l = 2 * i + 1;
    const r = 2 * i + 2;
    if (l < heap.length && heap[i] > heap[l]) valid = false;
    if (r < heap.length && heap[i] > heap[r]) valid = false;
  }
  ok(valid, 'heap maintains the min-heap property');
  let h = [...heap];
  const order: number[] = [];
  while (h.length) {
    order.push(h[0]);
    const fr = Array.from(heapExtractMin(h));
    h = fr[fr.length - 1].array;
  }
  ok(eq(order, [...ins].sort((a, b) => a - b)), 'heap extract-min yields ascending order');
}

// --- gridworld value iteration ---
{
  const cells: Cell[] = ['empty', 'empty', 'empty', 'goal', 'empty', 'wall', 'empty', 'pit', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'];
  const frames = valueIteration({ rows: 4, cols: 4, cells, gamma: 0.9, step: -0.04, goal: 1, pit: -1 });
  const last = frames[frames.length - 1].values;
  ok(last[3] === 1 && last[7] === -1, 'gridworld terminals stay fixed (+1 / -1)');
  ok(last[2] > last[12], 'gridworld value decreases with distance from the goal');
  ok(last.every((v) => Number.isFinite(v)), 'gridworld values are all finite');
  ok(frames.length > 1 && frames.length <= 51, 'gridworld value iteration converges');
}

// --- problem judge: every JS reference solution must pass its own tests ---
for (const p of PROBLEMS) {
  const sol = p.solutions.find((s) => s.language === 'javascript');
  const res = runJavaScript(sol!.code, p.funcName.javascript, p.tests);
  ok(res.every((r) => r.ok), `JS solution passes its tests: ${p.slug}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
