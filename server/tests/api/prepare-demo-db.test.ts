import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import { storage, closeStorage } from '../../storage';
import { prepareDemoDatabase } from '../../prisma/prepare-demo-db';

const sourcePath = () => (process.env.DATABASE_URL || '').replace(/^file:/, '');
const targetPath = () => path.join(path.dirname(sourcePath()), 'demo-test.db');

const countUsers = (file: string) => {
  const db = new Database(file, { readonly: true });
  try {
    return (db.prepare('SELECT COUNT(*) AS total FROM User').get() as { total: number }).total;
  } finally {
    db.close();
  }
};
const showcaseCount = (file: string) => {
  const db = new Database(file, { readonly: true });
  try {
    return (db.prepare("SELECT COUNT(*) AS total FROM User WHERE email LIKE 'demo-%@quizmaster.com'").get() as { total: number }).total;
  } finally {
    db.close();
  }
};

beforeAll(async () => {
  await storage.createUser({ name: 'G01 Gerçek Yönetici', email: 'g01-real-admin@test.local', password: await bcrypt.hash('Password123', 4), role: 'admin' } as any);
}, 30000);

afterAll(async () => {
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${targetPath()}${suffix}`, { force: true });
  await closeStorage();
});

describe('G-01: demo hazırlama kaynak veritabanını korur', () => {
  it('gerçek yönetici varken --allow-real-data olmadan hata verir', async () => {
    await expect(prepareDemoDatabase({ sourcePath: sourcePath(), targetPath: targetPath() })).rejects.toThrow(/gerçek kurulum verisi/);
    expect(fs.existsSync(targetPath())).toBe(false);
  });

  it('izin verildiğinde kaynağa yazmaz, vitrin hesapları yalnız hedefte bulunur', async () => {
    const before = countUsers(sourcePath());
    expect(showcaseCount(sourcePath())).toBe(0);
    await prepareDemoDatabase({ sourcePath: sourcePath(), targetPath: targetPath(), allowRealData: true });
    expect(countUsers(sourcePath())).toBe(before);
    expect(showcaseCount(sourcePath())).toBe(0);
    expect(showcaseCount(targetPath())).toBe(4);
  });
});
