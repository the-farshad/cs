import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const N = 8; // number of items in the search space

// One Grover iteration on a real amplitude vector:
//   1. oracle: flip the sign of the marked item's amplitude
//   2. diffusion: invert every amplitude about the mean ( a -> 2*mean - a )
function groverStep(amps: number[], marked: number): number[] {
  const oracled = amps.map((a, i) => (i === marked ? -a : a));
  const mean = oracled.reduce((s, a) => s + a, 0) / oracled.length;
  return oracled.map((a) => 2 * mean - a);
}

// Optimal iteration count for an N-item search: round( (π/4)·√N ).
function optimalIters(n: number): number {
  return Math.max(1, Math.round((Math.PI / 4) * Math.sqrt(n)));
}

// Build every snapshot: frame 0 = uniform superposition, then after-oracle and
// after-diffusion sub-frames per iteration so the user can watch both phases.
type Frame = { amps: number[]; phase: 'init' | 'oracle' | 'diffusion'; iter: number };

function buildFrames(marked: number, iters: number): Frame[] {
  const start = new Array(N).fill(1 / Math.sqrt(N));
  const frames: Frame[] = [{ amps: start, phase: 'init', iter: 0 }];
  let amps = start;
  for (let k = 1; k <= iters; k++) {
    const oracled = amps.map((a, i) => (i === marked ? -a : a));
    frames.push({ amps: oracled, phase: 'oracle', iter: k });
    const mean = oracled.reduce((s, a) => s + a, 0) / oracled.length;
    const diffused = oracled.map((a) => 2 * mean - a);
    frames.push({ amps: diffused, phase: 'diffusion', iter: k });
    amps = diffused;
  }
  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const phaseText: Record<Frame['phase'], string> = {
  init: 'uniform superposition — every item equally likely',
  oracle: 'oracle: the marked item’s amplitude is flipped negative',
  diffusion: 'diffusion: invert about the mean — the marked item grows',
};

export default function GroverSearchVisualizer() {
  const [marked, setMarked] = useState(5);
  const iters = useMemo(() => optimalIters(N), []);
  const frames = useMemo(() => buildFrames(marked, iters), [marked, iters]);

  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 3);
  const i = Math.min(index, frames.length - 1);
  const frame = frames[i];
  const probs = frame.amps.map((a) => a * a);
  const markedProb = probs[marked];

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">marked item (the &ldquo;needle&rdquo;):</span>
        {Array.from({ length: N }, (_, k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setMarked(k);
              reset();
            }}
            className={`inline-flex h-7 w-7 items-center justify-center rounded border font-mono text-sm transition ${
              k === marked ? 'border-accent bg-accent text-accent-fg' : 'border-edge text-fg hover:border-accent hover:text-accent'
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      <div className="flex h-56 items-end gap-2 border-b border-edge pb-1">
        {probs.map((p, k) => {
          const isMarked = k === marked;
          const neg = frame.amps[k] < -1e-9;
          return (
            <div key={k} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span className="font-mono text-[10px] text-muted">{(p * 100).toFixed(0)}%</span>
              <div
                className="w-full rounded-t transition-all"
                style={{
                  height: `${Math.max(p * 100 * 1.7, 1.5)}%`,
                  background: isMarked ? '#10b981' : neg ? '#f43f5e' : 'var(--accent)',
                  opacity: isMarked ? 1 : 0.85,
                }}
                title={neg ? 'amplitude is negative (sign flipped)' : ''}
              />
              <span className={`font-mono text-xs ${isMarked ? 'text-accent' : 'text-muted'}`}>{k}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={prev} disabled={index <= 0}>
          <Icon name="chevron-left" size={16} /> Step
        </button>
        <button
          type="button"
          onClick={() => (playing ? pause() : play())}
          className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90"
        >
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Run'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= frames.length - 1}>
          Step <Icon name="chevron-right" size={16} />
        </button>
        <button type="button" className={btn} onClick={reset} disabled={index === 0}>
          <Icon name="rotate-ccw" size={16} /> Reset
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={1} max={8} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={Math.max(frames.length - 1, 0)}
          value={index}
          onChange={(e) => seek(Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
          aria-label="Timeline"
        />
        <span className="shrink-0 font-mono text-xs text-muted">
          {frame.phase === 'init' ? 'start' : `iter ${frame.iter}/${iters}`}
        </span>
      </div>

      <div className="mt-4 space-y-1 border-t border-edge pt-4 font-mono text-xs text-muted">
        <div>{phaseText[frame.phase]}</div>
        <div>
          P(item {marked}) = <span style={{ color: markedProb > 0.5 ? '#10b981' : 'var(--accent)' }}>{(markedProb * 100).toFixed(1)}%</span>
          {' '}· optimal iterations for N={N} is {iters} (classical search needs up to {N} checks)
        </div>
      </div>
    </div>
  );
}
