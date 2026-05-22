import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// Two repositories side by side: your local clone (top) and origin (bottom).
// commit advances local; push copies local commits to origin; a teammate's
// commit lands on origin; fetch copies it down; pull = fetch + merge/ff.
// "ahead/behind" counts how local compares to origin/main.

type Frame = {
  local: string[]; // commit ids on local main (in order)
  origin: string[]; // commit ids on origin main
  fetched: string[]; // commits known locally via origin/main tracking ref
  moving?: { ids: string[]; dir: 'up' | 'down' }; // animate transfer
  ahead: number;
  behind: number;
  note: string;
};

function buildFrames(): Frame[] {
  const frames: Frame[] = [];
  const push = (f: Frame) => frames.push(f);

  // 0: fresh clone, in sync
  push({ local: ['A', 'B'], origin: ['A', 'B'], fetched: ['A', 'B'], ahead: 0, behind: 0, note: 'after git clone: local and origin/main are in sync' });
  // 1: local commit C
  push({ local: ['A', 'B', 'C'], origin: ['A', 'B'], fetched: ['A', 'B'], ahead: 1, behind: 0, note: 'git commit   ·   local is now 1 commit AHEAD of origin/main' });
  // 2: push (animate up)
  push({ local: ['A', 'B', 'C'], origin: ['A', 'B'], fetched: ['A', 'B'], moving: { ids: ['C'], dir: 'up' }, ahead: 1, behind: 0, note: 'git push   ·   send local commit C up to origin' });
  // 3: pushed, in sync
  push({ local: ['A', 'B', 'C'], origin: ['A', 'B', 'C'], fetched: ['A', 'B', 'C'], ahead: 0, behind: 0, note: 'origin updated; tracking branch advances — in sync again' });
  // 4: teammate pushes D to origin
  push({ local: ['A', 'B', 'C'], origin: ['A', 'B', 'C', 'D'], fetched: ['A', 'B', 'C'], ahead: 0, behind: 1, note: 'a teammate pushes D; your origin/main is stale, so you are 1 BEHIND' });
  // 5: fetch (animate down)
  push({ local: ['A', 'B', 'C'], origin: ['A', 'B', 'C', 'D'], fetched: ['A', 'B', 'C'], moving: { ids: ['D'], dir: 'down' }, ahead: 0, behind: 1, note: 'git fetch   ·   download D into origin/main — but do NOT touch your branch yet' });
  // 6: fetched, behind but tracking updated
  push({ local: ['A', 'B', 'C'], origin: ['A', 'B', 'C', 'D'], fetched: ['A', 'B', 'C', 'D'], ahead: 0, behind: 1, note: 'origin/main now knows D; your local main still points at C' });
  // 7: pull = integrate
  push({ local: ['A', 'B', 'C', 'D'], origin: ['A', 'B', 'C', 'D'], fetched: ['A', 'B', 'C', 'D'], ahead: 0, behind: 0, note: 'git pull (fetch + merge/ff)   ·   fast-forward local to D — back in sync' });
  return frames;
}

const COL = 70;
const PADX = 34;
const LOCAL_Y = 40;
const ORIGIN_Y = 150;

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

function Row({
  ids,
  y,
  tipLabel,
  newest,
}: {
  ids: string[];
  y: number;
  tipLabel: string;
  newest?: string; // id just transferred -> highlight
}) {
  return (
    <>
      {ids.map((id, i) => {
        if (i === 0) return null;
        const x1 = PADX + (i - 1) * COL + 15;
        const x2 = PADX + i * COL - 15;
        return <line key={`l${y}${id}`} x1={x1} y1={y} x2={x2} y2={y} style={{ stroke: 'var(--border)' }} strokeWidth={2} />;
      })}
      {ids.map((id, i) => {
        const x = PADX + i * COL;
        const isTip = i === ids.length - 1;
        const isNew = id === newest;
        const stroke = isNew ? '#10b981' : isTip ? 'var(--accent)' : 'var(--border)';
        const fill = isTip ? 'var(--accent)' : 'var(--surface)';
        const txt = isTip ? 'var(--accent-fg)' : 'var(--fg)';
        return (
          <g key={`n${y}${id}`}>
            <circle cx={x} cy={y} r={14} style={{ fill, stroke }} strokeWidth={isNew ? 3 : 2.5} />
            <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={11} style={{ fill: txt, fontFamily: 'var(--font-mono)' }}>
              {id}
            </text>
            {isTip && (
              <g transform={`translate(${x + 18}, ${y - 9})`}>
                <rect width={tipLabel.length * 6.4 + 10} height={18} rx={4} style={{ fill: 'var(--surface)', stroke: 'var(--accent)' }} strokeWidth={1.5} />
                <text x={6} y={9} dominantBaseline="central" fontSize={10} style={{ fill: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                  {tipLabel}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </>
  );
}

export default function GitRemoteVisualizer() {
  const frames = useMemo(() => buildFrames(), []);
  const { index, playing, fps, setFps, play, pause, next, prev, seek } = useStepper(frames.length);
  const frame = frames[Math.min(index, frames.length - 1)] ?? frames[0];

  const maxLen = Math.max(frame.local.length, frame.origin.length);
  const width = PADX * 2 + (maxLen - 1) * COL + 90;
  const newest = frame.moving?.ids[0];

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3 font-mono text-[11px]">
        <span className="rounded border px-2 py-0.5" style={frame.ahead > 0 ? { borderColor: '#fbbf24', color: '#fbbf24' } : { borderColor: 'var(--border)', color: 'var(--muted)' }}>
          ahead {frame.ahead}
        </span>
        <span className="rounded border px-2 py-0.5" style={frame.behind > 0 ? { borderColor: '#38bdf8', color: '#38bdf8' } : { borderColor: 'var(--border)', color: 'var(--muted)' }}>
          behind {frame.behind}
        </span>
        <span className="ml-auto text-muted">
          {frame.ahead === 0 && frame.behind === 0 ? (
            <span className="inline-flex items-center gap-1">
              <Icon name="check" size={13} className="text-emerald-500" /> in sync
            </span>
          ) : (
            'diverged from origin/main'
          )}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-edge bg-bg/40">
        <svg width={Math.max(width, 360)} height={210} role="img" aria-label="local and origin commit graphs">
          <text x={PADX} y={18} fontSize={11} style={{ fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
            local · HEAD → main
          </text>
          <Row ids={frame.local} y={LOCAL_Y} tipLabel="main" newest={frame.moving?.dir === 'down' ? newest : undefined} />

          {/* transfer arrow */}
          {frame.moving && (
            <g>
              <line
                x1={PADX + (frame.moving.dir === 'up' ? frame.local.length - 1 : frame.origin.length - 1) * COL}
                y1={frame.moving.dir === 'up' ? LOCAL_Y + 16 : ORIGIN_Y - 16}
                x2={PADX + (frame.moving.dir === 'up' ? frame.local.length - 1 : frame.origin.length - 1) * COL}
                y2={frame.moving.dir === 'up' ? ORIGIN_Y - 16 : LOCAL_Y + 16}
                style={{ stroke: '#10b981' }}
                strokeWidth={2}
                strokeDasharray="4 3"
                markerEnd="url(#arrow)"
              />
              <defs>
                <marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                  <path d="M0 0 L8 4 L0 8 z" fill="#10b981" />
                </marker>
              </defs>
              <text
                x={PADX + (frame.moving.dir === 'up' ? frame.local.length - 1 : frame.origin.length - 1) * COL + 8}
                y={(LOCAL_Y + ORIGIN_Y) / 2}
                fontSize={10}
                style={{ fill: '#10b981', fontFamily: 'var(--font-mono)' }}
              >
                {frame.moving.dir === 'up' ? 'push ↑' : 'fetch ↓'}
              </text>
            </g>
          )}

          <text x={PADX} y={ORIGIN_Y + 38} fontSize={11} style={{ fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
            origin (remote) · origin/main
          </text>
          <Row ids={frame.origin} y={ORIGIN_Y} tipLabel="main" newest={frame.moving?.dir === 'up' ? newest : undefined} />
        </svg>
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
        <button type="button" className={btn} onClick={() => seek(0)} disabled={index === 0}>
          <Icon name="rotate-ccw" size={15} /> Restart
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={1} max={5} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input type="range" min={0} max={Math.max(frames.length - 1, 0)} value={index} onChange={(e) => seek(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Timeline" />
        <span className="shrink-0 font-mono text-xs text-muted">
          {index + 1}/{frames.length}
        </span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-fg">{frame.note}</div>
    </div>
  );
}
