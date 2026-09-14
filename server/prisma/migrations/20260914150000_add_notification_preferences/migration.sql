-- Kullanıcı bazında bildirim sessize alma tercihi.
ALTER TABLE "User" ADD COLUMN "notificationMuted" BOOLEAN NOT NULL DEFAULT false;
