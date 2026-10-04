# Entegrasyon ve UX düzeltmeleri

Kullanıcının 4 Ekim 2026 tarihli “hataları düzelt” talebi, `docs/integration-audit/verification.md` içindeki çözüm ve kabul kriterlerinin uygulanmasını yetkilendirir.

## Sınırlar

Mevcut roller, API rotaları, hibrit terminal/BAT/SH + web kurulumu ve veritabanı şeması korunur. Yeni özellik önerileri kapsam dışıdır. Gerçek veriler değiştirilmeyecek; testler korumalı, geçici SQLite fixture kullanacak. `client/src/lib/api.ts` ve `client/src/pages/server-setup.tsx` kullanıcının mevcut değişiklikleridir, bu çalışmanın commit'ine alınmaz.

## Kararlar

- AI girdisi sağlayıcı çağrısından önce doğrulanır. Doğru cevap karıştırma öncesi tek bir seçeneğe çözülür; geçersiz/belirsiz yanıt reddedilir. Ayarlar değişince bağlantı hazır durumu iptal edilir.
- Öğrenci kontrollerine kalıcı ad ve seçili/mevcut durum semantiği eklenir. Anket boşlukları geçerli cevap sayılmaz; erişim/bulunamadı/sunucu hataları ayrılır.
- Tamamlanma durumu kullanıcıya özel çevrimdışı önbellekte korunur; yerel devam ile teslim bekleme ayrılır. Önizleme metni gerçek teslimden ayrılır.
- Bildirim yükleme/hata/boş durumları ayrılır, tekrar deneme ve mutasyon hatası geri bildirimi sağlanır.
- Baskıda grafik değerleri ilk karede kararlı olur; tam öğrenci kodu yazılır ve eylem sütunları gizlenir. Başarı göstergeleri mevcut yüzde70 ölçütüyle tutarlı olur; puanlama değişmez.
- Yük sorunu için önce oturum/uygulama işlemleri ve olay döngüsü süreleri ölçülür. Kanıtlanan neden olmadan depolama veya yetki davranışı değiştirilmez.
- Gmail teslimi kullanıcı tarafından gelen kutusunda doğrulandı. Bu insan doğrulaması ayrı kaydedilir; yeni e-posta gönderilmez.

## Kabul

Fail-first regresyonlar, gerçek Chromium kabul akışları, yeni PDF'lerin metin/görsel kontrolü, sınırlı gerçek Gemini testi ve Socket regresyonu çalışır. Yük kabulü aynı altı GET rotasında 2/8/20 eşzamanlı kademelerin tamamında 180/180 HTTP200 ve15s içinde yanıt; üretim kapasitesi garantisi verilmez. Type-check/build, ilgili tam testler, gerçek DB hash'i ve süreç temizliği doğrulanır. Tarihsel başarısız kanıtlar korunur.
