import { useState } from 'react';
import Icon from '@/components/ui/Icon';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

const BITS = 8;
const MASK = (1 << BITS) - 1; // 255

const toBits = (n: number): number[] => {
  const b: number[] = [];
  for (let i = BITS - 1; i >= 0; i--) b.push((n >> i) & 1);
  return b; // most-significant first
};

type OpKind =
  | { kind: 'and'; operand: number }
  | { kind: 'or'; operand: number }
  | { kind: 'xor'; operand: number }
  | { kind: 'not' }
  | { kind: 'shl' }
  | { kind: 'shr' };

function apply(a: number, op: OpKind): number {
  switch (op.kind) {
    case 'and':
      return (a & op.operand) & MASK;
    case 'or':
      return (a | op.operand) & MASK;
    case 'xor':
      return (a ^ op.operand) & MASK;
    case 'not':
      return ~a & MASK;
    case 'shl':
      return (a << 1) & MASK;
    case 'shr':
      return a >> 1;
  }
}

function opLabel(op: OpKind): string {
  switch (op.kind) {
    case 'and':
      return `AND ${op.operand}`;
    case 'or':
      return `OR ${op.operand}`;
    case 'xor':
      return `XOR ${op.operand}`;
    case 'not':
      return 'NOT (~)';
    case 'shl':
      return '<< 1';
    case 'shr':
      return '>> 1';
  }
}

function BitRow({
  label,
  value,
  changed,
  emphasis,
}: {
  label: string;
  value: number;
  changed?: boolean[];
  emphasis?: boolean;
}) {
  const bits = toBits(value);
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 font-mono text-xs text-muted">{label}</span>
      <div className="flex gap-1">
        {bits.map((bit, i) => {
          const isChanged = changed?.[i];
          const on = bit === 1;
          let cls = on ? 'border-accent bg-accent text-accent-fg' : 'border-edge text-muted';
          if (isChanged) cls = on ? 'border-emerald-500 bg-emerald-500 text-[#04140d]' : 'border-rose-500 text-rose-400';
          return (
            <div
              key={i}
              className={`flex h-9 w-8 items-center justify-center rounded border-2 font-mono text-sm transition-colors ${cls} ${emphasis ? 'shadow-[0_0_0_2px_var(--accent)]' : ''}`}
              title={`bit ${BITS - 1 - i} (value ${1 << (BITS - 1 - i)})`}
            >
              {bit}
            </div>
          );
        })}
      </div>
      <span className="ml-2 w-16 shrink-0 font-mono text-sm text-fg">= {value}</span>
    </div>
  );
}

export default function BitManipulationVisualizer() {
  const [value, setValue] = useState(0b00101100); // 44
  const [operand, setOperand] = useState(0b00001111); // 15
  const [prev, setPrev] = useState<number | null>(null);
  const [lastOp, setLastOp] = useState<OpKind | null>(null);

  const run = (op: OpKind) => {
    setPrev(value);
    setLastOp(op);
    setValue(apply(value, op));
  };

  const reset = () => {
    setValue(0b00101100);
    setPrev(null);
    setLastOp(null);
  };

  const valBits = toBits(value);
  const prevBits = prev !== null ? toBits(prev) : null;
  const changed = prevBits ? valBits.map((b, i) => b !== prevBits[i]) : undefined;

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="space-y-2">
        {prev !== null && <BitRow label="before" value={prev} />}
        {lastOp && 'operand' in lastOp && <BitRow label="operand" value={lastOp.operand} />}
        <BitRow label={prev !== null ? 'after' : 'value'} value={value} changed={changed} emphasis />
      </div>

      <div className="mt-5 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted">
            value {value}
            <input type="range" min={0} max={MASK} value={value} onChange={(e) => { setValue(Number(e.target.value)); setPrev(null); setLastOp(null); }} className="accent-[var(--accent)]" />
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            operand {operand}
            <input type="range" min={0} max={MASK} value={operand} onChange={(e) => setOperand(Number(e.target.value))} className="accent-[var(--accent)]" />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} onClick={() => run({ kind: 'and', operand })}>AND</button>
          <button type="button" className={btn} onClick={() => run({ kind: 'or', operand })}>OR</button>
          <button type="button" className={btn} onClick={() => run({ kind: 'xor', operand })}>XOR</button>
          <button type="button" className={btn} onClick={() => run({ kind: 'not' })}>NOT</button>
          <button type="button" className={btn} onClick={() => run({ kind: 'shl' })}>
            <Icon name="arrow-left" size={15} /> &lt;&lt; 1
          </button>
          <button type="button" className={btn} onClick={() => run({ kind: 'shr' })}>
            &gt;&gt; 1 <Icon name="arrow-right" size={15} />
          </button>
          <button type="button" className={`${btn} ml-auto`} onClick={reset}>
            <Icon name="rotate-ccw" size={15} /> Reset
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-edge pt-4 text-xs text-muted">
        <span className="font-mono">{lastOp ? `last: ${opLabel(lastOp)}` : 'apply an operation to see bits flip'}</span>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm border-2 border-emerald-500 bg-emerald-500" /> set to 1</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm border-2 border-rose-500" /> cleared to 0</span>
        </div>
      </div>
    </div>
  );
}
