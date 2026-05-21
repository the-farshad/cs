import { useState } from 'react';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent';

const SIZE = 340;
const C = SIZE / 2;
const UNIT = 60; // pixels per unit

// World (x up, y up) -> SVG pixel coordinates (y flips).
const px = (x: number) => C + x * UNIT;
const py = (y: number) => C - y * UNIT;

type Preset = { label: string; m: [number, number, number, number] };
const PRESETS: Preset[] = [
  { label: 'Identity', m: [1, 0, 0, 1] },
  { label: 'Scale 2x', m: [2, 0, 0, 2] },
  { label: 'Rotate 45°', m: [0.71, -0.71, 0.71, 0.71] },
  { label: 'Shear', m: [1, 1, 0, 1] },
  { label: 'Flip', m: [-1, 0, 0, 1] },
];

export default function MatrixTransform() {
  // Column-major intuition but stored as a,b,c,d for [[a,b],[c,d]].
  const [a, setA] = useState(1);
  const [b, setB] = useState(0.5);
  const [c, setC] = useState(0);
  const [d, setD] = useState(1);

  // Basis vectors after transform: î -> (a,c), ĵ -> (b,d).
  const iHat = { x: a, y: c };
  const jHat = { x: b, y: d };

  // Transformed unit square corners: 0, î, î+ĵ, ĵ.
  const square = [
    { x: 0, y: 0 },
    { x: iHat.x, y: iHat.y },
    { x: iHat.x + jHat.x, y: iHat.y + jHat.y },
    { x: jHat.x, y: jHat.y },
  ];
  const polyPoints = square.map((p) => `${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ');

  const det = a * d - b * c;

  const apply = (m: [number, number, number, number]) => {
    setA(m[0]);
    setB(m[1]);
    setC(m[2]);
    setD(m[3]);
  };

  const gridLines: number[] = [-2, -1, 1, 2];

  const Arrow = ({ v, color, label }: { v: { x: number; y: number }; color: string; label: string }) => {
    const angle = Math.atan2(py(v.y) - C, px(v.x) - C);
    const len = 9;
    const tipx = px(v.x);
    const tipy = py(v.y);
    return (
      <g>
        <line x1={C} y1={C} x2={tipx} y2={tipy} style={{ stroke: color }} strokeWidth={2.5} />
        <polygon
          points={`${tipx},${tipy} ${tipx - len * Math.cos(angle - 0.4)},${tipy - len * Math.sin(angle - 0.4)} ${tipx - len * Math.cos(angle + 0.4)},${tipy - len * Math.sin(angle + 0.4)}`}
          style={{ fill: color }}
        />
        <text x={tipx + 6} y={tipy - 4} style={{ fill: color }} className="font-mono text-xs">
          {label}
        </text>
      </g>
    );
  };

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" className={btn} onClick={() => apply(p.m)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="mx-auto block w-full max-w-sm"
          style={{ maxHeight: '20rem' }}
          role="img"
          aria-label="2x2 matrix transform of the unit square"
        >
          {/* faint grid */}
          {gridLines.map((g) => (
            <g key={g}>
              <line x1={px(g)} y1={0} x2={px(g)} y2={SIZE} style={{ stroke: 'var(--border)' }} strokeWidth={0.5} opacity={0.5} />
              <line x1={0} y1={py(g)} x2={SIZE} y2={py(g)} style={{ stroke: 'var(--border)' }} strokeWidth={0.5} opacity={0.5} />
            </g>
          ))}
          {/* axes */}
          <line x1={0} y1={C} x2={SIZE} y2={C} style={{ stroke: 'var(--border)' }} strokeWidth={1.25} />
          <line x1={C} y1={0} x2={C} y2={SIZE} style={{ stroke: 'var(--border)' }} strokeWidth={1.25} />
          {/* original unit square outline */}
          <polygon
            points={`${px(0)},${py(0)} ${px(1)},${py(0)} ${px(1)},${py(1)} ${px(0)},${py(1)}`}
            fill="none"
            style={{ stroke: 'var(--muted)' }}
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          {/* transformed square (area = |det|) */}
          <polygon points={polyPoints} style={{ fill: det >= 0 ? '#8b5cf6' : '#f43f5e', fillOpacity: 0.22, stroke: det >= 0 ? '#8b5cf6' : '#f43f5e' }} strokeWidth={2} />
          {/* basis vectors */}
          <Arrow v={iHat} color="#38bdf8" label="î" />
          <Arrow v={jHat} color="#10b981" label="ĵ" />
        </svg>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm text-muted">
          {([
            ['a', a, setA],
            ['b', b, setB],
            ['c', c, setC],
            ['d', d, setD],
          ] as [string, number, (n: number) => void][]).map(([name, val, set]) => (
            <label key={name} className="flex flex-col gap-1">
              <span className="font-mono">
                {name} = {val.toFixed(2)}
              </span>
              <input
                type="range"
                min={-2}
                max={2}
                step={0.05}
                value={val}
                onChange={(e) => set(Number(e.target.value))}
                className="accent-[var(--accent)]"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-edge pt-4 font-mono text-sm">
        <span className="text-muted">
          M = [[{a.toFixed(2)}, {b.toFixed(2)}], [{c.toFixed(2)}, {d.toFixed(2)}]]
        </span>
        <span style={{ color: det >= 0 ? '#8b5cf6' : '#f43f5e' }}>
          det = ad − bc = {det.toFixed(2)} {det < 0 && '(orientation flipped)'}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted">
        The shaded area equals |det|. det = 0 collapses the square to a line (the matrix is not
        invertible); a negative det means the plane was flipped over.
      </p>
    </div>
  );
}
