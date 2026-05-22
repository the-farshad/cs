import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// Cast a ray through each pixel of a small grid at a sphere; diffuse-shade by light angle.

const RES = 18; // RES x RES pixel image
const CELL = 18; // px per pixel cell

const amber = '#fbbf24';

type Vec3 = [number, number, number];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

const SPHERE_C: Vec3 = [0, 0, -3];
const SPHERE_R = 1.2;
const CAM: Vec3 = [0, 0, 0];

// Returns brightness 0..1 for a pixel, or null if the ray misses.
function shadePixel(u: number, v: number, light: Vec3): number | null {
  // ray direction through image plane at z = -1
  const dir = norm([u, v, -1]);
  // ray-sphere intersection: |o + t d - c|^2 = r^2
  const oc = sub(CAM, SPHERE_C);
  const b = 2 * dot(oc, dir);
  const c = dot(oc, oc) - SPHERE_R * SPHERE_R;
  const disc = b * b - 4 * c; // a = 1 (dir is unit)
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / 2;
  if (t < 0) return null;
  const hit: Vec3 = [CAM[0] + t * dir[0], CAM[1] + t * dir[1], CAM[2] + t * dir[2]];
  const n = norm(sub(hit, SPHERE_C));
  const l = norm(light);
  // Lambert diffuse + small ambient
  const diff = Math.max(0, dot(n, l));
  return Math.min(1, 0.12 + 0.88 * diff);
}

function gray(b: number) {
  const c = Math.round(b * 255);
  return `rgb(${c},${c},${c})`;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function RayTraceSphere() {
  const [lx, setLx] = useState(-0.7);
  const [ly, setLy] = useState(0.8);
  const light: Vec3 = [lx, ly, 0.6];

  // precompute shading for every pixel
  const grid = useMemo(() => {
    const rows: (number | null)[][] = [];
    for (let py = 0; py < RES; py++) {
      const row: (number | null)[] = [];
      for (let px = 0; px < RES; px++) {
        // map pixel to [-1,1] image plane coords (y up)
        const u = (px + 0.5) / RES * 2 - 1;
        const v = 1 - (py + 0.5) / RES * 2;
        row.push(shadePixel(u, v, light));
      }
      rows.push(row);
    }
    return rows;
  }, [lx, ly]);

  // step row by row; final frame = all rows done
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(RES + 1, 8);
  const rowsDone = Math.min(index, RES);

  const SVG = RES * CELL;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm text-muted">
        <label className="flex flex-col gap-1">
          <span className="font-mono">light x = {lx.toFixed(2)}</span>
          <input type="range" min={-1.5} max={1.5} step={0.05} value={lx} onChange={(e) => setLx(Number(e.target.value))} className="w-44 accent-[var(--accent)]" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono">light y = {ly.toFixed(2)}</span>
          <input type="range" min={-1.5} max={1.5} step={0.05} value={ly} onChange={(e) => setLy(Number(e.target.value))} className="w-44 accent-[var(--accent)]" />
        </label>
      </div>

      <div className="flex flex-col items-center gap-5 md:flex-row md:items-start md:justify-center">
        <div>
          <div className="mb-1 text-center text-xs text-muted">rendered image ({RES}&times;{RES})</div>
          <svg viewBox={`0 0 ${SVG} ${SVG}`} className="block w-full max-w-[320px]" style={{ background: 'var(--bg)' }} role="img" aria-label="ray traced sphere">
            {grid.map((row, py) =>
              row.map((b, px) => {
                const revealed = py < rowsDone;
                const fill = !revealed ? 'var(--bg)' : b === null ? 'var(--bg)' : gray(b);
                return (
                  <rect
                    key={`${px}-${py}`}
                    x={px * CELL}
                    y={py * CELL}
                    width={CELL}
                    height={CELL}
                    fill={fill}
                    stroke="var(--border)"
                    strokeWidth={0.4}
                  />
                );
              }),
            )}
            {/* scanline cursor */}
            {rowsDone < RES && <line x1={0} y1={rowsDone * CELL} x2={SVG} y2={rowsDone * CELL} style={{ stroke: amber }} strokeWidth={2} />}
          </svg>
        </div>

        <div className="flex-1 text-sm">
          <div className="rounded-lg border border-edge bg-bg p-3 font-mono text-xs text-muted">
            <div className="text-fg">per pixel</div>
            <div className="mt-1">1. ray d = normalize(u, v, -1)</div>
            <div>2. solve |o + t&middot;d - c| = r</div>
            <div>3. normal n = (hit - c) / r</div>
            <div>4. shade = max(0, n &middot; l)</div>
            <div className="mt-2 text-muted/70">
              row {Math.min(rowsDone, RES)}/{RES} traced
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">
            Each cell is one ray. Where it hits the sphere, brightness is the dot product of the surface
            normal and the light direction — facing the light is bright, facing away is dark.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={prev} disabled={index <= 0}>
          <Icon name="chevron-left" size={16} /> Prev row
        </button>
        <button
          type="button"
          onClick={() => (playing ? pause() : play())}
          className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90"
        >
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Render'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= RES}>
          Next row <Icon name="chevron-right" size={16} />
        </button>
        <button type="button" className={btn} onClick={() => seek(RES)} disabled={index >= RES}>
          <Icon name="check" size={16} /> Render all
        </button>
        <button type="button" className={btn} onClick={reset} disabled={index === 0}>
          <Icon name="rotate-ccw" size={16} /> Reset
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={1} max={20} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>
    </div>
  );
}
