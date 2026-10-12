# Hibrit yükseltme uygulama planı

> **For agentic workers:** Use executing-plans to implement task-by-task; review and verification gates apply.

**Goal:** Kurulu sistemi temizlemeden terminal/BAT/SH+web üzerinden yükseltmek ve gerçek prova ile doğrulamak.

**Architecture:** Ortak offline yükseltme motoru native bakım yedeğini alır, sabit pnpm komutlarını çalıştırır ve adım/hata/yedek sonucunu bildirir. CLI açık proje dizini ister; mevcut loopback token/cookie/CSRF/origin başlatıcısı motor CLI'sini sabit dizinle başlatır. İlk kurulum sihirbazı ayrı kalır.

**Tech Stack:** Node 22/24, pnpm9.15.1, mevcut native SQLite, HTTP bootstrap, Prisma migration deploy, Playwright Chromium, Windows BAT ve Ubuntu/WSL SH.

## Sınırlar

Onaylı üretim provası Görev2 kapsamı; yeni onay beklenmez. Kullanıcı frontend dosyaları ve canlı DB korunur. source baseline1298cf8 → güncel kaynak, sentetik ilişkiler/config/uploads/sessionlar. App/worker bakım boyunca kapalıdır; lock yalnız yükseltme komutlarının eşzamanlılığını önler. Gizli env/token/credential header logları yayımlanmaz. Sürüm rollback Görev3, bundle/yük Görev4; bu görevde bunlar tamamlandı denmez.

## 1. Motor ve CLI

- [x] `scripts/upgrade.test.mjs` yaz: backup önce, install/build/db deploy/status sırası, env/installation identity korunum, build hatasında migration yok, kilit reddi.
- [ ] RED çıktısını kontrol et; sonra `upgrade-lib.mjs`: gerçek yedek, exclusive sahip olunan lock ve finally cleanup, sabit argv runner, adım/yedek bilgili hata. CLI `upgrade.mjs` ve package komutları.
- [ ] Unit/CLI/native backup regresyonu GREEN; yalnız kontrollü runner kabulü olduğu açıkça belirtilir.

## 2. Web başlatıcısı

- [x] Mevcut controlled HTTP/render testinde kurulu sistem için güncelleme seçeneğini bekleyen RED ekle.
- [ ] `setup-bootstrap.mjs`: kurulu güncelleme butonu ve durum mesajı; `/api/upgrade` aynı authentication/CSRF/origin gövde sınırlarıyla, sabit proje ve mevcut job gate. Reset veya wizard çağrısı yok. Çocuk süreç hatası/çıkışı doğru görünür; paket kurulumu ayrı kullanıcı adımı olarak zorunlu değil, upgrade motoru yapar.
- [ ] Fresh/partial/installed durumları, retained handoff, auth/CSRF/origin, busy ve uygun hata doğrulaması. BAT/SH aynı web motoruna açılır; launcher sözleşmesi korunur.

## 3. Gerçek izole prova

- [ ] Önceki commit1298cf8 kaynak arşivini ayrı dizinde aç; gerçek bağımlılık/migration/kurulum yap. Sentetik admin/teacher/student/guardian/class/course/quiz/question/exam result/survey/session, yükleme ve private config oluştur. Hash/count/relationship baseline al; SMTP/AI outbound kapalı.
- [ ] Güncel kaynakları veri/ayar/süreçleri ezmeden yerleştir. Terminal ve BAT+web ayrı fixtures; WSL native SH+web ayrı fixture. Gerçek frozen install, build,14→22migration, tekrar upgrade, server restart ve admin web Sunucu Durumu/temel ilişkiler/görseli doğrula.
- [ ] Job yarıda kesilme/hata durumlarını test et; veri kaybı varsa TDD ile düzelt. DB sonrası rollback sözleşmesi Görev3'e taşınır.
- [ ] Gerçek tarayıcı ve süreç/port cleanup, protected hash, diff/secret guard, gerekli tip/derleme/regresyon sonuçları.

## 4. Kayıt

- [ ] İlgili README/kurulum/bakım ve ana üretim planını gerçek kapsamla güncelle; eksik ortam başarı sayılmaz. İnceleme sonrası ayrı Görev2 commit'i.
- [ ] Graphify + finaldocs/push bütün üretim görevlerinin son kapanışında; GitHub önceki yayını dış HTTP408 nedeniyle ayrıca izlenir.
