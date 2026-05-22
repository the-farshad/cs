import { useEffect, useState } from 'react';
import { clearToken, getMe, setToken } from '@/lib/api';
import { syncProgress } from '@/lib/progress';

type Status = 'verifying' | 'success' | 'error';

/** Landing for the OAuth redirect at /auth?token=<jwt> (or ?error=...): stores the
 *  JWT, confirms it, syncs progress, then redirects home. */
export default function AuthVerify() {
  const [status, setStatus] = useState<Status>('verifying');

  useEffect(() => {
    let active = true;
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      if (params.get('error') || !token) {
        if (active) setStatus('error');
        return;
      }

      setToken(token);
      const me = await getMe(); // confirm the token actually works
      if (!me) {
        clearToken();
        if (active) setStatus('error');
        return;
      }

      await syncProgress(); // merge local + server progress before leaving
      if (!active) return;

      setStatus('success');
      window.setTimeout(() => {
        window.location.href = '/';
      }, 900);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (status === 'error') {
    return (
      <div className="text-center">
        <p className="text-lg text-fg">Sign-in didn't complete.</p>
        <a href="/" className="mt-3 inline-block text-accent underline underline-offset-2 hover:text-fg">
          Back home
        </a>
      </div>
    );
  }

  if (status === 'success') {
    return <p className="text-lg text-fg">Signed in — redirecting…</p>;
  }

  return <p className="text-lg text-muted">Signing you in…</p>;
}
