import { useState } from 'react';

const LABELS: Record<string, string> = {
  python: 'Python',
  javascript: 'JavaScript',
  cpp: 'C++',
  java: 'Java',
  pseudocode: 'Pseudocode',
};

export type CodeTab = { language: string; code: string };

export default function CodeTabs({ tabs }: { tabs: CodeTab[] }) {
  const [i, setI] = useState(0);
  const active = tabs[i] ?? tabs[0];
  return (
    <div className="overflow-hidden rounded-lg border border-edge">
      <div className="flex flex-wrap gap-1 border-b border-edge bg-bg/40 p-1">
        {tabs.map((tab, k) => (
          <button
            key={tab.language}
            type="button"
            onClick={() => setI(k)}
            className={`rounded px-2.5 py-1 text-xs transition ${i === k ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}
          >
            {LABELS[tab.language] ?? tab.language}
          </button>
        ))}
      </div>
      <pre className="overflow-x-auto bg-bg p-4 text-sm leading-relaxed">
        <code className="font-mono text-fg">{active.code}</code>
      </pre>
    </div>
  );
}
