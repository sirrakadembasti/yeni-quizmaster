# Güvenlik ve veri bütünlüğü düzeltme planı

> **Tarihsel plan/tasarım kaydı.** 14 Ekim 2026 belge kontrolü: gelecek zaman, açık kutular ve ara sonuçlar özgün çalışma sırasını korur; güncel yapılacaklar olarak okunmamalıdır. [Sonuç ve kapsam kaydı](../../guvenlik-ve-bakim.md) esas alınır.

Amaç: React/Express/Prisma/SQLite mimarisini koruyarak doğrulanan bulguları düzeltmek.

- [x] İzole test veritabanı ve regresyon testleri
- [x] Rol ilişkileri, veli/öğretmen yetkileri, sonuç gizliliği, profil/parola kuralları
- [x] Soru geçmişi, atomik sınav işlemleri ve sınıf yükseltme
- [x] Oturum/Socket.IO, SSRF ve okul NAT hız sınırları
- [x] Çevrimdışı akış, görseller ve soru karıştırma
- [x] Bağımlılık yamaları, tam test/tip/derleme kontrolleri
- [x] README/docs; Graphify CLI üretimi (son tutarlılık kontrolü commit öncesi)
- [x] Bağımsız fark incelemesi; yalnız bu çalışmayı commit için hazırlama

Testler canlı veritabanına erişmez. Yerel migration testlerden sonra SQLite yedeği alınarak uygulanır. Önceden mevcut iki yerel kurulum değişikliği korunur ve commit dışında tutulur. MFA/e-posta doğrulaması ve PostgreSQL geçişi yeni ürün akışlarıdır; bu bakım kapsamında eklenmez.
