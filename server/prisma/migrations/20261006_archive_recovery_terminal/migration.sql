-- Cancellation releases only an empty, failed manual scope. Frozen records and published packages remain protected.
CREATE TRIGGER archive_cancelled_snapshot_insert BEFORE INSERT ON ArchiveSnapshot
WHEN NEW.status = 'cancelled'
BEGIN SELECT RAISE(ABORT, 'ARCHIVE_CANCEL_NOT_ALLOWED'); END;

CREATE TRIGGER archive_cancelled_snapshot_transition BEFORE UPDATE ON ArchiveSnapshot
WHEN NEW.status = 'cancelled' AND (
  OLD.status <> 'failed' OR OLD.mode <> 'manual' OR NEW.mode <> 'manual'
  OR OLD.capturedAt IS NOT NULL OR NEW.capturedAt IS NOT NULL
  OR OLD.artifactPath IS NOT NULL OR NEW.artifactPath IS NOT NULL
  OR OLD.zipSha256 IS NOT NULL OR NEW.zipSha256 IS NOT NULL
  OR OLD.sizeBytes IS NOT NULL OR NEW.sizeBytes IS NOT NULL
  OR NEW.leaseOwner IS NOT NULL OR NEW.leaseExpiresAt IS NOT NULL
  OR (OLD.leaseExpiresAt IS NOT NULL AND OLD.leaseExpiresAt > CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER))
  OR EXISTS (SELECT 1 FROM ArchiveSnapshotRow WHERE snapshotId IN (OLD.id, NEW.id))
)
BEGIN SELECT RAISE(ABORT, 'ARCHIVE_CANCEL_NOT_ALLOWED'); END;

CREATE TRIGGER archive_cancelled_snapshot_update BEFORE UPDATE ON ArchiveSnapshot
WHEN OLD.status = 'cancelled'
BEGIN SELECT RAISE(ABORT, 'ARCHIVE_READ_ONLY'); END;

CREATE TRIGGER archive_cancelled_snapshot_delete BEFORE DELETE ON ArchiveSnapshot
WHEN OLD.status = 'cancelled'
BEGIN SELECT RAISE(ABORT, 'ARCHIVE_READ_ONLY'); END;
