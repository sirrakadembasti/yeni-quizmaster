-- Prisma şemasında tanımlı olup migration geçmişinde yer almayan alanlar.
-- SQLite'ta ADD COLUMN ile veri kaybı yaşanmadan eklenir.

-- User: veli iletişim alanları ve e-posta doğrulama altyapısı
ALTER TABLE "User" ADD COLUMN "parentName" TEXT;
ALTER TABLE "User" ADD COLUMN "parentRelation" TEXT;
ALTER TABLE "User" ADD COLUMN "parentPhone" TEXT;
ALTER TABLE "User" ADD COLUMN "parentEmail" TEXT;
ALTER TABLE "User" ADD COLUMN "parentAddress" TEXT;
ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "emailVerificationToken" TEXT;

-- Quiz: yayın ve akademik dönem alanları
ALTER TABLE "Quiz" ADD COLUMN "academicYear" TEXT;
ALTER TABLE "Quiz" ADD COLUMN "audienceSize" INTEGER;
ALTER TABLE "Quiz" ADD COLUMN "publishedAt" DATETIME;

-- StudentResult: akademik dönem
ALTER TABLE "StudentResult" ADD COLUMN "academicYear" TEXT;

-- Question: soru ayarları
ALTER TABLE "Question" ADD COLUMN "config" TEXT;

-- CreateIndex
CREATE INDEX "Quiz_status_createdAt_idx" ON "Quiz"("status", "createdAt");
