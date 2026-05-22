import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const TICKS = 48;
const CAP = 8; // queue buffer capacity

type MQFrame = {
  /** Messages waiting in the queue at this tick. */
  queue: number;
  /** Did the producer enqueue this tick? */
  produced: boolean;
  /** Did the consumer dequeue this tick? */
  consumed: boolean;
  /** Was an incoming message dropped because the buffer was full? */
  dropped: boolean;
  producedTotal: number;
  consumedTotal: number;
  droppedTotal: number;
  t: number;
};

/**
 * Simulate a producer faster than a consumer with a bounded buffer between them.
 * `prodRate`/`consRate` are messages per tick (0..1 chance each tick). When the
 * queue is full an incoming message is dropped (backpressure as loss).
 */
function buildFrames(prodRate: number, consRate: number, cap: number): MQFrame[] {
  let queue = 0;
  let producedTotal = 0;
  let consumedTotal = 0;
  let droppedTotal = 0;
  // Deterministic phase so production/consumption are reproducible and visibly steady.
  let pAcc = 0;
  let cAcc = 0;

  const frames: MQFrame[] = [
    { queue, produced: false, consumed: false, dropped: false, producedTotal, consumedTotal, droppedTotal, t: 0 },
  ];

  for (let i = 1; i <= TICKS; i++) {
    // Consumer drains first (a slot it frees can be reused this tick).
    let consumed = false;
    cAcc += consRate;
    if (cAcc >= 1 && queue > 0) {
      cAcc -= 1;
      queue -= 1;
      consumed = true;
      consumedTotal += 1;
    }

    // Producer offers a message.
    let produced = false;
    let dropped = false;
    pAcc += prodRate;
    if (pAcc >= 1) {
      pAcc -= 1;
      if (queue < cap) {
        queue += 1;
        produced = true;
        producedTotal += 1;
      } else {
        dropped = true;
        droppedTotal += 1;
      }
    }

    frames.push({ queue, produced, consumed, dropped, producedTotal, consumedTotal, droppedTotal, t: i });
  }
  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const EMPTY: MQFrame = {
  queue: 0, produced: false, consumed: false, dropped: false,
  producedTotal: 0, consumedTotal: 0, droppedTotal: 0, t: 0,
};

export default function MessageQueueVisualizer() {
  const [prodRate, setProdRate] = useState(0.8); // fast producer
  const [consRate, setConsRate] = useState(0.4); // slower consumer

  const frames = useMemo(() => buildFrames(prodRate, consRate, CAP), [prodRate, consRate]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 6);
  const frame = frames[Math.min(index, frames.length - 1)] ?? EMPTY;

  const fillPct = (frame.queue / CAP) * 100;
  const nearFull = frame.queue >= CAP - 1;

  // Slot color: violet for buffered messages.
  const slots = Array.from({ length: CAP }, (_, i) => i < frame.queue);

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        <label className="flex items-center gap-2 text-sm text-muted">
          Producer {prodRate.toFixed(1)}/tick
          <input
            type="range" min={1} max={10} value={Math.round(prodRate * 10)}
            onChange={(e) => setProdRate(Number(e.target.value) / 10)}
            className="accent-[var(--accent)]"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          Consumer {consRate.toFixed(1)}/tick
          <input
            type="range" min={1} max={10} value={Math.round(consRate * 10)}
            onChange={(e) => setConsRate(Number(e.target.value) / 10)}
            className="accent-[var(--accent)]"
          />
        </label>
      </div>

      {/* pipeline: producer -> queue -> consumer */}
      <div className="grid items-center gap-3 sm:grid-cols-[auto_1fr_auto]">
        {/* producer */}
        <div
          className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-3 transition ${
            frame.produced ? 'border-[#8b5cf6] bg-[#8b5cf6]/10' : frame.dropped ? 'border-rose-500 bg-rose-500/10' : 'border-edge'
          }`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full text-[#0c0a1f]" style={{ background: '#8b5cf6' }}>
            <Icon name="zap" size={18} />
          </div>
          <div className="text-xs text-fg">Producer</div>
          <div className="font-mono text-[10px] text-muted">{frame.producedTotal} sent</div>
        </div>

        {/* queue buffer */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between font-mono text-xs text-muted">
            <span>queue</span>
            <span className={nearFull ? 'text-amber-400' : 'text-fg'}>
              {frame.queue} / {CAP}
            </span>
          </div>
          <div
            className={`flex gap-1 rounded-lg border bg-bg p-2 transition ${
              frame.queue >= CAP ? 'border-rose-500' : nearFull ? 'border-amber-400' : 'border-edge'
            }`}
          >
            {slots.map((filled, i) => (
              <div
                key={i}
                className="h-7 flex-1 rounded transition-colors duration-150"
                style={{
                  background: filled ? '#8b5cf6' : 'var(--surface)',
                  opacity: filled ? 0.85 : 1,
                  border: filled ? 'none' : '1px dashed var(--border)',
                }}
              />
            ))}
          </div>
          <div className="h-2 rounded-full bg-bg" aria-hidden>
            <div
              className="h-2 rounded-full transition-[width] duration-150"
              style={{ width: `${fillPct}%`, background: frame.queue >= CAP ? '#f43f5e' : nearFull ? '#fbbf24' : '#8b5cf6' }}
            />
          </div>
        </div>

        {/* consumer */}
        <div
          className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-3 transition ${
            frame.consumed ? 'border-emerald-500 bg-emerald-500/10' : 'border-edge'
          }`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full text-[#04140d]" style={{ background: '#10b981' }}>
            <Icon name="check" size={18} />
          </div>
          <div className="text-xs text-fg">Consumer</div>
          <div className="font-mono text-[10px] text-muted">{frame.consumedTotal} done</div>
        </div>
      </div>

      {/* status line */}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        {frame.dropped ? (
          <span className="inline-flex items-center gap-1.5 rounded border border-rose-500 bg-rose-500/10 px-2 py-1 text-rose-400">
            <Icon name="arrow-down" size={14} /> buffer full — message dropped
          </span>
        ) : frame.produced && !frame.consumed ? (
          <span className="text-muted">queue growing — producer outpaces consumer</span>
        ) : frame.consumed && !frame.produced ? (
          <span className="text-muted">queue draining — consumer catches up</span>
        ) : (
          <span className="text-muted">steady — enqueue and dequeue balanced</span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded border border-edge bg-bg p-2">
          <div className="font-mono text-lg" style={{ color: '#8b5cf6' }}>{frame.producedTotal}</div>
          <div className="text-xs text-muted">enqueued</div>
        </div>
        <div className="rounded border border-edge bg-bg p-2">
          <div className="font-mono text-lg text-emerald-400">{frame.consumedTotal}</div>
          <div className="text-xs text-muted">consumed</div>
        </div>
        <div className="rounded border border-edge bg-bg p-2">
          <div className="font-mono text-lg text-rose-400">{frame.droppedTotal}</div>
          <div className="text-xs text-muted">dropped</div>
        </div>
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
          <input type="range" min={1} max={20} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
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
        <span className="shrink-0 font-mono text-xs text-muted">t={frame.t}</span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">
        A queue absorbs short bursts. If the producer stays faster than the consumer, the buffer fills and overflows — that is backpressure showing up as drops.
      </div>
    </div>
  );
}
