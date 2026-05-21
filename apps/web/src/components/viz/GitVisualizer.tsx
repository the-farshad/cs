import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

type Commit = { id: string; parents: string[]; lane: number; index: number };
type GFrame = { commits: Commit[]; branches: Record<string, string>; head: string; note: string };

function replay(cmds: string[]): GFrame[] {
  const commits: Commit[] = [{ id: 'c0', parents: [], lane: 0, index: 0 }];
  const branches: Record<string, string> = { main: 'c0' };
  const branchLane: Record<string, number> = { main: 0 };
  let head = 'main';
  let counter = 1;
  let laneNext = 1;

  const frames: GFrame[] = [];
  const snap = (note: string) =>
    frames.push({ commits: commits.map((c) => ({ ...c, parents: [...c.parents] })), branches: { ...branches }, head, note });
  snap('the repository starts with one commit on main');

  for (const cmd of cmds) {
    const t = cmd.trim().split(/\s+/);
    if (t[0] === 'commit') {
      const id = `c${counter++}`;
      commits.push({ id, parents: [branches[head]], lane: branchLane[head] ?? 0, index: commits.length });
      branches[head] = id;
      snap(`git commit   ·   on ${head}`);
    } else if (t[0] === 'checkout' && t[1] === '-b' && t[2]) {
      const name = t[2];
      if (!branches[name]) {
        branches[name] = branches[head];
        branchLane[name] = laneNext++;
        head = name;
        snap(`git checkout -b ${name}`);
      }
    } else if (t[0] === 'checkout' && t[1]) {
      if (branches[t[1]]) {
        head = t[1];
        snap(`git checkout ${t[1]}`);
      }
    } else if (t[0] === 'merge' && t[1]) {
      const other = branches[t[1]];
      const cur = branches[head];
      if (other && other !== cur) {
        const id = `c${counter++}`;
        commits.push({ id, parents: [cur, other], lane: branchLane[head] ?? 0, index: commits.length });
        branches[head] = id;
        snap(`git merge ${t[1]}   ·   creates a merge commit`);
      }
    }
  }
  return frames;
}

const COL = 72;
const ROW = 66;
const PADX = 28;
const PADY = 34;

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function GitVisualizer() {
  const [cmds, setCmds] = useState<string[]>(() => [
    'commit',
    'checkout -b feature',
    'commit',
    'commit',
    'checkout main',
    'commit',
    'merge feature',
  ]);
  const [name, setName] = useState('feature');

  const frames = useMemo(() => replay(cmds), [cmds]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 2);
  const frame = frames[Math.min(index, frames.length - 1)] ?? frames[0];

  const add = (cmd: string) => setCmds((c) => [...c, cmd]);
  const cleanName = name.trim().replace(/\s+/g, '-') || 'feature';

  const pos = new Map(frame.commits.map((c) => [c.id, { x: PADX + c.index * COL, y: PADY + c.lane * ROW }]));
  const maxIndex = Math.max(...frame.commits.map((c) => c.index), 0);
  const maxLane = Math.max(...frame.commits.map((c) => c.lane), 0);
  const width = PADX * 2 + maxIndex * COL + 160;
  const height = PADY * 2 + maxLane * ROW;

  const headTip = frame.branches[frame.head];
  const tips: Record<string, string[]> = {};
  Object.entries(frame.branches).forEach(([b, cid]) => {
    (tips[cid] ||= []).push(b);
  });

  const branchNames = Object.keys(frame.branches);

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" className={btn} onClick={() => add('commit')}>
          <Icon name="git-branch" size={15} /> commit
        </button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="branch"
          className="w-28 rounded border border-edge bg-bg px-2 py-1 font-mono text-sm text-fg"
        />
        <button type="button" className={btn} onClick={() => add(`checkout -b ${cleanName}`)}>
          new branch
        </button>
        <button type="button" className={btn} onClick={() => add(`checkout ${cleanName}`)}>
          checkout
        </button>
        <button type="button" className={btn} onClick={() => add(`merge ${cleanName}`)}>
          merge
        </button>
        <button type="button" className={btn} onClick={() => setCmds([])}>
          <Icon name="rotate-ccw" size={15} /> reset
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-edge bg-bg/40">
        <svg width={width} height={Math.max(height, ROW)} role="img" aria-label="git commit graph">
          {frame.commits.map((c) =>
            c.parents.map((p) => {
              const a = pos.get(c.id)!;
              const b = pos.get(p);
              if (!b) return null;
              return <line key={c.id + p} x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={{ stroke: 'var(--border)' }} strokeWidth={2} />;
            }),
          )}
          {frame.commits.map((c) => {
            const p = pos.get(c.id)!;
            const isHead = c.id === headTip;
            const isMerge = c.parents.length > 1;
            const fill = isHead ? 'var(--accent)' : 'var(--surface)';
            const stroke = isHead ? 'var(--accent)' : isMerge ? '#8b5cf6' : 'var(--border)';
            const text = isHead ? 'var(--accent-fg)' : 'var(--fg)';
            const labels = tips[c.id] ?? [];
            return (
              <g key={c.id}>
                <circle cx={p.x} cy={p.y} r={14} style={{ fill, stroke }} strokeWidth={2.5} />
                <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize={11} style={{ fill: text, fontFamily: 'var(--font-mono)' }}>
                  {c.id}
                </text>
                {labels.map((b, k) => {
                  const isHeadBranch = b === frame.head;
                  const label = isHeadBranch ? `HEAD → ${b}` : b;
                  const w = label.length * 6.6 + 12;
                  const ly = p.y - 9 + (k - (labels.length - 1) / 2) * 22;
                  return (
                    <g key={b} transform={`translate(${p.x + 20}, ${ly})`}>
                      <rect width={w} height={18} rx={4} style={{ fill: isHeadBranch ? 'var(--accent)' : 'var(--surface)', stroke: isHeadBranch ? 'var(--accent)' : 'var(--border)' }} strokeWidth={1.5} />
                      <text x={6} y={9} dominantBaseline="central" fontSize={11} style={{ fill: isHeadBranch ? 'var(--accent-fg)' : 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
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
        <button type="button" onClick={() => (playing ? pause() : play())} className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90">
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Replay'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= frames.length - 1}>
          Step <Icon name="chevron-right" size={16} />
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={1} max={8} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input type="range" min={0} max={Math.max(frames.length - 1, 0)} value={index} onChange={(e) => seek(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Timeline" />
        <span className="shrink-0 font-mono text-xs text-muted">{index + 1}/{frames.length}</span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs">
        <div className="text-fg">{frame.note}</div>
        <div className="mt-1 text-muted">HEAD → {frame.head} · branches: {branchNames.join(', ')}</div>
      </div>
    </div>
  );
}
