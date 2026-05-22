import { useMemo, useState } from 'react';

// Fixed noisy sample of an underlying gentle curve on x in [0,1]. Deterministic.
// "True" signal ~ sin-ish bump; noise baked in once so the fit is reproducible.
const DATA: { x: number; y: number }[] = [
  { x: 0.03, y: 0.34 }, { x: 0.11, y: 0.62 }, { x: 0.19, y: 0.58 },
  { x: 0.27, y: 0.86 }, { x: 0.34, y: 0.74 }, { x: 0.42, y: 0.95 },
  { x: 0.5, y: 0.78 }, { x: 0.58, y: 0.66 }, { x: 0.66, y: 0.42 },
  { x: 0.74, y: 0.31 }, { x: 0.82, y: 0.08 }, { x: 0.9, y: 0.18 },
  { x: 0.97, y: -0.04 },
];

const W = 520;
const H = 340;
const PAD = 34;
const XMIN = 0;
const XMAX = 1;
const YMIN = -0.4;
const YMAX = 1.25;

// Solve (XᵀX + λI) w = Xᵀy via Gaussian elimination. Tiny systems → fine.
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col] || 1e-12;
    for (let c = col; c <= n; c++) M[col][c] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row) => row[n]);
}

// Ridge-regularized polynomial least squares. lambda = 0 → ordinary least squares.
function fitPoly(degree: number, lambda: number): number[] {
  const m = degree + 1;
  const XtX = Array.from({ length: m }, () => new Array(m).fill(0));
  const Xty = new Array(m).fill(0);
  for (const { x, y } of DATA) {
    const powers = Array.from({ length: m }, (_, j) => x ** j);
    for (let i = 0; i < m; i++) {
      Xty[i] += powers[i] * y;
      for (let j = 0; j < m; j++) XtX[i][j] += powers[i] * powers[j];
    }
  }
  // penalize all weights except the bias term (j = 0)
  for (let j = 1; j < m; j++) XtX[j][j] += lambda;
  return solve(XtX, Xty);
}

const evalPoly = (w: number[], x: number) => w.reduce((s, c, j) => s + c * x ** j, 0);

export default function RegularizationVisualizer() {
  const [degree, setDegree] = useState(9);
  // store lambda on a log slider: actual λ = 10^t
  const [logLambda, setLogLambda] = useState(-6);
  const lambda = logLambda <= -6 ? 0 : 10 ** logLambda;

  const w = useMemo(() => fitPoly(degree, lambda), [degree, lambda]);

  const toPx = (x: number) => PAD + ((x - XMIN) / (XMAX - XMIN)) * (W - 2 * PAD);
  const toPy = (y: number) => PAD + ((YMAX - y) / (YMAX - YMIN)) * (H - 2 * PAD);

  const curve = useMemo(() => {
    const pts: string[] = [];
    for (let i = 0; i <= 200; i++) {
      const x = XMIN + ((XMAX - XMIN) * i) / 200;
      const y = Math.max(Math.min(evalPoly(w, x), YMAX + 2), YMIN - 2);
      pts.push(`${toPx(x).toFixed(1)},${toPy(y).toFixed(1)}`);
    }
    return pts.join(' ');
  }, [w]);

  // training error (MSE) and a roughness proxy = sum of squared weights (excl. bias)
  const mse = DATA.reduce((s, p) => s + (evalPoly(w, p.x) - p.y) ** 2, 0) / DATA.length;
  const weightNorm = w.slice(1).reduce((s, c) => s + c * c, 0);

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-muted">
          degree = {degree}
          <input type="range" min={1} max={12} step={1} value={degree} onChange={(e) => setDegree(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          {String.fromCharCode(955)} = {lambda === 0 ? '0' : lambda.toExponential(1)}
          <input type="range" min={-6} max={0} step={0.5} value={logLambda} onChange={(e) => setLogLambda(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '22rem' }} role="img" aria-label="polynomial fit with L2 regularization">
        {/* frame + zero line */}
        <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD} fill="none" style={{ stroke: 'var(--border)' }} strokeWidth={1} />
        <line x1={PAD} y1={toPy(0)} x2={W - PAD} y2={toPy(0)} style={{ stroke: 'var(--border)' }} strokeDasharray="4 4" strokeWidth={1} />
        {/* fitted polynomial */}
        <polyline points={curve} fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth={2.5} />
        {/* data points */}
        {DATA.map((p, i) => (
          <circle key={i} cx={toPx(p.x)} cy={toPy(p.y)} r={4.5} fill="#fbbf24" stroke="var(--bg)" strokeWidth={1.5} />
        ))}
      </svg>

      <div className="mt-4 grid gap-2 border-t border-edge pt-4 font-mono text-xs text-muted sm:grid-cols-3">
        <span>train MSE = {mse.toFixed(4)}</span>
        <span>
          curve wiggle (sum w_j^2) ={' '}
          <span style={{ color: weightNorm > 50 ? '#f43f5e' : '#10b981' }}>{weightNorm.toFixed(1)}</span>
        </span>
        <span>{lambda === 0 ? 'no penalty' : 'L2 penalty active'}</span>
      </div>

      <p className="mt-2 text-xs text-muted">
        Push the degree high with {String.fromCharCode(955)} = 0: the curve threads every point but
        whips between them (overfitting). Raise {String.fromCharCode(955)} and the wiggle shrinks as
        large weights are penalized, recovering a smooth fit.
      </p>
    </div>
  );
}
