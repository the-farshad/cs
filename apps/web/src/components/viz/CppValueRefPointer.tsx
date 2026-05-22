import { useMemo } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

/** A tiny model of value vs reference vs pointer semantics.
 *  We track four named "boxes" with fake addresses and step through:
 *    int a = 10;  int b = a;  int& r = a;  int* p = &a;  r = 20;  *p = 30;
 *  - b is an independent copy (its box never changes when a changes).
 *  - r is an alias for a (same box, no storage of its own).
 *  - p stores a's address; *p writes through to a's box.                       */

type Kind = 'value' | 'reference' | 'pointer';

type Box = {
  name: string;
  kind: Kind;
  addr: string; // fake address for value/copy slots; references reuse a's addr
  exists: boolean; // declared yet?
  value: number | null; // for value boxes
  aliasOf?: 'a'; // reference: which box it names
  pointsTo?: string | null; // pointer: address it stores (or null)
};

type Frame = {
  line: string; // the C++ statement just executed
  boxes: Box[];
  changed: string[]; // box names whose stored value changed this step
  touchedAddr?: string; // an address being read/written this step
  note: string;
};

const ADDR_A = '0x7ffe10';
const ADDR_B = '0x7ffe14';
const ADDR_P = '0x7ffe18';

function buildFrames(): Frame[] {
  // Base layout — all boxes start undeclared.
  const base = (): Box[] => [
    { name: 'a', kind: 'value', addr: ADDR_A, exists: false, value: null },
    { name: 'b', kind: 'value', addr: ADDR_B, exists: false, value: null },
    { name: 'r', kind: 'reference', addr: ADDR_A, exists: false, value: null, aliasOf: 'a' },
    { name: 'p', kind: 'pointer', addr: ADDR_P, exists: false, value: null, pointsTo: null },
  ];

  const frames: Frame[] = [];
  let boxes = base();
  const set = (name: string, patch: Partial<Box>) => {
    boxes = boxes.map((b) => (b.name === name ? { ...b, ...patch } : b));
  };
  const snap = (f: Omit<Frame, 'boxes'>) =>
    frames.push({ ...f, boxes: boxes.map((b) => ({ ...b })) });

  snap({
    line: '// before any declarations',
    changed: [],
    note: 'Four named slots in this stack frame, each at its own address. Nothing is alive yet.',
  });

  // int a = 10;
  set('a', { exists: true, value: 10 });
  snap({
    line: 'int a = 10;',
    changed: ['a'],
    touchedAddr: ADDR_A,
    note: `a is created at ${ADDR_A} holding the value 10.`,
  });

  // int b = a;  (copy)
  set('b', { exists: true, value: 10 });
  snap({
    line: 'int b = a;',
    changed: ['b'],
    touchedAddr: ADDR_B,
    note: `b gets its OWN box at ${ADDR_B}. The 10 is copied in — b is independent from a.`,
  });

  // int& r = a;  (alias, no storage)
  set('r', { exists: true });
  snap({
    line: 'int& r = a;',
    changed: ['r'],
    touchedAddr: ADDR_A,
    note: `r is a reference: just another name for a's box. It has no storage of its own (it shares ${ADDR_A}).`,
  });

  // int* p = &a;  (stores address)
  set('p', { exists: true, value: null, pointsTo: ADDR_A });
  snap({
    line: 'int* p = &a;',
    changed: ['p'],
    touchedAddr: ADDR_P,
    note: `p is a pointer at ${ADDR_P}; it stores the address of a (${ADDR_A}). It is a separate box that holds an address.`,
  });

  // r = 20;  -> writes through alias to a's box
  set('a', { value: 20 });
  snap({
    line: 'r = 20;',
    changed: ['a'],
    touchedAddr: ADDR_A,
    note: `Writing through the alias r changes a's box to 20. b (the copy) is untouched.`,
  });

  // *p = 30;  -> dereference, write to the box at p's stored address (a)
  set('a', { value: 30 });
  snap({
    line: '*p = 30;',
    changed: ['a'],
    touchedAddr: ADDR_A,
    note: `*p follows p's stored address to a's box and writes 30. Again only a changes; b stays 10.`,
  });

  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const KIND_LABEL: Record<Kind, string> = {
  value: 'value',
  reference: 'reference (alias)',
  pointer: 'pointer',
};

export default function CppValueRefPointer() {
  const frames = useMemo(() => buildFrames(), []);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(
    frames.length,
    2,
  );
  const frame = frames[Math.min(index, frames.length - 1)];

  const aValue = frame.boxes.find((b) => b.name === 'a')?.value ?? null;

  const boxBorder = (b: Box): string => {
    if (!b.exists) return 'border-dashed border-edge/40 text-muted/40';
    if (frame.changed.includes(b.name)) return 'border-accent text-fg';
    return 'border-edge text-fg';
  };

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      {/* Source listing with the current line highlighted. */}
      <div className="mb-4 overflow-x-auto rounded-lg border border-edge bg-bg/40 p-3 font-mono text-xs leading-relaxed">
        {[
          'int a = 10;',
          'int b = a;',
          'int& r = a;',
          'int* p = &a;',
          'r = 20;',
          '*p = 30;',
        ].map((src) => {
          const active = frame.line === src;
          return (
            <div
              key={src}
              className={`rounded px-2 py-0.5 ${
                active ? 'bg-accent/15 text-accent' : 'text-muted'
              }`}
            >
              {active ? '>' : ' '} {src}
            </div>
          );
        })}
      </div>

      {/* Memory boxes. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {frame.boxes.map((b) => {
          const aliasNow = b.kind === 'reference' && b.exists;
          const pointerNow = b.kind === 'pointer';
          return (
            <div
              key={b.name}
              className={`relative flex flex-col rounded-lg border bg-bg/40 p-3 transition-colors ${boxBorder(b)}`}
            >
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-sm font-semibold">{b.name}</span>
                <span className="text-[10px] uppercase tracking-wide text-muted">
                  {KIND_LABEL[b.kind]}
                </span>
              </div>

              {/* The stored contents of this box. */}
              <div className="mt-2 flex h-12 items-center justify-center rounded border border-edge/60 bg-surface font-mono text-lg">
                {!b.exists ? (
                  <span className="text-muted/40">—</span>
                ) : aliasNow ? (
                  <span className="text-center text-xs leading-tight text-violet-300">
                    alias of a
                    <br />
                    <span className="text-base text-fg">{aValue ?? '—'}</span>
                  </span>
                ) : pointerNow ? (
                  <span className="text-sky-300">{b.pointsTo ?? 'nullptr'}</span>
                ) : (
                  <span>{b.value ?? '—'}</span>
                )}
              </div>

              {/* Address line. References borrow a's address; they have no box of their own. */}
              <div className="mt-2 font-mono text-[10px] text-muted">
                {aliasNow ? (
                  <span>@ {ADDR_A} (a)</span>
                ) : (
                  <span>@ {b.addr}</span>
                )}
              </div>

              {/* Highlight ring when this box's address is being read/written. */}
              {b.exists && frame.touchedAddr === (aliasNow ? ADDR_A : b.addr) && (
                <span className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-accent/60" />
              )}
            </div>
          );
        })}
      </div>

      {/* Relationship arrows, described in words below the boxes. */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted">
        <span className="flex items-center gap-1">
          <Icon name="arrow-right" size={12} className="text-violet-300" />
          <span className="text-violet-300">r</span> &rarr; a (same box)
        </span>
        <span className="flex items-center gap-1">
          <Icon name="arrow-right" size={12} className="text-sky-300" />
          <span className="text-sky-300">p</span> stores {ADDR_A} &rarr; *p reaches a
        </span>
        <span className="flex items-center gap-1">
          <span className="text-fg">b</span> is a copy (independent)
        </span>
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

      <div className="mt-4 border-t border-edge pt-4 text-xs text-muted">{frame.note}</div>
    </div>
  );
}
