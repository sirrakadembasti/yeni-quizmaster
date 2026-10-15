import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['tests/utils/notification-preferences.test.ts', 'tests/api/notification-preferences.test.ts'], maxWorkers: 1, fileParallelism: false } });
