import { useMemo, useState } from 'react';

// Correlated 2D cloud, centered roughly at (5,5). Tiny + deterministic.
const RAW: { x: number; y: number }[] = [
  { x: 1.5, y: 2.2 }, { x: 2.4, y: 2.9 }, { x: 3.0, y: 3.4 }, { x: 3.6, y: 4.6 },
  { x: 4.2, y: 4.0 }, { x: 4.8, y: 5.5 }, { x: 5.3, y: 4.9 }, { x: 5.9, y: 6.4 },
  { x: 6.4, y: 5.8 }, { x: 7.0, y: 7.2 }, { x: 7.6, y: 6.6 }, { x: 8.2, y: 8.0 },
  { x: 8.8, y: 7.3 }, { x: 2.9, y: 4.4 }, { x: 6.6, y: 6.0 }, { x: 4.5, y: 3.3 },
];

const W = 420;
const H = 420;
const PAD = 28;
const DOM = 10;

const PC1_COLOR = '#8b5cf6'; // violet
const PC2_COLOR = '#38bdf8'; // sky

// Closed-form eigen-decomposition of a 2x2 symmetric covariance matrix.
function eigen2x2(a: number, b: number, c: number) {
  // matrix [[a, b], [b, c]]
  const tr = a + c;
  const det = a * c - b * b;
  const disc = Math.sqrt(Math.max(tr * tr / 4 - det, 0));
  const l1 = tr / 2 + disc; // larger eigenvalue → PC1
  const l2 = tr / 2 - disc;
  // eigenvector for l1
  let v1: [number, number];
  if (Math.abs(b) > 1e-9) v1 = [l1 - c, b];
  else v1 = a >= c ? [1, 0] : [0, 1];
  const n1 = Math.hypot(v1[0], v1[1]) || 1;
  v1 = [v1[0] / n1, v1[1] / n1];
  const v2: [number, number] = [-v1[1], v1[0]]; // orthogonal
  return { l1, l2, v1, v2 };
}

export default function PCAVisualizer() {
  const [showProj, setShowProj] = useState(true);

  const { mean, v1, v2, l1, l2, projected } = useMemo(() => {
    const n = RAW.length;
    const mx = RAW.reduce((s, p) => s + p.x, 0) / n;
    const my = RAW.reduce((s, p) => s + p.y, 0) / n;
    let sxx = 0;
    let syy = 0;
    let sxy = 0;
    for (const p of RAW) {
      const dx = p.x - mx;
      const dy = p.y - my;
      sxx += dx * dx;
      syy += dy * dy;
      sxy += dx * dy;
    }
    sxx /= n - 1;
    syy /= n - 1;
    sxy /= n - 1;
    const { l1, l2, v1, v2 } = eigen2x2(sxx, sxy, syy);
    // project each point onto PC1: foot = mean + (d·v1) v1
    const projected = RAW.map((p) => {
      const dx = p.x - mx;
      const dy = p.y - my;
      const t = dx * v1[0] + dy * v1[1];
      return { fx: mx + t * v1[0], fy: my + t * v1[1] };
    });
    return { mean: { x: mx, y: my }, v1, v2, l1, l2, projected };
  }, []);

  const toPx = (x: number) => PAD + (x / DOM) * (W - 2 * PAD);
  const toPy = (y: number) => H - PAD - (y / DOM) * (H - 2 * PAD);

  // axis segments scaled by sqrt(eigenvalue) so length ∝ spread along that direction.
  const axisSeg = (v: [number, number], lam: number) => {
    const s = 2.4 * Math.sqrt(Math.max(lam, 0.01));
    return {
      x1: toPx(mean.x - v[0] * s),
      y1: toPy(mean.y - v[1] * s),
      x2: toPx(mean.x + v[0] * s),
      y2: toPy(mean.y + v[1] * s),
    };
  };
  const a1 = axisSeg(v1, l1);
  const a2 = axisSeg(v2, l2);

  const total = l1 + l2;
  const explained1 = (100 * l1) / total;
  const explained2 = (100 * l2) / total;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={showProj} onChange={(e) => setShowProj(e.target.checked)} className="accent-[var(--accent)]" />
          show projection onto PC1
        </label>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block w-full" style={{ maxWidth: '26rem' }} role="img" aria-label="PCA of a 2D point cloud">
        <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD} fill="none" style={{ stroke: 'var(--border)' }} strokeWidth={1} />

        {/* projection feet on PC1 + drop lines */}
        {showProj && (
          <>
            <line x1={a1.x1} y1={a1.y1} x2={a1.x2} y2={a1.y2} stroke={PC1_COLOR} strokeWidth={1} opacity={0.25} />
            {RAW.map((p, i) => (
              <line key={`d${i}`} x1={toPx(p.x)} y1={toPy(p.y)} x2={toPx(projected[i].fx)} y2={toPy(projected[i].fy)} style={{ stroke: 'var(--muted)' }} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
            ))}
            {projected.map((q, i) => (
              <circle key={`f${i}`} cx={toPx(q.fx)} cy={toPy(q.fy)} r={3.5} fill={PC1_COLOR} opacity={0.9} />
            ))}
          </>
        )}

        {/* principal axes */}
        <line x1={a2.x1} y1={a2.y1} x2={a2.x2} y2={a2.y2} stroke={PC2_COLOR} strokeWidth={2.5} />
        <line x1={a1.x1} y1={a1.y1} x2={a1.x2} y2={a1.y2} stroke={PC1_COLOR} strokeWidth={3} />
        <text x={a1.x2 + 4} y={a1.y2} fill={PC1_COLOR} className="font-mono" style={{ fontSize: 12 }}>PC1</text>
        <text x={a2.x2 + 4} y={a2.y2} fill={PC2_COLOR} className="font-mono" style={{ fontSize: 12 }}>PC2</text>

        {/* original points */}
        {RAW.map((p, i) => (
          <circle key={i} cx={toPx(p.x)} cy={toPy(p.y)} r={5} fill="#10b981" stroke="var(--bg)" strokeWidth={1.5} />
        ))}

        {/* centroid (mean) */}
        <circle cx={toPx(mean.x)} cy={toPy(mean.y)} r={4} fill="var(--bg)" style={{ stroke: 'var(--fg)' }} strokeWidth={2} />
      </svg>

      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-edge pt-4 text-sm">
        <span className="inline-flex items-center gap-1.5 text-muted">
          <span className="inline-block h-2.5 w-6 rounded" style={{ background: PC1_COLOR }} /> PC1 (max variance)
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted">
          <span className="inline-block h-2.5 w-6 rounded" style={{ background: PC2_COLOR }} /> PC2
        </span>
      </div>

      <div className="mt-3 font-mono text-xs text-muted">
        variance explained: PC1 = {explained1.toFixed(1)}% · PC2 = {explained2.toFixed(1)}% — keeping
        PC1 alone retains most of the spread in one dimension.
      </div>
    </div>
  );
}
