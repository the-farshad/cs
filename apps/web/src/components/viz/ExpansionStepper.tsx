import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

// Files that "exist" for the purpose of glob expansion.
const FILES = ['a.txt', 'b.txt', 'notes.md', 'report.tar.gz'];

type Stage = {
  name: string;
  rule: string;
  // The line as it stands AFTER this stage runs.
  line: string;
};

// Each example carries its own pre-computed expansion stages so the demo is
// deterministic and honest about what bash actually does, in order.
type Example = {
  label: string;
  source: string;
  stages: Stage[];
  // Final argument list (after word splitting + globbing).
  argv: string[];
};

const EXAMPLES: Example[] = [
  {
    label: 'echo {a,b}.txt',
    source: 'echo {a,b}.txt',
    stages: [
      { name: 'brace', rule: '{a,b} → a b, distributing the suffix', line: 'echo a.txt b.txt' },
      { name: 'tilde', rule: 'no leading ~ → unchanged', line: 'echo a.txt b.txt' },
      { name: 'parameter', rule: 'no $var → unchanged', line: 'echo a.txt b.txt' },
      { name: 'command', rule: 'no $(...) → unchanged', line: 'echo a.txt b.txt' },
      { name: 'arithmetic', rule: 'no $(( )) → unchanged', line: 'echo a.txt b.txt' },
      { name: 'word-split', rule: 'split on spaces → 3 fields', line: 'echo | a.txt | b.txt' },
      { name: 'glob', rule: 'a.txt and b.txt both match real files', line: 'echo | a.txt | b.txt' },
    ],
    argv: ['echo', 'a.txt', 'b.txt'],
  },
  {
    label: 'echo ~/${file%.tar.gz}',
    source: 'echo ~/${file%.tar.gz}',
    stages: [
      { name: 'brace', rule: 'no {…} → unchanged', line: 'echo ~/${file%.tar.gz}' },
      { name: 'tilde', rule: '~ → $HOME (/home/learner)', line: 'echo /home/learner/${file%.tar.gz}' },
      {
        name: 'parameter',
        rule: '${file%.tar.gz}: strip shortest suffix .tar.gz from "report.tar.gz"',
        line: 'echo /home/learner/report',
      },
      { name: 'command', rule: 'no $(...) → unchanged', line: 'echo /home/learner/report' },
      { name: 'arithmetic', rule: 'no $(( )) → unchanged', line: 'echo /home/learner/report' },
      { name: 'word-split', rule: 'one field, no spaces', line: 'echo | /home/learner/report' },
      { name: 'glob', rule: 'no * ? [ ] → literal', line: 'echo | /home/learner/report' },
    ],
    argv: ['echo', '/home/learner/report'],
  },
  {
    label: 'echo "${greeting:-hi $USER}" *.txt',
    source: 'echo "${greeting:-hi $USER}" *.txt',
    stages: [
      { name: 'brace', rule: 'no {…} (the ${} is not a brace list)', line: 'echo "${greeting:-hi $USER}" *.txt' },
      { name: 'tilde', rule: 'no ~ → unchanged', line: 'echo "${greeting:-hi $USER}" *.txt' },
      {
        name: 'parameter',
        rule: 'greeting is empty → use default "hi $USER"; $USER → learner',
        line: 'echo "hi learner" *.txt',
      },
      { name: 'command', rule: 'no $(...) → unchanged', line: 'echo "hi learner" *.txt' },
      { name: 'arithmetic', rule: 'no $(( )) → unchanged', line: 'echo "hi learner" *.txt' },
      { name: 'word-split', rule: 'quotes protect "hi learner"; *.txt is its own field', line: 'echo | hi learner | *.txt' },
      { name: 'glob', rule: '*.txt matches a.txt, b.txt (sorted)', line: 'echo | hi learner | a.txt | b.txt' },
    ],
    argv: ['echo', 'hi learner', 'a.txt', 'b.txt'],
  },
  {
    label: 'echo $(( 3 + 4 * 2 ))',
    source: 'echo $(( 3 + 4 * 2 ))',
    stages: [
      { name: 'brace', rule: 'no {…} → unchanged', line: 'echo $(( 3 + 4 * 2 ))' },
      { name: 'tilde', rule: 'no ~ → unchanged', line: 'echo $(( 3 + 4 * 2 ))' },
      { name: 'parameter', rule: 'no simple $var → unchanged', line: 'echo $(( 3 + 4 * 2 ))' },
      { name: 'command', rule: 'no $(...) command form → unchanged', line: 'echo $(( 3 + 4 * 2 ))' },
      { name: 'arithmetic', rule: '$(( 3 + 4*2 )) → 11 (precedence: * before +)', line: 'echo 11' },
      { name: 'word-split', rule: 'one field', line: 'echo | 11' },
      { name: 'glob', rule: 'no glob chars → literal', line: 'echo | 11' },
    ],
    argv: ['echo', '11'],
  },
];

const STAGE_NOTE: Record<string, string> = {
  brace: 'Brace expansion happens first and is purely textual — it does not look at variables or files.',
  tilde: 'A leading ~ becomes the home directory; ~user becomes that user’s home.',
  parameter: 'Parameter, command, and arithmetic expansion all happen together, left to right.',
  command: '$(cmd) (or `cmd`) is replaced by the command’s standard output.',
  arithmetic: '$(( expr )) evaluates integer math and substitutes the result.',
  'word-split': 'Unquoted results are split into fields on $IFS (space, tab, newline). Quotes prevent this.',
  glob: 'Finally, unquoted *, ?, [...] are matched against filenames (a no-match pattern stays literal by default).',
};

export default function ExpansionStepper() {
  const [exIdx, setExIdx] = useState(0);
  const ex = EXAMPLES[exIdx];

  // index 0 = the raw source line; index i = state after stage i-1.
  const frameCount = ex.stages.length + 1;
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frameCount, 2);
  const i = Math.min(index, frameCount - 1);

  const currentLine = i === 0 ? ex.source : ex.stages[i - 1].line;
  const fields = currentLine.includes('|') ? currentLine.split('|').map((f) => f.trim()) : null;
  const atEnd = i === frameCount - 1;

  const stageNames = useMemo(() => ex.stages.map((s) => s.name), [ex]);

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {EXAMPLES.map((e, idx) => (
          <button
            key={e.label}
            type="button"
            onClick={() => {
              setExIdx(idx);
              reset();
            }}
            className={`rounded border px-2 py-0.5 font-mono text-xs transition ${
              idx === exIdx ? 'border-accent text-accent' : 'border-edge text-muted hover:border-accent hover:text-accent'
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>

      {/* Environment the line expands against */}
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-edge bg-bg p-3 font-mono text-xs text-muted">
        <span className="text-fg">env:</span>
        <span>USER=learner</span>
        <span>HOME=/home/learner</span>
        <span>file=report.tar.gz</span>
        <span>greeting= (empty)</span>
        <span className="basis-full text-fg">files: {FILES.join('  ')}</span>
      </div>

      {/* Pipeline of stages */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {stageNames.map((name, idx) => {
          const done = idx < i;
          const active = idx === i - 1 && i > 0;
          return (
            <span key={name} className="flex items-center gap-1.5">
              <span
                className="rounded border px-2 py-0.5 font-mono text-[11px] transition"
                style={{
                  borderColor: active ? 'var(--accent)' : done ? '#10b981' : 'var(--edge)',
                  color: active ? 'var(--accent)' : done ? '#10b981' : 'var(--muted)',
                }}
              >
                {name}
              </span>
              {idx < stageNames.length - 1 && <Icon name="chevron-right" size={12} className="text-muted" />}
            </span>
          );
        })}
      </div>

      {/* The line being rewritten */}
      <div className="rounded-lg border border-edge bg-bg p-3">
        <div className="mb-1 font-mono text-[11px] uppercase tracking-wide text-muted">
          {i === 0 ? 'source line' : `after ${ex.stages[i - 1].name}`}
        </div>
        {fields ? (
          <div className="flex flex-wrap items-center gap-2">
            {fields.map((f, fi) => (
              <span
                key={fi}
                className="rounded border border-edge px-2 py-1 font-mono text-sm text-fg"
                style={fi === 0 ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
              >
                {f}
              </span>
            ))}
          </div>
        ) : (
          <code className="block whitespace-pre-wrap break-words font-mono text-base text-fg">{currentLine}</code>
        )}
      </div>

      {/* Rule applied at this step */}
      <div className="mt-3 min-h-[2.5rem] rounded-lg border border-edge bg-bg p-3 text-sm">
        {i === 0 ? (
          <span className="text-muted">The unexpanded command. Press play to apply each expansion in order.</span>
        ) : (
          <span className="text-fg">
            <span style={{ color: 'var(--accent)' }} className="font-mono">
              {ex.stages[i - 1].name}:
            </span>{' '}
            {ex.stages[i - 1].rule}
          </span>
        )}
      </div>

      {i > 0 && <div className="mt-2 text-xs text-muted">{STAGE_NOTE[ex.stages[i - 1].name]}</div>}

      {/* Final argv when finished */}
      {atEnd && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border bg-bg p-3" style={{ borderColor: '#10b981' }}>
          <span className="flex items-center gap-1 font-mono text-xs" style={{ color: '#10b981' }}>
            <Icon name="check" size={14} /> argv
          </span>
          {ex.argv.map((a, ai) => (
            <span key={ai} className="rounded bg-surface px-2 py-1 font-mono text-sm text-fg">
              <span className="text-muted">[{ai}]</span> {a}
            </span>
          ))}
        </div>
      )}

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
