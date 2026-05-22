import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// Resolve a path to an inode, then follow the inode's block pointers to data
// blocks on a disk grid. Small files use direct pointers; larger files spill
// into a single-indirect block (a block full of more pointers).

const GRID = 32; // total data blocks on this toy disk
const DIRECT = 4; // number of direct pointers in the inode
const PTRS_PER_BLOCK = 6; // pointers a single indirect block can hold

type BlockRole = 'free' | 'data' | 'indirect';

type Frame = {
  // For each disk block index: what it holds and whether it is highlighted now.
  roles: BlockRole[];
  active: number[]; // blocks lit this step
  stage: 'dir' | 'inode' | 'direct' | 'indirect-ptr' | 'indirect-data' | 'done';
  ptrCursor: number; // which pointer slot is being read (direct or indirect)
  note: string;
};

type FileDef = { name: string; inode: number; sizeBlocks: number };

const FILES: FileDef[] = [
  { name: 'notes.txt', inode: 12, sizeBlocks: 3 }, // fits in direct pointers
  { name: 'movie.mp4', inode: 27, sizeBlocks: 8 }, // needs the indirect block
];

// The directory is a name -> inode table; it lists more than just our two files
// to make the mapping concrete. README is a bystander entry, not selectable.
const DIR_ENTRIES = [
  ...FILES.map((f) => ({ name: f.name, inode: f.inode })),
  { name: 'README', inode: 8 },
];

// Deterministically lay out a file's data blocks (scattered, to show that files
// need not be contiguous — that scattering is fragmentation).
function layout(sizeBlocks: number): { directBlocks: number[]; indirectBlock: number | null; indirectData: number[] } {
  // A scattered-but-fixed set of block numbers.
  const pool = [5, 18, 9, 27, 2, 14, 21, 30, 7, 24, 11, 16, 1, 29];
  const directBlocks = pool.slice(0, Math.min(sizeBlocks, DIRECT));
  if (sizeBlocks <= DIRECT) return { directBlocks, indirectBlock: null, indirectData: [] };
  const indirectBlock = pool[DIRECT]; // one block becomes the pointer block
  const remaining = sizeBlocks - DIRECT;
  const indirectData = pool.slice(DIRECT + 1, DIRECT + 1 + Math.min(remaining, PTRS_PER_BLOCK));
  return { directBlocks, indirectBlock, indirectData };
}

function simulate(file: FileDef): Frame[] {
  const { directBlocks, indirectBlock, indirectData } = layout(file.sizeBlocks);
  const roles: BlockRole[] = Array(GRID).fill('free');
  directBlocks.forEach((b) => (roles[b] = 'data'));
  indirectData.forEach((b) => (roles[b] = 'data'));
  if (indirectBlock != null) roles[indirectBlock] = 'indirect';

  const frames: Frame[] = [];
  const snap = (f: Omit<Frame, 'roles'>) => frames.push({ roles: [...roles], ...f });

  snap({
    active: [],
    stage: 'dir',
    ptrCursor: -1,
    note: `Open "${file.name}". The directory is just a table mapping names to inode numbers.`,
  });
  snap({
    active: [],
    stage: 'dir',
    ptrCursor: -1,
    note: `Directory lookup: "${file.name}" → inode ${file.inode}.`,
  });
  snap({
    active: [],
    stage: 'inode',
    ptrCursor: -1,
    note: `Read inode ${file.inode}: it holds metadata (size, owner, permissions, timestamps) plus block pointers — but no file name.`,
  });

  // Direct pointers.
  directBlocks.forEach((b, i) => {
    snap({
      active: [b],
      stage: 'direct',
      ptrCursor: i,
      note: `Direct pointer ${i} → data block ${b}. Blocks are scattered, not contiguous (that scattering is fragmentation).`,
    });
  });

  if (indirectBlock != null) {
    snap({
      active: [indirectBlock],
      stage: 'indirect-ptr',
      ptrCursor: DIRECT,
      note: `Direct pointers are exhausted. The indirect pointer → block ${indirectBlock}, which is itself a block full of pointers.`,
    });
    indirectData.forEach((b, i) => {
      snap({
        active: [indirectBlock, b],
        stage: 'indirect-data',
        ptrCursor: i,
        note: `Indirect entry ${i} → data block ${b}. One indirect block adds room for ${PTRS_PER_BLOCK} more blocks, so big files still resolve from one inode.`,
      });
    });
  }

  const allData = [...directBlocks, ...indirectData];
  snap({
    active: allData,
    stage: 'done',
    ptrCursor: -1,
    note: `Resolved. "${file.name}" occupies ${allData.length} data block(s)${indirectBlock != null ? ` plus 1 indirect block` : ''}. Reading the file streams these blocks in order.`,
  });

  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const COL_DATA = '#38bdf8';
const COL_INDIRECT = '#8b5cf6';
const COL_ACTIVE = '#fbbf24';

// Inline glyphs (no file/folder icons in the shared set).
function FileGlyph() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}
function FolderGlyph() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2z" />
    </svg>
  );
}

export default function FileSystemVisualizer() {
  const [fileIdx, setFileIdx] = useState(0);
  const file = FILES[fileIdx];
  const { directBlocks, indirectBlock, indirectData } = useMemo(() => layout(file.sizeBlocks), [file]);
  const frames = useMemo(() => simulate(file), [file]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 2);
  const frame = frames[Math.min(index, frames.length - 1)] ?? frames[0];

  const stageReached = (s: Frame['stage']): boolean => {
    const order: Frame['stage'][] = ['dir', 'inode', 'direct', 'indirect-ptr', 'indirect-data', 'done'];
    return order.indexOf(frame.stage) >= order.indexOf(s);
  };

  const directSlots = Array.from({ length: DIRECT }, (_, i) => directBlocks[i] ?? null);

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded border border-edge">
          {FILES.map((f, i) => (
            <button
              key={f.name}
              type="button"
              onClick={() => setFileIdx(i)}
              aria-pressed={fileIdx === i}
              className={`px-3 py-1 text-sm transition ${fileIdx === i ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}
            >
              {f.name}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted">
          {file.sizeBlocks} block file {file.sizeBlocks > DIRECT ? '(needs an indirect block)' : '(fits in direct pointers)'}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Resolution chain: directory -> inode -> pointers */}
        <div className="space-y-3">
          {/* Directory */}
          <div
            className="rounded-lg border bg-bg p-3 transition"
            style={{ borderColor: stageReached('dir') ? COL_DATA : 'var(--edge)' }}
          >
            <div className="mb-2 flex items-center gap-1.5 font-mono text-xs text-muted">
              <FolderGlyph /> directory (name → inode)
            </div>
            {DIR_ENTRIES.map((f) => {
                const isTarget = f.name === file.name && frame.stage === 'dir' && index >= 1;
                return (
                  <div
                    key={f.name}
                    className="flex items-center justify-between rounded border px-2 py-1 font-mono text-xs transition"
                    style={{
                      borderColor: isTarget ? COL_ACTIVE : 'var(--edge)',
                      color: isTarget ? COL_ACTIVE : f.name === file.name ? 'var(--fg)' : 'var(--muted)',
                    }}
                  >
                    <span className="flex items-center gap-1.5">
                      <FileGlyph /> {f.name}
                    </span>
                    <span>inode {f.inode}</span>
                  </div>
                );
              })}
          </div>

          {/* Inode */}
          <div
            className="rounded-lg border bg-bg p-3 transition"
            style={{ borderColor: stageReached('inode') ? COL_DATA : 'var(--edge)', opacity: stageReached('inode') ? 1 : 0.4 }}
          >
            <div className="mb-2 font-mono text-xs text-muted">inode {file.inode}</div>
            <div className="mb-2 grid grid-cols-2 gap-1 font-mono text-[10px] text-muted">
              <span>size: {file.sizeBlocks} blk</span>
              <span>owner: learner</span>
              <span>perms: rw-r--r--</span>
              <span>links: 1</span>
            </div>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-muted">block pointers</div>
            <div className="flex flex-wrap gap-1">
              {directSlots.map((b, i) => {
                const lit = (frame.stage === 'direct') && frame.ptrCursor === i;
                const used = b != null;
                return (
                  <span
                    key={i}
                    className="rounded border px-1.5 py-0.5 font-mono text-[10px] transition"
                    style={{
                      borderColor: lit ? COL_ACTIVE : used ? COL_DATA : 'var(--edge)',
                      color: lit ? COL_ACTIVE : used ? COL_DATA : 'var(--muted)',
                    }}
                  >
                    d{i}:{b != null ? b : '∅'}
                  </span>
                );
              })}
              <span
                className="rounded border px-1.5 py-0.5 font-mono text-[10px] transition"
                style={{
                  borderColor:
                    frame.stage === 'indirect-ptr' || frame.stage === 'indirect-data'
                      ? COL_INDIRECT
                      : indirectBlock != null
                        ? COL_INDIRECT
                        : 'var(--edge)',
                  color:
                    indirectBlock != null
                      ? COL_INDIRECT
                      : 'var(--muted)',
                  opacity: indirectBlock != null ? 1 : 0.5,
                }}
              >
                indirect:{indirectBlock != null ? indirectBlock : '∅'}
              </span>
            </div>
          </div>

          {/* Indirect block expansion (only when used) */}
          {indirectBlock != null && (
            <div
              className="rounded-lg border bg-bg p-3 transition"
              style={{
                borderColor: stageReached('indirect-ptr') ? COL_INDIRECT : 'var(--edge)',
                opacity: stageReached('indirect-ptr') ? 1 : 0.4,
              }}
            >
              <div className="mb-2 font-mono text-xs" style={{ color: COL_INDIRECT }}>
                indirect block {indirectBlock} = pointers
              </div>
              <div className="flex flex-wrap gap-1">
                {indirectData.map((b, i) => {
                  const lit = frame.stage === 'indirect-data' && frame.ptrCursor === i;
                  return (
                    <span
                      key={i}
                      className="rounded border px-1.5 py-0.5 font-mono text-[10px] transition"
                      style={{
                        borderColor: lit ? COL_ACTIVE : COL_DATA,
                        color: lit ? COL_ACTIVE : COL_DATA,
                      }}
                    >
                      →{b}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Disk block grid */}
        <div className="rounded-lg border border-edge bg-bg p-3">
          <div className="mb-2 font-mono text-xs text-muted">disk: {GRID} data blocks</div>
          <div className="grid grid-cols-8 gap-1">
            {frame.roles.map((role, i) => {
              const active = frame.active.includes(i);
              let border = 'var(--edge)';
              let color = 'var(--muted)';
              let bg = 'transparent';
              if (role === 'data') {
                border = COL_DATA;
                color = COL_DATA;
                bg = 'color-mix(in oklab, ' + COL_DATA + ' 12%, var(--bg))';
              } else if (role === 'indirect') {
                border = COL_INDIRECT;
                color = COL_INDIRECT;
                bg = 'color-mix(in oklab, ' + COL_INDIRECT + ' 14%, var(--bg))';
              }
              if (active) {
                border = COL_ACTIVE;
                bg = 'color-mix(in oklab, ' + COL_ACTIVE + ' 22%, var(--bg))';
              }
              return (
                <div
                  key={i}
                  className="flex aspect-square items-center justify-center rounded border font-mono text-[10px] transition"
                  style={{ borderColor: border, color: active ? COL_ACTIVE : color, background: bg }}
                  title={role === 'free' ? `block ${i}: free` : `block ${i}: ${role}`}
                >
                  {i}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 font-mono text-[10px]">
            <span className="flex items-center gap-1.5" style={{ color: COL_DATA }}>
              <span className="inline-block h-3 w-3 rounded-sm border" style={{ borderColor: COL_DATA }} /> data
            </span>
            <span className="flex items-center gap-1.5" style={{ color: COL_INDIRECT }}>
              <span className="inline-block h-3 w-3 rounded-sm border" style={{ borderColor: COL_INDIRECT }} /> indirect
            </span>
            <span className="flex items-center gap-1.5 text-muted">
              <span className="inline-block h-3 w-3 rounded-sm border border-edge" /> free
            </span>
          </div>
        </div>
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
          <input type="range" min={1} max={8} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
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
    </div>
  );
}
