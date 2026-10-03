# Öğretmen paneli doğrulama raporu — 3 Ekim 2026

**Güncel durum — 4 Ekim:** T-F01/T-F02 düzeltildi ve beş anket tipinin içerik düzenleme/reload/reopen kabulü native Windows Chromium'da tamamlandı. Son hedefli kohort **4/4**, birim regresyon **9/9**, iki gerçek XLSX ve iki PDF kontrolü geçti. [Düzeltme ve kapanış raporu](defect-repairs.md). Aşağıdaki eski kohortlar ve ilk bulgular tarihsel kanıttır; ayrı UX bulguları ve sınanmamış diğer varyantlar hâlâ açıktır.

Linux/WSL kurulum kabulü tamamlandıktan sonra öğretmen paneli gerçek Chromium, gerçek Vite/API ve her koşuda yeni SQLite verisiyle incelendi. **Bütün özellikler hatasız kabul edilmedi.** Doğru cevap sayısının boş gösterilmesi ve parola sıfırlamada bekleyen isteğin yeniden gönderilebilmesi doğrulanmış işlevsel sorunlardır. Önizleme onay metni ayrıca yanıltıcıdır. Bu aşamada öğretmen ürün kodu değiştirilmedi; test altyapısı, kanıtlar ve çözüm planı eklendi.

## Kurulum ön koşulu ve izolasyon

Ubuntu **22.04.5 LTS / WSL2**, native **Node 22.23.2**, **pnpm 9.15.1** ve gerçek Linux Chromium kullanıldı. Gerçek `kurulum.sh` → bootstrap → paket kurulumu → web sihirbazı → iki build/14 migration/ilk admin → kalıcı ayarlar → yeniden kurulum 409 → API ve Vite arayüzünden admin girişi **1/1 geçti**. Dört sahipli süreç ağacı ve dört geçici port temizliği doğrulandı. [Kurulum kanıtı](../admin-audit/evidence/closure/hybrid/linux-wsl-first-passed/result.json), [kurulum kapsamı](../admin-audit/hybrid-setup-closure.md).

Öğretmen API/UI portları **5530/5531**. Fixture, `server/data/quizmaster-test-teacher-audit-*` altında bağımsız `audit.db`, uploads ve session veritabanı oluşturur; sunucu çalışma dizini de bu ağaca taşınır. Gerçek kullanıcı verileri, anahtarları veya SMTP/AI servisleri kullanılmadı. İki öğretmen, iki sınıf, 14 kendi öğrencisi, yabancı öğrenci/sınav/sonuç, sıfır ve yüz puan, 26 bildirim ve 55 işlem kaydı bulunur. Class/category/survey filtre ID'leri gerçek UUID sözleşmesine uygundur.

Ürün `server/data/quiz.db` SHA256 değeri çalışma öncesi/sonrası aynı: `8210a4b79f2cfb9cf74de6a4989f5c8a5449ba1d17b2332abdbd018c3741a158`. Kullanıcının `api.ts` ve `server-setup.tsx` değişiklikleri korundu ve bu çalışma commit'ine alınmadı. Raw log, cookie, session, DB, env, tarayıcı storage ve trace paylaşılmadı. Kalıcı Playwright JSON raporları gizli değer temizliğinden geçirilir.

## Test kayıtları nasıl okunmalı?

| Koşu | Geçen / başarısız | Açıklama ve kanıt |
|---|---|---|
| İlk kapsam, 70 test | **57 / 13** | [JSON](results-initial-70.json). Bir Recharts gizli span locator çakışması; son 12 hata kullanıcı başına 1000 istek/15 dakika global limiter ve devamındaki yönlendirme/eksik kontrol zinciri. Bunlar tek başına ürün hatası değildir. |
| Paylaşılan işlevler + ilk PDF + iki hedef, 19 test | **17 / 2** | [JSON](results-shared-print-19.json). 13 ortak işlev ve 4 PDF testi geçti. Çıkış beklentisi yanlış `/auth` idi; gerçek davranış public `/`. Önizleme testinde onay düğmesine basılmamıştı. |
| Öğrenci/sonuç + ek sınırlar, 16 test | **13 / 3** | [JSON](results-people-edge-16.json). Reset bekleme kusuru; fixture survey ID'nin UUID olmaması; çıkış yanıtı tamamlanmadan kontrol edilmesi. Önizleme tamamlama/veri yazmama geçti. |
| Anket filtre/export ve gerçek UI çıkışı, 2 test | **2 / 0** | [JSON](results-focused-final-2.json). UUID fixture, canonical open-text; logout HTTP yanıtı beklenerek gerçek UI akışı doğrulandı. |
| Animasyon sonrası PDF, 4 test | **4 / 0** | [JSON](results-print-final-4.json). Altı gerçek PDF; metin ve görsel kontroller aşağıda. |
| Dashboard ve editör derinliği, 6 test | **4 / 2** | [JSON](results-depth-6.json). Dashboard/API, kartlar, geçersiz tarihler ve gerçek görsel yükleme geçti. Doğru cevap raporu kusuru; survey GET'in `correctAnswer` alanını bilinçli kaldırmasına uymayan test beklentisi. |
| SVG kararlılığı + anket birleşik tekrarı, 5 test | **2 / 3**, cleanup başarısız | [JSON](results-stability-5.json), [runner](runner-stability-5.json). Anket/iki PDF süre aşımları; kayıtlı süreçler yokken5530/5531 EADDRINUSE. Daha sonraki salt okunur socket kontrolünde listener görülmedi. Bu koşu başarılı kabul edilmedi. |
| Son hedef tekrar, 6 test | **4 / 2**, cleanup başarılı | [Araç çıktısı özeti](evidence/infrastructure/last-target-run-tool-summary.json). Dört PDF tekrar geçti; iki bilinen kontrol başarısız. Anket testi line86 seçicisinde seçilmedi; all5 sonucu değildir. Son guest JSON/PDF kopyası daha sonra WSL erişimi kesildiği için alınamadı. |

Son ek koşular, aynı başlıklı testlerin tekrarlarıdır; bu tablo birleştirilmiş tek bir başarılı suite değildir. Her koşuda yeni fixture ve gerçek güvenlik limitleri kullanıldı; limiter devre dışı bırakılmadı. En son hedef sonuçları aşağıdaki kapsamda ayrıca değerlendirilir. Oturum önbelleği gerçek `/auth/me` ile doğrulanır; 401'de yeniden gerçek giriş yapılır, diğer hatalar saklanmaz.

## Sayfa ve sekme bazında kapsam

[29 satırlık takip listesi](inventory.md) kaynakta bulunan bütün rotaları, sekmeleri ve kalan işlem varyantlarını ayrı saklar. İlk koşuda **17 rota × masaüstü/mobil = 34** doğrudan erişim, sayfa yenileme ve sekme geçişi kontrolü geçti. Mobil **390×844**, masaüstü **1280×720**; bu rota kayıtlarında uncaught/console/başarısız istek/beklenmedik API hata sayıları **0**, belge genişliğinde taşma yok. Sekme klavye geçişi, menü odak/Escape/backdrop ve temel navigasyon ayrı test edildi. Bu sonuçlar tüm renk kontrastı veya her modal kombinasyonu için erişilebilirlik sertifikası değildir.

| Sayfa / sekme | Doğrulanan işlemler | Sonuç / kalan sınır |
|---|---|---|
| Dashboard `/` | KPI ve son katılım gerçek `/dashboard/stats` + `/overview` ile karşılaştırma; kendi sınıf kartı, yeni sınav, işlem geçmişi bağlantıları | Geçti. Atamasız/yalnız ders öğretmeni/sorumlu öğretmen varyantları ayrı sınanmadı. |
| Sınavlarım `/quizzes` | Arama/açıklama, temizle, ders/sınıf filtreleri, 10 kayıt sayfalama, taslak düzenle, yayınla→taslak, gerekçeli sil/iptal, API/reload; yabancı öğretmen GET/PATCH/PUT/DELETE engeli | Geçti. Ayrı listede sıralama kontrolü yok; özellik eksikliği hata olarak sayılmadı. |
| Sınav oluştur/düzenle — **Sınav Ayarları, Sorular** | Eksik başlık, ders/sınıf, süre/karıştırma; gerçek taslak oluştur/güncelle/yayınla; soru/seçenek ekle-sil, yinelenen seçenek, doğru cevap indeks devamlılığı; gerçek PNG→WebP upload, kaydet/reopen/reload/asset GET | Geçti. Yanıtsız kayıt/idempotency'nin tüm öğretmen varyantları ve her limit sınırı yeniden çalıştırılmadı. |
| Sınav Sonuçları — **Genel Bakış, Öğrenci Raporları** | Filtre/reset, sıfır puan, öğrenci raporları, gerçek Excel içeriği, tam/filtreli PDF, klavye sekmeleri, reload | **T-F01 KAPANDI:** doğru/toplam, reload, filtre, gerçek XLSX/PDF geçti. Aramada kalıcı etiket UX önerisi sürüyor; bkz. defect-repairs.md. |
| Sınıf İstatistikleri `/statistics` | Sınıf/tarih/API katılım-ortalama, Excel/PDF; geçersiz tarih/API400/UI hata, export disabled; yükleniyor/500/yeniden dene | Geçti. Çok sınıflı ağırlıklı ortalama, tamamlanmamış deneme ve tarih sınırlarının tüm varyantları sınanmadı. |
| Anket Yönetimi — **Sonuçlar** | Canonical açık metin yanıtı, anket/tarih/reset, gerçek CSV içeriği ve kendi anketi; kontrollü hata/retry | Geçti. Her soru türünde gerçek öğrenci gönderimi bu öğretmen denetiminin konusu değildir. |
| Anket Yönetimi — **Anket Oluştur → Anket Ayarları / Sorular** | İlk suite açık metin/rating ile gerçek oluştur/yayınla. Ek test beş canonical tipi GUI'de oluşturup yayınladı; API beş tip döndürdü. GET'te absent `correctAnswer` yanlış test beklentisi düzeltilmiştir | **KISMİ; BLOCKED kalktı:** beş tipin içerik düzenleme/API/readback/ikinci reload-reopen kabulü native Windows Chromium ile geçti. Diğer hedef sınıf/tip dönüşümü varyantları tamamlandı sayılmaz. |
| Öğrenciler `/students` | Kendi sınıfı, arama/filtre, detay/klavye geri, Excel, yükleniyor/500/retry; yabancı öğrenci reddi; admin CRUD düğmelerinin bulunmaması | Geçti. Öğretmende kullanıcı yönetimi UI'si varmış gibi test üretilmedi. |
| Sınıflarım `/classlist`, sınıf detayı | Sadece atanmış sınıf; arama, kart/detay/geri, öğrenci filtre, Excel, tam/tek öğrenci PDF; yabancı ve eksik sınıf API sınırları | Geçti. Yönetici sınıf atama/kapasite CRUD'u kapsam dışı. |
| Öğrenci analizi, sonuç detayı | Arama/puan filtresi, boş veri/reset, sıfır puan, soru/yanıt, incele, Excel/PDF; yabancı/eksik sonuç reddi; studentId yok doğrudan rota | Geçti. Öğretmene admin-only veli/öğrenci düzenleme sekmeleri gösterilmiyor. |
| Sınav önizleme + eski rota | Doğrudan erişim/redirect; bitir/onay, tamamlandı; sonuç listesinin önce/sonra aynı kalması | İşlev geçti. **T-U02:** onay metni sonuç kaydedileceğini yanlış söylüyor. Çok sorulu önceki/sonraki ve çevrimdışı öğrenci sınavı ayrı sınanmadı. |
| Duyurular `/announcements` | Yeni duyuru, validasyon, kendi sınıf hedefi, API/reload; öğretmen silme403; yalnız yeni test kaydının admin ile temizliği | Geçti. Gerçek e-posta/Socket teslimi kapsam dışı. |
| Ayarlar — **Profil** | Ad değiştir/kaydet/API/navbar/reload ve fixture adını geri yükle | Geçti. E-posta/telefon/adres/duplicate alanların tüm kombinasyonları sınanmadı. |
| Ayarlar — **Bildirimler** + bell | Ses tercihi/cache/reload, 26 kayıt sayfalama, okundu/sil, diğer öğretmenin bildirimini silme reddi | Geçti. Gerçek ses çalma ve canlı Socket olay teslimi doğrulanmadı. |
| Ayarlar — **İşlem Geçmişi** | 55 kendi kaydı, 50 kayıt sayfalama, diğer öğretmenin geçmişinin dışlanması | Geçti. Altı aylık sınır, boş/hata ve ayrı history PDF varyantı sınanmadı. |
| Ayarlar — **Güvenlik** | Uyumsuz parola/yanlış mevcut parola, gerçek değişiklik/yeni giriş/eski oturum sınırı/restore; tab deep link, invalid fallback, back/forward | Geçti. Parola politikalarının her sınır değeri bu koşuda çalıştırılmadı. |
| Ortak shell, auth/public | Tema kalıcılığı, mobil menü/fokus; gerçek UI login ve güvenli çıkış, yanlış parola; server session'ın cookie korunarak süresinin dolması401/UI redirect; admin/veli/öğrenci yasak rota/API; reset eksik/geçersiz token | **T-F02 KAPANDI:** bekleme, tek gönderim ve hata sonrası retry geçti. SMTP geçerli/expired reset token teslimi kapsam dışı. |
| UI dışındaki ilgili servis yüzeyi | Öğretmenin question-bank API create/list/delete; geçersiz/yüksek boyutlu upload400; AI boş konu disabled, anahtarsız custom HTTPS yerel500, güvensiz HTTP400 | Geçti. Soru havuzu için ayrı UI yok; gerçek dış AI üretimi yapılmadı. |

## Doğrulanmış işlevsel hatalar

### T-F01 — Öğrenci raporunda doğru cevap sayısı boş (orta; 4 Ekim KAPANDI)

- **Yer:** `/results` → Öğrenci Raporları → Doğru/Toplam.
- **Yeniden üretim:** Bir sorulu tamamlanmış, doğru cevap sayısı 0 veya 1 olan sonucu açın; rapor sekmesine geçin. İzole fixture'da 14 sonuçta görülür.
- **Beklenen / gerçek:** `0 / 1`, `1 / 1` → `/ 1`. Yüzde puan doğru görünse bile doğru sayısı ve PDF raporu eksiktir.
- **Kanıt:** [Başarısız gerçek assertion](results-depth-6.json), [tam PDF görüntüsü](evidence/print/teacher-results-all-page-1.png), [PDF](evidence/print/teacher-results-all.pdf). `client/src/pages/results.tsx:572` `res.correctAnswers` okur; sonuç API'si `correctAnswersCount` döndürür. Aynı dosyadaki CSV dönüşümü mevcut doğru alanı kullanır.
- **Önerilen kod çözümü:** Ortak typed sonuç modeli üzerinden `correctAnswersCount` kullanın; eski alan gerekiyorsa açık nullish fallback yapın, sıfırı koruyun. API alanını kırarak bütün istemcileri değiştirmeyin.
- **Kabul:** Gerçek API ile iki satır için 0/1 ve 1/1 eşleşir; yüzde, CSV, filtre ve PDF değişmez; sıfır için truthy fallback yok. Mevcut depth testi ve yeni filtered PDF kontrolü geçer.

### T-F02 — Parola sıfırlama isteği beklerken düğme kilitlenmiyor (orta; 4 Ekim KAPANDI)

- **Yer:** Öğretmenin kullandığı ortak `/reset-password` → Şifreyi Güncelle.
- **Yeniden üretim:** Geçersiz sentetik token ile eşleşen geçerli parola yazın; gerçek reset API isteğini geciktirin ve gönderin. İstek gözlenip henüz bırakılmamışken düğme etkin kalır.
- **Beklenen / gerçek:** Tek bekleyen istek, disabled düğme ve Güncelleniyor göstergesi → etkin Şifreyi Güncelle düğmesi, tekrar gönderim mümkün.
- **Etki:** Yavaş bağlantıda yinelenen istek, anlaşılmayan işlem durumu ve rate-limit tüketimi. Geçersiz token backend'de400 ile güvenle reddedilir; yetki aşımı iddia edilmiyor.
- **Kanıt:** [Bekleme durumu](evidence/edge/reset-pending.json), [ekran](evidence/edge/reset-pending.png), [assertion](results-people-edge-16.json). `client/src/pages/reset-password.tsx` isLoading'i false tanımlar/finally false yapar; geçerli gönderim öncesinde true yapmaz.
- **Önerilen kod çözümü:** Validasyondan sonra API çağrısından önce loading true; bekleyen gönderime guard; finally false. Başarısız istekte form verileri korunmalı.
- **Kabul:** Gecikmiş gerçek istekte disabled+loading; ikinci tıklama ikinci POST üretmez;400/hata sonrası tekrar etkin; başarılı sıfırlama yönlendirmesi korunur. Edge testi geçer.

## UX iyileştirmeleri

**T-U02 — Önizleme onayında yanıltıcı kayıt mesajı (orta, küçük efor):** Önizlemeyi Bitir düğmesine basınca banner “Sonuçlar kaydedilmeyecektir” derken onay “cevaplarınız kaydedilecek” diyor. [Gerçek ekran](evidence/routes/preview-confirmation.png), `student-quiz.tsx:585–594`; önizleme tamamlanınca API sonuçları değişmedi. Role/preview koşuluna göre onay açıklamasını ayırın. Kabul: öğretmen önizlemesinin modalı kayıt olmayacağını ve sınav listesine dönüşü doğru açıklar; öğrenci gerçek gönderim metni korunur.

**T-U01 — Sonuç aramasında kalıcı açık etiket eksik (düşük, küçük efor):** Placeholder yazınca kayboluyor. [Accessible tree](evidence/edge/accessible-names.json) tarayıcının placeholder'dan ad ürettiğini gösterir; “adsız” veya gerçek ekran okuyucu hatası iddia edilmiyor. Görünür bağlı label eklenmesi önerilir. [Ayrıntılı kanıt/kabul](findings-source.md).

**T-U03 — Öğrenci PDF'sinde uzun kod kırpılıyor (düşük, küçük efor):** Sentetik uzun öğrenci ID'si [öğrenci PDF görüntüsünde](evidence/print/teacher-student-zero-page-1.png) `teacher-` olarak kalıyor. Ad, sınıf ve numara doğru; uzun kodun tam okunması için print stilinde wrap/min-width düzeni önerilir. Kabul: UUID ve uzun kod bütünü görünür, tablo taşmaz. Her gerçek okul kodunun kırpıldığı iddia edilmiyor.

**T-U04 — Anlık PDF'de istatistik grafiği geçiş geometrisi (orta):** CSS animasyonunun bitmesi, Recharts'in JavaScript/SVG animasyonunun bitmesi değildir. Viewport/print değişiminden kısa süre sonra alınan [PDF](evidence/print/statistics-before-svg-stability.pdf) ve [gerçek render](evidence/print/statistics-before-svg-stability.png) sütunların eksen/legend altına uzadığı ara kareyi gösterir; sayı tablosu doğrudur. Test daha sonra gerçek SVG geometrisinin kararlılığını gözler ve dört PDF kontrolü tekrar geçer; son guest PDF'nin tekrar renderi WSL erişimi kesilince alınamadı. Bu, bütün baskılarda kalıcı grafik bozulması iddiası değildir. Ürün çözümü: print sırasında grafik animasyonunu kaldırma ve print boyutuna göre kararlı layout sağlama; fiziksel print/button akışı ayrıca doğrulanmalı. Kabul: hızlı yükleme/filtre/print geçişinde gerçek PDF sütunları doğru eksen alanında kalır ve oranları temsil eder.

Editördeki ham `unnamedButtons: 1` sayacı ürün hatası sayılmadı: gerçek checkbox `Teacher Audit 7A` adıyla bulunur; HTML label ilişkisi tarayıcı ağacında doğrulandı. Sesli ekran okuyucu doğrulaması kullanıcı kararıyla kapsamdan çıkarılmıştır; label/keyboard desteği kaldırılmamıştır.

## Çıktı ve görsel doğrulama

Öğrenci/sınıf/sonuç/istatistik XLSX ve anket CSV gerçek download üzerinden parse edilip filtre, öğrenci kimliği ve sıfır puan karşılaştırıldı. Altı PDF gerçek Chromium `page.pdf` ve ürün print CSS'iyle üretildi: 14 satırlı/tek öğrencili sonuç ve sınıf, öğrenci sıfır puan analizi, sınıf istatistiği. Navbar ve form kontrolleri gizli; filter metadata, kendi veri kapsamı ve satır genişliği kontrol edildi.

[PDF metin/render sonucu](evidence/print/pdf-verification.json) her dosyanın beklenen metnini, yabancı veri bulunmamasını ve bütün sayfaların renderini ayrı kaydeder. Koordinatör altı renderi görüntüleyerek okudu. **Metin/DOM testinin geçmesi bütün alanların doğru olduğu anlamına gelmez:** T-F01, T-U03 ve T-U04 gerçek görsel kontrolden ayrıca açıldı. İlk anlık PDF'de fading panel rasterize olmuştu; [ilk extraction kaydı](evidence/print/pdf-extraction-before-animation.json) saklandı. Güncel test, gerçek giriş/SVG animasyonu ve resize kararlılığını bekler; ürün grafiği veya render taklit edilmez. Son kararlı guest PDF kopyası alınamadığı için eldeki artefaktlar bütün görsel sorunların çözüldüğü kanıtı değildir. Fiziksel yazıcı/OS print diyaloğu doğrulanmadı.

## Öncelikli geliştirme planı

| Sıra | İş / kod değişikliği | Fayda | Efor / başarılı sayılma |
|---|---|---|---|
| 1 | **TAMAMLANDI:** T-F01 typed canonical rapor alanı | Öğretmen karnesi ve çıktı doğruluğu | Küçük; 0/1+1/1 real API/UI/PDF assertions geçmeli |
| 2 | **TAMAMLANDI:** T-F02 reset loading+duplicate guard | Tek gönderim ve anlaşılır bekleme/hata kurtarma | Küçük; gecikmiş istek ve retry testi geçmeli |
| 3 | T-U02 preview onay açıklamasını role göre ayır | Kaydedilme konusunda güvenilir geri bildirim | Küçük; öğretmen/student modal sözleşmeleri ayrı |
| 4 | T-U04 print grafik kararlılığı; T-U01 search label, T-U03 kod wrap | Grafik güvenilirliği, okunabilirlik ve alan bağlamı | Küçük/Orta; hızlı print gerçek PDF, erişilebilir ad+390px ve uzun kod |
| 5 | Assignment varyantları, çok sınıf/unfinished istatistik, profil alan validasyonu, canlı Socket gibi kalan kapsamı genişlet | Örneklenen veri dışında güveni artırır | Orta; [envanterde](inventory.md) kalan işlemler tek tek kanıtlanır |

Her menü sayfasının **yeni özellik önerileri** fayda/efor tablosuyla [ayrı kaynak/UX belgesindedir](findings-source.md). Bunlar doğrulanmış hataların onarımından sonra değerlendirilmeli; öğretmene yeni admin yetkisi kazandırılması önerilmiyor.

## Son ortam sınırı

Beş soru tipinin bütün edit/reopen akışı için test adıyla ayrı tekrar denendi; yeni WSL komutu startup çıktısı üretmedi. Son başarılı koşunun guest JSON/PDF'sini kopyalama komutu da yanıt vermedi; Windows UNC yolu üzerinden guest dosyasına erişilemedi. Bağımsız salt okunur [WSL listeleme probu](evidence/infrastructure/wsl-availability.json) **15 saniyede tamamlanmadı**. Yalnız bu göreve ait, PID/parent/creation/command kimliği doğrulanmış iki Windows WSL child başlatıcı kapatıldı; parent başlatıcılar da çıktı. [İptal kaydı](evidence/infrastructure/wsl-launcher-cancellation.json). WSL servisi/global shutdown, başka işler veya okul verisi değiştirilmedi. Bu yeni, başlangıcı izlenemeyen guest denemesinin Linux süreç temizliği **doğrulanamadı**; eski başarılı koşuların temizliği bunun yerine kullanılmaz.

Bu ortam sınırı, daha önce tamamlanan **gerçek Linux kurulum 1/1** kabulünü geçersiz kılmaz. Öğretmen T11/T12 edit/reopen kapsamını tamamlanmış yapmaz. Yeni ortam erişimi sağlanınca `teacher-editor-depth-audit.spec.ts --grep "survey GUI"` adıyla tekrar gerekir; hatalı line86 seçicisi kullanılmamalı.

## Yeniden çalıştırma ve sınırlar

Native Linux staging'de bağımlılıklar ve Chromium kurulduktan sonra `node scripts/teacher-audit-runner.mjs <spec-dosyası>` çalıştırın. Örneğin `teacher-quizzes-audit.spec.ts`, `teacher-people-results-audit.spec.ts`, `teacher-shared-audit.spec.ts`, `teacher-print-audit.spec.ts` ayrı yeni server/fixture koşularıdır. Route spec'i gerektiğinde desktop/mobile olarak `--grep` ile bölün; 84 kontrolü tek kullanıcı/15 dakika penceresine sıkıştırmak normal limiter'a takılabilir. Her koşunun JSON'ını sonraki koşu üzerine yazmadan farklı isimle saklayın. Süreç kimliği/PID tekrar kullanımı doğrulanarak yalnız runner'ın süreçleri kapatılır;5530/5531 bind+close ile boş olduğu kanıtlanır.

AI sağlayıcı başarı yanıtı, gerçek SMTP reset/duyuru teslimi, canlı Socket olayları, fiziksel yazıcı, kapsamlı renk kontrastı ve sesli ekran okuyucu bu denetimde başarılı sayılmadı. Linux kabulü WSL2 içindir; çıplak Linux/VPS, domain/Nginx/TLS ve OS tarayıcı açma ayrı kapsamdır. Beklenen401/403/400/yerel500 testleri kontrollü kanıtlardır; normal rota taramasının hata sayısına karıştırılmaz. Performans için yalnız belirgin kilitlenme ve yükleme sonlanması gözlendi; gerçek yük testi/LCP bütçesi çalıştırılmadı.

Son Windows commit öncesi birim tekrarında ilk native Fetch hazır olma kontrolü, yalnız testteki 300 ms sınırında zaman aşımına uğradı (6 geçti, 1 başarısız, 1 Windows symlink atlaması). Kaynak değişmeden ikinci koşu 7 geçti, 0 başarısız, 1 atlama; ilk Fetch 118.7 ms sürdü. Üretim bekleme sınırı 120 saniyedir. Bu süreye duyarlı test altyapısı sınırı çözülmüş ürün hatası sayılmaz; [iki koşunun kaydı](evidence/infrastructure/final-source-verification.json) saklandı.
