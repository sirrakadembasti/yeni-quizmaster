export default {
  test: {
    globals: true,
    environment: 'node',
    include: ['docs/integration-audit/ai-live.test.ts'],
    fileParallelism: false,
    testTimeout: 90000,
  },
};
