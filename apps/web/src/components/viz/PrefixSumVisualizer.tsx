import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const ARR = [3, 1, 4, 1, 5, 9, 2, 6];

// We use a 1-indexed prefix array P of length n+1, with P[0] = 0 and
// P[k] = A[0] + ... + A[k-1]. A range sum A[l..r] (inclusive) = P[r+1] - P[l].
type Mode = 'build' | 'query';

type Frame = {
  mode: Mode;
  filled: number; // how many P entries are known (P[0..filled-1])
  buildIdx: number; // P index being computed, -1 none
  // query state
  l: number;
  r: number;
  highlightP: number[]; // P indices highlighted (the two endpoints)
  rangeCells: number[]; // A indices that fall in [l, r]
  note: string;
};

function buildPrefix(): number[] {
  const p = new Array(ARR.length + 1).fill(0);
  for (let i = 0; i < ARR.length; i++) p[i + 1] = p[i] + ARR[i];
  return p;
}

function buildFrames(P: number[], l: number, r: number): Frame[] {
  const frames: Frame[] = [];
  // ---- build phase ----
  frames.push({
    mode: 'build',
    filled: 1,
    buildIdx: -1,
    l,
    r,
    highlightP: [0],
    rangeCells: [],
    note: 'Start with P[0] = 0 (sum of zero elements).',
  });
  for (let k = 1; k <= ARR.length; k++) {
    frames.push({
      mode: 'build',
      filled: k + 1,
      buildIdx: k,
      l,
      r,
      highlightP: [k - 1, k],
      rangeCells: [k - 1],
      note: `P[${k}] = P[${k - 1}] + A[${k - 1}] = ${P[k - 1]} + ${ARR[k - 1]} = ${P[k]}`,
    });
  }
  frames.push({
    mode: 'build',
    filled: ARR.length + 1,
    buildIdx: -1,
    l,
    r,
    highlightP: [],
    rangeCells: [],
    note: 'Prefix array built in O(n). Every range sum is now O(1).',
  });

  // ---- query phase ----
  const range = [];
  for (let i = l; i <= r; i++) range.push(i);
  frames.push({
    mode: 'query',
    filled: ARR.length + 1,
    buildIdx: -1,
    l,
    r,
    highlightP: [],
    rangeCells: range,
    note: `Query: sum of A[${l}..${r}] (inclusive).`,
  });
  frames.push({
    mode: 'query',
    filled: ARR.length + 1,
    buildIdx: -1,
    l,
    r,
    highlightP: [r + 1],
    rangeCells: range,
    note: `Take P[r+1] = P[${r + 1}] = ${P[r + 1]} (sum of A[0..${r}]).`,
  });
  frames.push({
    mode: 'query',
    filled: ARR.length + 1,
    buildIdx: -1,
    l,
    r,
    highlightP: [r + 1, l],
    rangeCells: range,
    note: `Subtract P[l] = P[${l}] = ${P[l]} (sum of A[0..${l - 1}]).`,
  });
  frames.push({
    mode: 'query',
    filled: ARR.length + 1,
    buildIdx: -1,
    l,
    r,
    highlightP: [r + 1, l],
    rangeCells: range,
    note: `Answer = P[${r + 1}] − P[${l}] = ${P[r + 1]} − ${P[l]} = ${P[r + 1] - P[l]} — two lookups, no loop.`,
  });
  return frames;
}

const cell = 'flex h-10 w-10 items-center justify-center rounded border font-mono text-sm';

export default function PrefixSumVisualizer() {
  const P = useMemo(buildPrefix, []);
  const [l, setL] = useState(2);
  const [r, setR] = useState(5);
  const frames = useMemo(() => buildFrames(P, l, r), [P, l, r]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 3);
  const frame = frames[Math.min(index, frames.length - 1)] ?? frames[0];

  const hp = new Set(frame.highlightP);
  const rangeSet = new Set(frame.rangeCells);

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-muted">
          l = {l}
          <input
            type="range"
            min={0}
            max={r}
            value={l}
            onChange={(e) => setL(Math.min(Number(e.target.value), r))}
            className="accent-[var(--accent)]"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          r = {r}
          <input
            type="range"
            min={l}
            max={ARR.length - 1}
            value={r}
            onChange={(e) => setR(Math.max(Number(e.target.value), l))}
            className="accent-[var(--accent)]"
          />
        </label>
        <span className="text-sm text-muted">query A[{l}..{r}]</span>
      </div>

      {/* Original array A */}
      <div className="text-xs text-muted">A (0-indexed):</div>
      <div className="mt-1 flex flex-wrap gap-1">
        {ARR.map((v, i) => {
          const inRange = frame.mode === 'query' && rangeSet.has(i);
          const isBuildSrc = frame.mode === 'build' && frame.rangeCells.includes(i);
          let cls = 'border-edge bg-bg text-fg';
          if (inRange) cls = 'border-accent text-accent';
          else if (isBuildSrc) cls = 'border-[#fbbf24] text-fg';
          return (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <div className={`${cell} ${cls}`} style={inRange ? { background: 'color-mix(in oklab, var(--accent) 18%, var(--bg))' } : undefined}>
                {v}
              </div>
              <span className="font-mono text-[10px] text-muted">{i}</span>
            </div>
          );
        })}
      </div>

      {/* Prefix array P */}
      <div className="mt-4 text-xs text-muted">P (prefix sums, P[k] = sum of A[0..k-1]):</div>
      <div className="mt-1 flex flex-wrap gap-1">
        {P.map((v, k) => {
          const known = k < frame.filled;
          const building = k === frame.buildIdx;
          const hl = hp.has(k);
          let cls = 'border-edge text-muted opacity-40';
          if (known) cls = 'border-edge bg-bg text-fg opacity-100';
          if (hl) cls = 'border-accent text-accent opacity-100';
          if (building) cls = 'border-[#10b981] text-fg opacity-100';
          const bg = building
            ? 'color-mix(in oklab, #10b981 20%, var(--bg))'
            : hl
              ? 'color-mix(in oklab, var(--accent) 18%, var(--bg))'
              : undefined;
          return (
            <div key={k} className="flex flex-col items-center gap-0.5">
              <div className={`${cell} ${cls}`} style={bg ? { background: bg } : undefined}>
                {known ? v : '·'}
              </div>
              <span className="font-mono text-[10px] text-muted">{k}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={prev} disabled={index <= 0}>
          <Icon name="chevron-left" size={16} /> Step
        </button>
        <button
          type="button"
          onClick={() => (playing ? pause() : play())}
          className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90"
        >
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= frames.length - 1}>
          Step <Icon name="chevron-right" size={16} />
        </button>
        <button type="button" className={btn} onClick={reset} disabled={index === 0}>
          <Icon name="rotate-ccw" size={16} /> Reset
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={1} max={16} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
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
          {index + 1}/{frames.length}
        </span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">{frame.note}</div>
    </div>
  );
}
