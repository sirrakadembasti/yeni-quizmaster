import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['tests/academic-history-api.test.ts'], pool: 'forks', maxWorkers: 1, fileParallelism: false } });
