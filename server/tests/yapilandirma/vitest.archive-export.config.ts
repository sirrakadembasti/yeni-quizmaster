import path from 'node:path';
import { defineConfig } from 'vitest/config';
export default defineConfig({ root: path.resolve(__dirname, '../..'),
  test: { environment: 'node', include: ['tests/utils/archive-export.test.ts'], pool: 'forks', maxWorkers: 1, fileParallelism: false },
});
