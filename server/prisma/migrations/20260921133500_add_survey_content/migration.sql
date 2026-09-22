-- Add survey content without changing existing exam records.
ALTER TABLE "Quiz" ADD COLUMN "contentType" TEXT NOT NULL DEFAULT 'exam';

CREATE TABLE "SurveySubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "surveyId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SurveySubmission_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Quiz" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SurveySubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SurveyAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submissionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SurveyAnswer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "SurveySubmission" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SurveyAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SurveySubmission_surveyId_studentId_key" ON "SurveySubmission"("surveyId", "studentId");
CREATE INDEX "SurveySubmission_surveyId_submittedAt_idx" ON "SurveySubmission"("surveyId", "submittedAt");
CREATE INDEX "SurveySubmission_studentId_idx" ON "SurveySubmission"("studentId");
CREATE UNIQUE INDEX "SurveyAnswer_submissionId_questionId_key" ON "SurveyAnswer"("submissionId", "questionId");
CREATE INDEX "SurveyAnswer_questionId_idx" ON "SurveyAnswer"("questionId");
CREATE INDEX "Quiz_contentType_status_createdAt_idx" ON "Quiz"("contentType", "status", "createdAt");