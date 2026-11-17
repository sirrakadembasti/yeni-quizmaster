-- Büyük harf içeren e-postaları küçült. Aynı adresin iki yazımı varsa (çakışma)
-- ilgili satırlar elle çözülmek üzere olduğu gibi bırakılır.
UPDATE "User" SET "email" = lower("email")
WHERE "email" <> lower("email")
  AND NOT EXISTS (SELECT 1 FROM "User" u2 WHERE u2."email" = lower("User"."email"));
