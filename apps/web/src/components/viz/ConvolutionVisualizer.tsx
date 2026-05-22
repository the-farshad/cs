import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// A tiny 6x6 grayscale "image" (0..9) with a diagonal edge. Deterministic.
const IMG: number[][] = [
  [9, 9, 9, 1, 1, 1],
  [9, 9, 9, 1, 1, 1],
  [9, 9, 1, 1, 1, 1],
  [9, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 5, 5],
  [1, 1, 1, 1, 5, 5],
];

type KernelKey = 'edge' | 'blur' | 'sharpen' | 'sobelX';
const KERNELS: Record<KernelKey, { label: string; k: number[][]; norm: number }> = {
  edge: { label: 'Edge detect', k: [[-1, -1, -1], [-1, 8, -1], [-1, -1, -1]], norm: 1 },
  blur: { label: 'Box blur', k: [[1, 1, 1], [1, 1, 1], [1, 1, 1]], norm: 9 },
  sharpen: { label: 'Sharpen', k: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]], norm: 1 },
  sobelX: { label: 'Sobel (vertical)', k: [[1, 0, -1], [2, 0, -2], [1, 0, -1]], norm: 1 },
};

const N = IMG.length; // 6
const OUT = N - 2; // 4 (valid convolution, 3x3 kernel)
const CELL = 40;
const GAP = 4;

const sky = '#38bdf8';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

function gray(v: number) {
  const t = Math.max(0, Math.min(1, v / 9));
  const c = Math.round(30 + t * 210);
  return `rgb(${c},${c},${c})`;
}

// Map a (possibly negative) feature value to a violet→white scale for the output map.
function featColor(v: number, max: number) {
  const t = Math.max(0, Math.min(1, Math.abs(v) / (max || 1)));
  const c = Math.round(245 - t * 215);
  return `rgb(${139 + Math.round((255 - 139) * (1 - t))},${c},${Math.round(246 - t * 40)})`;
}

export default function ConvolutionVisualizer() {
  const [kKey, setKKey] = useState<KernelKey>('edge');
  const kernel = KERNELS[kKey];

  // full output feature map (valid convolution)
  const { feat, maxAbs } = useMemo(() => {
    const feat: number[][] = [];
    let maxAbs = 0;
    for (let r = 0; r < OUT; r++) {
      const row: number[] = [];
      for (let c = 0; c < OUT; c++) {
        let s = 0;
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) s += IMG[r + i][c + j] * kernel.k[i][j];
        s /= kernel.norm;
        row.push(s);
        maxAbs = Math.max(maxAbs, Math.abs(s));
      }
      feat.push(row);
    }
    return { feat, maxAbs };
  }, [kKey]);

  const positions = OUT * OUT; // 16 slide stops
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(positions, 4);
  const step = Math.min(index, positions - 1);
  const cr = Math.floor(step / OUT); // current output row
  const cc = step % OUT; // current output col

  // value being computed at this slide stop
  let dot = 0;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) dot += IMG[cr + i][cc + j] * kernel.k[i][j];
  dot /= kernel.norm;

  const gridW = N * CELL + (N - 1) * GAP;
  const gridH = gridW;
  const outW = OUT * CELL + (OUT - 1) * GAP;
  const xy = (idx: number) => idx * (CELL + GAP);

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={kKey} onChange={(e) => setKKey(e.target.value as KernelKey)} className="rounded border border-edge bg-bg px-2 py-1 text-fg">
          {(Object.keys(KERNELS) as KernelKey[]).map((k) => (
            <option key={k} value={k}>
              {KERNELS[k].label}
            </option>
          ))}
        </select>
        <span className="font-mono text-xs text-muted">3x3 kernel slides over a 6x6 input → 4x4 feature map</span>
      </div>

      <div className="flex flex-col items-center gap-5 md:flex-row md:items-start md:justify-center">
        {/* input image with sliding window */}
        <div>
          <div className="mb-1 text-center text-xs text-muted">input</div>
          <svg viewBox={`0 0 ${gridW} ${gridH}`} className="w-full max-w-[260px]" role="img" aria-label="input image with sliding kernel window">
            {IMG.map((row, r) =>
              row.map((v, c) => (
                <g key={`${r}-${c}`}>
                  <rect x={xy(c)} y={xy(r)} width={CELL} height={CELL} rx={3} fill={gray(v)} />
                  <text x={xy(c) + CELL / 2} y={xy(r) + CELL / 2 + 4} textAnchor="middle" style={{ fill: v > 5 ? '#111' : '#eee', fontSize: 13 }} className="font-mono">
                    {v}
                  </text>
                </g>
              )),
            )}
            {/* highlight the 3x3 receptive field */}
            <rect x={xy(cc) - 1} y={xy(cr) - 1} width={3 * CELL + 2 * GAP + 2} height={3 * CELL + 2 * GAP + 2} rx={4} fill="none" stroke={sky} strokeWidth={3} />
          </svg>
        </div>

        {/* the kernel */}
        <div className="self-center">
          <div className="mb-1 text-center text-xs text-muted">kernel ÷ {kernel.norm}</div>
          <svg viewBox={`0 0 ${3 * 34 + 2 * GAP} ${3 * 34 + 2 * GAP}`} className="w-24" role="img" aria-label="convolution kernel">
            {kernel.k.map((row, r) =>
              row.map((v, c) => (
                <g key={`${r}-${c}`}>
                  <rect x={c * (34 + GAP)} y={r * (34 + GAP)} width={34} height={34} rx={3} fill="var(--surface)" style={{ stroke: 'var(--accent)' }} strokeWidth={1.5} />
                  <text x={c * (34 + GAP) + 17} y={r * (34 + GAP) + 21} textAnchor="middle" style={{ fill: 'var(--fg)', fontSize: 12 }} className="font-mono">
                    {v}
                  </text>
                </g>
              )),
            )}
          </svg>
        </div>

        {/* output feature map, filled in as the window slides */}
        <div>
          <div className="mb-1 text-center text-xs text-muted">feature map</div>
          <svg viewBox={`0 0 ${outW} ${outW}`} className="w-full max-w-[180px]" role="img" aria-label="output feature map">
            {feat.map((row, r) =>
              row.map((v, c) => {
                const filled = r * OUT + c <= step;
                const isCur = r === cr && c === cc;
                return (
                  <g key={`${r}-${c}`}>
                    <rect
                      x={xy(c)}
                      y={xy(r)}
                      width={CELL}
                      height={CELL}
                      rx={3}
                      fill={filled ? featColor(v, maxAbs) : 'var(--bg)'}
                      stroke={isCur ? sky : 'var(--border)'}
                      strokeWidth={isCur ? 3 : 1}
                    />
                    {filled && (
                      <text x={xy(c) + CELL / 2} y={xy(r) + CELL / 2 + 4} textAnchor="middle" style={{ fill: '#111', fontSize: 11 }} className="font-mono">
                        {Math.round(v)}
                      </text>
                    )}
                  </g>
                );
              }),
            )}
          </svg>
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
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Slide'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= positions - 1}>
          Next <Icon name="chevron-right" size={16} />
        </button>
        <button type="button" className={btn} onClick={reset} disabled={index === 0}>
          <Icon name="rotate-ccw" size={16} /> Reset
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={1} max={12} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input type="range" min={0} max={positions - 1} value={index} onChange={(e) => seek(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Timeline" />
        <span className="shrink-0 font-mono text-xs text-muted">
          stop {step + 1}/{positions}
        </span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">
        output[{cr}][{cc}] = sum(window {String.fromCharCode(0x00d7)} kernel) {kernel.norm > 1 ? `${String.fromCharCode(0x00f7)} ${kernel.norm}` : ''} = {dot.toFixed(1)}
      </div>
    </div>
  );
}
