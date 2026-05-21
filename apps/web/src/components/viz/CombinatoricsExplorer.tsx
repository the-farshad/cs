import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const ITEMS = ['A', 'B', 'C', 'D', 'E'];

function factorial(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

// All ordered arrangements (permutations) of k items chosen from list.
function permutations(list: string[], k: number): string[][] {
  if (k === 0) return [[]];
  const out: string[][] = [];
  list.forEach((item, i) => {
    const rest = [...list.slice(0, i), ...list.slice(i + 1)];
    for (const tail of permutations(rest, k - 1)) out.push([item, ...tail]);
  });
  return out;
}

// All unordered selections (combinations) of k items chosen from list.
function combinations(list: string[], k: number): string[][] {
  if (k === 0) return [[]];
  if (k > list.length) return [];
  const out: string[][] = [];
  list.forEach((item, i) => {
    for (const tail of combinations(list.slice(i + 1), k - 1)) out.push([item, ...tail]);
  });
  return out;
}

export default function CombinatoricsExplorer() {
  const [n, setN] = useState(4);
  const [k, setK] = useState(2);
  const [mode, setMode] = useState<'perm' | 'comb'>('comb');

  const pool = ITEMS.slice(0, n);
  const kk = Math.min(k, n);

  const results = useMemo(
    () => (mode === 'perm' ? permutations(pool, kk) : combinations(pool, kk)),
    [mode, n, kk],
  );

  // Reveal results one at a time so the count "builds up".
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(
    results.length,
  );
  const shown = index + 1;

  const formula =
    mode === 'perm'
      ? `P(${n},${kk}) = ${n}! / (${n}−${kk})! = ${factorial(n)} / ${factorial(n - kk)} = ${
          factorial(n) / factorial(n - kk)
        }`
      : `C(${n},${kk}) = ${n}! / (${kk}!·(${n}−${kk})!) = ${
          factorial(n) / (factorial(kk) * factorial(n - kk))
        }`;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setMode('comb')}
            aria-pressed={mode === 'comb'}
            className={`rounded border px-2.5 py-1 text-sm transition ${mode === 'comb' ? 'border-accent bg-accent text-accent-fg' : 'border-edge text-muted hover:text-fg'}`}
          >
            Combinations (order ignored)
          </button>
          <button
            type="button"
            onClick={() => setMode('perm')}
            aria-pressed={mode === 'perm'}
            className={`rounded border px-2.5 py-1 text-sm transition ${mode === 'perm' ? 'border-accent bg-accent text-accent-fg' : 'border-edge text-muted hover:text-fg'}`}
          >
            Permutations (order matters)
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          n = {n}
          <input
            type="range"
            min={2}
            max={5}
            value={n}
            onChange={(e) => setN(Number(e.target.value))}
            className="accent-[var(--accent)]"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          k = {kk}
          <input
            type="range"
            min={1}
            max={n}
            value={kk}
            onChange={(e) => setK(Number(e.target.value))}
            className="accent-[var(--accent)]"
          />
        </label>
      </div>

      <p className="mb-3 text-sm text-muted">
        Choosing <span className="text-fg">{kk}</span> from{' '}
        <span className="font-mono text-accent">{`{${pool.join(', ')}}`}</span>:
      </p>

      <div className="flex min-h-[8rem] flex-wrap content-start gap-2" role="img" aria-label="enumerated outcomes">
        {results.slice(0, shown).map((r, i) => (
          <span
            key={i}
            className="rounded border border-edge bg-bg px-2.5 py-1 font-mono text-sm"
            style={i === index ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
          >
            {mode === 'perm' ? r.join('') : `{${r.join(',')}}`}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={prev} disabled={index <= 0} aria-label="Reveal one fewer">
          <Icon name="chevron-left" size={16} /> Step
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90"
          onClick={() => (playing ? pause() : play())}
        >
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Reveal'}
        </button>
        <button
          type="button"
          className={btn}
          onClick={next}
          disabled={index >= results.length - 1}
          aria-label="Reveal one more"
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
          max={Math.max(results.length - 1, 0)}
          value={index}
          onChange={(e) => seek(Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
          aria-label="Timeline"
        />
        <span className="shrink-0 font-mono text-xs text-muted">
          {shown}/{results.length}
        </span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-sm text-accent">{formula}</div>
      <p className="mt-2 text-xs text-muted">
        Permutations count <em>ordered</em> arrangements; combinations count <em>unordered</em>{' '}
        selections. There are always k! times more permutations than combinations.
      </p>
    </div>
  );
}
