import { defineConfig } from 'vitest/config';

// No application startup, environment loading, or migration hooks in native runtime checks.
export default defineConfig({
  test: { environment: 'node', fileParallelism: false, include: ['tests/utils/sqlite-session-runtime.test.ts', 'tests/utils/sqlite-runtime.test.ts', 'tests/utils/sqlite-runtime-config.test.ts', 'tests/utils/storage-read-connection.test.ts'] },
});
