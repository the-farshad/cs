import { useState } from 'react';
import Icon from '@/components/ui/Icon';

const S = 1 / Math.SQRT2;

export default function QubitVisualizer() {
  const [amp, setAmp] = useState<[number, number]>([1, 0]);
  const [measured, setMeasured] = useState<number | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const apply = (gate: 'X' | 'H' | 'Z') => {
    setMeasured(null);
    setAmp(([a0, a1]) => {
      if (gate === 'X') return [a1, a0];
      if (gate === 'Z') return [a0, -a1];
      return [(a0 + a1) * S, (a0 - a1) * S]; // H
    });
    setLog((l) => [...l, gate].slice(-14));
  };

  const measure = () => {
    const p0 = amp[0] * amp[0];
    const r = Math.random() < p0 ? 0 : 1;
    setMeasured(r);
    setAmp(r === 0 ? [1, 0] : [0, 1]);
    setLog((l) => [...l, `measure→${r}`].slice(-14));
  };

  const reset = () => {
    setAmp([1, 0]);
    setMeasured(null);
    setLog([]);
  };

  const p0 = amp[0] * amp[0];
  const p1 = amp[1] * amp[1];
  const fmt = (n: number) => (Math.abs(n) < 1e-9 ? '0' : n.toFixed(3));
  const stateStr = `${fmt(amp[0])}|0⟩ ${amp[1] >= 0 ? '+' : '−'} ${fmt(Math.abs(amp[1]))}|1⟩`;

  const btn = 'inline-flex items-center justify-center rounded border border-edge px-3 py-1 font-mono text-sm text-fg transition hover:border-accent hover:text-accent';

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">gates:</span>
        <button type="button" className={btn} onClick={() => apply('X')} title="bit flip (NOT)">X</button>
        <button type="button" className={btn} onClick={() => apply('H')} title="Hadamard — creates superposition">H</button>
        <button type="button" className={btn} onClick={() => apply('Z')} title="phase flip">Z</button>
        <button type="button" className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-3 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90" onClick={measure}>
          measure
        </button>
        <button type="button" className={btn} onClick={reset}>
          <Icon name="rotate-ccw" size={15} /> reset
        </button>
      </div>

      <div className="space-y-3">
        {[
          { k: '|0⟩', p: p0 },
          { k: '|1⟩', p: p1 },
        ].map(({ k, p }) => (
          <div key={k} className="flex items-center gap-3">
            <span className="w-8 font-mono text-sm text-fg">{k}</span>
            <div className="h-6 flex-1 overflow-hidden rounded bg-bg">
              <div className="h-full bg-accent transition-all" style={{ width: `${(p * 100).toFixed(1)}%` }} />
            </div>
            <span className="w-14 text-right font-mono text-xs text-muted">{(p * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-1 border-t border-edge pt-4 font-mono text-xs text-muted">
        <div>
          state: <span className="text-fg">{stateStr}</span>
        </div>
        <div>{measured !== null ? <>measured: <span className="text-accent">{measured}</span> — the state has collapsed</> : 'not measured yet — the bars show measurement probabilities'}</div>
        {log.length > 0 && <div>history: {log.join('  ')}</div>}
      </div>
    </div>
  );
}
