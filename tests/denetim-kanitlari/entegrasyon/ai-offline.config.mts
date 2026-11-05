export default {
  test: {
    globals: true,
    environment: 'node',
    include: ['docs/integration-audit/ai-offline.test.ts'],
    fileParallelism: false,
    testTimeout: 10000,
  },
};
