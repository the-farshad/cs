import { useState } from 'react';
import Icon from '@/components/ui/Icon';

// A real-amplitude qubit lives on a circle in the X–Z plane of the Bloch sphere.
// State: |ψ⟩ = cos(θ/2)|0⟩ + sin(θ/2)|1⟩, with θ the polar angle from the +Z axis.
//   θ = 0   → |0⟩ (north pole)
//   θ = π   → |1⟩ (south pole)
//   θ = π/2 → even superposition (equator)
// Probabilities: P(0) = cos²(θ/2), P(1) = sin²(θ/2) — always sum to 1.

const R = 90; // circle radius in SVG units
const CX = 120;
const CY = 120;

const fmt = (n: number) => (Math.abs(n) < 1e-9 ? '0' : n.toFixed(3));

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent';

export default function BlochSphereVisualizer() {
  // thetaDeg is the polar angle θ in degrees, 0..180.
  const [thetaDeg, setThetaDeg] = useState(90);

  const theta = (thetaDeg * Math.PI) / 180;
  const alpha = Math.cos(theta / 2);
  const beta = Math.sin(theta / 2);
  const p0 = alpha * alpha;
  const p1 = beta * beta;

  // Bloch vector for a real state: z = cos θ (up = +Z = |0⟩), x = sin θ (right).
  // SVG y axis points down, so |0⟩ (z = +1) is drawn at the top.
  const vx = Math.sin(theta);
  const vz = Math.cos(theta);
  const px = CX + R * vx;
  const py = CY - R * vz;

  const preset = (deg: number) => () => setThetaDeg(deg);

  const stateStr = `${fmt(alpha)}|0⟩ ${beta >= 0 ? '+' : '−'} ${fmt(Math.abs(beta))}|1⟩`;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">presets:</span>
        <button type="button" className={btn} onClick={preset(0)} title="north pole">
          |0⟩
        </button>
        <button type="button" className={btn} onClick={preset(180)} title="south pole">
          |1⟩
        </button>
        <button type="button" className={btn} onClick={preset(90)} title="equator — even superposition">
          equator (H|0⟩)
        </button>
        <button type="button" className={btn} onClick={() => setThetaDeg(90)}>
          <Icon name="rotate-ccw" size={15} /> reset
        </button>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <svg viewBox="0 0 240 240" className="w-full max-w-[240px] shrink-0" role="img" aria-label="Bloch circle">
          {/* outer circle (X–Z slice of the Bloch sphere) */}
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--edge)" strokeWidth={1.5} />
          {/* equator (drawn as a flattened ellipse to suggest the sphere) */}
          <ellipse cx={CX} cy={CY} rx={R} ry={R * 0.32} fill="none" stroke="var(--edge)" strokeWidth={1} strokeDasharray="4 4" />
          {/* axes */}
          <line x1={CX} y1={CY - R} x2={CX} y2={CY + R} stroke="var(--edge)" strokeWidth={1} />
          <line x1={CX - R} y1={CY} x2={CX + R} y2={CY} stroke="var(--edge)" strokeWidth={1} />
          {/* pole + equator labels */}
          <text x={CX} y={CY - R - 8} textAnchor="middle" className="fill-current text-fg" fontSize={12} fontFamily="monospace">
            |0⟩
          </text>
          <text x={CX} y={CY + R + 16} textAnchor="middle" className="fill-current text-fg" fontSize={12} fontFamily="monospace">
            |1⟩
          </text>
          {/* state vector */}
          <line x1={CX} y1={CY} x2={px} y2={py} stroke="#8b5cf6" strokeWidth={2.5} strokeLinecap="round" />
          <circle cx={px} cy={py} r={6} fill="#8b5cf6" />
          {/* angle arc near the +Z axis */}
          <path
            d={describeArc(CX, CY, 26, 0, thetaDeg)}
            fill="none"
            stroke="#fbbf24"
            strokeWidth={2}
          />
          <text x={CX + 14} y={CY - 6} className="fill-current" fill="#fbbf24" fontSize={11} fontFamily="monospace">
            θ
          </text>
        </svg>

        <div className="flex-1 space-y-4">
          <label className="block text-sm text-muted">
            mixing angle θ = <span className="font-mono text-fg">{thetaDeg}°</span>
            <input
              type="range"
              min={0}
              max={180}
              value={thetaDeg}
              onChange={(e) => setThetaDeg(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--accent)]"
              aria-label="mixing angle"
            />
          </label>

          <div className="space-y-3">
            {[
              { k: '|0⟩', p: p0, c: '#38bdf8' },
              { k: '|1⟩', p: p1, c: '#f43f5e' },
            ].map(({ k, p, c }) => (
              <div key={k} className="flex items-center gap-3">
                <span className="w-8 font-mono text-sm text-fg">{k}</span>
                <div className="h-6 flex-1 overflow-hidden rounded bg-bg">
                  <div className="h-full transition-all" style={{ width: `${(p * 100).toFixed(1)}%`, background: c }} />
                </div>
                <span className="w-14 text-right font-mono text-xs text-muted">{(p * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-1 border-t border-edge pt-4 font-mono text-xs text-muted">
        <div>
          state: <span className="text-fg">{stateStr}</span>
        </div>
        <div>
          amplitudes: α = <span className="text-fg">{fmt(alpha)}</span>, β = <span className="text-fg">{fmt(beta)}</span> ·
          {' '}|α|² + |β|² = <span style={{ color: '#10b981' }}>{(p0 + p1).toFixed(3)}</span>
        </div>
      </div>
    </div>
  );
}

// SVG arc helper: draws an arc of `radius` from angle `startDeg` to `endDeg`,
// measured clockwise from the +Z (upward) axis — matching the polar angle θ.
function polarToXy(cx: number, cy: number, radius: number, deg: number): [number, number] {
  const rad = ((deg - 0) * Math.PI) / 180;
  // 0° points up (-y); increasing θ rotates toward +x (to the right).
  return [cx + radius * Math.sin(rad), cy - radius * Math.cos(rad)];
}

function describeArc(cx: number, cy: number, radius: number, startDeg: number, endDeg: number): string {
  const [sx, sy] = polarToXy(cx, cy, radius, startDeg);
  const [ex, ey] = polarToXy(cx, cy, radius, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
}
