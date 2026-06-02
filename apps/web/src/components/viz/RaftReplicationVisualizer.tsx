import { useMemo } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const N = 5; // cluster size — odd so a majority exists
const MAJORITY = Math.floor(N / 2) + 1; // 3
const LEADER = 0;
const FOLLOWERS = [1, 2, 3, 4];
// Client commands the leader will append, in order.
const COMMANDS = ['x=1', 'y=2', 'x=3', 'z=9'];

type Entry = { cmd: string; committed: boolean };

type RFrame = {
  /** Each node's log (leader index 0). */
  logs: Entry[][];
  /** Highlighted node receiving an append this step (-1 = none). */
  active: number;
  /** Index of the entry currently in flight (-1 = none). */
  entryIdx: number;
  note: string;
};

/**
 * Walk a simplified Raft happy path: for each client command the leader appends
 * locally, replicates to followers one by one, and commits once a majority
 * (including itself) holds the entry.
 */
function buildFrames(): RFrame[] {
  const logs: Entry[][] = Array.from({ length: N }, () => []);
  const snap = (active: number, entryIdx: number, note: string): RFrame => ({
    logs: logs.map((l) => l.map((e) => ({ ...e }))),
    active,
    entryIdx,
    note,
  });

  const frames: RFrame[] = [snap(LEADER, -1, `Leader is node ${LEADER}. Majority = ${MAJORITY} of ${N}.`)];

  COMMANDS.forEach((cmd, idx) => {
    // 1. Client → leader; leader appends to its own log.
    logs[LEADER].push({ cmd, committed: false });
    frames.push(snap(LEADER, idx, `Client sends "${cmd}". Leader appends to its log (uncommitted).`));

    // 2. Replicate to each follower; track acks (leader counts as 1).
    let acks = 1;
    for (const f of FOLLOWERS) {
      logs[f].push({ cmd, committed: false });
      acks += 1;
      const reached = acks >= MAJORITY;
      frames.push(
        snap(
          f,
          idx,
          reached && !logs[LEADER][idx].committed
            ? `Follower ${f} acks → ${acks}/${N} acks (majority reached).`
            : `Follower ${f} acks "${cmd}" → ${acks}/${N} acks.`,
        ),
      );

      // 3. On reaching majority, commit the entry everywhere that has it.
      if (reached && !logs[LEADER][idx].committed) {
        for (const node of logs) if (node[idx]) node[idx].committed = true;
        frames.push(snap(LEADER, idx, `Majority holds "${cmd}" — leader commits entry ${idx + 1}. Applied to state machine.`));
      }
    }
  });

  frames.push(snap(-1, -1, 'All commands committed. Every log is identical and in the same order.'));
  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const EMPTY: RFrame = { logs: Array.from({ length: N }, () => []), active: -1, entryIdx: -1, note: '' };

export default function RaftReplicationVisualizer() {
  const frames = useMemo(() => buildFrames(), []);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 3);
  const frame = frames[Math.min(index, frames.length - 1)] ?? EMPTY;

  const committedCount = frame.logs[LEADER].filter((e) => e.committed).length;

  const cellCls = (entry: Entry | undefined, node: number, slot: number) => {
    if (!entry) return 'border-dashed border-edge text-muted/40';
    const isActive = frame.active === node && frame.entryIdx === slot && !entry.committed;
    if (entry.committed) return 'border-emerald-500 text-emerald-300';
    if (isActive) return 'border-accent text-accent';
    return 'border-amber-400 text-amber-300';
  };

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="space-y-2">
        {Array.from({ length: N }, (_, node) => {
          const isLeader = node === LEADER;
          const log = frame.logs[node];
          return (
            <div
              key={node}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition ${
                frame.active === node ? 'border-accent bg-accent/5' : 'border-edge'
              }`}
            >
              <div className="flex w-24 shrink-0 items-center gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs ${
                    isLeader ? 'bg-accent text-accent-fg' : 'border border-edge text-fg'
                  }`}
                >
                  {node}
                </span>
                <span className={`text-xs ${isLeader ? 'text-accent' : 'text-muted'}`}>
                  {isLeader ? 'leader' : 'follower'}
                </span>
              </div>
              <div className="flex flex-1 flex-wrap gap-1.5">
                {Array.from({ length: COMMANDS.length }, (_, slot) => {
                  const entry = log[slot];
                  return (
                    <div
                      key={slot}
                      className={`flex h-9 min-w-[3.5rem] items-center justify-center rounded border px-2 font-mono text-xs ${cellCls(entry, node, slot)}`}
                    >
                      {entry ? entry.cmd : '—'}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border border-amber-400" /> replicated (uncommitted)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border border-emerald-500 bg-emerald-500/20" /> committed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border border-accent" /> replicating now
        </span>
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
          {index}/{frames.length - 1}
        </span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">
        {frame.note} · committed {committedCount}/{COMMANDS.length}
      </div>
    </div>
  );
}
