import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// Pixel grid raster demo: Bresenham line + triangle scanline fill, step by step.

const GRID = 16; // 16x16 cells
const CELL = 22; // px per cell
const PAD = 1;

const sky = '#38bdf8';
const amber = '#fbbf24';
const emerald = '#10b981';
const violet = '#8b5cf6';

type Pixel = { x: number; y: number; note?: string };

// Integer Bresenham line, recording each plotted pixel + the decision variable.
function bresenham(x0: number, y0: number, x1: number, y1: number): Pixel[] {
  const out: Pixel[] = [];
  let dx = Math.abs(x1 - x0);
  let dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  // guard against runaway loops
  for (let guard = 0; guard < 256; guard++) {
    out.push({ x, y, note: `err=${err}` });
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return out;
}

// Triangle scanline fill: for each row, find span between the two edges and fill.
function fillTriangle(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
): Pixel[] {
  const out: Pixel[] = [];
  const minY = Math.max(0, Math.floor(Math.min(p0.y, p1.y, p2.y)));
  const maxY = Math.min(GRID - 1, Math.ceil(Math.max(p0.y, p1.y, p2.y)));
  // edge as x at a given scan y, via the sign of the cross products (barycentric inside test)
  const inside = (px: number, py: number) => {
    const d1 = (px - p1.x) * (p0.y - p1.y) - (p0.x - p1.x) * (py - p1.y);
    const d2 = (px - p2.x) * (p1.y - p2.y) - (p1.x - p2.x) * (py - p2.y);
    const d3 = (px - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (py - p0.y);
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos);
  };
  for (let y = minY; y <= maxY; y++) {
    for (let x = 0; x < GRID; x++) {
      // sample at pixel center
      if (inside(x + 0.5, y + 0.5)) out.push({ x, y, note: `row ${y}` });
    }
  }
  return out;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

type Mode = 'line' | 'triangle';

export default function RasterizeGrid() {
  const [mode, setMode] = useState<Mode>('line');

  // endpoints / vertices in grid coords
  const line = { x0: 2, y0: 13, x1: 14, y1: 4 };
  const tri = [
    { x: 3, y: 2 },
    { x: 13, y: 6 },
    { x: 6, y: 13 },
  ];

  const pixels = useMemo<Pixel[]>(() => {
    if (mode === 'line') return bresenham(line.x0, line.y0, line.x1, line.y1);
    return fillTriangle(tri[0], tri[1], tri[2]);
  }, [mode]);

  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(pixels.length, 6);
  const step = Math.min(index, pixels.length - 1);
  const cur = pixels[step];

  const SVG = GRID * CELL;
  const fillColor = mode === 'line' ? sky : violet;

  // ideal geometry overlay (in pixel space, cell-centered)
  const cc = (n: number) => n * CELL + CELL / 2;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap gap-1.5">
        <button type="button" className={`${btn} ${mode === 'line' ? 'border-accent text-accent' : ''}`} onClick={() => setMode('line')}>
          Bresenham line
        </button>
        <button type="button" className={`${btn} ${mode === 'triangle' ? 'border-accent text-accent' : ''}`} onClick={() => setMode('triangle')}>
          Triangle fill
        </button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <svg viewBox={`0 0 ${SVG} ${SVG}`} className="mx-auto block w-full max-w-md" style={{ maxHeight: '24rem' }} role="img" aria-label="pixel grid rasterization">
          {/* grid cells */}
          {Array.from({ length: GRID }).map((_, y) =>
            Array.from({ length: GRID }).map((__, x) => (
              <rect
                key={`${x}-${y}`}
                x={x * CELL + PAD}
                y={y * CELL + PAD}
                width={CELL - 2 * PAD}
                height={CELL - 2 * PAD}
                rx={2}
                fill="var(--bg)"
                stroke="var(--border)"
                strokeWidth={0.5}
              />
            )),
          )}
          {/* filled pixels up to current step */}
          {pixels.slice(0, step + 1).map((p, i) => (
            <rect
              key={i}
              x={p.x * CELL + PAD}
              y={p.y * CELL + PAD}
              width={CELL - 2 * PAD}
              height={CELL - 2 * PAD}
              rx={2}
              fill={fillColor}
              fillOpacity={i === step ? 0.95 : 0.5}
              stroke={i === step ? amber : 'none'}
              strokeWidth={i === step ? 2 : 0}
            />
          ))}
          {/* ideal geometry overlay */}
          {mode === 'line' ? (
            <line x1={cc(line.x0)} y1={cc(line.y0)} x2={cc(line.x1)} y2={cc(line.y1)} style={{ stroke: emerald }} strokeWidth={1.5} strokeDasharray="4 3" />
          ) : (
            <polygon
              points={tri.map((p) => `${cc(p.x)},${cc(p.y)}`).join(' ')}
              fill="none"
              style={{ stroke: emerald }}
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          )}
        </svg>

        <div className="flex-1 text-sm">
          <div className="rounded-lg border border-edge bg-bg p-3 font-mono text-xs text-muted">
            {mode === 'line' ? (
              <>
                <div className="text-fg">Bresenham (integer only)</div>
                <div className="mt-1">dx={Math.abs(line.x1 - line.x0)}, dy={Math.abs(line.y1 - line.y0)}</div>
                <div>
                  plot ({cur.x}, {cur.y}) &middot; {cur.note}
                </div>
                <div className="mt-1 text-muted/70">2&middot;err vs dx, dy decides step in x, y, or both.</div>
              </>
            ) : (
              <>
                <div className="text-fg">Scanline fill</div>
                <div className="mt-1">
                  fill ({cur.x}, {cur.y}) &middot; {cur.note}
                </div>
                <div className="mt-1 text-muted/70">A pixel center inside all three edges gets filled.</div>
              </>
            )}
          </div>
          <p className="mt-3 text-xs text-muted">
            The dashed green outline is the ideal shape. Notice the filled cells only approximate it — that
            staircase is aliasing.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={prev} disabled={index <= 0}>
          <Icon name="chevron-left" size={16} /> Prev
        </button>
        <button
          type="button"
          onClick={() => (playing ? pause() : play())}
          className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90"
        >
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= pixels.length - 1}>
          Next <Icon name="chevron-right" size={16} />
        </button>
        <button type="button" className={btn} onClick={reset} disabled={index === 0}>
          <Icon name="rotate-ccw" size={16} /> Reset
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={1} max={20} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input type="range" min={0} max={pixels.length - 1} value={index} onChange={(e) => seek(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Timeline" />
        <span className="shrink-0 font-mono text-xs text-muted">
          pixel {step + 1}/{pixels.length}
        </span>
      </div>
    </div>
  );
}
