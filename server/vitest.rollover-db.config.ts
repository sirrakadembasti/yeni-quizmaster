import { defineConfig } from 'vitest/config';
import base from './vitest.config';

// Reuse the guarded temporary datasource and migration/cleanup global setup.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ['tests/api/archive-worker-integration.test.ts', 'tests/api/archive-active-consumers.test.ts', 'tests/api/archive-retention.test.ts', 'tests/api/annual-boundary-db.test.ts', 'tests/api/academic-history-db.test.ts', 'tests/api/archive-readonly.test.ts'],
    testTimeout: 120000,
    hookTimeout: 120000,
  },
});
