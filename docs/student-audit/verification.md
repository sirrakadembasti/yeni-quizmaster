# Öğrenci paneli doğrulama kaydı

Tarih: 4 Ekim 2026. Öğrenci paneli incelemesi tamamlandı; ürün hatalarının onarımı bu değişikliğin kapsamına alınmadı. Güncel 38 E2E senaryosunun en son geçerli koşu sonuçları **32 geçti / 6 başarısız / 0 çalıştırılmadı / 0 atlandı**. Bu, tek bir yeşil koşu değildir: [kapsam özeti](coverage-summary.json) mevcut Playwright listesindeki test kimliklerini altı gerçek koşunun en son sonuçlarıyla eşleştirir. Başarısız altı test [altı açık kusurun](findings.md) regresyon kanıtıdır.

## Ortam ve veri güvenliği

- Native Windows; Node 22.23.2, pnpm 9.15.1, Playwright 1.63 Chromium. WSL/Linux öğrenci koşusu yapılmadı.
- API `127.0.0.1:5540`, UI `127.0.0.1:5541`; `student-audit-server.ts` ayrı SQLite, session, yükleme ve konfigürasyon dizini oluşturur. Helper yanlış DB/port/baseURL kullanımını reddeder. Gerçek uygulama oturumu, CSRF, API ve Prisma DB kontrolleri kullanıldı.
- Testler yalnız sentetik öğrenci, öğretmen, yönetici, sınıf, sınav, anket ve bildirim verilerini değiştirdi. Normal DB `server/data/quiz.db` SHA256 başlangıç ve kapanış karşılaştırması: `8210a4b79f2cfb9cf74de6a4989f5c8a5449ba1d17b2332abdbd018c3741a158`.
- Son [runner kaydı](runner-verification.json): test çıkış0, sahip olunan API/UI süreçleri durduruldu, 5540/5541 yeniden bind edilebilir; cleanupSucceeded=true. Bu, makinedeki bütün süreçlerin veya çöküp ebeveynini kaybetmiş bütün torunların tarandığı anlamına gelmez.
- Kalıcı JSON çıktıları parola/token/cookie sansürleyicisinden geçirildi. Ham sunucu logları, runtime bağlantı bilgileri, trace ve geçici DB'ler sürümlenmez.

## Sayfa ve sekme kapsamı

Tam kaynak/rota kontrol listesi [envanterde](inventory.md); senaryo bazında geçen/kalan kontroller [makine tarafından üretilen özette](coverage-summary.json). Bir test birden fazla işlem içerdiğinden aşağıdaki satırlar toplanarak 38 sayısı üretilmez.

| Sayfa / sekme | Geçen kontroller | Başarısız veya sınırlı alan |
|---|---|---|
| `/`, `/student/dashboard` | Gerçek verili doğrudan açılış, yenileme, masaüstü/mobil, kendi sınav/sonuçları | S-B03 tüm sonuçlar 404; S-B04 kontrollü500 sırasında yanlış tamamlandı mesajı |
| `/student/quizzes` | Arama, durum, liste/gezinme, gerçek atanmış veri, doğrudan açılış/yenileme | Tam çevrimdışı soğuk açılış ve hazırlama düğmesinin bütün varyantları sınanmadı |
| `/student/quiz/:id` | Başlat, cevapla, soru geçişi, iptal/teslim, çevrimiçi yenileme/devam, puan ve DB, süreli sınav, tam çevrimdışı teslim kuyruğu; gerçek resim ve karıştırma; yabancı/atanmamış/yayımlanmamış sınav engeli, cevap anahtarı gizliliği | S-B01 gönderilmemiş çevrimdışı cevap kaybı; S-B02 olmayan sınavdan yanlış dönüş; diğer geri düğmesi varyantları kaynak adayı |
| `/student/results` | Kendi sonuçları, arama, puan filtreleri, sıralama/sıfırlama, yenileme; gerçek XLSX/yazdırma PDF | S-B06 kategori seçimi sonucu gizler |
| `/student/stats` | Gerçek kategori adlarıyla çizelge, istatistik, mobil/yenileme, gerçek XLSX | Başarı eşiği tutarlılığı kaynak adayı; sistem yazdırma diyaloğu sınanmadı |
| `/student/surveys` | Atanmış anketler, karttan erişim, gerçek boş veri, yenileme | S-B05 kontrollü500 boş liste gibi gösteriliyor |
| `/student/survey/:id` | Açık metin, puan, tekli/çoklu seçim, Likert: gerçek201, beş cevap DB'de, yeniden açma, tekrar teslim409; zorunlu/geçersiz veri ve yabancı erişim engeli | Metin kontrolü etiketi ve seçim semantiği ARIA iyileştirmesi; bütün hata türleri için ayrı UX sınanmadı |
| `/announcements` | Öğrenci/sınıf görünürlüğü, öğretmene özel içeriğin gizlenmesi, öğrenci ekleme/silme yetkisinin engellenmesi, mobil/yenileme | Canlı socket ve e-posta teslimi sınanmadı |
| `/settings` — Profil | Gerçek alanlar, öğrenci profil güncelleme engeli403, yenileme | Öğrenciye kapalı yönetici işlemleri başarı sayılmadı |
| `/settings` — Güvenlik | Yanlış/eski/eşleşmeyen parola hataları, gerçek parola değişimi, bağımsız ikinci oturumun iptali, yeni giriş ve geri yükleme | Doğal süre aşımıyla sınav ortasında oturum sonlanması sınanmadı |
| `/settings` — Bildirimler | Tercih kaydı/yenileme, tekli/toplu okundu, silme, sayfalama, yabancı ID403/404 | Başlık bildirim menüsündeki bütün ağ hataları ayrı sınanmadı |
| `/settings` — İşlem kayıtları | Kendi kayıtları, tarih sorgusu ve API sayfalama, yabancı kayıt gizliliği | Büyük veri/perf yük testi yapılmadı |
| `/notifications` | Ayrı sayfa, veri/yenileme, gerçek işlemler ve mobil | Harici bildirim sağlayıcıları sınanmadı |
| `/activity-logs` | Ayrı sayfa ve kendi kayıtları, mobil/yenileme | Bütün filtre kombinasyonları sınanmadı |
| Ortak gezinme/oturum | 12 rota/alias gerçek veriyle yüklenip yenilendi; klavye, tema, logout, CSRF, yetkisiz ve yanlış rol yönlendirmesi | Bu kontroller genel güvenlik sertifikası değildir |

İki son gezinme grubunda gözlenen sayfa/konsol hataları ve başarısız API istekleri sıfır; yatay taşma ve kalan yükleme göstergesi yok: [grup1](navigation-observations-1.json), [grup2](navigation-observations-2.json). Bu ölçüm 390px mobil görünüm ve sınanan etkileşimlerle sınırlı; derinlik testleri ayrıca 375px kullandı. `navigation-observations.json` ilk, yetersiz yükleme beklemeli tarihsel smoke kaydıdır; güncel sonuç olarak kullanılmamalıdır. Görsel ve ARIA kanıtları `screenshots/` altındadır. Sesli gerçek ekran okuyucu kapsam dışıdır; klavye ve erişilebilirlik ağacı denetlendi.

Taşma kontrolü dış belge genişliğini ölçer; mobil sınav tablosu kendi alanında yatay kaydırılır. Koordinatör mobil sınav listesini, çevrimdışı cevap kaybı ekranını, PDF render'ını ve gerçek Graphify öğrenci bilgi panelini görsel olarak inceledi. Bütün ekranların her renk/ölçek/cihaz varyantı incelenmiş sayılmaz.

## Dosya çıktısı ve soru türleri

[XLSX/PDF doğrulaması](export-verification.json) gerçek indirilen dosyaları inceler: XLSX ZIP/XML yapısı, beklenen başlık ve sıfır doğru cevap, yabancı sonucun yokluğu; Chromium yazdırma PDF'sinde beklenen metin ve bütün sayfaların pypdfium2 ile render edilmesi geçti. [Birinci sayfa](print-render/student-results-page-1.png) görsel olarak okundu; taşma yok. Fiziksel yazıcı, işletim sistemi diyaloğu ve çok büyük sonuç listelerinin sayfa bölünmesi test edilmedi. İstatistikte “PDF İndir” window.print açar; etiketi UX önerisidir.

Mevcut sınav soru yazma doğrulayıcısı yalnız çoktan seçmeli türü kabul eder. Doğru/yanlış testi izole DB'deki eski tip kaydın öğrenci görüntüleme/puanlama uyumluluğunu doğrular; öğretmen GUI'sinin bu türü oluşturduğu iddia edilmez. Kısa cevap alanı yeni özellik sayılır: gerçek öğretmen API'si kısa cevap ve doğru/yanlış yazımını400 ile reddetti, DB değişmedi. Resim denemesi gerçek favicon kaynağıdır; öğretmen yükleme hattının bütün aşamaları değildir.

## Koşu geçmişi ve hatalı varsayımların düzeltilmesi

| Koşu | O koşudaki toplam / geçen / kalan | Değerlendirme |
|---|---|---|
| browser | 18 / 13 / 5 | İlk gerçek tarayıcı; offline kayıp. Yanlış rol rota varsayımı ve yazdırma medyası kaynaklı test hataları daha sonra düzeltildi. |
| depth | 24 / 13 / 11 | Altı kusurun çoğu bulundu. `networkidle`, kategori cache, çoklu seçim sıra varsayımı ve oturum rate-limit etkisi aşağıdaki şekilde ayrıştırıldı. |
| closure | 13 / 10 / 3 | Boot kategorisiyle filtre kusuru tekrarlandı; shared derinlik geçti. İlk kök rota15s bekleme yetmedi. |
| completion | 16 / 14 / 2 | İki yüklenmiş rota grubu, beş anket türü ve export geçti. Yanlış dönüş yeniden doğrulandı; kısa cevap beklentisi mevcut validator'a göre yeniden tanımlandı. |
| verification | 4 / 4 / 0 | Son soru türü ve yükleme sonrasındaki hata gözlemi doğrulandı. |
| review | 1 / 1 / 0 | Bağımsız inceleme sonrası ID'siz yeni soruyla400'ün doğru validasyon mesajı doğrulandı; eski raporu reddeden runner gerçek koşuda çalıştı. |

Bu satırlar farklı kapsamlardır; toplamları nihai kapsam sayısı değildir. `results-*.json` ve `runner-*.json` tarihsel kanıtı korur. İlk sandbox tarayıcı spawn EPERM koşusu test yürütmedi; ürün kusuru sayılmadı ve kalıcı rapora alınmadı. İzinli runner ile gerçek Chromium koşuları yapıldı.

Kalıcı socket trafiği nedeniyle `networkidle` yerine gerçek veri görünümü beklenir. `/user-management` kayıtlı olmayan rota olduğundan yanlış-rol kontrolü `/management` ile yapıldı. Yazdırma sonrası screen medyası geri alındı. Çoklu seçim değerleri sıra yerine küme olarak karşılaştırıldı. Yeni Prisma kategorisi cache'e girmeyince fixture boot kategorisi kullanıldı; filtre kusuru bu düzeltmeden sonra da kaldı. 20 giriş/15dk limiti kaldırılmadı; geçerli oturum yeniden kullanıldı, ikinci cihaz için ayrı cookie üretildi. Kök rota fresh koşuda gerçek veriyle30s sınırında geçti; tek15s timeout performans kusuru sayılmadı.

## Yeniden çalıştırma

Depo bağımlılıkları ve Playwright Chromium kurulu olmalı. 5540/5541 boş olmalı; runner mevcut port sahibini sonlandırmaz. Native Windows PowerShell:

```powershell
$env:STUDENT_AUDIT_RUN='recheck'
node scripts/student-audit-windows-runner.mjs
node --test scripts/student-audit-report-sanitize.test.mjs scripts/student-audit-windows-runner.test.mjs
node scripts/student-audit-summary.mjs
```

Bilinen kusurlar düzeltilmediği sürece tam E2E koşusunun başarısız çıkması beklenir. Özetleyici audit sırasında sabitlenmiş altı koşuyu kullanır; yeni recheck JSON'u otomatik güncel sonuç sayılmaz, liste açıkça güncellenmelidir. Kesilen testler başarısız sayılır; tanımsız durum toplam uyuşmazlığıyla reddedilir. Runner Playwright öncesi eski geçici raporu kaldırır ve yeni rapor başlangıcını kontrol eder. PDF doğrulaması pypdf ve pypdfium2 bulunan Python ile `scripts/student-audit-export-verify.py` üzerinden yapılır. Sansür/port koruma birim testleri:5 geçti, Windows symlink kontrolü1 atlandı; ürün E2E kapsamındaki0 atlama ile karıştırılmamalıdır.

Backend/frontend `type-check` ve `pnpm build` çıkış0 verdi. Vite ortak API modülünün hem statik hem dinamik import edilmesi ve 1.46MB ana JS paketi için uyarı verdi; bu, ölçülmüş kullanıcı gecikmesi veya yük testi kanıtı değildir.

## Öncelikli sonraki plan

Önce S-B01 yerel cevap uzlaştırması; sonra S-B02/S-B03 öğrenci dönüş rotaları; S-B06 kategori değeri; S-B04/S-B05 hata/boş durum ayrımı. Her onarım için bulgular belgesindeki kabul kriterleri ve mevcut kırmızı E2E yeniden çalıştırılmalı. Ardından anket etiket/seçim semantiği, klavye/dokunmatik ikonları ve tutarlı başarı eşiği. Sayfa bazında fayda/efor planı [bulguların sonunda](findings.md) yer alır. Diğer paneller henüz bu öğrenci raporuyla doğrulanmış sayılmaz.
