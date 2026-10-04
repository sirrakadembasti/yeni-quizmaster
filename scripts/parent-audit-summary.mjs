import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '..'), out = path.join(root, 'docs/parent-audit');
const require = createRequire(path.join(root, 'package.json'));
const cli = path.join(path.dirname(require.resolve('playwright/package.json')), 'cli.js');
const manifest = JSON.parse(execFileSync(process.execPath, [cli, 'test', '-c', 'playwright.parent-audit.config.ts', '--list', '--reporter=json'], { cwd: root, windowsHide: true, env: { ...process.env, FORCE_COLOR:'0' }, encoding: 'utf8', timeout: 60000 }));
function flatten(suites) {
  return suites.flatMap(suite => [...(suite.specs || []).map(spec => ({ id: spec.id, title: spec.title, file: spec.file, tests: spec.tests })), ...flatten(suite.suites || [])]);
}
const cases = flatten(manifest.suites), latest = new Map(), cohorts = [];
const repairs = process.argv.includes('--repairs');
for (const name of repairs ? ['repairs-final', 'repairs-review', 'repairs-types'] : ["baseline","depth","readiness","print"]) {
  const file = path.join(out, `results-${name}.json`);
  if (!fs.existsSync(file)) throw new Error(`Missing completed cohort ${name}`);
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  cohorts.push({ file: path.basename(file), stats: report.stats });
  for (const spec of flatten(report.suites)) {
    const result = spec.tests?.[0]?.results?.at(-1);
    if (result) latest.set(spec.id, { status: result.status, report: path.basename(file), durationMs: result.duration, error: result.error?.message?.replace(/\x1b\[[0-9;]*m/g,'').slice(0,1200) });
  }
}
const rows = cases.map(({id,title,file}) => ({id,title,file,...(latest.get(id) || {status:'not-run'})}));
const summary = { currentConfig:'playwright.parent-audit.config.ts', total:rows.length, passed:rows.filter(x=>x.status==='passed').length, failed:rows.filter(x=>['failed','timedOut','interrupted'].includes(x.status)).length, notRun:rows.filter(x=>x.status==='not-run').length, skipped:rows.filter(x=>x.status==='skipped').length, cohorts, cases:rows };
if (summary.passed + summary.failed + summary.notRun + summary.skipped !== summary.total) throw new Error('Unknown outcome in coverage summary');
fs.writeFileSync(path.join(out,repairs ? 'repairs-coverage-summary.json' : 'coverage-summary.json'), JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({total:summary.total,passed:summary.passed,failed:summary.failed,notRun:summary.notRun,skipped:summary.skipped}));
