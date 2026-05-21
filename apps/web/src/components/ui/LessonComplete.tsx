import { useEffect, useState } from 'react';
import { getCompleted, setComplete } from '@/lib/progress';

export default function LessonComplete({ id }: { id: string }) {
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDone(getCompleted().has(id));
  }, [id]);

  const toggle = () => {
    const set = setComplete(id, !done);
    setDone(set.has(id));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={done}
      className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
        done
          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
          : 'border-edge text-fg hover:border-accent hover:text-accent'
      }`}
    >
      {done ? '✓ Completed' : 'Mark complete'}
    </button>
  );
}
