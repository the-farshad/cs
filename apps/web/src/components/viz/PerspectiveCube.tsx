import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';

// Rotating wireframe cube projected to 2D with adjustable FOV and camera distance.

const SIZE = 360;
const C = SIZE / 2;

const sky = '#38bdf8';
const violet = '#8b5cf6';

// Unit cube centred at origin: 8 vertices.
const VERTS: [number, number, number][] = [
  [-1, -1, -1],
  [1, -1, -1],
  [1, 1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
  [1, -1, 1],
  [1, 1, 1],
  [-1, 1, 1],
];

// 12 edges as vertex-index pairs.
const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0], // back face
  [4, 5], [5, 6], [6, 7], [7, 4], // front face
  [0, 4], [1, 5], [2, 6], [3, 7], // connectors
];

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent';

function rotate(v: [number, number, number], ax: number, ay: number): [number, number, number] {
  let [x, y, z] = v;
  // rotate around Y
  let cx = Math.cos(ay);
  let sx = Math.sin(ay);
  let nx = x * cx + z * sx;
  let nz = -x * sx + z * cx;
  x = nx;
  z = nz;
  // rotate around X
  const cy = Math.cos(ax);
  const sy = Math.sin(ax);
  const ny = y * cy - z * sy;
  nz = y * sy + z * cy;
  y = ny;
  z = nz;
  return [x, y, z];
}

export default function PerspectiveCube() {
  const [fovDeg, setFovDeg] = useState(60);
  const [dist, setDist] = useState(4);
  const [spinning, setSpinning] = useState(true);
  const [angle, setAngle] = useState(0.6);
  const raf = useRef<number | null>(null);
  const last = useRef<number>(0);

  useEffect(() => {
    if (!spinning) {
      if (raf.current) cancelAnimationFrame(raf.current);
      return;
    }
    const tick = (t: number) => {
      if (!last.current) last.current = t;
      const dt = (t - last.current) / 1000;
      last.current = t;
      setAngle((a) => a + dt * 0.6);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      last.current = 0;
    };
  }, [spinning]);

  // focal length from field of view: f = 1 / tan(fov/2). Larger fov -> shorter focal -> more distortion.
  const f = 1 / Math.tan((fovDeg * Math.PI) / 180 / 2);
  const scale = (C * 0.8) / 1; // world-to-screen scale baseline

  // project each vertex
  const tilt = 0.5; // fixed slight downward tilt around X
  const projected = VERTS.map((v) => {
    const r = rotate(v, tilt, angle);
    const [x, y, z] = r;
    const zc = z + dist; // move cube in front of camera
    const persp = f / zc; // perspective divide
    return {
      sx: C + x * persp * scale,
      sy: C - y * persp * scale,
    };
  });

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setSpinning((s) => !s)}
          className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90"
        >
          <Icon name={spinning ? 'pause' : 'play'} size={16} /> {spinning ? 'Pause' : 'Spin'}
        </button>
        <button type="button" className={btn} onClick={() => setAngle(0.6)}>
          <Icon name="rotate-ccw" size={16} /> Reset angle
        </button>
      </div>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto block w-full max-w-sm" style={{ maxHeight: '22rem' }} role="img" aria-label="rotating wireframe cube in perspective">
          {/* horizon / center marker */}
          <line x1={0} y1={C} x2={SIZE} y2={C} style={{ stroke: 'var(--border)' }} strokeWidth={0.5} opacity={0.4} />
          <line x1={C} y1={0} x2={C} y2={SIZE} style={{ stroke: 'var(--border)' }} strokeWidth={0.5} opacity={0.4} />

          {/* edges */}
          {EDGES.map(([i, j], k) => {
            const a = projected[i];
            const b = projected[j];
            return <line key={k} x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy} style={{ stroke: violet }} strokeWidth={2} strokeLinecap="round" />;
          })}
          {/* vertices */}
          {projected.map((p, i) => (
            <circle key={i} cx={p.sx} cy={p.sy} r={3.5} style={{ fill: sky }} />
          ))}
        </svg>

        <div className="flex flex-col gap-4 text-sm text-muted">
          <label className="flex flex-col gap-1">
            <span className="font-mono">field of view = {fovDeg}&deg;</span>
            <input type="range" min={20} max={120} value={fovDeg} onChange={(e) => setFovDeg(Number(e.target.value))} className="w-56 accent-[var(--accent)]" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono">camera distance = {dist.toFixed(1)}</span>
            <input type="range" min={2.2} max={9} step={0.1} value={dist} onChange={(e) => setDist(Number(e.target.value))} className="w-56 accent-[var(--accent)]" />
          </label>
          <div className="rounded-lg border border-edge bg-bg p-3 font-mono text-xs">
            <div className="text-fg">focal f = 1 / tan(fov/2) = {f.toFixed(2)}</div>
            <div className="mt-1">x' = f &middot; x / (z + d)</div>
            <div>y' = f &middot; y / (z + d)</div>
          </div>
        </div>
      </div>

      <p className="mt-4 border-t border-edge pt-4 text-xs text-muted">
        A wide field of view (short focal length) exaggerates depth — near edges balloon while far edges
        shrink. Pulling the camera back flattens the cube toward an orthographic look.
      </p>
    </div>
  );
}
