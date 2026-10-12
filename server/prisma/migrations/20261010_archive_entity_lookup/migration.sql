-- Entity-leading lookups support the existing exact finalization/freeze guards.
-- Guard bodies and immutable source data are unchanged.
CREATE INDEX "ArchiveSnapshotRow_entityType_entityId_snapshotId_idx" ON "ArchiveSnapshotRow"("entityType","entityId","snapshotId");
