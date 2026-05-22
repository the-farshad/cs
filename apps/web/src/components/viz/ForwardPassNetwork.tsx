import { useMemo } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// A fixed 2-3-1 feedforward net. Deterministic weights/biases, sigmoid activation.
const INPUTS = [0.9, 0.2];

// W1[j][i] = weight from input i to hidden neuron j
const W1 = [
  [0.8, -0.6],
  [-0.4, 0.9],
  [0.5, 0.5],
];
const B1 = [0.1, -0.2, 0.0];
// W2[j] = weight from hidden neuron j to the output
const W2 = [1.1, -0.8, 0.7];
const B2 = 0.2;

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

const hiddenZ = B1.map((b, j) => b + W1[j][0] * INPUTS[0] + W1[j][1] * INPUTS[1]);
const hiddenA = hiddenZ.map(sigmoid);
const outZ = B2 + W2.reduce((s, w, j) => s + w * hiddenA[j], 0);
const outA = sigmoid(outZ);

// Geometry
const W = 560;
const H = 320;
const COL = [110, 280, 450]; // x of input / hidden / output columns
const inputY = [110, 210];
const hiddenY = [70, 160, 250];
const outY = [160];

type Node = { x: number; y: number; a: number; label: string };

const nodes: { input: Node[]; hidden: Node[]; output: Node[] } = {
  input: INPUTS.map((a, i) => ({ x: COL[0], y: inputY[i], a, label: `x${i + 1}` })),
  hidden: hiddenA.map((a, j) => ({ x: COL[1], y: hiddenY[j], a, label: `h${j + 1}` })),
  output: [{ x: COL[2], y: outY[0], a: outA, label: 'y' }],
};

// 4 frames: 0 inputs, 1 input→hidden edges, 2 hidden activations, 3 output
const FRAMES = 4;
const STEP_LABEL = ['Inputs ready', 'Weighted sums → hidden', 'Hidden activations fire', 'Output produced'];

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

// map activation (0..1) to a fill opacity for the "lit up" effect
const lit = (a: number) => 0.25 + 0.75 * a;

export default function ForwardPassNetwork() {
  const { index, playing, fps, setFps, play, pause, next, prev, reset } = useStepper(FRAMES, 2);

  const edges1 = useMemo(
    () =>
      nodes.input.flatMap((src, i) =>
        nodes.hidden.map((dst, j) => ({ src, dst, w: W1[j][i], key: `1-${i}-${j}` })),
      ),
    [],
  );
  const edges2 = useMemo(
    () => nodes.hidden.map((src, j) => ({ src, dst: nodes.output[0], w: W2[j], key: `2-${j}` })),
    [],
  );

  // What is active at each step.
  const inputsOn = index >= 0;
  const edges1On = index >= 1;
  const hiddenOn = index >= 2;
  const edges2On = index >= 3;
  const outputOn = index >= 3;

  const edgeStyle = (w: number, on: boolean) => ({
    stroke: w >= 0 ? '#10b981' : '#f43f5e',
    strokeWidth: 0.6 + Math.min(Math.abs(w), 1.4) * 2,
    opacity: on ? 0.85 : 0.12,
  });

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '22rem' }} role="img" aria-label="feedforward neural network forward pass">
        {/* column labels */}
        <text x={COL[0]} y={24} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--muted)' }}>input</text>
        <text x={COL[1]} y={24} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--muted)' }}>hidden</text>
        <text x={COL[2]} y={24} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--muted)' }}>output</text>

        {/* edges: input -> hidden */}
        {edges1.map((e) => (
          <line key={e.key} x1={e.src.x} y1={e.src.y} x2={e.dst.x} y2={e.dst.y} style={edgeStyle(e.w, edges1On)} />
        ))}
        {/* edges: hidden -> output */}
        {edges2.map((e) => (
          <line key={e.key} x1={e.src.x} y1={e.src.y} x2={e.dst.x} y2={e.dst.y} style={edgeStyle(e.w, edges2On)} />
        ))}

        {/* nodes */}
        {nodes.input.map((n) => (
          <g key={n.label}>
            <circle cx={n.x} cy={n.y} r={20} fill="var(--accent)" stroke="var(--bg)" strokeWidth={2} opacity={inputsOn ? lit(n.a) : 0.15} />
            <text x={n.x} y={n.y + 4} textAnchor="middle" style={{ fontSize: 12, fontFamily: 'monospace', fill: 'var(--accent-fg)' }}>
              {n.a.toFixed(2)}
            </text>
            <text x={n.x - 30} y={n.y + 4} textAnchor="end" style={{ fontSize: 11, fill: 'var(--muted)' }}>{n.label}</text>
          </g>
        ))}
        {nodes.hidden.map((n) => (
          <g key={n.label}>
            <circle cx={n.x} cy={n.y} r={20} fill="#8b5cf6" stroke="var(--bg)" strokeWidth={2} opacity={hiddenOn ? lit(n.a) : 0.15} />
            <text x={n.x} y={n.y + 4} textAnchor="middle" fill="#ffffff" style={{ fontSize: 12, fontFamily: 'monospace' }}>
              {hiddenOn ? n.a.toFixed(2) : '?'}
            </text>
          </g>
        ))}
        {nodes.output.map((n) => (
          <g key={n.label}>
            <circle cx={n.x} cy={n.y} r={22} fill="#fbbf24" stroke="var(--bg)" strokeWidth={2} opacity={outputOn ? lit(n.a) : 0.15} />
            <text x={n.x} y={n.y + 4} textAnchor="middle" fill="#1a1a1a" style={{ fontSize: 13, fontFamily: 'monospace' }}>
              {outputOn ? n.a.toFixed(2) : '?'}
            </text>
            <text x={n.x + 32} y={n.y + 4} textAnchor="start" style={{ fontSize: 11, fill: 'var(--muted)' }}>{n.label}</text>
          </g>
        ))}
      </svg>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={prev} disabled={index <= 0}>
          <Icon name="chevron-left" size={16} /> Back
        </button>
        <button
          type="button"
          onClick={() => (playing ? pause() : play())}
          className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90"
        >
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Run pass'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= FRAMES - 1}>
          Next layer <Icon name="chevron-right" size={16} />
        </button>
        <button type="button" className={btn} onClick={reset} disabled={index === 0}>
          <Icon name="rotate-ccw" size={16} /> Reset
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={1} max={6} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="mt-4 border-t border-edge pt-4 text-sm text-fg">
        <span className="font-mono text-xs text-muted">step {index + 1}/{FRAMES} · </span>
        {STEP_LABEL[index]}
      </div>
      <div className="mt-2 font-mono text-xs text-muted">
        edge color: <span style={{ color: '#10b981' }}>positive weight</span> ·{' '}
        <span style={{ color: '#f43f5e' }}>negative weight</span> · thickness = magnitude. Each neuron applies sigmoid(Σ w·x + b).
      </div>
    </div>
  );
}
