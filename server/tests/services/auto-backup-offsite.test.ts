import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { syncOffsiteBackups, getOffsiteConfig } from '../../services/auto-backup';

// #1: otomatik yedeklerin ağ paylaşımına (veya başka bir dizine) kopyalanması.
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

function setup(days: string[]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quizmaster-offsite-'));
  roots.push(root);
  const sourceDir = path.join(root, 'auto');
  const share = path.join(root, 'share');
  fs.mkdirSync(path.join(sourceDir, 'uploads'), { recursive: true });
  fs.mkdirSync(share);
  for (const day of days) fs.writeFileSync(path.join(sourceDir, `quiz-${day}.db`), `veri-${day}`);
  fs.writeFileSync(path.join(sourceDir, 'uploads', 'a.png'), 'AAAA');
  return { root, sourceDir, share, targetDir: path.join(share, 'quizmaster') };
}

describe('yedeği sunucu dışına kopyalama', () => {
  it('eksik yedekleri ve uploads yansısını hedefe kopyalar', async () => {
    const { sourceDir, targetDir } = setup(['20261120', '20261121']);
    const result = await syncOffsiteBackups({ sourceDir, targetDir, keep: 14 });
    expect(result.copied.sort()).toEqual(['quiz-20261120.db', 'quiz-20261121.db']);
    expect(fs.readFileSync(path.join(targetDir, 'quiz-20261121.db'), 'utf8')).toBe('veri-20261121');
    expect(fs.readFileSync(path.join(targetDir, 'uploads', 'a.png'), 'utf8')).toBe('AAAA');
  });

  it('ikinci çalıştırmada zaten kopyalanmış yedekleri yeniden kopyalamaz', async () => {
    const { sourceDir, targetDir } = setup(['20261121']);
    await syncOffsiteBackups({ sourceDir, targetDir, keep: 14 });
    const second = await syncOffsiteBackups({ sourceDir, targetDir, keep: 14 });
    expect(second.copied).toEqual([]);
  });

  it('hedefte yalnız en yeni N yedeği tutar', async () => {
    const { sourceDir, targetDir } = setup(['20261118', '20261119', '20261120', '20261121']);
    const result = await syncOffsiteBackups({ sourceDir, targetDir, keep: 2 });
    expect(fs.readdirSync(targetDir).filter(n => n.endsWith('.db')).sort()).toEqual(['quiz-20261120.db', 'quiz-20261121.db']);
    expect(result.removed.sort()).toEqual(['quiz-20261118.db', 'quiz-20261119.db']);
  });

  it('hedefin üst dizini yoksa (paylaşım bağlı değil) hata verir ve yerelde klasör oluşturmaz', async () => {
    const { root, sourceDir } = setup(['20261121']);
    const targetDir = path.join(root, 'bagli-degil', 'quizmaster');
    await expect(syncOffsiteBackups({ sourceDir, targetDir, keep: 14 })).rejects.toThrow();
    expect(fs.existsSync(path.join(root, 'bagli-degil'))).toBe(false);
  });

  it('yarım kalmış .tmp dosyasını sonraki çalıştırmada temizler ve yedeği tamamlar', async () => {
    const { sourceDir, targetDir } = setup(['20261121']);
    fs.mkdirSync(targetDir);
    fs.writeFileSync(path.join(targetDir, 'quiz-20261121.db.tmp'), 'yarim');
    await syncOffsiteBackups({ sourceDir, targetDir, keep: 14 });
    expect(fs.existsSync(path.join(targetDir, 'quiz-20261121.db.tmp'))).toBe(false);
    expect(fs.readFileSync(path.join(targetDir, 'quiz-20261121.db'), 'utf8')).toBe('veri-20261121');
  });
});

describe('BACKUP_OFFSITE_* ayarı', () => {
  it('hedef boşsa kapalıdır', () => {
    expect(getOffsiteConfig({})).toBeNull();
    expect(getOffsiteConfig({ BACKUP_OFFSITE_DIR: '  ' })).toBeNull();
  });
  it('saklama sayısı varsayılan 14, geçersizse 14', () => {
    expect(getOffsiteConfig({ BACKUP_OFFSITE_DIR: 'X:/y' })).toEqual({ targetDir: 'X:/y', keep: 14 });
    expect(getOffsiteConfig({ BACKUP_OFFSITE_DIR: 'X:/y', BACKUP_OFFSITE_KEEP: '0' })?.keep).toBe(14);
    expect(getOffsiteConfig({ BACKUP_OFFSITE_DIR: 'X:/y', BACKUP_OFFSITE_KEEP: '30' })?.keep).toBe(30);
  });
});
