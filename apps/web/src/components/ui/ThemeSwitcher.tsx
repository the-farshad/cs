import { useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';

const THEMES = [
  { id: 'retro-gold', label: 'Gold', icon: 'palette' },
  { id: 'dark-dev', label: 'Dark', icon: 'moon' },
  { id: 'clean-edu', label: 'Light', icon: 'sun' },
] as const;

type ThemeId = (typeof THEMES)[number]['id'];

export default function ThemeSwitcher() {
  // null until mounted so SSR and first client render match (no hydration mismatch).
  const [theme, setTheme] = useState<ThemeId | null>(null);

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
  };

  return (
    <div className="inline-flex rounded-md border border-edge p-0.5" role="group" aria-label="Theme">
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => choose(t.id)}
          aria-pressed={theme === t.id}
          aria-label={t.label}
          title={t.label}
          className={`flex items-center justify-center rounded p-1.5 transition ${
            theme === t.id ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'
          }`}
        >
          <Icon name={t.icon} size={16} />
        </button>
      ))}
    </div>
  );
}
