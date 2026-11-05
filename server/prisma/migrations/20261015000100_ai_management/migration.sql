CREATE TABLE "AIProfile" (
 "id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "provider" TEXT NOT NULL, "model" TEXT NOT NULL,
 "baseURL" TEXT NOT NULL, "encryptedApiKey" TEXT NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT false,
 "revision" INTEGER NOT NULL DEFAULT 1, "timeoutMs" INTEGER NOT NULL DEFAULT 120000,
 "maxOutputTokens" INTEGER NOT NULL DEFAULT 8192, "thinking" TEXT NOT NULL DEFAULT 'auto',
 "lastTestsJson" TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE "AIConfiguration" ("id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton', "defaultProfileId" TEXT, "revision" INTEGER NOT NULL DEFAULT 0);
INSERT INTO "AIConfiguration" ("id") VALUES ('singleton');
