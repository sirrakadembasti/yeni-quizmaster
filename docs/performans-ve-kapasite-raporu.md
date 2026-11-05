# QuizMaster Performans, Paket Boyutu ve Okul Sınavı Kapasite Raporu

Bu belge; istemci başlangıç paketi küçültme çalışmalarını, çevrimdışı sınav hazırlama doğrulamasını, SQLite WAL/sürücü iyileştirmelerini ve 80 öğrencilik eşzamanlı görselli sınav provası sonuçlarını tek raporda toplar.

## 1. İstemci Paket Boyutu ve Tembel Yükleme (Lazy Loading)

- **Sayfa Bazlı Bölme:** Giriş (`/auth`), şifre sıfırlama ve öğrenci sınav çözme ekranları başlangıç paketinde tutulurken; raporlama, yönetim, anket sonuçları, sınav oluşturma ve Recharts grafik bileşenleri yetki kontrolünden sonra tembel yüklenir (`React.lazy` + `RouteLoadBoundary`).
- **Tedarikçi (Vendor) Paket Bölme (5 Kasım 2026):** `client/vite.config.ts` içinde `manualChunks` (`vendor-react`, `vendor-ui`) yapılandırılarak başlangıç ve tedarikçi paketleri ayrıştırıldı, Vite'ın 500 kB üzeri parça uyarısı tamamen giderildi (`index` ~396 kB / gzip ~110 kB, `vendor-react` ~245 kB / gzip ~78 kB, `vendor-ui` ~166 kB / gzip ~50 kB).
- **Çevrimdışı Sınav ve Service Worker Kabulü:** Service Worker yalnız aynı origin ve alt yol (`base`) altındaki doğrulanmış statik uygulama dosyalarını önbelleğe alır; API, kişisel veri ve soru görselleri genel önbelleğe yazılmaz. Süresiz sınavların çevrimdışı hazırlanması, soru görsellerinin oturuma özel saklanması ve bağlantı geldiğinde cevapların sunucuya idempotent teslimi gerçek Chromium testleriyle doğrulandı.

## 2. SQLite Kapasite ve Eşzamanlı Sınav İyileştirmeleri

Dört sınıf × 20 öğrenci (toplam 80 öğrenci), 20 görselli soru ve 30 dakika süreli sınav senaryosu için uygulanan mimari iyileştirmeler:

1. **Merkezi SQLite 3.51.3 Sürücüsü ve İşlem Yalıtımı:** `WAL` modu, `synchronous=FULL`, yabancı anahtar kontrolü ve işlem kapısı (transaction gate) ile bağımsız yazmaların açık işlemleri etkilemesi önlendi. `SQLITE_BUSY` durumları Prisma işlem yeniden denemesine (`P2034`) uyumlu hale getirildi.
2. **Bağımsız Salt Okunur Bağlantı:** Sonuç, dashboard ve istatistik sorguları ayrı salt okunur bağlantıya taşındı; böylece öğretmen ve yönetici ekranları öğrencilerin cevap yazma kuyruğunu beklemez.
3. **Atomik Cevap Kaydı:** Cevap kaydında yapılan üç ayrı ön okuma kaldırılarak sahiplik, durum, süre ve soru üyeliği tek atomik işlem içinde doğrulandı (1.600 cevapta 4.800 gereksiz okuma elendi).
4. **Güvenilir Sunucu Teslim Zamanı:** Sınav cevabı ve tesliminde süre kontrolü, HTTP gövdesi sunucuya ulaştığı anda kaydedilen sunucu zaman damgasına dayanır; veritabanı kuyruğunda geçen bekleme süresi öğrenci aleyhine sayılmaz.
5. **Oturum Yazma ve Bildirim Sorgusu Azaltımı:** Sınav ekranında gizli menünün 10 saniyelik bildirim yoklaması durdurularak 30 dakikada oluşabilecek ~14.400 gereksiz istek kaldırıldı; oturum süre uzatmaları (`touch`) 60 saniyelik aralıklarla birleştirildi.
6. **Sonuç Projeksiyonu ve Sayfalama:** İstatistik ve sonuç listeleri ham cevap JSON'unu taşımayan hafif projeksiyonlarla ve sayfalı olarak aktarılır; Excel ve yazdırma çıktıları tüm kapsamı korur.
7. **Bildirim Revizyonu (`notificationRevision`):** Eşzamanlı veya gecikmeli bildirim tercihi yazmalarında eski revizyonun yeni tercihi ezmesi `ETag`/`If-Match` ve `User.notificationRevision` ile engellendi.

## 3. 80 Öğrencilik Eşzamanlı Sınav Provası Sonuçları (15 Ekim 2026)

1.000 öğrenci ve 8.000 geçmiş sonuç içeren veritabanı üzerinde 80 öğrencinin aynı anda sınava başlayıp 20 görselli soruyu yanıtladığı ve teslim ettiği hızlandırılmış yük testi (`scripts/school-exam-rehearsal.mjs`) sonuçları:

| İşlem | İstek Sayısı | p50 (sn) | p95 (sn) | En Uzun (sn) | Hata |
|---|---:|---:|---:|---:|---:|
| Aynı anda sınava başlama | 80 | 3,85 | 6,19 | 6,44 | 0 |
| Cevap kaydı (öğrenci) | 1.600 | 3,75 | 7,24 | 9,09 | 0 |
| Aynı anda sınav teslimi | 80 | 5,87 | 9,66 | 9,99 | 0 |
| Teslim sonrası öğrenci sonuç ayrıntısı | 80 | 0,16 | 0,31 | 0,45 | 0 |
| Toplu sonuç listesi okuması | 80 | 0,74 | 0,82 | 0,82 | 0 |
| Toplu sonuç ayrıntısı okuması | 80 | 0,88 | 1,28 | 1,87 | 0 |
| Cevaplar yazılırken öğretmen sorguları | 80 | 0,44 | 0,84 | 0,97 | 0 |
| Teslim sonrası öğretmen sonuç/dashboard | 8 | 0,36 | 0,43 | 0,43 | 0 |
| Oturumlu soru görseli indirme | 1.600 | 0,67 | 1,46 | 2,09 | 0 |
| 20 aktörün eşzamanlı tercih yazımları | 600 | 0,79 | 1,91 | 2,54 | 0 |

- **Toplam:** Ölçülen **4.334 istekte 0 hata**, 1.600 kalıcı cevap, 80 tamamlanmış sonuç ve 82 öğretmen bildirimi veritabanı ile birebir eşleşti (`integrity_check=ok`, `foreign_key_check=0`).
- **Yıllık Arşivleme ve Geçmiş Yıl Projeksiyonu:** 17.667 satırlık yıllık kapanış (capture 4,2 sn, PDF/ZIP 20,1 sn, finalization 1,0 sn) sırasında bağımsız HTTP yazıcısı **50/50** hatasız tamamlandı.

## 4. İşletim Sınırları ve Saha Notları

- SQLite WAL aynı anda çoklu okumaya izin verir ancak tek dosyada aynı anda tek yazıcı çalıştırır. 80 öğrencinin aynı saniyede yazma yapması birkaç saniyelik kuyruk oluşturur; çok sunuculu veya yüzlerce eşzamanlı yazıcılı kurulumlar için [PostgreSQL Geçiş Rehberi](postgresql-gecis-rehberi.md) izlenmelidir.
- Yukarıdaki ölçümler yerel geri döngü (loopback) ağı üzerindedir; okul içi Wi-Fi erişim noktası kapasitesi ve soru görsellerinin (ör. 80 öğrenci × 20 görsel) kablosuz ağ bant genişliği sahada ayrıca dikkate alınmalıdır.
