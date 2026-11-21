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

### 3.1 Prisma 7 sonrası yeniden doğrulama (17 Kasım 2026)

Bölüm 3'teki ölçümler Prisma 6.19.3 ile alınmıştı. Uygulama 16 Kasım 2026'da Prisma 7.10.1'e geçti (sürücü bağdaştırıcısı aynı `better-sqlite3`; işlem geçidi korunuyor). Aynı senaryo (`scripts/school-exam-rehearsal.mjs`: dört sınıf × 20 öğrenci, görselli sorular, gerçek üretim derlemesi ve üretim arayüzünde rapor/Excel kontrolü) Prisma 7 ile yeniden koşturuldu:

- **4.334 ölçülen istek, 0 hata, tüm yanıtlar 200** (Prisma 6 ölçümüyle aynı sayı); gerçek üretim arayüzünde 282 yazdırma/Excel satırı üretildi, sayfa hatası yok; fixture portları serbest bırakıldı.
- **Süreler karşılaştırılamaz:** Bu koşu, disk ve işlemci yükü yüksek ve değişken bir geliştirme makinesinde yapıldı (migration'lar bile dakikalar sürdü). Cevap kaydı p95 değerleri turlara göre yaklaşık 5,9–19,2 sn aralığında ölçüldü; Bölüm 3'teki 7,24 sn ile doğrudan kıyaslanamaz. Prisma 7'nin süre etkisini ölçmek için hedef donanımda Prisma 6 ve Prisma 7 sürümlerini aynı makinede art arda koşturmak gerekir; bu yapılmadı.
- İstemci artık SQLite için en fazla 32.766 bağlı değer bildirir (Prisma 7 varsayılanı 999'dur); arşiv yakalama gibi binlerce kimlikli sıralı sorgular için gereklidir (`server/utils/sqlite-runtime.ts`).

### 3.2 P-01/P-02/P-03 sonrası yeniden ölçüm (21 Kasım 2026)

Soru önbelleği (P-01, `saveResultAnswer`), hafif `requireAuth` sorgusu (P-02) ve toplu bildirim (P-03) birleştikten sonra, güncel `main` koduyla `scripts/school-exam-rehearsal.mjs` baştan sona koşturuldu (tek kullanımlık `server/data/quizmaster-test-academic-performance-*` dizini; gerçek `server/data/quiz.db` ve korunan dosyaların özetleri koşu öncesi/sonrası aynı kaldı; fixture portu serbest bırakıldı).

| İşlem | İstek | p50 (sn) | p95 (sn) | En uzun (sn) | Hata |
|---|---:|---:|---:|---:|---:|
| Aynı anda sınava başlama | 80 | 3,76 | 8,50 | 8,75 | 0 |
| Cevap kaydı (yalnız öğrenciler) | 1.600 | 4,28 | 11,04 | 27,57 | 0 |
| Aynı anda sınav teslimi | 80 | 8,01 | 16,26 | 17,39 | 0 |
| Teslimden 2 sn sonra kendi sonucu | 80 | 9,42 | 14,88 | 15,32 | 0 |
| Eşzamanlı öğrenci sonuç listesi | 80 | 0,40 | 0,72 | 0,76 | 0 |
| Eşzamanlı öğrenci sonuç ayrıntısı | 80 | 0,49 | 0,86 | 0,90 | 0 |
| Öğretmen sonuç/dashboard | 8 | 0,48 | 0,57 | 0,57 | 0 |
| Oturumlu soru görseli indirme | 1.600 | 1,15 | 4,59 | 5,01 | 0 |
| 20 aktörün tercih yazımları | 600 | 0,95 | 2,34 | 2,93 | 0 |

Ölçülen **4.334 istekte 0 hata**; 1.600 cevap, 80 tamamlanmış sonuç ve 82 öğretmen bildirimi veritabanıyla eşleşti (`integrity_check=ok`, `foreign_key_check=0`).

**Karşılaştırma (Bölüm 3, 15 Ekim 2026 ↔ bu koşu):**

| Ölçüt | Eski | Yeni |
|---|---:|---:|
| Cevap kaydı p50 / p95 | 3,75 / 7,24 sn | 4,28 / 11,04 sn |
| Sınav teslimi p50 / p95 | 5,87 / 9,66 sn | 8,01 / 16,26 sn |
| Sınava başlama p50 / p95 | 3,85 / 6,19 sn | 3,76 / 8,50 sn |

**Bu sonuç iyileşme göstermiyor, ama sonuç olarak da yorumlanmamalıdır.** Koşu, 4 mantıksal çekirdekli Intel Core i5-4210U (1,7 GHz), 7,9 GB RAM (koşu sırasında yaklaşık 1,5 GB boş), Windows 11, Node v22.23.2 ve SQLite 3.51.3 (WAL, `synchronous=FULL`, `busy_timeout=50`) üzerinde yapıldı. Aynı makinede kullanıcının geliştirme sunucuları ve başka oturumlar çalışıyordu; istek üreticisi, sunucu ve veritabanı aynı küçük makineyi paylaşıyor. Aynı kodun ardışık denemelerinde cevap kaydı p95 değeri yaklaşık 5,9–19 sn arasında oynadı (aşağıdaki notlara ve Bölüm 3.1'e bakın); tek bir tur arasındaki fark ölçüm gürültüsünden ayırt edilemez. Önbellek ve hafif sorgu kazançları yerel mikro ölçümde görüldü (cevap kaydı ≈ 10 ms → ≈ 2,4 ms; `getUser` ≈ 2,2 ms → ≈ 0,6 ms); bu, 80 eşzamanlı istemcinin tek yazıcılı SQLite kuyruğundaki beklemesini doğrudan belirleyen süre olmadığı için uçtan uca p95'e yansımayabilir.

Gözlemler:
- Süreler, tek tek istek maliyetinden çok SQLite'ın tek yazıcı kuyruğu ve CPU çekişmesini yansıtıyor: sınava başlama (80 yazma) ve teslim (80 yazma + bildirim) aynı anda yazıcı bekler. Cevap kaydında en uzun bekleme (27,6 sn) koşu içinde bir turda (19. soru) görüldü; diğer turların p95'i 5,9–11,4 sn.
- "Teslimden sonra kendi sonucu" süresi eski koşudaki 0,16 sn'den çok yüksek; çünkü 80 öğrenci teslim kuyruğu boşalmadan sonuç ekranını açıyor ve istekler aynı kuyrukta bekliyor. Kuyruktan bağımsız okuma yapan ayrıntı isteği 0,49 sn. Bu fark hedef donanımda tekrar ölçülmeli.
- Betikte tekrarlanabilirlik için düzeltmeler yapıldı: silinen `/live` rotasına yapılan gözlemci isteği `/api/quizzes` ile değiştirildi (T-01), artık cevap kaydında yazılmayan `correctAnswersCount` koşulu kaldırıldı (puan teslimde hesaplanır), korunan dosyaların sabit SHA-256 özetleri yerine koşu öncesi/sonrası özet karşılaştırması kullanılıyor (gerçek `quiz.db` yoksa oluşturulmadığı da denetlenir).
- Anlamlı bir önce/sonra karşılaştırması için hedef (okul sunucusu) donanımında, başka iş çalışmazken, P-01/P-02/P-03 öncesi ve sonrası commit'ler art arda en az üçer tur koşturulmalıdır; bu yapılmadı.

## 4. İşletim Sınırları ve Saha Notları

- SQLite WAL aynı anda çoklu okumaya izin verir ancak tek dosyada aynı anda tek yazıcı çalıştırır. 80 öğrencinin aynı saniyede yazma yapması birkaç saniyelik kuyruk oluşturur; çok sunuculu veya yüzlerce eşzamanlı yazıcılı kurulumlar için [PostgreSQL Geçiş Rehberi](postgresql-gecis-rehberi.md) izlenmelidir.
- Yukarıdaki ölçümler yerel geri döngü (loopback) ağı üzerindedir; okul içi Wi-Fi erişim noktası kapasitesi ve soru görsellerinin (ör. 80 öğrenci × 20 görsel) kablosuz ağ bant genişliği sahada ayrıca dikkate alınmalıdır.
