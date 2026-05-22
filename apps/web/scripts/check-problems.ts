/** Validates that each problem's JavaScript reference solution passes its own
 *  tests, using the exact same harness the in-browser judge uses. Run: npx tsx scripts/check-problems.ts */
import { PROBLEMS } from '../src/lib/problems';
import { runJavaScript } from '../src/lib/runners';

let failures = 0;
for (const p of PROBLEMS) {
  const js = p.solutions.find((s) => s.language === 'javascript');
  if (!js) {
    console.log(`✗ ${p.slug}: no JavaScript solution`);
    failures++;
    continue;
  }
  const results = runJavaScript(js.code, p.funcName.javascript, p.tests);
  const bad = results.filter((r) => !r.ok);
  if (bad.length) {
    failures++;
    console.log(`FAIL ${p.slug}: ${p.tests.length - bad.length}/${p.tests.length} passed`);
    bad.forEach((b, i) => console.log(`     case ${i}: got ${b.actual}`));
  } else {
    console.log(`ok   ${p.slug}: ${p.tests.length}/${p.tests.length}`);
  }
}
console.log(failures ? `\n${failures} problem(s) FAILED` : `\nAll ${PROBLEMS.length} problems pass their JS solutions`);
process.exit(failures ? 1 : 0);
