# cs.thefarshad.com

An interactive computer science reference: short lessons paired with visualizers,
plus practice problems you can run in the browser. Live at
**[cs.thefarshad.com](https://cs.thefarshad.com)**.

Everything runs client-side — no account or backend required. Themes and fonts are
switchable, and lesson/problem progress is saved locally in the browser.

## Tracks

- **Mathematics** — algebra & functions, trigonometry, exponents & logarithms, logic & sets
- **Data Structures** — linked lists, stacks & queues, hash tables, binary search trees / AVL, heaps
- **Algorithms** — sorting, binary search, pathfinding, recursion, dynamic programming, graph traversal
- **C++** — getting started, the STL
- **CS Systems** — Big-O & complexity, operating systems, networking, database internals
- **System Design** — scaling, data at scale, consensus, a URL-shortener case study
- **SQL** — querying, joins (with an in-browser SQLite playground)
- **Git** — the commit graph, merging & rebasing (interactive DAG)
- **Bash** — the shell & filesystem, pipes & filters (sandboxed terminal)
- **Machine Learning** — gradient descent, supervised learning
- **RL & Math** — reinforcement learning, Markov chains, optimization
- **Robotics** — kinematics, PID control, path planning, perception & SLAM
- **Quantum Computing** — qubits & superposition, quantum gates

Most lessons embed a step-through visualizer (sorting, trees, pathfinding,
gradient descent, a gridworld RL agent, a single-qubit simulator, and more).

## Practice problems

Practice problems with an in-browser judge. **Python** runs via Pyodide and
**JavaScript** runs natively, both client-side. Each problem ships reference
solutions in Python, JavaScript, C++, Java, and pseudocode.

## How it works

- [Astro](https://astro.build) with React islands and Tailwind CSS v4
- Static build deployed to GitHub Pages
- In-browser execution: Pyodide (Python), native JavaScript, and sql.js (SQLite)

## Project structure

```
apps/web/
  src/
    content/lessons/   MDX lessons, one folder per track
    components/viz/     interactive visualizers
    components/...      UI, problem runner, code tabs
    pages/              routes (/learn/..., /problems/...)
    lib/                tracks, problems, code runners, icons
  scripts/verify.ts     automated correctness checks for the algorithm logic
.github/workflows/      build + deploy to GitHub Pages
```

## Develop

```sh
cd apps/web
npm install
npm run dev      # local dev server
npm run build    # static build to dist/
npx tsx scripts/verify.ts   # run the algorithm correctness checks
```

## Roadmap

A backend (accounts and cross-device progress sync, plus a compiled-language judge
for C++/Java via Judge0) is planned; the site works fully without it.

## License

GPL-3.0 — see [LICENSE](LICENSE).
