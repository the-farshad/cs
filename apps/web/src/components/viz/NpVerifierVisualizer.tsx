import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

// Graph 3-coloring: an NP problem. A "certificate" is a color per vertex.
// VERIFY (polynomial): just scan every edge and confirm its endpoints differ.
// SEARCH (exponential): try all 3^V colorings until one verifies.
const COLORS = ['#f43f5e', '#38bdf8', '#10b981']; // rose, sky, emerald
const COLOR_NAMES = ['R', 'B', 'G'];

type Vtx = { id: number; x: number; y: number };
const VERTS: Vtx[] = [
  { id: 0, x: 90, y: 50 },
  { id: 1, x: 240, y: 50 },
  { id: 2, x: 300, y: 170 },
  { id: 3, x: 165, y: 240 },
  { id: 4, x: 30, y: 170 },
];
// A 5-cycle plus one chord — 3-colorable.
const EDGES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 0],
  [0, 2],
];

// A valid 3-coloring of this graph (used as the example certificate).
const VALID = [0, 1, 0, 1, 2];
// A coloring with one conflict (edge 0-2 both color 0).
const BAD = [0, 1, 0, 2, 1];

type Frame = {
  edgeIdx: number; // edge being checked (-1 before start)
  ok: boolean; // does this edge pass?
  done: boolean;
  accepted: boolean;
  note: string;
};

function verify(coloring: number[]): Frame[] {
  const frames: Frame[] = [
    { edgeIdx: -1, ok: true, done: false, accepted: false, note: 'Verifier: scan each edge once and check its endpoints differ.' },
  ];
  for (let i = 0; i < EDGES.length; i++) {
    const [u, v] = EDGES[i];
    const ok = coloring[u] !== coloring[v];
    frames.push({
      edgeIdx: i,
      ok,
      done: !ok,
      accepted: false,
      note: ok
        ? `edge (${u},${v}): ${COLOR_NAMES[coloring[u]]} ≠ ${COLOR_NAMES[coloring[v]]} — ok`
        : `edge (${u},${v}): both ${COLOR_NAMES[coloring[u]]} — conflict! certificate rejected`,
    });
    if (!ok) return frames;
  }
  frames.push({
    edgeIdx: EDGES.length - 1,
    ok: true,
    done: true,
    accepted: true,
    note: `all ${EDGES.length} edges checked in O(E) — certificate accepted`,
  });
  return frames;
}

export default function NpVerifierVisualizer() {
  const [which, setWhich] = useState<'valid' | 'bad'>('valid');
  const coloring = which === 'valid' ? VALID : BAD;

  const frames = useMemo(() => verify(coloring), [which]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 2);
  const frame = frames[Math.min(index, frames.length - 1)] ?? frames[0];

  const checkedEdges = new Set<number>();
  for (let i = 0; i <= frame.edgeIdx; i++) checkedEdges.add(i);

  const totalSearch = Math.pow(3, VERTS.length);

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3 text-sm text-muted">
        Graph 3-coloring is in <span className="text-fg">NP</span>: a coloring (the certificate) can be{' '}
        <span className="text-fg">checked in polynomial time</span> even though finding one seems to need exponential
        search. Pick a certificate and watch the verifier.
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded border border-edge">
          {(
            [
              ['valid', 'valid certificate'],
              ['bad', 'flawed certificate'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setWhich(key)}
              aria-pressed={which === key}
              className={`px-3 py-1 text-sm transition ${which === key ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
        <svg viewBox="0 0 330 290" width="100%" className="max-w-[330px]" role="img" aria-label="graph coloring">
          {EDGES.map(([u, v], i) => {
            const a = VERTS[u];
            const b = VERTS[v];
            const checked = checkedEdges.has(i);
            const isCur = i === frame.edgeIdx;
            const conflict = isCur && !frame.ok;
            const color = conflict ? '#f43f5e' : isCur ? 'var(--accent)' : checked ? '#10b981' : 'var(--muted)';
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={color}
                strokeWidth={isCur ? 4 : checked ? 2.5 : 1.5}
                opacity={checked || isCur ? 1 : 0.5}
              />
            );
          })}
          {VERTS.map((vt) => (
            <g key={vt.id}>
              <circle cx={vt.x} cy={vt.y} r={18} fill={COLORS[coloring[vt.id]]} stroke="var(--fg)" strokeWidth={1.5} />
              <text x={vt.x} y={vt.y + 4} textAnchor="middle" fontSize={12} fontFamily="monospace" fill="#0a0a0a">
                {vt.id}
              </text>
            </g>
          ))}
        </svg>

        <div className="space-y-3">
          <div className="rounded border border-edge bg-bg p-3">
            <div className="mb-1 text-xs font-medium text-fg">Verify (in P)</div>
            <div className="font-mono text-xs text-muted">
              check each of {EDGES.length} edges once → O(E)
            </div>
            <div className="mt-1 font-mono text-xs text-muted">
              checked {Math.max(0, frame.edgeIdx + (frame.done && frame.accepted ? 1 : frame.edgeIdx >= 0 ? 1 : 0))}/
              {EDGES.length}
            </div>
          </div>
          <div className="rounded border border-edge bg-bg p-3">
            <div className="mb-1 text-xs font-medium text-fg">Search for a certificate</div>
            <div className="font-mono text-xs text-muted">
              3 colors × {VERTS.length} vertices → up to 3^{VERTS.length} = {totalSearch} colorings
            </div>
            <div className="mt-1 text-xs text-muted">
              Verifying is cheap; brute-force searching blows up exponentially. Whether a smarter, polynomial search
              always exists is the <span className="text-fg">P vs NP</span> question.
            </div>
          </div>
        </div>
      </div>

      {/* certificate row */}
      <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-xs">
        <span className="text-muted">certificate:</span>
        {coloring.map((c, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded border border-edge px-1.5 py-0.5">
            v{i}=
            <span style={{ color: COLORS[c] }}>{COLOR_NAMES[c]}</span>
          </span>
        ))}
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

      <div className="mt-4 flex items-center gap-3 border-t border-edge pt-4 font-mono text-xs">
        <span className="text-muted">{frame.note}</span>
        {frame.done && (
          <span
            className="ml-auto rounded px-2 py-0.5 font-medium"
            style={{
              color: frame.accepted ? '#10b981' : '#f43f5e',
              border: `1px solid ${frame.accepted ? '#10b981' : '#f43f5e'}`,
            }}
          >
            {frame.accepted ? 'ACCEPT' : 'REJECT'}
          </span>
        )}
      </div>
    </div>
  );
}
