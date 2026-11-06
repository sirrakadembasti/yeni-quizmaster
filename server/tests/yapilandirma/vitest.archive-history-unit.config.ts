import path from 'node:path';
import {defineConfig} from 'vitest/config';
export default defineConfig({ root: path.resolve(__dirname, '../..'),test:{environment:'node',include:['tests/utils/archive-history-projection.test.ts','tests/utils/test-db-isolation.test.ts'],maxWorkers:1,fileParallelism:false}});
