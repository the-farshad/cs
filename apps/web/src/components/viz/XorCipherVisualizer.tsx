import { useMemo, useState } from 'react';
import { useStepper } from './useStepper';
import Icon from '@/components/ui/Icon';

// Encode a string to an array of byte values.
function bytes(s: string): number[] {
  return Array.from(s).map((c) => c.charCodeAt(0) & 0xff);
}

// Repeat the key to the length of the message (a stream-cipher / OTP-style XOR).
function keyStream(key: string, len: number): number[] {
  const k = bytes(key);
  if (k.length === 0) return new Array(len).fill(0);
  return Array.from({ length: len }, (_, i) => k[i % k.length]);
}

function toBin(n: number): string {
  return n.toString(2).padStart(8, '0');
}

// A printable glyph for a byte (control bytes shown as a dot).
function glyph(n: number): string {
  return n >= 32 && n < 127 ? String.fromCharCode(n) : '·';
}

type Frame = { col: number; note: string };

const btn =
  'inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-edge disabled:hover:text-fg';

export default function XorCipherVisualizer() {
  const [plain, setPlain] = useState('HELLO');
  const [key, setKey] = useState('KEY');
  const [reuseKey, setReuseKey] = useState(false);

  const p = useMemo(() => bytes(plain), [plain]);
  const ks = useMemo(() => keyStream(key, p.length), [key, p.length]);
  const cipher = useMemo(() => p.map((b, i) => b ^ ks[i]), [p, ks]);
  const decoded = useMemo(() => cipher.map((b, i) => b ^ ks[i]), [cipher, ks]);

  // One frame per column, revealing the XOR left to right, then a final summary.
  const frames = useMemo<Frame[]>(() => {
    const f: Frame[] = [{ col: -1, note: 'Plaintext and key are lined up byte by byte.' }];
    for (let i = 0; i < p.length; i++) {
      f.push({
        col: i,
        note: `${toBin(p[i])} XOR ${toBin(ks[i])} = ${toBin(cipher[i])}  (encrypt '${glyph(p[i])}')`,
      });
    }
    f.push({ col: p.length, note: 'Ciphertext complete. Decryption is the same XOR with the same key.' });
    return f;
  }, [p, ks, cipher]);

  const { index, playing, fps, setFps, play, pause, next, prev, reset, seek } = useStepper(frames.length, 4);
  const frame = frames[Math.min(index, frames.length - 1)] ?? frames[0];
  const revealed = frame.col >= p.length ? p.length : Math.max(frame.col + 1, 0);

  const Row = ({ label, vals, color, upto }: { label: string; vals: number[]; color: string; upto: number }) => (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-right text-xs text-muted">{label}</span>
      <div className="flex gap-1">
        {vals.map((b, i) => {
          const shown = i < upto;
          const active = i === frame.col;
          return (
            <div
              key={i}
              className="flex w-12 flex-col items-center justify-center rounded border py-1"
              style={{
                borderColor: active ? color : 'var(--border)',
                background: active ? 'color-mix(in oklab, var(--surface), transparent 0%)' : 'transparent',
                opacity: shown ? 1 : 0.25,
              }}
            >
              <span className="font-mono text-sm" style={{ color: shown ? color : 'var(--muted)' }}>
                {glyph(b)}
              </span>
              <span className="font-mono text-[10px] text-muted">{shown ? toBin(b) : '········'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-muted">Plaintext</label>
          <input
            value={plain}
            onChange={(e) => setPlain(e.target.value.slice(0, 12))}
            className="w-full rounded border border-edge bg-bg px-3 py-1.5 font-mono text-sm text-fg"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Key</label>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value.slice(0, 12))}
            className="w-full rounded border border-edge bg-bg px-3 py-1.5 font-mono text-sm text-fg"
          />
        </div>
      </div>

      <div className="space-y-2 overflow-x-auto">
        <Row label="plaintext" vals={p} color="#38bdf8" upto={p.length} />
        <Row label="key (XOR)" vals={ks} color="#fbbf24" upto={p.length} />
        <Row label="ciphertext" vals={cipher} color="#8b5cf6" upto={revealed} />
        <Row label="decrypted" vals={decoded} color="#10b981" upto={frame.col >= p.length ? p.length : 0} />
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
        <button type="button" className={btn} onClick={next} disabled={index >= frames.length - 1}>
          Step <Icon name="chevron-right" size={16} />
        </button>
        <button type="button" className={btn} onClick={reset} disabled={index === 0}>
          <Icon name="rotate-ccw" size={16} /> Reset
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Speed
          <input type="range" min={1} max={10} value={fps} onChange={(e) => setFps(Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={Math.max(frames.length - 1, 0)}
          value={index}
          onChange={(e) => seek(Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
          aria-label="Timeline"
        />
        <span className="shrink-0 font-mono text-xs text-muted">
          {index + 1}/{frames.length}
        </span>
      </div>

      <div className="mt-4 border-t border-edge pt-4 font-mono text-xs text-fg">{frame.note}</div>

      <div className="mt-4 rounded-lg border border-edge bg-bg/40 p-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={reuseKey} onChange={(e) => setReuseKey(e.target.checked)} className="accent-[var(--accent)]" />
          Show why reusing one key for two messages is unsafe
        </label>
        {reuseKey && (
          <KeyReuseDemo />
        )}
      </div>
    </div>
  );
}

// Demonstrates the classic two-time-pad weakness: C1 XOR C2 cancels the key,
// leaking P1 XOR P2 to an eavesdropper who never learns the key.
function KeyReuseDemo() {
  const m1 = 'SECRET';
  const m2 = 'ATTACK';
  const k = bytes('KEY KEY'.slice(0, m1.length));
  const c1 = bytes(m1).map((b, i) => b ^ k[i]);
  const c2 = bytes(m2).map((b, i) => b ^ k[i]);
  const leak = c1.map((b, i) => b ^ c2[i]); // == P1 XOR P2
  const truth = bytes(m1).map((b, i) => b ^ bytes(m2)[i]);

  return (
    <div className="mt-3 space-y-1 font-mono text-xs text-muted">
      <div>
        Same key on two messages → an eavesdropper computes{' '}
        <span style={{ color: '#f43f5e' }}>C1 XOR C2</span>:
      </div>
      <div>
        C1 XOR C2 = [{leak.join(', ')}]
      </div>
      <div>
        P1 XOR P2 = [{truth.join(', ')}] <span className="text-muted/70">(identical)</span>
      </div>
      <div style={{ color: '#fbbf24' }}>
        The key cancels out, so the relationship between the two plaintexts leaks. A one-time pad must use each key
        exactly once.
      </div>
    </div>
  );
}
