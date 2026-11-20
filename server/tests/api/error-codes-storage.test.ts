import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import { storage, closeStorage } from '../../storage';

// S-06: rotaların 409'a çevirdiği kodlar gerçekten storage'dan geliyor mu?
let teacher: any;

beforeAll(async () => {
  const hash = await bcrypt.hash('Password123', 4);
  teacher = await storage.createUser({ name: 'S06 Öğretmen', email: 's06-teacher@test.local', password: hash, role: 'teacher' } as any);
}, 30000);

afterAll(async () => { await closeStorage(); });

describe('S-06: storage hata kodları', () => {
  it('sınavı olan ders CATEGORY_IN_USE koduyla silinemez', async () => {
    const category = await storage.createCategory({ name: 'S06 Ders' } as any);
    await storage.createQuiz({ title: 'S06 sınav', createdBy: teacher.id, categoryId: category.id } as any);

    await expect(storage.deleteCategory(category.id)).rejects.toMatchObject({ code: 'CATEGORY_IN_USE' });
  });

  it('öğrencisi olan sınıf CLASS_NOT_EMPTY koduyla silinemez', async () => {
    const cls = await storage.createClass({ name: 'S06 Sınıf' } as any);
    const hash = await bcrypt.hash('Password123', 4);
    await storage.createUser({ name: 'S06 Öğrenci', email: 's06-student@test.local', password: hash, role: 'student', classId: cls.id } as any);

    await expect(storage.deleteClass(cls.id)).rejects.toMatchObject({ code: 'CLASS_NOT_EMPTY' });
  });
});
