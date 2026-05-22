import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

/** Method Resolution Order walk over a classic diamond:
 *      A
 *     / \
 *    B   C
 *     \ /
 *      D
 *  Python uses C3 linearization: D -> B -> C -> A -> object. Attribute lookup
 *  on an instance checks the instance dict, then walks this MRO left to right. */

type ClassDef = { name: string; defines: string[]; bases: string[] };

const CLASSES: Record<string, ClassDef> = {
  A: { name: 'A', defines: ['greet', 'name'], bases: ['object'] },
  B: { name: 'B', defines: ['greet'], bases: ['A'] },
  C: { name: 'C', defines: ['ping'], bases: ['A'] },
  D: { name: 'D', defines: [], bases: ['B', 'C'] },
  object: { name: 'object', defines: ['__init__'], bases: [] },
};

const MRO = ['D', 'B', 'C', 'A', 'object'];

type Frame = {
  probe: number; // index into MRO currently inspected, -1 = instance
  found?: string;
  note: string;
};

function buildFrames(attr: string): Frame[] {
  const frames: Frame[] = [];
  frames.push({ probe: -1, note: `d.${attr} — first check the instance __dict__ (empty here)` });
  for (let i = 0; i < MRO.length; i++) {
    const cls = MRO[i];
    const has = CLASSES[cls].defines.includes(attr);
    frames.push({
      probe: i,
      found: has ? cls : undefined,
      note: has ? `found ${attr} in class ${cls} — stop` : `${attr} not in ${cls} — try next in the MRO`,
    });
    if (has) break;
  }
  const everFound = frames.some((f) => f.found);
  if (!everFound) frames.push({ probe: MRO.length, note: `${attr} found nowhere — raises AttributeError` });
  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function PyMroVisualizer() {
  const [attr, setAttr] = useState('greet');
  const frames = useMemo(() => buildFrames(attr), [attr]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 3);
  const frame = frames[Math.min(index, frames.length - 1)];

  const attrs = ['greet', 'ping', 'name', '__init__', 'missing'];

  const nodeCls = (cls: string) => {
    const idx = MRO.indexOf(cls);
    if (frame.found === cls) return 'border-emerald-500 bg-emerald-500/10 text-emerald-300';
    if (frame.probe === idx && frame.probe >= 0) return 'border-amber-400 bg-amber-400/10 text-amber-300';
    return 'border-edge text-fg';
  };

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">look up d.</span>
        {attrs.map((a) => (
          <button key={a} type="button" className={`${btn} font-mono ${attr === a ? 'border-accent text-accent' : ''}`} onClick={() => setAttr(a)}>
            {a}
          </button>
        ))}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Inheritance diamond */}
        <div>
          <div className="mb-2 font-mono text-xs text-muted">class hierarchy</div>
          <div className="flex flex-col items-center gap-2 py-2">
            <ClassBox cls="A" cls2={nodeCls('A')} />
            <div className="flex w-full items-center justify-center gap-2 text-muted">
              <Icon name="arrow-up" size={16} />
              <span className="text-[10px]">inherits</span>
              <Icon name="arrow-up" size={16} />
            </div>
            <div className="flex w-full justify-center gap-8">
              <ClassBox cls="B" cls2={nodeCls('B')} />
              <ClassBox cls="C" cls2={nodeCls('C')} />
            </div>
            <Icon name="arrow-up" size={16} className="text-muted" />
            <ClassBox cls="D" cls2={nodeCls('D')} />
            <div className="mt-1 font-mono text-[11px] text-muted">d = D() · instance __dict__: {'{}'}</div>
          </div>
        </div>

        {/* MRO ladder */}
        <div>
          <div className="mb-2 font-mono text-xs text-muted">D.__mro__ (C3 linearization)</div>
          <div className="space-y-1.5">
            <div className={`rounded border px-3 py-2 font-mono text-sm ${frame.probe === -1 ? 'border-amber-400 text-amber-300' : 'border-edge text-muted'}`}>
              instance __dict__ {'{}'}
            </div>
            {MRO.map((cls, i) => {
              const found = frame.found === cls;
              const active = frame.probe === i;
              const cls2 = found ? 'border-emerald-500 text-emerald-300' : active ? 'border-amber-400 text-amber-300' : 'border-edge text-fg';
              return (
                <div key={cls} className={`flex items-center gap-2 rounded border px-3 py-2 font-mono text-sm transition ${cls2}`}>
                  <span className="w-5 text-muted">{i}</span>
                  <span className="flex-1">{cls}</span>
                  <span className="text-xs text-muted">{CLASSES[cls].defines.join(', ') || '—'}</span>
                  {found && <Icon name="check" size={14} className="text-emerald-300" />}
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

function ClassBox({ cls, cls2 }: { cls: string; cls2: string }) {
  const def = CLASSES[cls];
  return (
    <div className={`min-w-24 rounded border px-3 py-2 text-center transition ${cls2}`}>
      <div className="font-mono text-sm font-medium">{cls}</div>
      <div className="font-mono text-[10px] text-muted">{def.defines.join(', ') || 'no attrs'}</div>
    </div>
  );
}
