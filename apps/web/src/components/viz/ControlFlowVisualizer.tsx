import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

// A frame is one step of "execution": which source line is active, the variables
// in scope, the last exit status ($?), and a note explaining the decision made.
type Frame = {
  line: number; // 1-based index into the displayed source
  vars: Record<string, string>;
  status: number; // value of $? after the active line
  note: string;
  output: string[]; // accumulated echo output
};

type Program = { label: string; src: string[]; trace: (input: number) => Frame[] };

// --- Program 1: classify a number with if / [[ ]] and exit codes --------------
const SRC_CLASSIFY = [
  'n=$1',
  'if (( n < 0 )); then',
  '  echo "negative"',
  'elif (( n == 0 )); then',
  '  echo "zero"',
  'else',
  '  echo "positive"',
  'fi',
  'echo "done ($?)"',
];

function traceClassify(n: number): Frame[] {
  const out: string[] = [];
  const v = { n: String(n) };
  const f: Frame[] = [];
  f.push({ line: 1, vars: { ...v }, status: 0, note: `assign n=${n}; assignment succeeds → $?=0`, output: [...out] });
  f.push({ line: 2, vars: { ...v }, status: n < 0 ? 0 : 1, note: `test (( n < 0 )) → ${n < 0}`, output: [...out] });
  if (n < 0) {
    out.push('negative');
    f.push({ line: 3, vars: { ...v }, status: 0, note: 'branch taken: print "negative"', output: [...out] });
  } else {
    f.push({ line: 4, vars: { ...v }, status: n === 0 ? 0 : 1, note: `test (( n == 0 )) → ${n === 0}`, output: [...out] });
    if (n === 0) {
      out.push('zero');
      f.push({ line: 5, vars: { ...v }, status: 0, note: 'branch taken: print "zero"', output: [...out] });
    } else {
      f.push({ line: 6, vars: { ...v }, status: 0, note: 'no test matched → else', output: [...out] });
      out.push('positive');
      f.push({ line: 7, vars: { ...v }, status: 0, note: 'branch taken: print "positive"', output: [...out] });
    }
  }
  f.push({ line: 8, vars: { ...v }, status: 0, note: 'fi: end of conditional', output: [...out] });
  out.push('done (0)');
  f.push({ line: 9, vars: { ...v }, status: 0, note: 'print final line; $? from the last echo is 0', output: [...out] });
  return f;
}

// --- Program 2: a while loop accumulating with arithmetic ---------------------
const SRC_LOOP = [
  'i=1',
  'sum=0',
  'while (( i <= n )); do',
  '  sum=$(( sum + i ))',
  '  (( i++ ))',
  'done',
  'echo "sum=$sum"',
];

function traceLoop(n: number): Frame[] {
  const out: string[] = [];
  const f: Frame[] = [];
  let i = 1;
  let sum = 0;
  const snap = () => ({ n: String(n), i: String(i), sum: String(sum) });
  f.push({ line: 1, vars: snap(), status: 0, note: 'i=1', output: [...out] });
  f.push({ line: 2, vars: snap(), status: 0, note: 'sum=0', output: [...out] });
  while (true) {
    const cond = i <= n;
    f.push({ line: 3, vars: snap(), status: cond ? 0 : 1, note: `while (( ${i} <= ${n} )) → ${cond}`, output: [...out] });
    if (!cond) break;
    sum = sum + i;
    f.push({ line: 4, vars: snap(), status: 0, note: `sum = sum + i = ${sum}`, output: [...out] });
    i = i + 1;
    f.push({ line: 5, vars: snap(), status: 0, note: `i++ → ${i}`, output: [...out] });
    f.push({ line: 6, vars: snap(), status: 0, note: 'done: loop back to the test', output: [...out] });
  }
  out.push(`sum=${sum}`);
  f.push({ line: 7, vars: snap(), status: 0, note: `print sum=${sum}`, output: [...out] });
  return f;
}

// --- Program 3: case + a function returning an exit code, with && / || --------
const SRC_CASE = [
  'check() {',
  '  case "$1" in',
  '    *.txt) return 0 ;;',
  '    *.log) return 0 ;;',
  '    *)     return 1 ;;',
  '  esac',
  '}',
  'check "$f" && echo "ok: $f" || echo "skip: $f"',
];

function traceCase(kind: number): Frame[] {
  // kind: 0 -> a.txt (match), 1 -> run.log (match), 2 -> data.bin (no match)
  const f = ['a.txt', 'run.log', 'data.bin'][kind];
  const out: string[] = [];
  const fr: Frame[] = [];
  const v = { f };
  const ext = f.slice(f.lastIndexOf('.'));
  const matchLine = ext === '.txt' ? 3 : ext === '.log' ? 4 : 5;
  const ok = matchLine !== 5;
  fr.push({ line: 8, vars: { ...v }, status: 0, note: `call check "${f}"`, output: [...out] });
  fr.push({ line: 1, vars: { ...v }, status: 0, note: 'enter function check', output: [...out] });
  fr.push({ line: 2, vars: { ...v }, status: 0, note: `case "${f}" in — match patterns top to bottom`, output: [...out] });
  fr.push({
    line: matchLine,
    vars: { ...v },
    status: ok ? 0 : 1,
    note: ok ? `pattern ${ext === '.txt' ? '*.txt' : '*.log'} matches → return 0` : '*) catch-all matches → return 1',
    output: [...out],
  });
  fr.push({ line: 6, vars: { ...v }, status: ok ? 0 : 1, note: 'esac: end of case', output: [...out] });
  // && runs RHS only on success; || runs only on failure.
  if (ok) {
    out.push(`ok: ${f}`);
    fr.push({ line: 8, vars: { ...v }, status: 0, note: '$?=0 → && runs "echo ok"; || is skipped', output: [...out] });
  } else {
    out.push(`skip: ${f}`);
    fr.push({ line: 8, vars: { ...v }, status: 0, note: '$?=1 → && skipped; || runs "echo skip"', output: [...out] });
  }
  return fr;
}

const PROGRAMS: Program[] = [
  { label: 'if / elif / else', src: SRC_CLASSIFY, trace: traceClassify },
  { label: 'while loop', src: SRC_LOOP, trace: traceLoop },
  { label: 'case + function && ||', src: SRC_CASE, trace: traceCase },
];

// Per-program input controls.
const INPUTS: { values: number[]; render: (v: number) => string }[] = [
  { values: [-3, 0, 5], render: (v) => `n=${v}` },
  { values: [0, 3, 5], render: (v) => `n=${v}` },
  { values: [0, 1, 2], render: (v) => `f=${['a.txt', 'run.log', 'data.bin'][v]}` },
];

export default function ControlFlowVisualizer() {
  const [progIdx, setProgIdx] = useState(0);
  const [inputVal, setInputVal] = useState(PROGRAMS[0] ? INPUTS[0].values[0] : 0);
  const prog = PROGRAMS[progIdx];

  const frames = useMemo<Frame[]>(() => prog.trace(inputVal), [prog, inputVal]);
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 2);
  const frame = frames[Math.min(index, frames.length - 1)] ?? frames[0];

  const selectProg = (idx: number) => {
    setProgIdx(idx);
    setInputVal(INPUTS[idx].values[0]);
    reset();
  };

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {PROGRAMS.map((p, idx) => (
          <button
            key={p.label}
            type="button"
            onClick={() => selectProg(idx)}
            className={`rounded border px-2 py-0.5 text-xs transition ${
              idx === progIdx ? 'border-accent text-accent' : 'border-edge text-muted hover:border-accent hover:text-accent'
            }`}
          >
            {p.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xs text-muted">input</span>
          {INPUTS[progIdx].values.map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => {
                setInputVal(val);
                reset();
              }}
              className={`rounded border px-2 py-0.5 font-mono text-xs transition ${
                val === inputVal ? 'border-accent text-accent' : 'border-edge text-muted hover:border-accent hover:text-accent'
              }`}
            >
              {INPUTS[progIdx].render(val)}
            </button>
          ))}
        </div>
      </div>

      {/* Source with the active line highlighted; lines that have run are dimmed-green */}
      <div className="overflow-x-auto rounded-lg border border-edge bg-bg p-3">
        {prog.src.map((line, idx) => {
          const ln = idx + 1;
          const active = ln === frame.line;
          const ran = frames.slice(0, Math.min(index, frames.length - 1) + 1).some((fr) => fr.line === ln) && !active;
          return (
            <div
              key={idx}
              className="flex items-start gap-3 rounded px-2 font-mono text-sm leading-6"
              style={{
                background: active ? 'color-mix(in oklab, var(--accent) 16%, var(--bg))' : 'transparent',
              }}
            >
              <span className="w-5 shrink-0 select-none text-right text-[11px] text-muted">{ln}</span>
              <span
                style={{
                  color: active ? 'var(--accent)' : ran ? '#10b981' : 'var(--fg)',
                  fontWeight: active ? 600 : 400,
                }}
                className="whitespace-pre"
              >
                {line || ' '}
              </span>
            </div>
          );
        })}
      </div>

      {/* State row: variables, $?, and the explanation */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
        <div className="rounded-lg border border-edge bg-bg p-3 text-sm">
          <span className="text-fg">{frame.note}</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-bg p-3" style={{ borderColor: frame.status === 0 ? '#10b981' : '#f43f5e' }}>
          <span className="font-mono text-xs text-muted">$? =</span>
          <span className="font-mono text-lg font-semibold" style={{ color: frame.status === 0 ? '#10b981' : '#f43f5e' }}>
            {frame.status}
          </span>
          <span className="text-[11px] text-muted">{frame.status === 0 ? 'success' : 'failure'}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs">
        <span className="text-muted">vars:</span>
        {Object.entries(frame.vars).map(([k, val]) => (
          <span key={k} className="rounded border border-edge bg-bg px-2 py-0.5 text-fg">
            {k}={val}
          </span>
        ))}
      </div>

      {/* Program output */}
      <div className="mt-3 rounded-lg border border-edge bg-bg p-3">
        <div className="mb-1 font-mono text-[11px] uppercase tracking-wide text-muted">output</div>
        <pre className="min-h-[1.25rem] whitespace-pre-wrap font-mono text-sm" style={{ color: '#38bdf8' }}>
          {frame.output.join('\n')}
        </pre>
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
            max={8}
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
    </div>
  );
}
