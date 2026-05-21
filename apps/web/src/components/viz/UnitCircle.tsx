import { useState } from 'react';

const SIZE = 320;
const C = SIZE / 2;
const R = 120;

export default function UnitCircle() {
  const [deg, setDeg] = useState(45);
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const tan = Math.tan(rad);
  const px = C + R * cos;
  const py = C - R * sin;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          angle θ = {deg}°
          <input type="range" min={0} max={360} value={deg} onChange={(e) => setDeg(Number(e.target.value))} className="w-56 accent-[var(--accent)]" />
        </label>
      </div>

      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto block w-full" style={{ maxHeight: '20rem' }} role="img" aria-label="unit circle">
        {/* axes */}
        <line x1={10} y1={C} x2={SIZE - 10} y2={C} style={{ stroke: 'var(--border)' }} strokeWidth={1} />
        <line x1={C} y1={10} x2={C} y2={SIZE - 10} style={{ stroke: 'var(--border)' }} strokeWidth={1} />
        {/* circle */}
        <circle cx={C} cy={C} r={R} fill="none" style={{ stroke: 'var(--muted)' }} strokeWidth={1.5} />
        {/* cos projection */}
        <line x1={C} y1={py} x2={px} y2={py} style={{ stroke: '#fbbf24' }} strokeWidth={2} />
        {/* sin projection */}
        <line x1={px} y1={C} x2={px} y2={py} style={{ stroke: '#3fb950' }} strokeWidth={2} />
        {/* radius */}
        <line x1={C} y1={C} x2={px} y2={py} style={{ stroke: 'var(--accent)' }} strokeWidth={2.5} />
        <circle cx={px} cy={py} r={6} style={{ fill: 'var(--accent)' }} />
      </svg>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-edge pt-4 font-mono text-sm">
        <span style={{ color: '#fbbf24' }}>cos θ = {cos.toFixed(3)}</span>
        <span style={{ color: '#3fb950' }}>sin θ = {sin.toFixed(3)}</span>
        <span className="text-muted">tan θ = {Math.abs(cos) < 1e-6 ? '∞' : tan.toFixed(3)}</span>
      </div>
    </div>
  );
}
