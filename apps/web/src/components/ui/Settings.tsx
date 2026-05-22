import { useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { clearToken, deleteMe, getMe, getToken, updateMe, type User } from '@/lib/api';

type Save = 'idle' | 'saving' | 'saved' | 'error';

const HANDLE_RE = /^[A-Za-z0-9_-]{3,20}$/;

export default function Settings() {
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);
  const [handle, setHandle] = useState('');
  const [save, setSave] = useState<Save>('idle');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (getToken()) {
        const me = await getMe();
        if (active && me) {
          setUser(me);
          setHandle(me.handle);
        }
      }
      if (active) setChecked(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!checked) return <p className="text-muted">Loading…</p>;

  if (!user) {
    return (
      <div className="rounded-xl border border-edge bg-surface p-6">
        <p className="text-fg">You're not signed in.</p>
        <a href="/" className="mt-3 inline-block text-accent underline underline-offset-2 hover:text-fg">
          Back home
        </a>
      </div>
    );
  }

  const valid = HANDLE_RE.test(handle);
  const dirty = handle !== user.handle;

  const onSave = async () => {
    if (!valid || !dirty) return;
    setSave('saving');
    const updated = await updateMe(handle);
    if (updated) {
      setUser(updated);
      setHandle(updated.handle);
      setSave('saved');
    } else {
      setSave('error');
    }
  };

  const onDelete = async () => {
    if (await deleteMe()) {
      clearToken();
      window.location.href = '/';
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-edge bg-surface p-5">
        <h2 className="font-display text-lg text-fg">Account</h2>
        <div className="mt-3 flex items-center justify-between gap-4 text-sm">
          <span className="text-muted">Email</span>
          <span className="text-fg">{user.email}</span>
        </div>
      </section>

      <section className="rounded-xl border border-edge bg-surface p-5">
        <h2 className="font-display text-lg text-fg">Username</h2>
        <p className="mt-1 text-sm text-muted">Your public handle — 3–20 characters: letters, numbers, <code>_</code> or <code>-</code>.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-muted">@</span>
          <input
            value={handle}
            onChange={(e) => {
              setHandle(e.target.value);
              setSave('idle');
            }}
            maxLength={20}
            aria-label="Username"
            className="w-48 rounded border border-edge bg-bg px-2 py-1 text-fg outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={onSave}
            disabled={!valid || !dirty || save === 'saving'}
            className="rounded border border-accent bg-accent px-3 py-1 text-sm text-accent-fg transition hover:opacity-90 disabled:opacity-40"
          >
            {save === 'saving' ? 'Saving…' : 'Save'}
          </button>
          {save === 'saved' && <span className="text-sm text-emerald-400">Saved</span>}
          {save === 'error' && <span className="text-sm text-rose-400">Couldn't save</span>}
          {!valid && handle.length > 0 && save !== 'error' && <span className="text-sm text-rose-400">3–20 chars: a–z, 0–9, _ -</span>}
        </div>
      </section>

      <section className="rounded-xl border border-edge bg-surface p-5">
        <h2 className="font-display text-lg text-fg">Session</h2>
        <div className="mt-3">
          <button
            type="button"
            onClick={() => {
              clearToken();
              window.location.href = '/';
            }}
            className="inline-flex items-center gap-1.5 rounded border border-edge px-3 py-1 text-sm text-fg transition hover:border-accent hover:text-accent"
          >
            <Icon name="log-out" size={14} /> Sign out
          </button>
        </div>
        <div className="mt-5 border-t border-edge pt-4">
          {!confirmDelete ? (
            <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm text-rose-400 transition hover:text-rose-300">
              Delete account
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-fg">Delete your account and synced progress? This can't be undone.</span>
              <button type="button" onClick={onDelete} className="rounded border border-rose-500 px-3 py-1 text-sm text-rose-300 transition hover:bg-rose-500/10">
                Yes, delete
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="rounded border border-edge px-3 py-1 text-sm text-muted transition hover:text-fg">
                Cancel
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
