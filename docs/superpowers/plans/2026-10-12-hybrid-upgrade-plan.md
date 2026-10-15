# Hibrit yükseltme uygulama planı

> **Tarihsel plan/tasarım kaydı.** 14 Ekim 2026 belge kontrolü: gelecek zaman, açık kutular ve ara sonuçlar özgün çalışma sırasını korur; güncel yapılacaklar olarak okunmamalıdır. [Sonuç ve kapsam kaydı](../../production-upgrade-rehearsal-results.md) esas alınır.

> **Ajan olarak çalışanlar için:** Görev görev uygulamak için executing-plans kullan; inceleme ve doğrulama kapıları geçerlidir.

**Amaç:** Kurulu sistemi temizlemeden terminal/BAT/SH+web üzerinden yükseltmek ve gerçek prova ile doğrulamak.

**Mimari:** Ortak offline yükseltme motoru native bakım yedeğini alır, sabit pnpm komutlarını çalıştırır ve adım/hata/yedek sonucunu bildirir. CLI açık proje dizini ister; mevcut loopback token/cookie/CSRF/origin başlatıcısı motor CLI'sini sabit dizinle başlatır. İlk kurulum sihirbazı ayrı kalır.

**Teknolojiler:** Node 22/24, pnpm9.15.1, mevcut native SQLite, HTTP bootstrap, Prisma migration deploy, Playwright Chromium, Windows BAT ve Ubuntu/WSL SH.

## Sınırlar

Onaylı üretim provası Görev2 kapsamı; yeni onay beklenmez. Kullanıcı frontend dosyaları ve canlı DB korunur. source baseline1298cf8 → güncel kaynak, sentetik ilişkiler/config/uploads/sessionlar. App/worker bakım boyunca kapalıdır; lock yalnız yükseltme komutlarının eşzamanlılığını önler. Gizli env/token/credential header logları yayımlanmaz. Sürüm rollback Görev3, bundle/yük Görev4; bu görevde bunlar tamamlandı denmez.

## 1. Motor ve CLI

- [x] `scripts/upgrade.test.mjs` yaz: backup önce, install/build/db deploy/status sırası, env/installation identity korunum, build hatasında migration yok, kilit reddi.
- [x] RED: eksik modül ve kurulu renderer güncelleme.disabled undefined; ardından `upgrade-lib.mjs`: gerçek yedek, exclusive sahip olunan lock ve finally cleanup, sabit argv runner, adım/yedek bilgili hata. CLI `upgrade.mjs` ve package komutları eklendi (henüz commit edilmedi).
- [x] Controlled motor/web job 4/4, maintenance6/6, setup14/14 GREEN. Gerçek upgrade kabulü değildir; ek CLI ve negatif payload/cancel/regresyon kapsamı sürer.

## 2. Web başlatıcısı

- [x] Mevcut controlled HTTP/render testinde kurulu sistem için güncelleme seçeneğini bekleyen RED ekle.
- [x] `setup-bootstrap.mjs`: kurulu güncelleme butonu ve durum mesajı; `/api/upgrade` aynı authentication/CSRF/origin gövde sınırlarıyla, sabit proje ve mevcut job gate. Reset veya wizard çağrısı yok. Motor CLI'si doğrudan Node ile parent lease altında başlar; paket kurulumu motorun içindedir. Controlled HTTP/render sonucu gerçek BAT/SH kabulü değildir.
- [ ] Fresh/partial/installed durumları, retained handoff, auth/CSRF/origin, busy ve uygun hata doğrulaması. BAT/SH aynı web motoruna açılır; launcher sözleşmesi korunur.

## 3. Gerçek izole prova

- [ ] Önceki commit1298cf8 kaynak arşivini ayrı dizinde aç; gerçek bağımlılık/migration/kurulum yap. Sentetik admin/teacher/student/guardian/class/course/quiz/question/exam result/survey/session, yükleme ve private config oluştur. Hash/count/relationship baseline al; SMTP/AI outbound kapalı.
- [ ] Güncel kaynakları veri/ayar/süreçleri ezmeden yerleştir. Terminal ve BAT+web ayrı fixtures; WSL native SH+web ayrı fixture. Gerçek frozen install, build,17→22migration, tekrar upgrade, server restart ve admin web Sunucu Durumu/temel ilişkiler/görseli doğrula. Baseline1298cf8'de gerçek migration sayısı17'dir; önceki14 varsayımı düzeltildi.
- [ ] Job yarıda kesilme/hata durumlarını test et; veri kaybı varsa TDD ile düzelt. DB sonrası rollback sözleşmesi Görev3'e taşınır.
- [ ] Gerçek tarayıcı ve süreç/port cleanup, protected hash, diff/secret guard, gerekli tip/derleme/regresyon sonuçları.

## 4. Kayıt

- [ ] İlgili README/kurulum/bakım ve ana üretim planını gerçek kapsamla güncelle; eksik ortam başarı sayılmaz. İnceleme sonrası ayrı Görev2 commit'i.
- [ ] Graphify + finaldocs/push bütün üretim görevlerinin son kapanışında; GitHub önceki yayını dış HTTP408 nedeniyle ayrıca izlenir.

12 Ekim ilerleme: gerçek baseline `1298cf8` Git kaynak arşivi credentials içermeden `server/data/quizmaster-test-upgrade-uPr2W8` dizinine açıldı. Native `pnpm install --frozen-lockfile` sürüyor; henüz schema/seed/upgrade/browser başarı kabulü yok. Özel runner `.superpowers/sdd/.../production-baseline-prepare.mjs` 600s install ve240s migrate bound kullanır; timeout/exit sonucu kontrol edilmeden veri başarı sayılmaz. Güncel görev source diff'i localuserprotected2 dışındadır; bu kaynakları gerçek upgrade fixture'ına veri/env/data/uploads/node_modules ezmeden yerleştirmek sonraki adımdır.

13 Ekim doğrulama: önceki native dependency install zaman aşımı alt süreçleri durdurmamıştı; sonradan tamamlanan install başarı tek başına baseline kabulü sayılmadı. Ayrı süreçte17migration ve sentetik seed tamamlandı. İlk upgrade install, hazırlama runner'ının bellekte tuttuğu Prisma DLL yüzünden EPERM ile reddedildi; DB migration'a geçmedi, kurtarma yedeği kaldı. Hazırlama süreci kapatıldıktan sonra gerçek frozen install, backend/frontend build,17→22deploy ve status exit0. Ardından7 business koleksiyonu, config/installation identity/upload hashleri, integrity/FK kontrolü geçti. Resmi `pnpm --filter quiz-master-server start` ile gerçek Chromium admin auth, Sunucu Durumu, arşiv/yıl seçici, görsel ve reload geçti; sahip olunan süreç/port temizliği doğrulandı. Doğrudan `node dist/index.cjs` denemesi native SQLite çözümlemesi yüzünden başarısızdı; belgelenmiş pnpm start sözleşmesinin yerine sayılmadı.

Motor incelemesindeki yanlış inherited DATABASE_URL/RUST_LOG ve Windows cmd argv sorunları RED/GREEN ile düzeltildi. Linux nested supervisor yarışı, web başlatıcısının doğrudan CLI + parent lease kullanmasıyla kaldırıldı. Windows son ilgili12/12; native Linux son10/10 (workspace bağımlılıkları tekrar kullanılan izole test root; taze SH kurulumu/yükseltmesi değildir). Son supervisor null/signal exit guard'ı Windows kontrollü event regresyonuyla doğrulandı; yeni native SH turu sürer. Kontrollü lease iptali TERM dirençli alt süreç portunu kapatır, finally lock'ı kaldırır ve yedeği korur. Bu Windows yürütme ortamında parent hard termination CLI'yi de öldürebildiğinden finally çalışması garanti değildir; kalan lock konservatif korunur, otomatik silinmez. Supervisor hard stop veya doğrulanamayan cleanup durumunda lock'ın korunması ek RED/GREEN ile doğrulandı. BAT+web/SH+web ve önceki oturum korunumu/tekrar upgrade henüz açık; Görev2 bütünü tamamlanmış sayılmadı.
