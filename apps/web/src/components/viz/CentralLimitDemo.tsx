import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

// Deterministic PRNG so a given run is reproducible when scrubbing.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pop = 'uniform' | 'skewed' | 'bimodal';

// Each population draws a single value in [0, 1]. None of them is normal.
const POPS: Record<Pop, { label: string; draw: (r: () => number) => number }> = {
  uniform: { label: 'Uniform (flat)', draw: (r) => r() },
  skewed: { label: 'Skewed (right tail)', draw: (r) => r() * r() * r() },
  bimodal: { label: 'Bimodal (two peaks)', draw: (r) => (r() < 0.5 ? r() * 0.3 : 0.7 + r() * 0.3) },
};

const BINS = 24;
const TOTAL_SAMPLES = 800; // sample means we will collect
const STEPS = 80; // animation frames

const W = 560;
const H = 220;
const PAD = 30;

// Population shape, sampled densely for the reference panel.
function popHistogram(pop: Pop, seed: number) {
  const r = mulberry32(seed * 31 + 5);
  const counts = new Array(BINS).fill(0);
  for (let i = 0; i < 4000; i++) {
    const x = POPS[pop].draw(r);
    counts[Math.min(BINS - 1, Math.floor(x * BINS))]++;
  }
  return counts;
}

export default function CentralLimitDemo() {
  const [pop, setPop] = useState<Pop>('skewed');
  const [n, setN] = useState(5); // sample size averaged into each mean
  const [seed, setSeed] = useState(1);

  // Precompute the whole stream of sample means once per (pop, n, seed).
  const means = useMemo(() => {
    const r = mulberry32(seed * 1000 + n * 7 + 3);
    const out: number[] = [];
    for (let s = 0; s < TOTAL_SAMPLES; s++) {
      let sum = 0;
      for (let j = 0; j < n; j++) sum += POPS[pop].draw(r);
      out.push(sum / n);
    }
    return out;
  }, [pop, n, seed]);

  const frameCount = STEPS + 1;
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frameCount);
  const taken = Math.round((index / STEPS) * TOTAL_SAMPLES);

  // Histogram of the sample means collected so far.
  const { counts, mean, sd } = useMemo(() => {
    const c = new Array(BINS).fill(0);
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < taken; i++) {
      const x = means[i];
      c[Math.min(BINS - 1, Math.floor(x * BINS))]++;
      sum += x;
      sumSq += x * x;
    }
    const m = taken ? sum / taken : 0;
    const v = taken ? sumSq / taken - m * m : 0;
    return { counts: c, mean: m, sd: Math.sqrt(Math.max(v, 0)) };
  }, [means, taken]);

  const popCounts = useMemo(() => popHistogram(pop, seed), [pop, seed]);

  const maxCount = Math.max(1, ...counts);
  const popMax = Math.max(1, ...popCounts);

  // Normal curve N(mean, sd) overlaid on the sample-mean histogram.
  const normalPath = useMemo(() => {
    if (taken < 20 || sd <= 0) return '';
    const peak = 1 / (sd * Math.sqrt(2 * Math.PI));
    const pts: string[] = [];
    for (let i = 0; i <= 120; i++) {
      const x = i / 120; // value in [0,1]
      const z = (x - mean) / sd;
      const density = (1 / (sd * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
      const px = PAD + x * (W - 2 * PAD);
      const py = H - PAD - (density / peak) * (H - 2 * PAD) * 0.92;
      pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
    }
    return pts.join(' ');
  }, [taken, mean, sd]);

  const reseed = () => setSeed((s) => s + 1);

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={pop}
          onChange={(e) => setPop(e.target.value as Pop)}
          className="rounded border border-edge bg-bg px-2 py-1 text-sm text-fg"
        >
          {(Object.keys(POPS) as Pop[]).map((k) => (
            <option key={k} value={k}>
              {POPS[k].label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-muted">
          sample size n = {n}
          <input
            type="range"
            min={1}
            max={30}
            value={n}
            onChange={(e) => setN(Number(e.target.value))}
            className="accent-[var(--accent)]"
          />
        </label>
        <button type="button" className={btn} onClick={reseed}>
          <Icon name="shuffle" size={16} /> New run
        </button>
      </div>

      {/* Population (not normal) */}
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
        Population — the raw distribution (not normal)
      </div>
      <div className="flex h-20 items-end gap-px rounded-lg border border-edge bg-bg/40 p-2" role="img" aria-label="population distribution">
        {popCounts.map((c, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm"
            style={{ height: `${(c / popMax) * 100}%`, background: '#8b5cf6' }}
          />
        ))}
      </div>

      {/* Sample means → normal */}
      <div className="mb-2 mt-4 text-xs font-medium uppercase tracking-wide text-muted">
        Distribution of sample means (averages of {n}) — approaches a normal curve
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-edge bg-bg/40" style={{ maxHeight: '15rem' }} role="img" aria-label="sampling distribution of the mean">
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} style={{ stroke: 'var(--border)' }} strokeWidth={1} />
        {counts.map((c, i) => {
          const bw = (W - 2 * PAD) / BINS;
          const bh = (c / maxCount) * (H - 2 * PAD) * 0.92;
          return (
            <rect
              key={i}
              x={PAD + i * bw + 0.5}
              y={H - PAD - bh}
              width={bw - 1}
              height={bh}
              rx={1}
              style={{ fill: 'var(--accent)' }}
            />
          );
        })}
        {normalPath && <polyline points={normalPath} fill="none" style={{ stroke: '#fbbf24' }} strokeWidth={2.5} />}
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={prev} disabled={index <= 0} aria-label="Fewer samples">
          <Icon name="chevron-left" size={16} /> Step
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90"
          onClick={() => (playing ? pause() : play())}
        >
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Sample'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= frameCount - 1} aria-label="More samples">
          Step <Icon name="chevron-right" size={16} />
        </button>
        <button type="button" className={btn} onClick={reset} disabled={index === 0}>
          <Icon name="rotate-ccw" size={16} /> Reset
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input
            type="range"
            min={1}
            max={30}
            value={fps}
            onChange={(e) => setFps(Number(e.target.value))}
            className="accent-[var(--accent)]"
          />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={frameCount - 1}
          value={index}
          onChange={(e) => seek(Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
          aria-label="Timeline"
        />
        <span className="shrink-0 font-mono text-xs text-muted">
          {taken}/{TOTAL_SAMPLES}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-edge pt-4 font-mono text-xs">
        <span className="text-muted">means collected: {taken}</span>
        <span style={{ color: 'var(--accent)' }}>mean of means ≈ {mean.toFixed(3)}</span>
        <span style={{ color: '#fbbf24' }}>spread (SD) ≈ {sd.toFixed(3)}</span>
      </div>
      <p className="mt-2 text-xs text-muted">
        No matter how lumpy the population is, the average of {n} draws clusters into a bell shape. Raise n and the
        bell narrows — its spread shrinks like 1/√n. That is the Central Limit Theorem.
      </p>
    </div>
  );
}
