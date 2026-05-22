import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

type Strategy = 'cache-aside' | 'read-through' | 'write-through' | 'write-back';
type Op = 'read' | 'write';

// Which node is touched at each step; used to light the diagram.
type CacheNode = 'app' | 'cache' | 'db';

type Step = {
  active: CacheNode;
  /** Edge lit: [from, to] or null. */
  edge: [CacheNode, CacheNode] | null;
  note: string;
  /** Mark this step as a cache hit (emerald) or miss (amber). */
  mark?: 'hit' | 'miss' | 'write';
};

const STRATEGIES: { id: Strategy; label: string; op: Op; blurb: string }[] = [
  { id: 'cache-aside', label: 'Cache-aside', op: 'read', blurb: 'App checks cache; on miss it loads from DB and populates the cache itself (lazy).' },
  { id: 'read-through', label: 'Read-through', op: 'read', blurb: 'App always asks the cache; the cache loads from DB on a miss (cache owns the read).' },
  { id: 'write-through', label: 'Write-through', op: 'write', blurb: 'Write goes to cache AND DB synchronously — cache always fresh, writes slower.' },
  { id: 'write-back', label: 'Write-back', op: 'write', blurb: 'Write goes to cache only; DB updated later (async). Fast writes, risk of loss.' },
];

function buildSteps(strategy: Strategy, hit: boolean): Step[] {
  switch (strategy) {
    case 'cache-aside':
      return hit
        ? [
            { active: 'app', edge: ['app', 'cache'], note: 'App reads: look up the key in the cache.' },
            { active: 'cache', edge: null, note: 'Cache HIT — value is present.', mark: 'hit' },
            { active: 'app', edge: ['cache', 'app'], note: 'Return cached value. DB never touched.', mark: 'hit' },
          ]
        : [
            { active: 'app', edge: ['app', 'cache'], note: 'App reads: look up the key in the cache.' },
            { active: 'cache', edge: null, note: 'Cache MISS — not present.', mark: 'miss' },
            { active: 'db', edge: ['app', 'db'], note: 'App loads the value from the database itself.' },
            { active: 'cache', edge: ['app', 'cache'], note: 'App writes the value into the cache (populate).', mark: 'write' },
            { active: 'app', edge: ['cache', 'app'], note: 'App returns the value. Next read will hit.' },
          ];

    case 'read-through':
      return hit
        ? [
            { active: 'app', edge: ['app', 'cache'], note: 'App reads through the cache (cache is the read API).' },
            { active: 'cache', edge: null, note: 'Cache HIT — value present.', mark: 'hit' },
            { active: 'app', edge: ['cache', 'app'], note: 'Cache returns the value.', mark: 'hit' },
          ]
        : [
            { active: 'app', edge: ['app', 'cache'], note: 'App reads through the cache.' },
            { active: 'cache', edge: null, note: 'Cache MISS.', mark: 'miss' },
            { active: 'db', edge: ['cache', 'db'], note: 'The CACHE loads from the DB (not the app).' },
            { active: 'cache', edge: ['db', 'cache'], note: 'Cache stores the value it fetched.', mark: 'write' },
            { active: 'app', edge: ['cache', 'app'], note: 'Cache returns the value to the app.' },
          ];

    case 'write-through':
      return [
        { active: 'app', edge: ['app', 'cache'], note: 'App writes to the cache.' },
        { active: 'cache', edge: ['cache', 'db'], note: 'Cache writes synchronously through to the DB.', mark: 'write' },
        { active: 'db', edge: null, note: 'DB persists the write.' },
        { active: 'app', edge: ['cache', 'app'], note: 'Ack returns only after BOTH are written. Cache stays consistent.', mark: 'hit' },
      ];

    case 'write-back':
      return [
        { active: 'app', edge: ['app', 'cache'], note: 'App writes to the cache only.' },
        { active: 'cache', edge: null, note: 'Cache marks the entry dirty and acks immediately — fast.', mark: 'write' },
        { active: 'app', edge: ['cache', 'app'], note: 'App gets a fast ack (DB not yet updated).' },
        { active: 'db', edge: ['cache', 'db'], note: 'Later, the cache flushes dirty entries to the DB (async). Crash before flush = data loss.', mark: 'miss' },
      ];
  }
}

const NODE_POS: Record<CacheNode, { x: number; label: string }> = {
  app: { x: 70, label: 'App' },
  cache: { x: 250, label: 'Cache' },
  db: { x: 430, label: 'Database' },
};

const markColor = (m?: Step['mark']) =>
  m === 'hit' ? '#10b981' : m === 'miss' ? '#fbbf24' : m === 'write' ? '#8b5cf6' : 'var(--accent)';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function CacheStrategyVisualizer() {
  const [strategy, setStrategy] = useState<Strategy>('cache-aside');
  const [hit, setHit] = useState(false);

  const meta = STRATEGIES.find((s) => s.id === strategy)!;
  const isRead = meta.op === 'read';

  const steps = useMemo(() => buildSteps(strategy, hit), [strategy, hit]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(steps.length, 2);
  const step = steps[Math.min(index, steps.length - 1)] ?? steps[0];

  const W = 500;
  const H = 130;
  const nodeY = 50;
  const nh = 46;
  const nw = 88;

  const lit = step.mark;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      {/* strategy selector */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap overflow-hidden rounded border border-edge">
          {STRATEGIES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStrategy(s.id)}
              aria-pressed={strategy === s.id}
              className={`px-3 py-1 text-sm transition ${strategy === s.id ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {isRead && (
          <div className="inline-flex overflow-hidden rounded border border-edge">
            <button
              type="button"
              onClick={() => setHit(true)}
              aria-pressed={hit}
              className={`px-3 py-1 text-sm transition ${hit ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}
            >
              Hit
            </button>
            <button
              type="button"
              onClick={() => setHit(false)}
              aria-pressed={!hit}
              className={`px-3 py-1 text-sm transition ${!hit ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}
            >
              Miss
            </button>
          </div>
        )}
        <span className="font-mono text-xs text-muted">
          {isRead ? 'READ path' : 'WRITE path'}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '11rem' }} role="img" aria-label="Cache strategy data flow">
        {/* edges between adjacent + app-db long edge */}
        {([['app', 'cache'], ['cache', 'db']] as [CacheNode, CacheNode][]).map(([a, b], i) => {
          const isLit =
            step.edge != null &&
            ((step.edge[0] === a && step.edge[1] === b) || (step.edge[0] === b && step.edge[1] === a));
          const forward = step.edge ? step.edge[0] === a : true;
          const x1 = NODE_POS[a].x + nw;
          const x2 = NODE_POS[b].x;
          const y = nodeY + nh / 2;
          return (
            <g key={i}>
              <line x1={x1} y1={y} x2={x2} y2={y}
                style={{ stroke: isLit ? markColor(lit) : 'var(--border)' }} strokeWidth={isLit ? 3 : 1.5} />
              {isLit && (
                <polygon
                  points={forward ? `${x2 - 9},${y - 5} ${x2 - 9},${y + 5} ${x2},${y}` : `${x1 + 9},${y - 5} ${x1 + 9},${y + 5} ${x1},${y}`}
                  style={{ fill: markColor(lit) }}
                />
              )}
            </g>
          );
        })}
        {/* app <-> db direct edge (cache-aside miss) arches over the cache */}
        {step.edge && ((step.edge[0] === 'app' && step.edge[1] === 'db') || (step.edge[0] === 'db' && step.edge[1] === 'app')) && (
          <path
            d={`M ${NODE_POS.app.x + nw / 2} ${nodeY} Q ${(NODE_POS.app.x + NODE_POS.db.x) / 2 + nw / 2} ${4} ${NODE_POS.db.x + nw / 2} ${nodeY}`}
            fill="none" style={{ stroke: markColor(lit) }} strokeWidth={2.5} strokeDasharray="4 3"
          />
        )}

        {/* nodes */}
        {(Object.keys(NODE_POS) as CacheNode[]).map((n) => {
          const active = step.active === n;
          const col = active ? markColor(lit) : 'var(--border)';
          return (
            <g key={n}>
              <rect x={NODE_POS[n].x} y={nodeY} width={nw} height={nh} rx={8}
                style={{ fill: active ? `color-mix(in oklab, ${col} 18%, var(--surface))` : 'var(--surface)', stroke: col }}
                strokeWidth={2.5} />
              <text x={NODE_POS[n].x + nw / 2} y={nodeY + nh / 2} textAnchor="middle" dominantBaseline="central"
                fontSize={12} style={{ fill: 'var(--fg)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {NODE_POS[n].label}
              </text>
            </g>
          );
        })}

        {/* hit/miss badge over the cache */}
        {lit && (
          <text x={NODE_POS.cache.x + nw / 2} y={nodeY - 8} textAnchor="middle" fontSize={11}
            style={{ fill: markColor(lit), fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            {lit === 'hit' ? 'HIT' : lit === 'miss' ? 'MISS' : 'WRITE'}
          </text>
        )}
      </svg>

      {/* step dots */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {steps.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => seek(i)}
            aria-label={`Step ${i + 1}`}
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

      <div className="mt-4 border-t border-edge pt-4 text-xs">
        <p className="mb-2 text-muted"><span className="font-semibold text-fg">{meta.label}:</span> {meta.blurb}</p>
        <div className="flex items-start gap-2 font-mono text-muted">
          <span className="shrink-0 text-accent">{index + 1}/{steps.length}</span>
          <span>{step.note}</span>
        </div>
      </div>
    </div>
  );
}
