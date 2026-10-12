import { defineConfig } from 'vitest/config';
import path from 'path';
import dns from 'node:dns';
import { mkdtempSync, writeFileSync } from 'node:fs';
const testDirectory = mkdtempSync(path.join(__dirname, 'data', 'quizmaster-test-'));

// Windows ortamında localhost çözümlemesini 127.0.0.1 olarak sabitle
const origLookup = dns.lookup.bind(dns);
(dns as any).lookup = function (hostname: any, options: any, callback: any) {
  let cb = callback;
  let opt = options;
  if (typeof opt === 'function') {
    cb = opt;
    opt = {};
  }
  if (hostname === 'localhost') {
    if (opt && opt.all) {
      return cb(null, [{ address: '127.0.0.1', family: 4 }]);
    }
    return cb(null, '127.0.0.1', 4);
  }
  return origLookup(hostname, opt, cb);
};

if (dns.promises) {
  const origPromises = dns.promises.lookup.bind(dns.promises);
  (dns.promises as any).lookup = function (hostname: any, options: any) {
    if (hostname === 'localhost') {
      if (options && options.all) {
        return Promise.resolve([{ address: '127.0.0.1', family: 4 }]);
      }
      return Promise.resolve({ address: '127.0.0.1', family: 4 });
    }
    return origPromises(hostname, options);
  };
}

writeFileSync(path.join(testDirectory, 'test.db'), '');

export default defineConfig({
  root: __dirname,
  test: {
    environment: 'node',
    globals: true,
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    globalSetup: ['tests/global-setup.ts'],
    setupFiles: ['tests/file-db-setup.ts'],
    include: ['tests/**/*.test.ts'],
    env: {
      DATABASE_URL: 'file:' + path.join(testDirectory, 'test.db').split('\\').join('/'),
      QUIZMASTER_TEST_TEMPLATE: path.join(testDirectory, 'migration-template.db'),
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
