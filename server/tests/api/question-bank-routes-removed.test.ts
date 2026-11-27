import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// T-01 kalanı: arayüzün hiç kullanmadığı /api/question-bank rotaları silindi.
// QuestionBank tablosu yıllık arşivde kullanıldığı için şemada ve arşiv kodunda kalır.
const apiRoutesDir = path.resolve(__dirname, '../../api-routes');

describe('soru havuzu rotaları kaldırıldı', () => {
  it('question-bank rota dosyası yoktur ve routes.ts onu bağlamaz', () => {
    expect(fs.existsSync(path.join(apiRoutesDir, 'question-bank.ts'))).toBe(false);
    const routes = fs.readFileSync(path.join(apiRoutesDir, 'routes.ts'), 'utf8');
    expect(routes).not.toMatch(/question-bank/);
  });

  it('storage soru havuzu için kullanılmayan CRUD yöntemleri sunmaz', () => {
    const storage = fs.readFileSync(path.resolve(__dirname, '../../storage.ts'), 'utf8');
    expect(storage).not.toMatch(/(get|create|delete)QuestionBankItems?\b/);
  });
});
