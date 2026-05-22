import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

/** Contrasts a deep COPY with a MOVE for a buffer-owning type:
 *
 *  Buffer src(4);                 // owns a heap array on the heap
 *  Buffer dst = src;              // COPY: allocate a new array, duplicate data
 *  Buffer dst = std::move(src);   // MOVE: steal the pointer, null out src
 *
 *  Toggle the mode and step through. A copy duplicates the heap buffer (slow,
 *  O(n)); a move just hands over the pointer and leaves src empty (cheap, O(1)). */

type Mode = 'copy' | 'move';

type Owner = { name: string; ptr: string | null };

type Block = {
  id: number;
  addr: string;
  data: number[];
  owner: string | null; // which variable currently owns it
};

type Frame = {
  code: number;
  src: Owner;
  dst: Owner;
  blocks: Block[];
  flowFrom?: string; // address being copied/moved from
  flowTo?: string;
  cost: string;
  note: string;
};

const ADDR_SRC = '0x2a00';
const ADDR_DST = '0x2b80';
const DATA = [3, 1, 4, 1];

function copyCode(): string[] {
  return [
    'Buffer src(4);          // owns a heap array',
    'Buffer dst = src;       // COPY constructor',
    '// allocate a new array, then duplicate every element',
  ];
}
function moveCode(): string[] {
  return [
    'Buffer src(4);                  // owns a heap array',
    'Buffer dst = std::move(src);    // MOVE constructor',
    '// steal the pointer, leave src empty (nullptr)',
  ];
}

function buildFrames(mode: Mode): Frame[] {
  const frames: Frame[] = [];
  let src: Owner = { name: 'src', ptr: null };
  let dst: Owner = { name: 'dst', ptr: null };
  let blocks: Block[] = [];
  const snap = (f: Omit<Frame, 'src' | 'dst' | 'blocks'>) =>
    frames.push({
      ...f,
      src: { ...src },
      dst: { ...dst },
      blocks: blocks.map((b) => ({ ...b, data: [...b.data] })),
    });

  // src(4)
  src = { name: 'src', ptr: ADDR_SRC };
  blocks = [{ id: 1, addr: ADDR_SRC, data: [...DATA], owner: 'src' }];
  snap({
    code: 0,
    cost: '1 allocation',
    note: 'src constructs a heap array and stores its address. src is the owner of that buffer.',
  });

  if (mode === 'copy') {
    // allocate new block for dst
    blocks = [...blocks, { id: 2, addr: ADDR_DST, data: [], owner: 'dst' }];
    dst = { name: 'dst', ptr: ADDR_DST };
    snap({
      code: 1,
      flowTo: ADDR_DST,
      cost: '2nd allocation',
      note: 'The copy constructor first allocates a brand-new heap array for dst at a different address.',
    });
    // duplicate elements
    blocks = blocks.map((b) => (b.id === 2 ? { ...b, data: [...DATA] } : b));
    snap({
      code: 2,
      flowFrom: ADDR_SRC,
      flowTo: ADDR_DST,
      cost: 'O(n) copy',
      note: 'Every element is duplicated from src’s buffer into dst’s buffer. Both now own independent copies — but copying n elements is O(n) work.',
    });
    snap({
      code: 1,
      cost: 'O(n) total',
      note: 'Result: two separate buffers with identical data. Correct, but you paid for an allocation and a full element-by-element copy.',
    });
  } else {
    // move: dst takes src's pointer
    dst = { name: 'dst', ptr: ADDR_SRC };
    blocks = blocks.map((b) => (b.id === 1 ? { ...b, owner: 'dst' } : b));
    snap({
      code: 1,
      flowFrom: ADDR_SRC,
      flowTo: ADDR_DST,
      cost: 'pointer swap',
      note: 'The move constructor copies only the pointer: dst now holds src’s address. No new array is allocated and no elements are copied.',
    });
    // null out src
    src = { name: 'src', ptr: null };
    snap({
      code: 2,
      cost: 'O(1)',
      note: 'src’s pointer is set to nullptr so it no longer owns the buffer. Leaving src empty is what makes the move safe — only dst will free it.',
    });
    snap({
      code: 1,
      cost: 'O(1) total',
      note: 'Result: dst owns the original buffer; src is a valid but empty husk. The transfer was O(1) regardless of buffer size — that is why moves are cheap.',
    });
  }

  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const SKY = '#38bdf8';
const EMERALD = '#10b981';
const AMBER = '#fbbf24';

export default function CppMoveSemantics() {
  const [mode, setMode] = useState<Mode>('copy');
  const frames = useMemo(() => buildFrames(mode), [mode]);
  const code = useMemo(() => (mode === 'copy' ? copyCode() : moveCode()), [mode]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(
    frames.length,
    2,
  );
  const frame = frames[Math.min(index, frames.length - 1)];

  const ownerOf = (b: Block) => b.owner;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {(['copy', 'move'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded border px-3 py-1 text-sm transition ${
              mode === m
                ? 'border-accent bg-accent text-accent-fg'
                : 'border-edge text-fg hover:border-accent hover:text-accent'
            }`}
          >
            {m === 'copy' ? 'Deep copy (lvalue)' : 'Move (std::move / rvalue)'}
          </button>
        ))}
        <span className="ml-auto font-mono text-xs text-muted">cost: {frame.cost}</span>
      </div>

      {/* Source listing. */}
      <div className="mb-4 overflow-x-auto rounded-lg border border-edge bg-bg/40 p-3 font-mono text-xs leading-relaxed">
        {code.map((line, i) => {
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

      {/* Stack variables (pointers). */}
      <div className="grid grid-cols-2 gap-3">
        {[frame.src, frame.dst].map((o) => (
          <div key={o.name} className="rounded-lg border border-edge bg-bg/40 p-3">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-sm font-semibold text-fg">{o.name}</span>
              <span className="text-[10px] uppercase tracking-wide text-muted">stack</span>
            </div>
            <div
              className="mt-2 flex h-10 items-center justify-center rounded border font-mono text-sm"
              style={{
                borderColor: o.ptr ? SKY : 'var(--edge)',
                color: o.ptr ? SKY : 'var(--muted)',
              }}
            >
              ptr = {o.ptr ?? 'nullptr'}
            </div>
          </div>
        ))}
      </div>

      {/* Heap blocks. */}
      <div className="mt-3 rounded-lg border border-edge bg-bg/40 p-3">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-semibold text-fg">Heap</span>
          <span className="text-muted">buffers (the expensive part)</span>
        </div>
        <div className="flex flex-col gap-2">
          {frame.blocks.map((b) => {
            const isFlowTo = frame.flowTo === b.addr;
            const isFlowFrom = frame.flowFrom === b.addr;
            return (
              <div
                key={b.id}
                className="rounded border-2 p-2 transition-colors"
                style={{
                  borderColor: isFlowTo ? AMBER : isFlowFrom ? SKY : EMERALD,
                }}
              >
                <div className="mb-1 flex items-center justify-between font-mono text-[11px]">
                  <span className="text-muted">{b.addr}</span>
                  <span style={{ color: EMERALD }}>owner: {ownerOf(b) ?? '—'}</span>
                </div>
                <div className="flex gap-1">
                  {b.data.length === 0 ? (
                    <span className="font-mono text-[11px] text-muted/60">(uninitialized)</span>
                  ) : (
                    b.data.map((d, i) => (
                      <span
                        key={i}
                        className="flex h-8 w-8 items-center justify-center rounded border border-edge/60 bg-surface font-mono text-sm text-fg"
                      >
                        {d}
                      </span>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 font-mono text-[10px] text-muted">
          {mode === 'copy'
            ? 'Copy: a second buffer is allocated and filled element by element.'
            : 'Move: no new buffer — only the pointer changes hands.'}
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

      <div className="mt-4 border-t border-edge pt-4 text-xs text-muted">{frame.note}</div>
    </div>
  );
}
