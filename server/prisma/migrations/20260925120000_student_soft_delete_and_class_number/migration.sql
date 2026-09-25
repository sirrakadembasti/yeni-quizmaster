-- Öğrenci kayıtlarını geçmiş sınav ve sınıf ilişkilerini bozmadan pasife almak için durum alanları.
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "deactivatedAt" DATETIME;

-- Eski serbest metin sınıf numarasını kaldır ve mevcut öğrencileri sınıf içinde
-- oluşturulma sırasına göre deterministik olarak yeniden numaralandır.
UPDATE "User"
SET "classNo" = NULL
WHERE "role" = 'student';

UPDATE "User"
SET "studentNo" = (
  SELECT COUNT(*)
  FROM "User" AS "ordered"
  WHERE "ordered"."role" = 'student'
    AND "ordered"."classId" = "User"."classId"
    AND (
      "ordered"."createdAt" < "User"."createdAt"
      OR ("ordered"."createdAt" = "User"."createdAt" AND "ordered"."id" <= "User"."id")
    )
)
WHERE "role" = 'student' AND "classId" IS NOT NULL;

UPDATE "User"
SET "studentNo" = NULL
WHERE "role" = 'student' AND "classId" IS NULL;

CREATE UNIQUE INDEX "User_classId_studentNo_key" ON "User"("classId", "studentNo");
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");
CREATE INDEX "User_classId_isActive_idx" ON "User"("classId", "isActive");
