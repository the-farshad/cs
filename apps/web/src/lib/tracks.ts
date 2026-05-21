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
  { slug: 'math', title: 'Mathematics', icon: 'pi', order: 1, summary: 'Algebra, trigonometry, logarithms, and logic — the math under CS.' },
  { slug: 'data-structures', title: 'Data Structures', icon: 'tree', order: 2, summary: 'Arrays, lists, trees, heaps, graphs — every structure, animated.' },
  { slug: 'algorithms', title: 'Algorithms', icon: 'zap', order: 3, summary: 'Sorting, searching, recursion, DP, and graph algorithms.' },
  { slug: 'cpp', title: 'C++', icon: 'braces', order: 4, summary: 'Pointers and memory, RAII, templates, and the STL.' },
  { slug: 'systems', title: 'CS Systems', icon: 'cpu', order: 5, summary: 'Big-O, operating systems, networking, database internals.' },
  { slug: 'system-design', title: 'System Design', icon: 'layers', order: 6, summary: 'Scaling, caching, consistency, consensus, case studies.' },
  { slug: 'sql', title: 'SQL', icon: 'database', order: 7, summary: 'Queries, joins, indexes — with an in-browser playground.' },
  { slug: 'git', title: 'Git', icon: 'git-branch', order: 8, summary: 'The commit DAG and workflows, explored interactively.' },
  { slug: 'bash', title: 'Bash', icon: 'terminal', order: 9, summary: 'The shell, pipes, and scripting in a safe sandbox.' },
  { slug: 'machine-learning', title: 'Machine Learning', icon: 'neural', order: 10, summary: 'Linear models, neural networks, training, and evaluation.' },
  { slug: 'ml-rl', title: 'RL & Math', icon: 'sigma', order: 11, summary: 'Reinforcement learning, optimization, and the math behind it.' },
  { slug: 'robotics', title: 'Robotics', icon: 'bot', order: 12, summary: 'Kinematics, PID control, and path planning.' },
  { slug: 'quantum', title: 'Quantum Computing', icon: 'atom', order: 13, summary: 'Qubits, superposition, gates, and measurement.' },
];

export const trackBySlug = (slug: string): Track | undefined => TRACKS.find((t) => t.slug === slug);
