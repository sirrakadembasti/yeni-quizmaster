CREATE TABLE "GuardianStudent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guardianId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "relation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuardianStudent_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GuardianStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "GuardianStudent_guardianId_studentId_key" ON "GuardianStudent"("guardianId", "studentId");
CREATE INDEX "GuardianStudent_guardianId_idx" ON "GuardianStudent"("guardianId");
CREATE INDEX "GuardianStudent_studentId_idx" ON "GuardianStudent"("studentId");
