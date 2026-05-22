import { useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { API_BASE, clearToken, getMe, getToken, type User } from '@/lib/api';

/** Google's multi-color "G" (inline so it keeps brand colors regardless of theme). */
function GoogleG() {
  return (
    <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.2-3.9 6.6-9.6 6.6-16.1z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.1 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.5C3 17.1 2.1 20.4 2.1 24s.9 6.9 2.4 9.9l7.3-5.7z" />
      <path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.1 29.9 2 24 2 15.4 2 8.1 6.9 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9 12.2-9z" />
    </svg>
  );
}

export default function AuthButton() {
  // null until mounted so SSR and first client render match (no hydration mismatch).
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);
  const [open, setOpen] = useState(false);

  // On mount, if a token is present, resolve the current user (graceful: null on failure).
  useEffect(() => {
    let active = true;
    (async () => {
      if (getToken()) {
        const me = await getMe();
        if (active) setUser(me);
      }
      if (active) setChecked(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const signOut = () => {
    clearToken(); // keeps local progress; just drops the session
    setUser(null);
    setOpen(false);
  };

  // Avoid a flash of the wrong state before the token check resolves.
  if (!checked) return null;

  // --- Signed in -----------------------------------------------------------
  if (user) {
    return (
      <div className="inline-flex items-center gap-2 rounded-md border border-edge p-0.5 pl-2">
        <span className="text-xs text-fg" title={user.email}>
          @{user.handle}
        </span>
        <button
          type="button"
          onClick={signOut}
          title="Sign out"
          aria-label="Sign out"
          className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted transition hover:text-fg"
        >
          <Icon name="log-out" size={14} />
        </button>
      </div>
    );
  }

  // --- Signed out: provider choice ----------------------------------------
  if (open) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <a
          href={`${API_BASE}/auth/google`}
          className="inline-flex items-center gap-1.5 rounded-md border border-edge bg-surface px-2 py-1.5 text-xs text-fg transition hover:border-accent"
        >
          <GoogleG /> Google
        </a>
        <a
          href={`${API_BASE}/auth/github`}
          className="inline-flex items-center gap-1.5 rounded-md border border-edge bg-surface px-2 py-1.5 text-xs text-fg transition hover:border-accent"
        >
          <Icon name="github" size={14} /> GitHub
        </a>
      </div>
    );
  }

  // --- Signed out: idle ----------------------------------------------------
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="inline-flex items-center gap-1.5 rounded-md border border-edge px-2 py-1.5 text-xs text-muted transition hover:text-fg"
    >
      <Icon name="log-in" size={14} />
      Sign in
    </button>
  );
}
