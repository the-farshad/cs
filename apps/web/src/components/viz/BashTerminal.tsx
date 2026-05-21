import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';

type FileNode = { type: 'file'; content: string };
type DirNode = { type: 'dir'; children: Record<string, FSNode> };
type FSNode = FileNode | DirNode;

type CmdResult = { out?: string; err?: string };
type Ctx = { root: DirNode; getCwd: () => string[]; chdir: (s: string[]) => void };

function seedFS(): DirNode {
  return {
    type: 'dir',
    children: {
      home: {
        type: 'dir',
        children: {
          learner: {
            type: 'dir',
            children: {
              'readme.txt': {
                type: 'file',
                content:
                  'Welcome to the cs.thefarshad.com shell — a simulated bash in your browser.\nTry:  ls,  cat readme.txt,  cd data,  then  cat fruits.txt | sort | uniq\n',
              },
              notes: {
                type: 'dir',
                children: { 'todo.md': { type: 'file', content: '- learn pipes\n- practice grep\n- master cd and ls\n' } },
              },
              data: {
                type: 'dir',
                children: {
                  'fruits.txt': { type: 'file', content: 'apple\nbanana\ncherry\napple\ndate\nbanana\napple\n' },
                  'numbers.txt': { type: 'file', content: '3\n1\n4\n1\n5\n9\n2\n6\n5\n' },
                },
              },
            },
          },
        },
      },
    },
  };
}

function resolve(p: string, cwd: string[]): string[] {
  let segs: string[];
  let path = p;
  if (path.startsWith('/')) segs = [];
  else if (path === '~' || path.startsWith('~/')) {
    segs = ['home', 'learner'];
    path = path.slice(1);
  } else segs = [...cwd];
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') segs.pop();
    else segs.push(part);
  }
  return segs;
}

function getNode(root: DirNode, segs: string[]): FSNode | null {
  let node: FSNode = root;
  for (const s of segs) {
    if (node.type !== 'dir' || !node.children[s]) return null;
    node = node.children[s];
  }
  return node;
}

function readInputs(files: string[], stdin: string | null, ctx: Ctx, cmd: string): { text: string } | { err: string } {
  if (files.length) {
    let text = '';
    for (const f of files) {
      const n = getNode(ctx.root, resolve(f, ctx.getCwd()));
      if (!n) return { err: `${cmd}: ${f}: No such file or directory` };
      if (n.type !== 'file') return { err: `${cmd}: ${f}: Is a directory` };
      text += n.content;
    }
    return { text };
  }
  return { text: stdin ?? '' };
}

const splitLines = (s: string) => s.replace(/\n$/, '').split('\n');
const join = (lines: string[]) => (lines.length ? lines.join('\n') + '\n' : '');

function clone(n: FSNode): FSNode {
  return n.type === 'file'
    ? { type: 'file', content: n.content }
    : { type: 'dir', children: Object.fromEntries(Object.entries(n.children).map(([k, v]) => [k, clone(v)])) };
}

const COMMANDS: Record<string, (args: string[], stdin: string | null, ctx: Ctx) => CmdResult> = {
  pwd: (_a, _s, ctx) => ({ out: '/' + ctx.getCwd().join('/') + '\n' }),
  whoami: () => ({ out: 'learner\n' }),
  echo: (args) => ({ out: args.join(' ') + '\n' }),
  help: () => ({
    out: 'commands: pwd ls cd cat echo mkdir touch rm mv cp grep wc head tail sort uniq clear help\npipes ( | ) and redirection ( > , >> ) are supported\n',
  }),
  ls: (args, _s, ctx) => {
    const flags = args.filter((a) => a.startsWith('-')).join('');
    const rest = args.filter((a) => !a.startsWith('-'));
    const segs = rest.length ? resolve(rest[0], ctx.getCwd()) : ctx.getCwd();
    const node = getNode(ctx.root, segs);
    if (!node) return { err: `ls: ${rest[0] ?? ''}: No such file or directory` };
    if (node.type === 'file') return { out: (rest[0] || '') + '\n' };
    let names = Object.keys(node.children).sort();
    if (!flags.includes('a')) names = names.filter((n) => !n.startsWith('.'));
    if (flags.includes('l')) return { out: join(names.map((n) => (node.children[n].type === 'dir' ? 'd  ' : '-  ') + n)) };
    return { out: names.length ? names.join('  ') + '\n' : '' };
  },
  cd: (args, _s, ctx) => {
    const target = args[0] ?? '~';
    const segs = resolve(target, ctx.getCwd());
    const node = getNode(ctx.root, segs);
    if (!node) return { err: `cd: ${target}: No such file or directory` };
    if (node.type !== 'dir') return { err: `cd: ${target}: Not a directory` };
    ctx.chdir(segs);
    return {};
  },
  cat: (args, stdin, ctx) => {
    if (!args.length) return { out: stdin ?? '' };
    const r = readInputs(args, stdin, ctx, 'cat');
    return 'err' in r ? { err: r.err } : { out: r.text };
  },
  mkdir: (args, _s, ctx) => {
    if (!args[0]) return { err: 'mkdir: missing operand' };
    const segs = resolve(args[0], ctx.getCwd());
    const name = segs.pop()!;
    const parent = getNode(ctx.root, segs);
    if (!parent || parent.type !== 'dir') return { err: `mkdir: cannot create directory '${args[0]}'` };
    if (parent.children[name]) return { err: `mkdir: cannot create directory '${args[0]}': File exists` };
    parent.children[name] = { type: 'dir', children: {} };
    return {};
  },
  touch: (args, _s, ctx) => {
    if (!args[0]) return { err: 'touch: missing operand' };
    const segs = resolve(args[0], ctx.getCwd());
    const name = segs.pop()!;
    const parent = getNode(ctx.root, segs);
    if (!parent || parent.type !== 'dir') return { err: `touch: cannot touch '${args[0]}'` };
    if (!parent.children[name]) parent.children[name] = { type: 'file', content: '' };
    return {};
  },
  rm: (args, _s, ctx) => {
    const recursive = args.some((a) => a.startsWith('-') && a.includes('r'));
    const rest = args.filter((a) => !a.startsWith('-'));
    if (!rest[0]) return { err: 'rm: missing operand' };
    for (const a of rest) {
      const segs = resolve(a, ctx.getCwd());
      const name = segs.pop()!;
      const parent = getNode(ctx.root, segs);
      if (!parent || parent.type !== 'dir' || !parent.children[name]) return { err: `rm: ${a}: No such file or directory` };
      if (parent.children[name].type === 'dir' && !recursive) return { err: `rm: ${a}: is a directory (use -r)` };
      delete parent.children[name];
    }
    return {};
  },
  cp: (args, _s, ctx) => moveOrCopy(args, ctx, true),
  mv: (args, _s, ctx) => moveOrCopy(args, ctx, false),
  grep: (args, stdin, ctx) => {
    if (!args.length) return { err: 'usage: grep PATTERN [file...]' };
    const pat = args[0];
    const r = readInputs(args.slice(1), stdin, ctx, 'grep');
    if ('err' in r) return { err: r.err };
    return { out: join(splitLines(r.text).filter((l) => l.includes(pat))) };
  },
  wc: (args, stdin, ctx) => {
    const flags = args.filter((a) => a.startsWith('-')).join('');
    const r = readInputs(args.filter((a) => !a.startsWith('-')), stdin, ctx, 'wc');
    if ('err' in r) return { err: r.err };
    const text = r.text;
    const lines = text === '' ? 0 : splitLines(text).length;
    const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    if (flags.includes('l')) return { out: `${lines}\n` };
    if (flags.includes('w')) return { out: `${words}\n` };
    if (flags.includes('c')) return { out: `${text.length}\n` };
    return { out: `${lines} ${words} ${text.length}\n` };
  },
  head: (args, stdin, ctx) => headTail(args, stdin, ctx, true),
  tail: (args, stdin, ctx) => headTail(args, stdin, ctx, false),
  sort: (args, stdin, ctx) => {
    const r = readInputs(args.filter((a) => !a.startsWith('-')), stdin, ctx, 'sort');
    if ('err' in r) return { err: r.err };
    const lines = splitLines(r.text).filter((l) => l !== '');
    lines.sort();
    return { out: join(lines) };
  },
  uniq: (args, stdin, ctx) => {
    const r = readInputs(args.filter((a) => !a.startsWith('-')), stdin, ctx, 'uniq');
    if ('err' in r) return { err: r.err };
    const out: string[] = [];
    for (const l of splitLines(r.text)) if (out.length === 0 || out[out.length - 1] !== l) out.push(l);
    return { out: join(out) };
  },
};

function moveOrCopy(args: string[], ctx: Ctx, copy: boolean): CmdResult {
  const name = copy ? 'cp' : 'mv';
  const rest = args.filter((a) => !a.startsWith('-'));
  if (rest.length < 2) return { err: `${name}: missing destination operand` };
  const [src, dst] = rest;
  const sSeg = resolve(src, ctx.getCwd());
  const sNode = getNode(ctx.root, sSeg);
  if (!sNode) return { err: `${name}: ${src}: No such file or directory` };
  const sName = sSeg[sSeg.length - 1];
  const dSeg = resolve(dst, ctx.getCwd());
  const dNode = getNode(ctx.root, dSeg);
  let parentSeg: string[];
  let targetName: string;
  if (dNode && dNode.type === 'dir') {
    parentSeg = dSeg;
    targetName = sName;
  } else {
    parentSeg = dSeg.slice(0, -1);
    targetName = dSeg[dSeg.length - 1];
  }
  const parent = getNode(ctx.root, parentSeg);
  if (!parent || parent.type !== 'dir') return { err: `${name}: ${dst}: No such directory` };
  parent.children[targetName] = clone(sNode);
  if (!copy) {
    const sp = getNode(ctx.root, sSeg.slice(0, -1));
    if (sp && sp.type === 'dir') delete sp.children[sName];
  }
  return {};
}

function headTail(args: string[], stdin: string | null, ctx: Ctx, isHead: boolean): CmdResult {
  let n = 10;
  let rest = [...args];
  const idx = rest.indexOf('-n');
  if (idx >= 0) {
    n = parseInt(rest[idx + 1] || '10', 10) || 10;
    rest = rest.filter((_, i) => i !== idx && i !== idx + 1);
  }
  const r = readInputs(rest.filter((a) => !a.startsWith('-')), stdin, ctx, isHead ? 'head' : 'tail');
  if ('err' in r) return { err: r.err };
  const lines = splitLines(r.text);
  return { out: join(isHead ? lines.slice(0, n) : lines.slice(-n)) };
}

const EXAMPLES = ['ls', 'cat readme.txt', 'cat data/fruits.txt | sort | uniq', 'grep apple data/fruits.txt', 'wc -l data/numbers.txt'];

type Line = { type: 'input' | 'output' | 'error'; text: string; prompt?: string };

const display = (c: string[]) => {
  if (c[0] === 'home' && c[1] === 'learner') {
    const rest = c.slice(2);
    return '~' + (rest.length ? '/' + rest.join('/') : '');
  }
  return '/' + c.join('/');
};

export default function BashTerminal() {
  const fsRef = useRef<DirNode>(seedFS());
  const [cwd, setCwd] = useState<string[]>(['home', 'learner']);
  const [lines, setLines] = useState<Line[]>([{ type: 'output', text: 'cs shell — type "help" to see commands.' }]);
  const [input, setInput] = useState('');
  const [hist, setHist] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const prompt = `learner@cs:${display(cwd)}$`;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines]);

  const execute = (raw: string) => {
    const promptStr = `learner@cs:${display(cwd)}$`;
    const trimmed = raw.trim();
    if (trimmed === 'clear') {
      setLines([]);
      return;
    }
    const newLines: Line[] = [{ type: 'input', text: raw, prompt: promptStr }];
    if (!trimmed) {
      setLines((ls) => [...ls, ...newLines]);
      return;
    }

    let curCwd = [...cwd];
    const ctx: Ctx = { root: fsRef.current, getCwd: () => curCwd, chdir: (s) => (curCwd = s) };

    let pipePart = trimmed;
    let redir: { file: string; append: boolean } | null = null;
    const mApp = trimmed.match(/^(.*?)>>\s*(\S+)\s*$/);
    const mWr = trimmed.match(/^(.*?)>\s*(\S+)\s*$/);
    if (mApp) {
      pipePart = mApp[1];
      redir = { file: mApp[2], append: true };
    } else if (mWr) {
      pipePart = mWr[1];
      redir = { file: mWr[2], append: false };
    }

    const stages = pipePart.split('|').map((s) => s.trim()).filter(Boolean);
    let stdin: string | null = null;
    let out = '';
    let err = '';
    for (const stage of stages) {
      const toks = stage.split(/\s+/).filter(Boolean);
      const cmd = COMMANDS[toks[0]];
      if (!cmd) {
        err = `${toks[0]}: command not found`;
        break;
      }
      const res = cmd(toks.slice(1), stdin, ctx);
      if (res.err) {
        err = res.err;
        break;
      }
      out = res.out ?? '';
      stdin = out;
    }

    if (err) newLines.push({ type: 'error', text: err });
    else if (redir) {
      const segs = resolve(redir.file, curCwd);
      const name = segs.pop()!;
      const parent = getNode(fsRef.current, segs);
      if (!parent || parent.type !== 'dir') newLines.push({ type: 'error', text: `cannot write ${redir.file}` });
      else {
        const existing = parent.children[name];
        if (redir.append && existing && existing.type === 'file') existing.content += out;
        else parent.children[name] = { type: 'file', content: out };
      }
    } else if (out) newLines.push({ type: 'output', text: out.replace(/\n$/, '') });

    setLines((ls) => [...ls, ...newLines]);
    if (curCwd.join('/') !== cwd.join('/')) setCwd(curCwd);
  };

  const submit = (v: string) => {
    execute(v);
    if (v.trim()) setHist((h) => [...h, v]);
    setHistIdx(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      submit(input);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!hist.length) return;
      const i = histIdx < 0 ? hist.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(i);
      setInput(hist[i]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx < 0) return;
      const i = histIdx + 1;
      if (i >= hist.length) {
        setHistIdx(-1);
        setInput('');
      } else {
        setHistIdx(i);
        setInput(hist[i]);
      }
    }
  };

  const reset = () => {
    fsRef.current = seedFS();
    setCwd(['home', 'learner']);
    setLines([{ type: 'output', text: 'cs shell — type "help" to see commands.' }]);
    setInput('');
  };

  return (
    <div className="rounded-xl border border-edge bg-surface p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => {
              submit(ex);
              inputRef.current?.focus();
            }}
            className="rounded border border-edge px-2 py-0.5 font-mono text-xs text-muted transition hover:border-accent hover:text-accent"
          >
            {ex}
          </button>
        ))}
        <button type="button" onClick={reset} className="ml-auto inline-flex items-center gap-1.5 rounded border border-edge px-2 py-0.5 text-xs text-fg transition hover:border-accent hover:text-accent">
          <Icon name="rotate-ccw" size={14} /> reset
        </button>
      </div>

      <div onClick={() => inputRef.current?.focus()} className="cursor-text rounded-lg border border-edge bg-bg p-3">
        <div ref={scrollRef} className="h-72 overflow-y-auto font-mono text-sm leading-relaxed whitespace-pre-wrap">
          {lines.map((l, i) =>
            l.type === 'input' ? (
              <div key={i}>
                <span className="text-emerald-400">{l.prompt}</span> {l.text}
              </div>
            ) : (
              <div key={i} className={l.type === 'error' ? 'text-rose-400' : 'text-fg'}>
                {l.text}
              </div>
            ),
          )}
          <div className="flex">
            <span className="shrink-0 text-emerald-400">{prompt}&nbsp;</span>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              className="flex-1 bg-transparent text-fg outline-none"
              aria-label="terminal input"
            />
          </div>
        </div>
      </div>

      <div className="mt-2 text-xs text-muted">A simulated shell — supports pipes ( | ) and redirection ( &gt; , &gt;&gt; ). Use ↑/↓ for history.</div>
    </div>
  );
}
