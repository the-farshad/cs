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
    <div className="inline-flex rounded-md border border-edge p-0.5" role="group" aria-label="Font">
      {FONTS.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => choose(f.id)}
          aria-pressed={font === f.id}
          className={`rounded px-1.5 py-1 text-xs transition ${font === f.id ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
