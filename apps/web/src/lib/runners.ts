/** In-browser code execution for the problem judge.
 *  Python runs via Pyodide (WASM, loaded from the official CDN on first use);
 *  JavaScript runs natively. Compiled languages (C++, Java) are reference-only
 *  here and will be graded by Judge0 on the backend in a later phase. */

export type TestCase = { args: unknown[]; expected: unknown };
export type TestResult = { ok: boolean; actual: string; error?: boolean };

const PYODIDE_VERSION = 'v0.26.4';
let pyodidePromise: Promise<any> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('failed to load ' + src));
    document.head.appendChild(s);
  });
}

export async function getPyodide(): Promise<any> {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      const base = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/`;
      await loadScript(base + 'pyodide.js');
      return await (window as any).loadPyodide({ indexURL: base });
    })();
  }
  return pyodidePromise;
}

export async function runPython(userCode: string, funcName: string, tests: TestCase[]): Promise<TestResult[]> {
  let py: any;
  try {
    py = await getPyodide();
  } catch {
    return tests.map(() => ({ ok: false, actual: 'failed to load the Python runtime', error: true }));
  }
  try {
    py.globals.set('_USER_CASES', JSON.stringify(tests));
    const harness = `
import json
_cases = json.loads(_USER_CASES)
${userCode}
_out = []
for _c in _cases:
    try:
        _r = ${funcName}(*_c["args"])
        _out.append({"ok": _r == _c["expected"], "actual": json.dumps(_r, default=str)})
    except Exception as _e:
        _out.append({"ok": False, "actual": str(_e), "error": True})
json.dumps(_out)
`;
    return JSON.parse(py.runPython(harness));
  } catch (e: any) {
    return tests.map(() => ({ ok: false, actual: String(e?.message ?? e), error: true }));
  }
}

const deepEqual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const cloneArgs = (args: unknown[]) => args.map((a) => (a === undefined ? a : JSON.parse(JSON.stringify(a))));

export function runJavaScript(userCode: string, funcName: string, tests: TestCase[]): TestResult[] {
  let fn: any;
  try {
    // eslint-disable-next-line no-new-func
    fn = new Function(`${userCode}\n; return typeof ${funcName} === 'function' ? ${funcName} : undefined;`)();
  } catch (e: any) {
    return tests.map(() => ({ ok: false, actual: String(e?.message ?? e), error: true }));
  }
  if (typeof fn !== 'function') {
    return tests.map(() => ({ ok: false, actual: `${funcName} is not defined`, error: true }));
  }
  return tests.map((c) => {
    try {
      const actual = fn(...cloneArgs(c.args));
      return { ok: deepEqual(actual, c.expected), actual: JSON.stringify(actual) ?? 'undefined' };
    } catch (e: any) {
      return { ok: false, actual: String(e?.message ?? e), error: true };
    }
  });
}

export function run(language: string, userCode: string, funcName: string, tests: TestCase[]): Promise<TestResult[]> {
  if (language === 'python') return runPython(userCode, funcName, tests);
  return Promise.resolve(runJavaScript(userCode, funcName, tests));
}
