import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
export default defineConfig({ testDir: '../e2e', testMatch: ['parent-*-audit.spec.ts'], workers: 1, retries: 0, timeout: 120000, expect: { timeout: 15000 }, reporter: [['list'], ['json', { outputFile: path.resolve('tests/denetim-kanitlari/veli/results-latest.json') }]], outputDir: path.resolve('tests/denetim-kanitlari/veli/test-results-latest'), use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5561', screenshot: 'only-on-failure', trace: 'off' } });
