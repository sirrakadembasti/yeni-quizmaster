-- Additive optimistic concurrency token; existing notification choices are retained.
ALTER TABLE "User" ADD COLUMN "notificationRevision" INTEGER NOT NULL DEFAULT 0;
