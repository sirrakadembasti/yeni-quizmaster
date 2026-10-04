import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['tests/api/annual-capture-guard.test.ts'], fileParallelism: false } });
