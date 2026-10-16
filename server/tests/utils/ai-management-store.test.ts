import { it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { AIProfileStore } from '../../services/ai-profiles';
import { ensureAIEncryptionKey } from '../../services/ai-encryption';
import { createManagedAIStore } from '../../services/ai-management-instance';
import { writeFile } from 'node:fs/promises';
let db: PrismaClient, store: AIProfileStore, dir: string;
const input = { name: 'Test', provider: 'openai', model: 'test', baseURL: 'https://api.example.com/v1', apiKey: 'fixture-secret' };
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'qm-ai-')); db = new PrismaClient({ datasources: { db: { url: 'file:' + join(dir, 'test.db').replaceAll('\\', '/') } } }); const sql = await readFile(new URL('../../prisma/migrations/20261015000100_ai_management/migration.sql', import.meta.url), 'utf8'); for (const statement of sql.split(';').filter(s => s.trim()))
    await db.$executeRawUnsafe(statement); const key = randomBytes(32); store = new AIProfileStore(db, () => key); });
afterEach(async () => { await db?.$disconnect(); await rm(dir, { recursive: true, force: true }); });
it('requires current successful quick test and supports multiple enabled profiles', async () => { const a = await store.save(input), b = await store.save({ ...input, name: 'B' }); await expect(store.setEnabled(a.id, a.revision, true)).rejects.toMatchObject({ code: 'AI_TEST_REQUIRED' }); for (const p of [a, b]) {
    expect(await store.recordTest(p.id, p.revision, 'quick', 'passed', { durationMs: 1 })).toBe(true);
    await store.setEnabled(p.id, p.revision, true);
} expect((await store.list()).profiles.filter(p => p.enabled)).toHaveLength(2); expect(JSON.stringify(await store.list())).not.toContain('fixture-secret'); });
it('requires revisions and replacement credentials for endpoint changes', async () => { const p = await store.save(input); await expect(store.save({ ...input, apiKey: '' }, p.id)).rejects.toMatchObject({ status: 409 }); await expect(store.save({ ...input, apiKey: '', baseURL: 'https://other.example.com', revision: p.revision }, p.id)).rejects.toMatchObject({ code: 'AI_NEW_KEY_REQUIRED' }); const next = await store.save({ ...input, apiKey: '', revision: p.revision }, p.id); expect(next.revision).toBe(2); expect(await store.recordTest(p.id, p.revision, 'quick', 'passed', { durationMs: 2 })).toBe(false); await expect(store.remove(p.id, p.revision)).rejects.toMatchObject({ status: 409 }); });
it('clears default on disable and uses configuration CAS', async () => { const p = await store.save(input); await store.recordTest(p.id, p.revision, 'quick', 'passed', { durationMs: 1 }); const enabled = await store.setEnabled(p.id, p.revision, true); const list = await store.list(); await store.setDefault(p.id, list.settingsRevision, enabled.revision); await expect(store.setDefault(null, list.settingsRevision)).rejects.toMatchObject({ status: 409 }); await store.setEnabled(p.id, enabled.revision, false); expect((await store.list()).defaultProfileId).toBeNull(); });
it('never creates a replacement key for existing ciphertext', async () => { const path = join(dir, 'encryption.key'); await expect(ensureAIEncryptionKey(path, { hasEncryptedProfiles: true })).rejects.toThrow(); const key = await ensureAIEncryptionKey(path); expect(await ensureAIEncryptionKey(path, { hasEncryptedProfiles: true })).toEqual(key); });

it('rejects malformed save input with safe errors and skips keys for disabled profiles',async()=>{for(const bad of [null,{}, {name:12}, {...input,apiKey:123}])await expect(store.save(bad as any)).rejects.toMatchObject({status:400,code:'AI_INVALID_PROFILE'});const p=await store.save(input);const inaccessible=new AIProfileStore(db,()=>{throw new Error('missing key');});expect(await inaccessible.getEnabled(p.id)).toBeNull();});

it('fences stale edits from a second Prisma client sharing the same database',async()=>{const p=await store.save(input);const peer=new PrismaClient({datasources:{db:{url:'file:'+join(dir,'test.db').replaceAll('\\','/')}}});try{const peerStore=new AIProfileStore(peer,()=>randomBytes(32));const old=(await peerStore.list()).profiles[0];await store.save({...input,name:'New',revision:p.revision},p.id);await expect(peerStore.save({...input,name:'Stale',revision:old.revision},p.id)).rejects.toMatchObject({status:409});expect((await store.list()).profiles[0].name).toBe('New');}finally{await peer.$disconnect();}});

it('rejects a changed encryption key before creating mixed-key ciphertext', async () => {
  const keyPath = join(dir, 'managed.key');
  const managed = createManagedAIStore(db, keyPath);
  await managed.save(input);
  await writeFile(keyPath, randomBytes(32));
  await expect(managed.save({ ...input, name: 'Wrong key' })).rejects.toMatchObject({ status: 503 });
  expect(await db.aIProfile.count()).toBe(1);
});
it('rejects a stale target revision when selecting a non-default profile', async () => {
  const p = await store.save(input);
  await store.recordTest(p.id, p.revision, 'quick', 'passed', { durationMs: 1 });
  const enabled = await store.setEnabled(p.id, p.revision, true);
  const list = await store.list();
  await expect(store.setDefault(p.id, list.settingsRevision, enabled.revision - 1)).rejects.toMatchObject({ status: 409 });
  await store.setDefault(p.id, list.settingsRevision, enabled.revision);
  expect((await store.list()).defaultProfileId).toBe(p.id);
});

it('persists safe billing diagnostics and rejects mismatched Xiaomi credentials before saving',async()=>{
 const p=await store.save(input);
 await store.recordTest(p.id,p.revision,'quick','failed',{durationMs:995,code:'LLM_BILLING',upstreamStatus:402});
 const test=(await store.list()).profiles[0].lastTests.quick!;
 expect(test).toMatchObject({code:'LLM_BILLING',upstreamStatus:402,durationMs:995});
 expect(test.message).toContain('bakiye');
 await expect(store.save({...input,provider:'xiaomi_mimo',baseURL:'https://api.xiaomimimo.com/v1',apiKey:'tp-synthetic'})).rejects.toMatchObject({code:'AI_CREDENTIAL_ENDPOINT_MISMATCH'});
 expect(await db.aIProfile.count()).toBe(1);
});
