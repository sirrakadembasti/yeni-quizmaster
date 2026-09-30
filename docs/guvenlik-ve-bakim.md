# Güvenlik ve veri bütünlüğü bakımı — 30 Eylül 2026

React/Vite, Express, Prisma/SQLite, Socket.IO ve e-posta outbox mimarisi korunmuştur.

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

- SMTP teslimi en az bir kez yaklaşımıdır. SMTP kabulü ile DB durum kaydı arasında süreç kapanırsa veya gönderim lease süresini aşarsa yinelenen e-posta mümkündür.
- SQLite, dosya tabanlı oturum ve bellekte rate-limit tek sunucu düzenini korur. Birden fazla instance için merkezi oturum/limit deposu ve PostgreSQL geçişi ayrı işletim çalışmasıdır.
- MFA, e-posta doğrulama ve kayıt onay politikası yeni ürün akışlarıdır; eklenmemiştir.
- Büyük sonuç listelerinde pagination ve frontend paketinin bölünmesi ayrı performans çalışması olarak kalır. Derleme büyük paket uyarısını korur.
- Sıfır bilinen bağımlılık uyarısı tüm olası açıkların kapalı olduğu anlamına gelmez. Origin listesi, HTTPS, gizli anahtarlar ve yedek geri yükleme işletimde doğrulanmalıdır.
- Çıkış teslim edilmemiş yerel cevapları da siler. Çevrimdışı kullanıcılar bağlantı geldiğinde teslimi tamamlamadan çıkış yapmamalıdır.
