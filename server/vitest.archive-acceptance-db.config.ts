import {defineConfig} from 'vitest/config';
import base from './vitest.config';

// One guarded migration template for lifecycle, projection, assets and volume.
// Volume lifecycle and first-version warm are separate 360s cases at each
// scale; ordinary DB tests retain 120s.
export default defineConfig({
  ...base,
  test:{
    ...base.test,
    include:[
      'tests/api/archive-worker-integration.test.ts',
      'tests/api/archive-active-consumers.test.ts',
      'tests/api/archive-retention.test.ts',
      'tests/api/annual-boundary-db.test.ts',
      'tests/api/academic-history-db.test.ts',
      'tests/api/archive-readonly.test.ts',
      'tests/api/academic-history-projection-db.test.ts',
      'tests/academic-history-assets.test.ts',
      'tests/api/academic-archive-volume.test.ts',
    ],
    maxWorkers:1,
    fileParallelism:false,
    testTimeout:120000,
    hookTimeout:120000,
  },
});
