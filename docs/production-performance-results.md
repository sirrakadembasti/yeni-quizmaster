# Üretim performansı ve başlangıç paketi ölçümü

14 Ekim 2026 ölçümü, 8 GiB RAM'li ortak Windows/WSL makinesinde Node 22.23.2 ile yapıldı. Git `acfe47c0aa30b91843a4bc47cf94dd8e812f0c04` dışa aktarımı ve yalnız bu görevin değişiklikleri kullanıldı. Kullanıcının iki korunmuş frontend dosyasındaki çalışma alanı değişiklikleri ölçüme taşınmadı. Bağımsız kurulum mevcut pnpm paket deposunu kullandı; bağımsız Prisma istemcisi üretildi. Bütün ağır işler sırayla çalıştırıldı.

Canlı veritabanı sorgulanmadı veya kopyalanmadı. Yeni, sahipliği doğrulanmış veritabanına gerçek 22 migration uygulandı. Sentetik veri 1.311 kullanıcı (1 yönetici, 60 öğretmen, 1.000 öğrenci, 250 veli), 40 sınıf, 6 ders, 240 öğretmen görevlendirmesi, 1.000 veli bağlantısı, 121 sınav/anket, 842 soru, 8.000 sınav sonucu, 1.000 anket katılımı, 5.000 cevap, 100 soru bankası kaydı ve 1 duyurudan oluştu: **17.661 iş kaydı**. İlişkiler ve 8.000 sonucun 75 puan/6 doğru/8 soru değerleri DB üzerinden doğrulandı.

## Başlangıç ve toplam dağıtım

Her iki Vite üretim build'i aynı bağımlılık, yapılandırma ve public shell manifest eklentisiyle `--manifest` kullanılarak ölçüldü. Baseline için değişen beş uygulama dosyası Git sürümüne döndürüldü; ardından son kaynaklar eksiksiz geri yüklendi. Başlangıç ölçüsü giriş modülü ve bütün **statik** import kapanışıdır; dinamik importlar bu ölçüye katılmaz. Toplam JS bütün dağıtım `.js/.mjs/.cjs` dosyalarını, public `sw.js` dahil, dosya yolu başına bir kez sayar. Gzip değerleri dosya başına sıkıştırma toplamıdır.

| Ölçü | Önce, byte | Sonra, byte |
|---|---:|---:|
| Başlangıç statik JS | 1.500.465 | 779.458 |
| Başlangıç statik JS gzip | 412.368 | 233.509 |
| Toplam dağıtım JS | 1.501.875 | 1.520.844 |
| Toplam dağıtım JS gzip | 412.949 | 449.314 |
| Public worker JS | 1.410 | 4.097 |
| Bütün dağıtım CSS | 179.976 | 179.976 |
| Bütün dağıtım CSS gzip | 27.389 | 27.389 |

Başlangıç gzip **%43,37 azaldı**; %25 hedefi geçti. Eager giriş 779 KB kaldığı için Vite büyük chunk uyarısı devam eder. Toplam dağıtımın ve toplam dosya başına gzip'in artışı tabloda korunmuştur. Sayfaların ertelenmesi başlangıç statik import kapanışını küçültür; SW hazırlığı dahil gerçek ilk ziyaret ağ transfer byte'ları ölçülmedi. `Vary: Origin` farkı nedeniyle credential-free worker hazırlığı aynı public dosyaları ayrıca indirebilir. Bütün sayfalar açıldığında toplam indirme büyüklüğünü küçültme iddiası yoktur. En büyük ertelenen parça Recharts ortak parçasıdır: 383.867 byte/105.971 gzip. Yönetim parçası 58.097/11.504, anket sonuçları 42.306/12.434, sınav oluşturma 32.368/10.447, ayarlar 24.451/6.081, sonuçlar 17.623/5.157 ve arşiv 15.310/5.184 byte/gzip'dir.

Gerçek Chromium login ilk ziyaretinde, SW'nin arka plan hazırlığı dahil, rapor/Recharts parçalarının indirilmediği doğrulandı. Public/auth/reset ve öğrencinin sınav/sonuç akışı eager kaldı. Diğer korumalı ağır sayfalar yetki kontrolünden sonra lazy açılır. Yerel yükleme durumu, erişilebilir hata, ana sayfaya dönüş ve kullanıcının başlattığı tam yenileme kurtarması çalıştı.

## Gerçek HTTP yükü

Aynı sentetik veri ve üretim ayarlarında 2/8/20 aktör, aktör başına 30 seri istek gönderdi. Okumalar yönetici/öğretmen/öğrenci/veli uçlarını, yazımlar gerçek CSRF ve session ile `PATCH /api/notifications/preferences` boolean atamasını kullandı. Yazıcılar tek aktör içinde çakışmaz; aktörler eşzamanlıdır. Oturum açma hazırlığı ölçülen istek aralığının dışındadır. İstek süresi sınırı 30 saniyedir; süre aşımı başarı sayılmadı.

| Kaynak | Aktör/istek | p50 ms | p95 ms | p99 ms | En yüksek ms | İstek aralığı s | İstek/s | Hata |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Önce, aynı fixture devamı | 2/60 | 41,73 | 1.522,99 | 3.992,04 | 3.992,04 | 11,23 | 5,35 | 0 |
| Önce, aynı fixture devamı | 8/240 | 140,01 | 2.655,33 | 6.466,14 | 6.577,64 | 20,64 | 11,63 | 2 HTTP 500 |
| Önce, aynı fixture devamı | 20/600 | 345,13 | 7.860,35 | 11.105,49 | 15.468,85 | 55,15 | 10,88 | 7 HTTP 500 |
| Sonra, atomik tekrar | 2/60 | 46,89 | 2.290,21 | 3.817,86 | 3.817,86 | 14,17 | 4,23 | 0 |
| Sonra, atomik tekrar | 8/240 | 169,54 | 5.072,93 | 6.407,14 | 7.186,42 | 25,00 | 9,60 | 0 |
| Sonra, atomik tekrar | 20/600 | 2.908,80 | 20.064,52 | 30.000,78 | 30.003,12 | 168,07 | 3,57 | 10 istemci süre aşımı |

Baseline HTTP 500'leri tercih yazımında gerçek Prisma `P1008` hatalarıydı. İlk standalone baseline 2 aktör denemesi 60/60 başarılıydı (p95 1.540,67 ms, 5,59 istek/s); aynı ilk denemenin 8 aktör bölümünde ayrıca 3 HTTP 500 görüldü; aynı fixture devamındaki 2 hata bunun yerine geçirilmez. Tek boolean atamasına interaktif transaction ekleyen ara çözüm 8 aktörde 240 saniyelik faz sınırına ulaştı ve `P2028/P1008` gözlendi; bu başarısız deney korunur. Son çözüm yalnız bu atomik atamayı en fazla dört kez, bilinen geçici hatalarda ve toplam 300 ms ek beklemeyle tekrarlar. Genel transaction yardımcısı değiştirilmedi. Retry tüketilmesi ve diğer hatalar başarısız kalır.

Son 2/8 seviyelerinin HTTP cevapları ve bütün yazıcıların son DB değerleri eşleşti; kimlik/rol/sessionVersion alanları değişmedi. Son 20 seviyesinin **590 HTTP 200 + 10 timeout** sonucu başarısızdır. Timeout'ların 8'i tercih, 1'i öğrenci sonuçları, 1'i dashboard isteğindedir. Sahip olunan süreçler durduktan sonra bir aktörün DB değeri son başarılı HTTP onayına uymadı; onaylanmamış geç commit olasılığı kabul sınırıdır. Bu hata, sonraki DB değerinin mevcut olmasıyla başarılı sayılmaz.

20 aktörde uç bazlı p95 süreleri tercih yazımında 20.167 ms, dashboard'da 27.249 ms, yönetici sonuç listesinde 13.944 ms, öğrenci sonuçlarında 13.904 ms idi. Yönetici sonuç API'si sayfasız bütün sonuçları döndürür; öğretmen dashboard'u bazı sorguları sırayla yapar. Bu gözlemler tek başına baskın neden kanıtı değildir. Timeout/queue/pagination sözleşmesi değiştirilmedi. Son loglarda Prisma hata kodu gözlenmemesi, retry sırasında hiç geçici kilit yaşanmadığını kanıtlamaz.

Bu kapalı çevrim ölçümü üretim kapasitesi veya SLA garantisi değildir. 20 aktör seviyesinde eşdeğer donanım üzerinde gecikme/timeout ve büyük sonuç listesi maliyeti incelenmeden sorunsuz kapasite iddiası yapılmamalıdır.

## Capture, finalization ve gerçek legacy warm

UI kabulü kapanıştan önce yürütüldü. Altı UI denemesinin sonucu eklendikten sonra yıllık snapshot **17.667 satır** içerdi. Gerçek kapanış HTTP isteği, gerçek capture ve worker, Chromium PDF/ZIP üretimi/doğrulaması ve DB finalization kullanıldı. Tamamlanmış ZIP 23.572.124 byte, manifest 13 payload girdisi ve dört gerçek Skia/Chromium PDF içerir. Dosya byte uzunlukları/SHA ve ZIP SHA doğrulandı.

| Faz | Süre ms | Runner CPU ms | Runner en yüksek RSS byte |
|---|---:|---:|---:|
| Capture | 4.226 | 4.646,31 | 313.131.008 |
| Gerçek PDF/ZIP | 20.170 | 6.151,61 | 388.235.264 |
| Finalization | 1.031 | 1.064,83 | 380.911.616 |
| Yeni sürüm alanında legacy warm | 4.191 | 4.616,51 | 428.494.848 |

Bu ilk sürüm alanı warm ölçümü OS/disk cache'inin cold olduğu anlamına gelmez; capture sonrasında aynı DB üzerinde ölçülmüştür. Yeni capture'ın hazır projection fast path'i ayrıca doğrulandı; legacy warm ölçümü olarak sayılmadı. Legacy warm, gerçekten tamamlanmış değişmez snapshot üzerinde boş ve yeni bir projection sürüm alanında çalıştı. Kaynak/triggers/mevcut projection silinmedi. Gerçek 71 kaynak sayfası, en fazla 256 satır/sayfa ve 5 commit, en fazla 4.096 satır/commit kullanıldı. Kaynak/projection/readiness sayıları 17.667, projection `sourceJson` kaynakla birebir ve sıralı kaynak SHA warm/yazıcı sonrası aynı kaldı. 100 satırlık gerçek history sayfası toplam 8.006 sonucu gösterdi.

Ayrı süreçte bir gerçek HTTP yazıcısı capture/finalization/warm öncesi, sırasında ve sonrasında çalıştı. **50/50 HTTP 200**, p50 34,47/p95 3.986,71/p99-en yüksek 4.863,58 ms; DB son değeri ve yazıcı kimliği doğrulandı. Zaman aralığıyla kesişen istek sayıları capture 1, finalization 1, warm 1; capture öncesi 3 ve warm sonrası 3 idi. SQLite yazıcı kilidi altında bir isteğin bekleyip faz sonrasında tamamlanması bu overlap tanımına dahildir.

Beklenen annual fence `423/ANNUAL_CAPTURE_FROZEN`, tarihî yazma `403` ve canlı okuma `409` retleri ayrı kontrollü kontrollerdir; yükün beklenmeyen hatalarına katılmaz. Tarihî salt okunur UI, yenileme, aktif yıl ve tamamlanmış yıla tekrar seçim gerçek Chromium'da geçti. Önceki 50.000 satır kanıtı [önceki doğrulama](academic-archive-review/verification.md) kapsamındadır; burada tekrar çalıştırılmış yeni yük ölçümü değildir.

## Offline ve güvenlik kabulü

İlk üretim RED, HTML-only eski SW ile daha önce açılmamış sınavın offline JS ve görselinin gelmediğini gösterdi. Yeni shell asset manifest yalnız girişin statik JS/CSS kapanışını hazırlar. Cevap/PII/API/upload verileri public SW cache'e yazılmaz. Gerçek ikinci RED, CORS `Vary: Origin` ile public precache ve module/CSS isteği eşleşmesini bozdu. Gerçek worker isteğinde normal match=false/ignoreVary=true kanıtlandı; yalnız doğrulanmış aynı origin/base public hashed asset eşleşmesi düzeltildi.

Root ve `/school/` üretim Chromium kabulünde dört rol allow/deny, API yetkisi, doğrudan URL/refresh/back/forward, public returnUrl, alias, 404 ve eksik lazy chunk'ın açık kurtarması doğrulandı. Fresh profil sınavı önce hazırlayıp hiç ziyaret edilmemiş quiz URL'sini offline açtı ve yeniledi; özel oturumdaki 240×160 kırmızı/mavi soru şeklinin doğal boyutu ve pikselleri doğrulandı. Cevap/sürüm/teslim kuyruğu yenilemeden sonra korundu; reconnect tam bir doğru sonuç (100 puan, 2/2) oluşturdu, ikinci submit idempotent kaldı. Online start sonrası özel görsel kopyası korundu.

Kapanış sonrasında dört rolün gerçek boş aktif yıl ekranları ayrıca yüklenme tamamlandıktan ve sayfa yenilendikten sonra doğrulandı; alert ve page error görülmedi. Root reconnect ekranındaki 14:53 değeri, önceki RED denemesinde açılan aynı sınav katılımının başlangıcından tamamlanmasına kadar geçen 893 saniyedir; başarılı offline kabul komutunun 21,5 saniyelik süresi değildir. Bağımsız base katılımı 4 saniyedir. Bu ayrım yalnız sahip olunan DB'deki iki katılımın zaman alanlarıyla doğrulandı.

Gerçek storage quota, shell MIME/HTML200 eksik asset, hazırlama sırasında logout/unmount ve eski worker yükseltmesi kontrolleri geçti. Başarısız hazırlık Ready göstermez; önceki kuyruk/cached shell korunur. Başka base ve ilgisiz cache korunur. Görseller yalnız aynı-origin desteklenen upload türlerinden, MIME/imza/gerçek byte/deadline/toplam özel oturum bütçesi kontrolleriyle kullanıcı oturumuna kopyalanır. Yabancı origin/API/SVG/redirect kabul edilmez.

CPU/RSS kapsamı ölçüme göre ayrıdır: HTTP backend sayacı sahip olunan API Node süreç grubunu ve aynı PID'de çalışan native Prisma kütüphanesini içerir; bağımsız generator ve Chromium dışındadır. Capture tablosu acceptance runner Node + native Prisma'yı içerir; ayrı API/browser/generator ve PDF üreten Chromium alt süreçleri dışındadır. Son 20 aktör koşusunda backend grubunda 122,94 CPU saniyesi ve 646.332.416 byte en yüksek RSS görüldü; bunlar bütün makinenin tüketimi değildir.

İlk timeout koşusunun anlık port bind kanıtı başarısız kaldı; sonraki bağımsız kontrolde TCP kaydı kalmadığı ve portun bind edilebildiği doğrulanmadan yeni servis açılmadı. Süreçler kernel kimliği/sahiplik üzerinden kapatıldı; yabancı süreçlere dokunulmadı. Üç korunmuş dosyanın SHA değerleri kabul fazlarında değişmedi. Yanlış main-helper denemesi kabul dışıdır: açık datasource yeni owned DB idi, live SQL/copy/server start olmadı; Prisma otomatik ortam lookup'ının dış `.env` okumuş olabileceği geçmiş belirsizlik korunur. Son runner guard'ı Prisma import/constructor öncesinde kurar; sentetik env negatifinde okuma engeli doğrulandı.

Tam frontend 40 dosya/295 test ve normal backend 53 dosya/422 test geçti; client/server typecheck ve 11 guard/env/API/SW kontrolü geçti. Son test deklarasyonu düzeltmeleri için ayrıca 3 dosya/23 test geçti. Bağımsız pypdf/PDFium ile dört gerçek PDF'nin 2.229 sayfası metin/yıl/pagecount açısından okundu; yalnız iki örnek sayfa (başlık ve soru şekilli tablo) render edilip görsel incelendi. Bütün sayfaların görsel incelemesi yapılmadı. Özel ham kanıtlar yalnız `.superpowers/sdd/2026-10-06-production-rehearsal-plan` altındaki görev alanındadır; log/env/cookie/kayıt içerikleri yayınlanmaz.
