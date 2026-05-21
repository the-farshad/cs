import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const N = 60; // sieve covers 2..N

type Frame = {
  prime: number; // prime currently being processed
  crossed: Set<number>; // composites struck out so far
  primes: Set<number>; // confirmed primes so far
};

// Build the sieve animation: one frame per "mark a multiple" action.
function buildSieve(): Frame[] {
  const crossed = new Set<number>();
  const primes = new Set<number>();
  const frames: Frame[] = [];
  for (let p = 2; p * p <= N; p++) {
    if (crossed.has(p)) continue;
    primes.add(p);
    for (let m = p * p; m <= N; m += p) {
      if (!crossed.has(m)) {
        crossed.add(m);
        frames.push({ prime: p, crossed: new Set(crossed), primes: new Set(primes) });
      }
    }
  }
  // final frame: everything not crossed is prime
  for (let k = 2; k <= N; k++) if (!crossed.has(k)) primes.add(k);
  frames.push({ prime: 0, crossed: new Set(crossed), primes: new Set(primes) });
  return frames;
}

export default function SieveAndClock() {
  const [tab, setTab] = useState<'sieve' | 'clock'>('sieve');

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex gap-1.5">
        <button
          type="button"
          onClick={() => setTab('sieve')}
          aria-pressed={tab === 'sieve'}
          className={`rounded border px-2.5 py-1 text-sm transition ${tab === 'sieve' ? 'border-accent bg-accent text-accent-fg' : 'border-edge text-muted hover:text-fg'}`}
        >
          Sieve of Eratosthenes
        </button>
        <button
          type="button"
          onClick={() => setTab('clock')}
          aria-pressed={tab === 'clock'}
          className={`rounded border px-2.5 py-1 text-sm transition ${tab === 'clock' ? 'border-accent bg-accent text-accent-fg' : 'border-edge text-muted hover:text-fg'}`}
        >
          Modular clock
        </button>
      </div>
      {tab === 'sieve' ? <Sieve /> : <Clock />}
    </div>
  );
}

function Sieve() {
  const frames = useMemo(() => buildSieve(), []);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 8);
  const frame = frames[Math.min(index, frames.length - 1)];

  const cells = Array.from({ length: N - 1 }, (_, i) => i + 2);

  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        Start with 2 (the first prime), cross out all its multiples, advance to the next un-crossed
        number, and repeat. Whatever survives is prime.
      </p>

      <div className="grid grid-cols-10 gap-1.5" role="img" aria-label="sieve of Eratosthenes grid">
        {cells.map((n) => {
          const isCrossed = frame.crossed.has(n);
          const isPrime = frame.primes.has(n) && !isCrossed;
          const isActive = n === frame.prime;
          const isMultiple = frame.prime > 0 && n % frame.prime === 0 && n > frame.prime;
          let cls = 'border-edge text-fg';
          if (isActive) cls = 'border-accent bg-accent text-accent-fg font-semibold';
          else if (isPrime) cls = 'border-edge text-fg';
          else if (isCrossed) cls = 'border-edge text-muted/40 line-through';
          return (
            <div
              key={n}
              className={`flex aspect-square items-center justify-center rounded border font-mono text-xs sm:text-sm ${cls}`}
              style={isMultiple && !isActive && !isCrossed ? { borderColor: '#fbbf24' } : undefined}
            >
              {n}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={prev} disabled={index <= 0} aria-label="Step back">
          <Icon name="chevron-left" size={16} /> Step
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90"
          onClick={() => (playing ? pause() : play())}
        >
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= frames.length - 1} aria-label="Step forward">
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
        <input
          type="range"
          min={0}
          max={frames.length - 1}
          value={index}
          onChange={(e) => seek(Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
          aria-label="Timeline"
        />
        <span className="shrink-0 font-mono text-xs text-muted">{index + 1}/{frames.length}</span>
      </div>

      <p className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">
        {frame.prime > 0 ? `crossing out multiples of ${frame.prime}` : 'done'} · primes found:{' '}
        {[...frame.primes].filter((p) => !frame.crossed.has(p)).sort((a, b) => a - b).join(', ')}
      </p>
    </div>
  );
}

function Clock() {
  const [mod, setMod] = useState(12);
  const [value, setValue] = useState(17);

  const remainder = ((value % mod) + mod) % mod;
  const SIZE = 280;
  const C = SIZE / 2;
  const R = 105;

  const ticks = Array.from({ length: mod }, (_, i) => i);
  const angle = (remainder / mod) * 2 * Math.PI - Math.PI / 2;
  const handX = C + R * Math.cos(angle);
  const handY = C + R * Math.sin(angle);

  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        Modular arithmetic wraps numbers around a clock of size m. Adding keeps cycling through the
        same remainders — exactly how hashing and cyclic buffers stay in range.
      </p>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto block w-full max-w-[18rem]" role="img" aria-label="modular clock">
          <circle cx={C} cy={C} r={R + 18} fill="none" style={{ stroke: 'var(--border)' }} strokeWidth={1.5} />
          {ticks.map((t) => {
            const a = (t / mod) * 2 * Math.PI - Math.PI / 2;
            const tx = C + (R + 18) * Math.cos(a);
            const ty = C + (R + 18) * Math.sin(a);
            const active = t === remainder;
            return (
              <text
                key={t}
                x={tx}
                y={ty + 4}
                textAnchor="middle"
                className="font-mono text-xs"
                style={{ fill: active ? 'var(--accent)' : 'var(--muted)', fontWeight: active ? 700 : 400 }}
              >
                {t}
              </text>
            );
          })}
          <line x1={C} y1={C} x2={handX} y2={handY} style={{ stroke: 'var(--accent)' }} strokeWidth={2.5} />
          <circle cx={C} cy={C} r={4} style={{ fill: 'var(--accent)' }} />
          <circle cx={handX} cy={handY} r={6} style={{ fill: 'var(--accent)' }} />
        </svg>

        <div className="flex flex-col gap-4 text-sm text-muted">
          <label className="flex flex-col gap-1">
            <span>value = {value}</span>
            <input type="range" min={0} max={48} value={value} onChange={(e) => setValue(Number(e.target.value))} className="accent-[var(--accent)]" />
          </label>
          <label className="flex flex-col gap-1">
            <span>modulus m = {mod}</span>
            <input type="range" min={2} max={16} value={mod} onChange={(e) => setMod(Number(e.target.value))} className="accent-[var(--accent)]" />
          </label>
          <div className="rounded border border-edge bg-bg px-3 py-2 font-mono text-sm">
            <span className="text-fg">{value}</span> mod <span className="text-fg">{mod}</span> ={' '}
            <span className="text-accent">{remainder}</span>
          </div>
        </div>
      </div>

      <p className="mt-4 border-t border-edge pt-4 text-xs text-muted">
        {value} ÷ {mod} = {Math.floor(value / mod)} remainder {remainder}. Numbers that share the same
        remainder are "congruent mod {mod}" — they land on the same spot of the clock.
      </p>
    </div>
  );
}
