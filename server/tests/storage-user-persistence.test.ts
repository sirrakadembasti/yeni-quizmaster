import { afterAll, describe, expect, it } from 'vitest';
import { storage } from '../storage';

const email = `parent-persistence-${Date.now()}@example.com`;
let userId: string | undefined;

afterAll(async () => {
  if (userId) await storage.deleteUser(userId);
});

describe('User parent data persistence', () => {
  it('persists parent fields on create and update', async () => {
    const created = await storage.createUser({
      name: 'Persistence Student',
      email,
      password: 'test-hash',
      role: 'student',
      parentName: 'İlk Veli',
      parentRelation: 'Vasi',
      parentPhone: '05551112233',
      parentEmail: 'ilk.veli@example.com',
      parentAddress: 'İlk adres',
    });
    userId = created.id;
    expect(created.parentName).toBe('İlk Veli');
    expect(created.parentEmail).toBe('ilk.veli@example.com');

    const updated = await storage.updateUser(created.id, {
      parentName: 'Güncel Veli',
      parentRelation: 'Anne',
      parentPhone: '05559998877',
      parentEmail: 'guncel.veli@example.com',
      parentAddress: 'Güncel adres',
    });
    expect(updated.parentName).toBe('Güncel Veli');
    expect(updated.parentRelation).toBe('Anne');
    expect(updated.parentPhone).toBe('05559998877');
    expect(updated.parentEmail).toBe('guncel.veli@example.com');
    expect(updated.parentAddress).toBe('Güncel adres');

    const reloaded = await storage.getUser(created.id);
    expect(reloaded?.parentName).toBe('Güncel Veli');
    expect(reloaded?.parentAddress).toBe('Güncel adres');
  });
});