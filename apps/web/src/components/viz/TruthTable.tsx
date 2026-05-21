import { useState } from 'react';

type Op = { id: string; label: string; unary?: boolean; fn: (a: number, b: number) => number };

const OPS: Op[] = [
  { id: 'and', label: 'A AND B', fn: (a, b) => a & b },
  { id: 'or', label: 'A OR B', fn: (a, b) => a | b },
  { id: 'xor', label: 'A XOR B', fn: (a, b) => a ^ b },
  { id: 'nand', label: 'A NAND B', fn: (a, b) => (a & b ? 0 : 1) },
  { id: 'nor', label: 'A NOR B', fn: (a, b) => (a | b ? 0 : 1) },
  { id: 'implies', label: 'A → B', fn: (a, b) => (a && !b ? 0 : 1) },
  { id: 'not', label: 'NOT A', unary: true, fn: (a) => (a ? 0 : 1) },
];

export default function TruthTable() {
  const [opId, setOpId] = useState('and');
  const op = OPS.find((o) => o.id === opId)!;
  const rows = op.unary ? [[0], [1]] : [[0, 0], [0, 1], [1, 0], [1, 1]];

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap gap-1.5">
        {OPS.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setOpId(o.id)}
            aria-pressed={opId === o.id}
            className={`rounded border px-2.5 py-1 font-mono text-xs transition ${opId === o.id ? 'border-accent bg-accent text-accent-fg' : 'border-edge text-muted hover:text-fg'}`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <table className="w-full max-w-xs border-collapse text-center font-mono text-sm">
        <thead>
          <tr className="text-muted">
            <th className="border border-edge px-3 py-1.5">A</th>
            {!op.unary && <th className="border border-edge px-3 py-1.5">B</th>}
            <th className="border border-edge px-3 py-1.5 text-accent">{op.label}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const res = op.fn(r[0], r[1] ?? 0);
            return (
              <tr key={i}>
                <td className="border border-edge px-3 py-1.5 text-fg">{r[0]}</td>
                {!op.unary && <td className="border border-edge px-3 py-1.5 text-fg">{r[1]}</td>}
                <td className={`border border-edge px-3 py-1.5 font-semibold ${res ? 'text-emerald-400' : 'text-rose-400'}`}>{res}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="mt-3 text-xs text-muted">1 = true, 0 = false. These are the building blocks of every digital circuit and boolean expression.</p>
    </div>
  );
}
