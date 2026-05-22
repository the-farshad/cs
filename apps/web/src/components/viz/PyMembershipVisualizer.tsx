import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

/** Side-by-side membership test: `x in list` scans element by element (O(n))
 *  while `x in set` jumps straight to a hash bucket (O(1) average). */

const DATA = [17, 4, 42, 8, 23, 15, 9, 31, 6, 28];
const SET_SIZE = 8;

type Frame = {
  // list side
  listScan: number; // how many elements probed so far
  listHit: boolean;
  // set side
  setBucket?: number;
  setProbed: boolean;
  setHit: boolean;
  note: string;
  done: boolean;
};

function bucketsOf(values: number[]): number[][] {
  const buckets: number[][] = Array.from({ length: SET_SIZE }, () => []);
  for (const v of values) {
    const h = ((v % SET_SIZE) + SET_SIZE) % SET_SIZE;
    if (!buckets[h].includes(v)) buckets[h].push(v);
  }
  return buckets;
}

function buildFrames(target: number): Frame[] {
  const frames: Frame[] = [];
  const buckets = bucketsOf(DATA);
  const targetBucket = ((target % SET_SIZE) + SET_SIZE) % SET_SIZE;
  const inData = DATA.includes(target);

  // Intro frame
  frames.push({ listScan: 0, listHit: false, setProbed: false, setHit: false, done: false, note: `searching for ${target} in both` });

  // List scan, one element at a time
  for (let i = 0; i < DATA.length; i++) {
    const hit = DATA[i] === target;
    frames.push({
      listScan: i + 1,
      listHit: hit,
      setProbed: false,
      setHit: false,
      done: false,
      note: `list: compare index ${i} (${DATA[i]}) — ${hit ? 'match' : 'no match, keep scanning'}`,
    });
    if (hit) break;
  }

  // Set: hash, then probe the single bucket
  frames.push({
    listScan: Math.min(DATA.indexOf(target) + 1 || DATA.length, DATA.length),
    listHit: inData,
    setBucket: targetBucket,
    setProbed: false,
    setHit: false,
    done: false,
    note: `set: hash(${target}) = ${target} % ${SET_SIZE} = ${targetBucket} — go straight to that bucket`,
  });
  const found = buckets[targetBucket].includes(target);
  frames.push({
    listScan: Math.min(DATA.indexOf(target) + 1 || DATA.length, DATA.length),
    listHit: inData,
    setBucket: targetBucket,
    setProbed: true,
    setHit: found,
    done: true,
    note: `set: bucket ${targetBucket} ${found ? `contains ${target}` : `does not contain ${target}`} — O(1) average, no scan`,
  });

  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function PyMembershipVisualizer() {
  const [target, setTarget] = useState(15);
  const buckets = useMemo(() => bucketsOf(DATA), []);
  const frames = useMemo(() => buildFrames(target), [target]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 4);
  const frame = frames[Math.min(index, frames.length - 1)];

  const targetBucket = ((target % SET_SIZE) + SET_SIZE) % SET_SIZE;

  const choices = [15, 42, 7, 99];

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">test value:</span>
        {choices.map((c) => (
          <button
            key={c}
            type="button"
            className={`${btn} ${target === c ? 'border-accent text-accent' : ''}`}
            onClick={() => setTarget(c)}
          >
            {c}
          </button>
        ))}
        <span className="ml-2 font-mono text-xs text-muted">{DATA.includes(target) ? 'present' : 'absent'}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* List side */}
        <div className="rounded border border-edge p-3">
          <div className="mb-2 flex items-center justify-between font-mono text-xs">
            <span className="text-muted">{target} in list</span>
            <span className="text-amber-300">probes: {frame.listScan}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DATA.map((v, i) => {
              const probed = i < frame.listScan;
              const isHit = frame.listHit && v === target && i === frame.listScan - 1;
              const cls = isHit
                ? 'border-emerald-500 text-emerald-300'
                : probed
                ? 'border-amber-400 text-amber-300'
                : 'border-edge text-muted/50';
              return (
                <div key={i} className={`flex h-9 min-w-9 items-center justify-center rounded border px-1.5 font-mono text-sm transition ${cls}`}>
                  {v}
                </div>
              );
            })}
          </div>
          <div className="mt-2 font-mono text-[11px] text-muted">linear scan — O(n)</div>
        </div>

        {/* Set side */}
        <div className="rounded border border-edge p-3">
          <div className="mb-2 flex items-center justify-between font-mono text-xs">
            <span className="text-muted">{target} in set</span>
            <span className="text-emerald-300">probes: {frame.setProbed ? 1 : 0}</span>
          </div>
          <div className="space-y-1">
            {buckets.map((chain, b) => {
              const active = frame.setBucket === b;
              return (
                <div key={b} className={`flex items-center gap-2 rounded border px-2 py-1 ${active ? 'border-accent bg-accent/5' : 'border-edge'}`}>
                  <span className="w-5 shrink-0 text-right font-mono text-[11px] text-muted">{b}</span>
                  <div className="flex flex-wrap gap-1">
                    {chain.length === 0 && <span className="font-mono text-[11px] text-muted/40">·</span>}
                    {chain.map((v, j) => {
                      const isHit = active && frame.setProbed && v === target;
                      return (
                        <div key={j} className={`flex h-6 min-w-6 items-center justify-center rounded border px-1 font-mono text-xs ${isHit ? 'border-emerald-500 text-emerald-300' : 'border-edge text-fg'}`}>
                          {v}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 font-mono text-[11px] text-muted">hash to bucket {targetBucket} — O(1) average</div>
        </div>
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
        <input type="range" min={0} max={Math.max(frames.length - 1, 0)} value={index} onChange={(e) => seek(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Timeline" />
        <span className="shrink-0 font-mono text-xs text-muted">{index + 1}/{frames.length}</span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">{frame.note}</div>
    </div>
  );
}
