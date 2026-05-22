import { useMemo } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

/** Visualizes the call stack and LEGB name resolution. As functions are
 *  called, frames are pushed; a name lookup walks Local -> Enclosing ->
 *  Global -> Built-in until it finds a binding. */

type Frame = {
  stack: { fn: string; names: Record<string, string> }[];
  lookup?: { name: string; tried: ('L' | 'E' | 'G' | 'B')[]; foundIn?: 'L' | 'E' | 'G' | 'B'; value?: string };
  note: string;
};

// Program being traced:
//   base = 10                      # Global
//   def outer(x):                  # x is Enclosing for inner
//       def inner():
//           return x + base + len("ab")   # x: E, base: G, len: B
//       return inner()
//   outer(5)
function buildFrames(): Frame[] {
  const G = { base: '10', outer: '<fn>' };
  const frames: Frame[] = [];

  frames.push({ stack: [{ fn: 'global', names: { ...G } }], note: 'module loads — base and outer live in the Global scope' });
  frames.push({ stack: [{ fn: 'global', names: { ...G } }], note: 'call outer(5) — push a new frame' });
  frames.push({ stack: [{ fn: 'global', names: { ...G } }, { fn: 'outer', names: { x: '5', inner: '<fn>' } }], note: 'inside outer: x = 5, inner defined here' });
  frames.push({ stack: [{ fn: 'global', names: { ...G } }, { fn: 'outer', names: { x: '5', inner: '<fn>' } }, { fn: 'inner', names: {} }], note: 'call inner() — push another frame (its Local scope is empty)' });

  // resolve x  (E)
  frames.push({
    stack: [{ fn: 'global', names: { ...G } }, { fn: 'outer', names: { x: '5', inner: '<fn>' } }, { fn: 'inner', names: {} }],
    lookup: { name: 'x', tried: ['L'] },
    note: 'resolve x — not in Local (inner) ...',
  });
  frames.push({
    stack: [{ fn: 'global', names: { ...G } }, { fn: 'outer', names: { x: '5', inner: '<fn>' } }, { fn: 'inner', names: {} }],
    lookup: { name: 'x', tried: ['L', 'E'], foundIn: 'E', value: '5' },
    note: 'found x = 5 in the Enclosing scope (outer)',
  });

  // resolve base (G)
  frames.push({
    stack: [{ fn: 'global', names: { ...G } }, { fn: 'outer', names: { x: '5', inner: '<fn>' } }, { fn: 'inner', names: {} }],
    lookup: { name: 'base', tried: ['L', 'E'] },
    note: 'resolve base — not in Local, not in Enclosing ...',
  });
  frames.push({
    stack: [{ fn: 'global', names: { ...G } }, { fn: 'outer', names: { x: '5', inner: '<fn>' } }, { fn: 'inner', names: {} }],
    lookup: { name: 'base', tried: ['L', 'E', 'G'], foundIn: 'G', value: '10' },
    note: 'found base = 10 in the Global scope',
  });

  // resolve len (B)
  frames.push({
    stack: [{ fn: 'global', names: { ...G } }, { fn: 'outer', names: { x: '5', inner: '<fn>' } }, { fn: 'inner', names: {} }],
    lookup: { name: 'len', tried: ['L', 'E', 'G', 'B'], foundIn: 'B', value: '<builtin>' },
    note: 'len is not user-defined — found in Built-ins. Result: 5 + 10 + 2 = 17',
  });

  // unwind
  frames.push({ stack: [{ fn: 'global', names: { ...G } }, { fn: 'outer', names: { x: '5', inner: '<fn>' } }], note: 'inner returns 17 — its frame is popped' });
  frames.push({ stack: [{ fn: 'global', names: { ...G } }], note: 'outer returns 17 — back to the global frame' });

  return frames;
}

const LEGB_LABEL: Record<string, string> = { L: 'Local', E: 'Enclosing', G: 'Global', B: 'Built-in' };

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function PyScopeVisualizer() {
  const frames = useMemo(buildFrames, []);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 3);
  const frame = frames[Math.min(index, frames.length - 1)];

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Call stack */}
        <div>
          <div className="mb-2 font-mono text-xs text-muted">call stack (top = current)</div>
          <div className="flex flex-col-reverse gap-1.5">
            {frame.stack.map((f, i) => {
              const isTop = i === frame.stack.length - 1;
              return (
                <div key={i} className={`rounded border px-3 py-2 ${isTop ? 'border-accent bg-accent/5' : 'border-edge'}`}>
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className={isTop ? 'text-accent' : 'text-muted'}>{f.fn}()</span>
                    <span className="text-muted">{isTop ? 'running' : 'paused'}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {Object.keys(f.names).length === 0 && <span className="font-mono text-[11px] text-muted/40">no locals</span>}
                    {Object.entries(f.names).map(([k, v]) => (
                      <span key={k} className="rounded border border-edge px-1.5 py-0.5 font-mono text-[11px] text-fg">
                        {k}={v}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* LEGB ladder */}
        <div>
          <div className="mb-2 font-mono text-xs text-muted">
            LEGB lookup{frame.lookup ? `: ${frame.lookup.name}` : ''}
          </div>
          <div className="space-y-1.5">
            {(['L', 'E', 'G', 'B'] as const).map((k) => {
              const tried = frame.lookup?.tried.includes(k);
              const found = frame.lookup?.foundIn === k;
              const cls = found
                ? 'border-emerald-500 bg-emerald-500/5 text-emerald-300'
                : tried
                ? 'border-amber-400 text-amber-300'
                : 'border-edge text-muted';
              return (
                <div key={k} className={`flex items-center gap-2 rounded border px-3 py-2 font-mono text-sm transition ${cls}`}>
                  <span className="w-6 shrink-0 font-bold">{k}</span>
                  <span className="flex-1">{LEGB_LABEL[k]}</span>
                  {found ? (
                    <span className="flex items-center gap-1 text-xs">
                      <Icon name="check" size={14} /> {frame.lookup?.value}
                    </span>
                  ) : tried ? (
                    <span className="text-xs">miss</span>
                  ) : null}
                </div>
              );
            })}
          </div>
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
