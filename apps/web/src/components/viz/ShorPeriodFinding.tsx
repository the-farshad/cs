import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// Visualizes the OUTPUT of Shor's quantum subroutine (period finding) plus the
// classical wrapper. The quantum part finds the period r of f(x) = a^x mod N;
// here we compute that sequence directly so the user can watch it cycle back to 1.
// Then the classical post-processing gcd(a^{r/2} ± 1, N) yields the factors.

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

// Modular exponentiation a^e mod m (fast, avoids overflow for our small N).
function modpow(a: number, e: number, m: number): number {
  let result = 1 % m;
  let base = a % m;
  while (e > 0) {
    if (e & 1) result = (result * base) % m;
    base = (base * base) % m;
    e >>= 1;
  }
  return result;
}

// Period r: smallest r ≥ 1 with a^r ≡ 1 (mod N). Returns null if a shares a
// factor with N (then gcd(a,N) already gives a factor — handled separately).
function findPeriod(a: number, N: number): number | null {
  if (gcd(a, N) !== 1) return null;
  let val = a % N;
  let r = 1;
  while (val !== 1 && r <= N) {
    val = (val * a) % N;
    r++;
  }
  return val === 1 ? r : null;
}

type NChoice = 15 | 21 | 33 | 35;
const N_OPTIONS: NChoice[] = [15, 21, 33, 35];
// A few coprime, "interesting" bases per N (kept small for a clean animation).
const A_OPTIONS: Record<NChoice, number[]> = {
  15: [2, 4, 7, 8, 11, 13],
  21: [2, 5, 8, 10, 11, 13],
  33: [2, 5, 7, 10, 13, 14],
  35: [2, 3, 4, 6, 8, 12],
};

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const pill =
  'inline-flex h-7 min-w-7 items-center justify-center rounded border px-2 font-mono text-sm transition';

export default function ShorPeriodFinding() {
  const [N, setN] = useState<NChoice>(15);
  const [a, setA] = useState(7);

  const coprime = gcd(a, N) === 1;
  const period = useMemo(() => findPeriod(a, N), [a, N]);

  // Sequence a^0, a^1, ..., a^r mod N (one full cycle, ending back at 1).
  const sequence = useMemo(() => {
    if (period === null) return [] as { exp: number; val: number }[];
    const seq: { exp: number; val: number }[] = [];
    for (let x = 0; x <= period; x++) seq.push({ exp: x, val: modpow(a, x, N) });
    return seq;
  }, [a, N, period]);

  // Step through: one frame per exponent, then post-processing frames.
  // Frames: 0..period reveal the sequence; period+1 = period found; +2 = gcd minus; +3 = gcd plus.
  const totalFrames = period === null ? 1 : sequence.length + 3;
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(totalFrames, 3);
  const i = Math.min(index, totalFrames - 1);

  // Classical post-processing values (only valid when r is even).
  const r = period ?? 0;
  const rEven = period !== null && r % 2 === 0;
  const half = rEven ? modpow(a, r / 2, N) : null; // a^{r/2} mod N
  const badPhase = half !== null && (half === N - 1); // a^{r/2} ≡ -1 (mod N)
  const factorMinus = half !== null ? gcd(half - 1, N) : null;
  const factorPlus = half !== null ? gcd(half + 1, N) : null;
  const success = rEven && !badPhase && factorMinus! > 1 && factorMinus! < N && factorPlus! > 1 && factorPlus! < N;

  const revealed = period === null ? 0 : Math.min(i, sequence.length - 1);
  const showPeriod = period !== null && i >= sequence.length - 1;
  const showMinus = period !== null && i >= sequence.length + 1;
  const showPlus = period !== null && i >= sequence.length + 2;

  function pickN(choice: NChoice) {
    setN(choice);
    setA(A_OPTIONS[choice][0]);
    reset();
  }

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">N =</span>
        {N_OPTIONS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => pickN(n)}
            className={`${pill} ${n === N ? 'border-accent bg-accent text-accent-fg' : 'border-edge text-fg hover:border-accent hover:text-accent'}`}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">base a =</span>
        {A_OPTIONS[N].map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => {
              setA(opt);
              reset();
            }}
            className={`${pill} ${opt === a ? 'border-accent bg-accent text-accent-fg' : 'border-edge text-fg hover:border-accent hover:text-accent'}`}
          >
            {opt}
          </button>
        ))}
      </div>

      {/* Sequence wheel: a^x mod N */}
      <div className="rounded-lg border border-edge bg-bg p-3">
        <div className="mb-2 font-mono text-xs text-muted">
          f(x) = a<sup>x</sup> mod N = {a}<sup>x</sup> mod {N}
        </div>
        {period === null ? (
          <p className="font-mono text-sm" style={{ color: '#f43f5e' }}>
            gcd({a}, {N}) = {gcd(a, N)} ≠ 1 — a is not coprime to N, so gcd already reveals a factor. Pick a different a.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sequence.map((s, k) => {
              const shown = k <= revealed;
              const isOne = s.val === 1 && s.exp > 0;
              const isCurrent = k === revealed && i < sequence.length;
              let border = 'var(--edge)';
              let color = 'var(--muted)';
              if (shown) {
                color = 'var(--fg)';
                if (isOne && showPeriod) {
                  border = '#10b981';
                  color = '#10b981';
                } else if (isCurrent) {
                  border = '#38bdf8';
                  color = '#38bdf8';
                }
              }
              return (
                <div
                  key={k}
                  className="flex min-w-14 flex-col items-center rounded border px-2 py-1 transition-colors"
                  style={{ borderColor: border, opacity: shown ? 1 : 0.3 }}
                >
                  <span className="font-mono text-[10px] text-muted">x={s.exp}</span>
                  <span className="font-mono text-base" style={{ color }}>
                    {shown ? s.val : '·'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Period + classical post-processing */}
      {period !== null && (
        <div className="mt-3 space-y-2 rounded-lg border border-edge bg-bg p-3 font-mono text-xs">
          <div>
            <span className="text-muted">period: </span>
            {showPeriod ? (
              <span style={{ color: '#10b981' }}>
                r = {r} (smallest r with {a}<sup>r</sup> ≡ 1 mod {N})
              </span>
            ) : (
              <span className="text-muted">step until the sequence returns to 1…</span>
            )}
          </div>

          {showPeriod && !rEven && (
            <div style={{ color: '#fbbf24' }}>r = {r} is odd — this a fails. Pick another base a and retry.</div>
          )}

          {showPeriod && rEven && (
            <>
              <div>
                <span className="text-muted">half power: </span>
                <span className="text-fg">
                  {a}<sup>{r / 2}</sup> mod {N} = {half}
                </span>
                {badPhase && (
                  <span style={{ color: '#fbbf24' }}> ≡ −1 (mod {N}) — degenerate case, pick another a.</span>
                )}
              </div>
              {!badPhase && (
                <>
                  <div style={{ opacity: showMinus ? 1 : 0.35 }}>
                    <span className="text-muted">factor 1: </span>
                    gcd({half} − 1, {N}) = gcd({half! - 1}, {N}) ={' '}
                    {showMinus ? <span style={{ color: factorMinus! > 1 && factorMinus! < N ? '#10b981' : '#f43f5e' }}>{factorMinus}</span> : '…'}
                  </div>
                  <div style={{ opacity: showPlus ? 1 : 0.35 }}>
                    <span className="text-muted">factor 2: </span>
                    gcd({half} + 1, {N}) = gcd({half! + 1}, {N}) ={' '}
                    {showPlus ? <span style={{ color: factorPlus! > 1 && factorPlus! < N ? '#10b981' : '#f43f5e' }}>{factorPlus}</span> : '…'}
                  </div>
                  {showPlus && success && (
                    <div className="border-t border-edge pt-2" style={{ color: '#10b981' }}>
                      {N} = {factorMinus} × {factorPlus} — factored. RSA with this N is broken: p, q recover the private key.
                    </div>
                  )}
                  {showPlus && !success && (
                    <div className="border-t border-edge pt-2" style={{ color: '#fbbf24' }}>
                      This a gave a trivial factor — pick another base a and retry.
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={prev} disabled={index <= 0 || period === null}>
          <Icon name="chevron-left" size={16} /> Back
        </button>
        <button
          type="button"
          onClick={() => (playing ? pause() : play())}
          disabled={period === null}
          className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-40"
        >
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Run'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= totalFrames - 1 || period === null}>
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

      {period !== null && (
        <div className="mt-3 flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={Math.max(totalFrames - 1, 0)}
            value={index}
            onChange={(e) => seek(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
            aria-label="Timeline"
          />
          <span className="shrink-0 font-mono text-xs text-muted">{coprime ? `step ${i}/${totalFrames - 1}` : ''}</span>
        </div>
      )}
    </div>
  );
}
