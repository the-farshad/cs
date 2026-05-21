import { useMemo, useState } from 'react';

const STEPS = 140;
const DT = 0.1;
const DAMPING = 1.2;
const SETPOINT = 1;
const W = 560;
const H = 260;
const PAD = 28;
const Y_MIN = -0.3;
const Y_MAX = 2.3;

function simulate(kp: number, ki: number, kd: number): number[] {
  let x = 0;
  let v = 0;
  let integral = 0;
  let prevErr = SETPOINT;
  const xs: number[] = [x];
  for (let i = 0; i < STEPS; i++) {
    const err = SETPOINT - x;
    integral += err * DT;
    const deriv = (err - prevErr) / DT;
    const u = kp * err + ki * integral + kd * deriv;
    const a = u - DAMPING * v;
    v += a * DT;
    x += v * DT;
    prevErr = err;
    xs.push(x);
  }
  return xs;
}

export default function PIDVisualizer() {
  const [kp, setKp] = useState(4);
  const [ki, setKi] = useState(1);
  const [kd, setKd] = useState(2);

  const xs = useMemo(() => simulate(kp, ki, kd), [kp, ki, kd]);

  const toPx = (i: number) => PAD + (i / STEPS) * (W - 2 * PAD);
  const toPy = (y: number) => PAD + ((Y_MAX - y) / (Y_MAX - Y_MIN)) * (H - 2 * PAD);
  const path = xs.map((x, i) => `${toPx(i).toFixed(1)},${toPy(x).toFixed(1)}`).join(' ');

  const overshoot = Math.max(0, (Math.max(...xs) - SETPOINT) * 100);
  const finalErr = Math.abs(SETPOINT - xs[xs.length - 1]);

  const slider = (label: string, val: number, set: (n: number) => void, max: number) => (
    <label className="flex items-center gap-2 text-sm text-muted">
      {label} = {val.toFixed(1)}
      <input type="range" min={0} max={max} step={0.1} value={val} onChange={(e) => set(Number(e.target.value))} className="accent-[var(--accent)]" />
    </label>
  );

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        {slider('Kp', kp, setKp, 12)}
        {slider('Ki', ki, setKi, 4)}
        {slider('Kd', kd, setKd, 8)}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '18rem' }} role="img" aria-label="PID step response">
        {/* setpoint */}
        <line x1={PAD} y1={toPy(SETPOINT)} x2={W - PAD} y2={toPy(SETPOINT)} style={{ stroke: 'var(--muted)' }} strokeWidth={1} strokeDasharray="4 4" />
        <text x={W - PAD} y={toPy(SETPOINT) - 5} textAnchor="end" fontSize={11} style={{ fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
          setpoint
        </text>
        {/* zero baseline */}
        <line x1={PAD} y1={toPy(0)} x2={W - PAD} y2={toPy(0)} style={{ stroke: 'var(--border)' }} strokeWidth={1} />
        {/* response */}
        <polyline points={path} fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth={2.5} />
      </svg>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-edge pt-4 font-mono text-xs text-muted">
        <span>overshoot ≈ {overshoot.toFixed(0)}%</span>
        <span>steady-state error ≈ {finalErr.toFixed(3)}</span>
        <span className="text-muted/70">Kp pushes harder · Kd damps oscillation · Ki removes leftover error</span>
      </div>
    </div>
  );
}
