# AI yönetimi uyarlama kabulü — 15 Ekim 2026

> Güncel sürüm: [16 Ekim sekmeler, öğretmen kullanım takibi ve 25 migration sonucu](2026-10-15-ai-usage-results.md). Aşağıdaki sayılar ilk AI uyarlamasının tarihsel kabulüdür.

> Sonraki kullanıcı onayıyla ayrı Prisma CLI yükseltme provası tamamlandı ve mevcut yerel DB 14 → 24 migration'a yükseltildi. Uygulama başlatıldı. Aşağıdaki geliştirme aşamasının canlı DB/CLI sınırları tarihsel kayıttır; [devreye alma sonucu](2026-10-15-ai-management-deployment.md) güncel durumu açıklar.

Admin `/ai-management` sayfası ve rol korumalı yönetim API'si eklendi. Sağlayıcı, model, adres, şifreli API anahtarı, süre/token sınırı, testler, çoklu kullanıma açma, varsayılan, silme ve mevcut Gemini ayarını açıkça aktarma desteklenir. Öğretmen sınav/anket üretiminde yalnız admin'in açtığı modeli seçer. Eski özel URL/anahtar/model override isteği backend'de reddedilir. Soru biçimi, cevap eşleştirme, karıştırma, adet denetimi ve öğretmenin soruları düzenleyip eklemesi korunur.

Kaynak paket `F:/projeler/llm-yonetimi` salt okunur incelendi; bağımsız testleri 5/5 geçti. Sağlayıcı katalog/protokol kodu QuizMaster servislerine uyarlandı; dış klasör bağımlılığı veya ayrı Basic auth sunucusu eklenmedi.

## Gerçek kontroller

| Kontrol | Sonuç |
|---|---|
| AI API ve soru biçimi | 27/27 |
| Profil/şifreleme/üç sağlayıcı protokolü ve native DB | 18/18 |
| Admin ve öğretmen UI | 7/7 |
| Mevcut admin envanteri, arşiv ve akademik oturum UI regresyonları | 37/37 |
| Akademik bağlam | 18/18 |
| Yıllık capture koruması | 16/16 |
| Anahtar yedeği, geri yükleme ve mevcut bakım regresyonları | 6/6 |
| Sunucu ve istemci TypeScript | Geçti |
| Standart sunucu + istemci üretim build | Geçti; mevcut büyük JS chunk/dinamik import uyarıları sürüyor |
| Gerçek Chromium üretim UI | Geçti; sentetik API, sayfa hatası 0 |
| Git diff whitespace | Geçti |

Chromium koşusunda admin profil oluşturma, kısa test ve öğretmene açma; kapalı eğitim yılı bağlamında yönetim sayfasına erişim; mobil yatay taşma ve öğretmenin modelle soru üretip oluşturucuya aktarması doğrulandı. API cevapları tarayıcı sınırında taklit edildi; backend kabulü ayrı Express/Prisma testleridir. Tam canlı sunucu + gerçek sağlayıcı E2E kabulü değildir. Kanıt: `server/data/quizmaster-test-ai-browser-alr2oe/`; bu özel dizin Git'e dahil edilmez. Yardımcı script `scripts/ai-management-browser-proof.mjs`.

Native kabul boş sentetik DB'ye tüm migration **SQL** dosyalarını uyguladı; runtime'ın yamalı SQLite bağlantısı ile profil kaydı, test, etkinleştirme, varsayılan seçimi ve bağlantı yeniden açılınca çözme doğrulandı. Integrity `ok`, FK ihlali 0. Fixture hazırlığında yalnız boş geçici DB için MEMORY/OFF kullanıldı; gerçek runtime yeniden açılırken WAL/FULL ayarını uygular. İlk migrate CLI denemesi hata/zaman aşımı verdi; CLI `migrate deploy` yükseltme provası bu testten geçmiş sayılmaz. Önceki timeout/sandbox başarısızlıkları başarılı kabul sayısına dahil değildir.

## Güvenlik incelemesi ve sınırlar

İncelemede bulunan yanlış anahtarla karma şifreli profil oluşturma, uyumsuz anahtarlı yedek/restore ve stale varsayılan profil seçimi düzeltildi. Regresyonlar yanlış geçerli uzunluktaki anahtarla yeni kayıt reddini, eksik/yanlış anahtarla backup ve yeniden hash'lenmiş manifestle restore reddini ve hem yapılandırma hem hedef profil revizyon denetimini doğrular. Sağlayıcı URL/başlık/gövde sözleşmeleri üç protokol için sınandı. Gerçek host session/CSRF middleware'iyle yazma koruması sınandı. Ek inceleme sonrası düzeltmeler ana ajan tarafından test edilip kontrol edildi; ikinci bağımsız inceleme çalışması kullanım sınırı nedeniyle tamamlanmadı.

Gerçek API anahtarı veya ücretli sağlayıcı çağrısı kullanılmadı. Sağlayıcının model erişimi, kotaları ve içerik kalitesi kurulumdaki admin testiyle ayrıca doğrulanmalıdır. AI sayfası eğitim yılından bağımsız kurulum ayarıdır; diğer tarihsel iş verilerinin yazma engeli korunur.

Canlı `server/data/quiz.db` sorgulanmadı, kopyalanmadı, migrate edilmedi veya sunucuya bağlanmadı. SHA-256 başlangıçla aynı: `8210A4B79F2CFB9CF74DE6A4989F5C8A5449BA1D17B2332ABDBD018C3741A158`. Kullanıcının `client/src/lib/api.ts` ve `client/src/pages/server-setup.tsx` içerikleri de başlangıç hash'leriyle aynı kaldı. Ürün çalışması commit/push veya canlı devreye alma yapılmadan çalışma ağacında bırakıldı.

Yeni sürümü kullanmadan önce süreçleri durdurup doğrulanmış yedek alın, ayrı kurulumda `20261015000100_ai_management` migration'ı ve üretim yükseltmesini prova edin. Profil DB'siyle `server/data/ai-encryption.key` birlikte korunmalıdır. [İşletim ve kullanım](ai-management.md).
