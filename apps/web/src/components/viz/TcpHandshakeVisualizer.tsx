import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

type Side = 'client' | 'server';
type Kind = 'syn' | 'syn-ack' | 'ack' | 'data' | 'data-ack' | 'rst';

// A message drawn as an arrow between the two lifelines.
type Msg = {
  from: Side;
  label: string;
  kind: Kind;
  dropped?: boolean; // crosses out mid-flight, never reaches the far side
};

type Frame = {
  drawn: number; // how many messages are fully drawn
  inFlight: Msg | null; // arrow currently animating (drawn but emphasized)
  clientState: string;
  serverState: string;
  note: string;
};

function buildMessages(dropDataPacket: boolean): Msg[] {
  const msgs: Msg[] = [
    { from: 'client', label: 'SYN  seq=x', kind: 'syn' },
    { from: 'server', label: 'SYN-ACK  seq=y, ack=x+1', kind: 'syn-ack' },
    { from: 'client', label: 'ACK  ack=y+1', kind: 'ack' },
  ];
  // Data transfer phase.
  if (dropDataPacket) {
    msgs.push({ from: 'client', label: 'DATA  seq=1 (lost)', kind: 'data', dropped: true });
    msgs.push({ from: 'client', label: 'DATA  seq=1 (retransmit)', kind: 'data' });
    msgs.push({ from: 'server', label: 'ACK  ack=2', kind: 'data-ack' });
  } else {
    msgs.push({ from: 'client', label: 'DATA  seq=1', kind: 'data' });
    msgs.push({ from: 'server', label: 'ACK  ack=2', kind: 'data-ack' });
    msgs.push({ from: 'client', label: 'DATA  seq=2', kind: 'data' });
    msgs.push({ from: 'server', label: 'ACK  ack=3', kind: 'data-ack' });
  }
  return msgs;
}

function buildFrames(msgs: Msg[]): Frame[] {
  const frames: Frame[] = [];
  let clientState = 'CLOSED';
  let serverState = 'LISTEN';

  frames.push({
    drawn: 0,
    inFlight: null,
    clientState,
    serverState,
    note: 'Server is LISTENing on a port. Client is CLOSED, about to open a connection.',
  });

  msgs.forEach((m, i) => {
    // State transitions modelled at the moment each segment is sent / received.
    let note = '';
    switch (m.kind) {
      case 'syn':
        clientState = 'SYN-SENT';
        note = 'Client sends SYN with an initial sequence number x and moves to SYN-SENT.';
        break;
      case 'syn-ack':
        serverState = 'SYN-RCVD';
        note = 'Server replies SYN-ACK: acknowledges x+1 and sends its own seq y. Server is SYN-RCVD.';
        break;
      case 'ack':
        clientState = 'ESTABLISHED';
        serverState = 'ESTABLISHED';
        note = 'Client ACKs y+1. Both ends are now ESTABLISHED — the handshake is complete.';
        break;
      case 'data':
        note = m.dropped
          ? 'Client sends a data segment, but it is lost in the network (no ACK will arrive).'
          : 'Client sends a data segment carrying application bytes.';
        break;
      case 'data-ack':
        note = 'Server acknowledges the received bytes, advancing the ack number.';
        break;
      case 'rst':
        note = 'Reset.';
        break;
    }
    // A retransmit follows a dropped packet, after a timeout.
    if (msgs[i - 1]?.dropped) {
      note = 'No ACK arrived before the retransmission timeout — the client resends the segment.';
    }

    frames.push({
      drawn: i + 1,
      inFlight: m,
      clientState,
      serverState,
      note,
    });
  });

  frames.push({
    drawn: msgs.length,
    inFlight: null,
    clientState,
    serverState,
    note: 'Transfer complete. (Closing uses a separate FIN/ACK exchange.)',
  });

  return frames;
}

const KIND_COLOR: Record<Kind, string> = {
  syn: '#38bdf8',
  'syn-ack': '#8b5cf6',
  ack: '#10b981',
  data: '#fbbf24',
  'data-ack': '#10b981',
  rst: '#f43f5e',
};

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

// Geometry for the SVG sequence diagram.
const CLIENT_X = 110;
const SERVER_X = 470;
const TOP = 64;
const ROW = 48;

export default function TcpHandshakeVisualizer() {
  const [dropDataPacket, setDropDataPacket] = useState(true);

  const msgs = useMemo(() => buildMessages(dropDataPacket), [dropDataPacket]);
  const frames = useMemo(() => buildFrames(msgs), [msgs]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 2);
  const frame = frames[Math.min(index, frames.length - 1)] ?? frames[0];

  const height = TOP + msgs.length * ROW + 40;
  const width = 580;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={dropDataPacket}
            onChange={(e) => setDropDataPacket(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          Drop a data packet (show retransmit)
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-edge bg-bg/40">
        <svg width={width} height={height} className="mx-auto block" role="img" aria-label="TCP sequence diagram">
          {/* Lifelines */}
          {([
            { x: CLIENT_X, label: 'CLIENT', state: frame.clientState },
            { x: SERVER_X, label: 'SERVER', state: frame.serverState },
          ] as const).map((c) => (
            <g key={c.label}>
              <rect x={c.x - 52} y={16} width={104} height={30} rx={6} style={{ fill: 'var(--surface)', stroke: 'var(--accent)' }} strokeWidth={2} />
              <text x={c.x} y={31} textAnchor="middle" dominantBaseline="central" fontSize={13} style={{ fill: 'var(--fg)', fontFamily: 'var(--font-mono)' }}>
                {c.label}
              </text>
              <line x1={c.x} y1={46} x2={c.x} y2={height - 16} style={{ stroke: 'var(--border)' }} strokeWidth={2} strokeDasharray="4 4" />
              <rect x={c.x - 56} y={height - 30} width={112} height={20} rx={4} style={{ fill: 'var(--bg)', stroke: 'var(--border)' }} strokeWidth={1} />
              <text x={c.x} y={height - 20} textAnchor="middle" dominantBaseline="central" fontSize={11} style={{ fill: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                {c.state}
              </text>
            </g>
          ))}

          {/* Messages drawn so far */}
          {msgs.map((m, i) => {
            if (i >= frame.drawn) return null;
            const y = TOP + i * ROW;
            const leftToRight = m.from === 'client';
            const x1 = leftToRight ? CLIENT_X : SERVER_X;
            // dropped packets only travel ~60% of the way before being lost
            const fullX2 = leftToRight ? SERVER_X : CLIENT_X;
            const x2 = m.dropped ? x1 + (fullX2 - x1) * 0.6 : fullX2;
            const color = KIND_COLOR[m.kind];
            const isActive = frame.inFlight === m;
            const midX = (x1 + x2) / 2;
            return (
              <g key={i} opacity={isActive ? 1 : 0.55}>
                <line
                  x1={x1}
                  y1={y}
                  x2={x2}
                  y2={y + (m.dropped ? 14 : 16)}
                  style={{ stroke: color }}
                  strokeWidth={isActive ? 3 : 2}
                  markerEnd={m.dropped ? undefined : `url(#arrow-${i})`}
                />
                <defs>
                  <marker id={`arrow-${i}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
                  </marker>
                </defs>
                {m.dropped && (
                  <g>
                    {/* an X marking where the packet was lost */}
                    <line x1={x2 - 6} y1={y + 8} x2={x2 + 6} y2={y + 20} style={{ stroke: '#f43f5e' }} strokeWidth={2.5} />
                    <line x1={x2 + 6} y1={y + 8} x2={x2 - 6} y2={y + 20} style={{ stroke: '#f43f5e' }} strokeWidth={2.5} />
                  </g>
                )}
                <text
                  x={midX}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize={11}
                  style={{ fill: isActive ? 'var(--fg)' : 'var(--muted)', fontFamily: 'var(--font-mono)' }}
                >
                  {m.label}
                </text>
              </g>
            );
          })}
        </svg>
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

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: KIND_COLOR.syn }} /> SYN
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: KIND_COLOR['syn-ack'] }} /> SYN-ACK
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: KIND_COLOR.ack }} /> ACK
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: KIND_COLOR.data }} /> DATA
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: '#f43f5e' }} /> lost
        </span>
      </div>
    </div>
  );
}
