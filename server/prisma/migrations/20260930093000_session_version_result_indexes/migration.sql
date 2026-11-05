ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "StudentResult_studentId_quizId_idx" ON "StudentResult"("studentId", "quizId");
CREATE INDEX "StudentResult_quizId_status_idx" ON "StudentResult"("quizId", "status");
ALTER TABLE "EmailQueue" ADD COLUMN "processingUntil" DATETIME;
