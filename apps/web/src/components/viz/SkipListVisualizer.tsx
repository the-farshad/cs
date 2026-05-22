import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// Skip list: a sorted linked list with extra "express lane" levels.
// Each node has a random height; search starts top-left, moves right while the
// next key is <= target, otherwise drops down a level.

type Node = { key: number; height: number };

// A fixed, illustrative skip list (deterministic so the picture is stable).
// height = number of levels this node participates in (1..LEVELS).
const NODES: Node[] = [
  { key: 1, height: 1 },
  { key: 4, height: 3 },
  { key: 7, height: 1 },
  { key: 9, height: 2 },
  { key: 12, height: 1 },
  { key: 17, height: 4 },
  { key: 19, height: 1 },
  { key: 21, height: 2 },
  { key: 25, height: 1 },
  { key: 26, height: 1 },
];
const LEVELS = 4; // levels 0 (bottom, full) .. 3 (top, sparse)

type Frame = {
  level: number; // current search level (LEVELS-1 down to 0)
  nodeIdx: number; // index in NODES of current position (-1 = head sentinel)
  path: { level: number; nodeIdx: number }[]; // visited positions
  hops: number;
  result?: 'found' | 'miss';
  note?: string;
};

function buildFrames(target: number): Frame[] {
  const frames: Frame[] = [];
  const path: { level: number; nodeIdx: number }[] = [];
  let hops = 0;

  // Nodes present on a given level, in order, with their NODES index.
  const onLevel = (lvl: number) =>
    NODES.map((n, i) => ({ i, key: n.key })).filter(({ i }) => NODES[i].height > lvl);

  let nodeIdx = -1; // head sentinel (smaller than everything)
  let level = LEVELS - 1;
  let found = false;

  frames.push({
    level,
    nodeIdx,
    path: [],
    hops,
    note: `search ${target} — start at top-left (level ${level})`,
  });

  while (level >= 0) {
    const lane = onLevel(level);
    // current key (head = -Infinity)
    for (;;) {
      // find the next node on this lane after the current position
      const curKey = nodeIdx === -1 ? -Infinity : NODES[nodeIdx].key;
      const nxt = lane.find(({ key }) => key > curKey);
      if (nxt && nxt.key <= target) {
        nodeIdx = nxt.i;
        hops++;
        path.push({ level, nodeIdx });
        const hit = NODES[nodeIdx].key === target;
        frames.push({
          level,
          nodeIdx,
          path: [...path],
          hops,
          result: hit ? 'found' : undefined,
          note: hit
            ? `key ${target} found at level ${level} after ${hops} hops`
            : `${NODES[nodeIdx].key} <= ${target} → move right on level ${level}`,
        });
        if (hit) {
          found = true;
          break;
        }
      } else {
        // drop down (or stop at bottom)
        if (level === 0) break;
        const peek = nxt ? nxt.key : '∞';
        frames.push({
          level,
          nodeIdx,
          path: [...path],
          hops,
          note: `next key (${peek}) > ${target} → drop down to level ${level - 1}`,
        });
        break;
      }
    }
    if (found) break;
    level--;
  }

  if (!found) {
    frames.push({
      level: 0,
      nodeIdx,
      path: [...path],
      hops,
      result: 'miss',
      note: `key ${target} not in the list (${hops} hops)`,
    });
  }
  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const TARGETS = [4, 9, 17, 21, 13];

export default function SkipListVisualizer() {
  const [target, setTarget] = useState(17);

  const frames = useMemo(() => buildFrames(target), [target]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length);
  const frame = frames[Math.min(index, frames.length - 1)] ?? { level: LEVELS - 1, nodeIdx: -1, path: [], hops: 0 };

  // Layout
  const colW = 56;
  const headW = 40;
  const rowH = 46;
  const padX = 12;
  const padY = 16;
  const W = padX * 2 + headW + NODES.length * colW;
  const H = padY * 2 + LEVELS * rowH;

  const colX = (i: number) => padX + headW + i * colW + colW / 2;
  const headX = padX + headW / 2;
  const rowY = (lvl: number) => padY + (LEVELS - 1 - lvl) * rowH + rowH / 2;

  const onPath = (lvl: number, i: number) => frame.path.some((p) => p.level === lvl && p.nodeIdx === i);
  const isCurrent = (lvl: number, i: number) => frame.level === lvl && frame.nodeIdx === i;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          search for
          <select value={target} onChange={(e) => setTarget(Number(e.target.value))} className="rounded border border-edge bg-bg px-2 py-1 text-fg">
            {TARGETS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <button type="button" className={btn} onClick={reset}>
          <Icon name="rotate-ccw" size={16} /> Reset
        </button>
        <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-xs text-muted">
          <Icon name="layers" size={14} /> {LEVELS} levels
        </span>
      </div>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="block" style={{ minWidth: W, width: '100%' }} role="img" aria-label="skip list search">
          {/* per-level rails connecting consecutive nodes that share the level */}
          {Array.from({ length: LEVELS }, (_, lvl) => {
            const lane = NODES.map((n, i) => ({ i, n })).filter(({ n }) => n.height > lvl);
            const y = rowY(lvl);
            const first = lane[0];
            return (
              <g key={`rail-${lvl}`}>
                {/* head -> first node on lane */}
                <line x1={headX} y1={y} x2={first ? colX(first.i) : W - padX} y2={y} style={{ stroke: 'var(--border)' }} strokeWidth={1.5} strokeDasharray="3 3" />
                {lane.slice(0, -1).map((seg, j) => (
                  <line key={j} x1={colX(seg.i)} y1={y} x2={colX(lane[j + 1].i)} y2={y} style={{ stroke: 'var(--border)' }} strokeWidth={1.5} />
                ))}
              </g>
            );
          })}

          {/* level labels + head sentinel column */}
          {Array.from({ length: LEVELS }, (_, lvl) => (
            <g key={`head-${lvl}`}>
              <rect
                x={padX}
                y={rowY(lvl) - 13}
                width={headW}
                height={26}
                rx={4}
                style={{
                  fill: isCurrent(lvl, -1) ? 'color-mix(in oklab, var(--accent) 18%, var(--surface))' : 'var(--surface)',
                  stroke: isCurrent(lvl, -1) ? 'var(--accent)' : 'var(--border)',
                }}
                strokeWidth={2}
              />
              <text x={headX} y={rowY(lvl)} textAnchor="middle" dominantBaseline="central" fontSize={10} style={{ fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                L{lvl}
              </text>
            </g>
          ))}

          {/* nodes: a tower at each column up to its height */}
          {NODES.map((n, i) =>
            Array.from({ length: n.height }, (_, lvl) => {
              const cur = isCurrent(lvl, i);
              const path = onPath(lvl, i);
              const stroke = cur ? 'var(--accent)' : path ? '#10b981' : 'var(--border)';
              const fill = cur
                ? 'color-mix(in oklab, var(--accent) 22%, var(--surface))'
                : path
                  ? 'color-mix(in oklab, #10b981 16%, var(--surface))'
                  : 'var(--surface)';
              return (
                <g key={`${i}-${lvl}`}>
                  <rect x={colX(i) - 18} y={rowY(lvl) - 13} width={36} height={26} rx={4} style={{ fill, stroke }} strokeWidth={2} />
                  <text x={colX(i)} y={rowY(lvl)} textAnchor="middle" dominantBaseline="central" fontSize={12} style={{ fill: 'var(--fg)', fontFamily: 'var(--font-mono)' }}>
                    {n.key}
                  </text>
                </g>
              );
            }),
          )}
        </svg>
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
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={1} max={12} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input type="range" min={0} max={Math.max(frames.length - 1, 0)} value={index} onChange={(e) => seek(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Timeline" />
        <span className="shrink-0 font-mono text-xs text-muted">{index + 1}/{frames.length}</span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">{frame.note ?? 'pick a target and step through the search'}</div>
    </div>
  );
}
