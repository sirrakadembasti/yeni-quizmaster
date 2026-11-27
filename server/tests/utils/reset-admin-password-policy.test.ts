import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// reset-admin betiği içe aktarılınca veritabanına bağlandığı için kaynak üzerinden denetlenir (T-03 ile aynı yaklaşım).
const source = fs.readFileSync(path.resolve(__dirname, '../../prisma/reset-admin.ts'), 'utf8');

describe('reset-admin parola kuralı', () => {
  it('parola uzunluğu için sabit bir sayı değil, ortak parola politikasını kullanır', () => {
    expect(source).toMatch(/password-policy/);
    expect(source).not.toMatch(/newPassword\.length\s*<\s*\d+/);
  });
});
