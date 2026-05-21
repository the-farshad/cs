export type Cell = 'empty' | 'wall' | 'goal' | 'pit';
export type GridSpec = { rows: number; cols: number; cells: Cell[]; gamma: number; step: number; goal: number; pit: number };
export type VIFrame = { values: number[]; policy: number[] };

// up, down, left, right
const D = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/** Value iteration on a deterministic gridworld MDP. Returns one frame per
 *  sweep (state values + greedy policy), stopping early on convergence. */
export function valueIteration(spec: GridSpec, iterations = 50, eps = 1e-4): VIFrame[] {
  const { rows, cols, cells, gamma, step, goal, pit } = spec;
  const n = rows * cols;
  const isTerm = (i: number) => cells[i] === 'goal' || cells[i] === 'pit';
  const termVal = (i: number) => (cells[i] === 'goal' ? goal : cells[i] === 'pit' ? pit : 0);
  const move = (i: number, a: number) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const nr = r + D[a][0];
    const nc = c + D[a][1];
    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return i;
    const ni = nr * cols + nc;
    return cells[ni] === 'wall' ? i : ni;
  };

  const greedy = (V: number[]): number[] =>
    cells.map((c, i) => {
      if (isTerm(i) || c === 'wall') return -1;
      let best = 0;
      let bv = -Infinity;
      for (let a = 0; a < 4; a++) {
        const v = V[move(i, a)];
        if (v > bv) {
          bv = v;
          best = a;
        }
      }
      return best;
    });

  let V = cells.map((_, i) => (isTerm(i) ? termVal(i) : 0));
  const frames: VIFrame[] = [{ values: [...V], policy: greedy(V) }];

  for (let k = 0; k < iterations; k++) {
    const nV = [...V];
    let delta = 0;
    for (let i = 0; i < n; i++) {
      if (isTerm(i) || cells[i] === 'wall') continue;
      let best = -Infinity;
      for (let a = 0; a < 4; a++) best = Math.max(best, V[move(i, a)]);
      nV[i] = step + gamma * best;
      delta = Math.max(delta, Math.abs(nV[i] - V[i]));
    }
    V = nV;
    frames.push({ values: [...V], policy: greedy(V) });
    if (delta < eps) break;
  }
  return frames;
}
