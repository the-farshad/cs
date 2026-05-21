import { useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { clearToken, getMe, getToken, requestMagicLink, type User } from '@/lib/api';

type View = 'idle' | 'form' | 'sending' | 'sent' | 'error';

export default function AuthButton() {
  // null until mounted so SSR and first client render match (no hydration mismatch).
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);
  const [view, setView] = useState<View>('idle');
  const [email, setEmail] = useState('');
  const [devLink, setDevLink] = useState<string | undefined>(undefined);

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
    setView('idle');
    setEmail('');
    setDevLink(undefined);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setView('sending');
    const res = await requestMagicLink(email.trim());
    if (res.ok) {
      setDevLink(res.devLink);
      setView('sent');
    } else {
      setView('error');
    }
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

  // --- Signed out: confirmation -------------------------------------------
  if (view === 'sent') {
    return (
      <div className="inline-flex flex-col items-start gap-0.5 rounded-md border border-edge px-2 py-1 text-xs">
        <span className="text-fg">Check your email for a sign-in link.</span>
        {devLink ? (
          <a href={devLink} className="text-accent underline underline-offset-2 hover:text-fg">
            Open dev link
          </a>
        ) : null}
      </div>
    );
  }

  // --- Signed out: email form ---------------------------------------------
  if (view === 'form' || view === 'sending' || view === 'error') {
    return (
      <form onSubmit={submit} className="inline-flex items-center gap-1 rounded-md border border-edge p-0.5">
        <input
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email"
          className="w-40 rounded bg-transparent px-1.5 py-1 text-xs text-fg outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={view === 'sending'}
          className="rounded bg-accent px-1.5 py-1 text-xs text-accent-fg transition hover:opacity-90 disabled:opacity-60"
        >
          {view === 'sending' ? 'Sending…' : 'Send link'}
        </button>
        {view === 'error' ? <span className="px-1 text-xs text-red-400">Try again</span> : null}
      </form>
    );
  }

  // --- Signed out: idle ----------------------------------------------------
  return (
    <button
      type="button"
      onClick={() => setView('form')}
      className="inline-flex items-center gap-1.5 rounded-md border border-edge px-2 py-1.5 text-xs text-muted transition hover:text-fg"
    >
      <Icon name="log-in" size={14} />
      Sign in
    </button>
  );
}
