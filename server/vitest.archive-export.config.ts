import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node', include: ['tests/utils/archive-export.test.ts'], pool: 'forks', maxWorkers: 1, fileParallelism: false },
});
