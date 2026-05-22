import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

/**
 * Two concurrent transactions (T1, T2) interleave operations on a single shared
 * row, `account.balance`. Under READ COMMITTED an anomaly slips through; under
 * SERIALIZABLE the conflicting transaction is blocked until the other finishes,
 * so the anomaly disappears. We replay a fixed interleaving as discrete steps.
 */

type Iso = 'read-committed' | 'serializable';
type Anomaly = 'dirty' | 'non-repeatable' | 'phantom';

type Op = { tx: 'T1' | 'T2'; text: string };

type Frame = {
  /** index of the op highlighted this step (-1 = none yet) */
  active: number;
  /** committed value visible to other transactions */
  committed: number;
  /** value seen inside T1's snapshot (null = not read yet) */
  t1View: number | null;
  /** value seen inside T2's snapshot (null = not read yet) */
  t2View: number | null;
  /** "matching rows" count for the phantom example (visible scan result) */
  rows: number | null;
  blocked: boolean;
  bad: boolean;
  note: string;
};

const START = 100;

type Scenario = {
  label: string;
  blurb: string;
  build: (iso: Iso) => { ops: Op[]; frames: Frame[] };
};

function snap(base: Partial<Frame>, prev: Frame): Frame {
  return { ...prev, ...base };
}

/* ---- dirty read: T1 reads a value T2 wrote but has not committed ---- */
function dirty(iso: Iso) {
  const blocked = iso === 'serializable';
  const ops: Op[] = [
    { tx: 'T2', text: 'BEGIN' },
    { tx: 'T2', text: 'UPDATE balance = 100 - 30  (= 70)' },
    { tx: 'T1', text: 'BEGIN' },
    { tx: 'T1', text: 'SELECT balance' },
    { tx: 'T2', text: 'ROLLBACK' },
    { tx: 'T1', text: 'COMMIT' },
  ];
  let f: Frame = {
    active: -1, committed: START, t1View: null, t2View: null, rows: null,
    blocked: false, bad: false,
    note: `Shared balance starts at ${START}. Isolation: ${iso === 'serializable' ? 'SERIALIZABLE' : 'READ COMMITTED'}.`,
  };
  const frames: Frame[] = [f];

  f = snap({ active: 0, note: 'T2 begins a transaction.' }, f); frames.push(f);
  f = snap({ active: 1, t2View: 70, note: 'T2 writes balance = 70 in its private buffer. Not committed yet.' }, f); frames.push(f);
  f = snap({ active: 2, note: 'T1 begins, concurrently.' }, f); frames.push(f);

  if (blocked) {
    f = snap({ active: 3, blocked: true, note: 'T1 wants to read the row T2 is writing. SERIALIZABLE makes T1 wait for T2.' }, f); frames.push(f);
    f = snap({ active: 4, blocked: false, committed: START, t2View: null, note: 'T2 rolls back. Its uncommitted 70 vanishes; balance stays 100.' }, f); frames.push(f);
    f = snap({ active: 3, t1View: START, note: 'Only now does T1 read — it sees the real committed value 100. No dirty read.' }, f); frames.push(f);
    f = snap({ active: 5, note: 'T1 commits. It never saw data that was rolled back.' }, f); frames.push(f);
  } else {
    f = snap({ active: 3, t1View: 70, bad: true, note: 'DIRTY READ: T1 reads 70 — a value T2 has not committed.' }, f); frames.push(f);
    f = snap({ active: 4, committed: START, t2View: null, bad: true, note: 'T2 rolls back! The 70 never existed — yet T1 already acted on it.' }, f); frames.push(f);
    f = snap({ active: 5, note: 'T1 commits, having trusted a phantom value of 70. The read was dirty.' }, f); frames.push(f);
  }
  return { ops, frames };
}

/* ---- non-repeatable read: T1 reads twice, T2 commits a change in between ---- */
function nonRepeatable(iso: Iso) {
  const safe = iso === 'serializable';
  const ops: Op[] = [
    { tx: 'T1', text: 'BEGIN' },
    { tx: 'T1', text: 'SELECT balance  -> 100' },
    { tx: 'T2', text: 'UPDATE balance = 100 + 50; COMMIT' },
    { tx: 'T1', text: 'SELECT balance  (again)' },
    { tx: 'T1', text: 'COMMIT' },
  ];
  let f: Frame = {
    active: -1, committed: START, t1View: null, t2View: null, rows: null,
    blocked: false, bad: false,
    note: `Shared balance starts at ${START}. Isolation: ${safe ? 'SERIALIZABLE' : 'READ COMMITTED'}.`,
  };
  const frames: Frame[] = [f];

  f = snap({ active: 0, note: 'T1 begins.' }, f); frames.push(f);
  f = snap({ active: 1, t1View: START, note: 'T1 reads balance = 100 (first read).' }, f); frames.push(f);

  if (safe) {
    f = snap({ active: 2, blocked: true, note: 'T2 tries to update the row T1 is reading. SERIALIZABLE blocks T2 until T1 ends.' }, f); frames.push(f);
    f = snap({ active: 3, t1View: START, note: 'T1 reads again and still sees 100 — its snapshot is stable.' }, f); frames.push(f);
    f = snap({ active: 4, note: 'T1 commits. Now T2 may proceed. Both reads agreed.' }, f); frames.push(f);
    f = snap({ active: 2, blocked: false, committed: 150, t2View: null, note: 'T2 finally commits balance = 150, after T1 finished.' }, f); frames.push(f);
  } else {
    f = snap({ active: 2, committed: 150, bad: true, note: 'T2 updates and COMMITs balance = 150 right now.' }, f); frames.push(f);
    f = snap({ active: 3, t1View: 150, bad: true, note: 'NON-REPEATABLE READ: T1 reads again and gets 150 — the same query, two answers.' }, f); frames.push(f);
    f = snap({ active: 4, note: 'T1 commits. Within one transaction the row changed underneath it.' }, f); frames.push(f);
  }
  return { ops, frames };
}

/* ---- phantom read: a range scan sees a new matching row appear ---- */
function phantom(iso: Iso) {
  const safe = iso === 'serializable';
  const ops: Op[] = [
    { tx: 'T1', text: 'BEGIN' },
    { tx: 'T1', text: 'COUNT(*) WHERE salary > 100k  -> 4' },
    { tx: 'T2', text: 'INSERT new row salary=130k; COMMIT' },
    { tx: 'T1', text: 'COUNT(*) WHERE salary > 100k  (again)' },
    { tx: 'T1', text: 'COMMIT' },
  ];
  let f: Frame = {
    active: -1, committed: START, t1View: null, t2View: null, rows: 4,
    blocked: false, bad: false,
    note: `4 rows currently match salary > 100k. Isolation: ${safe ? 'SERIALIZABLE' : 'READ COMMITTED'}.`,
  };
  const frames: Frame[] = [f];

  f = snap({ active: 0, note: 'T1 begins.' }, f); frames.push(f);
  f = snap({ active: 1, rows: 4, note: 'T1 scans the range and counts 4 matching rows.' }, f); frames.push(f);

  if (safe) {
    f = snap({ active: 2, blocked: true, note: 'T2 tries to INSERT into the range T1 scanned. SERIALIZABLE blocks it (range lock).' }, f); frames.push(f);
    f = snap({ active: 3, rows: 4, note: 'T1 scans again: still 4 rows. No phantom appeared.' }, f); frames.push(f);
    f = snap({ active: 4, note: 'T1 commits. T2 may now insert the new row safely.' }, f); frames.push(f);
    f = snap({ active: 2, blocked: false, rows: 5, note: 'T2 commits the insert after T1 finished — order is now serializable.' }, f); frames.push(f);
  } else {
    f = snap({ active: 2, rows: 5, bad: true, note: 'T2 INSERTs a 5th matching row and COMMITs.' }, f); frames.push(f);
    f = snap({ active: 3, rows: 5, bad: true, note: 'PHANTOM READ: T1 re-runs the same scan and now counts 5. A row "appeared".' }, f); frames.push(f);
    f = snap({ active: 4, note: 'T1 commits. The set of matching rows changed mid-transaction.' }, f); frames.push(f);
  }
  return { ops, frames };
}

const SCENARIOS: Record<Anomaly, Scenario> = {
  dirty: { label: 'Dirty read', blurb: 'Reading another transaction’s uncommitted write.', build: dirty },
  'non-repeatable': { label: 'Non-repeatable read', blurb: 'Same row read twice, different values.', build: nonRepeatable },
  phantom: { label: 'Phantom read', blurb: 'Same range scan, a new matching row appears.', build: phantom },
};

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const AMBER = '#fbbf24';
const ROSE = '#f43f5e';
const EMERALD = '#10b981';
const SKY = '#38bdf8';

export default function TransactionIsolationVisualizer() {
  const [anomaly, setAnomaly] = useState<Anomaly>('dirty');
  const [iso, setIso] = useState<Iso>('read-committed');

  const { ops, frames } = useMemo(() => SCENARIOS[anomaly].build(iso), [anomaly, iso]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 2);
  const frame = frames[Math.min(index, frames.length - 1)] ?? frames[0];

  const isPhantom = anomaly === 'phantom';
  const sharedLabel = isPhantom ? 'rows matching salary > 100k' : 'account.balance (committed)';
  const sharedValue = isPhantom ? frame.rows : frame.committed;

  // Returns a className for an op row; the active-bad/blocked rows additionally
  // get an inline style for the status color (kept out of Tailwind's palette).
  const opColor = (i: number) => {
    if (i !== frame.active) return 'border-edge text-muted';
    if (frame.blocked || frame.bad) return 'text-fg';
    return 'border-accent text-accent';
  };

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-2 text-sm text-muted">
          Anomaly
          <select
            value={anomaly}
            onChange={(e) => setAnomaly(e.target.value as Anomaly)}
            className="rounded border border-edge bg-bg px-2 py-1 text-fg"
          >
            {(Object.keys(SCENARIOS) as Anomaly[]).map((k) => (
              <option key={k} value={k}>{SCENARIOS[k].label}</option>
            ))}
          </select>
        </label>

        <div className="flex overflow-hidden rounded border border-edge text-xs">
          {(['read-committed', 'serializable'] as Iso[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setIso(k)}
              className={`px-3 py-1 transition ${iso === k ? 'bg-accent text-accent-fg' : 'text-muted hover:text-accent'}`}
            >
              {k === 'serializable' ? 'SERIALIZABLE' : 'READ COMMITTED'}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-3 text-xs text-muted">{SCENARIOS[anomaly].blurb}</p>

      {/* shared row */}
      <div className="mb-4 flex items-center justify-center gap-3 rounded-lg border border-edge bg-bg/40 px-4 py-3">
        <Icon name="database" size={18} className="text-muted" />
        <span className="font-mono text-xs text-muted">{sharedLabel}</span>
        <span
          className="rounded px-2 py-0.5 font-mono text-sm"
          style={{
            color: frame.bad ? ROSE : 'var(--fg)',
            border: `1px solid ${frame.bad ? ROSE : 'var(--border)'}`,
          }}
        >
          {sharedValue ?? '—'}
        </span>
      </div>

      {/* two timelines */}
      <div className="grid grid-cols-2 gap-3">
        {(['T1', 'T2'] as const).map((tx) => {
          const view = tx === 'T1' ? frame.t1View : frame.t2View;
          return (
            <div key={tx} className="rounded-lg border border-edge p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-sm font-medium text-fg" style={{ color: tx === 'T1' ? SKY : AMBER }}>
                  {tx}
                </span>
                {!isPhantom && (
                  <span className="font-mono text-xs text-muted">
                    sees: <span className="text-fg">{view ?? '—'}</span>
                  </span>
                )}
              </div>
              <ol className="space-y-1.5">
                {ops.map((op, i) =>
                  op.tx === tx ? (
                    <li
                      key={i}
                      className={`rounded border px-2 py-1 font-mono text-xs transition ${opColor(i)}`}
                      style={
                        i === frame.active && frame.blocked && op.tx === tx
                          ? { borderColor: AMBER, color: AMBER }
                          : i === frame.active && frame.bad
                            ? { borderColor: ROSE }
                            : undefined
                      }
                    >
                      {op.text}
                      {i === frame.active && frame.blocked && op.tx === tx && (
                        <span className="ml-1 text-[10px]">· blocked / waiting</span>
                      )}
                    </li>
                  ) : (
                    <li key={i} className="px-2 py-1 text-xs text-muted/30">·</li>
                  ),
                )}
              </ol>
            </div>
          );
        })}
      </div>

      {/* status banner */}
      <div
        className="mt-4 rounded-lg border px-3 py-2 text-center font-mono text-xs"
        style={
          frame.bad
            ? { borderColor: ROSE, color: ROSE, background: 'color-mix(in oklab, ' + ROSE + ' 12%, transparent)' }
            : frame.blocked
              ? { borderColor: AMBER, color: AMBER }
              : index === frames.length - 1 && iso === 'serializable'
                ? { borderColor: EMERALD, color: EMERALD }
                : { borderColor: 'var(--border)', color: 'var(--muted)' }
        }
      >
        {frame.note}
      </div>

      {/* controls */}
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
          <input type="range" min={1} max={6} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
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
        <span className="shrink-0 font-mono text-xs text-muted">{index}/{frames.length - 1}</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-edge pt-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: SKY }} /> T1</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: AMBER }} /> T2 / blocked</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: ROSE }} /> anomaly</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: EMERALD }} /> prevented</span>
      </div>
    </div>
  );
}
