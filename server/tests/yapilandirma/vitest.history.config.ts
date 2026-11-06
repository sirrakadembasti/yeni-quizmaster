import path from 'node:path';
import { defineConfig } from 'vitest/config';
export default defineConfig({ root: path.resolve(__dirname, '../..'), test: { environment:'node', include:['tests/academic-history-api.test.ts'], fileParallelism:false, testTimeout:10000 } });
