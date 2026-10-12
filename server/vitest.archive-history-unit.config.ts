import {defineConfig} from 'vitest/config';
export default defineConfig({test:{environment:'node',include:['tests/utils/archive-history-projection.test.ts','tests/utils/test-db-isolation.test.ts'],maxWorkers:1,fileParallelism:false}});
