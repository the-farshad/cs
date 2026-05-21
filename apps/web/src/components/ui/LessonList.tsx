import { useEffect, useState } from 'react';
import { getCompleted, PROGRESS_EVENT } from '@/lib/progress';
import Icon from '@/components/ui/Icon';

export type LessonItem = {
  id: string;
  href: string;
  title: string;
  summary: string;
  difficulty: string;
};

export default function LessonList({ lessons }: { lessons: LessonItem[] }) {
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  useEffect(() => {
    const update = () => setCompleted(getCompleted());
    update();
    window.addEventListener(PROGRESS_EVENT, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(PROGRESS_EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, []);

  if (lessons.length === 0) {
    return <p className="text-muted">Lessons for this track are coming soon.</p>;
  }

  const done = lessons.filter((l) => completed.has(l.id)).length;
  const pct = Math.round((done / lessons.length) * 100);

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="h-2 w-40 overflow-hidden rounded-full bg-edge">
          <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-sm text-muted">
          {done}/{lessons.length} complete
        </span>
      </div>

      <ul className="divide-y divide-edge overflow-hidden rounded-xl border border-edge">
        {lessons.map((l) => (
          <li key={l.id}>
            <a href={l.href} className="flex items-center gap-4 bg-surface px-5 py-4 transition hover:bg-accent/5">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
                  completed.has(l.id) ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-edge text-muted'
                }`}
                aria-hidden
              >
                {completed.has(l.id) ? <Icon name="check" size={14} /> : null}
              </span>
              <span className="min-w-0">
                <span className="block font-display text-lg text-fg">{l.title}</span>
                <span className="block truncate text-sm text-muted">{l.summary}</span>
              </span>
              <span className="ml-auto shrink-0 rounded border border-edge px-2 py-0.5 text-xs text-muted capitalize">
                {l.difficulty}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
