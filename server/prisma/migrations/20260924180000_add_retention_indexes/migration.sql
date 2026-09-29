-- CreateIndex
CREATE INDEX "ActionLog_createdAt_idx" ON "ActionLog"("createdAt");

-- CreateIndex
CREATE INDEX "ActionLog_userId_createdAt_idx" ON "ActionLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_isRead_createdAt_idx" ON "Notification"("isRead", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailQueue_status_createdAt_idx" ON "EmailQueue"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PasswordResetRequest_status_updatedAt_idx" ON "PasswordResetRequest"("status", "updatedAt");
