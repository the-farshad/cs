import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

type SeriesKey = 'geo-half' | 'geo-third' | 'harmonic' | 'altharm' | 'geo-two';

type Series = {
  label: string;
  term: (n: number) => number; // nth term, n starting at 1
  limit: number | null; // finite sum, or null if it diverges
  note: string;
};

const SERIES: Record<SeriesKey, Series> = {
  'geo-half': {
    label: 'Geometric  Σ 1/2ⁿ',
    term: (n) => Math.pow(0.5, n),
    limit: 1,
    note: 'ratio r = 1/2 < 1 → converges to a/(1−r) = 1',
  },
  'geo-third': {
    label: 'Geometric  Σ 1/3ⁿ',
    term: (n) => Math.pow(1 / 3, n),
    limit: 0.5,
    note: 'ratio r = 1/3 < 1 → converges to 1/2',
  },
  harmonic: {
    label: 'Harmonic  Σ 1/n',
    term: (n) => 1 / n,
    limit: null,
    note: 'terms shrink, yet the sum grows without bound → diverges',
  },
  altharm: {
    label: 'Alternating  Σ (−1)ⁿ⁺¹/n',
    term: (n) => (n % 2 === 1 ? 1 / n : -1 / n),
    limit: Math.log(2),
    note: 'alternating signs let it converge to ln 2 ≈ 0.693',
  },
  'geo-two': {
    label: 'Geometric  Σ (3/2)ⁿ',
    term: (n) => Math.pow(1.5, n),
    limit: null,
    note: 'ratio r = 3/2 ≥ 1 → terms grow → diverges',
  },
};

const N = 28; // number of partial sums to plot
const W = 560;
const H = 300;
const PAD = 36;

export default function PartialSumsExplorer() {
  const [key, setKey] = useState<SeriesKey>('geo-half');
  const series = SERIES[key];

  // Partial sums S_1 .. S_N.
  const partials = useMemo(() => {
    const out: number[] = [];
    let acc = 0;
    for (let n = 1; n <= N; n++) {
      acc += series.term(n);
      out.push(acc);
    }
    return out;
  }, [key]);

  const frameCount = N;
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frameCount, 5);
  const shown = index + 1;

  // y-range that fits the partial sums (and the limit if finite).
  const { yMin, yMax } = useMemo(() => {
    const vals = [...partials];
    if (series.limit !== null) vals.push(series.limit);
    let lo = Math.min(0, ...vals);
    let hi = Math.max(...vals);
    const pad = (hi - lo) * 0.12 || 1;
    return { yMin: lo - pad, yMax: hi + pad };
  }, [partials, key]);

  const toPx = (i: number) => PAD + (i / Math.max(N - 1, 1)) * (W - 2 * PAD);
  const toPy = (y: number) => H - PAD - ((y - yMin) / (yMax - yMin)) * (H - 2 * PAD);

  const linePts = partials.slice(0, shown).map((y, i) => `${toPx(i).toFixed(1)},${toPy(y).toFixed(1)}`);
  const current = partials[index];

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={key}
          onChange={(e) => setKey(e.target.value as SeriesKey)}
          className="rounded border border-edge bg-bg px-2 py-1 text-sm text-fg"
        >
          {(Object.keys(SERIES) as SeriesKey[]).map((k) => (
            <option key={k} value={k}>
              {SERIES[k].label}
            </option>
          ))}
        </select>
        <span
          className="rounded border px-2 py-0.5 font-mono text-xs"
          style={
            series.limit !== null
              ? { borderColor: '#10b981', color: '#10b981' }
              : { borderColor: '#f43f5e', color: '#f43f5e' }
          }
        >
          {series.limit !== null ? 'converges' : 'diverges'}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-edge bg-bg/40" style={{ maxHeight: '19rem' }} role="img" aria-label="partial sums of a series">
        {/* zero axis */}
        {toPy(0) >= PAD && toPy(0) <= H - PAD && (
          <line x1={PAD} y1={toPy(0)} x2={W - PAD} y2={toPy(0)} style={{ stroke: 'var(--border)' }} strokeWidth={1} />
        )}
        {/* limit line */}
        {series.limit !== null && (
          <g>
            <line
              x1={PAD}
              y1={toPy(series.limit)}
              x2={W - PAD}
              y2={toPy(series.limit)}
              style={{ stroke: '#10b981' }}
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
            <text x={W - PAD} y={toPy(series.limit) - 6} textAnchor="end" fontSize={11} style={{ fill: '#10b981', fontFamily: 'var(--font-mono)' }}>
              limit = {series.limit.toFixed(3)}
            </text>
          </g>
        )}
        {/* partial-sum bars from the axis */}
        {partials.slice(0, shown).map((y, i) => (
          <line
            key={i}
            x1={toPx(i)}
            y1={toPy(0)}
            x2={toPx(i)}
            y2={toPy(y)}
            style={{ stroke: 'var(--border)' }}
            strokeWidth={1}
          />
        ))}
        {/* partial-sum trace */}
        <polyline points={linePts.join(' ')} fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth={2.5} />
        {partials.slice(0, shown).map((y, i) => (
          <circle key={i} cx={toPx(i)} cy={toPy(y)} r={i === index ? 4 : 2.5} style={{ fill: i === index ? '#fbbf24' : 'var(--accent)' }} />
        ))}
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={prev} disabled={index <= 0} aria-label="One fewer term">
          <Icon name="chevron-left" size={16} /> Term
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90"
          onClick={() => (playing ? pause() : play())}
        >
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Accumulate'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= frameCount - 1} aria-label="One more term">
          Term <Icon name="chevron-right" size={16} />
        </button>
        <button type="button" className={btn} onClick={reset} disabled={index === 0}>
          <Icon name="rotate-ccw" size={16} /> Reset
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input
            type="range"
            min={1}
            max={20}
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
        <span className="shrink-0 font-mono text-xs text-muted">n = {shown}/{N}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-edge pt-4 font-mono text-xs">
        <span style={{ color: 'var(--accent)' }}>partial sum S({shown}) ≈ {current.toFixed(4)}</span>
        {series.limit !== null && (
          <span className="text-muted">distance to limit ≈ {Math.abs(series.limit - current).toFixed(4)}</span>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">{series.note}.</p>
    </div>
  );
}
