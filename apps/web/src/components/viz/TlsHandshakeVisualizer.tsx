import { useMemo } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

type Side = 'client' | 'server';
type Kind = 'hello' | 'cert' | 'key' | 'finished' | 'data';

type Msg = {
  from: Side;
  label: string;
  kind: Kind;
  note: string;
};

// A simplified TLS 1.2-style handshake: hellos, certificate (signed by a CA),
// key exchange, then symmetric application data under the derived session key.
const MESSAGES: Msg[] = [
  {
    from: 'client',
    label: 'ClientHello',
    kind: 'hello',
    note: 'Client offers supported cipher suites and a random nonce.',
  },
  {
    from: 'server',
    label: 'ServerHello',
    kind: 'hello',
    note: 'Server picks a cipher suite and sends its own random nonce.',
  },
  {
    from: 'server',
    label: 'Certificate (signed by CA)',
    kind: 'cert',
    note: 'Server sends its certificate: its public key plus a CA signature. The client verifies the chain of trust up to a root it already trusts.',
  },
  {
    from: 'client',
    label: 'Key exchange',
    kind: 'key',
    note: 'Using the server public key (or an ephemeral Diffie-Hellman exchange), both sides derive the same secret session key.',
  },
  {
    from: 'client',
    label: 'Finished (encrypted)',
    kind: 'finished',
    note: 'Client sends a Finished message encrypted with the new session key, proving the handshake was not tampered with.',
  },
  {
    from: 'server',
    label: 'Finished (encrypted)',
    kind: 'finished',
    note: 'Server replies Finished under the same key. The secure channel is established.',
  },
  {
    from: 'client',
    label: 'Application data (AES)',
    kind: 'data',
    note: 'From here every byte is encrypted with fast symmetric crypto (e.g. AES) using the session key.',
  },
  {
    from: 'server',
    label: 'Application data (AES)',
    kind: 'data',
    note: 'Two-way encrypted traffic flows. Asymmetric crypto set up the key; symmetric crypto carries the data.',
  },
];

type Frame = { drawn: number; active: number; note: string; secure: boolean };

function buildFrames(): Frame[] {
  const frames: Frame[] = [
    { drawn: 0, active: -1, note: 'Client wants a secure connection to the server.', secure: false },
  ];
  MESSAGES.forEach((m, i) => {
    frames.push({
      drawn: i + 1,
      active: i,
      note: m.note,
      secure: m.kind === 'finished' ? i >= 5 : m.kind === 'data',
    });
  });
  return frames;
}

const KIND_COLOR: Record<Kind, string> = {
  hello: '#38bdf8',
  cert: '#8b5cf6',
  key: '#fbbf24',
  finished: '#10b981',
  data: '#10b981',
};

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const CLIENT_X = 100;
const SERVER_X = 460;
const TOP = 56;
const ROW = 44;

export default function TlsHandshakeVisualizer() {
  const frames = useMemo(() => buildFrames(), []);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 1.5);
  const frame = frames[Math.min(index, frames.length - 1)] ?? frames[0];

  const height = TOP + MESSAGES.length * ROW + 36;
  const width = 560;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="overflow-x-auto rounded-lg border border-edge bg-bg/40">
        <svg width={width} height={height} className="mx-auto block" role="img" aria-label="TLS handshake sequence diagram">
          {([
            { x: CLIENT_X, label: 'BROWSER' },
            { x: SERVER_X, label: 'SERVER' },
          ] as const).map((c) => (
            <g key={c.label}>
              <rect x={c.x - 54} y={14} width={108} height={28} rx={6} style={{ fill: 'var(--surface)', stroke: 'var(--accent)' }} strokeWidth={2} />
              <text x={c.x} y={28} textAnchor="middle" dominantBaseline="central" fontSize={12} style={{ fill: 'var(--fg)', fontFamily: 'var(--font-mono)' }}>
                {c.label}
              </text>
              <line x1={c.x} y1={42} x2={c.x} y2={height - 14} style={{ stroke: 'var(--border)' }} strokeWidth={2} strokeDasharray="4 4" />
            </g>
          ))}

          {/* once the channel is secure, shade the lower region */}
          {frame.secure && (
            <rect
              x={CLIENT_X - 10}
              y={TOP + 5 * ROW - 8}
              width={SERVER_X - CLIENT_X + 20}
              height={height - (TOP + 5 * ROW) - 6}
              rx={8}
              style={{ fill: '#10b981', opacity: 0.07, stroke: '#10b981', strokeWidth: 1 }}
            />
          )}

          {MESSAGES.map((m, i) => {
            if (i >= frame.drawn) return null;
            const y = TOP + i * ROW;
            const leftToRight = m.from === 'client';
            const x1 = leftToRight ? CLIENT_X : SERVER_X;
            const x2 = leftToRight ? SERVER_X : CLIENT_X;
            const color = KIND_COLOR[m.kind];
            const isActive = frame.active === i;
            const midX = (x1 + x2) / 2;
            return (
              <g key={i} opacity={isActive ? 1 : 0.5}>
                <defs>
                  <marker id={`tls-arrow-${i}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
                  </marker>
                </defs>
                <line x1={x1} y1={y} x2={x2} y2={y + 14} style={{ stroke: color }} strokeWidth={isActive ? 3 : 2} markerEnd={`url(#tls-arrow-${i})`} />
                <text x={midX} y={y - 5} textAnchor="middle" fontSize={11} style={{ fill: isActive ? 'var(--fg)' : 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                  {m.label}
                </text>
              </g>
            );
          })}
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
        <button type="button" className={btn} onClick={reset} disabled={index === 0}>
          <Icon name="rotate-ccw" size={16} /> Reset
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={1} max={6} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
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

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: KIND_COLOR.hello }} /> Hello
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: KIND_COLOR.cert }} /> Certificate
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: KIND_COLOR.key }} /> Key exchange
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: KIND_COLOR.finished }} /> Encrypted
        </span>
      </div>
    </div>
  );
}
