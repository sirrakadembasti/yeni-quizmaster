import {defineConfig} from 'vitest/config';
import base from '../../vitest.config';

// One guarded migration template; each scale owns a separate copied database.
// The fixture includes seeding plus independent 120s capture/finalization phases.
export default defineConfig({...base,test:{...base.test,include:['tests/api/academic-archive-volume.test.ts','tests/academic-history-assets.test.ts'],maxWorkers:1,fileParallelism:false,testTimeout:360000,hookTimeout:120000}});
