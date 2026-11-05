# AI yönetimi: yükseltme ve yerel devreye alma

> 16 Ekim güncel durum: eklemeli AIUsage migration'ıyla toplam 25 migration uygulanmıştır. [Son yedekli geçiş ve veri koruma kaydı](2026-10-15-ai-usage-results.md). Bu belge ilk 14 → 24 geçişinin kanıtını korur.

15 Ekim 2026. Kullanıcı, ayrı kurulumda prova sonrasında yedek alınarak mevcut yerel sisteme uygulanmasını açıkça onayladı. Bu işlem önceki geliştirme raporundaki “canlı DB değiştirilmedi” aşamasından sonradır.

## Prova

Mevcut kurulumun 24 migration'ın yalnız 14'ünü içerdiği tespit edildi. Önce 22 → 24, ardından gerçek eski sürümle eşleşen **14 → 24** geçişi ayrı sentetik kurulumlarda Prisma CLI `migrate deploy` ve `migrate status` ile doğrulandı. Son koşuda yapay admin, soru, sınav, cevap ve 100 puanlık sonuç korundu; integrity `ok`, FK ihlali 0. Gerçek kullanıcı verisi provaya kopyalanmadı.

Araç: `scripts/ai-upgrade-rehearsal.mjs`. Son özel kanıt: `server/data/quizmaster-test-ai-upgrade-bwRs8l/result.json`.

## Mevcut kurulum

- İşlem öncesi bu projeye ait çalışan uygulama/worker veya 5000 portunda dinleyici bulunmadı.
- Native bakım komutuyla `server/backups/before-ai-management-20261015` doğrulanmış yedeği alındı. 7 dosyanın boyut ve SHA-256 eşleşmeleri ayrıca kontrol edildi. Yedek özel yapılandırma içerir; Git'e eklenmez.
- Mevcut 21 tablonun eski sütunları üzerinden satır içerik özetleri alındı. Migration kaynak checksum'ları mevcut uygulanmış geçmişle eşleşti.
- Bekleyen 10 migration uygulandı: 8 eski akademik arşiv/altyapı migration'ı, `20261014090000_notification_revision` ve `20261015000100_ai_management`.
- Prisma status: **Database schema is up to date**, 24 migration. Eski 21 tablonun kayıtları değişmedi; yalnız migration geçmişine yeni kayıtlar eklendi. Integrity `ok`, FK ihlali 0. Mevcut kullanıcı/parola yeniden oluşturulmadı veya değiştirilmedi.
- Uygulama başladıktan sonra eski tablo kayıtlarının tekrar karşılaştırılması da geçti. Yeni AI profil listesi başlangıçta boş; gerçek sağlayıcı/anahtar eklenmedi, ücretli model çağrısı yapılmadı.

## Gerçek üretim başlangıcı

İlk başlatmada kökteki `dist/index.cjs`, yalnız `server/node_modules` içinde kurulu external Prisma istemcisini bulamadı. Sunucu build'i `scripts/build-server.mjs` üzerinden, external bağımlılıkları taşınabilir biçimde `server/package.json` konumundan çözecek şekilde düzeltildi. Native bağımlılıklar bundle içine gömülmedi. Geçici paket başka klasöre taşınıp farklı çalışma dizininden başlatılarak regresyon testi **1/1 geçti**. Standart server build yeniden geçti; standart server+client build de bu işlemde başarılıydı.

Onarılan üretim uygulaması gizli arka plan süreci olarak mevcut ayarlarla `http://127.0.0.1:5000` adresinde başlatıldı. Gerçek HTTP kontrolü:

| Yol | Durum |
|---|---:|
| `/` | 200 |
| `/ai-management` | 200 |
| `/api/csrf-token` | 200 |
| `/api/auth/me` (oturumsuz) | 401 |
| `/api/admin/ai/profiles` (oturumsuz) | 401 |
| `/api/ai/models` (oturumsuz) | 401 |

Bu HTML/erişim kontrolü mevcut admin parolasıyla tarayıcı girişi veya gerçek sağlayıcı kabulü değildir. Admin normal hesabıyla giriş yapıp **AI Yönetimi** üzerinden model profili eklemeli, test etmeli ve öğretmenlere açmalıdır. İşlem Windows hizmeti veya otomatik açılış kaydı oluşturmadı; mevcut çalıştırma komutu korunur.

Özel denetim ve süreç kayıtları `server/backups/ai-management-upgrade-evidence-20261015` altındadır; doğrulanmış yedek manifestinin dışında tutulur. Kaynaklar ve kullanıcının iki kişisel istemci dosyası korunmuştur; commit/push yapılmadı. Canlı DB'nin dosya hash'i şema yükseltmesi nedeniyle doğal olarak değişmiştir; veri koruması eski sütunların satır özetleriyle doğrulanmıştır.

Geri dönüş gerekirse uygulama ve worker'ları durdurun; mevcut yedeği bağımsız boş hedefe aynı eski kaynak sürümüyle geri yükleyin. Çalışan DB üzerine dosya kopyalamayın. [Bakım/geri dönüş](production-maintenance.md), [AI kullanımı](ai-management.md).
