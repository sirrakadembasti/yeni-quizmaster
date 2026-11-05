import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node', include: ['tests/utils/results-summary.test.ts', 'tests/utils/results-summary-route.test.ts'], maxWorkers: 1, fileParallelism: false },
});
