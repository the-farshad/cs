import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

type Op = { cmd: string; run: (lines: string[]) => string[]; note: string };

// Each demo: a starting text plus a list of pipeline stages. Every stage is a
// real (small) implementation of the tool, so the shown output is what the
// command would actually produce on the lines fed to it.
type Demo = { label: string; input: string; ops: Op[] };

const DEMOS: Demo[] = [
  {
    label: 'top visitors by IP',
    input: ['10.0.0.4 GET /', '10.0.0.7 GET /a', '10.0.0.4 POST /b', '10.0.0.4 GET /c', '10.0.0.7 GET /'].join('\n'),
    ops: [
      {
        cmd: "cut -d' ' -f1",
        note: 'keep field 1 (the IP), using space as the delimiter',
        run: (l) => l.map((line) => line.split(' ')[0]),
      },
      { cmd: 'sort', note: 'sort so identical IPs become adjacent', run: (l) => [...l].sort() },
      {
        cmd: 'uniq -c',
        note: 'collapse adjacent duplicates, prefixing each with its count',
        run: (l) => {
          const out: string[] = [];
          let i = 0;
          while (i < l.length) {
            let j = i;
            while (j < l.length && l[j] === l[i]) j++;
            out.push(`${String(j - i).padStart(4)} ${l[i]}`);
            i = j;
          }
          return out;
        },
      },
      {
        cmd: 'sort -rn',
        note: 'sort by the leading number, descending',
        run: (l) => [...l].sort((a, b) => parseInt(b.trim(), 10) - parseInt(a.trim(), 10)),
      },
    ],
  },
  {
    label: 'grep + awk a CSV',
    input: ['name,score', 'ada,90', 'bob,55', 'cleo,72', 'dan,40'].join('\n'),
    ops: [
      { cmd: 'grep -v name', note: 'drop the header line (it contains "name")', run: (l) => l.filter((x) => !x.includes('name')) },
      {
        cmd: "awk -F, '$2>=60'",
        note: 'split on comma; keep rows whose 2nd field is at least 60',
        run: (l) => l.filter((x) => Number(x.split(',')[1]) >= 60),
      },
      {
        cmd: "awk -F, '{print $1}'",
        note: 'print only the first field (the name)',
        run: (l) => l.map((x) => x.split(',')[0]),
      },
    ],
  },
  {
    label: 'normalize words',
    input: ['The Quick brown', 'the QUICK Fox', 'brown FOX'].join('\n'),
    ops: [
      { cmd: 'tr A-Z a-z', note: 'translate uppercase to lowercase', run: (l) => l.map((x) => x.toLowerCase()) },
      { cmd: "tr ' ' '\\n'", note: 'turn each space into a newline → one word per line', run: (l) => l.flatMap((x) => x.split(' ')) },
      { cmd: 'sort', note: 'sort the words', run: (l) => [...l].sort() },
      {
        cmd: 'uniq -c',
        note: 'count adjacent duplicate words',
        run: (l) => {
          const out: string[] = [];
          let i = 0;
          while (i < l.length) {
            let j = i;
            while (j < l.length && l[j] === l[i]) j++;
            out.push(`${String(j - i).padStart(4)} ${l[i]}`);
            i = j;
          }
          return out;
        },
      },
    ],
  },
  {
    label: 'sed substitute',
    input: ['color: red', 'color: red', 'border: red', 'color: blue'].join('\n'),
    ops: [
      {
        cmd: 's/red/teal/',
        note: "sed 's/red/teal/' replaces the first 'red' on each line",
        run: (l) => l.map((x) => x.replace('red', 'teal')),
      },
      { cmd: 'grep color', note: 'keep only lines mentioning color', run: (l) => l.filter((x) => x.includes('color')) },
    ],
  },
];

const splitLines = (s: string) => (s === '' ? [] : s.split('\n'));

export default function PipelineVisualizer() {
  const [demoIdx, setDemoIdx] = useState(0);
  const demo = DEMOS[demoIdx];

  // Precompute the output of each stage so a frame = "after stage k".
  const stages = useMemo(() => {
    const out: string[][] = [splitLines(demo.input)];
    for (const op of demo.ops) out.push(op.run(out[out.length - 1]));
    return out;
  }, [demo]);

  const frameCount = stages.length; // 0 = raw input, then one per op
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frameCount, 1.5);
  const i = Math.min(index, frameCount - 1);

  const before = i === 0 ? [] : stages[i - 1];
  const after = stages[i];
  const op = i === 0 ? null : demo.ops[i - 1];

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {DEMOS.map((d, idx) => (
          <button
            key={d.label}
            type="button"
            onClick={() => {
              setDemoIdx(idx);
              reset();
            }}
            className={`rounded border px-2 py-0.5 text-xs transition ${
              idx === demoIdx ? 'border-accent text-accent' : 'border-edge text-muted hover:border-accent hover:text-accent'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* The full pipeline as a command line, highlighting the active stage */}
      <div className="mb-4 overflow-x-auto rounded-lg border border-edge bg-bg p-3 font-mono text-sm">
        <span className="text-muted">$ </span>
        <span className="text-fg">cat input</span>
        {demo.ops.map((o, idx) => {
          const active = idx === i - 1;
          const done = idx < i - 1;
          return (
            <span key={idx}>
              <span className="text-muted"> | </span>
              <span
                style={{
                  color: active ? 'var(--accent)' : done ? '#10b981' : 'var(--fg)',
                  fontWeight: active ? 600 : 400,
                }}
              >
                {o.cmd}
              </span>
            </span>
          );
        })}
      </div>

      {/* Before -> after panes */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <div className="rounded-lg border border-edge bg-bg p-3">
          <div className="mb-1 font-mono text-[11px] uppercase tracking-wide text-muted">{i === 0 ? 'input' : 'stdin'}</div>
          <pre className="whitespace-pre-wrap font-mono text-sm text-muted">
            {(i === 0 ? after : before).join('\n') || '(empty)'}
          </pre>
        </div>

        <div className="hidden items-center justify-center sm:flex">
          <Icon name="arrow-right" size={20} className="text-accent" />
        </div>

        <div className="rounded-lg border bg-bg p-3" style={{ borderColor: i === 0 ? 'var(--edge)' : 'var(--accent)' }}>
          <div className="mb-1 font-mono text-[11px] uppercase tracking-wide" style={{ color: i === 0 ? 'var(--muted)' : 'var(--accent)' }}>
            {i === 0 ? 'input' : 'stdout'}
          </div>
          <pre className="whitespace-pre-wrap font-mono text-sm text-fg">{after.join('\n') || '(empty)'}</pre>
        </div>
      </div>

      <div className="mt-3 min-h-[2rem] rounded-lg border border-edge bg-bg p-3 text-sm">
        {op ? (
          <span className="text-fg">
            <code className="font-mono text-accent">{op.cmd}</code> — {op.note}
          </span>
        ) : (
          <span className="text-muted">The raw input. Press play to push it through the pipeline, one filter at a time.</span>
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
        <button type="button" className={btn} onClick={next} disabled={index >= frameCount - 1}>
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
            max={6}
            step={0.5}
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
          max={frameCount - 1}
          value={index}
          onChange={(e) => seek(Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
          aria-label="Timeline"
        />
        <span className="shrink-0 font-mono text-xs text-muted">
          {i}/{frameCount - 1}
        </span>
      </div>
    </div>
  );
}
