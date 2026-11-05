import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
export default defineConfig({ testDir: '../e2e', testMatch: ['teacher-*-audit.spec.ts'],
  workers: 1, retries: 0, timeout: 90000, expect: { timeout: 15000 },
  reporter: [['list'], ['json', { outputFile: path.resolve('tests/denetim-kanitlari/ogretmen/results-latest.json') }]],
  outputDir: path.resolve('tests/denetim-kanitlari/ogretmen/test-results-latest'),
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5531',
    screenshot: 'only-on-failure', trace: 'off' } });
