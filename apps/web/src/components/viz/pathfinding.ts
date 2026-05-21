export type Grid = {
  rows: number;
  cols: number;
  walls: Set<number>;
  start: number;
  end: number;
};

/** A full search result: the order cells were expanded, plus the final path. */
export type Trace = { order: number[]; path: number[] };

function neighbors(i: number, rows: number, cols: number): number[] {
  const r = Math.floor(i / cols);
  const c = i % cols;
  const out: number[] = [];
  if (r > 0) out.push(i - cols);
  if (r < rows - 1) out.push(i + cols);
  if (c > 0) out.push(i - 1);
  if (c < cols - 1) out.push(i + 1);
  return out;
}

function reconstruct(parent: Map<number, number>, start: number, end: number): number[] {
  const path: number[] = [];
  let cur: number | undefined = end;
  while (cur !== undefined) {
    path.push(cur);
    if (cur === start) return path.reverse();
    cur = parent.get(cur);
  }
  return [];
}

export function bfs(g: Grid): Trace {
  const { rows, cols, walls, start, end } = g;
  const queue: number[] = [start];
  const seen = new Set<number>([start]);
  const parent = new Map<number, number>();
  const order: number[] = [];
  while (queue.length) {
    const cur = queue.shift()!;
    order.push(cur);
    if (cur === end) break;
    for (const n of neighbors(cur, rows, cols)) {
      if (seen.has(n) || walls.has(n)) continue;
      seen.add(n);
      parent.set(n, cur);
      queue.push(n);
    }
  }
  return { order, path: seen.has(end) ? reconstruct(parent, start, end) : [] };
}

export function dfs(g: Grid): Trace {
  const { rows, cols, walls, start, end } = g;
  const stack: number[] = [start];
  const seen = new Set<number>();
  const parent = new Map<number, number>();
  const order: number[] = [];
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    order.push(cur);
    if (cur === end) break;
    for (const n of neighbors(cur, rows, cols)) {
      if (seen.has(n) || walls.has(n)) continue;
      if (!parent.has(n)) parent.set(n, cur);
      stack.push(n);
    }
  }
  return { order, path: seen.has(end) ? reconstruct(parent, start, end) : [] };
}

/** Min-priority pop by a scoring function (small grids — linear scan is fine). */
function popBest(open: number[], score: (i: number) => number): number {
  let best = 0;
  for (let k = 1; k < open.length; k++) {
    if (score(open[k]) < score(open[best])) best = k;
  }
  return open.splice(best, 1)[0];
}

export function dijkstra(g: Grid): Trace {
  const { rows, cols, walls, start, end } = g;
  const dist = new Map<number, number>([[start, 0]]);
  const parent = new Map<number, number>();
  const seen = new Set<number>();
  const order: number[] = [];
  const open: number[] = [start];
  while (open.length) {
    const cur = popBest(open, (i) => dist.get(i) ?? Infinity);
    if (seen.has(cur)) continue;
    seen.add(cur);
    order.push(cur);
    if (cur === end) break;
    for (const n of neighbors(cur, rows, cols)) {
      if (walls.has(n) || seen.has(n)) continue;
      const nd = (dist.get(cur) ?? Infinity) + 1;
      if (nd < (dist.get(n) ?? Infinity)) {
        dist.set(n, nd);
        parent.set(n, cur);
        open.push(n);
      }
    }
  }
  return { order, path: seen.has(end) ? reconstruct(parent, start, end) : [] };
}

export function astar(g: Grid): Trace {
  const { rows, cols, walls, start, end } = g;
  const er = Math.floor(end / cols);
  const ec = end % cols;
  const h = (i: number) => Math.abs(Math.floor(i / cols) - er) + Math.abs((i % cols) - ec);
  const gScore = new Map<number, number>([[start, 0]]);
  const parent = new Map<number, number>();
  const seen = new Set<number>();
  const order: number[] = [];
  const open: number[] = [start];
  while (open.length) {
    const cur = popBest(open, (i) => (gScore.get(i) ?? Infinity) + h(i));
    if (seen.has(cur)) continue;
    seen.add(cur);
    order.push(cur);
    if (cur === end) break;
    for (const n of neighbors(cur, rows, cols)) {
      if (walls.has(n) || seen.has(n)) continue;
      const tentative = (gScore.get(cur) ?? Infinity) + 1;
      if (tentative < (gScore.get(n) ?? Infinity)) {
        gScore.set(n, tentative);
        parent.set(n, cur);
        open.push(n);
      }
    }
  }
  return { order, path: seen.has(end) ? reconstruct(parent, start, end) : [] };
}

export type PathKey = 'bfs' | 'dijkstra' | 'astar' | 'dfs';

export const PATHFINDERS: Record<PathKey, { label: string; fn: (g: Grid) => Trace; note: string }> = {
  bfs: { label: 'BFS', fn: bfs, note: 'Breadth-first search — guarantees the shortest path on an unweighted grid.' },
  dijkstra: { label: 'Dijkstra', fn: dijkstra, note: 'Uniform-cost search — equals BFS here, but generalizes to weighted edges.' },
  astar: { label: 'A*', fn: astar, note: 'Dijkstra plus a Manhattan heuristic — explores toward the goal, so it expands far fewer cells.' },
  dfs: { label: 'DFS', fn: dfs, note: 'Depth-first search — dives deep quickly, but the path it finds is usually not the shortest.' },
};
