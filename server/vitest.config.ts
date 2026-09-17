import { defineConfig } from 'vitest/config';
import path from 'path';
import dns from 'node:dns';

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

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
