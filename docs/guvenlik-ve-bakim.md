# Güvenlik ve veri bütünlüğü bakımı — 30 Eylül 2026

React/Vite, Express, Prisma/SQLite, Socket.IO ve e-posta outbox mimarisi korunmuştur.

15 Ekim kapasite sürümünde işlem yalıtımı, bildirim revizyonu, güvenilir sunucu teslim zamanı, ayrı salt okuma bağlantısı ve WAL/FULL sürücü doğrulaması eklendi. Canlı DB değiştirilmedi; yeni sürümün migration ve yedek/geri dönüş adımları [bakım belgesinde](uretim-ve-bakim-kilavuzu.md), 80 öğrencilik prova ve sınırları [sonuç raporunda](performans-ve-kapasite-raporu.md) açıklanır.

## Uygulanan düzeltmeler

| Alan | Düzeltilen davranış | Doğrulama |
| --- | --- | --- |
| Kullanıcı ilişkileri | Rol belirtilmeyen güncelleme öğretmen/veli bağlarını silmez. Gerçek rol değişimi ilişkileri transaction içinde temizler. | Gerçek SQLite regresyonları |
| Yetki sınırları | Veli bağlı öğrenci verisini veli API'sinden görür. Öğretmen taşımanın kaynak ve hedef sınıfına yetkili olmalıdır. Kaldırmada URL ile öğrencinin sınıfı eşleşir. | 403 ve sahiplik testleri |
| Sonuç gizliliği | Devam eden sınavın puanı/doğru sayısı öğrenciye verilmez. Sonuç ilişkisi öğrenci iletişim/kimlik doğrulama alanlarını taşımaz. | API regresyonları |
| Profil ve parola | Öğrenci profil değişikliği yönetim üzerinden yapılır. Kendi parolasını kullanıcı PATCH API'siyle değiştiren kişi mevcut parolasını doğrular. | Profil/parola testleri |
| Oturum ve socket | Parola/gerçek rol değişimi oturum sürümünü artırır. Eski HTTP/socket oturumları reddedilir. Socket her pakette ve 30 saniyede bir oturumu doğrular; çıkış bağlantıları kapatır. | Middleware/socket testleri |
| İçerik geçmişi | Katılım başlamış sınav/anket soruları değiştirilemez. Taslak kaydı soru UUID'lerini korur; yeni soruların geçici UI kimlikleri gönderilmez. Katılım sonrasında değişmeyen soru listesi no-op olarak kabul edilir, böylece başlık düzenleme çalışır. | Taslak/katılım regresyonları ve düzenleyici incelemesi |
| Eşzamanlı sınav | Başlatma mevcut sonucu kullanır. Cevaplar transaction içinde birleştirilir. Teslim tek kez notlandırılır; tekrar aynı sonucu döndürür. | Paralel başlatma/cevap/teslim testleri |
| Sınıf yükseltme | Hedefteki numaralar korunur, taşınan öğrencilere çakışmayan numaralar transaction içinde atanır. | Dolu hedef sınıf regresyonu |
| AI dış bağlantısı | HTTPS/genel IP zorunludur. Bütün DNS yanıtları doğrulanır ve bağlantı doğrulanan IP'ye sabitlenir. Yönlendirme, özel IPv4/IPv6, büyük yanıt ve zaman aşımı engellenir. 204/205 boş yanıtları güvenli işlenir. | DNS değiştirme/yönlendirme/IPv6/yanıt testleri |
| Ağ sınırları | Genel API/sınav eylemleri kullanıcı başına sınırlanır. Giriş/sıfırlama sınırı IP ve hesap/token özeti kullanır. CORS/socket origin izin listesiyle çalışır. | Kod incelemesi ve API testleri |
| Çevrimdışı sınav | Ağ/408/429/5xx yeniden denenebilir. Kalıcı istemci/yetki hatası teslim kuyruğunda döngü yaratmaz. Çıkış sınav önbelleğini temizler. Yerel yükleme yolları kayıtta kabul edilir ve görseller gösterilir. Karışık sıra oturum kimliğiyle sabit kalır. | HTTP sınıflandırma/önbellek/sıra testleri |
| E-posta kuyruğu | İşçi 5 dakikalık lease ile kayıt sahiplenir. Başarısız kayıt aynı turda tekrar alınmaz. Eski lease yeni işçinin durumunu ezemez. | Paralel sahiplenme/SMTP yeniden deneme testi |
| Bağımlılıklar | Yamalar/gerekli sürüm yükseltmeleri yapıldı. Kullanılmayan jsPDF/uuid ve Nodemailer'ın eski harici tip paketi kaldırıldı. tar/once güvenlik sürümleri pnpm override ile sabitlendi. | Audit/derleme/tip/test kontrolleri |

## Veritabanı ve mevcut kurulum

Migration 20260930093000_session_version_result_indexes yalnız User.sessionVersion, EmailQueue.processingUntil ve StudentResult indekslerini ekler. Kayıt silmez. Tarihsel mükerrer sonuçlar otomatik silinmez; yeni başlatma transaction içinde mevcut sonucu kullanır.

İkinci migration 20260930120000_nullable_survey_answers, Question.correctAnswer alanının şemada nullable olmasına rağmen migration geçmişinde NOT NULL kalmasını düzeltir. SQLite gereği Question tablosu bütün sütunlar/UUID'ler kopyalanarak yeniden oluşturulur; geçmiş soru ve SurveyAnswer ilişkileri korunur. Dolu örnek veri üzerinde kimlik/cevap korunumu ve foreign_key_check doğrulanmıştır.

Yerel veritabanı migration öncesi SQLite backup API'siyle server/backups/security-20260930/quiz-before-session-version.db dosyasına yedeklendi. Nullable düzeltmesi öncesi ayrıca server/backups/security-20260930/quiz-before-nullable-survey.db yedeği alınmıştır. Yedek kişisel veri içerebildiğinden Git'e eklenmez. Açık veritabanının tek dosyasını kopyalamak WAL durumunda tutarlı yedek garantisi vermez.

Mevcut kurulumlarda yedek sonrası pnpm install, pnpm --filter quiz-master-server db:deploy ve pnpm build çalıştırılır. Sunucu yeni derlemeyle yeniden başlatılır. Bu bakım uzak sunucuya dağıtım yapmaz.

## Doğrulama ve Graphify

Backend testleri canlı veritabanından bağımsız geçici SQLite üzerinde migration uygular; SMTP gönderimi taklit edilir. Test klasörü yalnız doğrulanan server/data sınırları içinde temizlenir. Kontroller:

    pnpm --filter quiz-master-server test
    pnpm --filter quiz-master-client exec vitest run
    pnpm -r type-check
    pnpm test:setup
    pnpm --filter quiz-master-server db:validate
    pnpm build
    pnpm audit

Canlı Gmail teslimi ve uzak üretim dağıtımı bu kontrollerde denenmez. Tam test turunda 128 backend, 39 frontend ve 14 kurulum testi geçti. Metadata/görsel ve anket şeması regresyonları bu son backend turuna dahildir. TypeScript, frontend/backend build ve Prisma schema kontrolü geçti; pnpm audit sıfır uyarı bildirdi. Migration sonrasında bütünlük, yabancı anahtarlar ve bütün iş verisi kayıt sayıları değişmeden doğrulandı.

Graphify gerçek CLI ile yerel AST üzerinden üretilir. Paylaşılan çıktılar graphify-out/graph.json, graph.html ve GRAPH_REPORT.md'dir. Manifest dosya özetleri ve HTML/JSON düğüm/kenar eşleşmesi denetlenir. built_at_commit üretim anındaki HEAD olduğundan yeni kodu tek başına kanıtlamaz. Markdown LLM semantiği ve Prisma/lockfile güvenlik analizi AST güncellemesinin kapsamı değildir. Bu ortamda SQL parser eklentisi bulunmadığından migration SQL içeriği de kod/test incelemesiyle ayrıca doğrulandı. Grafik güvenlik kanıtı değildir; kaynak ve regresyon testleri birlikte kullanılır.

## İşletim sınırları ve sonraki çalışmalar

12 Ekim arşiv kapanışında gerçek veritabanı/trigger, dosya bütünlüğü, salt okunur geçmiş ve kurtarma testleri tamamlandı; backend 412/412, frontend 272/272 ve ayrı hacim turu 74/74 geçti. Test dosyaları artık pristine migration şablonundan bağımsız veritabanı kopyaları kullanır; canlı DB bu kontrollere dahil değildir. İlk geçmiş hazırlığının izole 50k ölçümü 154,366 saniyedir; bu 12 Ekim turunda eşzamanlı yazıcı ölçülmedi. 14 Ekim izole provasında arşiv aşamaları sırasında bağımsız yazıcı 50/50 geçti; genel 20 aktör kapasitesi başarısız kaldı. Tam yedek/restore, yükseltme/geri dönüş ve başlangıç paketi küçültme [üretim provasında tamamlandı](uretim-ve-bakim-kilavuzu.md). [Kanıt ve başarısız eski denemeler](denetim-raporlari/akademik-arsiv-kabul-raporu.md).

### Akademik arşiv sınırı — 7 Ekim 2026

Yıllık capture, iş verilerini değişmez snapshot olarak yakalar. API koruması ve SQLite trigger'ları; kişi/sınıf/ders/atama, veli bağlantısı, duyuru, soru bankası, sınav/soru/sonuç/anket ve implicit ilişki yazmalarını yakalanmış yıl için sınırlar. Worker'ın terfi/mezuniyet ve yıl kapanış yazmaları yalnız doğrulanmış artifact, geçerli sahiplik/lease ve aynı son transaction içindeki exact eski/yeni satır izinleriyle yapılır. Tamamlanmış kaynak ve geçiş özeti değişmezdir. Bu, veritabanı dosyasını değiştirebilen sunucu yöneticisine karşı bir güvenlik sınırı olarak sunulmaz.

Geçmiş yıl bağlamında UI ve doğrudan API iş verisi mutasyonları reddedilir. Giriş/çıkış, parola kurtarma ve oturum bildirimi gibi açık işletim istisnaları korunur; bunlar geçmiş veriyi düzenleme izni vermez. Yeni giriş aktif dönemi alır; aynı oturumdaki sekmeler bağlam değişimini ortak oturumla doğrular, bekleyen değişiklik sırasında eski iş ekranı yazmaya açık bırakılmaz.

`20261009_archive_history_projection` migration'ı asıl immutable satırları değiştirmeyen, kaynak byte eşitliği ve tam satır sayısı doğrulanan sürümlü arama projeksiyonu ekler. Hazır projeksiyon yayın kaydı değişmezdir. Fingerprint uygulama düzeyinde hesaplanır; SQL trigger'ın türetilmiş arama metnini kriptografik olarak yeniden hesapladığı iddia edilmez. `20261010_archive_entity_lookup` yalnız lookup indeksi ekler; önceki yazma korumalarını kaldırmaz.

Arşiv ZIP indirmesi admin yetkisi ve parola onayı gerektirir. Yerel raster görseller, paket ve görsel özetleriyle doğrulanır; keyfi dosya yolu veya uzak URL üzerinden okunmaz. Görsel sunumu her istekte bütün ZIP özetini akışla kontrol eder; büyük pakette bunun IO maliyeti vardır. Gizli kimlik doğrulama ve sunucu ayarları akademik pakete dahil edilmez. [Dosya sözleşmesi](denetim-raporlari/akademik-arsiv-kabul-raporu.md) ve [güncel kabul kanıtları](denetim-raporlari/akademik-arsiv-kabul-raporu.md), eski 30 Eylül test sayılarından ayrı değerlendirilmelidir.

- SMTP teslimi en az bir kez yaklaşımıdır. SMTP kabulü ile DB durum kaydı arasında süreç kapanırsa veya gönderim lease süresini aşarsa yinelenen e-posta mümkündür.
- SQLite, dosya tabanlı oturum ve bellekte rate-limit tek sunucu düzenini korur. Birden fazla instance için merkezi oturum/limit deposu ve PostgreSQL geçişi ayrı işletim çalışmasıdır.
- MFA, e-posta doğrulama ve kayıt onay politikası yeni ürün akışlarıdır; eklenmemiştir.
- Büyük sonuç listelerinde sayfalama ve timeout sonrası tercih uzlaştırması açık kapasite işleridir. Ağır frontend sayfaları bölündü; başlangıç statik gzip %43,37 azaldı, büyük entry uyarısı korundu. [Son kapasite incelemesi](performans-ve-kapasite-raporu.md) açık işleri ayırır.
- Sıfır bilinen bağımlılık uyarısı tüm olası açıkların kapalı olduğu anlamına gelmez. Origin listesi, HTTPS, gizli anahtarlar ve yedek geri yükleme işletimde doğrulanmalıdır.
- Çıkış teslim edilmemiş yerel cevapları da siler. Çevrimdışı kullanıcılar bağlantı geldiğinde teslimi tamamlamadan çıkış yapmamalıdır.
- **Canlı Demo Vitrin (`domain/demo`) ve `/demo` Salt-Okunur Sınırı (5 Kasım 2026):** `APP_DEMO_MODE=true` (`server/data/demo.db`) ikinci kopyasında veya `/demo` ad alanında (`x-quizmaster-demo: 1`, `Referer: .../demo`, `req.session.isDemoSession`) çalışan oturumlarda `createDemoModeGuard` tüm veri değiştiren istekleri, yeni kullanıcı kaydını (`POST /api/auth/register`), parola sıfırlamayı (`POST /api/auth/forgot-password`, `POST /api/auth/reset-password`) ve 4 vitrin hesabı dışındaki e-postalarla girişi (`POST /api/auth/login`) `403 DEMO_MODE_READ_ONLY` ile reddeder. Küresel `secureJsonReplacer` gerçek kullanıcı `password` özetlerini yanıtlardan silmeye devam ederken, halka açık demo vitrin şifresi yalnız `/api/auth/demo-info` içinde `demoPassword` alanıyla sunulur.

## Üretim provası ve çevrimdışı hazırlama — 14 Ekim 2026

Yedek/geri yükleme, veri koruyan terminal/BAT/SH yükseltmesi ve başarısız yükseltmeden eski kod ile eski veriye dönüş için [bakım kılavuzu](uretim-ve-bakim-kilavuzu.md), [yükseltme kabulü](uretim-ve-bakim-kilavuzu.md) ve [kurtarma kabulü](uretim-ve-bakim-kilavuzu.md) birlikte kullanılmalıdır. Kurtarma bağımsız hedefe yapılır; otomatik rollback veya cache'siz kurulum iddiası yoktur.

Frontend'de ağır sayfalar rol kontrolünden sonra yüklenir. Public giriş/kurtarma ve öğrenci sınavının kritik sayfaları başlangıç paketinde kalır. Parça yüklenemezse kullanıcıya hata, yeniden yükleme ve ana sayfaya dönüş gösterilir. Başlangıç statik JavaScript paketinin küçülmesi toplam dağıtım boyutunun veya sunucu gecikmesinin aynı oranda azaldığı anlamına gelmez; SW hazırlığı dahil ilk ziyaretin gerçek ağ aktarımı ayrıca ölçülmedi. Ayrı ölçümler [performans raporunda](performans-ve-kapasite-raporu.md) tutulur.

Service worker yalnız aynı origin ve base altındaki doğrulanmış public uygulama dosyalarını saklar; API, kullanıcı verisi ve soru görselleri bu cache'e alınmaz. Genel CORS'un `Vary: Origin` başlığı modül isteğini credential-free precache isteğinden ayırdığı için yalnız bu public asset eşleşmesinde `ignoreVary` kullanılır; genel CORS ve özel veri politikası değiştirilmez. Soru görselinin izinli raster kopyası kullanıcıya ait mevcut offline sınav kaydında saklanır. Shell/görsel hazırlığı ve tam kaydın storage'dan geri okunması geçmeden hazır durumu yayımlanmaz. Kota, bozuk görsel veya iptal hata verir; çıkış/kullanıcı değişimi sonrası geciken hazırlama özel kaydı yeniden oluşturamaz. Yeni hazırlama bekleyen cevapları ve teslim kuyruğunu korur.

Bildirim sessize alma tercihi tek atomik boolean atamasıyla yazılır; yalnız geçici Prisma hataları en fazla dört denemeyle tekrar edilir. Diğer hatalar ve tükenen denemeler istemciye hata olarak döner. Bu dar düzeltme genel transaction politikasını değiştirmez. Yük altında süre aşımı başarılı kayıt onayı sayılmaz; istemci bağlantısı kesildikten sonra sunucudaki yazmanın tamamlanması mümkün olduğundan HTTP ve DB kanıtı ayrı değerlendirilir.

Performans ölçümleri sentetik veriler ve izole native Linux/WSL kurulumu içindir; internet trafiği, çok sunuculu kapasite veya canlı üretim garantisi değildir. Kullanıcının `client/src/lib/api.ts` ve `client/src/pages/server-setup.tsx` yerel değişiklikleri değiştirilmedi; izole kaynak kabulüne bu commit dışı düzenlemeler eklenmedi. Canlı DB yalnız dosya hash'iyle koruma kontrolüne dahildir.
