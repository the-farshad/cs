import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

type HopId = 'client' | 'cdn' | 'lb' | 'app' | 'db';

const HOPS: { id: HopId; label: string; sub: string }[] = [
  { id: 'client', label: 'Client', sub: 'browser' },
  { id: 'cdn', label: 'CDN / Cache', sub: 'edge' },
  { id: 'lb', label: 'Load Balancer', sub: 'route' },
  { id: 'app', label: 'App Server', sub: 'logic' },
  { id: 'db', label: 'Database', sub: 'store' },
];

type Step = {
  /** Node highlighted this step. */
  at: HopId;
  /** Direction of travel for the arrow into `at` (request vs response). */
  dir: 'forward' | 'back' | 'stay';
  /** Which edge is lit: index into HOPS of the left node of the segment (-1 none). */
  edge: number;
  note: string;
  /** Mark a node as a cache hit (emerald) for this and later steps. */
  hit?: boolean;
};

/** Build the hop-by-hop timeline. On a cache hit the CDN short-circuits the
 *  request and returns early; on a miss it continues to the origin. */
function buildSteps(cacheHit: boolean): Step[] {
  if (cacheHit) {
    return [
      { at: 'client', dir: 'stay', edge: -1, note: 'Client issues a request for a cacheable resource.' },
      { at: 'cdn', dir: 'forward', edge: 0, note: 'Request reaches the nearest CDN edge node.' },
      { at: 'cdn', dir: 'stay', edge: -1, note: 'Cache HIT — the edge already has a fresh copy.', hit: true },
      { at: 'client', dir: 'back', edge: 0, note: 'Edge returns the cached response. Origin never touched — lowest latency.', hit: true },
    ];
  }
  return [
    { at: 'client', dir: 'stay', edge: -1, note: 'Client issues a request.' },
    { at: 'cdn', dir: 'forward', edge: 0, note: 'Request reaches the CDN edge.' },
    { at: 'cdn', dir: 'stay', edge: -1, note: 'Cache MISS — not at the edge. Forward to origin.' },
    { at: 'lb', dir: 'forward', edge: 1, note: 'Load balancer picks a healthy app server.' },
    { at: 'app', dir: 'forward', edge: 2, note: 'App server runs business logic; needs data.' },
    { at: 'db', dir: 'forward', edge: 3, note: 'Query hits the database (the slow, expensive hop).' },
    { at: 'app', dir: 'back', edge: 3, note: 'Database returns rows; app builds the response.' },
    { at: 'lb', dir: 'back', edge: 2, note: 'Response flows back through the load balancer.' },
    { at: 'cdn', dir: 'back', edge: 1, note: 'CDN stores the response for next time (populates cache).' },
    { at: 'client', dir: 'back', edge: 0, note: 'Client receives the response. Slower path — full round trip.' },
  ];
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function RequestFlowVisualizer() {
  const [cacheHit, setCacheHit] = useState(false);

  const steps = useMemo(() => buildSteps(cacheHit), [cacheHit]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(steps.length, 2);
  const step = steps[Math.min(index, steps.length - 1)] ?? steps[0];

  // Did we already pass a "hit" step? Keep the CDN green afterward.
  const hitReached = steps.slice(0, index + 1).some((s) => s.hit);

  // Layout
  const W = 560;
  const H = 150;
  const nodeW = 92;
  const gap = (W - HOPS.length * nodeW) / (HOPS.length - 1);
  const nodeX = (i: number) => i * (nodeW + gap);
  const nodeY = 48;
  const nh = 54;

  const idxOf = (id: HopId) => HOPS.findIndex((h) => h.id === id);

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted">Cache state</span>
        <div className="inline-flex overflow-hidden rounded border border-edge">
          <button
            type="button"
            onClick={() => setCacheHit(true)}
            aria-pressed={cacheHit}
            className={`px-3 py-1 text-sm transition ${cacheHit ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}
          >
            Cache hit
          </button>
          <button
            type="button"
            onClick={() => setCacheHit(false)}
            aria-pressed={!cacheHit}
            className={`px-3 py-1 text-sm transition ${!cacheHit ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}
          >
            Cache miss
          </button>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '12rem' }} role="img" aria-label="Request flow across system hops">
        {/* edges */}
        {HOPS.slice(0, -1).map((_, i) => {
          const lit = step.edge === i;
          const x1 = nodeX(i) + nodeW;
          const x2 = nodeX(i + 1);
          const y = nodeY + nh / 2;
          const forward = step.dir === 'forward';
          return (
            <g key={`e-${i}`}>
              <line x1={x1} y1={y} x2={x2} y2={y} style={{ stroke: lit ? 'var(--accent)' : 'var(--border)' }} strokeWidth={lit ? 3 : 1.5} />
              {lit && (
                <polygon
                  points={
                    forward
                      ? `${x2 - 9},${y - 5} ${x2 - 9},${y + 5} ${x2},${y}`
                      : `${x1 + 9},${y - 5} ${x1 + 9},${y + 5} ${x1},${y}`
                  }
                  style={{ fill: 'var(--accent)' }}
                />
              )}
            </g>
          );
        })}

        {/* nodes */}
        {HOPS.map((hop, i) => {
          const active = step.at === hop.id;
          const isCdn = hop.id === 'cdn';
          const greenCdn = isCdn && hitReached;
          const fill = greenCdn
            ? 'color-mix(in oklab, #10b981 20%, var(--surface))'
            : active
              ? 'var(--accent)'
              : 'var(--surface)';
          const stroke = greenCdn ? '#10b981' : active ? 'var(--accent)' : 'var(--border)';
          const textCol = active && !greenCdn ? 'var(--accent-fg)' : 'var(--fg)';
          return (
            <g key={hop.id}>
              <rect x={nodeX(i)} y={nodeY} width={nodeW} height={nh} rx={8} style={{ fill, stroke }} strokeWidth={2.5} />
              <text x={nodeX(i) + nodeW / 2} y={nodeY + 22} textAnchor="middle" fontSize={11} style={{ fill: textCol, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {hop.label}
              </text>
              <text x={nodeX(i) + nodeW / 2} y={nodeY + 39} textAnchor="middle" fontSize={9} style={{ fill: greenCdn ? '#10b981' : active && !greenCdn ? 'var(--accent-fg)' : 'var(--muted)' }}>
                {greenCdn ? 'HIT' : hop.sub}
              </text>
            </g>
          );
        })}

        {/* request / response label */}
        <text x={W / 2} y={20} textAnchor="middle" fontSize={11} style={{ fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
          {step.dir === 'forward' ? 'request →' : step.dir === 'back' ? '← response' : '· processing ·'}
        </text>
      </svg>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {steps.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => seek(i)}
            aria-label={`Step ${i + 1}: ${HOPS[idxOf(s.at)].label}`}
            className={`h-2.5 w-2.5 rounded-full transition ${i === index ? 'bg-accent' : i < index ? 'bg-accent/40' : 'bg-edge'}`}
          />
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
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= steps.length - 1}>
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

      <div className="mt-4 flex items-start gap-2 border-t border-edge pt-4 font-mono text-xs text-muted">
        <span className="shrink-0 text-accent">{index + 1}/{steps.length}</span>
        <span>{step.note}</span>
      </div>
    </div>
  );
}
