import { useMemo, useRef, useState } from 'react';
import { argument, truthTable } from './logic';

const SYMS = ['¬', '∧', '∨', '→', '↔', '(', ')'];

function TF({ v }: { v: boolean }) {
  return <span style={{ color: v ? '#10b981' : '#f43f5e' }} className="font-mono font-medium">{v ? 'T' : 'F'}</span>;
}

/** Truth-table / validity tool backed by the verified logic engine (src/components/viz/logic.ts). */
export default function LogicTruthTable({
  initial = '(P → Q) ∧ P → Q',
  mode: initialMode = 'formula',
}: {
  initial?: string;
  mode?: 'formula' | 'argument';
}) {
  const [mode, setMode] = useState<'formula' | 'argument'>(initialMode);
  const [formula, setFormula] = useState(initial);
  const [premises, setPremises] = useState('P → Q, P');
  const [conclusion, setConclusion] = useState('Q');
  const active = useRef<((s: string) => void) | null>(null);

  const formulaResult = useMemo(() => {
    try {
      return { ok: true as const, ...truthTable(formula) };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [formula]);

  const argResult = useMemo(() => {
    try {
      const prem = premises.split(',').map((s) => s.trim()).filter(Boolean);
      if (prem.length === 0) return { ok: false as const, error: 'add at least one premise' };
      return { ok: true as const, prem, ...argument(prem, conclusion) };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [premises, conclusion]);

  const tooBig =
    (mode === 'formula' && formulaResult.ok && formulaResult.vars.length > 4) ||
    (mode === 'argument' && argResult.ok && argResult.vars.length > 4);

  const inputCls = 'w-full rounded border border-edge bg-bg px-2 py-1 font-mono text-sm text-fg outline-none focus:border-accent';
  const insert = (s: string) => active.current?.(s);

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded border border-edge">
          {(['formula', 'argument'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m} className={`px-3 py-1 text-sm capitalize transition ${mode === m ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}>
              {m === 'formula' ? 'Single formula' : 'Argument (validity)'}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {SYMS.map((s) => (
            <button key={s} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(s)} className="rounded border border-edge px-2 py-0.5 font-mono text-sm text-muted transition hover:border-accent hover:text-accent">
              {s}
            </button>
          ))}
        </div>
      </div>

      {mode === 'formula' ? (
        <input
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          onFocus={() => (active.current = (s) => setFormula((f) => f + s))}
          aria-label="Formula"
          className={inputCls}
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-muted">
            Premises (comma-separated)
            <input value={premises} onChange={(e) => setPremises(e.target.value)} onFocus={() => (active.current = (s) => setPremises((f) => f + s))} className={`mt-1 ${inputCls}`} />
          </label>
          <label className="text-xs text-muted">
            Conclusion
            <input value={conclusion} onChange={(e) => setConclusion(e.target.value)} onFocus={() => (active.current = (s) => setConclusion((f) => f + s))} className={`mt-1 ${inputCls}`} />
          </label>
        </div>
      )}
      <p className="mt-2 text-xs text-muted">Type symbols or ASCII: <code>~ ! </code>→ ¬, <code>&amp;</code> → ∧, <code>|</code> → ∨, <code>-&gt;</code> → →, <code>&lt;-&gt;</code> → ↔.</p>

      <div className="mt-4 overflow-x-auto">
        {mode === 'formula' ? (
          !formulaResult.ok ? (
            <p className="font-mono text-sm text-rose-400">Parse error: {formulaResult.error}</p>
          ) : tooBig ? (
            <p className="text-sm text-muted">{formulaResult.vars.length} variables = {1 << formulaResult.vars.length} rows — use ≤ 4 variables to display the table.</p>
          ) : (
            <>
              <table className="w-full border-collapse text-center text-sm">
                <thead>
                  <tr className="border-b border-edge text-muted">
                    {formulaResult.vars.map((v) => <th key={v} className="px-3 py-1.5 font-mono font-normal">{v}</th>)}
                    <th className="border-l border-edge px-3 py-1.5 font-mono font-medium text-fg">{formula}</th>
                  </tr>
                </thead>
                <tbody>
                  {formulaResult.rows.map((r, i) => (
                    <tr key={i} className="border-b border-edge/50">
                      {formulaResult.vars.map((v) => <td key={v} className="px-3 py-1.5"><TF v={r.env[v]!} /></td>)}
                      <td className="border-l border-edge px-3 py-1.5"><TF v={r.value} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 text-sm">
                This formula is a{' '}
                <span className="font-medium" style={{ color: formulaResult.classification === 'tautology' ? '#10b981' : formulaResult.classification === 'contradiction' ? '#f43f5e' : 'var(--accent)' }}>
                  {formulaResult.classification}
                </span>
                {formulaResult.classification === 'tautology' ? ' — true under every assignment.' : formulaResult.classification === 'contradiction' ? ' — false under every assignment.' : ' — true under some assignments, false under others.'}
              </div>
            </>
          )
        ) : !argResult.ok ? (
          <p className="font-mono text-sm text-rose-400">Parse error: {argResult.error}</p>
        ) : tooBig ? (
          <p className="text-sm text-muted">{argResult.vars.length} variables — use ≤ 4 to display the table.</p>
        ) : (
          <>
            <table className="w-full border-collapse text-center text-sm">
              <thead>
                <tr className="border-b border-edge text-muted">
                  {argResult.vars.map((v) => <th key={v} className="px-3 py-1.5 font-mono font-normal">{v}</th>)}
                  {argResult.prem.map((p, i) => <th key={i} className="border-l border-edge px-3 py-1.5 font-mono font-normal text-fg">{p}</th>)}
                  <th className="border-l-2 border-accent px-3 py-1.5 font-mono font-medium text-accent">∴ {conclusion}</th>
                </tr>
              </thead>
              <tbody>
                {argResult.rows.map((r, i) => (
                  <tr key={i} className="border-b border-edge/50" style={r.counterexample ? { background: 'rgba(244,63,94,0.12)' } : undefined}>
                    {argResult.vars.map((v) => <td key={v} className="px-3 py-1.5"><TF v={r.env[v]!} /></td>)}
                    {r.premiseVals.map((pv, k) => <td key={k} className="border-l border-edge px-3 py-1.5"><TF v={pv} /></td>)}
                    <td className="border-l-2 border-accent px-3 py-1.5"><TF v={r.conclusionVal} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 text-sm">
              The argument is{' '}
              <span className="font-medium" style={{ color: argResult.valid ? '#10b981' : '#f43f5e' }}>{argResult.valid ? 'valid' : 'invalid'}</span>
              {argResult.valid
                ? ' — no row makes every premise true and the conclusion false.'
                : ' — the highlighted row(s) make all premises true but the conclusion false (a counterexample).'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
