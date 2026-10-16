import {defineConfig} from 'vitest/config';
export default defineConfig({test:{environment:'node',include:['tests/utils/ai-management*.test.ts','tests/utils/external-request.test.ts'],fileParallelism:false}});
