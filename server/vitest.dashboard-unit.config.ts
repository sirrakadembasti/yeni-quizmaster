import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/utils/dashboard-stats.test.ts'],
    maxWorkers: 1,
    fileParallelism: false,
  },
});
