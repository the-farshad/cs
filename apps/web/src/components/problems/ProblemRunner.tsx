import { useState } from 'react';
import { run, type TestResult } from '@/lib/runners';
import type { Problem } from '@/lib/problems';
import CodeTabs from '@/components/ui/CodeTabs';
import Icon from '@/components/ui/Icon';

const RUN_LANGS = [
  { id: 'python', label: 'Python' },
  { id: 'javascript', label: 'JavaScript' },
] as const;

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40';

export default function ProblemRunner({ problem }: { problem: Problem }) {
  const [lang, setLang] = useState<'python' | 'javascript'>('python');
  const [code, setCode] = useState(problem.starter.python);
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [showSolution, setShowSolution] = useState(false);

  const switchLang = (l: 'python' | 'javascript') => {
    setLang(l);
    setCode(problem.starter[l]);
    setResults(null);
  };

  const onRun = async () => {
    setRunning(true);
    setResults(null);
    const r = await run(lang, code, problem.funcName[lang], problem.tests);
    setResults(r);
    setRunning(false);
  };

  const passed = results ? results.filter((r) => r.ok).length : 0;
  const total = problem.tests.length;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="inline-flex overflow-hidden rounded border border-edge">
          {RUN_LANGS.map((l) => (
            <button key={l.id} type="button" onClick={() => switchLang(l.id)} aria-pressed={lang === l.id} className={`px-3 py-1 text-sm transition ${lang === l.id ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}>
              {l.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted">runs in your browser</span>
      </div>

      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        spellCheck={false}
        rows={12}
        className="w-full resize-y rounded-lg border border-edge bg-bg p-3 font-mono text-sm text-fg outline-none focus:border-accent"
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') onRun();
        }}
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={onRun} disabled={running} className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-50">
          <Icon name="play" size={16} /> {running ? 'Running…' : 'Run tests'}
        </button>
        <button type="button" className={btn} onClick={() => setCode(problem.starter[lang])}>
          <Icon name="rotate-ccw" size={16} /> Reset
        </button>
        <button type="button" className={btn} onClick={() => setShowSolution((s) => !s)}>
          {showSolution ? 'Hide' : 'Show'} solution
        </button>
        {running && lang === 'python' && <span className="text-xs text-muted">first Python run downloads the runtime…</span>}
      </div>

      {results && (
        <div className="mt-4">
          <div className={`mb-2 font-mono text-sm ${passed === total ? 'text-emerald-400' : 'text-amber-300'}`}>
            {passed}/{total} tests passed
          </div>
          <div className="space-y-1">
            {problem.tests.map((t, i) => {
              const r = results[i];
              return (
                <div key={i} className={`rounded border px-3 py-2 text-xs font-mono ${r?.ok ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-rose-500/40 bg-rose-500/5'}`}>
                  <span className={r?.ok ? 'text-emerald-400' : 'text-rose-400'}>{r?.ok ? 'PASS' : 'FAIL'}</span>
                  <span className="text-muted"> · input </span>
                  <span className="text-fg">{JSON.stringify(t.args).slice(1, -1)}</span>
                  <span className="text-muted"> · expected </span>
                  <span className="text-fg">{JSON.stringify(t.expected)}</span>
                  {!r?.ok && (
                    <>
                      <span className="text-muted"> · got </span>
                      <span className="text-fg">{r?.actual}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showSolution && (
        <div className="mt-4">
          <p className="mb-2 text-sm text-muted">Reference solutions — Python and JavaScript run above; C++ and Java are for reference (a compiled-language judge comes with the backend).</p>
          <CodeTabs tabs={problem.solutions} />
        </div>
      )}
    </div>
  );
}
