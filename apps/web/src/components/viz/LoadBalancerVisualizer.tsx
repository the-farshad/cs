import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const N_SERVERS = 4;
const N_REQUESTS = 16;
type Strategy = 'round-robin' | 'least-conn';

type LBFrame = {
  /** Which server this step's request was routed to (-1 = none yet). */
  routed: number;
  /** Cumulative request count handled per server. */
  counts: number[];
  /** Live (in-flight) connection count per server. */
  conns: number[];
  /** Health flags per server. */
  healthy: boolean[];
  note: string;
};

/** Deterministic pseudo-random so frames are reproducible per (strategy, down). */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildFrames(strategy: Strategy, down: number): LBFrame[] {
  const counts = new Array(N_SERVERS).fill(0);
  const conns = new Array(N_SERVERS).fill(0);
  const healthy = Array.from({ length: N_SERVERS }, (_, i) => i !== down);
  const rng = mulberry32(strategy === 'round-robin' ? 1 : 2);

  const live = () => healthy.map((h, i) => (h ? i : -1)).filter((i) => i >= 0);
  const frames: LBFrame[] = [
    {
      routed: -1,
      counts: [...counts],
      conns: [...conns],
      healthy: [...healthy],
      note:
        down >= 0
          ? `Server ${down} is unhealthy — health checks remove it from the pool.`
          : 'All servers healthy. Press play to send requests.',
    },
  ];

  let rr = 0;
  for (let r = 0; r < N_REQUESTS; r++) {
    const pool = live();
    if (pool.length === 0) break;

    // Some in-flight connections finish before this request is routed.
    for (const s of pool) {
      if (conns[s] > 0 && rng() < 0.45) conns[s] -= 1;
    }

    let target: number;
    if (strategy === 'round-robin') {
      // Advance round-robin pointer, skipping unhealthy servers.
      do {
        rr = (rr + 1) % N_SERVERS;
      } while (!healthy[rr]);
      target = rr;
    } else {
      // Fewest live connections wins; ties broken by lowest index.
      target = pool.reduce((best, s) => (conns[s] < conns[best] ? s : best), pool[0]);
    }

    counts[target] += 1;
    conns[target] += 1;
    frames.push({
      routed: target,
      counts: [...counts],
      conns: [...conns],
      healthy: [...healthy],
      note: `Request ${r + 1} → server ${target} (${
        strategy === 'round-robin' ? 'next in rotation' : `fewest connections: ${conns[target] - 1}`
      })`,
    });
  }
  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const EMPTY: LBFrame = {
  routed: -1,
  counts: new Array(N_SERVERS).fill(0),
  conns: new Array(N_SERVERS).fill(0),
  healthy: new Array(N_SERVERS).fill(true),
  note: '',
};

export default function LoadBalancerVisualizer() {
  const [strategy, setStrategy] = useState<Strategy>('round-robin');
  const [down, setDown] = useState<number>(-1);

  const frames = useMemo(() => buildFrames(strategy, down), [strategy, down]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 4);
  const frame = frames[Math.min(index, frames.length - 1)] ?? EMPTY;

  const maxCount = Math.max(1, ...frame.counts);
  const total = frame.counts.reduce((s, c) => s + c, 0);

  // Geometry for the routing diagram.
  const W = 520;
  const H = 240;
  const lbX = 90;
  const lbY = H / 2;
  const serverX = 400;
  const serverY = (i: number) => 40 + i * ((H - 80) / (N_SERVERS - 1));

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded border border-edge">
          {(['round-robin', 'least-conn'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStrategy(s)}
              aria-pressed={strategy === s}
              className={`px-3 py-1 text-sm transition ${strategy === s ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}
            >
              {s === 'round-robin' ? 'Round-robin' : 'Least-connections'}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          Unhealthy
          <select
            value={down}
            onChange={(e) => setDown(Number(e.target.value))}
            className="rounded border border-edge bg-bg px-2 py-1 text-fg"
          >
            <option value={-1}>none</option>
            {Array.from({ length: N_SERVERS }, (_, i) => (
              <option key={i} value={i}>
                server {i}
              </option>
            ))}
          </select>
        </label>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '16rem' }} role="img" aria-label="Load balancer routing">
        {/* incoming request arrow */}
        <line x1={8} y1={lbY} x2={lbX - 30} y2={lbY} style={{ stroke: 'var(--muted)' }} strokeWidth={2} />
        <text x={8} y={lbY - 8} fontSize={11} style={{ fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
          requests
        </text>

        {/* links LB -> servers */}
        {frame.healthy.map((h, i) => {
          const active = frame.routed === i;
          return (
            <line
              key={`lk-${i}`}
              x1={lbX + 30}
              y1={lbY}
              x2={serverX - 26}
              y2={serverY(i)}
              style={{ stroke: active ? 'var(--accent)' : h ? 'var(--border)' : '#f43f5e' }}
              strokeWidth={active ? 3 : 1.5}
              strokeDasharray={h ? undefined : '5 4'}
            />
          );
        })}

        {/* load balancer node */}
        <rect x={lbX - 30} y={lbY - 26} width={60} height={52} rx={8} style={{ fill: 'var(--accent)', stroke: 'var(--accent)' }} />
        <text x={lbX} y={lbY} textAnchor="middle" dominantBaseline="central" fontSize={11} style={{ fill: 'var(--accent-fg)', fontFamily: 'var(--font-mono)' }}>
          LB
        </text>

        {/* servers */}
        {frame.healthy.map((h, i) => {
          const active = frame.routed === i;
          const fill = !h
            ? 'color-mix(in oklab, #f43f5e 18%, var(--surface))'
            : active
              ? 'var(--accent)'
              : 'var(--surface)';
          const stroke = !h ? '#f43f5e' : active ? 'var(--accent)' : 'var(--border)';
          const text = active && h ? 'var(--accent-fg)' : 'var(--fg)';
          return (
            <g key={`sv-${i}`}>
              <rect x={serverX - 26} y={serverY(i) - 18} width={104} height={36} rx={6} style={{ fill, stroke }} strokeWidth={2} />
              <text x={serverX - 12} y={serverY(i)} dominantBaseline="central" fontSize={11} style={{ fill: text, fontFamily: 'var(--font-mono)' }}>
                {h ? `srv ${i}` : `srv ${i} ✕`}
              </text>
              <text x={serverX + 70} y={serverY(i)} textAnchor="end" dominantBaseline="central" fontSize={11} style={{ fill: h ? 'var(--muted)' : '#f43f5e', fontFamily: 'var(--font-mono)' }}>
                {frame.conns[i]} live
              </text>
            </g>
          );
        })}
      </svg>

      {/* per-server request counts */}
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
        {frame.counts.map((c, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center justify-between font-mono text-xs">
              <span className={frame.healthy[i] ? 'text-muted' : 'text-rose-400'}>srv {i}</span>
              <span className={frame.routed === i ? 'text-accent' : 'text-fg'}>{c}</span>
            </div>
            <div className="h-2 rounded-full bg-bg">
              <div
                className="h-2 rounded-full transition-[width] duration-200"
                style={{
                  width: `${(c / maxCount) * 100}%`,
                  background: frame.healthy[i] ? 'var(--accent)' : '#f43f5e',
                }}
              />
            </div>
          </div>
        ))}
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
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Send'}
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
          {index}/{frames.length - 1}
        </span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">
        {frame.note} · routed {total} total
      </div>
    </div>
  );
}
