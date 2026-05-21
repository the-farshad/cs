import { useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';

const SEED = `
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS departments;
CREATE TABLE departments (id INTEGER PRIMARY KEY, name TEXT);
INSERT INTO departments VALUES (1,'Engineering'),(2,'Design'),(3,'Sales');
CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT, dept_id INTEGER, salary INTEGER, hire_year INTEGER);
INSERT INTO employees VALUES
 (1,'Ada',1,120000,2018),
 (2,'Linus',1,115000,2016),
 (3,'Grace',1,135000,2015),
 (4,'Donald',2,98000,2020),
 (5,'Margaret',2,105000,2019),
 (6,'Tim',3,90000,2021),
 (7,'Katherine',3,99000,2017),
 (8,'Alan',1,128000,2014);
`;

const EXAMPLES: { label: string; sql: string }[] = [
  { label: 'Select & sort', sql: 'SELECT name, salary\nFROM employees\nORDER BY salary DESC;' },
  { label: 'Filter', sql: "SELECT name, salary\nFROM employees\nWHERE salary > 100000\nORDER BY salary DESC;" },
  { label: 'Join', sql: 'SELECT e.name, d.name AS dept\nFROM employees e\nJOIN departments d ON e.dept_id = d.id;' },
  { label: 'Group & aggregate', sql: 'SELECT d.name AS dept,\n       COUNT(*) AS headcount,\n       AVG(e.salary) AS avg_salary\nFROM employees e\nJOIN departments d ON e.dept_id = d.id\nGROUP BY d.name;' },
];

const SCHEMA = [
  { table: 'departments', cols: 'id, name' },
  { table: 'employees', cols: 'id, name, dept_id, salary, hire_year' },
];

type Result = { columns: string[]; values: unknown[][] };

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40';

export default function SqlPlayground() {
  const [db, setDb] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(EXAMPLES[0].sql);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runOn = (database: any, q: string) => {
    try {
      const res = database.exec(q);
      setResult(res[0] ?? { columns: [], values: [] });
      setError(null);
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setResult(null);
    }
  };

  useEffect(() => {
    let active = true;
    let database: any;
    (async () => {
      try {
        const initSqlJs = (await import('sql.js')).default as any;
        const SQL = await initSqlJs({ locateFile: (file: string) => `/${file}` });
        database = new SQL.Database();
        database.run(SEED);
        if (active) {
          setDb(database);
          setLoading(false);
          runOn(database, EXAMPLES[0].sql);
        }
      } catch {
        if (active) {
          setError('Failed to load the SQL engine.');
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
      try {
        database?.close();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const run = () => db && runOn(db, query);
  const reset = () => {
    if (!db) return;
    db.run(SEED);
    runOn(db, query);
  };
  const useExample = (sql: string) => {
    setQuery(sql);
    if (db) runOn(db, sql);
  };

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted">
        <span className="text-fg">schema:</span>
        {SCHEMA.map((s) => (
          <span key={s.table}>
            {s.table}(<span className="text-muted">{s.cols}</span>)
          </span>
        ))}
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button key={ex.label} type="button" onClick={() => useExample(ex.sql)} className="rounded border border-edge px-2 py-0.5 text-xs text-muted transition hover:border-accent hover:text-accent">
            {ex.label}
          </button>
        ))}
      </div>

      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        spellCheck={false}
        rows={6}
        className="w-full resize-y rounded-lg border border-edge bg-bg p-3 font-mono text-sm text-fg outline-none focus:border-accent"
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') run();
        }}
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-50"
        >
          <Icon name="play" size={16} /> Run
        </button>
        <button type="button" className={btn} onClick={reset} disabled={loading}>
          <Icon name="rotate-ccw" size={16} /> Reset data
        </button>
        <span className="text-xs text-muted">{loading ? 'loading SQL engine…' : 'Ctrl/⌘ + Enter to run'}</span>
      </div>

      <div className="mt-4">
        {error ? (
          <div className="rounded border border-rose-500/50 bg-rose-500/10 p-3 font-mono text-sm text-rose-300">{error}</div>
        ) : result && result.values.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-edge">
            <table className="w-full border-collapse text-left font-mono text-sm">
              <thead>
                <tr className="bg-bg/50">
                  {result.columns.map((c) => (
                    <th key={c} className="border-b border-edge px-3 py-2 text-fg">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.values.map((row, i) => (
                  <tr key={i} className="odd:bg-bg/20">
                    {row.map((cell, j) => (
                      <td key={j} className="border-b border-edge/50 px-3 py-1.5 text-muted">{cell === null ? 'NULL' : String(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : result ? (
          <div className="font-mono text-sm text-muted">Query OK — 0 rows returned.</div>
        ) : null}
        {result && result.values.length > 0 && <div className="mt-2 font-mono text-xs text-muted">{result.values.length} row(s)</div>}
      </div>
    </div>
  );
}
