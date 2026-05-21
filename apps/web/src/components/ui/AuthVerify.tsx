import { useEffect, useState } from 'react';
import { setToken, verify } from '@/lib/api';
import { syncProgress } from '@/lib/progress';

type Status = 'verifying' | 'success' | 'error';

/** Handles the magic-link landing at /auth?token=RAW: verifies the token,
 *  stores the JWT, syncs progress, then redirects home. */
export default function AuthVerify() {
  const [status, setStatus] = useState<Status>('verifying');

  useEffect(() => {
    let active = true;
    (async () => {
      const raw = new URLSearchParams(window.location.search).get('token');
      if (!raw) {
        if (active) setStatus('error');
        return;
      }

      const result = await verify(raw);
      if (!result) {
        if (active) setStatus('error');
        return;
      }

      setToken(result.token);
      await syncProgress(); // merge local + server progress before leaving
      if (!active) return;

      setStatus('success');
      window.setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (status === 'error') {
    return (
      <div className="text-center">
        <p className="text-lg text-fg">That sign-in link is invalid or has expired.</p>
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
