import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

type Mode = 'build' | 'index';

type SFrame = {
  chars: string[]; // current contents shown
  active?: number; // index of interest
  fresh?: boolean; // whole buffer is a freshly allocated copy
  cost: string;
  note: string;
};

/** Immutable concatenation: result += ch builds a brand-new buffer each time,
 *  copying everything that came before, so building length n is O(n^2). */
function buildFrames(word: string): SFrame[] {
  const frames: SFrame[] = [{ chars: [], cost: '—', note: 'start with an empty string ""' }];
  let acc: string[] = [];
  for (let i = 0; i < word.length; i++) {
    const copy = [...acc]; // the existing characters get copied
    copy.push(word[i]);
    acc = copy;
    frames.push({
      chars: [...acc],
      active: acc.length - 1,
      fresh: true,
      cost: `O(${acc.length})`,
      note: `result + "${word[i]}" allocates a new ${acc.length}-char string and copies ${acc.length - 1}`,
    });
  }
  frames.push({
    chars: [...acc],
    cost: '—',
    note: `done — total work was O(n²); a mutable buffer would be O(n)`,
  });
  return frames;
}

/** Indexing is direct address arithmetic: s[k] is one O(1) memory read. */
function indexFrames(word: string): SFrame[] {
  const chars = word.split('');
  const frames: SFrame[] = [{ chars, cost: '—', note: 'characters are stored contiguously' }];
  for (let i = 0; i < chars.length; i++) {
    frames.push({
      chars,
      active: i,
      cost: 'O(1)',
      note: `s[${i}] = base + ${i} → '${chars[i]}' (one read, no scan)`,
    });
  }
  return frames;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function StringVisualizer() {
  const [mode, setMode] = useState<Mode>('build');
  const [word, setWord] = useState('HELLO');

  const frames = useMemo(
    () => (mode === 'build' ? buildFrames(word) : indexFrames(word)),
    [mode, word],
  );
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(
    frames.length,
    4,
  );
  const frame = frames[Math.min(index, frames.length - 1)] ?? { chars: [], cost: '—', note: '' };

  const onWord = (v: string) => {
    // Keep it short and printable so the cells stay readable.
    setWord(v.replace(/\s/g, '').slice(0, 12));
  };

  const cellCls = (i: number): string => {
    if (frame.active === i) {
      if (mode === 'build') return 'border-accent text-accent';
      return 'border-emerald-500 text-emerald-300';
    }
    if (mode === 'build' && frame.fresh) return 'border-violet-500/60 text-fg';
    return 'border-edge text-fg';
  };

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded border border-edge">
          {(
            [
              { id: 'build', label: 'Build (concat)' },
              { id: 'index', label: 'Index s[k]' },
            ] as { id: Mode; label: string }[]
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              aria-pressed={mode === m.id}
              className={`px-3 py-1 text-sm transition ${mode === m.id ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          Text
          <input
            value={word}
            onChange={(e) => onWord(e.target.value)}
            className="w-32 rounded border border-edge bg-bg px-2 py-1 font-mono text-fg"
          />
        </label>
      </div>

      <div className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-edge bg-bg/40 p-4">
        <div className="flex flex-wrap items-end justify-center gap-1.5">
          {frame.chars.length === 0 && <span className="font-mono text-muted">""</span>}
          {frame.chars.map((c, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className={`flex h-12 w-10 items-center justify-center rounded border font-mono text-lg transition-colors ${cellCls(i)}`}
              >
                {c}
              </div>
              <span className="font-mono text-[10px] text-muted/70">{i}</span>
            </div>
          ))}
        </div>
        {mode === 'build' && frame.fresh && (
          <span className="font-mono text-[11px] text-violet-300">newly allocated buffer</span>
        )}
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
          <input
            type="range"
            min={1}
            max={20}
            value={fps}
            onChange={(e) => setFps(Number(e.target.value))}
            className="accent-[var(--accent)]"
          />
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

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">
        length {frame.chars.length} · cost {frame.cost} · {frame.note}
      </div>
    </div>
  );
}
