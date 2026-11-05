# QuizMaster Üretim, Bakım, Yedekleme ve Yükseltme Kılavuzu

## 1. Güncel Bakım Özeti (5 Kasım 2026)

- **`domain/demo` Salt-Okunur İkinci Kopya:** Bağımsız `server/data/demo.db` veritabanı `pnpm run db:prepare-demo` ile hazırlanır ve `pnpm run start:demo` (`PORT=5001`, `APP_DEMO_MODE=true`, `APP_BASE_PATH=/demo`) ile çalıştırılır. Ayrıntılar [`demo/demo-vitrin-hesaplari.md`](../demo/demo-vitrin-hesaplari.md) belgesindedir.
- **SMTP'siz Parola Kurtarma:** E-posta erişimi olmayan kurulumlarda yönetici şifresi `pnpm --filter quiz-master-server run db:reset-admin` komutuyla veya yönetici panelindeki **Şifre Talepleri > Bağlantı Üret (SMTP'siz)** seçeneğiyle sıfırlanabilir.
- **İstemci Paket Bölme:** `client/vite.config.ts` içinde `manualChunks` (`vendor-react`, `vendor-ui`) ile 500 kB üzeri paket uyarısı giderilmiştir.
- **Yapay Zeka Şifreleme Anahtarı:** AI yönetimi için `20261015000100_ai_management` ve öğretmen tüketim kaydı için `20261015000200_ai_usage` migration'ları dahil toplam 25 migration uygulanmıştır. Profil kayıtlarıyla `server/data/ai-encryption.key` dosyasını birlikte koruyun; yerel yedekleme/geri yükleme (`backup`/`restore`) anahtarın kayıtları çözebildiğini de doğrular. Ayrıntılar [Yapay Zeka Yönetimi](yapay-zeka-yonetimi.md) kılavuzundadır.

## 2. Veritabanı ve Sürücü Yapısı

Uygulama Prisma 6.19.3 ve `better-sqlite3` 12.8.0 (SQLite 3.51.3) kullanır; uygulama, oturum, arşiv ve yedek bağlantıları aynı sürücüdedir. WAL ve `synchronous=FULL` dayanıklılığı korunur. Güncellemeden önce bütün uygulama ve işçi (worker) süreçlerini durdurun, doğrulanmış yedek alın ve ayrı kurulumda yükseltmeyi prova edin.

## 3. Tam Yedekleme (`backup`) ve Geri Yükleme (`restore`)

Uygulamanın ve arka plan işçilerinin bütün süreçlerini durdurun; bakım boyunca yeniden başlatmayın. Komut efektif `.env` `HOST`/`PORT` adresinde dinleyici varsa işlemi reddeder. Açık SQLite WAL verisi SQLite backup API ile tutarlı, bağımsız veritabanı dosyasına alınır.

```powershell
pnpm maintenance backup --project F:\kurulumlar\quizmaster --name yukseltme-oncesi
pnpm maintenance restore --backup F:\kurulumlar\quizmaster\server\backups\yukseltme-oncesi --project F:\kurulumlar\quizmaster-geri-yuklenen
```

Linux/terminal eşdeğeri:
```bash
node scripts/maintenance.mjs backup --project /opt/quizmaster --name yukseltme-oncesi
node scripts/maintenance.mjs restore --backup /opt/quizmaster/server/backups/yukseltme-oncesi --project /opt/quizmaster-geri-yuklenen
```

Hedef dizin bağımsız olmalıdır; kök `.env`, `server/.env`, `server/data` veya `server/uploads` mevcutsa geri yükleme reddedilir. Boş veri alanına geri yükleyin, aynı sürümün uygulama kodunu ve bağımlılıklarını bu hedefe yerleştirin. Çalışan kuruluma geri yükleme veya mevcut yedek üzerine tekrar yazma yapılmaz.

### Kapsam ve Bütünlük
- **`server/data/quiz.db` ve varsa `sessions.db`:** Yerel SQLite anlık görüntüsü (snapshot), bütünlük (`integrity_check`) ve yabancı anahtar (`foreign_key_check`) kontrolü yapılır.
- **Yapılandırma ve Dosyalar:** Varsa kök `.env` ve `server/.env`, kurulum kilidi (`installation.lock`), dağıtım yapılandırması, `setup-artifacts`, yüklenen görseller (`uploads`), `ai-encryption.key` ve `ARCHIVE_BACKUP_ROOT` dosya uzunluğu ile SHA-256 manifesti üzerinden doğrulanır.
- **Yedek Dizinleri:** Yedek dizini `server/backups/<ad>`; akademik paketlerin varsayılan kaynak dizini `server/data/backups` altındadır.
- **Güvenlik:** Eksik, fazladan veya bozuk dosya, hatalı manifest, dizin aşımı (path traversal), sembolik bağlantı (symlink/junction) ve dolu hedef dizin reddedilir. Yedek gizli `.env` ayarlarını ve iş verilerini içerdiğinden sunucu dışında erişimi sınırlı özel depoda saklanmalıdır.

## 4. Veri Koruyan Sürüm Yükseltme (`upgrade`)

Onayladığınız yeni sürüm kodunu `.env`, `server/data`, `server/uploads` ve arşiv paketlerini ezmeden yerleştirin. Uygulama ve bütün işçileri durdurun.

```powershell
pnpm run upgrade --project F:\kurulumlar\quizmaster
```

Linux eşdeğeri `node scripts/upgrade.mjs --project /opt/quizmaster` komutudur. `kurulum.bat` veya `./kurulum.sh` ile açılan yerel başlangıç ekranındaki **Mevcut Kurulumu Güncelle** seçeneği de aynı çevrimdışı motoru çalıştırır:

1. Doğrulanmış yerel SQLite ve dosya yedeği alınır.
2. `pnpm install --frozen-lockfile --prod=false` etkileşimsiz (`CI=true`) çalıştırılır (üretim derlemesi için gerekli `esbuild`/`Vite` araçları korunur).
3. Sunucu ve istemci üretim derlemesi (`build`) alınır.
4. `prisma migrate deploy` ve `prisma migrate status` çalıştırılır.

Başarıdan sonra resmi `pnpm --filter quiz-master-server start` komutuyla veya servis yöneticisiyle başlatın; giriş, **Sunucu Durumu** ve kayıt/görselleri kontrol edin.

## 5. Hibrit Yükseltme ve Geri Dönüş (Rollback) Prova Sonuçları

### Hibrit Yükseltme Kabulü (Windows Terminal, BAT+Web ve Linux/WSL2 SH+Web)
- **Windows Terminal & BAT + Web:** Eski sürüm (`1298cf8`, 17 migration) üzerinden gerçek `kurulum.bat --no-open` ve tarayıcıdan yükseltme ile 22 migration'a geçiş doğrulandı. İlk sürümün özgün oturumu yeniden giriş yapılmadan çalıştı; kullanıcı, parola, `sessionVersion`, veli/öğretmen ilişkileri, sınav/anket cevapları, üretilmiş Prisma şeması, `integrity_check=ok` ve görsel SHA özetleri korundu.
- **Ubuntu 22.04 / WSL2 SH + Web:** `sh kurulum.sh --no-open` ile tarayıcı üzerinden güncelleme, üretim derlemesi, migration dağıtımı ve süreç/port temizliği hatasız tamamlandı (Windows bakım/yükseltme regresyonu **20/20**, Linux bakım turu **7/7** geçti).

### Hatalı Yükseltmeden Geri Dönüş (Rollback) Kabulü
Otomatik geri dönüş (auto-rollback) yoktur; yükseltme sırasında hata oluşursa uygulama ve işçiler durdurulup yükseltme öncesi alınan doğrulanmış yedek, **eski sürümün uygulama koduyla** bağımsız boş hedefe geri yüklenir. Doğrulanan dört hata senaryosu (`scripts/production-rollback-rehearsal.mjs`):

| Hata Senaryosu | Windows | Linux (WSL2) | Sonuç |
| --- | --- | --- | --- |
| Frozen lockfile uyuşmazlığı | Geçti | — | Migration öncesi reddedildi; eski kod, veri ve arayüz doğrulandı |
| `App.tsx` sözdizimi (derleme) hatası | Geçti | — | Derleme reddedildi; eski kod, veri ve arayüz doğrulandı |
| Geçersiz SQL migration hatası | Geçti | Geçti | Başarısız migration sonrası eski 17-migration yedek ve kod ile tam geri dönüş doğrulandı |
| Bozuk sunucu başlangıç dosyası | Geçti | — | Başlangıç reddedildi; eski sürüm ve yedekle tam geri dönüş doğrulandı |

Tüm geri dönüş senaryolarında yedi iş koleksiyonu, parola ve `sessionVersion` alanları, veli/ders/sonuç/anket ilişkileri, SQLite bütünlüğü ve ilk yönetici oturumu kayıpsız korundu. Performans, paket boyutu ve 80 öğrencilik sınav kapasite ölçümleri için [Performans ve Kapasite Raporuna](performans-ve-kapasite-raporu.md) bakın.
