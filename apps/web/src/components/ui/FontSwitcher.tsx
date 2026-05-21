import { useEffect, useState } from 'react';

const FONTS = [
  { id: 'auto', label: 'Auto' },
  { id: 'ubuntu', label: 'Ubuntu' },
  { id: 'roboto', label: 'Roboto' },
  { id: 'retro', label: 'Retro' },
  { id: 'mono', label: 'Mono' },
] as const;

type FontId = (typeof FONTS)[number]['id'];

export default function FontSwitcher() {
  const [font, setFont] = useState<FontId>('auto');

  useEffect(() => {
    setFont((document.documentElement.dataset.font as FontId) || 'auto');
  }, []);

  const choose = (id: FontId) => {
    setFont(id);
    if (id === 'auto') delete document.documentElement.dataset.font;
    else document.documentElement.dataset.font = id;
    try {
      if (id === 'auto') localStorage.removeItem('cs-font');
      else localStorage.setItem('cs-font', id);
    } catch {
      /* ignore */
    }
  };

  return (
    <select
      value={font}
      onChange={(e) => choose(e.target.value as FontId)}
      aria-label="Font"
      className="rounded-md border border-edge bg-bg px-2 py-1 text-xs text-fg"
    >
      {FONTS.map((f) => (
        <option key={f.id} value={f.id}>
          {f.label}
        </option>
      ))}
    </select>
  );
}
