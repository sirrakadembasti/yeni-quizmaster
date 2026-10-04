import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/utils/archive-worker.test.ts'],
    fileParallelism: false,
    testTimeout: 30000,
  },
});
