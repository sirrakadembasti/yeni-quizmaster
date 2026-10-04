import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node', include: ['tests/api/archive-jobs.test.ts'], pool: 'forks', maxWorkers: 1, fileParallelism: false },
});
