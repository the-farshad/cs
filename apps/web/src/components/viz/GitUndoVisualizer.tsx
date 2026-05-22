import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// Visualizes how the different "undo" commands move (or extend) history.
// reset MOVES the branch pointer; revert ADDS a new inverse commit; reflog
// remembers where HEAD used to be so a "lost" commit can be recovered.

type Commit = { id: string; index: number; faded?: boolean; inverse?: boolean };
type Frame = {
  commits: Commit[];
  branch: string; // commit id the main pointer is on
  workingDirty?: boolean; // working tree has changes
  staged?: boolean; // changes also staged
  reflog: string[]; // commit ids HEAD has visited (most recent last)
  highlight?: string; // commit id to emphasize
  marker?: 'reset' | 'revert' | 'recover';
  note: string;
};

type Mode = 'soft' | 'mixed' | 'hard' | 'revert' | 'reflog';

const BASE: Commit[] = [
  { id: 'A', index: 0 },
  { id: 'B', index: 1 },
  { id: 'C', index: 2 },
];

function buildFrames(mode: Mode): Frame[] {
  const commits = BASE.map((c) => ({ ...c }));
  const frames: Frame[] = [];
  const reflog = ['A', 'B', 'C'];
  frames.push({
    commits: commits.map((c) => ({ ...c })),
    branch: 'C',
    reflog: [...reflog],
    note: 'start: three commits, HEAD → main on C',
  });

  if (mode === 'soft' || mode === 'mixed' || mode === 'hard') {
    const flavor = mode === 'soft' ? '--soft' : mode === 'mixed' ? '--mixed' : '--hard';
    frames.push({
      commits: commits.map((c) => ({ ...c, faded: c.id === 'C' })),
      branch: 'C',
      reflog: [...reflog],
      highlight: 'B',
      marker: 'reset',
      note: `git reset ${flavor} B   ·   target the parent commit B`,
    });
    reflog.push('B');
    if (mode === 'soft') {
      frames.push({
        commits: commits.map((c) => ({ ...c, faded: c.id === 'C' })),
        branch: 'B',
        staged: true,
        workingDirty: true,
        reflog: [...reflog],
        marker: 'reset',
        note: 'branch moves to B; C’s changes kept STAGED (ready to recommit)',
      });
    } else if (mode === 'mixed') {
      frames.push({
        commits: commits.map((c) => ({ ...c, faded: c.id === 'C' })),
        branch: 'B',
        workingDirty: true,
        reflog: [...reflog],
        marker: 'reset',
        note: 'branch moves to B; changes kept in the working tree but UNSTAGED (default)',
      });
    } else {
      frames.push({
        commits: commits.map((c) => ({ ...c, faded: c.id === 'C' })),
        branch: 'B',
        reflog: [...reflog],
        marker: 'reset',
        note: 'branch moves to B; working tree reset too — C’s changes are GONE (destructive)',
      });
    }
  } else if (mode === 'revert') {
    frames.push({
      commits: commits.map((c) => ({ ...c })),
      branch: 'C',
      reflog: [...reflog],
      highlight: 'C',
      marker: 'revert',
      note: 'git revert C   ·   compute the inverse of C’s changes',
    });
    commits.push({ id: "C'", index: 3, inverse: true });
    reflog.push("C'");
    frames.push({
      commits: commits.map((c) => ({ ...c })),
      branch: "C'",
      reflog: [...reflog],
      highlight: "C'",
      marker: 'revert',
      note: "a NEW commit C′ is appended that undoes C; history is preserved, nothing rewritten",
    });
  } else {
    // reflog recovery: hard-reset away a commit, then get it back
    frames.push({
      commits: commits.map((c) => ({ ...c, faded: c.id === 'C' })),
      branch: 'B',
      reflog: ['A', 'B', 'C', 'B'],
      marker: 'reset',
      note: 'git reset --hard B   ·   C seems lost — no branch points to it anymore',
    });
    frames.push({
      commits: commits.map((c) => ({ ...c, faded: c.id === 'C' })),
      branch: 'B',
      reflog: ['A', 'B', 'C', 'B'],
      highlight: 'C',
      note: 'git reflog   ·   HEAD’s movement log still remembers C’s hash',
    });
    frames.push({
      commits: commits.map((c) => ({ ...c })),
      branch: 'C',
      reflog: ['A', 'B', 'C', 'B', 'C'],
      highlight: 'C',
      marker: 'recover',
      note: 'git reset --hard C@{1}   ·   point main back at C — recovered!',
    });
  }
  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const COL = 92;
const PADX = 36;
const CY = 46;

const MODES: { id: Mode; label: string }[] = [
  { id: 'soft', label: 'reset --soft' },
  { id: 'mixed', label: 'reset --mixed' },
  { id: 'hard', label: 'reset --hard' },
  { id: 'revert', label: 'revert' },
  { id: 'reflog', label: 'reflog recover' },
];

export default function GitUndoVisualizer() {
  const [mode, setMode] = useState<Mode>('hard');
  const frames = useMemo(() => buildFrames(mode), [mode]);
  const { index, playing, fps, setFps, play, pause, next, prev, seek } = useStepper(frames.length);
  const frame = frames[Math.min(index, frames.length - 1)] ?? frames[0];

  const width = PADX * 2 + (frame.commits.length - 1) * COL + 40;

  const markerColor =
    frame.marker === 'revert'
      ? '#38bdf8'
      : frame.marker === 'recover'
        ? '#10b981'
        : frame.marker === 'reset'
          ? '#f43f5e'
          : 'var(--accent)';

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`rounded border px-3 py-1 font-mono text-xs transition ${
              mode === m.id ? 'border-accent bg-accent text-accent-fg' : 'border-edge text-fg hover:border-accent hover:text-accent'
            }`}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-edge bg-bg/40">
        <svg width={Math.max(width, 320)} height={120} role="img" aria-label="git history with branch pointer">
          {frame.commits.map((c, i) => {
            if (i === 0) return null;
            const prev = frame.commits[i - 1];
            const x1 = PADX + prev.index * COL;
            const x2 = PADX + c.index * COL;
            return (
              <line
                key={`e${c.id}`}
                x1={x1 + 16}
                y1={CY}
                x2={x2 - 16}
                y2={CY}
                style={{ stroke: c.inverse ? '#38bdf8' : 'var(--border)' }}
                strokeWidth={2}
                strokeDasharray={c.inverse ? '4 3' : undefined}
              />
            );
          })}
          {frame.commits.map((c) => {
            const x = PADX + c.index * COL;
            const isTip = c.id === frame.branch;
            const isHi = c.id === frame.highlight;
            const fill = isTip ? 'var(--accent)' : c.faded ? 'var(--bg)' : 'var(--surface)';
            const stroke = isHi ? markerColor : isTip ? 'var(--accent)' : c.inverse ? '#38bdf8' : 'var(--border)';
            const txt = isTip ? 'var(--accent-fg)' : c.faded ? 'var(--muted)' : 'var(--fg)';
            return (
              <g key={c.id} opacity={c.faded ? 0.45 : 1}>
                <circle cx={x} cy={CY} r={16} style={{ fill, stroke }} strokeWidth={isHi ? 3 : 2.5} strokeDasharray={c.faded ? '3 3' : undefined} />
                <text x={x} y={CY} textAnchor="middle" dominantBaseline="central" fontSize={12} style={{ fill: txt, fontFamily: 'var(--font-mono)' }}>
                  {c.id}
                </text>
                {isTip && (
                  <g transform={`translate(${x - 30}, ${CY + 26})`}>
                    <rect width={62} height={18} rx={4} style={{ fill: 'var(--accent)', stroke: 'var(--accent)' }} />
                    <text x={31} y={9} textAnchor="middle" dominantBaseline="central" fontSize={10} style={{ fill: 'var(--accent-fg)', fontFamily: 'var(--font-mono)' }}>
                      main
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 font-mono text-[11px]">
        <span className={`rounded px-2 py-0.5 ${frame.staged ? 'text-emerald-400' : 'text-muted opacity-50'}`} style={frame.staged ? { border: '1px solid #10b981' } : { border: '1px solid var(--border)' }}>
          staged: {frame.staged ? 'C’s changes' : 'clean'}
        </span>
        <span className={`rounded px-2 py-0.5 ${frame.workingDirty ? 'text-amber-400' : 'text-muted opacity-50'}`} style={frame.workingDirty ? { border: '1px solid #fbbf24' } : { border: '1px solid var(--border)' }}>
          working tree: {frame.workingDirty ? 'modified' : 'clean'}
        </span>
      </div>

      <div className="mt-3 rounded border border-edge bg-bg/40 p-2 font-mono text-[11px] text-muted">
        <span className="text-fg">reflog</span> (HEAD history, newest right):{' '}
        {frame.reflog.map((id, i) => (
          <span key={i} className={i === frame.reflog.length - 1 ? 'text-accent' : ''}>
            {id}
            {i < frame.reflog.length - 1 ? ' ← ' : ''}
          </span>
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
        <button type="button" className={btn} onClick={next} disabled={index >= frames.length - 1}>
          Step <Icon name="chevron-right" size={16} />
        </button>
        <button type="button" className={btn} onClick={() => seek(0)} disabled={index === 0}>
          <Icon name="rotate-ccw" size={15} /> Restart
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={1} max={6} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
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
