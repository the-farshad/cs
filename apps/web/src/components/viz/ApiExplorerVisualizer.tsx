import { useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

const METHODS: { m: Method; idempotent: boolean; safe: boolean }[] = [
  { m: 'GET', idempotent: true, safe: true },
  { m: 'POST', idempotent: false, safe: false },
  { m: 'PUT', idempotent: true, safe: false },
  { m: 'DELETE', idempotent: true, safe: false },
];

const RESOURCES = ['/users', '/users/42', '/users/999'] as const;
type Resource = (typeof RESOURCES)[number];

type Outcome = {
  status: number;
  label: string;
  /** 'ok' green, 'created' violet, 'warn' amber, 'err' rose. */
  tone: 'ok' | 'created' | 'warn' | 'err';
  body: string;
};

const exists = (r: Resource) => r === '/users/42';
const isCollection = (r: Resource) => r === '/users';

/** Resolve a single call given how many times this exact call has run before. */
function resolve(method: Method, r: Resource, prior: number): Outcome {
  const first = prior === 0;
  switch (method) {
    case 'GET':
      if (isCollection(r)) return { status: 200, label: 'OK', tone: 'ok', body: '[ {"id":42}, ... ]  (a page of users)' };
      return exists(r)
        ? { status: 200, label: 'OK', tone: 'ok', body: '{ "id": 42, "name": "Ada" }' }
        : { status: 404, label: 'Not Found', tone: 'err', body: '{ "error": "no such user" }' };

    case 'POST':
      // Only meaningful on a collection; creates a NEW resource each call.
      if (!isCollection(r)) return { status: 405, label: 'Method Not Allowed', tone: 'err', body: 'POST a collection, not an item' };
      return { status: 201, label: 'Created', tone: 'created', body: `{ "id": ${1000 + prior}, "name": "new" }   (new id every call)` };

    case 'PUT':
      // Replace at a known URL. Same result whether first or repeated.
      if (isCollection(r)) return { status: 405, label: 'Method Not Allowed', tone: 'err', body: 'PUT a specific item, not the collection' };
      return first
        ? { status: exists(r) ? 200 : 201, label: exists(r) ? 'OK (updated)' : 'Created', tone: exists(r) ? 'ok' : 'created', body: '{ "id": 42, "name": "Ada Lovelace" }' }
        : { status: 200, label: 'OK (same state)', tone: 'ok', body: '{ "id": 42, "name": "Ada Lovelace" }   (unchanged)' };

    case 'DELETE':
      if (isCollection(r)) return { status: 405, label: 'Method Not Allowed', tone: 'err', body: 'DELETE a specific item' };
      return first && exists(r)
        ? { status: 204, label: 'No Content (deleted)', tone: 'ok', body: '(empty body)' }
        : { status: 404, label: 'Not Found (already gone)', tone: 'warn', body: '(already deleted — repeat is harmless)' };
  }
}

const toneCol = (t: Outcome['tone']) =>
  t === 'ok' ? '#10b981' : t === 'created' ? '#8b5cf6' : t === 'warn' ? '#fbbf24' : '#f43f5e';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

type LogEntry = { n: number; method: Method; resource: Resource; outcome: Outcome };

export default function ApiExplorerVisualizer() {
  const [method, setMethod] = useState<Method>('PUT');
  const [resource, setResource] = useState<Resource>('/users/42');
  const [log, setLog] = useState<LogEntry[]>([]);

  const meta = METHODS.find((x) => x.m === method)!;

  // How many times has THIS exact (method, resource) call already been sent?
  const priorSameCall = useMemo(
    () => log.filter((e) => e.method === method && e.resource === resource).length,
    [log, method, resource],
  );

  const send = () => {
    const outcome = resolve(method, resource, priorSameCall);
    setLog((l) => [{ n: l.length + 1, method, resource, outcome }, ...l].slice(0, 6));
  };

  const last = log[0];

  // Distinct ids created by repeated POSTs vs stable state for PUT — used in the hint.
  const repeatHint = meta.idempotent
    ? 'Idempotent: sending this again leaves the server in the same state.'
    : 'Not idempotent: each send can change the server (e.g. POST creates a new resource every time).';

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      {/* request builder */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded border border-edge">
          {METHODS.map(({ m }) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              aria-pressed={method === m}
              className={`px-3 py-1 font-mono text-sm transition ${method === m ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}
            >
              {m}
            </button>
          ))}
        </div>
        <select
          value={resource}
          onChange={(e) => setResource(e.target.value as Resource)}
          className="rounded border border-edge bg-bg px-2 py-1 font-mono text-sm text-fg"
        >
          {RESOURCES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={send}
          className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90"
        >
          <Icon name="arrow-right" size={16} /> Send
        </button>
      </div>

      {/* method tags */}
      <div className="mt-2 flex flex-wrap gap-2 font-mono text-[11px]">
        <span className={`rounded px-2 py-0.5 ${meta.safe ? 'bg-emerald-500/15 text-emerald-400' : 'bg-bg text-muted'}`}>
          {meta.safe ? 'safe (read-only)' : 'unsafe (writes)'}
        </span>
        <span className={`rounded px-2 py-0.5 ${meta.idempotent ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
          {meta.idempotent ? 'idempotent' : 'not idempotent'}
        </span>
        <span className="rounded bg-bg px-2 py-0.5 text-muted">
          sent {priorSameCall}× already
        </span>
      </div>

      {/* response panel */}
      <div className="mt-4 rounded-lg border border-edge bg-bg p-3">
        {last ? (
          <>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex h-6 items-center rounded px-2 font-mono text-sm font-semibold"
                style={{ background: `${toneCol(last.outcome.tone)}22`, color: toneCol(last.outcome.tone) }}
              >
                {last.outcome.status}
              </span>
              <span className="font-mono text-sm text-fg">{last.outcome.label}</span>
              <span className="ml-auto font-mono text-xs text-muted">
                {last.method} {last.resource}
              </span>
            </div>
            <pre className="mt-2 overflow-x-auto font-mono text-xs text-muted">{last.outcome.body}</pre>
          </>
        ) : (
          <div className="font-mono text-sm text-muted">Pick a method + resource, then Send.</div>
        )}
      </div>

      {/* idempotency hint */}
      <div className="mt-3 flex items-start gap-2 text-sm">
        <span
          className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
          style={{ background: meta.idempotent ? '#10b981' : '#f43f5e', color: '#04140d' }}
        >
          <Icon name={meta.idempotent ? 'check' : 'arrow-down'} size={12} />
        </span>
        <span className="text-muted">{repeatHint}</span>
      </div>

      {/* history log */}
      {log.length > 0 && (
        <div className="mt-4 border-t border-edge pt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-xs text-muted">history (newest first)</span>
            <button type="button" className={btn} onClick={() => setLog([])}>
              <Icon name="rotate-ccw" size={14} /> Clear
            </button>
          </div>
          <ul className="space-y-1">
            {log.map((e) => (
              <li key={e.n} className="flex items-center gap-2 font-mono text-xs">
                <span className="w-12 shrink-0" style={{ color: toneCol(e.outcome.tone) }}>{e.outcome.status}</span>
                <span className="w-14 shrink-0 text-fg">{e.method}</span>
                <span className="w-24 shrink-0 text-muted">{e.resource}</span>
                <span className="truncate text-muted">{e.outcome.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">
        Try POST /users twice — each returns 201 with a new id. Try PUT /users/42 twice — the second is the same 200, the resource is unchanged. That difference is idempotency.
      </div>
    </div>
  );
}
