import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// T-03: sunucu rotaları Pino (logger) kullanmalı; console.* üretimde JSON günlüklerinin dışına düşer.
const routesDir = path.resolve(__dirname, '../../api-routes');

describe('T-03: api-routes altında console.* yok', () => {
  it('hiçbir rota dosyası console.error/log/warn/info çağırmaz', () => {
    const offenders = fs.readdirSync(routesDir)
      .filter(name => name.endsWith('.ts'))
      .flatMap(name => fs.readFileSync(path.join(routesDir, name), 'utf8').split(/\r?\n/)
        .map((line, index) => ({ name, line: index + 1, text: line }))
        .filter(({ text }) => /\bconsole\.(error|log|warn|info|debug)\b/.test(text))
        .map(({ name: file, line }) => `${file}:${line}`));
    expect(offenders).toEqual([]);
  });
});
