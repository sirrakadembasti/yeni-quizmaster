# Yerel bakım ve üretim provası

5 Kasım 2026 güncel bakım notu: `domain/demo` salt-okunur ikinci kopya veritabanı (`server/data/demo.db`) `pnpm run db:prepare-demo` ile hazırlanır ve `pnpm run start:demo` (`PORT=5001`, `APP_DEMO_MODE=true`, `APP_BASE_PATH=/demo`) ile çalıştırılır. SMTP erişimi olmayan kurulumlarda yönetici şifresi `pnpm --filter quiz-master-server run db:reset-admin` komutuyla veya yönetici panelindeki **Şifre Talepleri > Bağlantı Üret (SMTP'siz)** seçeneğiyle sıfırlanabilir. İstemci üretim paketinde `manualChunks` (`vendor-react`, `vendor-ui`) ile 500 kB üzeri paket uyarısı giderilmiştir.

16 Ekim 2026 güncel durum: kullanıcı onaylı iki aşamada yerel kurulum 14 → 24 → 25 migration'a yükseltildi; son eklemeli migration `20261015000200_ai_usage` oldu. Uygulama üretim kipinde 5000 portunda çalışır. [Öğretmen kullanım takibi, sekmeler ve son veri koruma kaydı](2026-10-15-ai-usage-results.md). Önceki tarihli aşağıdaki “canlı DB değiştirilmedi” ifadeleri kendi prova aşamalarına aittir. [Güncel yedek/veri doğrulama ve devreye alma kaydı](2026-10-15-ai-management-deployment.md).

AI yönetimi için `20261015000100_ai_management`, öğretmen tüketim kaydı için `20261015000200_ai_usage` migration'ları eklenmiştir. Profil kayıtlarıyla `server/data/ai-encryption.key` dosyasını birlikte koruyun; native backup/restore anahtarın kayıtları çözebildiğini de doğrular. Eksik/yanlış anahtarla yeni anahtar üretip devam etmeyin. [Kurulum ve kullanım](ai-management.md).

## 15 Ekim 2026 sürüm notu

Kapasite sürümü Prisma 6.19.3 ve better-sqlite3 12.8.0 (SQLite 3.51.3) kullanır; uygulama, oturum, arşiv ve yedek bağlantıları aynı yamalı sürücüdedir. WAL ve FULL dayanıklılığı korunur. Güncellemeden önce bütün app/worker süreçlerini durdurun, doğrulanmış yedek alın ve ayrı kurulumda yükseltmeyi prova edin. Frozen install ve Prisma generate sonrasında `20261014090000_notification_revision` dahil migration'ları `db:deploy` ile uygulayıp build/restart yapın. Canlı kurulum bu geliştirme sırasında yükseltilmedi.

80 öğrencilik izole sınav provası 4.334 istekte sıfır hatayla tamamlandı; gerçek okul Wi-Fi kapasitesi ve 30 dakikalık saha koşusu ölçülmedi. Önceki performans başarısızlıkları tarihsel kanıt olarak korunur. [Güncel sonuçlar, gecikmeler ve sınırlar](2026-10-14-capacity-school-exam-results.md).

12 Ekim 2026: üretim provası Görev 1 kapsamında uygulanmıştır. Komutlar yerel SQLite uygulama verisi içindir. Akademik CSV/PDF/ZIP export'u tam uygulama geri yükleme yedeği değildir.

## Kullanım

Uygulamanın ve arka plan işçilerinin bütün süreçlerini durdurun; bakım boyunca yeniden başlatmayın. Komut efektif `.env` HOST/PORT adresinde dinleyici varsa işlemi reddeder. Bu kontrol servis yöneticisinin bakım kilidi yerine geçmez. Açık SQLite WAL verisi SQLite backup API ile tutarlı, bağımsız DB dosyasına alınır.

```powershell
pnpm maintenance backup --project F:\kurulumlar\quizmaster --name before-upgrade
pnpm maintenance restore --backup F:\kurulumlar\quizmaster\server\backups\before-upgrade --project F:\kurulumlar\quizmaster-restored
```

Linux/terminal eşdeğeri `node scripts/maintenance.mjs backup --project /opt/quizmaster --name before-upgrade` ve `node scripts/maintenance.mjs restore --backup /opt/quizmaster/server/backups/before-upgrade --project /opt/quizmaster-restored` komutlarıdır. 12 Ekim native Ubuntu 22.04/WSL2 (Linux 6.18.33.2, Node 22.23.2) bakım turu 6/6 geçti; SH üzerinden yükseltme bu kabulün kapsamına dahil değildir.

Hedef bağımsız olmalı; kök `.env`, `server/.env`, `server/data` veya `server/uploads` mevcutsa geri yükleme reddedilir. Boş veri alanına restore edin, aynı sürümün uygulama kodunu ve bağımlılıklarını bu hedefe yerleştirin. Git klonundaki `server/data/README.md` bile mevcut veri dizini sayılır; komut otomatik silmez. Çalışan kuruluma restore veya yedek üzerine tekrar yazma yapılmaz. Sürümle birlikte geri dönüş ayrı prova görevidir.

## Kapsam ve bütünlük

- `server/data/quiz.db`, varsa `sessions.db`: native SQLite snapshot, integrity ve foreign-key kontrolü. WAL/SHM yan dosyaları yedeklenmez; commit edilmiş WAL kayıtları snapshot'ta korunur.
- Varsa kök `.env` ve `server/.env`, kurulum lock/pending ve deployment yapılandırması, setup-artifacts, yüklemeler ve varsayılan ya da özel `ARCHIVE_BACKUP_ROOT`: dosya uzunluğu ve SHA-256 manifesti. Etkin dosya ayarları backend ile aynı öncelikte birleşir: `server/.env`, kök fallback değerlerini geçersiz kılar. HOST/PORT ve arşiv dizini kontrolü bu birleşimi kullanır.
- Yedek dizini `server/backups/<name>`; akademik paketlerin varsayılan kaynak dizini `server/data/backups`. Bunlar ayrı dizinlerdir. Mevcut temiz kurulum yedeği de varsayılan akademik paketleri artık içerir.
- Eksik/fazladan/bozuk dosya, hatalı manifest, traversal, symlink/junction ve mevcut hedef reddedilir. Bütün doğrulamalar staging yayımlanmadan yapılır; başarısız yayının bu işlemce eklenen dosyaları geri alınır.
- Restore varsa `server/.env`, yoksa kök `.env` sonuna taşınabilir DATABASE_URL ve ARCHIVE_BACKUP_ROOT değerleri ekler. Dotenv'in son atama kuralı nedeniyle duplicate/export anahtarları da doğru hedefi kullanır. Diğer ayarlar korunur. Kök `.env` içermeyen önceki format1 yedekler desteklenmeye devam eder.
- Tamamlanmış arşivin değişmez DB satırı ve ZIP SHA'sı korunur. Eski mutlak konum yalnız yıl/arşiv kimliğini doğrular; okuma güncel yapılandırılmış dizinden yapılır. ZIP SHA ve embedded yıl/kimlik/manifest doğrulaması devam eder.

Yedek gizli `.env` ayarlarını ve iş verilerini içerir; özel depoda saklayın. Unix dosya/dizin izinleri 600/700 istenir; Windows ACL yönetimi işletim sahibine aittir. Kod, node_modules, işletim sistemi, dış TLS sertifikaları ve desteklenmeyen harici veritabanları bu yedeğe dahil değildir. Başka DATABASE_URL türü sessizce atlanmaz, reddedilir.

## Doğrulama kanıtı

Canlı DB okunmadı; yalnız hash'i karşılaştırıldı. Kullanıcının `client/src/lib/api.ts` ve `client/src/pages/server-setup.tsx` değişiklikleri korunmuştur.

| Kontrol | Sonuç / sınır |
| --- | --- |
| `pnpm run test:maintenance` | 6/6: gerçek native SQLite WAL/main/session turu, özel paket dizini, config, dinleyen IPv6/exported port, bozuk/eksik/fazladan/path/junction/tekrar hedef reddi, CLI |
| `pnpm run test:setup` | 14/14 mevcut kurulum regresyonu |
| Linux native bakım | Ubuntu/WSL2 üzerinde aynı 6 test 6/6, sıfır skip, exit 0; önceki izole Linux kurulumunun native bağımlılıkları ayrı test kopyasına bağlandı, güncel bakım kaynakları çalıştırıldı. WAL/session/hash/path/IPv6/exported port ve CLI kontrolleri, sahip olunan fixture temizliği geçti. Taze bağımlılık kurulumu ve web/SH yükseltmesi kanıtı değildir. |
| Archive export dosyası | 28/28; taşınan gerçek ZIP manifesti ve sabit SHA, yanlış kimlik/bozulma reddi. PDF üreticisi test stub'ıdır; önceki gerçek PDF kabulünün yerine geçmez. |
| Gerçek DB + assets API | 10/10, 2 dosya; yeni izole 22-migration şema, kullanıcı/sınıf/ders/sınav/anket/sonuç ilişkileri, offline backup→bağımsız restore, geçmiş yıl/görsel, immutable satır güncelleme reddi. Auth middleware burada test fixture'ıdır. |
| Gerçek Chromium restore smoke | Geçti; kaynak admin hesabı bakım yedeğinden ayrı dizine taşındı, gerçek auth API ile giriş, arşiv sayfası, yıl seçici, mobil yenileme, masaüstü/mobil ekran görüntüleri. İş ilişkilerinin tamamı bu tarayıcı senaryosunda yeniden sınanmadı; üstteki gerçek DB/API testi kapsar. |
| Backend tip kontrolü | `pnpm --filter quiz-master-server exec tsc --noEmit` exit 0 |

API komutu: `pnpm --filter quiz-master-server exec vitest run --config vitest.archive-acceptance-db.config.ts tests/api/academic-history-db.test.ts tests/academic-history-assets.test.ts`. Browser komutu: `ACADEMIC_MIGRATION_TEMPLATE` bağımsız doğrulanmış boş test şemasını ve `ACADEMIC_BUNDLE_SERVER=1` sahip olunan kaynak bundle'ını seçerek `node scripts/academic-archive-runner.mjs --restore-smoke`. Şema yeniden kullanımına dayalı browser sonucu taze hibrit kurulum kabulü değildir. Outbound SMTP/AI bağlantıları fixture tarafından engellenir.

İlk denemelerden biri Windows sandbox erişim hatasıyla reddedildi; yetkili tekrar başarılı oldu. Entegrasyon testindeki root/import/API alanı ve mount eşlemeleri düzeltilerek son kabul 10/10 alındı. Önceki başarısız denemeler başarı sayılmadı. Özel kanıtlar `.superpowers/sdd/2026-10-05-academic-archive-review-plan/production-restore-*-20261012.log` ve `production-restored-admin-{desktop,mobile}.png` içinde tutulur; gizli veri içerebilen özel loglar Git'e eklenmez.

## Veri koruyan sürüm yükseltme

Onayladığınız yeni sürüm kodunu `.env`, `server/data`, `server/uploads` ve arşiv paketlerini ezmeden yerleştirin. Uygulama ve bütün işçileri durdurun. Kurulum kimliği ve standart yerel SQLite DB mevcut olmalıdır.

```powershell
pnpm run upgrade --project F:\kurulumlar\quizmaster
```

Linux eşdeğeri `node scripts/upgrade.mjs --project /opt/quizmaster`. Komut kurulu projedeki `scripts/upgrade.mjs` dosyasıyla da doğrudan çalıştırılabilir. `kurulum.bat` veya `./kurulum.sh` ile açılan yerel başlangıç ekranında kurulu sistem için **Mevcut Kurulumu Güncelle** bulunur; aynı offline motor kullanılır. Web istemcisi proje yolu veya çalıştırılacak komut seçemez. Paket onarma ve temiz kurulum seçenekleri ayrı işlemlerdir.

Sıra: doğrulanmış private SQLite/dosya yedeği → `pnpm install --frozen-lockfile --prod=false` → backend/frontend build → `db:deploy` → `db:status`. Production ortamında da esbuild/Vite gibi derleme araçları gereklidir; `--prod=false` bunların kaldırılmasını/atlanmasını önler. Paketleri Kur/Onar da aynı politikayı kullanır. Yükseltme alt komutlarında ve paket onarımında `CI=true` zorunludur; paket dizini değiştirme onayı beklenmez, lockfile uyumsuzluğu işlem hatasıdır. Runtime sunucunun production modu korunur. Migration komutlarının DATABASE_URL'si doğrulanan yerel `server/data/quiz.db` dosyasına sabitlenir; terminalden yanlış DB veya Prisma log seviyesi miras alınmaz. Windows çağrıları pnpm JavaScript girişini Node ile çalıştırır; proje yolundaki boşluk ve shell karakterleri komut metni olarak yorumlanmaz. Motor Git kaynağı indirmez ve ilk admin oluşturmaz.

Başlatıcı çerezi HttpOnly, SameSite=Strict ve 30 dakikalık ömür taşır. Yetkili `/api/status` sorguları bu süreyi yeniler; uzun derleme sırasında açık arayüzün oturumu korunur. Yetkisiz sorgu çerez alamaz. Polling sonlanınca çerez son yenilemeden 30 dakika sonra biter; terminal kapanınca yerel başlatıcı da erişilemez. Kurulu sistemin paket metriği, güncellemenin paket adımını içerdiğini belirtir; başarı/hata mesajı her durum yenilemesinde doğru stile döner.

Başarıdan sonra resmi `pnpm --filter quiz-master-server start` komutuyla veya servis yöneticisiyle başlatın; giriş, Sunucu Durumu ve kayıt/görselleri kontrol edin. Yalnız build/migration başarı mesajı web kabulü değildir. Hata mesajında son adım ve varsa kurtarma yedeği gösterilir. Yedek kod/node_modules içermediğinden eski sürüme dönüş için **eski kod ve onun migration öncesi verisi birlikte** gerekir; bunun prova kabulü ayrı Görev3'tür.

Kontrollü iptal aktif komutun alt süreçlerini durdurur; temizliği doğrulandıysa operation lock kaldırılır. Hard termination veya doğrulanamayan süreç temizliğinde `server/data/upgrade.lock` kalabilir; otomatik silinmez. Bütün yükseltme/Prisma alt süreçlerinin durduğunu ve DB bütünlüğünü doğrulamadan kilidi kaldırıp yeniden çalıştırmayın. Lock uygulamanın kendisini başlatmasını engelleyen servis bakım kilidi değildir; bakım boyunca app/worker kapalı tutulmalıdır.

13 Ekim terminal kabulü: gerçek `1298cf8` kaynak/dependency/schema üzerine yeni kaynak yerleştirildi; 17→22 migration, frozen install/build/status ve 7 iş verisi koleksiyonu/config/upload/kurulum kimliği bütünlüğü geçti. Resmi pnpm start ile gerçek Chromium auth, Sunucu Durumu, arşiv/yıl seçici, görsel/reload, süreç ve port temizliği doğrulandı. İlk DLL-lock denemesi ve desteklenmeyen doğrudan node-start denemesi başarı sayılmadı.

13 Ekim SH+web kabulü: bağımsız Ubuntu 22.04/WSL2 fixture'ında gerçek eski sürüm frozen install ve 17-migration veri hazırlığı, `sh kurulum.sh --no-open`, tarayıcıdan güncelleme, gerçek build/migration/status, resmi production start, giriş/Sunucu Durumu/arşiv/görsel erişimi geçti. Altı iş koleksiyonunun eski alanları, ayar/dosya hash'leri, 22 migration ve integrity/FK, sahip olunan süreç/port temizliği doğrulandı; iki gerçek ekran görüntüsü görsel olarak incelendi. Native bağımlılık cache'i kullanıldı; cache'siz taze indirme iddiası değildir. İlk tıklama/temizlik hataları ve kesilen turdan kalan kilit başarı sayılmadı. Kilit yalnız fixture süreç/port/DB kontrolleri geçtikten sonra elle kaldırıldı.

Son bakım ve yükseltme/renderer regresyonu Windows'ta 20/20, native Linux bakım turu 7/7 (skip 0, exit 0). Kök fallback portu, iki env dosyası, mevcut root-env hedefini koruma, kısa çerez yenilemesi ve etkileşimsiz kurulum kontrolleri eklendi. Paralel testteki sabit port çakışması fixture'a özel portla giderildi; yüklü ortamda zaman aşımına uğrayan süreç testleri sıralı son turda geçti. Bağımsız inceleme bakım ve ilk UX kapsamlarında engelleyici sorun bulmadı.

13 Ekim son kabul: gerçek BAT/web ikinci tam turu ve başarı arayüzünü bekleyen üçüncü tam turu, özgün eski oturumu yeniden giriş yapmadan koruyarak geçti. Yedi iş koleksiyonu, bütün generated Prisma şeması, 22 migration/integrity/FK, config/görsel, reload ve sahip olunan süreç/port kapanışı doğrulandı. Native SH/web son production-policy tekrarı da gerçek install/build/deploy/status, altı koleksiyon/tam şema ve süreç/port denetimiyle exit 0 geçti. Son başarı ekranları görsel olarak incelendi. Önceki 403, etkileşimli install, production devDependency kaybı ve native kesintiler başarı sayılmadı; düzeltmeler ve ortam sınırları [ayrı raporda](production-upgrade-rehearsal-results.md). Görev 2 kapandı; rollback ve yük/bundle ölçümleri ayrı görevlerdir.

## Hatalı yükseltmeden geri dönüş

Yükseltme motoru başarısız adımı ve doğrulanmış yedek yolunu bildirir; otomatik eski sürüm başlatmaz. Migration veya açılış hatasından sonra yeni şemayı eski kodla açmayın. Uygulama/worker/upgrade süreçlerini durdurun ve başarısız kurulumu tanı için koruyun. Kalan operation lock ancak kendi süreçleri, portlar ve DB bütünlüğü doğrulandıktan sonra değerlendirilir; bakım kilidi silmek veri geri dönüşü değildir.

1. Yükseltme **öncesindeki kod sürümünü** bağımsız hedefe yerleştirin. Hedefte `.env`, `server/.env`, `server/data`, `server/uploads` bulunmamalıdır; takip edilen `server/data/README.md` de dolu veri alanı sayılır. Kaynak paketi veri dosyaları olmadan çıkarın; bakım komutu otomatik temizlemez.
2. Doğru eski sürümle eşleşen, yükseltme motorunun oluşturduğu yedeği geri yükleyin: `pnpm maintenance restore --backup <bildirilen-yedek> --project <bağımsız-boş-veri-hedefi>`. Hash/manifest/path/DB kontrolleri geçmeden hedef veri yayımlanmaz. Yanlış veya bozuk yedekte durun; çalışan veriyi üzerine yazmayın.
3. Kurtarma hedefinde `CI=true` ile `pnpm install --frozen-lockfile --prod=false`, `pnpm build`, `pnpm --filter quiz-master-server db:generate` ve `pnpm --filter quiz-master-server db:status` çalıştırın. Eski kaynak ile eski DB'nin migration sayısı/şeması eşleşmeli; bekleyen migration varsa otomatik yeni migration uygulamayın, kaynak/yedek eşleşmesini düzeltin. Gerekli portable DB/archive yollarını ve bu hedefin portlarını ayarlayın; gizli değerleri loga yazmayın.
4. Resmi production start sonrası özgün hesap/oturum, ilişkiler, sonuçlar, arşiv ve görselleri doğrulayın. Yeni girişin başarılı olması eski oturumun korunduğunu kanıtlamaz. Kurtarma kurulumu doğrulanmadan trafiği yönlendirmeyin; aynı yazma verisi üzerinde iki sürümü birlikte çalıştırmayın.

Kurtarma provası [ayrı sonuç belgesinde](production-rollback-rehearsal-results.md) platform ve hata aşaması bazında tutulur. Bu işlem disk/OS veya harici veritabanı geri yüklemesi değildir; eski kod, paketler ve doğrulanmış uygulama yedeği birlikte gereklidir.

14 Ekim kabulü: Windows install/build/migration/start hatalarından eski kod ve yükseltme öncesi yedeğe dönüş 4/4; native Ubuntu/WSL gerçek kısmi migration hatasından dönüş 1/1 geçti. Her kurtarmada yedi iş koleksiyonu, özgün oturum, generated eski şema/17 migration, integrity/FK, config/görsel, arşiv/yenileme ve süreç/port kapanışı doğrulandı. Linux'ta diğer üç hata aşaması tekrarlanmadı. Windows migration/start bağımlılıkları bağımsız fiziksel cache kopyalarıydı; gerçek frozen install/build yine çalıştırıldı, cache'siz kurulum iddiası değildir.

## Performans ve çevrimdışı kabul

14 Ekim izole native Ubuntu/WSL ölçümünde 1.311 kullanıcı ve 17.661 iş satırı gerçek 22 migration şemasına yazıldı. Aynı production config ve kaynak başlangıcıyla frontend başlangıç JavaScript gzip toplamı 412.368 bayttan 233.509 bayta indi (%43,37). Public giriş/kurtarma ve kritik öğrenci sınavı başlangıç paketinde kalır; ağır sayfalar yetki kontrolünden sonra yüklenir. Toplam dağıtılan JavaScript 1.520.844 bayttır ve public `sw.js` dahildir; başlangıç indirmesiyle toplam dağıtım farklı ölçümlerdir.

Gerçek Chromium'da `/` ve `/school/` altında rol erişimi, doğrudan URL/yenileme/gezinme ve lazy parça hatasından kurtarma; taze profilde daha önce açılmamış çevrimdışı sınav, soru görseli, cevap/teslim kuyruğu ve yeniden bağlanınca tek sonuç kaydı doğrulandı. Kota veya saklama başarısızlığında hazır durumu verilmez. Çıkış bekleyen yerel cevapları da temizler; teslim tamamlanmadan çıkış yapmayın.

Genel yükte 2 ve 8 aktör düzeltme sonrası HTTP ve DB doğrulamasını geçti. 20 aktör/600 istekte 10 istemci süre aşımı ve bir son DB onayı uyuşmazlığı kaldı; bu seviye başarılı kapasite kabulü değildir. Bazı gecikmeler başlangıç ölçümünden yüksektir. Bu makinenin ölçümünden canlı üretim SLA'sı veya azami kullanıcı sayısı çıkarılamaz; büyük sonuç listelerinde sayfalama ve hedef sunucuda kapasite ölçümü ayrıca planlanmalıdır. Süre aşımı sonrasında sunucuda yazma tamamlanabileceğinden yalnız son DB değerini görmek başarılı HTTP onayı sayılmaz.

UI kontrollerindeki altı sınav girişimi sonrası gerçek arşiv 17.667 satır yakaladı. Capture 4,226 s, PDF/ZIP üretimi 20,170 s, yıl kapanışı 1,031 s ve geçmişin yeni projeksiyon sürümüne ilk hazırlığı 4,191 s ölçüldü. Bağımsız bildirim yazıcısı bu aşamalarla zaman damgaları üzerinden örtüştü: 50 isteğin tamamı geçti ve son değer DB'de doğrulandı. Geçmiş hazırlama 256 satırlık sayfalar ve en çok 4.096 satırlık transaction'larla ilerledi; immutable kaynak özetleri değişmedi. Bu ilk projeksiyon ölçümünde OS dosya cache'inin soğuk olduğu iddia edilmez; önceki 50k satır turunun yerine geçmez.

Komutlar, kaynak projeksiyonu, ölçüm kapsamı, başarısız ilk denemeler ve sonraki kapasite önerileri [performans raporunda](production-performance-results.md) tutulur. `production-performance-*` yardımcıları bu sabit kaynak/hash sözleşmesine sahip izole kabul araçlarıdır; çalışan üretim kurulumunda benchmark başlatma komutu olarak kullanılmamalıdır. Grafik veya yalnız derleme başarısı bu gerçek HTTP/DB/tarayıcı kabulünün yerine geçmez.
