import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// A tiny fully-associative cache with LRU eviction. We access a sequence of
// addresses and show hit / miss plus where the data came from in the hierarchy.

const CACHE_SIZE = 4; // number of lines the L1 cache holds

type Line = { addr: number; lastUsed: number } | null;

type Frame = {
  cache: Line[]; // current cache contents (LRU order tracked by lastUsed)
  addr: number; // address being accessed this step
  result: 'hit' | 'miss' | null;
  evicted: number | null; // address that was evicted, if any
  source: 'L1' | 'RAM' | null; // where the data was ultimately served from
  hits: number;
  misses: number;
  note: string;
};

function simulate(addresses: number[]): Frame[] {
  let cache: Line[] = Array(CACHE_SIZE).fill(null);
  let clock = 0;
  let hits = 0;
  let misses = 0;
  const frames: Frame[] = [];

  frames.push({
    cache: cache.map((l) => (l ? { ...l } : null)),
    addr: -1,
    result: null,
    evicted: null,
    source: null,
    hits,
    misses,
    note: `Empty ${CACHE_SIZE}-line cache. The CPU will request each address in turn.`,
  });

  for (const addr of addresses) {
    clock++;
    const hitIdx = cache.findIndex((l) => l && l.addr === addr);
    if (hitIdx >= 0) {
      hits++;
      cache[hitIdx] = { addr, lastUsed: clock };
      frames.push({
        cache: cache.map((l) => (l ? { ...l } : null)),
        addr,
        result: 'hit',
        evicted: null,
        source: 'L1',
        hits,
        misses,
        note: `Address ${addr} is in the cache — a HIT, served fast from L1.`,
      });
      continue;
    }

    // Miss — fetch from RAM, place in cache, evicting LRU if full.
    misses++;
    const emptyIdx = cache.findIndex((l) => l === null);
    let evicted: number | null = null;
    let slot: number;
    if (emptyIdx >= 0) {
      slot = emptyIdx;
    } else {
      // pick least-recently-used line
      slot = 0;
      for (let i = 1; i < cache.length; i++) {
        if ((cache[i]?.lastUsed ?? Infinity) < (cache[slot]?.lastUsed ?? Infinity)) slot = i;
      }
      evicted = cache[slot]!.addr;
    }
    cache[slot] = { addr, lastUsed: clock };
    frames.push({
      cache: cache.map((l) => (l ? { ...l } : null)),
      addr,
      result: 'miss',
      evicted,
      source: 'RAM',
      hits,
      misses,
      note:
        evicted != null
          ? `Address ${addr} is not cached — a MISS. Cache is full, so evict the least-recently-used line (${evicted}) and load ${addr} from RAM.`
          : `Address ${addr} is not cached — a MISS. Load it from RAM into a free line.`,
    });
  }

  const total = hits + misses || 1;
  frames.push({
    cache: cache.map((l) => (l ? { ...l } : null)),
    addr: -1,
    result: null,
    evicted: null,
    source: null,
    hits,
    misses,
    note: `Done. ${hits} hits, ${misses} misses — hit rate ${((hits / total) * 100).toFixed(0)}%.`,
  });

  return frames;
}

// Relative latency figures (approx cycles) for the hierarchy bar.
const HIERARCHY = [
  { name: 'L1', cycles: 4, color: '#10b981' },
  { name: 'L2', cycles: 12, color: '#38bdf8' },
  { name: 'L3', cycles: 40, color: '#8b5cf6' },
  { name: 'RAM', cycles: 200, color: '#fbbf24' },
  { name: 'Disk', cycles: 1_000_000, color: '#f43f5e' },
];

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const DEFAULT_SEQ = [10, 11, 12, 10, 13, 14, 11, 10, 15, 13];

export default function CacheHierarchyVisualizer() {
  const [addresses, setAddresses] = useState<number[]>(DEFAULT_SEQ);
  const [input, setInput] = useState('');

  const frames = useMemo(() => simulate(addresses), [addresses]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 3);
  const frame = frames[Math.min(index, frames.length - 1)] ?? frames[0];

  // Which step in the access sequence are we on (frame 0 is the empty state).
  const accessIdx = index - 1;

  const addAddr = () => {
    const v = Number(input);
    if (input.trim() !== '' && !Number.isNaN(v) && v >= 0) {
      setAddresses((a) => [...a, Math.floor(v)]);
      setInput('');
    }
  };
  const randomSeq = () => {
    // bias toward reuse so hits and evictions both show up
    const pool = [10, 11, 12, 13, 14, 15];
    setAddresses(Array.from({ length: 10 }, () => pool[Math.floor(Math.random() * pool.length)]));
  };
  const clear = () => setAddresses([]);

  // log scale for the latency bars so disk doesn't dwarf everything to invisibility
  const maxLog = Math.log10(HIERARCHY[HIERARCHY.length - 1].cycles);

  const fmtCycles = (c: number) => (c >= 1_000_000 ? `${(c / 1_000_000).toFixed(0)}M+` : c >= 1000 ? `${(c / 1000).toFixed(0)}k` : `${c}`);

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      {/* Access sequence */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Access sequence:</span>
        <div className="flex flex-wrap gap-1.5">
          {addresses.length === 0 && <span className="font-mono text-xs text-muted/60">empty</span>}
          {addresses.map((a, i) => (
            <span
              key={i}
              className={`rounded border px-1.5 py-0.5 font-mono text-xs ${i === accessIdx ? 'border-accent text-accent' : i < accessIdx ? 'border-edge text-muted/60' : 'border-edge text-fg'}`}
            >
              {a}
            </span>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addAddr()}
          placeholder="address"
          inputMode="numeric"
          className="w-24 rounded border border-edge bg-bg px-2 py-1 text-fg"
        />
        <button type="button" className={btn} onClick={addAddr}>
          Add access
        </button>
        <button type="button" className={btn} onClick={randomSeq}>
          <Icon name="shuffle" size={16} /> Random
        </button>
        <button type="button" className={btn} onClick={clear}>
          <Icon name="rotate-ccw" size={16} /> Clear
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* CPU + cache */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent/10 px-2 py-1 font-mono text-xs text-accent">
              <Icon name="cpu" size={14} /> CPU
            </span>
            <Icon name="arrow-right" size={16} className="text-muted" />
            <span className="font-mono text-xs text-muted">
              requests {frame.addr >= 0 ? frame.addr : '—'}
            </span>
            {frame.result && (
              <span
                className="ml-auto rounded px-2 py-0.5 font-mono text-xs font-medium"
                style={{
                  background: frame.result === 'hit' ? '#10b981' : '#f43f5e',
                  color: frame.result === 'hit' ? '#04140d' : '#1a0408',
                }}
              >
                {frame.result.toUpperCase()}
              </span>
            )}
          </div>

          <div className="rounded-lg border border-edge p-3">
            <div className="mb-2 font-mono text-xs text-muted">L1 cache ({CACHE_SIZE} lines, LRU)</div>
            <div className="space-y-1.5">
              {frame.cache.map((line, i) => {
                const isActive = line != null && line.addr === frame.addr;
                const isHit = isActive && frame.result === 'hit';
                const isLoad = isActive && frame.result === 'miss';
                // mark the LRU line on a miss-with-full-cache as the eviction target context
                let borderColor = 'var(--border)';
                let textColor = 'var(--fg)';
                let bg = 'transparent';
                if (isHit) {
                  borderColor = '#10b981';
                  textColor = '#10b981';
                  bg = 'color-mix(in oklab, #10b981 12%, transparent)';
                } else if (isLoad) {
                  borderColor = 'var(--accent)';
                  textColor = 'var(--accent)';
                  bg = 'color-mix(in oklab, var(--accent) 12%, transparent)';
                }
                return (
                  <div
                    key={i}
                    className="flex h-9 items-center justify-between rounded border px-3 font-mono text-sm transition"
                    style={{ borderColor, color: textColor, background: bg }}
                  >
                    <span className="text-muted/70">line {i}</span>
                    <span>{line ? line.addr : <span className="text-muted/40">empty</span>}</span>
                  </div>
                );
              })}
            </div>
            {frame.evicted != null && (
              <div className="mt-2 flex items-center gap-1.5 font-mono text-xs" style={{ color: '#f43f5e' }}>
                <Icon name="arrow-down" size={14} /> evicted {frame.evicted} (least recently used)
              </div>
            )}
          </div>

          <div className="mt-3 flex gap-3 font-mono text-xs">
            <span className="text-emerald-400">hits {frame.hits}</span>
            <span className="text-rose-400">misses {frame.misses}</span>
            <span className="text-muted">
              hit rate {frame.hits + frame.misses > 0 ? `${Math.round((frame.hits / (frame.hits + frame.misses)) * 100)}%` : '—'}
            </span>
          </div>
        </div>

        {/* Latency hierarchy */}
        <div>
          <div className="mb-2 font-mono text-xs text-muted">Relative latency (approx cycles, log scale)</div>
          <div className="space-y-2">
            {HIERARCHY.map((h) => {
              const widthPct = (Math.log10(h.cycles) / maxLog) * 100;
              const active =
                (frame.source === 'L1' && h.name === 'L1') || (frame.source === 'RAM' && h.name === 'RAM');
              return (
                <div key={h.name} className="flex items-center gap-2">
                  <span className="w-9 shrink-0 text-right font-mono text-xs text-muted">{h.name}</span>
                  <div className="relative h-6 flex-1 overflow-hidden rounded bg-bg">
                    <div
                      className="flex h-full items-center justify-end rounded px-2 font-mono text-[10px] transition-all"
                      style={{
                        width: `${Math.max(widthPct, 12)}%`,
                        background: h.color,
                        color: '#06121f',
                        outline: active ? '2px solid var(--fg)' : 'none',
                        outlineOffset: '-2px',
                      }}
                    >
                      {fmtCycles(h.cycles)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted">
            A miss to RAM costs roughly 50x an L1 hit; a disk miss is millions of cycles. Keeping the working
            set in cache is what makes code fast.
          </p>
        </div>
      </div>

      {/* Playback controls */}
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
          <input type="range" min={1} max={12} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
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

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-fg">{frame.note}</div>
    </div>
  );
}
