import { useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';

type Difficulty = 'easy' | 'medium' | 'hard';
type Item = { slug: string; title: string; topic: string; difficulty: Difficulty };

const DIFF_COLOR: Record<Difficulty, string> = {
  easy: '#10b981',
  medium: '#fbbf24',
  hard: '#f43f5e',
};

/** Map a problem topic to an existing icon name. */
function topicIcon(topic: string): string {
  const t = topic.toLowerCase();
  if (t.includes('hash')) return 'database';
  if (t.includes('graph')) return 'git-branch';
  if (t.includes('tree')) return 'tree';
  if (t.includes('dynamic') || t.includes('dp') || t.includes('recursion')) return 'zap';
  if (t.includes('bit')) return 'braces';
  if (t.includes('sliding') || t.includes('two pointer')) return 'arrow-right';
  if (t.includes('binary') || t.includes('search')) return 'target';
  if (t.includes('stack') || t.includes('interval')) return 'layers';
  if (t.includes('greedy')) return 'zap';
  if (t.includes('string')) return 'code-slash';
  if (t.includes('math')) return 'pi';
  if (t.includes('array')) return 'braces';
  return 'code-slash';
}

const DIFFS: ('all' | Difficulty)[] = ['all', 'easy', 'medium', 'hard'];

export default function ProblemList({ problems }: { problems: Item[] }) {
  const topics = useMemo(
    () => ['All', ...Array.from(new Set(problems.map((p) => p.topic))).sort()],
    [problems],
  );
  const [topic, setTopic] = useState('All');
  const [diff, setDiff] = useState<'all' | Difficulty>('all');

  const filtered = problems.filter(
    (p) => (topic === 'All' || p.topic === topic) && (diff === 'all' || p.difficulty === diff),
  );

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs capitalize transition ${
      active ? 'border-accent bg-accent text-accent-fg' : 'border-edge text-muted hover:border-accent hover:text-fg'
    }`;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {DIFFS.map((d) => (
          <button key={d} type="button" onClick={() => setDiff(d)} className={chip(diff === d)}>
            {d === 'all' ? 'All levels' : d}
          </button>
        ))}
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {topics.map((t) => (
          <button key={t} type="button" onClick={() => setTopic(t)} className={chip(topic === t)}>
            {t}
          </button>
        ))}
      </div>

      <ul className="divide-y divide-edge overflow-hidden rounded-xl border border-edge">
        {filtered.map((p) => (
          <li key={p.slug}>
            <a href={`/problems/${p.slug}`} className="flex items-center gap-4 bg-surface px-5 py-4 transition hover:bg-accent/5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-edge text-accent">
                <Icon name={topicIcon(p.topic)} size={18} />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-lg text-fg">{p.title}</span>
                <span className="block text-sm text-muted">{p.topic}</span>
              </span>
              <span
                className="ml-auto shrink-0 rounded-full border px-2 py-0.5 text-xs capitalize"
                style={{ color: DIFF_COLOR[p.difficulty], borderColor: DIFF_COLOR[p.difficulty] }}
              >
                {p.difficulty}
              </span>
            </a>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="bg-surface px-5 py-10 text-center text-sm text-muted">No problems match that filter.</li>
        )}
      </ul>
      <p className="mt-3 text-xs text-muted">
        Showing {filtered.length} of {problems.length} problems
      </p>
    </div>
  );
}
