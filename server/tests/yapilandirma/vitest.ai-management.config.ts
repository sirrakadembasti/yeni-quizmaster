import path from 'node:path';
import {defineConfig} from 'vitest/config';
export default defineConfig({ root: path.resolve(__dirname, '../..'),test:{environment:'node',include:['tests/utils/ai-management*.test.ts','tests/utils/external-request.test.ts'],fileParallelism:false}});
