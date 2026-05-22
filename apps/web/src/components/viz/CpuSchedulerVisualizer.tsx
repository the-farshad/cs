import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

type Proc = { id: string; arrival: number; burst: number };
type Policy = 'fcfs' | 'rr' | 'sjf';

// One slice of the timeline: process `id` ran during [start, start+1).
type Slice = { id: string | null; start: number };

type Frame = {
  slices: Slice[]; // committed timeline so far (1 unit each)
  t: number; // current clock
  running: string | null;
  ready: string[]; // ids in the ready queue at this instant
  note: string;
  done: Record<string, number>; // id -> completion time (for finished procs)
};

const PALETTE: Record<string, string> = {
  P1: '#38bdf8',
  P2: '#fbbf24',
  P3: '#10b981',
  P4: '#8b5cf6',
  P5: '#f43f5e',
};
const colorOf = (id: string | null) => (id ? (PALETTE[id] ?? 'var(--accent)') : 'transparent');

const POLICIES: { id: Policy; label: string }[] = [
  { id: 'fcfs', label: 'FCFS' },
  { id: 'rr', label: 'Round-Robin' },
  { id: 'sjf', label: 'SJF (non-preemptive)' },
];

// Simulate one time unit at a time, recording a frame after each unit so the
// Gantt chart fills cell by cell.
function simulate(procs: Proc[], policy: Policy, quantum: number): { frames: Frame[]; stats: Stats | null } {
  const remaining: Record<string, number> = {};
  const completion: Record<string, number> = {};
  procs.forEach((p) => (remaining[p.id] = p.burst));

  const slices: Slice[] = [];
  const frames: Frame[] = [];
  const done: Record<string, number> = {};

  const total = procs.reduce((s, p) => s + p.burst, 0);
  if (total === 0) return { frames: [{ slices: [], t: 0, running: null, ready: [], note: 'No work to schedule.', done: {} }], stats: null };

  let t = 0;
  let queue: string[] = []; // ready queue (RR / FCFS order)
  let current: string | null = null;
  let sliceUsed = 0; // units the current process has run in this RR turn
  const arrivedSet = new Set<string>();
  let guard = 0;
  const maxGuard = 10000;

  const enqueueArrivals = (clock: number) => {
    procs
      .filter((p) => p.arrival === clock && !arrivedSet.has(p.id))
      .sort((a, b) => a.id.localeCompare(b.id))
      .forEach((p) => {
        arrivedSet.add(p.id);
        queue.push(p.id);
      });
  };

  // arrivals at t=0 before the first pick
  enqueueArrivals(0);

  const snap = (running: string | null, note: string) =>
    frames.push({
      slices: slices.map((s) => ({ ...s })),
      t,
      running,
      ready: [...queue],
      note,
      done: { ...done },
    });

  snap(null, 'Clock at 0. Processes whose arrival has passed join the ready queue.');

  while (Object.values(remaining).some((r) => r > 0) && guard++ < maxGuard) {
    // Pick a process if the CPU is free.
    if (current === null) {
      if (queue.length === 0) {
        // CPU idle — advance to the next arrival.
        slices.push({ id: null, start: t });
        t += 1;
        enqueueArrivals(t);
        snap(null, `CPU idle at this tick — no process has arrived yet. Advance the clock.`);
        continue;
      }
      if (policy === 'sjf') {
        // shortest remaining burst among the ready queue
        queue.sort((a, b) => remaining[a] - remaining[b] || a.localeCompare(b));
      }
      current = queue.shift()!;
      sliceUsed = 0;
      snap(current, `Dispatch ${current} (${policy === 'sjf' ? `shortest burst ${remaining[current]}` : 'front of queue'}).`);
    }

    // Run the chosen process for one unit.
    slices.push({ id: current, start: t });
    remaining[current] -= 1;
    sliceUsed += 1;
    t += 1;
    enqueueArrivals(t); // arrivals that land at the new clock value

    if (remaining[current] === 0) {
      completion[current] = t;
      done[current] = t;
      const fin = current;
      current = null;
      snap(null, `${fin} finishes at t=${t}. Completion recorded.`);
    } else if (policy === 'rr' && sliceUsed >= quantum) {
      // quantum expired — current goes to the back, behind anyone who just arrived
      const preempted = current;
      queue.push(preempted);
      current = null;
      snap(preempted, `${preempted} used its full quantum (${quantum}); it goes to the back of the queue.`);
    } else {
      snap(current, `${current} runs (${remaining[current]} unit${remaining[current] === 1 ? '' : 's'} left).`);
    }
  }

  // Final stats.
  let waitSum = 0;
  let turnSum = 0;
  const rows = procs.map((p) => {
    const turnaround = completion[p.id] - p.arrival;
    const wait = turnaround - p.burst;
    waitSum += wait;
    turnSum += turnaround;
    return { id: p.id, arrival: p.arrival, burst: p.burst, completion: completion[p.id], turnaround, wait };
  });
  const n = procs.length || 1;
  const stats: Stats = { rows, avgWait: waitSum / n, avgTurn: turnSum / n };

  snap(null, `All processes complete. Average waiting time ${stats.avgWait.toFixed(2)}, average turnaround ${stats.avgTurn.toFixed(2)}.`);

  return { frames, stats };
}

type Stats = {
  rows: { id: string; arrival: number; burst: number; completion: number; turnaround: number; wait: number }[];
  avgWait: number;
  avgTurn: number;
};

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const DEFAULT: Proc[] = [
  { id: 'P1', arrival: 0, burst: 6 },
  { id: 'P2', arrival: 1, burst: 3 },
  { id: 'P3', arrival: 2, burst: 7 },
  { id: 'P4', arrival: 4, burst: 2 },
];

export default function CpuSchedulerVisualizer() {
  const [procs, setProcs] = useState<Proc[]>(DEFAULT);
  const [policy, setPolicy] = useState<Policy>('rr');
  const [quantum, setQuantum] = useState(2);

  const { frames, stats } = useMemo(() => simulate(procs, policy, quantum), [procs, policy, quantum]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 4);
  const frame = frames[Math.min(index, frames.length - 1)] ?? frames[0];

  const totalUnits = frame.slices.length > 0 ? frame.slices[frame.slices.length - 1].start + 1 : 1;
  const horizon = Math.max(procs.reduce((s, p) => s + p.burst, 0) + 1, totalUnits, 1);
  const CELL = 28;

  const setField = (i: number, key: keyof Proc, value: number) =>
    setProcs((ps) => ps.map((p, k) => (k === i ? { ...p, [key]: Math.max(0, value) } : p)));

  const addProc = () => {
    if (procs.length >= 5) return;
    const id = `P${procs.length + 1}`;
    setProcs((ps) => [...ps, { id, arrival: ps.length, burst: 3 }]);
  };
  const removeProc = () => setProcs((ps) => (ps.length > 1 ? ps.slice(0, -1) : ps));

  // Build the running tally of completed slices for the bar (committed only).
  const cells = Array.from({ length: horizon }, (_, i) => frame.slices.find((s) => s.start === i) ?? null);

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded border border-edge">
          {POLICIES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setPolicy(m.id)}
              aria-pressed={policy === m.id}
              className={`px-3 py-1 text-sm transition ${policy === m.id ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {policy === 'rr' && (
          <label className="flex items-center gap-2 text-sm text-muted">
            Quantum {quantum}
            <input
              type="range"
              min={1}
              max={5}
              value={quantum}
              onChange={(e) => setQuantum(Number(e.target.value))}
              className="accent-[var(--accent)]"
            />
          </label>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button type="button" className={btn} onClick={addProc} disabled={procs.length >= 5}>
            Add process
          </button>
          <button type="button" className={btn} onClick={removeProc} disabled={procs.length <= 1}>
            Remove
          </button>
        </div>
      </div>

      {/* Process table */}
      <div className="mb-4 overflow-x-auto rounded-lg border border-edge">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-edge text-left text-xs text-muted">
              <th className="px-3 py-2 font-medium">Process</th>
              <th className="px-3 py-2 font-medium">Arrival</th>
              <th className="px-3 py-2 font-medium">Burst</th>
            </tr>
          </thead>
          <tbody>
            {procs.map((p, i) => (
              <tr key={p.id} className="border-b border-edge/50 last:border-0">
                <td className="px-3 py-1.5">
                  <span className="inline-flex items-center gap-2 font-mono">
                    <span className="inline-block h-3 w-3 rounded-sm" style={{ background: colorOf(p.id) }} />
                    {p.id}
                  </span>
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="number"
                    min={0}
                    value={p.arrival}
                    onChange={(e) => setField(i, 'arrival', Number(e.target.value))}
                    className="w-16 rounded border border-edge bg-bg px-2 py-0.5 font-mono text-fg"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="number"
                    min={1}
                    value={p.burst}
                    onChange={(e) => setField(i, 'burst', Math.max(1, Number(e.target.value)))}
                    className="w-16 rounded border border-edge bg-bg px-2 py-0.5 font-mono text-fg"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Gantt chart */}
      <div className="overflow-x-auto rounded-lg border border-edge bg-bg/40 p-3">
        <div className="flex" style={{ minWidth: horizon * CELL }}>
          {cells.map((slice, i) => {
            const isCursor = i === frame.t && index < frames.length - 1;
            return (
              <div
                key={i}
                className="flex flex-col items-center"
                style={{ width: CELL }}
              >
                <div
                  className="flex h-10 w-full items-center justify-center border-y border-l border-edge text-xs font-medium last:border-r"
                  style={{
                    background: slice && slice.id ? colorOf(slice.id) : slice && slice.id === null ? 'repeating-linear-gradient(45deg, transparent, transparent 4px, var(--border) 4px, var(--border) 5px)' : 'transparent',
                    color: slice && slice.id ? '#06121f' : 'var(--muted)',
                    outline: isCursor ? '2px solid var(--accent)' : 'none',
                    outlineOffset: '-2px',
                  }}
                >
                  {slice && slice.id ? slice.id.replace('P', '') : ''}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex" style={{ minWidth: horizon * CELL }}>
          {Array.from({ length: horizon + 1 }, (_, i) => (
            <div key={i} className="shrink-0 text-center font-mono text-[10px] text-muted" style={{ width: CELL, marginLeft: i === 0 ? -CELL / 2 : 0 }}>
              {i}
            </div>
          ))}
        </div>
      </div>

      {/* Ready queue + clock */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-mono text-xs text-muted">t = {frame.t}</span>
        <span className="text-muted">running:</span>
        {frame.running ? (
          <span className="rounded px-2 py-0.5 font-mono text-xs" style={{ background: colorOf(frame.running), color: '#06121f' }}>
            {frame.running}
          </span>
        ) : (
          <span className="font-mono text-xs text-muted">idle</span>
        )}
        <span className="ml-2 text-muted">ready queue:</span>
        {frame.ready.length === 0 ? (
          <span className="font-mono text-xs text-muted/60">empty</span>
        ) : (
          frame.ready.map((id, k) => (
            <span key={k} className="rounded border px-1.5 py-0.5 font-mono text-xs" style={{ borderColor: colorOf(id), color: colorOf(id) }}>
              {id}
            </span>
          ))
        )}
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
          <input type="range" min={1} max={20} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
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

      {/* Final metrics — only meaningful once the run completes */}
      {stats && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-edge p-3">
            <div className="mb-1 text-xs text-muted">Average waiting time</div>
            <div className="font-mono text-lg text-accent">{stats.avgWait.toFixed(2)}</div>
          </div>
          <div className="rounded-lg border border-edge p-3">
            <div className="mb-1 text-xs text-muted">Average turnaround time</div>
            <div className="font-mono text-lg text-accent">{stats.avgTurn.toFixed(2)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
