# Kapasite onarımı ve 80 öğrencilik okul sınavı

Kullanıcı 14 Ekim'de HDD dışındaki nedenlerin uygulama yapısı/işleyişi korunarak düzeltilmesini, ardından dört sınıf/80 öğrenci/20 soru/30 dakika tarih sınavının değerlendirilmesini istedi. Önceki iki kapasite incelemesindeki dar değişikliklerin uygulanması yetkilendirildi. Canlı DB ve mevcut kullanıcı değişiklikleri korunur.

## Tasarım

SQLite/Prisma/veri modeli ve rol bazlı uygulama korunur. Durability FULL kalır. Önce düzeltme içeren SQLite driver/runtime sürümleri seçilir; Prisma ve oturum erişimi açık startup politikasıyla WAL ve kontrollü bağlantı davranışı kullanır. Eski native timestamp biçimi korunur. Schema-engine yükseltme/bakım yolu, yedek/restore, archive trigger/projection sözleşmeleri birlikte sınanır. Bağımlılıklar değişirken canlı install/migration/start yapılmaz.

Bildirim tercihlerine additive notificationRevision alanı ve CAS ataması eklenir. Eski {muted} JSON sözleşmesi korunur; yeni arayüz ETag/If-Match ile sürüm taşır. Başarısız/yanıtı kaybolan isteğin sonucu dayanıklı state okunarak uzlaştırılır; eski sürümlü istek yeni tercihi ezemez. İptal sonrası commit'in fiziksel olarak imkânsız olduğu iddia edilmez.

Dashboard sayıları uygun aktif/role/year ve null/zero score koşullarıyla count/aggregate üzerinden hesaplanır; rol çıktıları değişmez. Sonuç listesi için backend sınırlı sayfa ve bütün filtrelenmiş kümenin istatistiği sağlanır; Excel/yazdırma bütün filtrelenmiş kapsamı alır. Kullanıcının api.ts değişmez; yeni istemci helper üzerinden mevcut apiFetch kullanılır. Yetkili öğretmen kapsamı ve geçmiş yıl route adapter'ı korunur.

Süreli sınavda server authoritative başlangıç/süre kontrolü, answer/submit atomikliği, tekrar submit idempotency ve offline yasağı korunur. Kullanıcı istek zamanını değiştiremez. 80 öğrencinin toplu başlangıcı, 20 cevap dalgası, hızlı cevap değişimi, tümü aynı anda teslim ve sonuç sorguları gerçek sentetik HTTP+DB ile sınanır. 30 dakika sınırının öncesi/sonrası kontrollü server clock/owned fixture ile ayrı doğrulanır; süre sıkıştırılarak yapılan stress test gerçek 30 dakikalık soak diye raporlanmaz. Ağ cihazı/Wi-Fi kanıtı sunucu-local ölçümden çıkarılmaz.

## Kabul ve sınırlar

Önce RED/GREEN unit/DB regressions, ardından typecheck/build, gerçek API/auth ve gereken Chromium akışları. Her değişiklikte tüm rol/yıl/süre/puan/export doğruluğu incelenir. Kullanıcı dosyaları client/src/lib/api.ts, client/src/pages/server-setup.tsx ve server/data/quiz.db SHA'ları korunur. Diğer mevcut doc değişiklikleri/silmeleri korunur. Ağ/email dış bağlantısı testlerde kapalı, fixture/port/süreçler ayrı ve sahipliği kanıtlıdır. Test başarısızlığı kapasite başarısı olarak sunulmaz; gerçek yerel ağ özellikleri bilinmiyorsa belirtilir.
