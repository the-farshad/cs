import { useMemo } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

/** Animates a small program to contrast the stack and the heap.
 *
 *  void leak()   { int* x = new int(7); }          // never deleted -> leak
 *  int* make()   { return new int(42); }           // ownership escapes
 *  void use()    { int* p = make(); delete p; ... } // dangling after delete
 *
 *  Stack frames push/pop as functions are entered/left; new draws a heap block,
 *  delete frees it. We then show a dangling pointer (reads freed memory) and a
 *  leaked block (no pointer left, never freed).                                */

type Local = { name: string; value: string; danger?: 'dangling' };
type StackFrame = { fn: string; locals: Local[] };
type HeapBlock = {
  id: number;
  addr: string;
  value: string;
  state: 'live' | 'freed' | 'leaked';
};

type Frame = {
  code: number; // index into CODE for highlighting
  stack: StackFrame[];
  heap: HeapBlock[];
  activeHeap?: number; // block id touched this step
  marker?: 'alloc' | 'free' | 'leak' | 'dangling';
  note: string;
};

const CODE = [
  'int* make() {',
  '  return new int(42);   // heap alloc, ownership escapes',
  '}',
  'void demo() {',
  '  int* p = make();      // p owns the block',
  '  delete p;             // block freed',
  '  int v = *p;           // DANGLING: reads freed memory',
  '  new int(7);           // LEAK: no pointer keeps it',
  '}',
];

const A1 = '0x1a00'; // make()'s allocation (the "42" block)
const A2 = '0x1b40'; // the leaked "7" block

function buildFrames(): Frame[] {
  const frames: Frame[] = [];
  let stack: StackFrame[] = [];
  let heap: HeapBlock[] = [];
  const snap = (f: Omit<Frame, 'stack' | 'heap'>) =>
    frames.push({
      ...f,
      stack: stack.map((s) => ({ fn: s.fn, locals: s.locals.map((l) => ({ ...l })) })),
      heap: heap.map((h) => ({ ...h })),
    });

  // Enter demo()
  stack = [{ fn: 'demo()', locals: [] }];
  snap({ code: 3, note: 'demo() is called: a stack frame is pushed for its locals.' });

  // Call make() -> new frame
  stack = [...stack, { fn: 'make()', locals: [] }];
  snap({ code: 0, note: 'demo() calls make(): make()’s frame is pushed on top of the stack.' });

  // new int(42) inside make()
  heap = [{ id: 1, addr: A1, value: '42', state: 'live' }];
  snap({
    code: 1,
    activeHeap: 1,
    marker: 'alloc',
    note: `new int(42) allocates a block on the HEAP at ${A1}. The heap outlives the function that created it.`,
  });

  // make() returns -> pop frame, value flows to caller
  stack = [{ fn: 'demo()', locals: [{ name: 'p', value: A1 }] }];
  snap({
    code: 4,
    activeHeap: 1,
    note: `make() returns the address and its frame is popped. p (in demo) now owns the heap block at ${A1}.`,
  });

  // delete p
  heap = heap.map((h) => (h.id === 1 ? { ...h, state: 'freed', value: 'freed' } : h));
  stack = [{ fn: 'demo()', locals: [{ name: 'p', value: A1, danger: 'dangling' }] }];
  snap({
    code: 5,
    activeHeap: 1,
    marker: 'free',
    note: `delete p frees the heap block. But p still holds ${A1} — it is now a DANGLING pointer to freed memory.`,
  });

  // int v = *p;  -> dangling read
  stack = [
    {
      fn: 'demo()',
      locals: [
        { name: 'p', value: A1, danger: 'dangling' },
        { name: 'v', value: '???' },
      ],
    },
  ];
  snap({
    code: 6,
    activeHeap: 1,
    marker: 'dangling',
    note: 'Dereferencing the dangling p reads freed memory — undefined behavior. The value is garbage (shown ???).',
  });

  // new int(7) with no pointer kept -> leak
  heap = [...heap, { id: 2, addr: A2, value: '7', state: 'leaked' }];
  snap({
    code: 7,
    activeHeap: 2,
    marker: 'leak',
    note: `new int(7) allocates at ${A2} but no pointer is stored. Nothing can ever delete it — this is a memory LEAK.`,
  });

  // demo() returns -> stack pops; heap block stays leaked
  stack = [];
  snap({
    code: 8,
    activeHeap: 2,
    marker: 'leak',
    note: 'demo() returns: its stack frame is popped automatically. The leaked heap block at ' +
      A2 +
      ' lingers until the process exits.',
  });

  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

function heapColor(state: HeapBlock['state']): string {
  if (state === 'freed') return 'border-edge/40 text-muted/50 line-through';
  if (state === 'leaked') return 'border-[#f43f5e] text-[#f43f5e]';
  return 'border-[#10b981] text-[#10b981]';
}

export default function CppStackHeap() {
  const frames = useMemo(() => buildFrames(), []);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(
    frames.length,
    2,
  );
  const frame = frames[Math.min(index, frames.length - 1)];

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      {/* Program source with the current line highlighted. */}
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

      <div className="grid gap-3 sm:grid-cols-2">
        {/* STACK — grows downward; top of stack is the most recent frame. */}
        <div className="rounded-lg border border-edge bg-bg/40 p-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-fg">Stack</span>
            <span className="text-muted">LIFO frames, auto-managed</span>
          </div>
          <div className="flex min-h-40 flex-col gap-2">
            {frame.stack.length === 0 && (
              <span className="m-auto text-xs text-muted/50">empty (all frames popped)</span>
            )}
            {/* Render top-of-stack first so the newest frame appears on top. */}
            {[...frame.stack].reverse().map((sf, i) => (
              <div
                key={`${sf.fn}-${i}`}
                className={`rounded border px-3 py-2 ${
                  i === 0 ? 'border-accent bg-accent/5' : 'border-edge'
                }`}
              >
                <div className="font-mono text-xs font-semibold text-fg">{sf.fn}</div>
                <div className="mt-1 space-y-0.5">
                  {sf.locals.length === 0 && (
                    <div className="font-mono text-[11px] text-muted/60">(no locals yet)</div>
                  )}
                  {sf.locals.map((l) => (
                    <div
                      key={l.name}
                      className={`font-mono text-[11px] ${
                        l.danger === 'dangling' ? 'text-[#f43f5e]' : 'text-muted'
                      }`}
                    >
                      {l.name} = {l.value}
                      {l.danger === 'dangling' && ' (dangling)'}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* HEAP — blocks live until explicitly freed. */}
        <div className="rounded-lg border border-edge bg-bg/40 p-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-fg">Heap</span>
            <span className="text-muted">manual: new / delete</span>
          </div>
          <div className="flex min-h-40 flex-col gap-2">
            {frame.heap.length === 0 && (
              <span className="m-auto text-xs text-muted/50">no allocations</span>
            )}
            {frame.heap.map((h) => (
              <div
                key={h.id}
                className={`flex items-center justify-between rounded border px-3 py-2 font-mono text-xs transition-colors ${heapColor(
                  h.state,
                )} ${frame.activeHeap === h.id ? 'ring-2 ring-accent/50' : ''}`}
              >
                <span>{h.addr}</span>
                <span className="text-sm">{h.value}</span>
                <span className="text-[10px] uppercase tracking-wide">{h.state}</span>
              </div>
            ))}
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
          <span className="inline-block h-3 w-3 rounded-sm border" style={{ borderColor: '#10b981' }} />
          live
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border border-edge/50" />
          freed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border" style={{ borderColor: '#f43f5e' }} />
          leaked / dangling
        </span>
        <span className="ml-auto">{frame.note}</span>
      </div>
    </div>
  );
}
