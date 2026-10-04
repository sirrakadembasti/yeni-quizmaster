import { PrismaClient } from '@prisma/client';

// Shared by the archive worker and request guards; no alternative database URL.
export const archiveDb = new PrismaClient();
export const closeArchiveDb = () => archiveDb.$disconnect();
