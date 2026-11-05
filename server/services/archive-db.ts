import { createRuntimePrismaClient } from '../utils/sqlite-runtime';

// Shared by the archive worker and request guards; no alternative database URL.
export const archiveDb = createRuntimePrismaClient();
export const closeArchiveDb = () => archiveDb.$disconnect();
