import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const TICKS = 60; // simulated time steps
const DT = 0.25; // seconds per tick
const MAX_CAP = 10;

type TBFrame = {
  /** Tokens available at this tick (can be fractional during refill). */
  tokens: number;
  /** Did a request arrive this tick? */
  arrived: boolean;
  /** Was it allowed (consumed a token) or rejected? */
  allowed: boolean | null;
  /** Cumulative allowed / rejected. */
  allowedTotal: number;
  rejectedTotal: number;
  t: number;
};

/** Deterministic arrivals so the timeline is reproducible. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Simulate a token bucket: refill at `rate` tokens/sec up to `capacity`;
 *  each arriving request consumes one token or is rejected when empty. */
function buildFrames(rate: number, capacity: number, demand: number): TBFrame[] {
  let tokens = capacity;
  let allowedTotal = 0;
  let rejectedTotal = 0;
  const rng = mulberry32(7);
  const frames: TBFrame[] = [
    { tokens, arrived: false, allowed: null, allowedTotal, rejectedTotal, t: 0 },
  ];

  for (let i = 1; i <= TICKS; i++) {
    // Refill first (continuous leaky refill, clamped to capacity).
    tokens = Math.min(capacity, tokens + rate * DT);

    // A request arrives with probability proportional to demand.
    const arrived = rng() < demand * DT;
    let allowed: boolean | null = null;
    if (arrived) {
      if (tokens >= 1) {
        tokens -= 1;
        allowed = true;
        allowedTotal += 1;
      } else {
        allowed = false;
        rejectedTotal += 1;
      }
    }
    frames.push({ tokens, arrived, allowed, allowedTotal, rejectedTotal, t: i * DT });
  }
  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const EMPTY: TBFrame = { tokens: 0, arrived: false, allowed: null, allowedTotal: 0, rejectedTotal: 0, t: 0 };

export default function TokenBucketVisualizer() {
  const [rate, setRate] = useState(2); // tokens / sec
  const [capacity, setCapacity] = useState(5);
  const [demand, setDemand] = useState(4); // requests / sec (arrival pressure)

  const frames = useMemo(() => buildFrames(rate, capacity, demand), [rate, capacity, demand]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 8);
  const frame = frames[Math.min(index, frames.length - 1)] ?? EMPTY;

  const fillPct = (frame.tokens / capacity) * 100;
  const total = frame.allowedTotal + frame.rejectedTotal;

  // Bucket SVG.
  const W = 160;
  const H = 200;
  const bx = 30;
  const bw = 100;
  const top = 24;
  const bottom = H - 16;
  const innerH = bottom - top;
  const liquidTop = bottom - (innerH * Math.min(frame.tokens, capacity)) / capacity;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        <label className="flex items-center gap-2 text-sm text-muted">
          Refill {rate}/s
          <input type="range" min={1} max={8} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          Capacity {capacity}
          <input type="range" min={2} max={MAX_CAP} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          Demand {demand}/s
          <input type="range" min={1} max={10} value={demand} onChange={(e) => setDemand(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="grid items-center gap-4 sm:grid-cols-[160px_1fr]">
        {/* bucket */}
        <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full max-w-[160px]" role="img" aria-label="Token bucket">
          {/* refill drip */}
          <line x1={bx + bw / 2} y1={2} x2={bx + bw / 2} y2={top} style={{ stroke: 'var(--accent)' }} strokeWidth={2} strokeDasharray="3 3" />
          <text x={bx + bw / 2 + 6} y={12} fontSize={9} style={{ fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
            +{rate}/s
          </text>
          {/* liquid */}
          <rect
            x={bx + 2}
            y={liquidTop}
            width={bw - 4}
            height={Math.max(0, bottom - liquidTop)}
            style={{ fill: 'var(--accent)', opacity: 0.85 }}
            className="transition-[y,height] duration-150"
          />
          {/* capacity ticks */}
          {Array.from({ length: capacity + 1 }, (_, i) => {
            const y = bottom - (innerH * i) / capacity;
            return <line key={i} x1={bx} y1={y} x2={bx + 6} y2={y} style={{ stroke: 'var(--muted)' }} strokeWidth={1} />;
          })}
          {/* bucket walls */}
          <path d={`M ${bx} ${top} L ${bx} ${bottom} L ${bx + bw} ${bottom} L ${bx + bw} ${top}`} fill="none" style={{ stroke: 'var(--fg)' }} strokeWidth={2.5} />
          <text x={bx + bw / 2} y={(top + bottom) / 2} textAnchor="middle" dominantBaseline="central" fontSize={20} style={{ fill: 'var(--accent-fg)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
            {Math.floor(frame.tokens)}
          </text>
        </svg>

        {/* status + request indicator */}
        <div className="space-y-3">
          <div
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition ${
              !frame.arrived
                ? 'border-edge'
                : frame.allowed
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-rose-500 bg-rose-500/10'
            }`}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{
                background: !frame.arrived ? 'var(--bg)' : frame.allowed ? '#10b981' : '#f43f5e',
                color: '#04140d',
              }}
            >
              {frame.arrived ? <Icon name={frame.allowed ? 'check' : 'arrow-down'} size={18} /> : <span className="text-muted">·</span>}
            </div>
            <div>
              <div className="text-sm text-fg">
                {!frame.arrived ? 'No request this tick' : frame.allowed ? 'Request allowed' : 'Request rejected (429)'}
              </div>
              <div className="font-mono text-xs text-muted">
                {frame.arrived
                  ? frame.allowed
                    ? 'consumed 1 token'
                    : 'bucket empty — no token to spend'
                  : `bucket at ${frame.tokens.toFixed(1)} / ${capacity}`}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded border border-edge bg-bg p-2">
              <div className="font-mono text-lg text-emerald-400">{frame.allowedTotal}</div>
              <div className="text-xs text-muted">allowed</div>
            </div>
            <div className="rounded border border-edge bg-bg p-2">
              <div className="font-mono text-lg text-rose-400">{frame.rejectedTotal}</div>
              <div className="text-xs text-muted">rejected</div>
            </div>
            <div className="rounded border border-edge bg-bg p-2">
              <div className="font-mono text-lg text-fg">{total ? Math.round((frame.allowedTotal / total) * 100) : 0}%</div>
              <div className="text-xs text-muted">pass rate</div>
            </div>
          </div>

          <div className="h-2 rounded-full bg-bg" aria-hidden>
            <div className="h-2 rounded-full bg-accent transition-[width] duration-150" style={{ width: `${fillPct}%` }} />
          </div>
        </div>
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
          <input type="range" min={1} max={24} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
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
        <span className="shrink-0 font-mono text-xs text-muted">t={frame.t.toFixed(1)}s</span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">
        Capacity sets the burst size; refill rate sets the steady throughput. Demand above refill drains the bucket and triggers rejections.
      </div>
    </div>
  );
}
