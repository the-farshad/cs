import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// A small 3-state weather chain: Sunny, Cloudy, Rainy.
// P[i][j] = probability of going from state i to state j. Each row sums to 1.
const STATES = ['Sunny', 'Cloudy', 'Rainy'];
const P: number[][] = [
  [0.7, 0.2, 0.1],
  [0.3, 0.4, 0.3],
  [0.2, 0.5, 0.3],
];
const STATE_COLORS = ['#fbbf24', '#38bdf8', '#8b5cf6']; // amber, sky, violet

// Diagram node positions (triangle layout) on a fixed viewBox.
const NODES = [
  { x: 160, y: 50 }, // Sunny (top)
  { x: 60, y: 200 }, // Cloudy (bottom-left)
  { x: 260, y: 200 }, // Rainy (bottom-right)
];
const NODE_R = 30;

const STEPS = 16;

// Multiply a row vector by P: result[j] = sum_i v[i] * P[i][j].
function step(v: number[]): number[] {
  return P[0].map((_, j) => v.reduce((acc, vi, i) => acc + vi * P[i][j], 0));
}

// Solve the stationary distribution by iterating to convergence.
function stationary(): number[] {
  let v = [1 / 3, 1 / 3, 1 / 3];
  for (let k = 0; k < 2000; k++) v = step(v);
  return v;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

// A simple seeded pseudo-random generator for the deterministic walker.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function MarkovChainVisualizer() {
  const [startState, setStartState] = useState(0);
  const [walkerSeed, setWalkerSeed] = useState(1);

  // Distribution frames: start as a point mass on startState, then iterate v·P.
  const dists = useMemo(() => {
    const start = [0, 0, 0];
    start[startState] = 1;
    const frames = [start];
    let v = start;
    for (let k = 0; k < STEPS; k++) {
      v = step(v);
      frames.push(v);
    }
    return frames;
  }, [startState]);

  // Walker path: a single trajectory sampled deterministically from the seed.
  const walk = useMemo(() => {
    const rng = mulberry32(walkerSeed * 2654435761 + startState + 1);
    const path = [startState];
    let s = startState;
    for (let k = 0; k < STEPS; k++) {
      const r = rng();
      let acc = 0;
      let next = STATES.length - 1;
      for (let j = 0; j < STATES.length; j++) {
        acc += P[s][j];
        if (r <= acc) {
          next = j;
          break;
        }
      }
      s = next;
      path.push(s);
    }
    return path;
  }, [walkerSeed, startState]);

  const pi = useMemo(stationary, []);

  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(dists.length, 4);
  const i = Math.min(index, dists.length - 1);
  const dist = dists[i];
  const walker = walk[i];

  // Bar chart geometry.
  const BW = 360;
  const BH = 170;
  const BPAD = 28;
  const barW = (BW - 2 * BPAD) / STATES.length;
  const barTo = (p: number) => (BH - 2 * BPAD) * p;

  // L2 distance from stationary, to label convergence.
  const drift = Math.sqrt(dist.reduce((acc, p, k) => acc + (p - pi[k]) ** 2, 0));

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Transition diagram with the walker highlighted */}
        <div>
          <div className="mb-2 text-xs font-medium text-muted">Transition diagram (walker in solid)</div>
          <svg viewBox="0 0 320 250" className="w-full" role="img" aria-label="Markov chain transition diagram">
            {/* Edges: draw each directed transition with its probability */}
            {NODES.map((from, fi) =>
              NODES.map((to, ti) => {
                if (fi === ti) return null;
                const dx = to.x - from.x;
                const dy = to.y - from.y;
                const len = Math.hypot(dx, dy);
                const ux = dx / len;
                const uy = dy / len;
                // Offset endpoints to node edges; nudge perpendicular so the two
                // directions between a pair don't overlap.
                const nx = -uy;
                const ny = ux;
                const off = 7;
                const x1 = from.x + ux * NODE_R + nx * off;
                const y1 = from.y + uy * NODE_R + ny * off;
                const x2 = to.x - ux * NODE_R + nx * off;
                const y2 = to.y - uy * NODE_R + ny * off;
                const mx = (x1 + x2) / 2 + nx * 9;
                const my = (y1 + y2) / 2 + ny * 9;
                const active = walker === fi;
                return (
                  <g key={`${fi}-${ti}`}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      style={{ stroke: active ? 'var(--accent)' : 'var(--border)' }}
                      strokeWidth={active ? 2 : 1.2}
                      markerEnd={active ? 'url(#arrow-on)' : 'url(#arrow-off)'}
                    />
                    <text x={mx} y={my} textAnchor="middle" dominantBaseline="middle" fontSize="10" style={{ fill: active ? 'var(--accent)' : 'var(--muted)' }}>
                      {P[fi][ti].toFixed(1)}
                    </text>
                  </g>
                );
              }),
            )}
            {/* Self-loops as a small probability label above each node */}
            {NODES.map((n, k) => (
              <text key={`self-${k}`} x={n.x} y={n.y - NODE_R - 6} textAnchor="middle" fontSize="10" style={{ fill: 'var(--muted)' }}>
                self {P[k][k].toFixed(1)}
              </text>
            ))}
            {/* Nodes */}
            {NODES.map((n, k) => {
              const here = walker === k;
              return (
                <g key={k}>
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={NODE_R}
                    fill={here ? STATE_COLORS[k] : 'var(--surface)'}
                    style={{ stroke: STATE_COLORS[k] }}
                    strokeWidth={2.5}
                    opacity={here ? 1 : 0.85}
                  />
                  <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="middle" fontSize="12" fontWeight={600} style={{ fill: here ? '#15120a' : 'var(--fg)' }}>
                    {STATES[k]}
                  </text>
                </g>
              );
            })}
            <defs>
              <marker id="arrow-off" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="var(--border)" />
              </marker>
              <marker id="arrow-on" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="var(--accent)" />
              </marker>
            </defs>
          </svg>
        </div>

        {/* Distribution bar chart vs stationary */}
        <div>
          <div className="mb-2 text-xs font-medium text-muted">Distribution vₖ after {i} steps (dashed = stationary π)</div>
          <svg viewBox={`0 0 ${BW} ${BH}`} className="w-full" role="img" aria-label="state probability distribution">
            {/* baseline */}
            <line x1={BPAD} y1={BH - BPAD} x2={BW - BPAD} y2={BH - BPAD} style={{ stroke: 'var(--border)' }} strokeWidth={1} />
            {STATES.map((name, k) => {
              const x = BPAD + k * barW + barW * 0.18;
              const w = barW * 0.64;
              const h = barTo(dist[k]);
              const y = BH - BPAD - h;
              const piY = BH - BPAD - barTo(pi[k]);
              return (
                <g key={k}>
                  <rect x={x} y={y} width={w} height={Math.max(h, 0)} rx={3} fill={STATE_COLORS[k]} opacity={0.9} />
                  {/* stationary marker */}
                  <line x1={x - 3} y1={piY} x2={x + w + 3} y2={piY} stroke={STATE_COLORS[k]} strokeWidth={1.5} strokeDasharray="3 2" />
                  <text x={x + w / 2} y={BH - BPAD + 12} textAnchor="middle" fontSize="9" style={{ fill: 'var(--muted)' }}>
                    {name}
                  </text>
                  <text x={x + w / 2} y={y - 4} textAnchor="middle" fontSize="9" style={{ fill: 'var(--fg)' }}>
                    {dist[k].toFixed(2)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={prev} disabled={index <= 0}>
          <Icon name="chevron-left" size={16} /> Step
        </button>
        <button type="button" onClick={() => (playing ? pause() : play())} className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90">
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Multiply by P'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= dists.length - 1}>
          Step <Icon name="chevron-right" size={16} />
        </button>
        <button type="button" className={btn} onClick={reset} disabled={index === 0}>
          <Icon name="rotate-ccw" size={16} /> Reset
        </button>
        <button type="button" className={btn} onClick={() => setWalkerSeed((s) => s + 1)}>
          <Icon name="shuffle" size={16} /> New walker
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={1} max={12} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          Start state
          <select value={startState} onChange={(e) => setStartState(Number(e.target.value))} className="rounded border border-edge bg-bg px-2 py-1 text-fg">
            {STATES.map((s, k) => (
              <option key={k} value={k}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <input type="range" min={0} max={Math.max(dists.length - 1, 0)} value={index} onChange={(e) => seek(Number(e.target.value))} className="w-full flex-1 accent-[var(--accent)]" aria-label="Timeline" />
        <span className="shrink-0 font-mono text-xs text-muted">
          step {i}/{dists.length - 1}
        </span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">
        Walker now in <span style={{ color: STATE_COLORS[walker] }}>{STATES[walker]}</span> · π ≈ [{pi.map((p) => p.toFixed(2)).join(', ')}] · distance to π = {drift.toFixed(3)}
        {drift < 0.005 ? ' · converged' : ''}
      </div>
    </div>
  );
}
