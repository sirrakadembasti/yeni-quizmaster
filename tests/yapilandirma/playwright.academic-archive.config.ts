import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const runtimeFile = process.env.ACADEMIC_ARCHIVE_RUNTIME;
if (!runtimeFile) throw new Error('Run node scripts/academic-archive-runner.mjs; deployment servers must never be reused.');
const runtime = JSON.parse(readFileSync(runtimeFile, 'utf8'));
if (path.dirname(runtimeFile) !== runtime.root || path.dirname(runtime.root) !== path.resolve('server/data') || !path.basename(runtime.root).startsWith('quizmaster-test-academic-') || runtime.database !== path.join(runtime.root, 'server/data/academic.db') || !Array.isArray(runtime.ports) || runtime.ports.length !== 2 || runtime.ports.some((port: number) => !Number.isInteger(port) || port < 1024 || port > 65535) || runtime.ports[0] === runtime.ports[1] || runtime.baseURL !== `http://127.0.0.1:${runtime.ports[1]}`) throw new Error('Invalid disposable runtime');
export default defineConfig({
  testDir: '../e2e', testMatch: ['academic-archive*.spec.ts', 'academic-history.spec.ts'], workers: 1, retries: 0,
  timeout: 60000, reporter: 'list', outputDir: path.join(runtime.root, 'browser-results'),
  use: { ...devices['Desktop Chrome'], baseURL: runtime.baseURL, trace: 'off', screenshot: 'off' },
  // Servers are owned by the runner. There is no reusable webServer fallback.
});
