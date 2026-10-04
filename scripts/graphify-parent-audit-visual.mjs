// Run only after Graphify has refreshed graph.html + graph.json for this source.
// Real CDN renderer and owned browser; no application server or database access.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const graphRoot = path.join(sourceRoot, 'graphify-out');
assert.equal(fs.realpathSync(graphRoot), graphRoot, 'Graph directory must not be a symlink');
const outputRoot = path.join(sourceRoot, 'docs/parent-audit/graphify');
fs.mkdirSync(outputRoot, { recursive: true });
const report = {
  startedAt: new Date().toISOString(), status: 'running',
  pageErrors: [], consoleErrors: [], failedRequests: [], responses: [], navigations: [],
  cleanup: { browserClosed: false, serverClosed: false },
};
const safeUrl = value => {
  try {
    const url = new URL(value);
    return { origin: url.origin, pathname: url.pathname, queryKeys: [...url.searchParams.keys()] };
  } catch { return { origin: null, pathname: '<unparseable>', queryKeys: [] }; }
};
const safeMessage = value => String(value)
  .replace(/https?:\/\/[^\s"'<>]+/g, url => {
    const safe = safeUrl(url);
    return safe.origin + safe.pathname + (safe.queryKeys.length ? '?<query-values-omitted>' : '');
  })
  .replace(/(password|secret|token|authorization|cookie)\s*[:=]\s*\S+/gi, '$1=<redacted>');

// Only these two generated files can be served, even for encoded traversal.
const allowed = new Map([['/graph.html', 'text/html; charset=utf-8'], ['/graph.json', 'application/json']]);
const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
  let requested;
  try { requested = decodeURIComponent((req.url || '').split('?')[0]); }
  catch { res.writeHead(400).end(); return; }
  if (requested === '/') requested = '/graph.html';
  if (requested === '/favicon.ico') { res.writeHead(204).end(); return; }
  if (requested.includes('\\') || requested.includes('\0') || !allowed.has(requested)) {
    res.writeHead(404).end(); return;
  }
  const target = path.resolve(graphRoot, '.' + requested);
  const relative = path.relative(graphRoot, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) ||
      !fs.existsSync(target) || fs.realpathSync(target) !== target || !fs.statSync(target).isFile()) {
    res.writeHead(404).end(); return;
  }
  res.writeHead(200, { 'content-type': allowed.get(requested), 'cache-control': 'no-store' });
  if (req.method === 'HEAD') res.end();
  else fs.createReadStream(target).on('error', () => res.destroy()).pipe(res);
});
let browser;
try {
  const graph = JSON.parse(fs.readFileSync(path.join(graphRoot, 'graph.json'), 'utf8'));
  const edges = graph.links || graph.edges || [];
  const candidates = graph.nodes.filter(node =>
    node.source_file?.replaceAll('\\', '/') === 'client/src/pages/parent-results.tsx' &&
    /^ParentResultsPage(?:\(\))?$/.test(node.label));
  assert.equal(candidates.length, 1, 'Refreshed graph.json must contain the production migration helper');
  const helper = candidates[0];
  const endpoint = value => typeof value === 'object' ? value.id : value;
  const degree = edges.filter(edge => endpoint(edge.source ?? edge.from) === helper.id || endpoint(edge.target ?? edge.to) === helper.id).length;
  assert(degree > 0, 'Production migration helper must have graph connections');
  report.graphJson = {
    nodes: graph.nodes.length, edges: edges.length,
    communities: new Set(graph.nodes.map(node => node.community).filter(value => value != null)).size,
    builtAtCommit: graph.built_at_commit ?? null,
    helper: { id: helper.id, label: helper.label, source: helper.source_file, degree },
  };
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  report.servedOrigin = origin;
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push(safeMessage(error.message)));
  page.on('console', message => {
    if (message.type() === 'error') report.consoleErrors.push({ message: safeMessage(message.text()), location: safeUrl(message.location().url) });
  });
  page.on('requestfailed', request => report.failedRequests.push({ method: request.method(), ...safeUrl(request.url()), error: safeMessage(request.failure()?.errorText || 'unknown') }));
  page.on('response', response => report.responses.push({ status: response.status(), ...safeUrl(response.url()) }));
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) report.navigations.push(safeUrl(frame.url())); });
  await page.goto(origin + '/graph.html', { waitUntil: 'load', timeout: 60000 });
  await page.locator('#graph canvas').waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForFunction(() => {
    const canvas = document.querySelector('#graph canvas');
    if (!canvas || !canvas.width || !canvas.height || typeof network === 'undefined' || !nodesDS.length || !edgesDS.length) return false;
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    for (let index = 3; index < pixels.length; index += 64) if (pixels[index] > 0) return true;
    return false;
  }, undefined, { timeout: 60000 });
  const stats = await page.locator('#stats').innerText();
  assert(stats.includes(`${graph.nodes.length} nodes`), 'Rendered stats must match graph JSON node count');
  assert(stats.includes(`${edges.length} edges`), 'Rendered stats must match graph JSON edge count');
  await page.screenshot({ path: path.join(outputRoot, 'overview.png') });
  await page.locator('#search').fill('ParentResultsPage');
  const searchItem = page.locator('#search-results .search-item').filter({ hasText: /^ParentResultsPage(?:\(\))?$/ });
  assert.equal(await searchItem.count(), 1, 'Search must expose the exact helper label');
  await searchItem.click();
  await page.waitForFunction(({ id, label }) =>
    network.getSelectedNodes().includes(id) && document.querySelector('#info-content')?.textContent.includes(label),
  { id: helper.id, label: helper.label }, { timeout: 15000 });
  const info = await page.locator('#info-content').innerText();
  assert(info.includes(helper.label) && info.includes('client/src/pages/parent-results.tsx'), 'Selected info panel must identify helper and production source');
  // Wait for the renderer's own focus animation, without replacing its data/API.
  await page.evaluate(() => new Promise(resolve => {
    const finish = () => resolve();
    network.once('animationFinished', finish);
    setTimeout(finish, 1200);
  }));
  report.rendered = await page.evaluate(id => {
    const canvas = document.querySelector('#graph canvas');
    const box = canvas.getBoundingClientRect();
    const node = nodesDS.get(id);
    return { stats: document.querySelector('#stats').textContent, canvas: { width: canvas.width, height: canvas.height, visibleWidth: box.width, visibleHeight: box.height }, helper: { id: node.id, label: node.label, source: node.source_file, degree: node.degree, connectedEdges: network.getConnectedEdges(id).length }, selected: network.getSelectedNodes() };
  }, helper.id);
  assert(report.rendered.canvas.visibleWidth > 0 && report.rendered.canvas.visibleHeight > 0);
  assert(report.rendered.helper.connectedEdges > 0);
  report.selectedInfo = info;
  await page.screenshot({ path: path.join(outputRoot, 'map.png') });
  await page.locator('#info-panel').screenshot({ path: path.join(outputRoot, 'selected-info.png') });
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.error = safeMessage(error.message);
  process.exitCode = 1;
} finally {
  if (browser) {
    try { await browser.close(); report.cleanup.browserClosed = true; }
    catch (error) { report.cleanup.browserError = safeMessage(error.message); process.exitCode = 1; }
  } else report.cleanup.browserClosed = true;
  try {
    if (server.listening) {
      server.closeAllConnections();
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
    report.cleanup.serverClosed = true;
  } catch (error) { report.cleanup.serverError = safeMessage(error.message); process.exitCode = 1; }
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(outputRoot, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, evidence: outputRoot, cleanup: report.cleanup, error: report.error }));
}
