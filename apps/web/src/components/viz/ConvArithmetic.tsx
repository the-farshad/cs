import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const SKY = '#38bdf8';
const VIOLET = '#8b5cf6';

type Mode = 'conv' | 'transposed';

function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      <span className="w-16 shrink-0">{label} <span className="font-mono text-fg">{value}</span></span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-[var(--accent)]" />
    </label>
  );
}

export default function ConvArithmetic() {
  const [i, setI] = useState(5);
  const [k, setK] = useState(3);
  const [p, setP] = useState(0);
  const [s, setS] = useState(1);
  const [d, setD] = useState(1);
  const [mode, setMode] = useState<Mode>('conv');

  const geom = useMemo(() => {
    if (mode === 'conv') {
      const kEff = k + (k - 1) * (d - 1);
      const padded = i + 2 * p;
      const o = padded >= kEff ? Math.floor((padded - kEff) / s) + 1 : 0;
      return { kEff, padded, o };
    }
    const o = s * (i - 1) + k - 2 * p;
    return { kEff: k, padded: i, o: Math.max(o, 0) };
  }, [i, k, p, s, d, mode]);

  const { kEff, padded, o } = geom;
  const positions = mode === 'conv' ? Math.max(o * o, 1) : i * i;
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(positions, 4);
  const step = Math.min(index, positions - 1);

  // Current focus + which output cells are done.
  const { taps, block, doneOut, cur } = useMemo(() => {
    const taps = new Set<string>(); // conv: dilated kernel taps on the padded grid
    const block = new Set<string>(); // transposed: output cells the current input writes
    const doneOut = new Set<string>(); // output cells already produced
    let cur = { r: 0, c: 0 };
    if (mode === 'conv') {
      if (o > 0) {
        const cr = Math.floor(step / o);
        const cc = step % o;
        cur = { r: cr, c: cc };
        for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) taps.add(`${cr * s + a * d},${cc * s + b * d}`);
        for (let st = 0; st <= step; st++) doneOut.add(`${Math.floor(st / o)},${st % o}`);
      }
    } else {
      const ir = Math.floor(step / i);
      const ic = step % i;
      cur = { r: ir, c: ic };
      const stamp = (t: number, set: Set<string>) => {
        const sr = Math.floor(t / i);
        const sc = t % i;
        for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) {
          const rr = sr * s - p + a;
          const cc = sc * s - p + b;
          if (rr >= 0 && rr < o && cc >= 0 && cc < o) set.add(`${rr},${cc}`);
        }
      };
      stamp(step, block);
      for (let st = 0; st <= step; st++) stamp(st, doneOut);
    }
    return { taps, block, doneOut, cur };
  }, [mode, step, i, k, p, s, d, o]);

  const inDim = mode === 'conv' ? padded : i;
  const cell = Math.max(12, Math.min(38, Math.floor(230 / Math.max(inDim, o, 1))));
  const gap = 3;
  const xy = (n: number) => n * (cell + gap);
  const dimPx = (n: number) => n * cell + (n - 1) * gap;

  const grid = (
    rows: number,
    cols: number,
    label: string,
    cellFn: (r: number, c: number) => { fill: string; stroke: string; dash?: boolean; faded?: boolean },
  ) => (
    <div>
      <div className="mb-1 text-center text-xs text-muted">{label} · {rows}×{cols}</div>
      <svg viewBox={`0 0 ${Math.max(dimPx(cols), 1)} ${Math.max(dimPx(rows), 1)}`} width={dimPx(cols)} height={dimPx(rows)} role="img" aria-label={label}>
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => {
            const st = cellFn(r, c);
            return (
              <rect
                key={`${r}-${c}`}
                x={xy(c)}
                y={xy(r)}
                width={cell}
                height={cell}
                rx={2}
                fill={st.fill}
                stroke={st.stroke}
                strokeWidth={st.dash ? 1 : 2}
                strokeDasharray={st.dash ? '3 2' : undefined}
                opacity={st.faded ? 0.5 : 1}
              />
            );
          }),
        )}
      </svg>
    </div>
  );

  // Input renderer.
  const inputGrid = grid(inDim, inDim, mode === 'conv' ? 'input + padding' : 'input', (r, c) => {
    if (mode === 'conv') {
      const isReal = r >= p && r < p + i && c >= p && c < p + i;
      const isTap = o > 0 && taps.has(`${r},${c}`);
      if (!isReal) return { fill: 'var(--bg)', stroke: 'var(--border)', dash: true };
      return { fill: isTap ? SKY : 'var(--surface)', stroke: isTap ? SKY : 'var(--border)' };
    }
    const isCur = r === cur.r && c === cur.c;
    return { fill: isCur ? SKY : 'var(--surface)', stroke: isCur ? SKY : 'var(--border)' };
  });

  const outputGrid =
    o > 0
      ? grid(o, o, 'output', (r, c) => {
          const key = `${r},${c}`;
          const isCur = mode === 'conv' ? r === cur.r && c === cur.c : block.has(key);
          const done = doneOut.has(key);
          return { fill: done ? VIOLET : 'var(--bg)', stroke: isCur ? SKY : 'var(--border)', faded: done && !isCur };
        })
      : (
        <div className="flex h-32 w-32 items-center justify-center rounded border border-dashed border-rose-500/60 text-center text-xs text-rose-300">
          kernel doesn't fit — increase input or padding
        </div>
      );

  const formula =
    mode === 'conv'
      ? `o = ⌊(${i} + 2·${p} − ${kEff}) / ${s}⌋ + 1 = ${o}`
      : `o = ${s}·(${i} − 1) + ${k} − 2·${p} = ${o}`;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded border border-edge">
          {(['conv', 'transposed'] as Mode[]).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m} className={`px-3 py-1 text-sm transition ${mode === m ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}>
              {m === 'conv' ? 'Convolution' : 'Transposed'}
            </button>
          ))}
        </div>
        <span className="font-mono text-xs text-muted">{mode === 'conv' ? 'downsample / extract' : 'upsample (decoder)'}</span>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:max-w-md">
        <Slider label="input i" value={i} min={3} max={mode === 'conv' ? 9 : 6} onChange={setI} />
        <Slider label="kernel k" value={k} min={2} max={5} onChange={setK} />
        <Slider label="pad p" value={p} min={0} max={3} onChange={setP} />
        <Slider label="stride s" value={s} min={1} max={3} onChange={setS} />
        {mode === 'conv' && <Slider label="dilation d" value={d} min={1} max={3} onChange={setD} />}
      </div>

      <div className="mt-5 flex flex-col items-center justify-center gap-6 sm:flex-row sm:items-start">
        {inputGrid}
        <div className="flex items-center self-center text-muted">
          <Icon name="arrow-right" size={20} />
        </div>
        {outputGrid}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={prev} disabled={index <= 0}>
          <Icon name="chevron-left" size={16} /> Prev
        </button>
        <button type="button" onClick={() => (playing ? pause() : play())} className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90">
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
        <span className="shrink-0 font-mono text-xs text-muted">{step + 1}/{positions}</span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">
        {mode === 'conv' && d > 1 ? `effective kernel = k + (k−1)(d−1) = ${kEff}  ·  ` : ''}
        {formula}
      </div>
    </div>
  );
}
