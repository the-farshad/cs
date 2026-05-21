import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

type Mode = 'coin' | 'die';

// Deterministic pseudo-random generator so the timeline is reproducible
// (scrubbing back and forth always shows the same draws).
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TOTAL = 600;

export default function LawOfLargeNumbers() {
  const [mode, setMode] = useState<Mode>('die');
  const [seed, setSeed] = useState(1);

  const faces = mode === 'coin' ? 2 : 6;
  const labels = mode === 'coin' ? ['Heads', 'Tails'] : ['1', '2', '3', '4', '5', '6'];
  const truth = 1 / faces;

  // Precompute the whole sequence of draws once per (mode, seed).
  const draws = useMemo(() => {
    const rng = mulberry32(seed * 1000 + (mode === 'coin' ? 7 : 13));
    return Array.from({ length: TOTAL }, () => Math.floor(rng() * faces));
  }, [mode, seed, faces]);

  // ~80 frames spread across TOTAL samples, so playback is smooth.
  const STEPS = 80;
  const frameCount = STEPS + 1;
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frameCount);
  const sampleCount = Math.round((index / STEPS) * TOTAL);

  const counts = useMemo(() => {
    const c = new Array(faces).fill(0);
    for (let i = 0; i < sampleCount; i++) c[draws[i]]++;
    return c;
  }, [draws, sampleCount, faces]);

  const total = Math.max(sampleCount, 1);
  const maxFrac = Math.max(truth * 1.6, ...counts.map((c: number) => c / total), 0.001);

  const reseed = () => setSeed((s) => s + 1);

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setMode('coin')}
            aria-pressed={mode === 'coin'}
            className={`rounded border px-2.5 py-1 text-sm transition ${mode === 'coin' ? 'border-accent bg-accent text-accent-fg' : 'border-edge text-muted hover:text-fg'}`}
          >
            Coin
          </button>
          <button
            type="button"
            onClick={() => setMode('die')}
            aria-pressed={mode === 'die'}
            className={`rounded border px-2.5 py-1 text-sm transition ${mode === 'die' ? 'border-accent bg-accent text-accent-fg' : 'border-edge text-muted hover:text-fg'}`}
          >
            Die
          </button>
        </div>
        <button type="button" className={btn} onClick={reseed}>
          <Icon name="shuffle" size={16} /> New run
        </button>
        <span className="font-mono text-sm text-muted">samples: {sampleCount}</span>
      </div>

      <div className="relative flex h-56 items-end gap-2 sm:gap-3" role="img" aria-label="empirical frequency histogram">
        {/* true-probability reference line */}
        <div
          className="pointer-events-none absolute left-0 right-0 border-t border-dashed"
          style={{ bottom: `${(truth / maxFrac) * 100}%`, borderColor: '#38bdf8' }}
        >
          <span className="absolute -top-5 right-0 font-mono text-xs" style={{ color: '#38bdf8' }}>
            true p = {truth.toFixed(3)}
          </span>
        </div>
        {counts.map((c: number, i: number) => {
          const frac = c / total;
          return (
            <div key={i} className="flex flex-1 flex-col items-center justify-end">
              <span className="mb-1 font-mono text-xs text-muted">{(frac || 0).toFixed(2)}</span>
              <div
                className="w-full rounded-t-sm transition-[height] duration-150"
                style={{ height: `${(frac / maxFrac) * 100}%`, background: 'var(--accent)' }}
              />
              <span className="mt-1 font-mono text-xs text-fg">{labels[i]}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
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
        <button
          type="button"
          className={btn}
          onClick={next}
          disabled={index >= frameCount - 1}
          aria-label="More samples"
        >
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
        <span className="shrink-0 font-mono text-xs text-muted">{sampleCount}/{TOTAL}</span>
      </div>

      <p className="mt-4 border-t border-edge pt-4 text-xs text-muted">
        Each bar is the <em>empirical</em> fraction of times a face appeared. As samples grow, every
        bar drifts toward the dashed true probability line — the law of large numbers in action.
      </p>
    </div>
  );
}
