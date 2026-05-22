import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// Two diverged branches sharing ancestor B. `rebase` lifts the feature commits
// off and replays them onto main's tip as NEW commits (new hashes), giving a
// linear history. `merge` instead ties them with a two-parent merge commit.

type Node = {
  id: string;
  x: number;
  y: number;
  parents: string[];
  kind: 'base' | 'main' | 'feature' | 'replay' | 'merge';
  ghost?: boolean; // original feature commit, shown faded after replay
  highlight?: boolean;
};
type Frame = {
  nodes: Node[];
  headBranch: 'main' | 'feature';
  featureTip: string;
  mainTip: string;
  note: string;
};

// layout columns
const C = (i: number) => 40 + i * 84;
const TOP = 40;
const BOT = 104;

// shared base history: A - B on main, then main continues to C, D
const baseNodes = (): Node[] => [
  { id: 'A', x: C(0), y: TOP, parents: [], kind: 'base' },
  { id: 'B', x: C(1), y: TOP, parents: ['A'], kind: 'base' },
  { id: 'C', x: C(2), y: TOP, parents: ['B'], kind: 'main' },
  { id: 'D', x: C(3), y: TOP, parents: ['C'], kind: 'main' },
  { id: 'e1', x: C(2), y: BOT, parents: ['B'], kind: 'feature' },
  { id: 'e2', x: C(3), y: BOT, parents: ['e1'], kind: 'feature' },
];

function rebaseFrames(): Frame[] {
  const frames: Frame[] = [];
  frames.push({
    nodes: baseNodes(),
    headBranch: 'feature',
    featureTip: 'e2',
    mainTip: 'D',
    note: 'diverged: feature (e1,e2) branched from B; main moved on to C,D',
  });
  // step: identify commits to replay
  frames.push({
    nodes: baseNodes().map((n) => (n.id === 'e1' || n.id === 'e2' ? { ...n, highlight: true } : n)),
    headBranch: 'feature',
    featureTip: 'e2',
    mainTip: 'D',
    note: 'git rebase main   ·   find feature’s commits not on main: e1, e2',
  });
  // step: lift them off (ghost)
  const lifted = baseNodes().map((n) => (n.id === 'e1' || n.id === 'e2' ? { ...n, ghost: true } : n));
  frames.push({
    nodes: lifted,
    headBranch: 'feature',
    featureTip: 'e2',
    mainTip: 'D',
    note: 'set them aside as patches; rewind feature to the new base (main’s tip D)',
  });
  // step: replay e1 -> e1'
  const replay1: Node[] = [
    ...lifted,
    { id: "e1'", x: C(4), y: TOP, parents: ['D'], kind: 'replay', highlight: true },
  ];
  frames.push({
    nodes: replay1,
    headBranch: 'feature',
    featureTip: "e1'",
    mainTip: 'D',
    note: "replay e1 on top of D → NEW commit e1′ (same changes, new hash)",
  });
  // step: replay e2 -> e2'
  const replay2: Node[] = [
    ...lifted,
    { id: "e1'", x: C(4), y: TOP, parents: ['D'], kind: 'replay' },
    { id: "e2'", x: C(5), y: TOP, parents: ["e1'"], kind: 'replay', highlight: true },
  ];
  frames.push({
    nodes: replay2,
    headBranch: 'feature',
    featureTip: "e2'",
    mainTip: 'D',
    note: "replay e2 → e2′. History is now LINEAR: A B C D e1′ e2′",
  });
  return frames;
}

function mergeFrames(): Frame[] {
  const frames: Frame[] = [];
  frames.push({
    nodes: baseNodes(),
    headBranch: 'main',
    featureTip: 'e2',
    mainTip: 'D',
    note: 'same diverged history; this time we merge instead of rebase',
  });
  frames.push({
    nodes: baseNodes().map((n) => (n.id === 'D' || n.id === 'e2' ? { ...n, highlight: true } : n)),
    headBranch: 'main',
    featureTip: 'e2',
    mainTip: 'D',
    note: 'git merge feature   ·   combine the two tips D and e2',
  });
  const merged: Node[] = [
    ...baseNodes(),
    { id: 'M', x: C(4), y: TOP, parents: ['D', 'e2'], kind: 'merge', highlight: true },
  ];
  frames.push({
    nodes: merged,
    headBranch: 'main',
    featureTip: 'e2',
    mainTip: 'M',
    note: 'a merge commit M with TWO parents joins them; every original commit stays put',
  });
  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function GitRebaseVisualizer() {
  const [op, setOp] = useState<'rebase' | 'merge'>('rebase');
  const frames = useMemo(() => (op === 'rebase' ? rebaseFrames() : mergeFrames()), [op]);
  const { index, playing, fps, setFps, play, pause, next, prev, seek } = useStepper(frames.length);
  const frame = frames[Math.min(index, frames.length - 1)] ?? frames[0];

  const width = Math.max(...frame.nodes.map((n) => n.x), 0) + 70;
  const posOf = new Map(frame.nodes.map((n) => [n.id, n]));
  const tips: Record<string, string[]> = {};
  tips[frame.mainTip] = [...(tips[frame.mainTip] ?? []), 'main'];
  tips[frame.featureTip] = [...(tips[frame.featureTip] ?? []), 'feature'];

  const colorFor = (n: Node) => {
    if (n.kind === 'replay') return '#10b981';
    if (n.kind === 'merge') return '#8b5cf6';
    if (n.kind === 'feature') return '#38bdf8';
    return 'var(--border)';
  };

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`rounded border px-3 py-1 font-mono text-xs transition ${op === 'rebase' ? 'border-accent bg-accent text-accent-fg' : 'border-edge text-fg hover:border-accent hover:text-accent'}`}
          onClick={() => setOp('rebase')}
        >
          <Icon name="git-branch" size={13} className="-mt-0.5 mr-1 inline" />
          rebase
        </button>
        <button
          type="button"
          className={`rounded border px-3 py-1 font-mono text-xs transition ${op === 'merge' ? 'border-accent bg-accent text-accent-fg' : 'border-edge text-fg hover:border-accent hover:text-accent'}`}
          onClick={() => setOp('merge')}
        >
          merge
        </button>
        <span className="ml-auto font-mono text-[11px] text-muted">
          <span style={{ color: '#10b981' }}>green</span> = replayed (new hash) ·{' '}
          <span style={{ color: '#8b5cf6' }}>violet</span> = merge commit
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-edge bg-bg/40">
        <svg width={Math.max(width, 420)} height={172} role="img" aria-label="rebase vs merge commit graph">
          {frame.nodes.map((n) =>
            n.parents.map((p) => {
              const a = posOf.get(n.id)!;
              const b = posOf.get(p);
              if (!b) return null;
              const replayed = n.kind === 'replay' || n.kind === 'merge';
              return (
                <line
                  key={n.id + p}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  style={{ stroke: replayed ? '#10b981' : n.kind === 'feature' ? '#38bdf8' : 'var(--border)' }}
                  strokeWidth={2}
                  opacity={n.ghost ? 0.3 : 1}
                />
              );
            }),
          )}
          {frame.nodes.map((n) => {
            const isTip = n.id === frame.mainTip || n.id === frame.featureTip;
            const stroke = n.highlight ? colorFor(n) : isTip ? 'var(--accent)' : colorFor(n);
            const fill = isTip && !n.ghost ? 'var(--accent)' : 'var(--surface)';
            const txt = isTip && !n.ghost ? 'var(--accent-fg)' : 'var(--fg)';
            const labels = tips[n.id] ?? [];
            return (
              <g key={n.id} opacity={n.ghost ? 0.32 : 1}>
                <circle cx={n.x} cy={n.y} r={15} style={{ fill, stroke }} strokeWidth={n.highlight ? 3 : 2.5} strokeDasharray={n.ghost ? '3 3' : undefined} />
                <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central" fontSize={11} style={{ fill: txt, fontFamily: 'var(--font-mono)' }}>
                  {n.id}
                </text>
                {labels.map((b, k) => {
                  const head = b === frame.headBranch;
                  const label = head ? `HEAD→${b}` : b;
                  const w = label.length * 6.4 + 10;
                  const ly = n.y - 30 - k * 20;
                  return (
                    <g key={b} transform={`translate(${n.x - w / 2}, ${ly})`}>
                      <rect width={w} height={17} rx={4} style={{ fill: head ? 'var(--accent)' : 'var(--surface)', stroke: head ? 'var(--accent)' : 'var(--border)' }} strokeWidth={1.5} />
                      <text x={w / 2} y={9} textAnchor="middle" dominantBaseline="central" fontSize={10} style={{ fill: head ? 'var(--accent-fg)' : 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                        {label}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
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
        <button type="button" className={btn} onClick={() => seek(0)} disabled={index === 0}>
          <Icon name="rotate-ccw" size={15} /> Restart
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={1} max={5} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input type="range" min={0} max={Math.max(frames.length - 1, 0)} value={index} onChange={(e) => seek(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Timeline" />
        <span className="shrink-0 font-mono text-xs text-muted">
          {index + 1}/{frames.length}
        </span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-fg">{frame.note}</div>
    </div>
  );
}
