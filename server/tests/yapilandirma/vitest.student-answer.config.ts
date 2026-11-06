import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Route contracts plus native deadline regressions in their own private fixture.
export default defineConfig({ root: path.resolve(__dirname, '../..'),
  test: { environment: 'node', include: ['tests/api/student-exam.test.ts', 'tests/utils/student-deadline.test.ts'], maxWorkers: 1, fileParallelism: false, testTimeout: 15000, hookTimeout: 15000 },
});
