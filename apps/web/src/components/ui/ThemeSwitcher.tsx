import { useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';

const THEMES = [
  { id: 'retro-gold', label: 'Gold', icon: 'palette' },
  { id: 'dark-dev', label: 'Dark', icon: 'moon' },
  { id: 'clean-edu', label: 'Light', icon: 'sun' },
] as const;

type ThemeId = (typeof THEMES)[number]['id'];

/** Collapsed selector: shows the current theme; expands on hover or click. */
export default function ThemeSwitcher() {
  // null until mounted so SSR and first client render match (no hydration mismatch).
  const [theme, setTheme] = useState<ThemeId | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setTheme((document.documentElement.dataset.theme as ThemeId) || 'retro-gold');
  }, []);

  const choose = (id: ThemeId) => {
    setTheme(id);
    document.documentElement.dataset.theme = id;
    try {
      localStorage.setItem('cs-theme', id);
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  return (
    <div className="group relative" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        title="Theme"
        className="flex h-7 items-center gap-1.5 rounded-md border border-edge px-2 text-xs text-fg transition hover:border-accent"
      >
        <Icon name={current.icon} size={14} />
        <span className="hidden sm:inline">{current.label}</span>
        <Icon name="chevron-down" size={12} className="text-muted" />
      </button>
      <div
        className={`absolute right-0 z-50 mt-1 min-w-[7.5rem] rounded-md border border-edge bg-surface p-1 shadow-lg ${open ? 'block' : 'hidden group-hover:block'}`}
        role="listbox"
        aria-label="Theme"
      >
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => choose(t.id)}
            aria-selected={theme === t.id}
            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition ${theme === t.id ? 'bg-accent text-accent-fg' : 'text-fg hover:bg-accent/10'}`}
          >
            <Icon name={t.icon} size={14} /> {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
