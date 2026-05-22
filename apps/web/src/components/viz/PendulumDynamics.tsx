import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// Dynamics, not kinematics: a damped pendulum obeys an equation of MOTION,
//   θ'' = -(g/L) sin θ - b θ'
// driven by gravity (a torque about the pivot) and resisted by damping. We
// integrate it forward with semi-implicit Euler and precompute the whole
// trajectory so the stepper can scrub. A phase portrait (θ vs θ') shows the
// state spiralling into the resting equilibrium.

const G = 9.81; // gravity
const DT = 0.02; // integration step (s)
const STEPS = 600; // ~12 s of motion
const THETA0 = 2.4; // initial angle (rad), near horizontal

type State = { theta: number; omega: number; t: number };

function simulate(length: number, damping: number, mass: number): State[] {
  // Mass cancels in θ'' for a point pendulum, but it scales the KINETIC energy
  // we report, so we keep it as a parameter to make the dynamics concrete.
  let theta = THETA0;
  let omega = 0;
  const out: State[] = [{ theta, omega, t: 0 }];
  for (let i = 1; i <= STEPS; i++) {
    // Angular acceleration from the torque balance.
    const alpha = -(G / length) * Math.sin(theta) - damping * omega;
    // Semi-implicit Euler: update velocity first, then position (stable here).
    omega += alpha * DT;
    theta += omega * DT;
    out.push({ theta, omega, t: i * DT });
  }
  return out;
}

const W = 560;
const H = 260;

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function PendulumDynamics() {
  const [length, setLength] = useState(1.4);
  const [damping, setDamping] = useState(0.4);
  const [mass, setMass] = useState(1.2);

  const states = useMemo(() => simulate(length, damping, mass), [length, damping, mass]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(states.length, 30);
  const k = Math.min(index, states.length - 1);
  const s = states[k];

  // Left panel: the swinging pendulum (pivot at top centre of its half).
  const PIV_X = 145;
  const PIV_Y = 70;
  const ARM = 95; // px arm length for drawing
  const bobX = PIV_X + ARM * Math.sin(s.theta);
  const bobY = PIV_Y + ARM * Math.cos(s.theta);

  // Right panel: phase portrait (θ on x, ω on y).
  const PHASE_X0 = 320;
  const PHASE_W = 220;
  const PHASE_Y0 = 30;
  const PHASE_H = 200;
  const TH_MAX = Math.PI;
  const OM_MAX = 6;
  const phx = (th: number) => PHASE_X0 + ((th + TH_MAX) / (2 * TH_MAX)) * PHASE_W;
  const phy = (om: number) => PHASE_Y0 + ((OM_MAX - om) / (2 * OM_MAX)) * PHASE_H;
  const phasePath = states.slice(0, k + 1).map((st) => `${phx(st.theta).toFixed(1)},${phy(st.omega).toFixed(1)}`).join(' ');

  // Reported energies (depend on mass, making the dynamics tangible).
  const ke = 0.5 * mass * (length * s.omega) ** 2;
  const pe = mass * G * length * (1 - Math.cos(s.theta));

  const slider = (label: string, val: number, set: (n: number) => void, min: number, max: number, step: number) => (
    <label className="flex items-center gap-2 text-sm text-muted">
      {label} = {val.toFixed(2)}
      <input type="range" min={min} max={max} step={step} value={val} onChange={(e) => set(Number(e.target.value))} className="accent-[var(--accent)]" />
    </label>
  );

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        {slider('length L', length, setLength, 0.6, 2.5, 0.1)}
        {slider('damping b', damping, setDamping, 0, 1.5, 0.05)}
        {slider('mass m', mass, setMass, 0.4, 3, 0.1)}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '17rem' }} role="img" aria-label="Damped pendulum integrating its equation of motion, with a phase portrait">
        {/* divider */}
        <line x1={285} y1={20} x2={285} y2={H - 20} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 3" />

        {/* ---- pendulum panel ---- */}
        {/* swept arc the bob can reach */}
        <path d={`M ${PIV_X - ARM} ${PIV_Y} A ${ARM} ${ARM} 0 0 0 ${PIV_X + ARM} ${PIV_Y}`} fill="none" stroke="var(--border)" strokeWidth={1} strokeDasharray="2 4" />
        {/* arm */}
        <line x1={PIV_X} y1={PIV_Y} x2={bobX} y2={bobY} stroke="var(--muted)" strokeWidth={3} strokeLinecap="round" />
        {/* pivot */}
        <circle cx={PIV_X} cy={PIV_Y} r={4} fill="var(--fg)" />
        {/* bob — radius scales with mass */}
        <circle cx={bobX} cy={bobY} r={6 + mass * 3} fill="var(--accent)" stroke="var(--bg)" strokeWidth={1.5} />
        <text x={145} y={H - 8} textAnchor="middle" fontSize={9} style={{ fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
          θ = {s.theta.toFixed(2)} rad
        </text>

        {/* ---- phase portrait panel ---- */}
        {/* axes */}
        <line x1={PHASE_X0} y1={phy(0)} x2={PHASE_X0 + PHASE_W} y2={phy(0)} stroke="var(--border)" strokeWidth={1} />
        <line x1={phx(0)} y1={PHASE_Y0} x2={phx(0)} y2={PHASE_Y0 + PHASE_H} stroke="var(--border)" strokeWidth={1} />
        <text x={PHASE_X0 + PHASE_W} y={phy(0) - 4} textAnchor="end" fontSize={9} style={{ fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>θ</text>
        <text x={phx(0) + 4} y={PHASE_Y0 + 8} fontSize={9} style={{ fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>θ′</text>
        {/* equilibrium target at origin */}
        <circle cx={phx(0)} cy={phy(0)} r={2} fill="#10b981" />
        {/* trajectory */}
        {phasePath && <polyline points={phasePath} fill="none" stroke="#8b5cf6" strokeWidth={1.4} />}
        {/* current state */}
        <circle cx={phx(s.theta)} cy={phy(s.omega)} r={3.2} fill="#fbbf24" stroke="var(--bg)" strokeWidth={1} />
      </svg>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={prev} disabled={index <= 0}>
          <Icon name="chevron-left" size={16} /> Step
        </button>
        <button
          type="button"
          onClick={() => (playing ? pause() : play())}
          className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90"
        >
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Integrate'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= states.length - 1}>
          Step <Icon name="chevron-right" size={16} />
        </button>
        <button type="button" className={btn} onClick={reset} disabled={index === 0}>
          <Icon name="rotate-ccw" size={15} /> Reset
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={5} max={60} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input type="range" min={0} max={Math.max(states.length - 1, 0)} value={index} onChange={(e) => seek(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Timeline" />
        <span className="shrink-0 font-mono text-xs text-muted">
          t = {s.t.toFixed(2)}s
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-edge pt-4 text-xs text-muted">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: '#8b5cf6' }} /> phase trajectory</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#fbbf24' }} /> current state</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#10b981' }} /> equilibrium</span>
        </div>
        <div className="font-mono">
          ω {s.omega.toFixed(2)} · KE {ke.toFixed(2)} · PE {pe.toFixed(2)} J
        </div>
      </div>

      <p className="mt-3 text-sm text-muted">
        Kinematics asks only <em>where</em> the parts are; dynamics asks <em>why</em> they move. Gravity supplies a restoring torque proportional to <em>sin θ</em>, damping drains energy, and the integrator steps the state forward in time. Raise the damping and the phase spiral collapses fast to the resting point; drop it to zero and energy is conserved, so the orbit becomes a closed loop. Mass scales the bob and its kinetic energy but cancels from the acceleration itself.
      </p>
    </div>
  );
}
