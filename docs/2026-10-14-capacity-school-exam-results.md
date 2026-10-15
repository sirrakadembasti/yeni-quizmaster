# Kapasite düzeltmeleri ve 80 öğrencilik sınav provası

## Kapsam ve koruma

İstek: HDD dışındaki darboğazları uygulamanın sınav, yetki, arşiv, rapor, dışa aktarma ve oturum davranışlarını koruyarak gidermek; dört sınıf ×20 öğrencilik, 20 sorulu, 30 dakika süreli tarih sınavını incelemek. Cihazlar Wi-Fi kullanıyor ve sorular görsel içeriyor.

Başlangıç dalı `codex/academic-archive-hardening-20261012`, commit `0a3bc1f01639d66b18558ed3b34f83f49bdae5db`. Kullanıcının mevcut değişiklikleri saklandı; inceleme/prova sırasında staging, commit, reset veya dal değişimi yapılmadı. Sonraki kullanıcı talimatıyla belgeler ve Graphify güncellenerek commit/push hazırlanır. `client/src/lib/api.ts`, `client/src/pages/server-setup.tsx` ve canlı `server/data/quiz.db` içerikleri SHA-256 ile korundu. Canlı DB üzerinde SQL, kopyalama, migration veya uygulama başlatma yoktur.

## Uygulanan yaklaşım

- Aynı SQLite dosyası ve Prisma modelleri korunur. Uygulama bağlantıları merkezi, sürümü doğrulanan SQLite 3.51.3 sürücüsünü kullanır; WAL, `synchronous=FULL`, yabancı anahtar kontrolü ve kısa kilit beklemesi uygulanır. Her Prisma istemcisinin tek bağlantısı vardır; arşiv istemcisi bağımsızlığını korur. Tarihler eski `unixepoch-ms` biçiminde saklanır.
- İlk açılışta `.env` yolu şema dizinine göre çözülür; eksik veya SQLite olmayan bir uygulama DB'si sessizce oluşturulmaz. Oturum DB'si eski `sid/expired/sess` şemasını, süreleri, logout ve touch davranışını korur.
- `User.notificationRevision` eklenir. Bildirim tercihi eski revizyonla yazılamaz; gecikmiş/tekrar denenmiş bir istek yeni seçimi ezemez. GET/PATCH gövdesi `{muted}` olarak kalır; ETag/If-Match ve belirsiz hata sonrası tekrar okuma eklenir. Ağ kopması çalışan SQL'i geri almaz; arayüz bunun sonucunu doğrular.
- Dashboard tüm kullanıcı/sınav/cevap listesini yüklemek yerine sayım ve ortalama sorguları çalıştırır; mevcut aktif yıl, rol, önizleme ve null/0 puan anlamları korunur.
- İstatistik sonuçları cevap JSON'u ve gereksiz sınav içeriği taşımayan projeksiyonla alınır. Sayfalar ve ekran tabloları sınırlanır; tüm nüfusun istatistik, Excel ve yazdırma kapsamı korunur. Eski API çağrıları ve tarihsel okuma adaptörü korunur.
- Bakım/yedek yolu da aynı yamalı SQLite sürücüsünü kullanır; kaynak salt okunur açılır, bağımsız DELETE biçiminde snapshot ve manifest doğrulaması yapılır.
- Sınavda gizlenen menünün 10 saniyelik bildirim sorgusu durdurulur. Böylece 80 öğrencinin 30 dakikada oluşturabileceği yaklaşık 14.400 gereksiz istek kaldırılır; gerçek bildirim dinleyicisi korunur.
- `rolling:false` oturumlarda küçük süre uzatmaları 60 saniye aralığıyla birleştirilir. SQL touch çağrısı devam eder, fakat gereksiz satır değişikliği ve disk senkronizasyonu azalır. Veritabanındaki kayan süre en fazla 60 saniye geriden gelir; tarayıcıya daha önce verilmiş çerezin geçerliliği kısaltılmaz. Oturum değişiklikleri, logout ve daha kısa son kullanma süresi hemen yazılır.
- Üretim paketi Prisma istemcisini dış bağımlılık olarak tutar; yeni motorun standart başlatma komutunda bulunması doğrulanır. HTTP okul ağı için CSP'nin HTTPS'e otomatik yükseltme yönergesi kapatılır; HTTPS kurulumunda korunur. Diğer güvenlik başlıkları korunur.
- Arşiv kapanışının tam değer kontrolü korunur. Prisma kütüphane motoru ham SQL tam sayılarını (BigInt dahil) sürücüye REAL olarak iletebildiği için tarih, boolean ve öğrenci numarası izin ifadelerinde açık `CAST(... AS INTEGER)` kullanılır. Genel sürücü/puan davranışı değiştirilmez; capture, rollback, lease ve yıl geçişi kontrolleri tekrar çalıştırılır.
- Cevap kaydında rota üzerinden yapılan üç tekrar okuma kaldırılır. Sahiplik, durum, süre ve soru üyeliği aynı atomik işlem içinde kontrol edilir; hata durumları aynı HTTP kodlarına eşlenir. İşlem yalnız soru kimliği ve cevap anahtarını, quiz için yalnız süre sınırını okur. 1.600 cevapta 4.800 tekrar servis okuması önlenir; kalıcı cevap/puan yazımı aynen korunur.
- Sonuç, dashboard ve diğer salt okuma yolları bağımsız salt okunur bağlantıya taşınır. WAL okuyucusu devam eden yazma işleminin yalnız son tamamlanmış durumunu görür; öğretmen sorguları cevap yazma kuyruğunda beklemez. İşlem içindeki okumalar aynı işlem bağlantısında kalır.
- Yeni sürücü entegrasyonunda, tek bağlantının bağımsız bir `create/update` çağrısını başka bir açık işleme dahil edebildiği regresyonla gösterildi: onaylanan satır diğer işlem geri alınınca kayboluyordu. Adapter kapısı bağımsız sorguları gerçek COMMIT/ROLLBACK tamamlanana kadar bekletir. COMMIT hatasında önce rollback yapılır; güvenli kapatılamayan bağlantı sonraki yazmaları kabul etmez. Bu, eski üretim sürücüsünün aynı kusuru taşıdığı iddiası değildir.
- Sınav cevabı/tesliminde süre kontrolü, HTTP gövdesi tamamlandıktan sonra fakat oturum ve veritabanı kuyruklarından önce kaydedilen güvenilir sunucu zamanına dayanır. Süresi içinde ulaşan istek sunucudaki bekleme yüzünden geç sayılmaz; süresi dolduktan sonra ulaşan istek kabul edilmez. İstemci saatine veya ek süreye dayanılmaz.
- Teslim yanıtı, kalıcı notlandırma tamamlanınca gönderilir. Öğretmen bildirimi aynı handler'ın mevcut hata kontrollü akışında yazılıp sonra socket ile yayımlanır; öğrenci HTTP yanıtı bu ek yazmayı beklemez. Bildirim rolü/mesajı, tekrar teslimde çoğalmama ve bildirim hatasının notu değiştirmemesi korunur. Son prova tüm 82 bildirim kaydını ayrıca doğrular.
- HTTP sunucusunun boş bağlantı süresi 65 saniye, başlık süresi 75 saniye olarak belirlenir. Aktif istek süreleri ve Node'un mevcut bağlantı tamponu değişmez. Yoğun yazma sırasında eski 5+1 saniyelik sınır yakınında görülen bağlantı sıfırlanmalarını azaltmak için uygulanır; bunun tek neden olduğu socket izleme olmadan kesinleştirilmez.
- SQLite adapterinin yalnız `DriverAdapterError / SocketTimeout / SQLITE_BUSY` eşleşmesi, Prisma 6 kütüphane motorunun tanıdığı `TransactionWriteConflict` biçimine çevrilir. Diğer hata türleri değişmez, özgün SQLite kodu/mesajı korunur. Bildirim yazımı mevcut sınırlı işlem yeniden denemesini kullanır; commit tamamlanmadan socket yayını yapılmaz.

SQLite WAL aynı anda okuma/yazmaya izin verir, fakat tek dosyada aynı anda bir yazıcı vardır. Bu yüzden doğru yapılandırma kapasiteyi artırır; sınırsız paralel yazma sağlamaz. Kaynak: [SQLite WAL belgesi](https://www.sqlite.org/wal.html).

## Prova yöntemi

`scripts/school-exam-rehearsal.mjs` hiçbir DB/yol argümanı kabul etmez. Yeni, sahipliği doğrulanan sentetik DB'ye gerçek migration'lar uygulanır; 1.000 öğrenci, 8.000 geçmiş sonuç ve diğer okul kayıtları üzerine yeni 80 öğrencilik sınav eklenir. Dört sınıftan ayrı ayrı 20 öğrenci gerçek session/CSRF ile bağlanır.

80 başlangıç aynı anda; her soru için 80 cevap ve dört öğretmen gözlemi aynı anda; 80 teslim aynı anda; ardından 80 öğrenci sonuç okuması çalıştırılır. 20 görsel her cihaz için oturum çereziyle indirilir; böylece tarayıcıdaki oturum touch maliyeti de ölçüme dahildir. Hızlı cevap değişimi, dış sınıf erişimi, cevap anahtarının gizliliği, tekrar teslim, süre öncesi/sonrası teslim ve 600 tercih yazımı ayrıca doğrulanır. Cevap/puan kayıtları, SQLite integrity/FK, korunmuş hash'ler ve süreç/port temizliği kontrol edilir.

Bu **hızlandırılmış patlama testidir**, 30 dakika boyunca sürmüş bir soak testi değildir. Sınavın gerçek süre alanı 30 dakikadır; süre sınırı ayrıca gerçek sunucu saati ve sentetik geçmiş başlangıç zamanıyla kontrol edilir. Ağ ölçümü **loopback** üzerindedir; okul Wi-Fi erişim noktasını ölçmez. Kullanıcı cihazı/tarayıcı grafik çizim süresi bu API provasının kapsamı dışındadır.

Her aktör ayrı HTTP/1 bağlantı havuzuna sahiptir (en fazla altı soket); API ve görseller aynı aktör havuzunu kullanır. Tekrar deneme yoktur. Öğrenci, diğer 79 teslimi beklemeden kendi teslim yanıtından iki saniye sonra sonuç ayrıntısını okur; bu gerçek arayüz akışıdır. Ek 80 kişilik sonuç listesi/ayrıntı bariyeri ayrıca sentetik stres olarak ölçülür. Aktör havuzları son kontrol sırasında kapatılır.

Önceki `t0wRWV` provası başarısız kanıt olarak korunur: 80 teslim başarılı olmasına karşın ortak global fetch havuzuyla yapılan sonraki 80 sonuç listesi isteğinden 20'si `ECONNRESET` aldı (yaklaşık 5,82 saniye). Backend kapanmadı ve 30 saniyelik istemci sınırına ulaşılmadı. Bu hatalar yalnız aracın yapaylığına bağlanmaz; final prova hem bağımsız aktör havuzlarını hem sunucu bağlantı düzenlemesini kullanır. Bu iki değişikliğin etkileri ayrı ayrı izole edilmiş kapasite ölçümü değildir.

Sonraki `LilwKa` koşusunda 1.600 cevap, 80 teslim/sonuç, 600 tercih yazımı ve gerçek tarayıcı kontrolleri geçti; bağlantı sıfırlanması olmadı. Ancak 82 öğretmen bildiriminden 81'i bulunduğundan koşu başarısızdır. Log ve iki bağlantılı native regresyon, `SQLITE_BUSY` hatasının adapterden `SocketTimeout` olarak geldiğini ve kütüphane motorunun bunu `P2010 / InvalidArg` biçiminde reddettiğini doğruladı. Dar hata uyumluluğu düzeltildi; bildirim yazımı `P2034` için mevcut sınırlı işlem yeniden denemesine alındı. Ayrıca kontrol kaydı hazırlayan ikinci sentetik yazıcı, önceki kontrolün bildirimini bekler; bu hazırlık gerçek 80 öğrencilik akışın dışındadır. Bağımsız yazıcı çakışması ayrı native testte korunur.

Oturumlar patlama aşamasından önce açılır; eşzamanlı 80 giriş/parola doğrulama maliyeti ölçülmez. Kullanılan adapter arayüzü Prisma `maxWait` seçeneğini bağlantı kapısına iletmez; bu seçenek kapıda bekleyen başlangıcın o sürede iptal edileceği garantisi olarak kullanılamaz. Prova HTTP istemcisi 30 saniyelik ölçüm sınırı kullanır; uygulamanın korunmuş `apiFetch` yardımcısında böyle bir dahili süre sınırı yoktur. Ağ bağlantısının kopması, başlamış kalıcı bir yazmayı otomatik geri almaz.

## Doğrulama

- Sunucu ve istemci `tsc --noEmit`: başarılı. Standart `pnpm run build`: başarılı. Vite'ın büyük ana chunk uyarısı sürer; 781,70 KB ham ana JS'nin gzip tahmini 234,24 KB'dır. Bu tahmin, doğrudan Express sunucusunda gzip'in etkin olduğu anlamına gelmez.
- Geniş sunucu koşusu: 62 dosyada 490 test; 469 geçti, 21 başarısız çıktı. Eski fixture sürücü çözümlemesi ve pnpm test ortamı düzeltildikten sonra ilgili migration/kurulum kontrolleri geçti. Arşiv sürücü uyumsuzluğu gerçek hata olarak araştırılıp SQL CAST ile giderildi. Son gerçek arşiv/SQLite/oturum koşusu: **83/83 başarılı**. 50.000 sonuçluk ayrı hacim benchmark'ı bu turda çalıştırılmadı.
- Geniş istemci koşusu: 43 dosyada 319 test; 318 geçti, yeni tercih API'sine uyarlanmamış bir test mock'u başarısızdı. Mock güncellendi; son tercih, hesap değişimi, sayfadan ayrılma ve bildirim/arayüz koşusu **37/37 başarılı**. Sonuç filtreleme/sayfalama/Excel/yazdırma birim kontrolleri geniş koşuda geçti.
- Kesinti sonrası istemci tam tür kontrolü tekrar geçti. Tercih yardımcısı, ayarlar, hesap/ekran değişimi ve yönetici envanteri kontrolleri parent tarafından yeniden çalıştırıldı: **37/37**, dört dosya, süreç çıkışı 0. İlgili kaynakların `git diff --check` kontrolü geçti; kullanıcıya ait korunan dosyalarda temizlik veya staging yapılmadı.
- Bakım ve prova koruma kontrolleri: **6/6 başarılı**; özel sentetik WAL snapshot'ı, bütünlük/bozulma, süreç/port ve kaçan yol kontrolleri.
- Son cevap kaydı değişikliği: mock rota kontrollerinde RED 7 başarısız → GREEN **10/10**; parent tarafından tekrar **10/10**. Son sunucu tür kontrolü ve standart sunucu derlemesi başarılı. Kod incelemesinde yeni bir yetki/süre/puanlama regresyonu bulunmadı.
- Son izolasyon/okuyucu/sürücü koşusu parent tarafından **27/27** tekrar doğrulandı. Bağımsız create/update başka işlemin rollback'iyle kaybolmaz; ertelenmiş FK nedeniyle COMMIT başarısız olursa sonraki yazmadan önce rollback yapılır; aktif işlem timeout'u kapıyı bırakır ve geç callback sonraki kaydı ezemez.
- Kesinti sonrası SQLite kilit uyumluluğu ve bildirim yeniden denemesi dahil parent native koşusu **29/29** geçti. İki bağlantı ile gerçek kilit `P2034` üretir; kilit kalkınca bağlantı tekrar kullanılabilir. Geçici kilitte bildirim yeniden denenir ve tam bir satır kalır. Son tam sunucu tür kontrolü ve standart sunucu derlemesi başarılı.
- Son sürücü/hata uyumluluğuyla gerçek arşiv işçisi entegrasyonu ve arşiv işçisi birimleri parent tarafından yeniden çalıştırıldı: **64/64**, iki dosya, süreç çıkışı 0. İzole migration/test dizini kapanışta kaldırıldı.
- Güvenilir HTTP zaman damgası ve native sınav süresi koşusu parent tarafından **23/23** tekrar doğrulandı. Süresinde ulaşan isteğin kuyrukta süreyi aşması, sınır anı/sonrasında gerçekten ulaşan istek ve sahiplik kontrolü kapsanır. Oturumlu görsel prova istemcisi **1/1** doğrulandı.
- Teslim/bildirim sırası için RED 1 başarısız → GREEN **26/26**, parent tarafından tekrar **26/26**. Gerçek HTTP istemcisi, bekleyen bildirim Promise'i çözülmeden 200 alır; sonra kalıcı kayıt→socket yayını, hata kontrolü ve tekrar teslimde çoğalmama doğrulanır. Son tam sunucu tür kontrolü ve standart sunucu derlemesi başarılı.
- HTTP boş bağlantı kontrolü RED 2 başarısız → GREEN **2/2**, parent tekrar **2/2**; 6,25 saniye sonra aynı soket korunur. Bağımsız aktör havuzu/çerezli görsel/redirect tekrar denemesiz ret kontrolleri parent **3/3**. Son tam sunucu tür kontrolü ve standart sunucu derlemesi başarılı.
- Son fabrika tip düzenlemesinden sonra normal stack ile tam sunucu tür kontrolü ve standart üretim derlemesi başarılı. Windows sandboxının bağımlılık deklarasyonlarını eksik görmesi nedeniyle bu doğrulama normal dosya erişimiyle yapıldı; compiler stack boyutu artırılmadı. Sınavın `timeTaken` alanı önceki gibi işlem tamamlanma zamanını kullanır; sunucu kuyruğu bu gösterimden çıkarılmış değildir.
- Son 80 öğrenci kabul koşusu **başarılı**: `server/data/quizmaster-test-academic-performance-7CGFKi/proof.json`, `completed:true`, süreç çıkışı 0. Ölçülen **4.334 istekte 0 hata**; HTTP tekrar denemesi yoktur.

## Son 80 öğrenci ölçümü — 15 Ekim 2026

Süreler saniyedir. p95, isteklerin yüzde 95'inin bu sürede tamamlandığı anlamına gelir. Cevap satırı yalnız 1.600 öğrenci isteğini; öğretmen satırı bu yazmalarla eşzamanlı 80 gözlemi içerir.

| İşlem | İstek | p50 | p95 | En uzun |
|---|---:|---:|---:|---:|
| Aynı anda sınava başlama | 80 | 3,85 | 6,19 | 6,44 |
| Cevap kaydı | 1.600 | 3,75 | 7,24 | 9,09 |
| Aynı anda teslim | 80 | 5,87 | 9,66 | 9,99 |
| Kendi tesliminden sonra sonuç ayrıntısı | 80 | 0,16 | 0,31 | 0,45 |
| Ek toplu sonuç listesi okuması | 80 | 0,74 | 0,82 | 0,82 |
| Ek toplu sonuç ayrıntısı okuması | 80 | 0,88 | 1,28 | 1,87 |
| Cevaplar yazılırken öğretmen sorguları | 80 | 0,44 | 0,84 | 0,97 |
| Teslim sonrası öğretmen sonuç/dashboard | 8 | 0,36 | 0,43 | 0,43 |
| Oturumlu görsel indirme | 1.600 | 0,67 | 1,46 | 2,09 |
| 20 aktörün tercih yazımları | 600 | 0,79 | 1,91 | 2,54 |

Sonuç ayrıntısı ölçümüne arayüzün mevcut iki saniyelik yönlendirme beklemesi dahil değildir; istek bu bekleme sonrasında yapılır. `submit80.elapsedMs` bütün aktörlerin sonuç akışını da beklediğinden teslim HTTP gecikmesi için tablodaki örnek süreleri kullanılır.

- **Doğruluk:** 80 ayrı tamamlanmış sonuç, 1.600 kalıcı cevap, 80/80 beklenen 100 puan. Tekrar teslim aynı sonucu döndürür. Yabancı sınıf/oturum/soru erişimi reddedilir; tamamlanmadan cevap anahtarı verilmez. Süresinde gelen teslim kabul edilir, gerçekten geç gelen cevap reddedilir; geç teslim yalnız önceden kayıtlı cevabı puanlar.
- **Bildirim ve tercihler:** 82/82 teslim bildirimi kalıcıdır. 600 tercih yazımının onayı, nihai değeri ve 30 revizyonu DB ile eşleşir.
- **Rapor kapsamı:** 8.082 sonucun kimlikleri ve puan toplamı eski API ile aynıdır. Eski toplu yanıt 12.726.942 bayt; yeni en büyük 500'lük sayfa 457.421 bayt; 17 sayfanın tamamı 7.381.551 bayttır. Sayfalama toplam nüfusu kaldırmaz; aktarımı parçalara böler ve cevap JSON'unu eler.
- **Gerçek üretim arayüzü:** ekranda 100 satır, ikinci sayfa, tam nüfusla 282 Excel ve baskı satırı, filtrelenmiş 82 satır; tarayıcı sayfa hatası yoktur.
- **Bütünlük ve koruma:** son `integrity_check=ok`, FK ihlali 0. Korunan iki kullanıcı dosyası ve canlı `quiz.db` ana dosyasının hash'leri aynı. Backend 2/2 ve migration 11/11 sahipli süreç kapandı; aktif süreç 0, port 47810 serbest, tarayıcı ve aktör havuzları kapandı.

## Senaryo için değerlendirme

Bu sonuç **“SQLite en fazla bu kadar öğrenci destekler”** anlamına gelmez. Doğrulanan yazılım ve yapılandırma hataları düzeltilince aynı SQLite yapısıyla 80 öğrenci sınavı doğru tamamladı. Buna karşılık mevcut makinede bütün öğrencilerin aynı anda cevap/teslim yazması birkaç saniyelik kuyruk oluşturuyor; bu gecikme tamamen giderilmiş değildir. Tek yazıcı ve dayanıklı yazmaların maliyeti sürer. Önceki başarılı/başarısız koşularda daha yüksek beklemeler de görülmüştür; tek koşudaki süreler sabit hizmet garantisi değildir.

20 soru/30 dakikada 1.600 ilk cevap ortalama yaklaşık 0,89 yazma/saniyedir; gerçek öğrenciler genellikle tüm soruları aynı anda cevaplamaz. Prova bu ortalamadan daha sert 80 kişilik eşzamanlı dalgalar kullanır. Ancak cevap değişimleri, 80 gerçek tarayıcı ve okul kablosuz ağı ölçülmediği için sahadaki gecikme yalnız bu ortalamadan çıkarılamaz.

Görseller 640×480 JPEG, her biri 161.902 bayttır: öğrenci başına 3,24 MB, 80 kişi için toplam 259 MB; tek sorunun 80 cihaza gönderilmesi yaklaşık 12,95 MB'dır. Daha büyük görseller, kapsama ve erişim noktası kapasitesi ek gecikme yaratabilir. **Gerçek Wi-Fi üzerinde 30 dakikalık saha/soak kabulü yapılmadı.** Oturum açma/parola doğrulama ve 80 cihazın ilk JS indirmesi de kapasite ölçümüne dahil değildir. Bu nedenle “hiç darboğaz olmayacak” garantisi verilmez; doğrulanan sonuç, yukarıdaki yalıtılmış sunucu yüküdür.

## Canlıya geçiş

Geliştirme ve prova canlı kurulumu değiştirmez. Yeni sürüm uygulanırken uygulama durdurulmalı, doğrulanmış tam yedek alınmalı, bağımlılıklar/Prisma client hazırlanmalı ve ek `notificationRevision` migration'ı çevrimdışı uygulanmalıdır. Prisma CLI'nin yerel migration motoru ile uygulamanın yamalı sürücüsü ayrı bileşenlerdir; CLI aktif WAL yazıcılarıyla eşzamanlı kullanılmamalıdır. `FULL` dayanıklılığı performans uğruna azaltılmaz.
