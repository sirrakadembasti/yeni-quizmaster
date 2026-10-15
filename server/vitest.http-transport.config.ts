import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', fileParallelism: false, include: ['tests/utils/http-transport.test.ts'] },
});
