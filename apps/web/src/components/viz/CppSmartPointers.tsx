import { useMemo } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

/** Tracks ownership and a shared_ptr reference count through a small program:
 *
 *  auto a = std::make_shared<Widget>();   // count = 1
 *  {
 *      auto b = a;        // copy: shared ownership, count = 2
 *      auto w = a;        // weak_ptr: observes, does NOT bump the count
 *  }                      // b destroyed at scope end -> count = 1
 *  a.reset();             // last owner released -> count = 0 -> object freed
 *
 *  Owners (shared_ptr) raise the count; a weak_ptr only observes. When the
 *  count hits zero the managed object is automatically deleted (RAII).          */

type Owner = { name: string; kind: 'shared' | 'weak'; alive: boolean; pointsToObj: boolean };

type Frame = {
  code: number;
  count: number; // strong reference count
  objectAlive: boolean;
  owners: Owner[];
  highlight?: string; // owner whose state changed this step
  note: string;
};

const CODE = [
  'auto a = std::make_shared<Widget>();  // count = 1',
  '{',
  '  auto b = a;        // copy -> shared',
  '  std::weak_ptr<Widget> w = a;  // observes only',
  '}                    // b destroyed here',
  'a.reset();           // release last owner',
];

function buildFrames(): Frame[] {
  const frames: Frame[] = [];
  let owners: Owner[] = [
    { name: 'a', kind: 'shared', alive: false, pointsToObj: false },
    { name: 'b', kind: 'shared', alive: false, pointsToObj: false },
    { name: 'w', kind: 'weak', alive: false, pointsToObj: false },
  ];
  let count = 0;
  let objectAlive = false;
  const set = (name: string, patch: Partial<Owner>) => {
    owners = owners.map((o) => (o.name === name ? { ...o, ...patch } : o));
  };
  const snap = (code: number, highlight: string | undefined, note: string) =>
    frames.push({ code, count, objectAlive, owners: owners.map((o) => ({ ...o })), highlight, note });

  // make_shared
  objectAlive = true;
  count = 1;
  set('a', { alive: true, pointsToObj: true });
  snap(0, 'a', 'make_shared allocates the Widget and a control block. a is the sole owner, so the strong count is 1.');

  // enter scope
  snap(1, undefined, 'Entering an inner scope. Any owners created here will be destroyed when it ends.');

  // copy to b
  count = 2;
  set('b', { alive: true, pointsToObj: true });
  snap(2, 'b', 'Copying a shared_ptr shares ownership: b points at the same object and the count rises to 2. The object is kept alive.');

  // weak_ptr w
  set('w', { alive: true, pointsToObj: true });
  snap(3, 'w', 'A weak_ptr observes the object but does NOT own it. The strong count stays at 2 — a weak_ptr never keeps the object alive.');

  // scope ends: b dies (weak w also goes out of scope here)
  count = 1;
  set('b', { alive: false, pointsToObj: false });
  set('w', { alive: false, pointsToObj: false });
  snap(4, 'b', 'The scope ends. b is destroyed, dropping the count back to 1. The weak w expires too, but it never held a strong reference. Object still alive.');

  // a.reset()
  count = 0;
  set('a', { alive: true, pointsToObj: false });
  objectAlive = false;
  snap(5, 'a', 'a.reset() releases the last owner. The strong count hits 0, so the Widget’s destructor runs and its memory is freed automatically — no delete needed.');

  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const SKY = '#38bdf8';
const VIOLET = '#8b5cf6';
const EMERALD = '#10b981';

export default function CppSmartPointers() {
  const frames = useMemo(() => buildFrames(), []);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(
    frames.length,
    2,
  );
  const frame = frames[Math.min(index, frames.length - 1)];

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      {/* Source listing. */}
      <div className="mb-4 overflow-x-auto rounded-lg border border-edge bg-bg/40 p-3 font-mono text-xs leading-relaxed">
        {CODE.map((line, i) => {
          const active = frame.code === i;
          return (
            <div
              key={i}
              className={`whitespace-pre rounded px-2 py-0.5 ${
                active ? 'bg-accent/15 text-accent' : 'text-muted'
              }`}
            >
              {active ? '>' : ' '} {line}
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        {/* Owners. */}
        <div className="rounded-lg border border-edge bg-bg/40 p-3">
          <div className="mb-2 text-xs font-semibold text-fg">Pointers in scope</div>
          <div className="flex flex-col gap-2">
            {frame.owners.map((o) => {
              const hot = frame.highlight === o.name;
              const c = o.kind === 'weak' ? VIOLET : SKY;
              return (
                <div
                  key={o.name}
                  className={`flex items-center gap-2 rounded border px-3 py-2 transition-colors ${
                    !o.alive ? 'border-dashed border-edge/40' : ''
                  } ${hot ? 'ring-2 ring-accent/50' : ''}`}
                  style={{ borderColor: o.alive && !hot ? c : undefined }}
                >
                  <span className="font-mono text-sm font-semibold" style={{ color: o.alive ? c : 'var(--muted)' }}>
                    {o.name}
                  </span>
                  <span className="rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-wide" style={{ borderColor: c, color: c }}>
                    {o.kind === 'weak' ? 'weak_ptr' : 'shared_ptr'}
                  </span>
                  <span className="ml-auto font-mono text-[11px] text-muted">
                    {!o.alive ? 'out of scope' : o.pointsToObj ? '→ Widget' : '→ (empty)'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* The managed object + count. */}
        <div className="flex min-w-44 flex-col items-center justify-center rounded-lg border border-edge bg-bg/40 p-3">
          <div className="text-xs text-muted">strong count</div>
          <div
            className="my-1 font-mono text-4xl font-bold transition-colors"
            style={{ color: frame.count === 0 ? '#f43f5e' : EMERALD }}
          >
            {frame.count}
          </div>
          <div
            className="mt-1 flex h-14 w-full items-center justify-center rounded border-2 font-mono text-xs transition-colors"
            style={{
              borderColor: frame.objectAlive ? EMERALD : 'var(--edge)',
              color: frame.objectAlive ? EMERALD : 'var(--muted)',
            }}
          >
            {frame.objectAlive ? 'Widget (alive)' : 'freed'}
          </div>
        </div>
      </div>

      {/* Controls. */}
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
          <input
            type="range"
            min={1}
            max={8}
            value={fps}
            onChange={(e) => setFps(Number(e.target.value))}
            className="accent-[var(--accent)]"
          />
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

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-edge pt-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border" style={{ borderColor: SKY }} />
          shared (owns)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border" style={{ borderColor: VIOLET }} />
          weak (observes)
        </span>
        <span className="ml-auto">{frame.note}</span>
      </div>
    </div>
  );
}
