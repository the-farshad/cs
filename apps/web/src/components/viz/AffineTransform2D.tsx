import { useState } from 'react';

// 3x3 homogeneous matrix for 2D affine transforms.
// [ a c tx ]
// [ b d ty ]
// [ 0 0 1  ]
type Mat3 = [number, number, number, number, number, number];
// stored as [a, b, c, d, tx, ty]

const SIZE = 340;
const C = SIZE / 2;
const UNIT = 42; // pixels per world unit

// World (x right, y up) -> SVG pixel coordinates (y flips).
const px = (x: number) => C + x * UNIT;
const py = (y: number) => C - y * UNIT;

// Apply [a,b,c,d,tx,ty] to a point.
function apply(m: Mat3, x: number, y: number): { x: number; y: number } {
  const [a, b, c, d, tx, ty] = m;
  return { x: a * x + c * y + tx, y: b * x + d * y + ty };
}

// Compose two affine matrices: result = A then B  ->  B * A.
function compose(B: Mat3, A: Mat3): Mat3 {
  const [a1, b1, c1, d1, e1, f1] = A;
  const [a2, b2, c2, d2, e2, f2] = B;
  return [
    a2 * a1 + c2 * b1,
    b2 * a1 + d2 * b1,
    a2 * c1 + c2 * d1,
    b2 * c1 + d2 * d1,
    a2 * e1 + c2 * f1 + e2,
    b2 * e1 + d2 * f1 + f2,
  ];
}

const IDENTITY: Mat3 = [1, 0, 0, 1, 0, 0];

type Op = 'translate' | 'rotate' | 'scale' | 'shear';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent';

const sky = '#38bdf8';
const emerald = '#10b981';
const violet = '#8b5cf6';

// An "F" shape (asymmetric so flips/rotations are obvious), in world units.
const SHAPE: { x: number; y: number }[] = [
  { x: 0, y: 0 },
  { x: 0, y: 2 },
  { x: 1.4, y: 2 },
  { x: 1.4, y: 1.5 },
  { x: 0.5, y: 1.5 },
  { x: 0.5, y: 1.1 },
  { x: 1.1, y: 1.1 },
  { x: 1.1, y: 0.6 },
  { x: 0.5, y: 0.6 },
  { x: 0.5, y: 0 },
];

export default function AffineTransform2D() {
  const [op, setOp] = useState<Op>('rotate');
  // raw control values per op type
  const [tx, setTx] = useState(1);
  const [ty, setTy] = useState(0.5);
  const [deg, setDeg] = useState(35);
  const [sx, setSx] = useState(1.4);
  const [sy, setSy] = useState(0.8);
  const [shx, setShx] = useState(0.6);
  // second transform applied after the first (to demo composition)
  const [composeRotate, setComposeRotate] = useState(false);

  let M: Mat3 = IDENTITY;
  if (op === 'translate') M = [1, 0, 0, 1, tx, ty];
  else if (op === 'rotate') {
    const r = (deg * Math.PI) / 180;
    M = [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
  } else if (op === 'scale') M = [sx, 0, 0, sy, 0, 0];
  else if (op === 'shear') M = [1, 0, shx, 1, 0, 0];

  // Optional second op (a fixed 30 degree rotation) composed AFTER M: final = R * M.
  const r2 = (30 * Math.PI) / 180;
  const R: Mat3 = [Math.cos(r2), Math.sin(r2), -Math.sin(r2), Math.cos(r2), 0, 0];
  const finalM = composeRotate ? compose(R, M) : M;

  const transformed = SHAPE.map((p) => apply(finalM, p.x, p.y));
  const polyOrig = SHAPE.map((p) => `${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ');
  const polyNew = transformed.map((p) => `${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ');

  // basis vectors after transform (ignore translation for the arrows' direction; show origin shift)
  const o = apply(finalM, 0, 0);
  const iTip = apply(finalM, 1, 0);
  const jTip = apply(finalM, 0, 1);

  const [a, b, c, d, e, f] = finalM;

  const Arrow = ({ x1, y1, x2, y2, color, label }: { x1: number; y1: number; x2: number; y2: number; color: string; label: string }) => {
    const ang = Math.atan2(py(y2) - py(y1), px(x2) - px(x1));
    const len = 9;
    return (
      <g>
        <line x1={px(x1)} y1={py(y1)} x2={px(x2)} y2={py(y2)} style={{ stroke: color }} strokeWidth={2.5} />
        <polygon
          points={`${px(x2)},${py(y2)} ${px(x2) - len * Math.cos(ang - 0.4)},${py(y2) - len * Math.sin(ang - 0.4)} ${px(x2) - len * Math.cos(ang + 0.4)},${py(y2) - len * Math.sin(ang + 0.4)}`}
          style={{ fill: color }}
        />
        <text x={px(x2) + 6} y={py(y2) - 4} style={{ fill: color }} className="font-mono text-xs">
          {label}
        </text>
      </g>
    );
  };

  const grid = [-3, -2, -1, 1, 2, 3];

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap gap-1.5">
        {(['translate', 'rotate', 'scale', 'shear'] as Op[]).map((o2) => (
          <button
            key={o2}
            type="button"
            className={`${btn} ${op === o2 ? 'border-accent text-accent' : ''}`}
            onClick={() => setOp(o2)}
          >
            {o2}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="mx-auto block w-full max-w-sm"
          style={{ maxHeight: '21rem' }}
          role="img"
          aria-label="2D affine transform of an F-shape"
        >
          {grid.map((g) => (
            <g key={g}>
              <line x1={px(g)} y1={0} x2={px(g)} y2={SIZE} style={{ stroke: 'var(--border)' }} strokeWidth={0.5} opacity={0.5} />
              <line x1={0} y1={py(g)} x2={SIZE} y2={py(g)} style={{ stroke: 'var(--border)' }} strokeWidth={0.5} opacity={0.5} />
            </g>
          ))}
          <line x1={0} y1={C} x2={SIZE} y2={C} style={{ stroke: 'var(--border)' }} strokeWidth={1.25} />
          <line x1={C} y1={0} x2={C} y2={SIZE} style={{ stroke: 'var(--border)' }} strokeWidth={1.25} />

          {/* original shape (dashed) */}
          <polygon points={polyOrig} fill="none" style={{ stroke: 'var(--muted)' }} strokeWidth={1.25} strokeDasharray="4 3" />
          {/* transformed shape */}
          <polygon points={polyNew} style={{ fill: violet, fillOpacity: 0.2, stroke: violet }} strokeWidth={2} />

          {/* transformed basis */}
          <Arrow x1={o.x} y1={o.y} x2={iTip.x} y2={iTip.y} color={sky} label="i" />
          <Arrow x1={o.x} y1={o.y} x2={jTip.x} y2={jTip.y} color={emerald} label="j" />
        </svg>

        <div className="flex flex-col gap-3 text-sm text-muted">
          {op === 'translate' && (
            <>
              <label className="flex flex-col gap-1">
                <span className="font-mono">tx = {tx.toFixed(2)}</span>
                <input type="range" min={-3} max={3} step={0.05} value={tx} onChange={(e) => setTx(Number(e.target.value))} className="accent-[var(--accent)]" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono">ty = {ty.toFixed(2)}</span>
                <input type="range" min={-3} max={3} step={0.05} value={ty} onChange={(e) => setTy(Number(e.target.value))} className="accent-[var(--accent)]" />
              </label>
            </>
          )}
          {op === 'rotate' && (
            <label className="flex flex-col gap-1">
              <span className="font-mono">angle = {deg}&deg;</span>
              <input type="range" min={-180} max={180} value={deg} onChange={(e) => setDeg(Number(e.target.value))} className="w-56 accent-[var(--accent)]" />
            </label>
          )}
          {op === 'scale' && (
            <>
              <label className="flex flex-col gap-1">
                <span className="font-mono">sx = {sx.toFixed(2)}</span>
                <input type="range" min={-2} max={2.5} step={0.05} value={sx} onChange={(e) => setSx(Number(e.target.value))} className="accent-[var(--accent)]" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono">sy = {sy.toFixed(2)}</span>
                <input type="range" min={-2} max={2.5} step={0.05} value={sy} onChange={(e) => setSy(Number(e.target.value))} className="accent-[var(--accent)]" />
              </label>
            </>
          )}
          {op === 'shear' && (
            <label className="flex flex-col gap-1">
              <span className="font-mono">shear x = {shx.toFixed(2)}</span>
              <input type="range" min={-1.5} max={1.5} step={0.05} value={shx} onChange={(e) => setShx(Number(e.target.value))} className="w-56 accent-[var(--accent)]" />
            </label>
          )}
          <label className="mt-1 flex items-center gap-2 text-xs">
            <input type="checkbox" checked={composeRotate} onChange={(e) => setComposeRotate(e.target.checked)} className="accent-[var(--accent)]" />
            then compose with a 30&deg; rotation (R &middot; M)
          </label>
        </div>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">
        <div className="mb-1 text-fg">homogeneous matrix M</div>
        <div>[ {a.toFixed(2)} {c.toFixed(2)} {e.toFixed(2)} ]</div>
        <div>[ {b.toFixed(2)} {d.toFixed(2)} {f.toFixed(2)} ]</div>
        <div className="text-muted/60">[ 0.00 0.00 1.00 ]</div>
      </div>
      <p className="mt-2 text-xs text-muted">
        The dashed outline is the original; the filled shape is M applied to every vertex. The translation
        column (third column) only does anything because the point carries a 1 in its third slot.
      </p>
    </div>
  );
}
