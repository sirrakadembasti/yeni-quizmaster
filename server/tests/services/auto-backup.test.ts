import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { runAutoBackup } from '../../services/auto-backup';

// S-09: çalışırken (çevrimiçi) günlük veritabanı yedeği; son N kopya tutulur; uploads artımlı yansıtılır.
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quizmaster-auto-backup-'));
  roots.push(root);
  const databaseFile = path.join(root, 'quiz.db');
  const db = new Database(databaseFile);
  db.pragma('journal_mode = WAL');
  db.exec("CREATE TABLE sample (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO sample (name) VALUES ('birinci'), ('ikinci');");
  // Canlı uygulama gibi bağlantı açık kalır: yedek çalışırken yazma bağlantısı sürüyor.
  const uploadsDir = path.join(root, 'uploads');
  fs.mkdirSync(path.join(uploadsDir, 'nested'), { recursive: true });
  fs.writeFileSync(path.join(uploadsDir, 'a.png'), 'AAAA');
  fs.writeFileSync(path.join(uploadsDir, 'nested', 'b.png'), 'BB');
  const backupDir = path.join(root, 'backups', 'auto');
  return { root, db, databaseFile, uploadsDir, backupDir };
}
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0);

describe('S-09: otomatik yedek', () => {
  it('çalışan veritabanından tutarlı, bağımsız bir quiz-YYYYMMDD.db üretir', async () => {
    const { db, databaseFile, backupDir } = setup();
    try {
      const result = await runAutoBackup({ databaseFile, backupDir, keep: 7, now: day(2026, 11, 21) });
      expect(result.skipped).toBe(false);
      const file = path.join(backupDir, 'quiz-20261121.db');
      expect(fs.existsSync(file)).toBe(true);
      const copy = new Database(file, { readonly: true });
      try {
        expect(copy.prepare('SELECT name FROM sample ORDER BY id').all()).toEqual([{ name: 'birinci' }, { name: 'ikinci' }]);
        expect(copy.pragma('journal_mode', { simple: true })).toBe('delete');
        expect(copy.pragma('integrity_check', { simple: true })).toBe('ok');
      } finally { copy.close(); }
      expect(fs.readdirSync(backupDir).filter(name => name.endsWith('.tmp'))).toEqual([]);
    } finally { db.close(); }
  });

  it('aynı gün ikinci çalıştırma yeni yedek almaz', async () => {
    const { db, databaseFile, backupDir } = setup();
    try {
      await runAutoBackup({ databaseFile, backupDir, keep: 7, now: day(2026, 11, 21) });
      const second = await runAutoBackup({ databaseFile, backupDir, keep: 7, now: day(2026, 11, 21) });
      expect(second).toMatchObject({ skipped: true, reason: 'exists' });
    } finally { db.close(); }
  });

  it('yalnız son N yedeği tutar, eski olanları siler', async () => {
    const { db, databaseFile, backupDir } = setup();
    try {
      fs.mkdirSync(backupDir, { recursive: true });
      for (const stamp of ['20261110', '20261111', '20261112', '20261113', '20261114']) fs.writeFileSync(path.join(backupDir, `quiz-${stamp}.db`), 'old');
      fs.writeFileSync(path.join(backupDir, 'baska-dosya.txt'), 'dokunma');
      const result = await runAutoBackup({ databaseFile, backupDir, keep: 3, now: day(2026, 11, 21) });
      expect(fs.readdirSync(backupDir).filter(name => name.startsWith('quiz-')).sort()).toEqual(['quiz-20261113.db', 'quiz-20261114.db', 'quiz-20261121.db']);
      expect(fs.existsSync(path.join(backupDir, 'baska-dosya.txt'))).toBe(true);
      expect(result.skipped === false && result.removed.sort()).toEqual(['quiz-20261110.db', 'quiz-20261111.db', 'quiz-20261112.db']);
    } finally { db.close(); }
  });

  it('uploads dizinini artımlı yansıtır ve kaynakta silinen dosyayı yedekte tutar', async () => {
    const { db, databaseFile, uploadsDir, backupDir } = setup();
    try {
      const first = await runAutoBackup({ databaseFile, backupDir, uploadsDir, keep: 7, now: day(2026, 11, 21) });
      expect(first.skipped === false && first.uploadsCopied).toBe(2);
      expect(fs.readFileSync(path.join(backupDir, 'uploads', 'nested', 'b.png'), 'utf8')).toBe('BB');

      fs.writeFileSync(path.join(uploadsDir, 'c.png'), 'CCC');
      fs.rmSync(path.join(uploadsDir, 'a.png'));
      const next = await runAutoBackup({ databaseFile, backupDir, uploadsDir, keep: 7, now: day(2026, 11, 22) });
      expect(next.skipped === false && next.uploadsCopied).toBe(1); // yalnız yeni dosya
      expect(fs.existsSync(path.join(backupDir, 'uploads', 'c.png'))).toBe(true);
      expect(fs.existsSync(path.join(backupDir, 'uploads', 'a.png'))).toBe(true); // silinen kaynak yansıdan silinmez
    } finally { db.close(); }
  });

  it('yansıdaki dosyanın zaman damgası kaynaktan az geride olsa da (yuvarlama, FAT/exFAT) yeniden kopyalanmaz', async () => {
    const { db, databaseFile, uploadsDir, backupDir } = setup();
    try {
      await runAutoBackup({ databaseFile, backupDir, uploadsDir, keep: 7, now: day(2026, 11, 21) });
      // Linux'ta ms'ye yuvarlanan utimes ve FAT/exFAT'in 2 sn hassasiyeti hedefi kaynağın biraz altında bırakabilir.
      for (const file of ['a.png', path.join('nested', 'b.png')]) {
        const mirror = path.join(backupDir, 'uploads', file);
        const source = fs.statSync(path.join(uploadsDir, file));
        fs.utimesSync(mirror, source.atime, new Date(source.mtimeMs - 1500));
      }
      const next = await runAutoBackup({ databaseFile, backupDir, uploadsDir, keep: 7, now: day(2026, 11, 22) });
      expect(next.skipped === false && next.uploadsCopied).toBe(0);
    } finally { db.close(); }
  });

  it('yarım kalmış .tmp dosyalarını temizler', async () => {
    const { db, databaseFile, backupDir } = setup();
    try {
      fs.mkdirSync(backupDir, { recursive: true });
      fs.writeFileSync(path.join(backupDir, 'quiz-20261120.db.tmp'), 'yarim');
      await runAutoBackup({ databaseFile, backupDir, keep: 7, now: day(2026, 11, 21) });
      expect(fs.existsSync(path.join(backupDir, 'quiz-20261120.db.tmp'))).toBe(false);
    } finally { db.close(); }
  });

  it('veritabanı yoksa hata verir ve geçersiz yedek bırakmaz', async () => {
    const { root, db, backupDir } = setup();
    try {
      await expect(runAutoBackup({ databaseFile: path.join(root, 'yok.db'), backupDir, keep: 7, now: day(2026, 11, 21) })).rejects.toThrow();
      const leftovers = fs.existsSync(backupDir) ? fs.readdirSync(backupDir) : [];
      expect(leftovers.filter(name => name.startsWith('quiz-'))).toEqual([]);
    } finally { db.close(); }
  });
});
