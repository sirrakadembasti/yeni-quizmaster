import { defineConfig, devices } from '@playwright/test';
export default defineConfig({ testDir: './tests-e2e', testMatch: ['teacher-*-audit.spec.ts'],
  workers: 1, retries: 0, timeout: 90000, expect: { timeout: 15000 },
  reporter: [['list'], ['json', { outputFile: 'docs/teacher-audit/results-latest.json' }]],
  outputDir: 'docs/teacher-audit/test-results-latest',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5531',
    screenshot: 'only-on-failure', trace: 'off' } });
