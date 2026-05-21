import { useEffect, useState } from 'react';

const THEMES = [
  { id: 'retro-gold', label: 'Gold' },
  { id: 'dark-dev', label: 'Dark' },
  { id: 'clean-edu', label: 'Light' },
] as const;

type ThemeId = (typeof THEMES)[number]['id'];

export default function ThemeSwitcher() {
  // null until mounted so SSR and first client render match (no hydration mismatch).
  const [theme, setTheme] = useState<ThemeId | null>(null);

  useEffect(() => {
    const current = (document.documentElement.dataset.theme as ThemeId) || 'retro-gold';
    setTheme(current);
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
          className={`rounded px-2 py-1 text-xs transition ${
            theme === t.id ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
