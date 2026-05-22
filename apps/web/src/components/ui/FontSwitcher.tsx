import { useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';

const FONTS = [
  { id: 'auto', label: 'Auto' },
  { id: 'ubuntu', label: 'Ubuntu' },
  { id: 'roboto', label: 'Roboto' },
  { id: 'retro', label: 'Retro' },
  { id: 'mono', label: 'Mono' },
] as const;

type FontId = (typeof FONTS)[number]['id'];

/** Collapsed selector: shows the current font; expands on hover or click. */
export default function FontSwitcher() {
  const [font, setFont] = useState<FontId>('auto');
  const [open, setOpen] = useState(false);

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
    setOpen(false);
  };

  const current = FONTS.find((f) => f.id === font) ?? FONTS[0];

  return (
    <div className="group relative" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        title="Font"
        className="flex h-7 items-center gap-1.5 rounded-md border border-edge px-2 text-xs text-fg transition hover:border-accent"
      >
        <Icon name="type" size={14} />
        <span className="hidden sm:inline">{current.label}</span>
        <Icon name="chevron-down" size={12} className="text-muted" />
      </button>
      <div
        className={`absolute right-0 z-50 mt-1 min-w-[7.5rem] rounded-md border border-edge bg-surface p-1 shadow-lg ${open ? 'block' : 'hidden group-hover:block'}`}
        role="listbox"
        aria-label="Font"
      >
        {FONTS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => choose(f.id)}
            aria-selected={font === f.id}
            className={`flex w-full items-center rounded px-2 py-1.5 text-left text-xs transition ${font === f.id ? 'bg-accent text-accent-fg' : 'text-fg hover:bg-accent/10'}`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
