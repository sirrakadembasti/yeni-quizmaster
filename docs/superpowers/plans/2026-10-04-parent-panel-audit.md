# Veli paneli denetim planı

**Amaç:** Ürün kodunu değiştirmeden veli sayfalarını ve ortak hesap sekmelerini gerçek Chromium/API/izole SQLite ile denetlemek.

**Mimari:** Önceki öğrenci denetiminin sahipli süreç temizliği ve runtime doğrulama korumaları ayrı veli fixture'ına uyarlanır. Başarılı API istekleri gerçek sunucuya gider; kontrollü hata testleri açıkça belirtilir.

**Teknoloji:** React/Wouter/TanStack Query, Express/Prisma/SQLite, Playwright.

- [x] Sayfa/sekme ve role göre API kapsamını listele.
- [x] İki bağlı çocuk, bağımsız çocuk, bağsız veli, sonuç ve duyuru/bildirim verileri oluştur; gerçek DB hash'ini koru.
- [x] Dashboard, sonuç liste/detay, öğrenci değiştirme, doğrudan URL/reload, mobil/klavye kontrolleri.
- [x] Duyuru ve ayarlar profil/bildirim/geçmiş/güvenlik sekmelerini gerçek veriyle sına.
- [x] Bağ sınırları, rol, oturum iptali, salt okunur sınır ve kontrollü API hata durumlarını sına.
- [x] Doğrulanmış hata, UX ve özellik önerilerini kanıt/öncelik/kabul kriteriyle ayır; çalıştırılmamış davranışı işaretle.
- [x] Süreç/port temizliği ve gerçek DB hash'i; belgeleri ve Graphify güncelle, yalnız audit dosyalarını commit et.

Korunan kullanıcı değişiklikleri: client/src/lib/api.ts ve client/src/pages/server-setup.tsx. Gerçek kullanıcı verilerine yazılmaz. Diğer paneller bu denetimin kapsamı dışındadır.
