# Akademik arşiv paketi

Bu paket dönem iş verilerinin değişmez dışa aktarımıdır. Tam sunucu yedeği değildir: oturumlar, parolalar, SMTP/AI anahtarları ve çalışma yapılandırması dışarı verilmez. Tam geri yükleme için ayrıca uygulama yedeği gerekir.

## Dizin ve bütünlük

Her snapshot `backup_root/{academicYear}/{snapshotId}/` altında yayımlanır. ZIP içeriği:

- `csv/people-classes.csv`: kişiler, sınıflar, veli bağlantıları ve duyurular.
- `csv/courses-assignments.csv`: dersler ve öğretmen atamaları.
- `csv/quizzes-questions.csv`: sınav/anketler, sorular ve soru bankası.
- `csv/results-surveys.csv`: sonuçlar, anket gönderimleri ve cevapları.
- `records.json`: dondurulmuş iş verileri.
- `meta.json`: dönem, snapshot, başlatan, iş oluşturma ve ayrı capture zamanı, satır sayısı ve kaynak özeti.
- `index.json`: sınıf/şube → ders → içerik ve PDF dosyası eşlemesi.
- `pdfs/report.pdf`: küçük pakette tam rapor; büyük pakette sıralı PDF parça dizini.
- `pdfs/report-NNNN.pdf`: yalnız bölünmüş raporlarda sıralı parçalar.
- `images/`: izinli yerel soru görsellerinin dondurulmuş kopyaları.
- `manifest.json`, `checksums.json`, `README.txt`.

Format 2 manifesti dosya başına byte sayısını ve SHA-256 özetini içerir. Manifest/checksum dosyaları kendi kendilerini özetleyen döngüye dahil edilmez. ZIP'in SHA-256 özeti ve boyutu veritabanında tutulur; dosya üretimi, doğrulama ve yetkili indirme sırasında karşılaştırılır. Eksik, fazladan, güvensiz yollu, yinelenmiş veya değiştirilmiş dosya reddedilir. Format 1 paketlerinin eski kaynak/byte sırası ve doğrulama uyumluluğu korunur.

## PDF ve görseller

Rapor dondurulmuş sınıf, ders, sınav başlığı, yayın tarihi (yoksa oluşturma tarihi), soru/cevap, katılımcı ve puanlardan üretilir. Capture zamanı ayrı gösterilir. Çok sınıfta katılan öğrenciler ilgili bölüm eşlemesiyle görünür; sınıfsız katılım ayrı gruptadır. Uzun değerler tablo hücresinde satıra bölünür.

PDF parçaları en fazla 100 içerik bölümü ve 2 MiB HTML ile oluşturulur. Büyük tek içerik tablosu satır sınırlarında bölünür; her parçadaki başlık ve indeks eşlemesi korunur. Her PDF için varsayılan 30 saniyelik üretim sınırı vardır. Tek başına sığmayan satır veya görsel açık hata verir; kayıt sessizce atılmaz. Bu kurallar her cihazda her büyüklüğün aynı sürede tamamlanacağı garantisi değildir.

Yerel PNG/JPEG/WebP dosyaları güvenli uploads yolu, gerçek dosya türü ve boyut kontrollerinden sonra pakete kopyalanır. Eksik yerel görsel arşivi başarısız yapar. Traversal, symlink ve SVG reddedilir. Aynı içerik özeti tekrar kullanılarak kopya/bellek çoğalması sınırlanır. Uzak görsel URL'leri otomatik indirilmez; bu sınır paket açıklamasında belirtilir. Geçmiş görselleri admin yetkisiyle, tamamlanmış yıllık snapshot ve ZIP/görsel özeti doğrulanarak sunulur.

## Kaynak sınırları ve geçmiş arama

Ham snapshot JSON girdisi 64 MiB, paket 256 MiB ile sınırlıdır. Görsellerin toplam boyutu ve rapor HTML'i ayrıca kalan bütçeye göre denetlenir. Dosya IO ve Chromium üretimi capture/finalization transaction'larının dışındadır; veritabanı işlemleri mevcut 120 saniye sınırını korur.

Geçmiş sayfalama, filtre ve istatistik sorguları bütün snapshot JSON'unu her istekte taşımak yerine SQLite içinde çalışır. Sayfanın tam satırları ile ilişki için gerekli dondurulmuş scalar alanlar alınır. Türkçe substring araması önceki JSON/enriched-alias davranışını korur; arama projeksiyonu ICU/Unicode sürümüyle ilişkilidir. Değişmez asıl snapshot kaynak olmaya devam eder. Eski arşivde projeksiyon yoksa arka planda sınırlı partilerle hazırlanır; arayüz hazırlık ve tekrar deneme durumunu gösterir, canlı veriyle doldurmaz.

## Doğrulama durumu

7 Ekim 2026: dosya sözleşmesi, format 1 uyumluluğu, görsel/HTML bütçeleri, PDF bölüm bütünlüğü ve tarih başlığı için 27/27 odaklı test geçti. Geçmiş sorgu testleri 18/18, worker birim testleri 30/30, geçmiş arayüz testleri 6/6 geçti. Gerçek küçük PDF'de ZIP CRC/SHA, dört CSV, metin, gömülü görseller ve görsel sayfa incelemesi yapıldı; uzun cevap taşması yeniden üretildi ve düzeltilen çıktının tamamı görüldü.

12 Ekim tarihli gerçek PDF render kontrolü ve beş ayrı gerçek tarayıcı senaryosu geçti. Son gerçek veritabanı/hacim kabulü **74/74**, odaklı dosya testleri **27/27** başarılıdır; dosya sözleşmesi ve bounded geçmiş hazırlığı `48f88ba` ile kaydedildi. 50k ilk legacy hazırlığı 154,366 saniyede 50.001 satırı 13 transaction ile tamamladı. Önceki başarısız denemeler ve ölçümlerin kapsamı [doğrulama kaydında](verification.md) ayrı tutulur. Genel regresyon ve belge/Graphify kapanışı ayrı Görev 7 kontrolleridir.

12 Ekim ek kontrol: önceki gerçek 50k paketinin bütün ZIP CRC/manifest SHA değerleri ve 5.000 sınavın 51 PDF dosyasına eşlemesi doğrulandı. Dizin ile ilk, orta ve son rapor parçasının metni çıkarıldı; bunların ilk içerik sayfaları görsel olarak incelendi ve kenar kırpılması görülmedi. Bu, bütün binlerce sayfanın görsel incelemesi değildir. Güncel tekrarın 1k legacy arama hazırlığı 4,17 s tamamlandı (önceki 22,41 s); aynı tekrarın PDF üretimi zaman aşımına uğradı. Yeni koşunun tamamı başarılı sayılmaz ve neden araştırması açık kalır.

Legacy hazırlığı her okumada 256 kaynak satırı ve gereken dondurulmuş ilişki bilgilerini taşır; en fazla 16 sayfa / 4.096 satır bir transaction'da yazılır. SQL yazması 199 satır / 995 parametreyi aşmaz. Transaction sınırı 120 saniyedir; cursor ve SHA ancak commit sonrası ilerler. Hata/tekrar deneme testi kısmi hazır işareti yayımlanmamasını ve kaynak byte'larının korunmasını doğrular. Bu, canlı kullanıcı yazmalarında bekleme süresi garantisi değildir; eşzamanlı yazma gecikmesi sonraki üretim performans provasında ölçülecektir.
