-- Additive migration: existing people, content and results retain their identities.
ALTER TABLE "User" ADD COLUMN "graduationYear" TEXT;
ALTER TABLE "User" ADD COLUMN "graduationDate" DATETIME;

CREATE TABLE "AcademicYear" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "opensAt" DATETIME NOT NULL,
    "scheduledCloseAt" DATETIME NOT NULL,
    "closedAt" DATETIME,
    "snapshotId" TEXT
);
CREATE UNIQUE INDEX "AcademicYear_label_key" ON "AcademicYear"("label");
-- Prisma cannot express partial indexes; enforce the singleton for every DB writer.
CREATE UNIQUE INDEX "AcademicYear_single_active_key" ON "AcademicYear"("status") WHERE "status" = 'active';

CREATE TABLE "ArchiveSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "academicYearId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "annualKey" TEXT,
    "initiatedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "scopeJson" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" DATETIME,
    "leaseOwner" TEXT,
    "leaseExpiresAt" DATETIME,
    "lastError" TEXT,
    "artifactPath" TEXT,
    "zipSha256" TEXT,
    "sizeBytes" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "ArchiveSnapshot_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "ArchiveSnapshot_annualKey_key" ON "ArchiveSnapshot"("annualKey");
CREATE INDEX "ArchiveSnapshot_status_nextAttemptAt_idx" ON "ArchiveSnapshot"("status", "nextAttemptAt");
CREATE INDEX "ArchiveSnapshot_academicYearId_createdAt_idx" ON "ArchiveSnapshot"("academicYearId", "createdAt");

CREATE TABLE "ArchiveSnapshotRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshotId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "dataJson" TEXT NOT NULL,
    CONSTRAINT "ArchiveSnapshotRow_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ArchiveSnapshot" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "ArchiveSnapshotRow_snapshotId_entityType_entityId_key" ON "ArchiveSnapshotRow"("snapshotId", "entityType", "entityId");

CREATE TABLE "AcademicTransitionRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "yearId" TEXT NOT NULL,
    "fromClassId" TEXT NOT NULL,
    "toClassId" TEXT,
    "graduate" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "AcademicTransitionRule_yearId_fkey" FOREIGN KEY ("yearId") REFERENCES "AcademicYear" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "AcademicTransitionRule_fromClassId_fkey" FOREIGN KEY ("fromClassId") REFERENCES "Class" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "AcademicTransitionRule_toClassId_fkey" FOREIGN KEY ("toClassId") REFERENCES "Class" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "AcademicTransitionRule_yearId_fromClassId_key" ON "AcademicTransitionRule"("yearId", "fromClassId");
