import { useMemo, useRef, useState } from 'react';

/** A draggable 3D Bloch sphere. The qubit state |psi> = cos(θ/2)|0> + e^{iφ} sin(θ/2)|1>
 *  is drawn as a vector from the centre; drag to orbit the camera, sliders set θ and φ. */

const TAU = Math.PI * 2;
type Vec = { x: number; y: number; z: number };

function rotate(p: Vec, yaw: number, pitch: number): Vec {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const x1 = p.x * cy - p.y * sy;
  const y1 = p.x * sy + p.y * cy;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const y2 = y1 * cp - p.z * sp;
  const z2 = y1 * sp + p.z * cp;
  return { x: x1, y: y2, z: z2 };
}

const R = 118, CX = 160, CY = 160;

export default function BlochSphere3D() {
  const [theta, setTheta] = useState(55); // degrees, 0..180
  const [phi, setPhi] = useState(40); // degrees, 0..360
  const [yaw, setYaw] = useState(0.6);
  const [pitch, setPitch] = useState(-0.35);
  const drag = useRef<{ x: number; y: number } | null>(null);

  const project = (p: Vec) => {
    const r = rotate(p, yaw, pitch);
    return { x: CX + R * r.x, y: CY - R * r.z, depth: r.y };
  };

  const greatCircle = (fn: (t: number) => Vec) => {
    let pts = '';
    for (let i = 0; i <= 72; i++) {
      const pr = project(fn((i / 72) * TAU));
      pts += `${pr.x.toFixed(1)},${pr.y.toFixed(1)} `;
    }
    return pts.trim();
  };

  const { equator, meridXZ, meridYZ } = useMemo(
    () => ({
      equator: greatCircle((t) => ({ x: Math.cos(t), y: Math.sin(t), z: 0 })),
      meridXZ: greatCircle((t) => ({ x: Math.cos(t), y: 0, z: Math.sin(t) })),
      meridYZ: greatCircle((t) => ({ x: 0, y: Math.cos(t), z: Math.sin(t) })),
    }),
    [yaw, pitch],
  );

  const th = (theta * Math.PI) / 180;
  const ph = (phi * Math.PI) / 180;
  const bloch: Vec = { x: Math.sin(th) * Math.cos(ph), y: Math.sin(th) * Math.sin(ph), z: Math.cos(th) };
  const tip = project(bloch);
  const foot = project({ x: bloch.x, y: bloch.y, z: 0 });
  const ax = (v: Vec) => project(v);
  const zTop = ax({ x: 0, y: 0, z: 1.18 }), zBot = ax({ x: 0, y: 0, z: -1.18 });
  const xPos = ax({ x: 1.22, y: 0, z: 0 }), yPos = ax({ x: 0, y: 1.22, z: 0 });

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    drag.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    setYaw((y) => y + dx * 0.01);
    setPitch((p) => Math.max(-1.45, Math.min(1.45, p - dy * 0.01)));
  };
  const onUp = () => { drag.current = null; };

  const p0 = Math.cos(th / 2) ** 2;
  const p1 = Math.sin(th / 2) ** 2;
  const tipFront = bloch.x * Math.sin(yaw) + bloch.y * Math.cos(yaw) < 0; // toward viewer

  const btn = 'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent';

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="flex flex-col items-center gap-5 md:flex-row md:items-start md:justify-center">
        <svg
          viewBox="0 0 320 320"
          className="w-full max-w-[320px] cursor-grab touch-none select-none active:cursor-grabbing"
          role="img"
          aria-label="3D Bloch sphere"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        >
          <defs>
            <radialGradient id="bloch-shade" cx="38%" cy="32%" r="75%">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.20" />
              <stop offset="55%" stopColor="var(--surface)" stopOpacity="0.10" />
              <stop offset="100%" stopColor="var(--bg)" stopOpacity="0.35" />
            </radialGradient>
          </defs>

          <circle cx={CX} cy={CY} r={R} fill="url(#bloch-shade)" stroke="var(--border)" strokeWidth={1.5} />
          <polyline points={meridYZ} fill="none" stroke="var(--border)" strokeWidth={1} opacity={0.6} />
          <polyline points={meridXZ} fill="none" stroke="var(--border)" strokeWidth={1} opacity={0.6} />
          <polyline points={equator} fill="none" stroke="var(--accent)" strokeWidth={1.25} opacity={0.45} />

          {/* axes */}
          <line x1={CX} y1={CY} x2={xPos.x} y2={xPos.y} stroke="var(--muted)" strokeWidth={1} opacity={0.5} />
          <line x1={CX} y1={CY} x2={yPos.x} y2={yPos.y} stroke="var(--muted)" strokeWidth={1} opacity={0.5} />
          <line x1={zBot.x} y1={zBot.y} x2={zTop.x} y2={zTop.y} stroke="var(--muted)" strokeWidth={1} opacity={0.5} />
          <text x={zTop.x} y={zTop.y - 6} textAnchor="middle" fontSize={13} style={{ fill: 'var(--fg)', fontFamily: 'var(--font-mono)' }}>|0⟩</text>
          <text x={zBot.x} y={zBot.y + 14} textAnchor="middle" fontSize={13} style={{ fill: 'var(--fg)', fontFamily: 'var(--font-mono)' }}>|1⟩</text>
          <text x={xPos.x + 4} y={xPos.y + 4} fontSize={11} style={{ fill: 'var(--muted)' }}>x</text>
          <text x={yPos.x + 4} y={yPos.y + 4} fontSize={11} style={{ fill: 'var(--muted)' }}>y</text>

          {/* state vector + drop line */}
          <line x1={CX} y1={CY} x2={foot.x} y2={foot.y} stroke="var(--muted)" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
          <line x1={foot.x} y1={foot.y} x2={tip.x} y2={tip.y} stroke="var(--muted)" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
          <line x1={CX} y1={CY} x2={tip.x} y2={tip.y} stroke="#f43f5e" strokeWidth={2.5} opacity={tipFront ? 1 : 0.55} />
          <circle cx={tip.x} cy={tip.y} r={6} fill="#f43f5e" opacity={tipFront ? 1 : 0.6} />
          <circle cx={CX} cy={CY} r={2.5} fill="var(--fg)" />
        </svg>

        <div className="w-full max-w-xs space-y-4">
          <label className="block text-xs text-muted">
            θ (polar) <span className="font-mono text-fg">{theta}°</span>
            <input type="range" min={0} max={180} value={theta} onChange={(e) => setTheta(Number(e.target.value))} className="mt-1 w-full accent-[var(--accent)]" />
          </label>
          <label className="block text-xs text-muted">
            φ (phase) <span className="font-mono text-fg">{phi}°</span>
            <input type="range" min={0} max={360} value={phi} onChange={(e) => setPhi(Number(e.target.value))} className="mt-1 w-full accent-[var(--accent)]" />
          </label>

          <div className="rounded-lg border border-edge bg-bg/40 p-3 font-mono text-xs text-fg">
            |ψ⟩ = {Math.cos(th / 2).toFixed(2)}|0⟩ + e^(i{phi}°)·{Math.sin(th / 2).toFixed(2)}|1⟩
          </div>

          {[
            { label: 'P(0)', v: p0 },
            { label: 'P(1)', v: p1 },
          ].map((b) => (
            <div key={b.label} className="flex items-center gap-2">
              <span className="w-9 font-mono text-xs text-muted">{b.label}</span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-bg">
                <span className="block h-full rounded-full" style={{ width: `${b.v * 100}%`, background: 'var(--accent)', transition: 'width 200ms' }} />
              </span>
              <span className="w-10 text-right font-mono text-xs text-fg">{(b.v * 100).toFixed(0)}%</span>
            </div>
          ))}

          <button type="button" className={btn} onClick={() => { setYaw(0.6); setPitch(-0.35); }}>
            Reset view
          </button>
          <p className="text-xs text-muted">Drag the sphere to rotate it.</p>
        </div>
      </div>
    </div>
  );
}
