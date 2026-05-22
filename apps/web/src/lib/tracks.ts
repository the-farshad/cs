export type Track = {
  slug: string;
  title: string;
  /** Icon name from src/lib/icons.ts */
  icon: string;
  summary: string;
  category: Category;
};

export type Category =
  | 'Foundations'
  | 'Programming'
  | 'Algorithms & Data Structures'
  | 'Systems & Databases'
  | 'AI, ML & Robotics'
  | 'Developer Tools'
  | 'Frontiers';

/** Section order for the catalog. */
export const CATEGORIES: Category[] = [
  'Foundations',
  'Programming',
  'Algorithms & Data Structures',
  'Systems & Databases',
  'AI, ML & Robotics',
  'Developer Tools',
  'Frontiers',
];

/** Single source of truth for the catalog — used by the homepage and track pages. */
export const TRACKS: Track[] = [
  { slug: 'math', title: 'Mathematics', icon: 'pi', category: 'Foundations', summary: 'Algebra, trigonometry, logarithms, and logic — the math under CS.' },
  { slug: 'theory-of-computation', title: 'Theory of Computation', icon: 'automaton', category: 'Foundations', summary: 'Automata, Turing machines, computability, and complexity.' },
  { slug: 'formal-logic', title: 'Formal Logic', icon: 'turnstile', category: 'Foundations', summary: 'Connectives, truth tables, natural deduction, and predicate logic.' },

  { slug: 'python', title: 'Python', icon: 'python', category: 'Programming', summary: 'Syntax, collections, functions, OOP, and generators — runnable.' },
  { slug: 'cpp', title: 'C++', icon: 'braces', category: 'Programming', summary: 'Pointers and memory, RAII, templates, the STL, and modern C++.' },
  { slug: 'compilers', title: 'Compilers', icon: 'cog', category: 'Programming', summary: 'Lexing, parsing, ASTs, and code generation.' },

  { slug: 'data-structures', title: 'Data Structures', icon: 'tree', category: 'Algorithms & Data Structures', summary: 'Arrays, lists, trees, heaps, graphs — every structure, animated.' },
  { slug: 'algorithms', title: 'Algorithms', icon: 'zap', category: 'Algorithms & Data Structures', summary: 'Sorting, searching, graphs, DP, and shortest paths.' },

  { slug: 'systems', title: 'Systems', icon: 'cpu', category: 'Systems & Databases', summary: 'Big-O, operating systems, networking, database internals.' },
  { slug: 'system-design', title: 'System Design', icon: 'layers', category: 'Systems & Databases', summary: 'Scaling, caching, consistency, consensus, case studies.' },
  { slug: 'sql', title: 'SQL', icon: 'database', category: 'Systems & Databases', summary: 'Queries, joins, indexes, transactions — with a live playground.' },
  { slug: 'security', title: 'Cryptography & Security', icon: 'shield', category: 'Systems & Databases', summary: 'Hashing, encryption, public-key, and common attacks.' },

  { slug: 'machine-learning', title: 'Machine Learning', icon: 'neural', category: 'AI, ML & Robotics', summary: 'Linear models, neural networks, clustering, and evaluation.' },
  { slug: 'ml-rl', title: 'Reinforcement Learning', icon: 'sigma', category: 'AI, ML & Robotics', summary: 'Reinforcement learning, optimization, and the math behind it.' },
  { slug: 'robotics', title: 'Robotics', icon: 'bot', category: 'AI, ML & Robotics', summary: 'Kinematics, PID control, path planning, and perception.' },

  { slug: 'git', title: 'Git', icon: 'git-branch', category: 'Developer Tools', summary: 'The commit DAG and workflows, explored interactively.' },
  { slug: 'bash', title: 'Bash', icon: 'terminal', category: 'Developer Tools', summary: 'The shell, pipes, and scripting in a safe sandbox.' },

  { slug: 'graphics', title: 'Computer Graphics', icon: 'box', category: 'Frontiers', summary: 'Transforms, rasterization, 3D projection, and ray tracing.' },
  { slug: 'quantum', title: 'Quantum Computing', icon: 'atom', category: 'Frontiers', summary: 'Qubits, superposition, gates, and measurement.' },
];

export const trackBySlug = (slug: string): Track | undefined => TRACKS.find((t) => t.slug === slug);
