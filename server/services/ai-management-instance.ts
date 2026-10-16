import path from 'node:path';
import { AIProfileStore, AIManagementError } from './ai-profiles';
import { ensureAIEncryptionKey, decryptAPIKey } from './ai-encryption';
import type { PrismaClient } from '@prisma/client';
import { getProjectRoot } from '../utils/project-paths';

let instance: AIProfileStore | undefined;
export function createManagedAIStore(db: PrismaClient, keyPath: string): AIProfileStore {
  return new AIProfileStore(db, async () => {
    const existing = await db.aIProfile.findFirst({ select: { encryptedApiKey: true } });
    try {
      const key = await ensureAIEncryptionKey(keyPath, { hasEncryptedProfiles: !!existing });
      // A valid-length replacement key must not create a mixed-key database.
      if (existing) decryptAPIKey(existing.encryptedApiKey, key);
      return key;
    } catch {
      throw new AIManagementError(503, 'AI_ENCRYPTION_UNAVAILABLE', 'AI şifreleme anahtarı kullanılamıyor. Doğrulanmış yedekten kurtarın.');
    }
  });
}
export async function getAIProfileStore(): Promise<AIProfileStore> {
  if (instance) return instance;
  const { getAIManagementDb } = await import('../storage');
  const db = getAIManagementDb();
  instance ??= createManagedAIStore(db, path.join(getProjectRoot(), 'server', 'data', 'ai-encryption.key'));
  return instance;
}
