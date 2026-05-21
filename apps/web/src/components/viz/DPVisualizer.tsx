import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

type Cell = [number, number];
type DPFrame = {
  dp: number[][];
  cur?: Cell;
  deps?: Cell[];
  path?: Cell[];
  phase: 'fill' | 'backtrack' | 'done';
  note?: string;
};

function buildFrames(A: string, B: string): DPFrame[] {
  const m = A.length;
  const n = B.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  const frames: DPFrame[] = [];
  const copy = () => dp.map((r) => [...r]);
  frames.push({ dp: copy(), phase: 'fill', note: 'row 0 and column 0 use an empty prefix, so they are 0' });

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const match = A[i - 1] === B[j - 1];
      const deps: Cell[] = match ? [[i - 1, j - 1]] : [[i - 1, j], [i, j - 1]];
      frames.push({
        dp: copy(),
        cur: [i, j],
        deps,
        phase: 'fill',
        note: match ? `${A[i - 1]} = ${B[j - 1]} → take the diagonal + 1` : `${A[i - 1]} ≠ ${B[j - 1]} → max(top, left)`,
      });
      dp[i][j] = match ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
      frames.push({ dp: copy(), cur: [i, j], phase: 'fill' });
    }
  }

  let i = m;
  let j = n;
  const path: Cell[] = [];
  let lcs = '';
  while (i > 0 && j > 0) {
    if (A[i - 1] === B[j - 1]) {
      path.push([i, j]);
      lcs = A[i - 1] + lcs;
      frames.push({ dp: copy(), cur: [i, j], path: [...path], phase: 'backtrack', note: `match ${A[i - 1]} — part of the LCS` });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      frames.push({ dp: copy(), cur: [i, j], path: [...path], phase: 'backtrack', note: 'larger neighbor is up' });
      i--;
    } else {
      frames.push({ dp: copy(), cur: [i, j], path: [...path], phase: 'backtrack', note: 'larger neighbor is left' });
      j--;
    }
  }
  frames.push({ dp: copy(), path: [...path], phase: 'done', note: `LCS = "${lcs}"  (length ${dp[m][n]})` });
  return frames;
}

const clean = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8);
const eq = (c: Cell | undefined, i: number, j: number) => !!c && c[0] === i && c[1] === j;
const has = (list: Cell[] | undefined, i: number, j: number) => !!list && list.some((c) => c[0] === i && c[1] === j);

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function DPVisualizer() {
  const [A, setA] = useState('AGCAT');
  const [B, setB] = useState('GAC');

  const frames = useMemo(() => buildFrames(A, B), [A, B]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 5);
  const frame = frames[Math.min(index, frames.length - 1)] ?? { dp: [[0]], phase: 'fill' as const };

  const cellCls = (i: number, j: number) => {
    if (has(frame.path, i, j)) return 'border-emerald-500 bg-emerald-500/15 text-emerald-300';
    if (eq(frame.cur, i, j)) return 'border-accent bg-accent/15 text-accent';
    if (has(frame.deps, i, j)) return 'border-amber-400 bg-amber-400/10 text-amber-300';
    return 'border-edge text-fg';
  };

  const m = A.length;
  const n = B.length;
  const head = 'flex h-9 w-9 shrink-0 items-center justify-center font-mono text-sm text-muted';

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          A
          <input value={A} onChange={(e) => setA(clean(e.target.value))} className="w-32 rounded border border-edge bg-bg px-2 py-1 font-mono text-fg" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          B
          <input value={B} onChange={(e) => setB(clean(e.target.value))} className="w-32 rounded border border-edge bg-bg px-2 py-1 font-mono text-fg" />
        </label>
        <span className="text-xs text-muted">Longest Common Subsequence</span>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block">
          <div className="flex gap-1">
            <span className={head} />
            {Array.from({ length: n + 1 }, (_, j) => (
              <span key={j} className={head}>
                {j === 0 ? 'ε' : B[j - 1]}
              </span>
            ))}
          </div>
          {Array.from({ length: m + 1 }, (_, i) => (
            <div key={i} className="mt-1 flex gap-1">
              <span className={head}>{i === 0 ? 'ε' : A[i - 1]}</span>
              {Array.from({ length: n + 1 }, (_, j) => (
                <span key={j} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded border font-mono text-sm ${cellCls(i, j)}`}>
                  {frame.dp[i]?.[j] ?? 0}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={prev} disabled={index <= 0}>
          <Icon name="chevron-left" size={16} /> Step
        </button>
        <button type="button" onClick={() => (playing ? pause() : play())} className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90">
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
          <input type="range" min={1} max={30} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input type="range" min={0} max={Math.max(frames.length - 1, 0)} value={index} onChange={(e) => seek(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Timeline" />
        <span className="shrink-0 font-mono text-xs text-muted">{index + 1}/{frames.length}</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-edge pt-4 text-xs text-muted">
        <div className="flex flex-wrap gap-3">
          <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm bg-amber-400" /> depends on</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: 'var(--accent)' }} /> current</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm bg-emerald-500" /> LCS path</span>
        </div>
        <span className="font-mono">{frame.note ?? `${frame.phase}`}</span>
      </div>
    </div>
  );
}
