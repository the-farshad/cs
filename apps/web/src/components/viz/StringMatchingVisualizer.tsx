import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const TEXT = 'ABABCABABABD';
const PATTERN = 'ABABD';

/** Build the KMP prefix function (failure table) for the pattern. */
function buildLps(p: string): number[] {
  const lps = new Array(p.length).fill(0);
  let len = 0;
  let i = 1;
  while (i < p.length) {
    if (p[i] === p[len]) {
      len++;
      lps[i] = len;
      i++;
    } else if (len > 0) {
      len = lps[len - 1];
    } else {
      lps[i] = 0;
      i++;
    }
  }
  return lps;
}

type Frame = {
  shift: number; // alignment of pattern start within text
  ti: number; // index in text being compared
  pi: number; // index in pattern being compared
  matched: boolean; // is the current char comparison a match?
  found: number; // start index of a full match found this step, -1 none
  note: string;
};

/** KMP search, recording a frame per character comparison + each jump. */
function kmpFrames(text: string, pat: string, lps: number[]): Frame[] {
  const frames: Frame[] = [];
  let i = 0; // text index
  let j = 0; // pattern index
  frames.push({ shift: 0, ti: 0, pi: 0, matched: false, found: -1, note: 'align pattern at text[0]; compare left to right' });
  while (i < text.length) {
    const match = text[i] === pat[j];
    frames.push({
      shift: i - j,
      ti: i,
      pi: j,
      matched: match,
      found: -1,
      note: match
        ? `text[${i}]='${text[i]}' = pattern[${j}]='${pat[j]}' — advance both`
        : `text[${i}]='${text[i]}' ≠ pattern[${j}]='${pat[j]}' — mismatch`,
    });
    if (match) {
      i++;
      j++;
      if (j === pat.length) {
        frames.push({
          shift: i - j,
          ti: i - 1,
          pi: j - 1,
          matched: true,
          found: i - j,
          note: `full match at index ${i - j}! jump pattern by lps to keep searching`,
        });
        j = lps[j - 1];
      }
    } else if (j > 0) {
      const nj = lps[j - 1];
      frames.push({
        shift: i - nj,
        ti: i,
        pi: nj,
        matched: false,
        found: -1,
        note: `failure table: jump pattern index ${j} → ${nj}; do NOT rescan text — i stays at ${i}`,
      });
      j = nj;
    } else {
      i++;
      frames.push({
        shift: i,
        ti: Math.min(i, text.length - 1),
        pi: 0,
        matched: false,
        found: -1,
        note: `pattern[0] mismatched — slide pattern one step right`,
      });
    }
  }
  frames.push({ shift: text.length, ti: text.length - 1, pi: 0, matched: false, found: -1, note: 'reached end of text — search complete' });
  return frames;
}

const cellBase = 'flex h-9 w-9 items-center justify-center rounded border font-mono text-sm';

export default function StringMatchingVisualizer() {
  const lps = useMemo(() => buildLps(PATTERN), []);
  const frames = useMemo(() => kmpFrames(TEXT, PATTERN, lps), [lps]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 3);
  const frame = frames[Math.min(index, frames.length - 1)] ?? frames[0];

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 text-sm text-muted">
        KMP slides the pattern under the text and uses a prefix table to skip
        re-checking characters it already matched.
      </div>

      {/* Text row */}
      <div className="flex flex-wrap gap-1">
        {TEXT.split('').map((ch, i) => {
          const isCompare = i === frame.ti;
          let cls = 'border-edge bg-bg text-fg';
          if (isCompare) cls = frame.matched ? 'border-[#10b981] text-fg' : 'border-[#f43f5e] text-fg';
          const bg =
            isCompare && frame.matched
              ? 'color-mix(in oklab, #10b981 22%, var(--bg))'
              : isCompare
                ? 'color-mix(in oklab, #f43f5e 22%, var(--bg))'
                : undefined;
          return (
            <div key={i} className={`${cellBase} ${cls}`} style={bg ? { background: bg } : undefined}>
              {ch}
            </div>
          );
        })}
      </div>
      <div className="mt-0.5 flex flex-wrap gap-1">
        {TEXT.split('').map((_, i) => (
          <div key={i} className="flex h-4 w-9 items-center justify-center font-mono text-[10px] text-muted">
            {i}
          </div>
        ))}
      </div>

      {/* Pattern row, offset by the current shift */}
      <div className="mt-2 flex gap-1" style={{ paddingLeft: `${frame.shift * 2.5}rem` }}>
        {PATTERN.split('').map((ch, j) => {
          const isCompare = j === frame.pi && frame.shift + j === frame.ti;
          let cls = 'border-accent text-accent';
          if (isCompare) cls = frame.matched ? 'border-[#10b981] text-fg' : 'border-[#f43f5e] text-fg';
          const bg =
            isCompare && frame.matched
              ? 'color-mix(in oklab, #10b981 22%, var(--surface))'
              : isCompare
                ? 'color-mix(in oklab, #f43f5e 22%, var(--surface))'
                : undefined;
          return (
            <div key={j} className={`${cellBase} ${cls}`} style={bg ? { background: bg } : undefined}>
              {ch}
            </div>
          );
        })}
      </div>

      {/* Prefix-function / failure table */}
      <div className="mt-5">
        <div className="mb-1 text-xs text-muted">prefix function (failure table) — lps[j]: length of the longest proper prefix that is also a suffix of pattern[0..j]</div>
        <div className="flex flex-wrap gap-1">
          {PATTERN.split('').map((ch, j) => {
            const hot = j === frame.pi;
            return (
              <div key={j} className="flex flex-col items-center gap-0.5">
                <div className={`${cellBase} ${hot ? 'border-accent bg-accent text-accent-fg' : 'border-edge bg-bg text-fg'}`}>{ch}</div>
                <div className={`flex h-7 w-9 items-center justify-center rounded border font-mono text-xs ${hot ? 'border-accent text-accent' : 'border-edge text-muted'}`}>
                  {lps[j]}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
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
          <input type="range" min={1} max={16} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
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
        <span style={frame.found >= 0 ? { color: '#10b981' } : undefined}>{frame.note}</span>
      </div>
    </div>
  );
}
