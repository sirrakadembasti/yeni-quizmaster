-- Persist an annual outcome independently of the optional audit actor.
ALTER TABLE ArchiveSnapshot ADD COLUMN transitionSummaryJson TEXT;

CREATE TRIGGER archive_transition_summary_insert BEFORE INSERT ON ArchiveSnapshot
WHEN NEW.transitionSummaryJson IS NOT NULL
BEGIN SELECT RAISE(ABORT,'ARCHIVE_TRANSITION_SUMMARY_READ_ONLY'); END;

-- Extend the exact private completion capability; every previous field remains
-- checked. Historical migrations are left intact.
DROP TRIGGER archive_captured_snapshot_complete;
CREATE TRIGGER archive_captured_snapshot_complete BEFORE UPDATE ON ArchiveSnapshot
WHEN OLD.capturedAt IS NOT NULL AND NEW.status='completed' AND NOT(
  NEW.completedAt IS NOT NULL AND NEW.leaseOwner IS NULL AND NEW.leaseExpiresAt IS NULL
  AND (NEW.mode<>'annual' OR NEW.transitionSummaryJson IS NOT NULL)
  AND EXISTS(
    SELECT 1 FROM ArchiveFinalizationPermit p
    JOIN ArchiveSnapshot s ON s.id=p.snapshotId JOIN AcademicYear y ON y.id=s.academicYearId
    WHERE p.entityType='snapshot' AND p.entityId=OLD.id AND p.owner=s.leaseOwner
    AND s.status='verified' AND s.capturedAt IS NOT NULL AND s.artifactPath IS NOT NULL
    AND length(s.zipSha256)=64 AND s.sizeBytes>0
    AND s.leaseExpiresAt>CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
    AND (y.status='active' OR (s.mode='annual' AND y.status='closed' AND y.snapshotId=s.id))
    AND p.oldValues=json_object('status',OLD.status,'completedAt',OLD.completedAt,'leaseOwner',OLD.leaseOwner,'leaseExpiresAt',OLD.leaseExpiresAt,'lastError',OLD.lastError,'nextAttemptAt',OLD.nextAttemptAt,'transitionSummaryJson',OLD.transitionSummaryJson)
    AND p.newValues=json_object('status',NEW.status,'completedAt',NEW.completedAt,'leaseOwner',NEW.leaseOwner,'leaseExpiresAt',NEW.leaseExpiresAt,'lastError',NEW.lastError,'nextAttemptAt',NEW.nextAttemptAt,'transitionSummaryJson',NEW.transitionSummaryJson)
  )
  AND NEW.id IS OLD.id AND NEW.academicYearId IS OLD.academicYearId AND NEW.label IS OLD.label
  AND NEW.mode IS OLD.mode AND NEW.annualKey IS OLD.annualKey AND NEW.initiatedBy IS OLD.initiatedBy
  AND NEW.scopeJson IS OLD.scopeJson AND NEW.attempts IS OLD.attempts AND NEW.artifactPath IS OLD.artifactPath
  AND NEW.zipSha256 IS OLD.zipSha256 AND NEW.sizeBytes IS OLD.sizeBytes
  AND NEW.createdAt IS OLD.createdAt AND NEW.capturedAt IS OLD.capturedAt
)
BEGIN SELECT RAISE(ABORT,'ARCHIVE_READ_ONLY'); END;

CREATE TRIGGER archive_transition_summary_update BEFORE UPDATE ON ArchiveSnapshot
WHEN NEW.transitionSummaryJson IS NOT OLD.transitionSummaryJson AND NOT(
  OLD.transitionSummaryJson IS NULL AND OLD.mode='annual' AND OLD.status='verified'
  AND NEW.status='completed' AND json_valid(NEW.transitionSummaryJson)=1
  AND EXISTS(
    SELECT 1 FROM ArchiveFinalizationPermit p JOIN ArchiveSnapshot s ON s.id=p.snapshotId
    JOIN AcademicYear y ON y.id=s.academicYearId
    WHERE p.entityType='snapshot' AND p.entityId=OLD.id AND p.snapshotId=OLD.id
    AND p.owner=s.leaseOwner AND s.status='verified' AND s.capturedAt IS NOT NULL
    AND s.artifactPath IS NOT NULL AND length(s.zipSha256)=64 AND s.sizeBytes>0
    AND s.leaseExpiresAt>CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
    AND y.status='closed' AND y.snapshotId=s.id
    AND p.oldValues=json_object('status',OLD.status,'completedAt',OLD.completedAt,'leaseOwner',OLD.leaseOwner,'leaseExpiresAt',OLD.leaseExpiresAt,'lastError',OLD.lastError,'nextAttemptAt',OLD.nextAttemptAt,'transitionSummaryJson',OLD.transitionSummaryJson)
    AND p.newValues=json_object('status',NEW.status,'completedAt',NEW.completedAt,'leaseOwner',NEW.leaseOwner,'leaseExpiresAt',NEW.leaseExpiresAt,'lastError',NEW.lastError,'nextAttemptAt',NEW.nextAttemptAt,'transitionSummaryJson',NEW.transitionSummaryJson)
  )
)
BEGIN SELECT RAISE(ABORT,'ARCHIVE_TRANSITION_SUMMARY_READ_ONLY'); END;
