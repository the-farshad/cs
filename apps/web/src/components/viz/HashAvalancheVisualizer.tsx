import { useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';

/**
 * A TOY hash for teaching only — NOT cryptographically secure.
 * It mixes each byte with rotations and a large odd multiplier (FNV-like),
 * then folds a 32-bit state into 16 hex nibbles so the avalanche effect is
 * visible. Real hashes (SHA-256) produce 256 bits and resist collisions.
 */
function toyHash(input: string): string {
  let h = 0x811c9dc5; // 32-bit seed
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    // Math.imul keeps the multiply in 32-bit space.
    h = Math.imul(h, 0x01000193);
    h ^= h >>> 15;
    h = (h << 13) | (h >>> 19); // rotate left 13
    h >>>= 0;
  }
  // Fold the 32-bit state into 16 hex characters by re-mixing per nibble.
  let out = '';
  let state = h >>> 0;
  for (let i = 0; i < 16; i++) {
    state = (Math.imul(state, 0x01000193) ^ (i * 0x9e3779b1)) >>> 0;
    out += ((state >>> 24) & 0xf).toString(16);
  }
  return out;
}

// hex digit -> 4 bits, used to count how many bits differ between two digests.
function hexToBits(hex: string): number[] {
  const bits: number[] = [];
  for (const ch of hex) {
    const v = parseInt(ch, 16);
    for (let b = 3; b >= 0; b--) bits.push((v >> b) & 1);
  }
  return bits;
}

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function HashAvalancheVisualizer() {
  const [message, setMessage] = useState('attack at dawn');

  // The "flipped" message changes one character of the current message so the
  // two digests can be compared side by side.
  const flipped = useMemo(() => {
    if (message.length === 0) return message;
    const chars = message.split('');
    // flip the case (or bump the char) of the first letter; fall back to last.
    const i = 0;
    const c = chars[i];
    const swapped =
      c === c.toLowerCase() && c !== c.toUpperCase()
        ? c.toUpperCase()
        : c === c.toUpperCase() && c !== c.toLowerCase()
          ? c.toLowerCase()
          : String.fromCharCode(c.charCodeAt(0) + 1);
    chars[i] = swapped;
    return chars.join('');
  }, [message]);

  const digestA = useMemo(() => toyHash(message), [message]);
  const digestB = useMemo(() => toyHash(flipped), [flipped]);

  const bitsA = useMemo(() => hexToBits(digestA), [digestA]);
  const bitsB = useMemo(() => hexToBits(digestB), [digestB]);
  const diffBits = bitsA.reduce((s, b, i) => s + (b !== bitsB[i] ? 1 : 0), 0);
  const diffNibbles = digestA.split('').reduce((s, ch, i) => s + (ch !== digestB[i] ? 1 : 0), 0);

  // index of the single character that differs between the two inputs.
  const changedIndex = (() => {
    for (let i = 0; i < Math.max(message.length, flipped.length); i++) {
      if (message[i] !== flipped[i]) return i;
    }
    return -1;
  })();

  const Digest = ({
    label,
    text,
    digest,
    other,
    highlight,
  }: {
    label: string;
    text: string;
    digest: string;
    other: string;
    highlight: number;
  }) => (
    <div className="rounded-lg border border-edge bg-bg/40 p-3">
      <div className="mb-2 text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mb-3 break-all font-mono text-sm text-fg">
        {text.split('').map((ch, i) => (
          <span key={i} className={i === highlight ? 'rounded bg-accent px-0.5 text-accent-fg' : ''}>
            {ch === ' ' ? '·' : ch}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {digest.split('').map((ch, i) => {
          const changed = ch !== other[i];
          return (
            <span
              key={i}
              className="flex h-7 w-7 items-center justify-center rounded font-mono text-sm"
              style={
                changed
                  ? { background: '#f43f5e', color: 'white' }
                  : { borderWidth: 1, borderColor: 'var(--border)', color: 'var(--fg)' }
              }
            >
              {ch}
            </span>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4">
        <label className="mb-1 block text-sm text-muted">Message</label>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="type anything"
          className="w-full rounded border border-edge bg-bg px-3 py-2 font-mono text-sm text-fg"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" className={btn} onClick={() => setMessage((m) => m + '!')}>
          <Icon name="arrow-right" size={15} /> Append a character
        </button>
        <button type="button" className={btn} onClick={() => setMessage('attack at dawn')}>
          <Icon name="rotate-ccw" size={15} /> Reset
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Digest label="your message" text={message || '(empty)'} digest={digestA} other={digestB} highlight={-1} />
        <Digest
          label="one character changed"
          text={flipped || '(empty)'}
          digest={digestB}
          other={digestA}
          highlight={changedIndex}
        />
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-muted">
        <div>
          flipping <span className="text-accent">1 character</span> changed{' '}
          <span style={{ color: '#f43f5e' }}>{diffNibbles}/16</span> hex digits and{' '}
          <span style={{ color: '#f43f5e' }}>
            {diffBits}/64
          </span>{' '}
          bits (about {Math.round((diffBits / 64) * 100)}%) — the avalanche effect.
        </div>
        <div className="mt-1 text-muted/70">
          Toy 64-bit hash for illustration only. Real functions like SHA-256 are 256 bits and collision-resistant.
        </div>
      </div>
    </div>
  );
}
