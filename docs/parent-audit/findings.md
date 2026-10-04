# Veli paneli bulguları ve geliştirme sırası

4 Ekim 2026; başlangıç `b1257eb`. Ürün kodu değiştirilmedi. Aşağıdaki hatalar gerçek Chromium/API ve izole SQLite ile üretildi. Kontrollü500 testleri kasıtlı ağ hata enjeksiyonudur; başarılı veri yanıtları gerçek sunucudan alınır. Çalışan ve sınanmayan alanlar [doğrulama raporunda](verification.md), sayfa/sekme listesi [kapsam belgesindedir](inventory.md).

## Doğrulanmış hatalar

### P-B01 — Veli kendi eski açık sınavına cevap yazabiliyor — yüksek

- **Sayfa/işlem:** Veli rolünün salt okunur sınırı; `POST /api/student/quiz/:resultId/answer`.
- **Üretim:** Öğrenciden veliye dönüştürülmüş kullanıcı kimliğine ait tamamlanmamış sonuç durumunu izole fixture'da oluştur; veli oturumuyla geçerli soru/seçenek gönder. Bu durum mevcut rol değişiminde eski sonuçların korunmasını temsil eder.
- **Beklenen/gerçekleşen:**403 ve değişmeyen cevaplar; **200 ve DB'de A cevabı**.
- **Etki:** Çocuk/başka kullanıcı IDOR'u değil; aynı kimliğin tarihsel denemesi üzerinden veli rolü yazma yasağını aşar. Normal çocuk sonucu sahibi kontrolü403 ile korunur.
- **Kanıt:** [HTTP/DB gözlemi](legacy-answer-observation.json), `parent-security-audit.spec.ts` legacy testi, [tekrar koşusu](results-depth.json); `server/api-routes/student.ts` answer handler'ı `requireAuth` kullanır, rol kontrolü yoktur.
- **Çözüm/kabul:** Cevap endpoint'ine öğrenci rolü guard'ı ekle; sahiplik/süre/kapanış doğrulamaları korunmalı. Veli eski kendi denemesinde403 ve DB değişmez; gerçek öğrenci geçerli cevabı200 ile kaydeder.

### P-B02 — Sınıfa hedefli veli duyurusu bildirim üretmiyor — yüksek

- **Sayfa/işlem:** Duyurular → sınıf bazlı veli duyurusu; veli bildirim kutusu.
- **Üretim:** Yöneticinin gerçek duyuru API'siyle bağlı çocuğun sınıfına `targetRole=parent` duyurusu yayımla; veli duyuru listesi, bildirim API'si ve DB'yi oku.
- **Beklenen/gerçekleşen:** Veli listede duyuruyu ve bir bildirim görür; **POST201, listede var, veli bildirim DB sayısı0**.
- **Etki:** Veli önemli sınıf duyurusundan bildirim yoluyla haberdar olmaz.
- **Kanıt:** [Gözlem](class-announcement-observation.json), [tekrar](results-depth.json); liste görünürlüğü `server/api-routes/announcement.ts:27`, bildirim alıcı seçimi `announcement.ts:74` ve `server/utils/notification-policy.ts:18` farklı sınıf bağını kullanır.
- **Çözüm/kabul:** Ortak hedef kitle politikası kullan; veli sınıfı aktif bağlı çocukları üzerinden belirlenmeli. Aynı veliye çok çocuk üzerinden tek bildirim, ilişkisiz veliye0; genel ve öğrenci/öğretmen hedefleri korunmalı.

### P-B03 — Sınıfsız çocuğun kullanılabilir sınavı veliye görünmüyor — orta

- **Sayfa/işlem:** Öğrenci Takibi → Atanmış Sınavlar/bekleyen sayı.
- **Üretim:** Sınıfsız bağlı çocuk için yayımlanmış sınıfa atanmamış sınavı öğrenci `/student/quizzes` ve veli overview API'sinde karşılaştır.
- **Beklenen/gerçekleşen:** Aynı erişilebilir sınav kapsamı; öğrenci `parent-audit-unassigned-exam` görür, veli **[]** görür.
- **Etki:** Veli sınavı ve bekleyen iş yükünü eksik izler.
- **Kanıt:** [API karşılaştırması](classless-exams-observation.json), [tekrar](results-depth.json); `server/api-routes/parent.ts` yalnız `assignedClasses.some` kullanır; öğrenci erişim politikasında sınıfsız akış vardır.
- **Çözüm/kabul:** Öğrenciye uygulanmış sınav görünürlüğünü ortak yardımcıdan kullan. Sınıfsız/parçalı atama, yayımlanmamış, anket ve yabancı sınıf regresyonları geçmeli.

### P-B04 — Öğrenci listesi hatası başarılı boş veri gibi gösteriliyor — orta

- **Sayfa/işlem:** Dashboard ve sonuç listesi; GET `/parents/students`.
- **Üretim:** Bağlı iki çocuk varken kontrollü500 döndür; sayfayı aç.
- **Beklenen/gerçekleşen:** Açık hata/tekrar dene, doğru boş durumdan ayrım; dashboard **bağlı öğrenci yok**, sonuç sayfası **tamamlanmış sınav yok** diyor. Retry yok.
- **Etki:** Veli okul eşleştirmesinin veya kayıtlarının kaybolduğunu sanır; toparlama yolu yok.
- **Kanıt:** P-E02/P-E03 [çıktısı](results-baseline.json), [dashboard görüntüsü](screenshots/P-E02-students-failure.png), [sonuç görüntüsü](screenshots/P-E03-students-failure.png); `parent-dashboard.tsx:15-18,54`, `parent-results.tsx:15-22`.
- **Çözüm/kabul:** `isLoading/isError/refetch` dalları; hata role=alert ve retry. Kontrollü500 kaldırılınca gerçek200 ile çocuklar gelir; başarılı[] ilişki yok mesajını korur.

### P-B05 — Öğrenci özeti hatası ve yüklenmesi açıklanmıyor — orta

- **Sayfa/işlem:** Dashboard metrikleri ve sonuç listesi; overview isteği.
- **Üretim:** Overview500 veya cevap bekletme; bağlı öğrenci seçili halde sayfayı aç.
- **Beklenen/gerçekleşen:** Yükleniyor/hata/boş ayrı; dashboard yalnız üst kartta kalır, sonuç sayfası **tamamlanmış sınav yok** der. Retry yok.
- **Etki:** Eksik özet ve olmayan sonuçlar gibi görünür; işlem başarısı anlaşılamaz.
- **Kanıt:** P-E04/P-E05 [çıktısı](results-baseline.json); düzeltilmiş test aracıyla P-E07 [tekrarı](results-readiness.json), [yavaş görünüm](screenshots/results-delayed-overview.png). İlk P-E07'nin route temizliği hatası ürün kanıtı olarak kullanılmadı.
- **Çözüm/kabul:** Seçili çocuğa ait query durumlarını açık göster; hatalı/henüz gelmemiş veriden başarı/boş çıkarma. Retry200 ile doğru öğrenci ve tablo gelir; A/B hızlı seçimde yanlış kimlik görünmez.

### P-B06 — Sonuç Detay hatası sessiz kalıyor — orta

- **Sayfa/işlem:** Sonuçlar → Detay.
- **Üretim:** Gerçek liste yüklenince detay GET'ine kontrollü500; Detay'a bas.
- **Beklenen/gerçekleşen:** Açıklama, tekrar dene ve geri dönüş; liste sessizce kalır, aynı seçili resultId tekrar tıklaması da açık retry sağlamaz.
- **Etki:** Veli düğmenin çalışmadığını sanır.
- **Kanıt:** P-E06 [çıktısı](results-baseline.json), [görüntü](screenshots/detail-failure.png); `parent-results.tsx:19-22`.
- **Çözüm/kabul:** Detay loading/error/refetch dalı; retry gerçek200 sonrası doğru cevaplar ve geri düğmesi; başka çocuk seçimi eski detayı kapatır.

### P-B07 — Sonuç bağlantısı seçili çocuğu değiştiriyor — orta

- **Sayfa/işlem:** Dashboard → “Tümünü ve detayları gör”.
- **Üretim:** İkinci çocuk Beren'i seç; bağlantıya bas.
- **Beklenen/gerçekleşen:** Beren sonuçları; **Ada ilk çocuk seçiliyor**.
- **Etki:** Çok çocuklu veli yanlış çocuğun puanlarını okur.
- **Kanıt:** P-F03 [çıktısı](results-baseline.json), [görüntü](screenshots/results-context-after-dashboard.png); `parent-dashboard.tsx:66`, `parent-results.tsx:13,17`.
- **Çözüm/kabul:** Güvenli öğrenci query parametresi/ortak seçim; hedef sayfa bağlı çocuk listesinden doğrular. İkinci çocuk korunur; yabancı/eksik öğrenci parametresi bilgi sızdırmaz.

### P-B08 — Görselli soru detayda eksik gösteriliyor — orta

- **Sayfa/işlem:** Sonuç detayı → soru incelemesi.
- **Üretim:** Tamamlanmış sınavın sorusuna izole görsel ekle; detay API ve ekranı karşılaştır.
- **Beklenen/gerçekleşen:** Görsel erişilebilir alt metinle gösterilir; API imageUrl getirir, ekranda **0 img**.
- **Etki:** Sorusu görsele bağlı cevap değerlendirilemez.
- **Kanıt:** P-F04 [çıktısı](results-baseline.json), [görüntü](screenshots/image-result-detail.png); `parent-results.tsx:25` yalnız metin/cevap render eder. Fixture görseli sonunda geri yüklenir.
- **Çözüm/kabul:** Mevcut güvenli soru görseli bileşeni/politikası kullan; görsel/alt metin, mobil boyut, bozuk görsel ve görselsiz soru regresyonları geçer.

### P-B09 — Veli duyurusu “Öğretmenlere” etiketleniyor — düşük

- **Sayfa/işlem:** Duyurular kartı ve yazdırma çıktısı.
- **Üretim:** `targetRole=parent` duyurusunu veli hesabıyla aç.
- **Beklenen/gerçekleşen:** Velilere; **ÖĞRETMENLERE**. Görünürlük politikası doğru duyuruyu döndürüyor; bu bir erişim sızıntısı değildir.
- **Etki:** Veli duyurunun kendisine yönelik olup olmadığını yanlış anlar.
- **Kanıt:** P-X02 [çıktısı](results-print.json), [PDF sayfası](print/announcements-page-1.png); `announcements.tsx` hedef etiketi parent rolünü ele almayan ternary kullanır.
- **Çözüm/kabul:** Rol→etiket eşlemesi parent dahil tamamlanır; parent/student/teacher/all ekran ve baskıda doğru isimlenir.

### P-B10 — Bildirimlerin yazdırma çıktısı kaydırma alanında kırpılıyor — orta

- **Sayfa/işlem:** Ayarlar → Bildirimler → Yazdır.
- **Üretim:**23 bildirimli veli fixture'ında20 kayıtlık ilk sayfayı aç; gerçek print CSS ile Chromium PDF üret.
- **Beklenen/gerçekleşen:** Görüntülenen20 bildirimin tamamı PDF'de; yalnız **0..5 numaralı6 bildirim** var. İlk sayfalama bilgisi1/2 olsa da mevcut sayfanın14 kaydı kesiliyor.
- **Etki:** Veli eksik çıktıyı tam kayıt olarak kullanabilir.
- **Kanıt:** [PDF satır doğrulaması](print/verification.json), [görüntü](print/notifications-page-1.png), [gerçek PDF](print/notifications.pdf); `settings.tsx` bildirim ScrollArea sabit yükseklik ve iç overflow sınırı taşır. P-S02 gerçek20 DOM kaydını ayrıca doğrular.
- **Çözüm/kabul:** Baskıda kaydırma viewport'u height:auto/overflow:visible olmalı; normal ekranda kaydırma/sayfalama korunur. Güncel sayfadaki20 başlık PDF metninde ve render'da bulunur. Bütün sayfaları dışa aktarma ayrı özellik kararını gerektirir.

## Kullanıcı deneyimi iyileştirmeleri

| ID/sayfa | Doğrulama ve etki | Öncelik; öneri/kabul | Fayda/efor |
|---|---|---|---|
| P-U01 Sonuçlar / bağlantısız veli | P-E01: dashboard ilişki yok bilgisini doğru gösterir; sonuç sayfası yalnız tamamlanmış sınav yok der. [Görüntü](screenshots/results-no-linked-students.png) | Orta; ilişki yok mesajı ve okul yöneticisine başvuru yönlendirmesi; başarılı sonuç[] durumuyla ayrı | Yüksek/düşük |
| P-U02 Dashboard/sonuçlar öğrenci seçimi | P-A01 ve bağımsız P-A03: combobox erişilebilir adı **boş**. Klavye seçimi çalışır fakat kontrolün amacı adlandırılmamış | Orta; görünür label veya aria-label “Öğrenci seçin”; iki rotada accessible-name ve klavye/focus kontrolleri geçer | Yüksek/düşük |
| P-U03 Sonuç detayı doğruluk ifadesi | ARIA incelemesinde soru başına açık doğru/yanlış durum metni yok; durum ikon ve cevap karşılaştırmasından çıkarılır. Sesli okuyucu testi yapılmadı | Düşük; “Doğru/Yanlış/Cevapsız” metni/erişilebilir etiket; yalnız renk/ikona bağlı kalmaz | Orta/düşük |
| P-U04 Profil/Güvenlik baskısı | Print CSS input'ları gizler; profil alanları boş etiket/ikon olarak, güvenlik kartı boş form olarak basılır. Görsel kaynak `print/profile-page-1.png`, `print/security-page-1.png` | Düşük; profil için güvenli metin çıktısı; güvenlik sekmesinde anlamsız boş form baskısını açıklamak/kapatmak. Parolalar hiçbir zaman basılmamalı | Orta/düşük |
| P-U05 İşlem geçmişi baskısı | `print/logs-page-3.png` yalnız sayfalama footer'ı içeren fazla sayfa | Düşük; baskıda sayfalama kontrolleri/metni gizlenir, kayıtlar korunur | Düşük/düşük |

Mobil375/390px normal ve uzun geçerli ad/e-posta senaryoları geçti; bu koşulda belge taşması bulunmadı. Başarılı rota taramalarında konsol/sayfa/API hata kaydı0. Yük testi olmadığı için büyük veri performansı hakkında başarı iddiası yok.

## Yeni özellik önerileri (hata olarak sayılmadı)

| Sayfa | Öneri | Fayda/efor; öncelik |
|---|---|---|
| Dashboard | Uzun sonuç listesini son kayıtlarla sınırla, açık “Tümü” akışını koru | Orta/düşük; düşük |
| Sonuçlar | Arama, ders/tarih filtresi ve sayfalama | Çok sonuçta yüksek/orta; orta |
| Sonuç detayı | Yetki kontrollü doğrudan detay URL'si ve yenilemede aynı sonuç | Orta/orta; düşük |
| Sonuçlar | Veliye uygun Excel/PDF özet export | Orta/orta; düşük; şu anda düğme yok |

## Uygulama sırası

1. **P-B01** öğrenci cevap endpoint rol guard'ı (yüksek fayda/düşük efor); öğrenci/veli/öğretmen/admin, eski kimlik ve ownership regresyonları.
2. **P-B02** ortak duyuru alıcı politikası (yüksek fayda/orta efor); çok çocuklu veli dedup ve mahremiyet.
3. **P-B03** ortak sınav görünürlüğü (yüksek fayda/orta efor); sınıflı/sınıfsız/anket/draft/archived kapsamı.
4. Dashboard **P-B04/P-B05**, ardından sonuç listesi/detayı **P-B04/P-B05/P-B06** (yüksek fayda/düşük-orta efor); hata/yükleniyor/boş/retry ayrımı.
5. **P-B07/P-U01/P-U02** (yüksek fayda/düşük efor); çocuk bağlamı, ilişki yok mesajı, erişilebilir seçim.
6. **P-B08/P-B10**, ardından **P-B09/P-U03/P-U04/P-U05** (orta fayda/düşük-orta efor); görsel detay, eksiksiz bildirim baskısı, hedef etiketi, doğru/yanlış metni ve baskı düzeni.
7. Yeni özellikler ihtiyaç/onay sonrasında; mevcut hata onarımlarına karıştırılmamalı.

Yukarıdaki bütün çözümler kod değişikliği gerektirir; bu denetimde uygulanmadı. Öğrenci/öğretmen/admin davranışları ortak policy değişikliklerinin regresyon kapsamına alınmalıdır. Kaynakta görülen fakat veli çalışma zamanında sınanmayan admin toplu bağ ilişkisinin “Diğer”e dönüşmesi ve pasif öğrenci toplu bağlama tutarsızlığı bu sayfanın doğrulanmış veli hatalarına eklenmedi.
