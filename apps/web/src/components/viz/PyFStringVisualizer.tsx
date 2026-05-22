import { useMemo } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

/** Walks an f-string left to right, resolving each {expr} placeholder against a
 *  small namespace and substituting its value into the output. */

const ENV: Record<string, string> = { name: 'Ada', year: '1843', n: '7' };

type Seg =
  | { kind: 'text'; text: string }
  | { kind: 'expr'; expr: string; spec?: string; value: string };

// Pre-computed segments of: f"{name} wrote note {n:03} in {year}!"
const SEGMENTS: Seg[] = [
  { kind: 'expr', expr: 'name', value: ENV.name },
  { kind: 'text', text: ' wrote note ' },
  { kind: 'expr', expr: 'n', spec: '03', value: String(Number(ENV.n)).padStart(3, '0') },
  { kind: 'text', text: ' in ' },
  { kind: 'expr', expr: 'year', value: ENV.year },
  { kind: 'text', text: '!' },
];

type Frame = { upto: number; active: number; note: string };

function buildFrames(): Frame[] {
  const frames: Frame[] = [{ upto: 0, active: -1, note: 'the f-prefix tells Python to evaluate {...} placeholders' }];
  SEGMENTS.forEach((seg, i) => {
    if (seg.kind === 'text') {
      frames.push({ upto: i + 1, active: i, note: `literal text copied as-is: "${seg.text}"` });
    } else {
      frames.push({ upto: i, active: i, note: `look up ${seg.expr} -> ${seg.value}${seg.spec ? `, apply format spec :${seg.spec}` : ''}` });
      frames.push({ upto: i + 1, active: i, note: `insert ${JSON.stringify(seg.value)} into the output` });
    }
  });
  frames.push({ upto: SEGMENTS.length, active: -1, note: 'finished — the result is an ordinary str' });
  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

function renderTemplate(active: number) {
  // Render the literal source f-string, highlighting the active segment.
  return (
    <>
      <span className="text-muted">f"</span>
      {SEGMENTS.map((seg, i) => {
        const hot = i === active;
        if (seg.kind === 'text') {
          return (
            <span key={i} className={hot ? 'rounded bg-accent/15 text-accent' : 'text-fg'}>
              {seg.text}
            </span>
          );
        }
        return (
          <span key={i} className={hot ? 'rounded bg-accent/20 text-accent' : 'text-[var(--accent)]'}>
            {'{'}
            {seg.expr}
            {seg.spec ? `:${seg.spec}` : ''}
            {'}'}
          </span>
        );
      })}
      <span className="text-muted">"</span>
    </>
  );
}

export default function PyFStringVisualizer() {
  const frames = useMemo(buildFrames, []);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 4);
  const frame = frames[Math.min(index, frames.length - 1)];

  const output = SEGMENTS.slice(0, frame.upto).map((s) => (s.kind === 'text' ? s.text : s.value)).join('');

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3">
        <div className="mb-2 font-mono text-xs text-muted">namespace</div>
        <div className="flex flex-wrap gap-2 font-mono text-xs">
          {Object.entries(ENV).map(([k, v]) => (
            <span key={k} className="rounded border border-edge px-2 py-1 text-fg">
              {k} = {v}
            </span>
          ))}
        </div>
      </div>

      <div className="mb-2 font-mono text-xs text-muted">template</div>
      <pre className="overflow-x-auto rounded border border-edge bg-bg p-3 font-mono text-base">{renderTemplate(frame.active)}</pre>

      <div className="mb-2 mt-4 font-mono text-xs text-muted">output str</div>
      <div className="min-h-10 rounded border border-edge bg-bg p-3 font-mono text-base text-emerald-300">
        {output}
        <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-emerald-400 align-middle" />
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
          <input type="range" min={1} max={12} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input type="range" min={0} max={Math.max(frames.length - 1, 0)} value={index} onChange={(e) => seek(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Timeline" />
        <span className="shrink-0 font-mono text-xs text-muted">{index + 1}/{frames.length}</span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">{frame.note}</div>
    </div>
  );
}
