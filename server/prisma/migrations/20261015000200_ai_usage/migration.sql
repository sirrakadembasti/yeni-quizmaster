CREATE TABLE "AIUsage" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "teacherId" TEXT NOT NULL, "teacherName" TEXT NOT NULL, "teacherEmail" TEXT NOT NULL,
 "categoryId" TEXT, "courseName" TEXT NOT NULL, "draftId" TEXT, "quizId" TEXT,
 "quizTitle" TEXT NOT NULL, "contentType" TEXT NOT NULL,
 "profileId" TEXT NOT NULL, "profileName" TEXT NOT NULL, "provider" TEXT NOT NULL, "model" TEXT NOT NULL,
 "profileRevision" INTEGER NOT NULL, "thinking" TEXT NOT NULL,
 "maxOutputTokens" INTEGER NOT NULL, "timeoutMs" INTEGER NOT NULL, "questionCount" INTEGER NOT NULL,
 "validQuestionCount" INTEGER, "status" TEXT NOT NULL DEFAULT 'pending', "errorCode" TEXT,
 "inputTokens" INTEGER, "outputTokens" INTEGER, "reasoningTokens" INTEGER,
 "cacheReadTokens" INTEGER, "cacheWriteTokens" INTEGER, "totalTokens" INTEGER, "durationMs" INTEGER
);
CREATE INDEX "AIUsage_createdAt_id_idx" ON "AIUsage"("createdAt","id");
CREATE INDEX "AIUsage_teacherId_createdAt_idx" ON "AIUsage"("teacherId","createdAt");
CREATE INDEX "AIUsage_categoryId_createdAt_idx" ON "AIUsage"("categoryId","createdAt");
CREATE INDEX "AIUsage_draftId_teacherId_idx" ON "AIUsage"("draftId","teacherId");
CREATE INDEX "AIUsage_model_thinking_questionCount_status_idx" ON "AIUsage"("model","thinking","questionCount","status");
