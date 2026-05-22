import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// Two short stories.
// stash: uncommitted edits in the working tree are pushed onto a side "shelf"
//   so the tree is clean, then popped back later.
// cherry-pick: a single commit from another branch is COPIED onto the current
//   branch as a new commit (new hash, same change).

type Mode = 'stash' | 'cherry';

// ---- stash model ----
type StashFrame = {
  working: string | null; // label of dirty change in working tree
  shelf: string | null; // what's on the stash stack
  flash?: 'push' | 'pop';
  note: string;
};

function stashFrames(): StashFrame[] {
  return [
    { working: 'edit: navbar.css', shelf: null, note: 'you have uncommitted edits, but need to switch tasks now' },
    { working: 'edit: navbar.css', shelf: null, flash: 'push', note: 'git stash push   ·   roll the working-tree changes onto a shelf' },
    { working: null, shelf: 'stash@{0}: navbar.css', note: 'working tree is now CLEAN — safe to checkout/pull/fix something urgent' },
    { working: null, shelf: 'stash@{0}: navbar.css', flash: 'pop', note: 'git stash pop   ·   reapply the shelved changes and drop the entry' },
    { working: 'edit: navbar.css', shelf: null, note: 'edits are back in the working tree, exactly where you left off' },
  ];
}

// ---- cherry-pick model ----
type CNode = { id: string; x: number; y: number; parents: string[]; branch: 'main' | 'feature'; copy?: boolean; highlight?: boolean };
type CherryFrame = { nodes: CNode[]; mainTip: string; featTip: string; head: 'main'; note: string };

const X = (i: number) => 40 + i * 80;
const TOP = 40;
const BOT = 100;

const cherryBase = (): CNode[] => [
  { id: 'A', x: X(0), y: TOP, parents: [], branch: 'main' },
  { id: 'B', x: X(1), y: TOP, parents: ['A'], branch: 'main' },
  { id: 'M', x: X(2), y: TOP, parents: ['B'], branch: 'main' },
  { id: 'f1', x: X(2), y: BOT, parents: ['B'], branch: 'feature' },
  { id: 'f2', x: X(3), y: BOT, parents: ['f1'], branch: 'feature' },
];

function cherryFrames(): CherryFrame[] {
  const frames: CherryFrame[] = [];
  frames.push({ nodes: cherryBase(), mainTip: 'M', featTip: 'f2', head: 'main', note: 'feature has a useful fix f1 you want on main now — but not the rest yet' });
  frames.push({
    nodes: cherryBase().map((n) => (n.id === 'f1' ? { ...n, highlight: true } : n)),
    mainTip: 'M',
    featTip: 'f2',
    head: 'main',
    note: 'git cherry-pick f1   ·   take just that one commit’s change',
  });
  const picked: CNode[] = [...cherryBase(), { id: "f1'", x: X(3), y: TOP, parents: ['M'], branch: 'main', copy: true, highlight: true }];
  frames.push({
    nodes: picked,
    mainTip: "f1'",
    featTip: 'f2',
    head: 'main',
    note: "a COPY f1′ is appended to main (new hash); feature is untouched",
  });
  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function GitStashCherryVisualizer() {
  const [mode, setMode] = useState<Mode>('stash');
  const sFrames = useMemo(() => stashFrames(), []);
  const cFrames = useMemo(() => cherryFrames(), []);
  const total = mode === 'stash' ? sFrames.length : cFrames.length;
  const { index, playing, fps, setFps, play, pause, next, prev, seek } = useStepper(total);

  const sFrame = sFrames[Math.min(index, sFrames.length - 1)] ?? sFrames[0];
  const cFrame = cFrames[Math.min(index, cFrames.length - 1)] ?? cFrames[0];
  const note = mode === 'stash' ? sFrame.note : cFrame.note;

  const cPos = new Map(cFrame.nodes.map((n) => [n.id, n]));
  const cWidth = Math.max(...cFrame.nodes.map((n) => n.x), 0) + 70;
  const cTips: Record<string, string[]> = {};
  cTips[cFrame.mainTip] = [...(cTips[cFrame.mainTip] ?? []), 'main'];
  cTips[cFrame.featTip] = [...(cTips[cFrame.featTip] ?? []), 'feature'];

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`rounded border px-3 py-1 font-mono text-xs transition ${mode === 'stash' ? 'border-accent bg-accent text-accent-fg' : 'border-edge text-fg hover:border-accent hover:text-accent'}`}
          onClick={() => { setMode('stash'); seek(0); }}
        >
          stash push / pop
        </button>
        <button
          type="button"
          className={`rounded border px-3 py-1 font-mono text-xs transition ${mode === 'cherry' ? 'border-accent bg-accent text-accent-fg' : 'border-edge text-fg hover:border-accent hover:text-accent'}`}
          onClick={() => { setMode('cherry'); seek(0); }}
        >
          cherry-pick
        </button>
      </div>

      {mode === 'stash' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-edge bg-bg/40 p-4">
            <div className="mb-2 font-mono text-[11px] uppercase text-accent">working tree</div>
            <div className="flex min-h-16 items-center justify-center">
              {sFrame.working ? (
                <div className={`rounded border px-3 py-2 font-mono text-sm transition ${sFrame.flash === 'push' ? 'border-amber-400 text-amber-400' : sFrame.flash === 'pop' ? 'border-emerald-500 text-emerald-400' : 'border-edge text-fg'}`} style={sFrame.flash === 'push' ? { borderColor: '#fbbf24' } : sFrame.flash === 'pop' ? { borderColor: '#10b981' } : undefined}>
                  {sFrame.working}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 font-mono text-sm text-muted">
                  <Icon name="check" size={16} className="text-emerald-500" /> clean
                </div>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-edge bg-bg/40 p-4">
            <div className="mb-2 font-mono text-[11px] uppercase text-muted" style={{ color: '#8b5cf6' }}>
              stash (shelf)
            </div>
            <div className="flex min-h-16 items-center justify-center">
              {sFrame.shelf ? (
                <div className="rounded border px-3 py-2 font-mono text-sm" style={{ borderColor: '#8b5cf6', color: '#8b5cf6' }}>
                  {sFrame.shelf}
                </div>
              ) : (
                <span className="font-mono text-sm text-muted">empty</span>
              )}
            </div>
          </div>
          <div className="col-span-1 flex items-center justify-center sm:col-span-2">
            <div className="flex items-center gap-2 font-mono text-xs text-muted">
              {sFrame.flash === 'push' && (
                <>
                  <span>working</span>
                  <Icon name="arrow-right" size={16} style={{ color: '#fbbf24' }} />
                  <span style={{ color: '#fbbf24' }}>stash push</span>
                </>
              )}
              {sFrame.flash === 'pop' && (
                <>
                  <span style={{ color: '#10b981' }}>stash pop</span>
                  <Icon name="arrow-left" size={16} style={{ color: '#10b981' }} />
                  <span>working</span>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-edge bg-bg/40">
          <svg width={Math.max(cWidth, 360)} height={168} role="img" aria-label="cherry-pick commit graph">
            {cFrame.nodes.map((n) =>
              n.parents.map((p) => {
                const a = cPos.get(n.id)!;
                const b = cPos.get(p);
                if (!b) return null;
                return <line key={n.id + p} x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={{ stroke: n.copy ? '#10b981' : n.branch === 'feature' ? '#38bdf8' : 'var(--border)' }} strokeWidth={2} />;
              }),
            )}
            {cFrame.nodes.map((n) => {
              const isTip = n.id === cFrame.mainTip || n.id === cFrame.featTip;
              const baseColor = n.copy ? '#10b981' : n.branch === 'feature' ? '#38bdf8' : 'var(--border)';
              const stroke = n.highlight ? (n.copy ? '#10b981' : '#fbbf24') : isTip ? 'var(--accent)' : baseColor;
              const fill = isTip ? 'var(--accent)' : 'var(--surface)';
              const txt = isTip ? 'var(--accent-fg)' : 'var(--fg)';
              const labels = cTips[n.id] ?? [];
              return (
                <g key={n.id}>
                  <circle cx={n.x} cy={n.y} r={15} style={{ fill, stroke }} strokeWidth={n.highlight ? 3 : 2.5} />
                  <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central" fontSize={11} style={{ fill: txt, fontFamily: 'var(--font-mono)' }}>
                    {n.id}
                  </text>
                  {labels.map((b, k) => {
                    const head = b === cFrame.head;
                    const label = head ? `HEAD→${b}` : b;
                    const w = label.length * 6.4 + 10;
                    const ly = n.y === TOP ? n.y - 30 - k * 20 : n.y + 24 + k * 20;
                    return (
                      <g key={b} transform={`translate(${n.x - w / 2}, ${ly})`}>
                        <rect width={w} height={17} rx={4} style={{ fill: head ? 'var(--accent)' : 'var(--surface)', stroke: head ? 'var(--accent)' : 'var(--border)' }} strokeWidth={1.5} />
                        <text x={w / 2} y={9} textAnchor="middle" dominantBaseline="central" fontSize={10} style={{ fill: head ? 'var(--accent-fg)' : 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                          {label}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>
      )}

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
        <button type="button" className={btn} onClick={next} disabled={index >= total - 1}>
          Step <Icon name="chevron-right" size={16} />
        </button>
        <button type="button" className={btn} onClick={() => seek(0)} disabled={index === 0}>
          <Icon name="rotate-ccw" size={15} /> Restart
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={1} max={5} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input type="range" min={0} max={Math.max(total - 1, 0)} value={index} onChange={(e) => seek(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Timeline" />
        <span className="shrink-0 font-mono text-xs text-muted">
          {index + 1}/{total}
        </span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-fg">{note}</div>
    </div>
  );
}
