export type VizNode = { id: number; x: number; y: number; label: string; sub?: string; state?: string };
export type VizEdge = { from: number; to: number };

const COLORS: Record<string, { fill: string; stroke: string; text: string }> = {
  default: { fill: 'var(--surface)', stroke: 'var(--border)', text: 'var(--fg)' },
  compare: { fill: 'var(--surface)', stroke: '#fbbf24', text: 'var(--fg)' },
  active: { fill: 'var(--accent)', stroke: 'var(--accent)', text: 'var(--accent-fg)' },
  found: { fill: '#10b981', stroke: '#10b981', text: '#04140d' },
  rotated: { fill: 'var(--surface)', stroke: '#8b5cf6', text: 'var(--fg)' },
  done: { fill: 'color-mix(in oklab, #10b981 22%, var(--surface))', stroke: '#10b981', text: 'var(--fg)' },
  cache: { fill: 'var(--surface)', stroke: 'var(--muted)', text: 'var(--muted)' },
};

export default function TreeCanvas({
  nodes,
  edges,
  width,
  height,
  r = 18,
}: {
  nodes: VizNode[];
  edges: VizEdge[];
  width: number;
  height: number;
  r?: number;
}) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return (
    <svg viewBox={`0 0 ${width} ${Math.max(height, 1)}`} className="mx-auto block w-full" style={{ maxHeight: '24rem' }} role="img" aria-label="tree">
      {edges.map((e, i) => {
        const a = byId.get(e.from);
        const b = byId.get(e.to);
        if (!a || !b) return null;
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={{ stroke: 'var(--border)' }} strokeWidth={2} />;
      })}
      {nodes.map((n) => {
        const c = COLORS[n.state ?? 'default'] ?? COLORS.default;
        return (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r={r} style={{ fill: c.fill, stroke: c.stroke }} strokeWidth={2.5} />
            <text
              x={n.x}
              y={n.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={14}
              style={{ fill: c.text, fontFamily: 'var(--font-mono)' }}
            >
              {n.label}
            </text>
            {n.sub && (
              <text x={n.x} y={n.y + r + 12} textAnchor="middle" fontSize={11} style={{ fill: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                {n.sub}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
