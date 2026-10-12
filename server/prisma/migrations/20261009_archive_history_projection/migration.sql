-- Auxiliary cache only. Existing immutable archive rows and business fences remain intact.
CREATE TABLE "ArchiveHistoryProjection" (
 "sourceRowId" TEXT NOT NULL,
 "version" TEXT NOT NULL,
 "snapshotId" TEXT NOT NULL,
 "sourceJson" TEXT NOT NULL,
 "searchText" TEXT NOT NULL,
 PRIMARY KEY ("sourceRowId","version"),
 FOREIGN KEY ("sourceRowId") REFERENCES "ArchiveSnapshotRow"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
 FOREIGN KEY ("snapshotId") REFERENCES "ArchiveSnapshot"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX "ArchiveHistoryProjection_snapshotId_version_idx" ON "ArchiveHistoryProjection"("snapshotId","version");
CREATE TABLE "ArchiveHistoryReady" (
 "snapshotId" TEXT NOT NULL,
 "version" TEXT NOT NULL,
 "rowCount" INTEGER NOT NULL,
 "inputSha256" TEXT NOT NULL,
 PRIMARY KEY ("snapshotId","version"),
 FOREIGN KEY ("snapshotId") REFERENCES "ArchiveSnapshot"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE TRIGGER archive_history_projection_source BEFORE INSERT ON "ArchiveHistoryProjection"
WHEN NOT EXISTS (SELECT 1 FROM "ArchiveSnapshotRow" r WHERE r.id=NEW.sourceRowId AND r.snapshotId=NEW.snapshotId AND r.dataJson=NEW.sourceJson COLLATE BINARY)
 OR length(NEW.version)<1 OR length(NEW.version)>200
BEGIN SELECT RAISE(ABORT,'ARCHIVE_HISTORY_SOURCE_MISMATCH'); END;
CREATE TRIGGER archive_history_projection_update BEFORE UPDATE ON "ArchiveHistoryProjection"
BEGIN SELECT RAISE(ABORT,'ARCHIVE_HISTORY_PROJECTION_READ_ONLY'); END;
CREATE TRIGGER archive_history_projection_delete BEFORE DELETE ON "ArchiveHistoryProjection"
BEGIN SELECT RAISE(ABORT,'ARCHIVE_HISTORY_PROJECTION_READ_ONLY'); END;
CREATE TRIGGER archive_history_ready_complete BEFORE INSERT ON "ArchiveHistoryReady"
WHEN NOT EXISTS (SELECT 1 FROM "ArchiveSnapshot" s WHERE s.id=NEW.snapshotId AND s.capturedAt IS NOT NULL)
 OR NEW.rowCount<0
 OR length(NEW.version)<1 OR length(NEW.version)>200
 OR length(NEW.inputSha256)!=64 OR NEW.inputSha256 GLOB '*[^0-9a-f]*'
 OR NEW.rowCount!=(SELECT count(*) FROM "ArchiveSnapshotRow" WHERE snapshotId=NEW.snapshotId)
 OR NEW.rowCount!=(SELECT count(*) FROM "ArchiveHistoryProjection" WHERE snapshotId=NEW.snapshotId AND version=NEW.version)
 OR EXISTS (SELECT 1 FROM "ArchiveHistoryProjection" p JOIN "ArchiveSnapshotRow" r ON r.id=p.sourceRowId WHERE p.snapshotId=NEW.snapshotId AND p.version=NEW.version AND (r.snapshotId!=p.snapshotId OR r.dataJson!=p.sourceJson COLLATE BINARY))
BEGIN SELECT RAISE(ABORT,'ARCHIVE_HISTORY_PROJECTION_INCOMPLETE'); END;
CREATE TRIGGER archive_history_ready_update BEFORE UPDATE ON "ArchiveHistoryReady"
BEGIN SELECT RAISE(ABORT,'ARCHIVE_HISTORY_PROJECTION_READ_ONLY'); END;
CREATE TRIGGER archive_history_ready_delete BEFORE DELETE ON "ArchiveHistoryReady"
BEGIN SELECT RAISE(ABORT,'ARCHIVE_HISTORY_PROJECTION_READ_ONLY'); END;
