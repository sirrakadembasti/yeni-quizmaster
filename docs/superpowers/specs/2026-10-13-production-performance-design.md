# Üretim performansı ve frontend yükleme tasarımı

Üst kapsam: Kullanıcının onayladığı üretim provası Görev 4. Mevcut akışları bozmadan gerçekçi sentetik hacim ölçülür ve büyük ilk frontend paketi küçültülür. Yeni ürün özelliği, ücretli servis veya veritabanı değişimi eklenmez.

## Yaklaşım ve seçim

Üç seçenek değerlendirildi: yalnız vendor chunk ayırmak indirme toplamını azaltmaz; bütün sayfaları lazy yapmak öğrencinin çevrimdışı kritik yollarını riske atar; ağır yönetim/rapor sayfalarını lazy yapıp öğrenci kritik yollarını eager tutmak ilk yükü azaltırken mevcut çevrimdışı sözleşmesini korur. Üçüncü yaklaşım seçildi. Recharts yalnız dashboard, results, class-statistics, student-stats ve survey-results içinde kullanılır; bunların hiçbirinin eager import zinciri kalmamalıdır.

Public/auth/reset ve öğrenci dashboard, quiz listesi, sınav, sonuç listesi/detayı başlangıç paketinde kalır. Diğer sayfalar React.lazy ile gerektiğinde yüklenir. RouteGuard lazy sayfayı yalnız rol denetimi geçince oluşturur. Yol kayıtları, legacy alias, returnUrl, Wouter base, provider sırası ve geçmiş akademik yılın salt okunur sınırı aynen korunur. Suspense erişilebilir yükleniyor durumu gösterir. Chunk hatasında sayfayı yeniden yükleme ve ana sayfaya dönme eylemleri görünür; otomatik yenileme döngüsü oluşturulmaz. Boundary yeni yola geçince sıfırlanır.

## Çevrimdışı kabul

İlk sayfa scriptleri service worker kaydından önce yüklenir; mevcut v2 yalnız HTML'i önceden önbelleğe alır. Bu olası eksik gerçek production browser testiyle yeniden üretilir. Başarısızsa worker yalnız aynı origin ve uygulama base'i altındaki üretim JS/CSS app-shell dosyalarını önceden alır: entry ve onun **statik import closure** kümesi; bütün lazy/report chunk'ları önceden indirilmez. API, oturum yanıtları, upload ve başka özel veri asset cache'ine alınmaz. Çevrimdışı Hazır mesajı gösterilmeden gerekli app shell'in hazır olması doğrulanır; başarısız hazırlık kullanıcıya tekrar denenebilir hata verir. Readiness geçmeden preparedIds ve başarılı session-persistence yayımlanmaz; aksi halde reload hazırlanmamış sınavı hazır gösterebilir. Protected api.ts değişmez. Base-path ve worker güncellemesi de sınanır.

Taze browser profili, henüz sınav rotasına gidilmeden çevrimdışı hazırlama, ağın kesilmesi, doğrudan sınav URL'si/yenileme, cevapların korunması, teslim kuyruğu ve ağ geri geldiğinde idempotent gönderim birlikte kabul edilmelidir. Dev server veya yalnız jsdom sonucu yeterli değildir.

## Hacim ve kaynak ölçümü

Yalnız yeni sentetik SQLite kurulumu ve sahipliği doğrulanan port/süreçler kullanılır. Canlı DB yalnız hash ile korunur. Küçük veri smoke testi gerçekçi hacim ölçümü sayılmaz. En az 1.000 kullanıcı, çok sayıda sınıf/öğretmen/veli ilişkisi, sınav/anket/sonuç/cevap ve 10.000+ iş kaydı bulunan fixture açıklanır; 50.000 kayıt arşiv kabulü önceki ölçümle ayrıca ilişkilendirilir. Üç düzey eşzamanlı gerçek HTTP okuma ve kontrollü sentetik yazma için istek sayısı, p50/p95/p99/max, hata/status dağılımı, süre/throughput, CPU/RSS ve kapsamı yazılır. Arşiv capture/finalize veya history warm sırasında bağımsız yazıcının gecikmesi de ölçülür; sadece aynı process içi süre yeterli değildir.

Yerel 8 GB Windows/WSL host baskısı raporlanır; test işleri seri çalıştırılır. Sonuçlar internet kullanıcı kapasitesi veya üretim SLA garantisi olarak sunulmaz. Writer arşivden bağımsız izinli hedefe yazar ve yanıt/DB kanıtı verir; kasıtlı archive-fence 409/red durumları performans hatası sayılmaz, ayrı açıklanır. Yük altında doğrulanan hata/darboğaz için önce yeniden üretme, sonra dar kapsamlı düzeltme ve aynı fixture tekrar ölçümü yapılır.

## Paket kabulü

Aynı build ayarı/dependency/iş verisiyle önce ve sonra byte/gzip karşılaştırılır. Sadece ana chunk değil manifestte başlangıçta statik yüklenen bütün JS toplamı ölçülür; toplam dağıtım JS ve en büyük lazy parçalar ayrıca verilir. Hedef başlangıç gzip toplamında en az %25 azalma; ölçüm hedefe ulaşmazsa import zinciri incelenir. CSS ve build süresi ayrı verilir. Yalnız warning susturma veya manualChunks ile eşdeğer yük taşıma iyileştirme sayılmaz.

Üretim tarayıcısında dört rolün izin/red davranışı, direct URL/refresh/geri-ileri, public dönüş URL'si, legacy alias, base-path, geçmiş yıl salt okunur ekranı, lazy chunk başarısızlığı/hata kurtarma ve öğrenci offline sınavı doğrulanır. Network/pageerror kayıtları incelenir. İlgili regresyonlar ve type-check/build sonrasında görev raporu ve ayrı commit; Graphify son kapanışta güncellenir.
