import { useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';

const RING = 360; // positions 0..359 on the ring
const N_KEYS = 24;
const VNODES = 3; // virtual nodes per physical node — smooths distribution

/** Small stable string hash → position on the ring. */
function hashPos(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % RING);
}

const COLORS = ['var(--accent)', '#38bdf8', '#10b981', '#fbbf24', '#8b5cf6', '#f43f5e'];

type Node = { name: string; color: string };

function nodePositions(nodes: Node[]): { pos: number; node: number }[] {
  const pts: { pos: number; node: number }[] = [];
  nodes.forEach((n, ni) => {
    for (let v = 0; v < VNODES; v++) {
      pts.push({ pos: hashPos(`${n.name}#${v}`), node: ni });
    }
  });
  return pts.sort((a, b) => a.pos - b.pos);
}

/** Consistent hashing: each key maps to the first node clockwise. */
function assignRing(keys: number[], ring: { pos: number; node: number }[]): number[] {
  if (ring.length === 0) return keys.map(() => -1);
  return keys.map((k) => {
    const kp = hashPos(`key${k}`);
    for (const r of ring) if (r.pos >= kp) return r.node;
    return ring[0].node; // wrap around
  });
}

/** Naive modulo: key -> node by hash % nodeCount. */
function assignModulo(keys: number[], n: number): number[] {
  if (n === 0) return keys.map(() => -1);
  return keys.map((k) => hashPos(`key${k}`) % n);
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function ConsistentHashingVisualizer() {
  const [mode, setMode] = useState<'ring' | 'modulo'>('ring');
  const [count, setCount] = useState(3); // number of physical nodes (3..6)

  const keys = useMemo(() => Array.from({ length: N_KEYS }, (_, i) => i + 1), []);
  const allNodes: Node[] = useMemo(
    () => Array.from({ length: 6 }, (_, i) => ({ name: `node${String.fromCharCode(65 + i)}`, color: COLORS[i] })),
    [],
  );
  // "Before" = current count; "after" = count with one more node added.
  // We compare the two to count how many keys remap when a node is added.
  const before = useMemo(() => allNodes.slice(0, count), [allNodes, count]);
  const after = useMemo(() => allNodes.slice(0, Math.min(count + 1, 6)), [allNodes, count]);
  const nodes = before;
  const canAdd = count < 6;

  const ringBefore = useMemo(() => nodePositions(before), [before]);
  const ringAfter = useMemo(() => nodePositions(after), [after]);

  const assignBefore =
    mode === 'ring' ? assignRing(keys, ringBefore) : assignModulo(keys, before.length);
  const assignAfter =
    mode === 'ring' ? assignRing(keys, ringAfter) : assignModulo(keys, after.length);

  const remapped = canAdd ? keys.filter((_, i) => assignBefore[i] !== assignAfter[i]).length : 0;
  const remappedPct = Math.round((remapped / keys.length) * 100);

  // SVG ring geometry.
  const SZ = 320;
  const cx = SZ / 2;
  const cy = SZ / 2;
  const rRing = 118;
  const rKey = 142;
  const rNode = 96;
  const angle = (pos: number) => (pos / RING) * 2 * Math.PI - Math.PI / 2;
  const onCircle = (pos: number, r: number) => ({
    x: cx + r * Math.cos(angle(pos)),
    y: cy + r * Math.sin(angle(pos)),
  });

  const remapSet = new Set(canAdd ? keys.filter((_, i) => assignBefore[i] !== assignAfter[i]) : []);

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded border border-edge">
          {(['ring', 'modulo'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`px-3 py-1 text-sm transition ${mode === m ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}
            >
              {m === 'ring' ? 'Consistent hash' : 'Naive modulo'}
            </button>
          ))}
        </div>
        <button type="button" className={btn} onClick={() => setCount((c) => Math.min(c + 1, 6))} disabled={count >= 6}>
          <Icon name="arrow-up" size={16} /> Add node
        </button>
        <button type="button" className={btn} onClick={() => setCount((c) => Math.max(c - 1, 2))} disabled={count <= 2}>
          <Icon name="arrow-down" size={16} /> Remove node
        </button>
        <span className="font-mono text-xs text-muted">{count} nodes · {N_KEYS} keys</span>
      </div>

      <div className="grid items-center gap-4 sm:grid-cols-[320px_1fr]">
        <svg viewBox={`0 0 ${SZ} ${SZ}`} className="mx-auto w-full max-w-[320px]" role="img" aria-label={mode === 'ring' ? 'Consistent hashing ring' : 'Modulo mapping'}>
          {mode === 'ring' ? (
            <>
              <circle cx={cx} cy={cy} r={rRing} fill="none" style={{ stroke: 'var(--border)' }} strokeWidth={2} />
              {/* node markers + their owned arcs */}
              {ringBefore.map((r, i) => {
                const p = onCircle(r.pos, rRing);
                const np = onCircle(r.pos, rNode);
                const c = before[r.node].color;
                return (
                  <g key={`n-${i}`}>
                    <line x1={cx} y1={cy} x2={p.x} y2={p.y} style={{ stroke: c, opacity: 0.25 }} strokeWidth={1} />
                    <circle cx={p.x} cy={p.y} r={6} style={{ fill: c, stroke: 'var(--surface)' }} strokeWidth={2} />
                    <text x={np.x} y={np.y} textAnchor="middle" dominantBaseline="central" fontSize={9} style={{ fill: c, fontFamily: 'var(--font-mono)' }}>
                      {String.fromCharCode(65 + r.node)}
                    </text>
                  </g>
                );
              })}
              {/* keys on the ring */}
              {keys.map((k, i) => {
                const kp = hashPos(`key${k}`);
                const p = onCircle(kp, rKey);
                const owner = assignBefore[i];
                const c = owner >= 0 ? before[owner].color : 'var(--muted)';
                const moved = remapSet.has(k);
                return (
                  <g key={`k-${k}`}>
                    <circle cx={p.x} cy={p.y} r={moved ? 5 : 3.5} style={{ fill: c, stroke: moved ? '#fbbf24' : 'transparent' }} strokeWidth={2} />
                  </g>
                );
              })}
              <text x={cx} y={cy - 6} textAnchor="middle" fontSize={11} style={{ fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                hash ring
              </text>
              <text x={cx} y={cy + 10} textAnchor="middle" fontSize={9} style={{ fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                key → next node ↻
              </text>
            </>
          ) : (
            // Modulo: keys laid out in a grid colored by hash % n.
            <g>
              {keys.map((k, i) => {
                const owner = assignBefore[i];
                const c = owner >= 0 ? before[owner].color : 'var(--muted)';
                const col = i % 6;
                const row = Math.floor(i / 6);
                const x = 40 + col * 48;
                const y = 60 + row * 52;
                const moved = remapSet.has(k);
                return (
                  <g key={`m-${k}`}>
                    <rect x={x - 16} y={y - 16} width={32} height={32} rx={6} style={{ fill: c, stroke: moved ? '#fbbf24' : 'var(--surface)' }} strokeWidth={moved ? 2.5 : 1.5} />
                    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={10} style={{ fill: 'var(--accent-fg)', fontFamily: 'var(--font-mono)' }}>
                      {k}
                    </text>
                  </g>
                );
              })}
              <text x={SZ / 2} y={24} textAnchor="middle" fontSize={11} style={{ fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                node = hash(key) % {count}
              </text>
            </g>
          )}
        </svg>

        <div className="space-y-3">
          <div className="rounded-lg border border-edge bg-bg p-3">
            <div className="text-xs text-muted">If you add one more node now</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-2xl" style={{ color: mode === 'ring' ? '#10b981' : '#f43f5e' }}>
                {canAdd ? `${remappedPct}%` : '—'}
              </span>
              <span className="text-sm text-muted">of keys remap</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-surface">
              <div
                className="h-2 rounded-full transition-[width] duration-300"
                style={{ width: `${remappedPct}%`, background: mode === 'ring' ? '#10b981' : '#f43f5e' }}
              />
            </div>
            <div className="mt-1 font-mono text-xs text-muted">
              {canAdd ? `${remapped} of ${keys.length} keys move` : 'at max nodes'}
            </div>
          </div>

          <div className="rounded-lg border border-edge bg-bg p-3 text-xs text-muted">
            {mode === 'ring' ? (
              <>
                Each key walks <span className="text-fg">clockwise</span> to the next node. Adding a node steals
                keys only from <span className="text-fg">one neighbor</span>, so ~1/N of keys move. Yellow-ringed
                dots are the ones that would remap.
              </>
            ) : (
              <>
                With <span className="text-fg">hash % N</span>, changing N reshuffles <span className="text-rose-400">almost every</span> key —
                cache and shard locality are destroyed. Yellow-edged tiles would remap.
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {nodes.map((n, i) => (
              <span key={i} className="flex items-center gap-1.5 font-mono text-xs text-muted">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ background: n.color }} />
                {String.fromCharCode(65 + i)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">
        {mode === 'ring'
          ? 'Consistent hashing keeps remaps small and local when membership changes.'
          : 'Naive modulo couples every key to the node count — avoid it for sharded caches.'}
      </div>
    </div>
  );
}
