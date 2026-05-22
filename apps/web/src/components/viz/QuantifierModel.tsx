import { useState } from 'react';

/** A finite model for exploring quantifiers: a small domain of shapes, with the
 *  universal/existential statements about "every K is C" / "some K is C" evaluated
 *  over it, highlighting witnesses and counterexamples. */

type Shape = 'circle' | 'square' | 'triangle';
type Color = 'blue' | 'amber' | 'rose';
type Obj = { id: number; shape: Shape; color: Color };

const DOMAIN: Obj[] = [
  { id: 1, shape: 'circle', color: 'blue' },
  { id: 2, shape: 'circle', color: 'amber' },
  { id: 3, shape: 'square', color: 'blue' },
  { id: 4, shape: 'square', color: 'blue' },
  { id: 5, shape: 'triangle', color: 'rose' },
  { id: 6, shape: 'circle', color: 'blue' },
];

const HEX: Record<Color, string> = { blue: '#38bdf8', amber: '#fbbf24', rose: '#f43f5e' };
const SHAPES: Shape[] = ['circle', 'square', 'triangle'];
const COLORS: Color[] = ['blue', 'amber', 'rose'];

function Glyph({ o, ring }: { o: Obj; ring: 'none' | 'witness' | 'counter' }) {
  const fill = HEX[o.color];
  const stroke = ring === 'witness' ? '#10b981' : ring === 'counter' ? '#f43f5e' : 'transparent';
  return (
    <svg width={56} height={56} viewBox="0 0 56 56" role="img" aria-label={`${o.color} ${o.shape}`}>
      {ring !== 'none' && <rect x={2} y={2} width={52} height={52} rx={8} fill="none" stroke={stroke} strokeWidth={3} strokeDasharray="4 3" />}
      {o.shape === 'circle' && <circle cx={28} cy={28} r={15} fill={fill} />}
      {o.shape === 'square' && <rect x={14} y={14} width={28} height={28} rx={3} fill={fill} />}
      {o.shape === 'triangle' && <polygon points="28,12 44,42 12,42" fill={fill} />}
    </svg>
  );
}

export default function QuantifierModel() {
  const [kind, setKind] = useState<Shape>('circle');
  const [color, setColor] = useState<Color>('blue');

  const isK = (o: Obj) => o.shape === kind;
  const isC = (o: Obj) => o.color === color;
  const ks = DOMAIN.filter(isK);
  const everyKisC = ks.every(isC); // vacuously true if no K
  const someKisC = DOMAIN.some((o) => isK(o) && isC(o));

  const ring = (o: Obj): 'none' | 'witness' | 'counter' => {
    if (isK(o) && isC(o)) return 'witness'; // satisfies "is K and C"
    if (isK(o) && !isC(o)) return 'counter'; // a K that is not C
    return 'none';
  };

  const sel = 'rounded border border-edge bg-bg px-2 py-1 text-sm text-fg';
  const Verdict = ({ v }: { v: boolean }) => (
    <span className="font-medium" style={{ color: v ? '#10b981' : '#f43f5e' }}>{v ? 'TRUE' : 'FALSE'}</span>
  );

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>Let</span>
        <span className="font-mono text-fg">K(x)</span> <span>= "x is a</span>
        <select value={kind} onChange={(e) => setKind(e.target.value as Shape)} className={sel}>
          {SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span>",</span>
        <span className="font-mono text-fg">C(x)</span> <span>= "x is</span>
        <select value={color} onChange={(e) => setColor(e.target.value as Color)} className={sel}>
          {COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span>".</span>
      </div>

      <div className="flex flex-wrap justify-center gap-3 rounded-lg border border-edge bg-bg/40 p-4">
        {DOMAIN.map((o) => <Glyph key={o.id} o={o} ring={ring(o)} />)}
      </div>
      <div className="mt-2 flex justify-center gap-5 text-xs text-muted">
        <span><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ outline: '2px dashed #10b981' }} /> a K that is C (witness)</span>
        <span><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ outline: '2px dashed #f43f5e' }} /> a K that is not C (counterexample)</span>
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3 rounded border border-edge px-3 py-2">
          <span className="font-mono">∀x (K(x) → C(x))</span>
          <span className="text-muted">every {kind} is {color}: <Verdict v={everyKisC} /></span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded border border-edge px-3 py-2">
          <span className="font-mono">∃x (K(x) ∧ C(x))</span>
          <span className="text-muted">some {kind} is {color}: <Verdict v={someKisC} /></span>
        </div>
      </div>

      <div className="mt-3 border-t border-edge pt-3 text-xs text-muted">
        {ks.length === 0
          ? `There are no ${kind}s, so "every ${kind} is ${color}" is vacuously TRUE and "some ${kind} is ${color}" is FALSE.`
          : everyKisC
            ? `All ${ks.length} ${kind}(s) are ${color}, so the universal holds.`
            : `At least one ${kind} is not ${color} (red ring) — that single counterexample makes the universal FALSE.`}
      </div>
    </div>
  );
}
