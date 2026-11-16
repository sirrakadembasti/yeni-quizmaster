// Prova betiklerinin kendi (harness tarafındaki) Prisma istemcisi.
// Prisma 7 `datasources` seçeneğini ve bağdaştırıcısız oluşturmayı kaldırdı: istemci her zaman bir sürücü
// bağdaştırıcısıyla açılır. Uygulamanın kendi istemcisi server/utils/sqlite-runtime.ts içindedir; bu yardımcı,
// betiklerin doğrulama/tohumlama için açtığı yalın istemciler içindir (uygulama kodu bunlarla değiştirilmez).
export function createScriptPrismaClient(requireFromServer, databaseUrl, options = {}) {
  if (typeof databaseUrl !== 'string' || !databaseUrl.startsWith('file:')) {
    throw new Error('Prova istemcisi mutlak bir SQLite file: adresi ister');
  }
  const { PrismaClient } = requireFromServer('@prisma/client');
  const { PrismaBetterSqlite3 } = requireFromServer('@prisma/adapter-better-sqlite3');
  const adapter = new PrismaBetterSqlite3({ url: databaseUrl, fileMustExist: true }, { timestampFormat: 'unixepoch-ms' });
  return new PrismaClient({ adapter, ...options });
}

// `prisma migrate deploy` yalıtılmış kökte çalışır ve orada prisma.config.ts yoktur. Prisma 7 bağlantı adresini
// yapılandırmadan okur: depodaki yapılandırma verilir, şema ve migration'lar ise --schema ile yalıtılmış kökten gelir.
export function prismaConfigArgs(repo, path) {
  return ['--config', path.join(repo, 'server', 'prisma.config.ts')];
}
