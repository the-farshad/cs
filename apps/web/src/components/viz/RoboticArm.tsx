import { useState } from 'react';

const SIZE = 320;
const CX = 160;
const CY = 215;
const L1 = 82;
const L2 = 68;

export default function RoboticArm() {
  const [t1, setT1] = useState(50);
  const [t2, setT2] = useState(35);

  const r1 = (t1 * Math.PI) / 180;
  const r2 = (t2 * Math.PI) / 180;
  const j1x = CX + L1 * Math.cos(r1);
  const j1y = CY - L1 * Math.sin(r1);
  const ex = j1x + L2 * Math.cos(r1 + r2);
  const ey = j1y - L2 * Math.sin(r1 + r2);

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-muted">
          θ₁ (shoulder) = {t1}°
          <input type="range" min={0} max={180} value={t1} onChange={(e) => setT1(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          θ₂ (elbow) = {t2}°
          <input type="range" min={-150} max={150} value={t2} onChange={(e) => setT2(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto block w-full" style={{ maxHeight: '20rem' }} role="img" aria-label="two-link robotic arm">
        {/* reachable workspace */}
        <circle cx={CX} cy={CY} r={L1 + L2} fill="none" style={{ stroke: 'var(--border)' }} strokeWidth={1} strokeDasharray="3 4" />
        {/* ground */}
        <line x1={20} y1={CY} x2={SIZE - 20} y2={CY} style={{ stroke: 'var(--border)' }} strokeWidth={1} />
        {/* link 1 */}
        <line x1={CX} y1={CY} x2={j1x} y2={j1y} style={{ stroke: 'var(--muted)' }} strokeWidth={6} strokeLinecap="round" />
        {/* link 2 */}
        <line x1={j1x} y1={j1y} x2={ex} y2={ey} style={{ stroke: 'var(--accent)' }} strokeWidth={6} strokeLinecap="round" />
        {/* joints */}
        <circle cx={CX} cy={CY} r={7} style={{ fill: 'var(--fg)' }} />
        <circle cx={j1x} cy={j1y} r={6} style={{ fill: 'var(--fg)' }} />
        <circle cx={ex} cy={ey} r={7} style={{ fill: 'var(--accent)', stroke: 'var(--bg)' }} strokeWidth={2} />
      </svg>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-edge pt-4 font-mono text-sm text-muted">
        <span>end-effector x = <span className="text-fg">{(ex - CX).toFixed(0)}</span></span>
        <span>y = <span className="text-fg">{(CY - ey).toFixed(0)}</span></span>
        <span className="text-muted/70">x = L₁cos θ₁ + L₂cos(θ₁+θ₂)</span>
      </div>
    </div>
  );
}
