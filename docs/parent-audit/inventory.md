# Veli paneli kapsam ve kontrol listesi

Başlangıç: `b1257eb`. Ürün kodu değiştirilmeden, yalnız veli rolü ve bu role açık ortak sayfalar incelenir. Gerçek veri tabanı hash'i: `8210a4b79f2cfb9cf74de6a4989f5c8a5449ba1d17b2332abdbd018c3741a158`.

## Sayfa ve sekmeler

| Sayfa | Sekme/görünüm | İşlem | Takip edilebilir kontroller |
|---|---|---|---|
| `/`, `/parent/dashboard` | Öğrenci Takibi | Çocuk seçme, öğrenci kimliği/sınıfı, ortalama/tamamlanan/bekleyen, sonuçlar ve atanmış sınavlar | P-N01, P-F01, P-F03, P-E01, P-E02, P-E04, P-A01 |
| `/parent/results` | Tamamlanan Sınavlar | Çocuk seçme, liste, Detay, listeye dönüş | P-N01, P-F02, P-F03, P-E01, P-E03, P-E05, P-E06, P-E07, P-A01 |
| `/parent/results` | Sonuç detayı (ayrı rota yok) | Puan, doğru sayısı, soru/öğrenci cevabı/doğru cevap, görsel | P-F02, P-F04, erişim sınırları |
| `/settings?tab=profile` | Profil Bilgileri | Kendi ad/e-posta/telefon/adresi, kaydet/reload | P-S01, P-S09 |
| `/settings?tab=notifications` | Bildirimler | Ses tercihi, okundu, silme, 20 kayıt sayfalama | P-S02, P-S03, P-S09 |
| `/settings?tab=logs` | İşlem Geçmişi | Kendi son altı aylık kayıtları, 50 kayıt sayfalama | P-S04, P-S09 |
| `/settings?tab=security` | Güvenlik | Şifre uyuşmazlığı, yanlış mevcut şifre, gerçek şifre değişimi/oturum iptali | P-S05, P-S06, P-S09 |
| `/announcements` | Duyurular | Hedefli/herkese açık duyuruları görüntüleme, oluşturma/silme engeli, hata/retry | P-S07, P-S08, sınıf hedefli bildirim testi |
| Ortak menü | Mobil menü/bildirim/profil/çıkış | Navigasyon, klavye, oturum sınırı | P-N01, anonim/yanlış rol/oturum iptali kontrolleri; kapsam dışı ayrıntılar son raporda |

## Yetki ve veri akışı kontrol listesi

`[x]` kontrolün çalıştırıldığını belirtir; geçtiği anlamına gelmez. Her kontrolün gerçek sonucu doğrulama/kapsam raporunda yer alır.

- [x] Anonim401 ve yanlış rol403; doğrudan URL erişimi/yenileme.
- [x] Bağlı iki çocuğun listesi, doğru sonuç sahibi; yabancı öğrenci/sonuç403.
- [x] Veli öğrenci sınavı başlatamaz, cevap yazamaz, kullanıcı/eşleştirme/arşiv yönetemez.
- [x] Eski öğrenci kimliğine ait açık sınavı olan veliye de cevap yazma yasağı.
- [x] Tamamlanmamış sonuçlar ve cevap anahtarı erişimi404.
- [x] Veli-öğrenci bağı kaldırılınca ve öğrenci pasifleştirilince mevcut oturumun yeni API erişimi reddedilir.
- [x] sessionVersion iptali401 ve yenilemede girişe dönüş.
- [x] Sınıfsız çocuk için öğrenci/veli atanmış sınav eşitliği.
- [x] Sınıfa hedefli veli duyurusu hem listede hem gerçek bildirimde görünür.
- [x] Yanıtlarda parola/token ve gereksiz oturum alanı bulunmaz.

## Altyapı ve izolasyon

React/Wouter/TanStack Query frontend; Express/Prisma/SQLite backend. Veli sayfaları `parentApi` üzerinden `/api/parents/students`, `/students/:id/overview`, `/results/:id` okur. `GuardianStudent` bağı ve aktif çocuk denetimi sunucudadır. Liste/detay salt okunur; veli yalnız kendi profil ve bildirim tercihlerini değiştirir.

Mevcut Playwright ve öğrenci audit süreci temel alınarak ayrı `playwright.parent-audit.config.ts`, `server/tests/parent-audit-server.ts`, `tests-e2e/parent-audit-helpers.ts`, `scripts/parent-audit-windows-runner.mjs` oluşturuldu. API5560, UI5561; runtime koruması yanlış uygulama/veritabanı hedefini reddeder. Fixture SQLite migrasyonlarından kurulur; yalnız `server/data/quizmaster-test-parent-audit-*` dizinine yazılır. Çalışma sırasında kullanılan bildirim/log/sonuç kayıtları izole fixture'a aittir; mutasyonlar finally ile geri yüklenir. Runner yalnız kendi çocuk süreçlerini kapatır, portların boşaldığını doğrular; dolu porta kullanıcı süreci öldürmez.

Komut: PowerShell'de `$env:PARENT_AUDIT_RUN='baseline'; node scripts/parent-audit-windows-runner.mjs`. Linux/WSL koşusu bu yeni veli audit başlatıcısının kapsamı dışındadır. Gerçek kurulum hibrit terminal/BAT/SH + web akışıdır; bu denetim kurulum modelini değiştirmez.

Sayfalarda bulunmayan arama/sıralama/sonuç sayfalama, CRUD veya ayrı detay URL'si çalışıyor varsayılmaz; bunlar gerekirse özellik önerisi olarak raporlanır. Sesli ekran okuyucu önceki kullanıcı talebine göre kapsam dışıdır; klavye/ARIA incelemesi sürer.
