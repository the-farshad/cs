import { useMemo } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

/**
 * Walks one wide, redundant table through 1NF -> 2NF -> 3NF. Each stage renders
 * the resulting table(s); cells that are redundant *at the current stage* are
 * tinted rose so the reader sees duplication shrink as the schema is decomposed.
 */

type Cell = { v: string; dup?: boolean; pk?: boolean; fk?: boolean };
type Tbl = { name: string; cols: string[]; rows: Cell[][]; caption?: string };

type Stage = {
  key: string;
  title: string;
  rule: string;
  anomaly: string;
  tables: Tbl[];
};

const AMBER = '#fbbf24';
const ROSE = '#f43f5e';
const EMERALD = '#10b981';
const VIOLET = '#8b5cf6';

const c = (v: string, extra: Partial<Cell> = {}): Cell => ({ v, ...extra });

/* ---- Stage 0: an unnormalized order log with a multi-valued column ---- */
const stage0: Stage = {
  key: '0nf',
  title: 'Unnormalized',
  rule: 'One row holds many products in a single comma-separated cell.',
  anomaly: 'You cannot query or total a single product — the cell is a list, not a value.',
  tables: [
    {
      name: 'orders',
      cols: ['order_id', 'customer', 'city', 'products'],
      rows: [
        [c('1001'), c('Ada'), c('Berlin'), c('Pen x2, Ink x1', { dup: true })],
        [c('1002'), c('Linus'), c('Oslo'), c('Pen x1', { dup: true })],
      ],
    },
  ],
};

/* ---- Stage 1NF: atomic values, one product per row (now repetition shows) ---- */
const stage1: Stage = {
  key: '1nf',
  title: '1NF — atomic values',
  rule: 'Each cell holds one value; split the list into one row per product. The key is now (order_id, product).',
  anomaly: 'customer and city now repeat for every product line of the same order.',
  tables: [
    {
      name: 'order_lines',
      cols: ['order_id', 'product', 'qty', 'customer', 'city'],
      rows: [
        [c('1001', { pk: true }), c('Pen', { pk: true }), c('2'), c('Ada', { dup: true }), c('Berlin', { dup: true })],
        [c('1001', { pk: true }), c('Ink', { pk: true }), c('1'), c('Ada', { dup: true }), c('Berlin', { dup: true })],
        [c('1002', { pk: true }), c('Pen', { pk: true }), c('1'), c('Linus'), c('Oslo')],
      ],
    },
  ],
};

/* ---- Stage 2NF: remove partial dependencies on part of the composite key ---- */
const stage2: Stage = {
  key: '2nf',
  title: '2NF — no partial dependencies',
  rule: 'customer & city depend on order_id alone, not the whole key. Move them to an orders table.',
  anomaly: 'city still depends on customer, not on order_id — a transitive dependency remains.',
  tables: [
    {
      name: 'order_lines',
      cols: ['order_id', 'product', 'qty'],
      rows: [
        [c('1001', { pk: true, fk: true }), c('Pen', { pk: true }), c('2')],
        [c('1001', { pk: true, fk: true }), c('Ink', { pk: true }), c('1')],
        [c('1002', { pk: true, fk: true }), c('Pen', { pk: true }), c('1')],
      ],
    },
    {
      name: 'orders',
      cols: ['order_id', 'customer', 'city'],
      rows: [
        [c('1001', { pk: true }), c('Ada'), c('Berlin', { dup: true })],
        [c('1002', { pk: true }), c('Linus'), c('Oslo')],
      ],
      caption: 'one row per order — customer no longer repeats per product',
    },
  ],
};

/* ---- Stage 3NF: remove transitive dependency (city via customer) ---- */
const stage3: Stage = {
  key: '3nf',
  title: '3NF — no transitive dependencies',
  rule: 'city depends on customer, not on order_id. Give customers their own table.',
  anomaly: 'None of these anomalies remain: every non-key column depends on the key, the whole key, and nothing but the key.',
  tables: [
    {
      name: 'order_lines',
      cols: ['order_id', 'product', 'qty'],
      rows: [
        [c('1001', { pk: true, fk: true }), c('Pen', { pk: true }), c('2')],
        [c('1001', { pk: true, fk: true }), c('Ink', { pk: true }), c('1')],
        [c('1002', { pk: true, fk: true }), c('Pen', { pk: true }), c('1')],
      ],
    },
    {
      name: 'orders',
      cols: ['order_id', 'customer_id'],
      rows: [
        [c('1001', { pk: true }), c('1', { fk: true })],
        [c('1002', { pk: true }), c('2', { fk: true })],
      ],
    },
    {
      name: 'customers',
      cols: ['customer_id', 'name', 'city'],
      rows: [
        [c('1', { pk: true }), c('Ada'), c('Berlin')],
        [c('2', { pk: true }), c('Linus'), c('Oslo')],
      ],
      caption: 'each fact stored once — update a city in exactly one place',
    },
  ],
};

const STAGES: Stage[] = [stage0, stage1, stage2, stage3];

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function NormalizationVisualizer() {
  const stages = STAGES;
  // One frame per stage; reuse the stepper purely as a stage stepper.
  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(stages.length, 1);
  const i = Math.min(index, stages.length - 1);
  const stage = stages[i];

  // Count tinted (redundant) cells at this stage for the running tally.
  const dupCount = useMemo(
    () => stage.tables.reduce((s, t) => s + t.rows.flat().filter((cell) => cell.dup).length, 0),
    [stage],
  );

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      {/* stage rail */}
      <div className="mb-4 flex items-center gap-1.5">
        {stages.map((s, k) => (
          <button
            key={s.key}
            type="button"
            onClick={() => seek(k)}
            className={`flex-1 rounded border px-2 py-1 text-center text-xs transition ${
              k === i ? 'border-accent text-accent' : k < i ? 'border-edge text-muted' : 'border-edge text-muted/50'
            }`}
            style={k === i ? { background: 'color-mix(in oklab, var(--accent) 10%, transparent)' } : undefined}
          >
            {s.key.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="mb-3">
        <div className="font-mono text-sm text-fg">{stage.title}</div>
        <p className="mt-1 text-xs text-muted">{stage.rule}</p>
      </div>

      {/* tables */}
      <div className="space-y-4">
        {stage.tables.map((t) => (
          <div key={t.name} className="overflow-x-auto rounded-lg border border-edge">
            <div className="flex items-center gap-2 border-b border-edge bg-bg/40 px-3 py-1.5">
              <Icon name="database" size={14} className="text-muted" />
              <span className="font-mono text-xs text-fg">{t.name}</span>
              {t.caption && <span className="ml-auto text-[11px] text-muted">{t.caption}</span>}
            </div>
            <table className="w-full border-collapse text-left font-mono text-xs">
              <thead>
                <tr className="bg-bg/50">
                  {t.cols.map((col, ci) => {
                    // header tinting: mark which columns form the key in this table
                    const isKey = t.rows[0]?.[ci]?.pk;
                    const isFk = t.rows.some((r) => r[ci]?.fk);
                    return (
                      <th
                        key={col}
                        className="border-b border-edge px-3 py-2"
                        style={{ color: isKey ? VIOLET : isFk ? AMBER : 'var(--fg)' }}
                      >
                        {col}
                        {isKey && <span className="ml-1 text-[9px]">PK</span>}
                        {!isKey && isFk && <span className="ml-1 text-[9px]">FK</span>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {t.rows.map((row, ri) => (
                  <tr key={ri} className="odd:bg-bg/20">
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="border-b border-edge/50 px-3 py-1.5 transition"
                        style={
                          cell.dup
                            ? { color: ROSE, background: 'color-mix(in oklab, ' + ROSE + ' 12%, transparent)' }
                            : cell.pk
                              ? { color: VIOLET }
                              : cell.fk
                                ? { color: AMBER }
                                : { color: 'var(--muted)' }
                        }
                      >
                        {cell.v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* anomaly / status banner */}
      <div
        className="mt-4 rounded-lg border px-3 py-2 text-xs"
        style={
          dupCount === 0
            ? { borderColor: EMERALD, color: EMERALD }
            : { borderColor: ROSE, color: ROSE }
        }
      >
        {dupCount === 0 ? 'No redundancy: ' : `Redundant cells: ${dupCount}. `}
        {stage.anomaly}
      </div>

      {/* controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={prev} disabled={index <= 0}>
          <Icon name="chevron-left" size={16} /> Back
        </button>
        <button
          type="button"
          onClick={() => (playing ? pause() : play())}
          className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-4 py-1 text-sm font-medium text-accent-fg transition hover:opacity-90"
        >
          <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" className={btn} onClick={next} disabled={index >= stages.length - 1}>
          Decompose <Icon name="chevron-right" size={16} />
        </button>
        <button type="button" className={btn} onClick={reset} disabled={index === 0}>
          <Icon name="rotate-ccw" size={16} /> Reset
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={1} max={4} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={stages.length - 1}
          value={index}
          onChange={(e) => seek(Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
          aria-label="Stage"
        />
        <span className="shrink-0 font-mono text-xs text-muted">{i + 1}/{stages.length}</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-edge pt-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: VIOLET }} /> primary key</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: AMBER }} /> foreign key</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: ROSE }} /> redundant / anomaly</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: EMERALD }} /> normalized</span>
      </div>
    </div>
  );
}
