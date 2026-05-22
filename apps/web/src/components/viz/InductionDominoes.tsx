import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const COUNT = 10;
const W = 560;
const H = 200;

// Each claim P(k): "the sum 1 + 2 + ... + k equals k(k+1)/2".
const claimSum = (k: number) => (k * (k + 1)) / 2;

export default function InductionDominoes() {
  const [baseHolds, setBaseHolds] = useState(true);
  const [stepHolds, setStepHolds] = useState(true);

  // The chain advances one domino per frame; +1 frame for the resting start.
  const frameCount = COUNT + 1;
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frameCount, 4);

  // How many dominoes have fallen, given the toggles.
  const fallen = useMemo(() => {
    if (!baseHolds) return 0; // base case missing → nothing topples
    if (!stepHolds) return Math.min(index, 1); // only n=1 falls, chain breaks
    return index; // base + step → every domino up to `index` falls
  }, [index, baseHolds, stepHolds]);

  const proves = baseHolds && stepHolds;
  const slotW = (W - 40) / COUNT;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setBaseHolds((v) => !v)}
          aria-pressed={baseHolds}
          className={`rounded border px-2.5 py-1 text-sm transition ${baseHolds ? 'border-accent bg-accent text-accent-fg' : 'border-edge text-muted hover:text-fg'}`}
        >
          Base case P(1) {baseHolds ? 'on' : 'off'}
        </button>
        <button
          type="button"
          onClick={() => setStepHolds((v) => !v)}
          aria-pressed={stepHolds}
          className={`rounded border px-2.5 py-1 text-sm transition ${stepHolds ? 'border-accent bg-accent text-accent-fg' : 'border-edge text-muted hover:text-fg'}`}
        >
          Inductive step P(k) → P(k+1) {stepHolds ? 'on' : 'off'}
        </button>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '13rem' }} role="img" aria-label="falling dominoes induction chain">
        {/* ground line */}
        <line x1={20} y1={H - 30} x2={W - 20} y2={H - 30} style={{ stroke: 'var(--border)' }} strokeWidth={1.5} />
        {Array.from({ length: COUNT }, (_, i) => {
          const k = i + 1;
          const down = k <= fallen;
          // A domino that can never fall (chain already broken before it) is dimmed.
          const reachable = baseHolds && (stepHolds || k === 1);
          const cx = 30 + i * slotW + slotW / 2;
          const dw = 14;
          const dh = 54;
          const baseY = H - 30;
          // Falling = rotate ~70deg about its base.
          const angle = down ? 70 : 0;
          return (
            <g key={k} transform={`translate(${cx}, ${baseY})`}>
              <g transform={`rotate(${angle})`} style={{ transition: 'transform 200ms ease-out', transformOrigin: '0px 0px' } as React.CSSProperties}>
                <rect
                  x={-dw / 2}
                  y={-dh}
                  width={dw}
                  height={dh}
                  rx={2}
                  style={{
                    fill: down ? 'var(--accent)' : reachable ? 'var(--surface)' : 'var(--bg)',
                    stroke: down ? 'var(--accent)' : reachable ? 'var(--border)' : 'var(--border)',
                    opacity: reachable ? 1 : 0.4,
                  }}
                  strokeWidth={2}
                />
              </g>
              <text x={0} y={H - 30 - baseY + 16} textAnchor="middle" fontSize={11} style={{ fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                {k}
              </text>
            </g>
          );
        })}
        {!baseHolds && (
          <text x={W / 2} y={28} textAnchor="middle" fontSize={13} style={{ fill: '#f43f5e', fontFamily: 'var(--font-mono)' }}>
            no base case — the first domino is never pushed
          </text>
        )}
        {baseHolds && !stepHolds && (
          <text x={W / 2} y={28} textAnchor="middle" fontSize={13} style={{ fill: '#f43f5e', fontFamily: 'var(--font-mono)' }}>
            step broken — P(1) falls but cannot knock over P(2)
          </text>
        )}
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={prev} disabled={index <= 0} aria-label="Step back">
          <Icon name="chevron-left" size={16} /> Step
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90"
          onClick={() => (playing ? pause() : play())}
        >
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Topple'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= frameCount - 1} aria-label="Step forward">
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
            max={12}
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
        <span className="shrink-0 font-mono text-xs text-muted">{fallen}/{COUNT} fallen</span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-sm">
        <span className="text-muted">claim P(k): 1 + 2 + … + k = k(k+1)/2 </span>
        {fallen > 0 && (
          <span style={{ color: 'var(--accent)' }}>
            · P({fallen}) verified: sum = {claimSum(fallen)}
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">
        {proves
          ? 'Base case holds and each domino knocks the next, so every P(k) is true — that is a complete proof by induction.'
          : 'Both ingredients are required: the base case starts the chain, and the inductive step keeps it going. Remove either and the proof collapses.'}
      </p>
    </div>
  );
}
