import {defineConfig} from 'vitest/config';
export default defineConfig({test:{environment:'node',include:['tests/utils/production-performance-notification.test.ts'],maxWorkers:1,fileParallelism:false}});
