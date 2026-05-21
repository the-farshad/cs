export type Track = {
  slug: string;
  title: string;
  /** Icon name from src/lib/icons.ts */
  icon: string;
  summary: string;
  order: number;
};

/** Single source of truth for the catalog — used by the homepage and track pages. */
export const TRACKS: Track[] = [
  { slug: 'data-structures', title: 'Data Structures', icon: 'tree', order: 1, summary: 'Arrays, lists, trees, heaps, graphs — every structure, animated.' },
  { slug: 'algorithms', title: 'Algorithms', icon: 'zap', order: 2, summary: 'Sorting, searching, recursion, DP, and graph algorithms.' },
  { slug: 'systems', title: 'CS Systems', icon: 'cpu', order: 3, summary: 'Big-O, operating systems, networking, database internals.' },
  { slug: 'system-design', title: 'System Design', icon: 'layers', order: 4, summary: 'Scaling, caching, consistency, consensus, case studies.' },
  { slug: 'cpp', title: 'C++', icon: 'braces', order: 5, summary: 'Pointers and memory, RAII, templates, and the STL.' },
  { slug: 'sql', title: 'SQL', icon: 'database', order: 6, summary: 'Queries, joins, indexes — with an in-browser playground.' },
  { slug: 'git', title: 'Git', icon: 'git-branch', order: 7, summary: 'The commit DAG and workflows, explored interactively.' },
  { slug: 'bash', title: 'Bash', icon: 'terminal', order: 8, summary: 'The shell, pipes, and scripting in a safe sandbox.' },
  { slug: 'machine-learning', title: 'Machine Learning', icon: 'neural', order: 9, summary: 'Linear models, neural networks, training, and evaluation.' },
  { slug: 'robotics', title: 'Robotics', icon: 'bot', order: 10, summary: 'Kinematics, PID control, and path planning.' },
  { slug: 'ml-rl', title: 'RL & Math', icon: 'sigma', order: 11, summary: 'Reinforcement learning, optimization, and the math behind it.' },
];

export const trackBySlug = (slug: string): Track | undefined => TRACKS.find((t) => t.slug === slug);
