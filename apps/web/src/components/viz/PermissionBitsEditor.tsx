import { useState } from 'react';
import Icon from '@/components/ui/Icon';

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent';

type Bits = [boolean, boolean, boolean]; // r, w, x
type Perms = { u: Bits; g: Bits; o: Bits };

const CLASSES: { key: keyof Perms; label: string; who: string }[] = [
  { key: 'u', label: 'user', who: 'owner' },
  { key: 'g', label: 'group', who: 'group members' },
  { key: 'o', label: 'other', who: 'everyone else' },
];

const BITS: { idx: 0 | 1 | 2; sym: string; label: string; val: number }[] = [
  { idx: 0, sym: 'r', label: 'read', val: 4 },
  { idx: 1, sym: 'w', label: 'write', val: 2 },
  { idx: 2, sym: 'x', label: 'execute', val: 1 },
];

const octalDigit = (b: Bits) => (b[0] ? 4 : 0) + (b[1] ? 2 : 0) + (b[2] ? 1 : 0);
const symbolFor = (b: Bits) => `${b[0] ? 'r' : '-'}${b[1] ? 'w' : '-'}${b[2] ? 'x' : '-'}`;

const PRESETS: { label: string; perms: Perms }[] = [
  { label: '644 file', perms: { u: [true, true, false], g: [true, false, false], o: [true, false, false] } },
  { label: '755 script', perms: { u: [true, true, true], g: [true, false, true], o: [true, false, true] } },
  { label: '750 private dir', perms: { u: [true, true, true], g: [true, false, true], o: [false, false, false] } },
  { label: '600 secret', perms: { u: [true, true, false], g: [false, false, false], o: [false, false, false] } },
];

const ACCENT = 'var(--accent)';

export default function PermissionBitsEditor() {
  const [perms, setPerms] = useState<Perms>(PRESETS[1].perms);
  const [isDir, setIsDir] = useState(false);

  const toggle = (cls: keyof Perms, idx: 0 | 1 | 2) =>
    setPerms((p) => {
      const next: Bits = [...p[cls]] as Bits;
      next[idx] = !next[idx];
      return { ...p, [cls]: next };
    });

  const octal = `${octalDigit(perms.u)}${octalDigit(perms.g)}${octalDigit(perms.o)}`;
  const symbolic = symbolFor(perms.u) + symbolFor(perms.g) + symbolFor(perms.o);
  const typeChar = isDir ? 'd' : '-';
  const fname = isDir ? 'project/' : 'deploy.sh';

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" className="rounded border border-edge px-2 py-0.5 font-mono text-xs text-muted transition hover:border-accent hover:text-accent" onClick={() => setPerms(p.perms)}>
            {p.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted">
          <input type="checkbox" checked={isDir} onChange={(e) => setIsDir(e.target.checked)} className="accent-[var(--accent)]" />
          directory
        </label>
      </div>

      {/* Three classes, each with three toggleable bits */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {CLASSES.map(({ key, label, who }) => (
          <div key={key} className="rounded-lg border border-edge bg-bg p-3">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="font-mono text-sm text-fg">{label}</span>
              <span className="font-mono text-lg font-semibold" style={{ color: ACCENT }}>
                {octalDigit(perms[key])}
              </span>
            </div>
            <div className="mb-2 text-[11px] text-muted">{who}</div>
            <div className="flex gap-2">
              {BITS.map(({ idx, sym, label: blabel, val }) => {
                const on = perms[key][idx];
                return (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => toggle(key, idx)}
                    aria-pressed={on}
                    aria-label={`${label} ${blabel}`}
                    className="flex flex-1 flex-col items-center rounded border py-2 font-mono transition"
                    style={{
                      borderColor: on ? ACCENT : 'var(--edge)',
                      background: on ? 'color-mix(in oklab, var(--accent) 16%, var(--bg))' : 'transparent',
                      color: on ? ACCENT : 'var(--muted)',
                    }}
                  >
                    <span className="text-base font-semibold">{on ? sym : '-'}</span>
                    <span className="text-[10px]">+{val}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Live ls -l style line */}
      <div className="mt-4 rounded-lg border border-edge bg-bg p-3">
        <div className="mb-1 font-mono text-[11px] uppercase tracking-wide text-muted">ls -l</div>
        <div className="flex flex-wrap items-baseline gap-x-3 font-mono text-base">
          <span>
            <span className="text-muted">{typeChar}</span>
            <span style={{ color: ACCENT }}>{symbolFor(perms.u)}</span>
            <span className="text-fg">{symbolFor(perms.g)}</span>
            <span className="text-muted">{symbolFor(perms.o)}</span>
          </span>
          <span className="text-muted">learner staff</span>
          <span className="text-fg">{fname}</span>
        </div>
      </div>

      {/* Symbolic + octal + chmod command */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-edge bg-bg p-3">
          <div className="mb-1 font-mono text-[11px] uppercase tracking-wide text-muted">symbolic</div>
          <code className="font-mono text-lg text-fg">{symbolic}</code>
        </div>
        <div className="rounded-lg border bg-bg p-3" style={{ borderColor: ACCENT }}>
          <div className="mb-1 font-mono text-[11px] uppercase tracking-wide" style={{ color: ACCENT }}>
            octal
          </div>
          <code className="font-mono text-2xl font-semibold" style={{ color: ACCENT }}>
            {octal}
          </code>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-edge bg-bg p-3">
        <Icon name="terminal" size={16} className="text-muted" />
        <code className="font-mono text-sm text-fg">
          chmod {octal} {fname}
        </code>
        <span className="text-muted">≡</span>
        <code className="font-mono text-sm text-fg">
          chmod u={symbolFor(perms.u).replace(/-/g, '')},g={symbolFor(perms.g).replace(/-/g, '')},o=
          {symbolFor(perms.o).replace(/-/g, '')} {fname}
        </code>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-edge pt-3 text-xs text-muted">
        <span>
          For a directory, <span className="font-mono text-fg">x</span> means "may enter / traverse", not "execute".
        </span>
        <button type="button" className={btn} onClick={() => setPerms(PRESETS[1].perms)}>
          <Icon name="rotate-ccw" size={14} /> Reset
        </button>
      </div>
    </div>
  );
}
