import type { VizNode, VizEdge } from './TreeCanvas';

export type TreeFrame = { nodes: VizNode[]; edges: VizEdge[]; width: number; height: number };

export type BSTNode = {
  id: number;
  value: number;
  left: BSTNode | null;
  right: BSTNode | null;
  parent: BSTNode | null;
  height: number;
};

const WIDTH = 760;
const LEVEL = 64;
const TOP = 28;

const h = (n: BSTNode | null): number => (n ? n.height : 0);
const updateHeight = (n: BSTNode) => {
  n.height = 1 + Math.max(h(n.left), h(n.right));
};
const balance = (n: BSTNode): number => h(n.left) - h(n.right);
const rootOf = (n: BSTNode): BSTNode => {
  let c = n;
  while (c.parent) c = c.parent;
  return c;
};

function layout(root: BSTNode | null, marks: Record<number, string> = {}): TreeFrame {
  const nodes: VizNode[] = [];
  const edges: VizEdge[] = [];
  if (!root) return { nodes, edges, width: WIDTH, height: TOP * 2 };

  const order: { node: BSTNode; depth: number }[] = [];
  let maxDepth = 0;
  const walk = (n: BSTNode | null, depth: number) => {
    if (!n) return;
    walk(n.left, depth + 1);
    order.push({ node: n, depth });
    maxDepth = Math.max(maxDepth, depth);
    walk(n.right, depth + 1);
  };
  walk(root, 0);

  const count = order.length;
  const pos = new Map<number, { x: number; y: number }>();
  order.forEach((o, i) => {
    pos.set(o.node.id, { x: ((i + 0.5) / count) * WIDTH, y: TOP + o.depth * LEVEL });
  });
  for (const { node } of order) {
    const p = pos.get(node.id)!;
    nodes.push({ id: node.id, x: p.x, y: p.y, label: String(node.value), state: marks[node.id] });
    if (node.left) edges.push({ from: node.id, to: node.left.id });
    if (node.right) edges.push({ from: node.id, to: node.right.id });
  }
  return { nodes, edges, width: WIDTH, height: TOP * 2 + maxDepth * LEVEL };
}

function rotateRight(y: BSTNode): BSTNode {
  const x = y.left!;
  y.left = x.right;
  if (x.right) x.right.parent = y;
  x.right = y;
  x.parent = y.parent;
  if (y.parent) {
    if (y.parent.left === y) y.parent.left = x;
    else y.parent.right = x;
  }
  y.parent = x;
  updateHeight(y);
  updateHeight(x);
  return x;
}

function rotateLeft(x: BSTNode): BSTNode {
  const y = x.right!;
  x.right = y.left;
  if (y.left) y.left.parent = x;
  y.left = x;
  y.parent = x.parent;
  if (x.parent) {
    if (x.parent.left === x) x.parent.left = y;
    else x.parent.right = y;
  }
  x.parent = y;
  updateHeight(x);
  updateHeight(y);
  return y;
}

export function buildTree(values: number[], avl: boolean): { frames: TreeFrame[]; root: BSTNode | null } {
  const frames: TreeFrame[] = [];
  let root: BSTNode | null = null;
  let idc = 0;
  const snap = (marks: Record<number, string> = {}) => frames.push(layout(root, marks));
  snap();

  for (const value of values) {
    if (!root) {
      root = { id: idc++, value, left: null, right: null, parent: null, height: 1 };
      snap({ [root.id]: 'active' });
      continue;
    }
    let cur: BSTNode = root;
    let inserted: BSTNode | null = null;
    while (true) {
      snap({ [cur.id]: 'compare' });
      if (value === cur.value) {
        snap({ [cur.id]: 'found' });
        break;
      }
      if (value < cur.value) {
        if (cur.left) cur = cur.left;
        else {
          inserted = { id: idc++, value, left: null, right: null, parent: cur, height: 1 };
          cur.left = inserted;
          snap({ [inserted.id]: 'active' });
          break;
        }
      } else {
        if (cur.right) cur = cur.right;
        else {
          inserted = { id: idc++, value, left: null, right: null, parent: cur, height: 1 };
          cur.right = inserted;
          snap({ [inserted.id]: 'active' });
          break;
        }
      }
    }

    if (avl && inserted) {
      let n: BSTNode | null = inserted.parent;
      while (n) {
        updateHeight(n);
        const bf = balance(n);
        if (bf > 1 || bf < -1) {
          let sub: BSTNode;
          if (bf > 1 && value < n.left!.value) sub = rotateRight(n);
          else if (bf > 1) {
            rotateLeft(n.left!);
            sub = rotateRight(n);
          } else if (bf < -1 && value > n.right!.value) sub = rotateLeft(n);
          else {
            rotateRight(n.right!);
            sub = rotateLeft(n);
          }
          root = rootOf(sub);
          snap({ [sub.id]: 'rotated' });
          break;
        }
        n = n.parent;
      }
    }
  }
  snap();
  return { frames, root };
}

export function searchFrames(root: BSTNode | null, target: number): TreeFrame[] {
  const frames: TreeFrame[] = [];
  const snap = (marks: Record<number, string> = {}) => frames.push(layout(root, marks));
  snap();
  let cur = root;
  while (cur) {
    snap({ [cur.id]: 'compare' });
    if (target === cur.value) {
      snap({ [cur.id]: 'found' });
      return frames;
    }
    cur = target < cur.value ? cur.left : cur.right;
  }
  snap();
  return frames;
}
