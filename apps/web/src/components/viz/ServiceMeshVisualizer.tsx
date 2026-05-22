import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

type Arch = 'monolith' | 'microservices';

// Downstream services the gateway fans out to. `optional` services can fail
// without breaking the whole response (graceful degradation).
const SERVICES = [
  { id: 'auth', label: 'Auth', optional: false },
  { id: 'orders', label: 'Orders', optional: false },
  { id: 'recs', label: 'Recs', optional: true },
  { id: 'reviews', label: 'Reviews', optional: true },
] as const;
type ServiceId = (typeof SERVICES)[number]['id'];

type Step = {
  /** Service being contacted this step, or 'gateway' / 'done'. */
  at: 'gateway' | ServiceId | 'done';
  note: string;
  /** Per-service state snapshot: 'idle' | 'calling' | 'ok' | 'fail' | 'skip'. */
  state: Record<ServiceId, string>;
};

const idleState = (): Record<ServiceId, string> =>
  Object.fromEntries(SERVICES.map((s) => [s.id, 'idle'])) as Record<ServiceId, string>;

function buildMicroSteps(failing: ServiceId | 'none'): Step[] {
  const steps: Step[] = [];
  let st = idleState();
  steps.push({ at: 'gateway', note: 'Request hits the API gateway. It will fan out to several services.', state: { ...st } });

  for (const svc of SERVICES) {
    st = { ...st, [svc.id]: 'calling' };
    steps.push({ at: svc.id, note: `Gateway calls the ${svc.label} service over the network.`, state: { ...st } });

    if (failing === svc.id) {
      st = { ...st, [svc.id]: svc.optional ? 'skip' : 'fail' };
      steps.push({
        at: svc.id,
        note: svc.optional
          ? `${svc.label} timed out — but it is optional. Degrade gracefully and continue.`
          : `${svc.label} failed — it is required, so the whole request errors (500).`,
        state: { ...st },
      });
      if (!svc.optional) {
        steps.push({ at: 'done', note: 'A required dependency failed: the request returns 500. Microservices add network failure modes.', state: { ...st } });
        return steps;
      }
    } else {
      st = { ...st, [svc.id]: 'ok' };
      steps.push({ at: svc.id, note: `${svc.label} responds OK.`, state: { ...st } });
    }
  }

  const anySkipped = Object.values(st).includes('skip');
  steps.push({
    at: 'done',
    note: anySkipped
      ? 'Response assembled with a degraded section (e.g. no recommendations). Core flow still works.'
      : 'All services responded. Gateway composes the full response.',
    state: { ...st },
  });
  return steps;
}

function buildMonolithSteps(failing: ServiceId | 'none'): Step[] {
  // In a monolith every "module" runs in one process. A failure in one module
  // (no network) can still crash the single request, but there is no partial
  // delivery — it is all-or-nothing in one place.
  const st = idleState();
  const broken = failing !== 'none';
  return [
    { at: 'gateway', note: 'Request hits the single monolith process — no internal network.', state: { ...st } },
    {
      at: 'done',
      note: broken
        ? 'One module threw inside the process. The request fails as a whole — but there is one place to look, not five.'
        : 'All modules run in-process (function calls, not network hops). One deploy, one runtime.',
      state: { ...st },
    },
  ];
}

const stateColor = (s: string) =>
  s === 'ok' ? '#10b981' : s === 'fail' ? '#f43f5e' : s === 'skip' ? '#fbbf24' : s === 'calling' ? '#38bdf8' : 'var(--border)';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function ServiceMeshVisualizer() {
  const [arch, setArch] = useState<Arch>('microservices');
  const [failing, setFailing] = useState<ServiceId | 'none'>('recs');

  const steps = useMemo(
    () => (arch === 'microservices' ? buildMicroSteps(failing) : buildMonolithSteps(failing)),
    [arch, failing],
  );
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(steps.length, 2);
  const step = steps[Math.min(index, steps.length - 1)] ?? steps[0];

  // Layout
  const W = 540;
  const H = 220;
  const gx = 70;
  const gy = H / 2;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded border border-edge">
          {(['monolith', 'microservices'] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setArch(a)}
              aria-pressed={arch === a}
              className={`px-3 py-1 text-sm transition ${arch === a ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}
            >
              {a === 'monolith' ? 'Monolith' : 'Microservices'}
            </button>
          ))}
        </div>
        {arch === 'microservices' && (
          <label className="flex items-center gap-2 text-sm text-muted">
            Failing
            <select
              value={failing}
              onChange={(e) => setFailing(e.target.value as ServiceId | 'none')}
              className="rounded border border-edge bg-bg px-2 py-1 text-fg"
            >
              <option value="none">none</option>
              {SERVICES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}{s.optional ? ' (optional)' : ' (required)'}
                </option>
              ))}
            </select>
          </label>
        )}
        {arch === 'monolith' && (
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={failing !== 'none'}
              onChange={(e) => setFailing(e.target.checked ? 'orders' : 'none')}
              className="accent-[var(--accent)]"
            />
            inject a module error
          </label>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '15rem' }} role="img" aria-label="Service architecture">
        {arch === 'microservices' ? (
          <>
            {/* fan-out links */}
            {SERVICES.map((s, i) => {
              const sy = 28 + i * ((H - 56) / (SERVICES.length - 1));
              const active = step.at === s.id;
              const cs = step.state[s.id];
              return (
                <line
                  key={`lk-${s.id}`}
                  x1={gx + 34} y1={gy}
                  x2={360} y2={sy}
                  style={{ stroke: active ? '#38bdf8' : cs === 'ok' ? '#10b981' : cs === 'fail' ? '#f43f5e' : cs === 'skip' ? '#fbbf24' : 'var(--border)' }}
                  strokeWidth={active ? 3 : 1.5}
                  strokeDasharray={cs === 'skip' || cs === 'fail' ? '5 4' : undefined}
                />
              );
            })}
            {/* services */}
            {SERVICES.map((s, i) => {
              const sy = 28 + i * ((H - 56) / (SERVICES.length - 1));
              const cs = step.state[s.id];
              const col = stateColor(cs);
              const lit = cs !== 'idle';
              return (
                <g key={s.id}>
                  <rect x={360} y={sy - 17} width={150} height={34} rx={7}
                    style={{ fill: lit ? `color-mix(in oklab, ${col} 16%, var(--surface))` : 'var(--surface)', stroke: col }}
                    strokeWidth={2} />
                  <text x={372} y={sy} dominantBaseline="central" fontSize={11} style={{ fill: 'var(--fg)', fontFamily: 'var(--font-mono)' }}>
                    {s.label}{s.optional ? '' : ' *'}
                  </text>
                  <text x={500} y={sy} textAnchor="end" dominantBaseline="central" fontSize={10}
                    style={{ fill: cs === 'idle' ? 'var(--muted)' : col, fontFamily: 'var(--font-mono)' }}>
                    {cs === 'idle' ? '—' : cs === 'calling' ? '...' : cs === 'ok' ? 'ok' : cs === 'fail' ? 'fail' : 'skip'}
                  </text>
                </g>
              );
            })}
          </>
        ) : (
          /* monolith: one big box with modules inside */
          <g>
            {(() => {
              const broken = failing !== 'none' && step.at === 'done';
              const col = broken ? '#f43f5e' : '#10b981';
              return (
                <>
                  <rect x={300} y={36} width={210} height={148} rx={10}
                    style={{ fill: `color-mix(in oklab, ${col} 12%, var(--surface))`, stroke: col }} strokeWidth={2.5} />
                  <text x={405} y={26} textAnchor="middle" fontSize={11} style={{ fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                    single process
                  </text>
                  {SERVICES.map((s, i) => {
                    const my = 52 + i * 32;
                    const isBroken = broken && s.id === 'orders';
                    return (
                      <g key={s.id}>
                        <rect x={318} y={my} width={174} height={24} rx={5}
                          style={{ fill: 'var(--bg)', stroke: isBroken ? '#f43f5e' : 'var(--border)' }} strokeWidth={1.5} />
                        <text x={328} y={my + 12} dominantBaseline="central" fontSize={10}
                          style={{ fill: isBroken ? '#f43f5e' : 'var(--fg)', fontFamily: 'var(--font-mono)' }}>
                          {s.label} module{isBroken ? ' ✕' : ''}
                        </text>
                      </g>
                    );
                  })}
                </>
              );
            })()}
          </g>
        )}

        {/* gateway / client node (shared) */}
        <rect x={gx - 34} y={gy - 22} width={68} height={44} rx={8} style={{ fill: 'var(--accent)', stroke: 'var(--accent)' }} />
        <text x={gx} y={gy} textAnchor="middle" dominantBaseline="central" fontSize={10} style={{ fill: 'var(--accent-fg)', fontFamily: 'var(--font-mono)' }}>
          {arch === 'microservices' ? 'gateway' : 'client'}
        </text>
        {arch === 'monolith' && (
          <line x1={gx + 34} y1={gy} x2={300} y2={gy}
            style={{ stroke: step.at === 'done' && failing !== 'none' ? '#f43f5e' : 'var(--border)' }} strokeWidth={2} />
        )}
      </svg>

      {/* step dots */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {steps.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => seek(i)}
            aria-label={`Step ${i + 1}`}
            className={`h-2.5 w-2.5 rounded-full transition ${i === index ? 'bg-accent' : i < index ? 'bg-accent/40' : 'bg-edge'}`}
          />
        ))}
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
        <button type="button" className={btn} onClick={next} disabled={index >= steps.length - 1}>
          Step <Icon name="chevron-right" size={16} />
        </button>
        <button type="button" className={btn} onClick={reset} disabled={index === 0}>
          <Icon name="rotate-ccw" size={16} /> Reset
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={1} max={8} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="mt-4 flex items-start gap-2 border-t border-edge pt-4 font-mono text-xs text-muted">
        <span className="shrink-0 text-accent">{index + 1}/{steps.length}</span>
        <span>{step.note}</span>
      </div>
    </div>
  );
}
