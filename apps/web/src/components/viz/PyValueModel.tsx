import { useMemo } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

/** A tiny model of Python "names bind to objects".
 *  Each step runs one statement and shows the resulting name -> object table,
 *  with each object's runtime type. Demonstrates dynamic typing + rebinding. */

type Obj = { value: string; type: string };
type Frame = {
  line: number;
  names: Record<string, Obj>;
  note: string;
  changed?: string;
};

const PROGRAM: { src: string; build: (env: Record<string, Obj>) => { obj: Obj; name: string; note: string } }[] = [
  { src: 'x = 42', build: () => ({ name: 'x', obj: { value: '42', type: 'int' }, note: 'bind name x to an int object' }) },
  { src: 'y = x + 8', build: (e) => ({ name: 'y', obj: { value: String(Number(e.x.value) + 8), type: 'int' }, note: 'evaluate x + 8, bind result to y' }) },
  { src: 'x = "hi"', build: () => ({ name: 'x', obj: { value: '"hi"', type: 'str' }, note: 'rebind x — same name, different type (dynamic typing)' }) },
  { src: 'pi = 3.14', build: () => ({ name: 'pi', obj: { value: '3.14', type: 'float' }, note: 'a float literal' }) },
  { src: 'ok = pi > 3', build: (e) => ({ name: 'ok', obj: { value: Number(e.pi.value) > 3 ? 'True' : 'False', type: 'bool' }, note: 'comparison yields a bool' }) },
  { src: 'nums = [y, pi]', build: (e) => ({ name: 'nums', obj: { value: `[${e.y.value}, ${e.pi.value}]`, type: 'list' }, note: 'a list collects two existing objects' }) },
];

function buildFrames(): Frame[] {
  const env: Record<string, Obj> = {};
  const frames: Frame[] = [{ line: -1, names: {}, note: 'empty namespace — no names bound yet' }];
  PROGRAM.forEach((stmt, i) => {
    const { name, obj, note } = stmt.build(env);
    env[name] = obj;
    frames.push({ line: i, names: { ...env }, note, changed: name });
  });
  return frames;
}

const typeColor: Record<string, string> = {
  int: '#38bdf8',
  float: '#8b5cf6',
  str: '#10b981',
  bool: '#fbbf24',
  list: '#f43f5e',
};

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function PyValueModel() {
  const frames = useMemo(buildFrames, []);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 4);
  const frame = frames[Math.min(index, frames.length - 1)];
  const entries = Object.entries(frame.names);

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Source program */}
        <div>
          <div className="mb-2 font-mono text-xs text-muted">program</div>
          <pre className="overflow-x-auto rounded border border-edge bg-bg p-3 font-mono text-sm leading-relaxed">
            {PROGRAM.map((stmt, i) => (
              <div
                key={i}
                className={`-mx-1 rounded px-1 ${frame.line === i ? 'bg-accent/15 text-accent' : 'text-fg'}`}
              >
                <span className="select-none text-muted">{String(i + 1).padStart(2, ' ')} </span>
                {stmt.src}
              </div>
            ))}
          </pre>
        </div>

        {/* Namespace table */}
        <div>
          <div className="mb-2 font-mono text-xs text-muted">namespace (name to object)</div>
          <div className="space-y-1.5">
            {entries.length === 0 && <div className="font-mono text-xs text-muted/60">empty</div>}
            {entries.map(([name, obj]) => {
              const hot = frame.changed === name;
              return (
                <div
                  key={name}
                  className={`flex items-center gap-2 rounded border px-2 py-1.5 font-mono text-sm transition ${hot ? 'border-accent bg-accent/5' : 'border-edge'}`}
                >
                  <span className="w-12 shrink-0 text-fg">{name}</span>
                  <Icon name="arrow-right" size={14} className="shrink-0 text-muted" />
                  <span className="flex-1 truncate text-fg">{obj.value}</span>
                  <span
                    className="shrink-0 rounded px-1.5 py-0.5 text-xs"
                    style={{ color: typeColor[obj.type] ?? 'var(--accent)', border: `1px solid ${typeColor[obj.type] ?? 'var(--accent)'}` }}
                  >
                    {obj.type}
                  </span>
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
