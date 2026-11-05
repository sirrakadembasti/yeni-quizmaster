# Yönetici denetimi — sınav, anket ve raporlar

> **Tarihsel denetim kaydı (30 Eylül 2026).** Aşağıdaki bulgular, satır numaraları, test sayıları ve açık durum ifadeleri ilk denetim/önceki paketlerin kaydıdır; güncel çalışma ağacının durumunu göstermez. [Onarım sözleşmeleri](./repair-contracts.md) kabul edilen davranışları, [onarım doğrulama kaydı](./remaining-repairs-verification.md) önceki paketin tamamlanmış istemci/sunucu/E2E kanıtlarını belirtir; fork tekrarı ve yeni E2E artık beklemiyor. [Sonraki doğrulama kaydı](./verification-closure.md) güncel Excel, baskı, erişilebilirlik ve gerçek hibrit kurulum kapsamını açıklar. Öğretmen paneli denetimi henüz başlamadı.

Tarih: 30 Eylül 2026. Kapsam yalnız yönetici hesabının erişebildiği işlevlerdir. Üretim kodu değiştirilmedi; gerçek uygulama veritabanında oluşturma, güncelleme veya silme yapılmadı. `api.ts` ve `server-setup.tsx` dosyalarındaki önceden bulunan değişikliklere dokunulmadı.

Kanıt türleri: **Kod doğrulandı** = istemci/API/veri katmanı birlikte izlendi; **API probu** = Express rotası sahte storage ve yönetici kimliğiyle çalıştırıldı, gerçek DB kullanılmadı; **Tarayıcı bekliyor** = kullanıcı etkileşiminin tarayıcı doğrulaması ana denetim tarafından yapılmalı. Aşağıdaki kod bulguları otomatik olarak tarayıcıda yeniden üretilmiş sayılmaz.

## Sekme ve eylem envanteri

| Ekran | Yönetici sekmeleri/eylemleri | Okuma/davranış kontrolü |
|---|---|---|
| `/dashboard` | Sistem Ayarları, Öğretmenleri Yönet, dört toplam kartı, son beş katılım grafiği, Tüm Sınavları Görüntüle, son aktiviteler/Tümünü Gör | Yönlendirmeler, gerçek/boş/hata verisi, sayaç tutarlılığı, mobil grafik |
| `/admin-quizzes` | Başlık/ders arama, önceki/sonraki sayfa, satır menüsü Düzenle/Sil, kalıcı silme onayı/iptal | Öğretmen sınavları dahil tüm sınavlar, durum, sahip, sınıf, silme hata durumu |
| `/quizzes` | Yeni Sınav, başlık/açıklama arama, ders/sınıf filtresi, filtre temizleme, yazdırma, Önizle, Düzenle, neden girerek Sil, sayfalama | Bu ekran yöneticiye kendi sınavlarını getiriyor; global yönetim ekranından ayrı kapsam |
| `/create-quiz`, `/quizzes/:id` | Ayarlar, Sorular, Yapay Zeka; başlık/açıklama/ders/sınıf, süre/karıştırma, soru ekle/sil, seçenek/doğru cevap, görsel, Taslak Kaydet/Yayınla | Yeni/düzenleme ayrımı, önceki ayarı temizleme, başarısız çok adımlı kayıt, sorulara katılım sonrası koruma |
| `/results` | Yönetici için Genel Bakış; sınıf/ders/sınav/öğretmen/öğrenci filtreleri, Excel, yazdırma, tablo arama, boş sonuçta temizleme | Yöneticiye Öğrenci Raporları sekmesi gösterilmiyor; grafik/tablo/filtre kapsamları |
| `/statistics` | Tarih aralığı, sınıf, Excel, yazdırma, dört KPI, grafik/sınıf tablosu | Tarih/geçersiz tarih, toplulaştırma, hata/boş/yüklenme |
| `/survey-results` | Sonuçlar/Anket Oluştur, anket/tarih filtresi, sıfırla, Excel/yazdırma, karşılaştırma, soru dağılımı/açık yanıtlar, Düzenle; gömülü Ayarlar/Sorular/Yapay Zeka | Beş soru türü, oluşturma/düzenleme, tarihli sonuçlar, hata/yeniden dene |

Önizleme yolu olumlu kontrol: `App.tsx:92` yöneticiye izin veriyor, `student-quiz.tsx:47` yönetici için `isPreviewMode` kullanıyor. Öğrenciye ait rotaya yönlenmesi tek başına erişim hatası değildir. Sınıf seçimindeki `getTeacherClasses()` da `/classes` çağırır (`api.ts:901`); `/classes` yöneticiye tüm sınıfları getirir (`class.ts:25`). Bu iki şüphe bulgu olarak raporlanmadı.

## Bulgular

### Q01 — P1 — Anket soru türünü değiştiren ardışık güncellemeler birbirini eziyor

- Durum: Gerçek QuizBuilder/QuestionItem/Radix Select ile üç bileşen entegrasyon testi doğruladı; bağımsız tarayıcı kontrolü ayrıca yapılabilir.
- Yeniden üretim: Yönetici → Anket Oluştur → Sorular → türü Açık Uçlu, Derecelendirme veya Likert seç. `changeType`, tür güncellemesini takiben seçenekleri ve bazı türlerde config'i günceller.
- Beklenen: Seçilen tür ve ona uygun seçenek/config aynı soruya birlikte uygulanır.
- Gerçek: `QuestionItem.tsx:42-47` bir etkileşimde birden fazla `onUpdate` çağırıyor; `create-quiz.tsx:291-295` her çağrıda aynı render'ın `questions` dizisinden yeni dizi üretiyor. React toplu güncellemesinde son çağrı önceki `type` güncellemesini geri alıyor. Derecelendirmede config güncellemesi seçenek güncellemesini de ezer.
- Öneri: `setQuestions(current => current.map(...))` veya tür/options/config'i tek atomik soru güncellemesinde uygula.
- Kabul: Tek seçimden beş türün her birine geçiş doğru türü, gerekli alanları ve payload'u korur; art arda tür değişimleri doğru çalışır.

### Q02 — P1 — Seçenek silince doğru cevap başka seçeneğe kayıyor

- Durum: Gerçek QuizBuilder/QuestionItem bileşen entegrasyon testi, API'ye gönderilen payload'da C kaydedildiğini doğruladı; gerçek DB kullanılmadı.
- Yeniden üretim: Sınavda A/B/C/D seçeneklerini doldur; B'yi doğru seç; A'yı sil; gösterilen doğru seçimi/payload'u incele. Doğru seçeneğin kendisini silme ve son seçeneği silme de kontrol edilmeli.
- Beklenen: B doğru kalır; doğru seçeneğin kendisi silinirse kullanıcı yeniden seçmeye zorlanır.
- Gerçek: `QuestionItem.tsx:80` yalnız options dizisini filtreliyor; `QuestionForm.correctAnswer` indeksini değiştirmiyor (`QuestionItem.tsx:17`). `create-quiz.tsx:213` bu eski indeksi kullanıyor; B yerine C kaydedilebiliyor. Son indeksi silince ilk seçeneğe sessiz fallback uygulanır.
- Öneri: Doğru cevap için kararlı seçenek kimliği veya silme sırasında indeks düzeltmesi; silinen doğru cevabı geçersiz hale getir.
- Kabul: Doğru cevabın önünden/arkasından/kendisinden seçenek silmenin üçü de beklenen cevabı korur veya açık doğrulama ister.

### Q03 — P1 — Başarısız kayıt kısmi değişiklik/tekrar denemede mükerrer taslak bırakıyor

- Durum: Kod doğrulandı; gerçek DB ile çalıştırılmadı.
- Yeniden üretim: Yeni sınavda başlık ve bir soru gir, iki seçeneğin altında bırak ve kaydet; hatayı düzeltip tekrar kaydet. Düzenlemede başlığı değiştir, katılım başlamış soruyu değiştir ve kaydet.
- Beklenen: Bir kaydetme işlemi bütünüyle başarılı olur veya değişiklik bırakmaz; tekrar deneme aynı kaydı tamamlar.
- Gerçek: `create-quiz.tsx:190-224` önce içerik ayarlarını POST/PATCH, sonra soruları POST, sonra yayın durumunu PATCH yapar. Soru doğrulaması/senkronizasyonu hata verdiğinde önceki yazma geri alınmaz. Yeni oluşturulan id yalnız yerel `quizIdToUse` değişkeninde kalır; sonraki tıklamada `editId` hâlâ boş olduğundan ikinci POST yapılır. Katılım sonrası soruların reddi (`storage.ts:1034`) ayarların zaten kaydedilmesini engellemez.
- Öneri: İçerik+ayar+sorular için tek transaction endpoint; en azından tüm yerel doğrulamaları yazmadan önce yap, oluşturulan id'yi sakla, kısmi kaydı açık bildir.
- Kabul: Bozuk soru/ağ hatası/409 sonrasında gereksiz taslak oluşmaz; hata sonrası başlık/sınıf/ayarlar değişmez veya kısmi başarı kullanıcıya açıkça bildirilir; tekrar deneme mükerrer içerik üretmez.

### Q04 — P1 — Sonuç ekranı tamamlanmamış sınavları sıfır puan olarak başarıya katıyor

- Durum: Kod doğrulandı; veriyle tarayıcı bekliyor.
- Yeniden üretim: Aynı sınavda bir tamamlanmış 100 puan ve bir `in_progress`, `score=null` kaydıyla yönetici sonuç ekranını aç.
- Beklenen: Başarı dağılımı/ortalaması yalnız notlandırılmış tamamlanan sonuçlardan hesaplanır; devam edenler ayrı sayılır.
- Gerçek: `getFilteredResults` durum filtresi kullanmaz (`storage.ts:1085-1101`); frontend `results.tsx:158` null'u 0 kabul eder, `184-191` bütün kayıtları payda yapar. Ortalama 50 ve bir Geçmez sonucu oluşur; öğrencinin henüz sonuçlanmamış sınavı başarısız gösterilir. Dashboard/class analytics ise completed filtreler (`storage.ts:1266`, `1288`), dolayısıyla ekranlar tutarsızdır.
- Öneri: Başarı hesapları için `status === completed && score != null`; katılım/başlama/sonuç sayısını ayrı tanımla.
- Kabul: 100 puan+devam eden fixture'ında ortalama 100, Geçmez=0; gerçek 0 puan tamamlanmış kayıt hesaplara dahil kalır.

### Q05 — P2 — Yönetici sonuç filtresi öğretmen sınavlarını listelemiyor

- Durum: API probu ve kod doğrulandı.
- Yeniden üretim: Bir öğretmenin tamamlanan sınavı varken yönetici `/results` → Sınav Adı aç; global sınav yönetimiyle karşılaştır.
- Beklenen: Yönetici tüm sonuçların sınavını seçebilir.
- Gerçek: `results.tsx:83` `getAllQuizzes` kullanır; `quiz.ts:109` yönetici için de `getQuizzesByCreator(adminId)` çağırır. Sonuç API'si yöneticide tüm sonuçları getirir (`result.ts:20-26`), ama dropdown yalnız admin'in kendi sınavlarıyla oluşturulur (`results.tsx:320-326`). Tablo öğretmen sınavını gösterebilir, dropdown göstermez.
- Öneri: Yönetici sonuç ekranında `getAllAdminQuizzes` veya rapor filtre endpoint'i kullan.
- Kabul: Öğretmenin sınavı dropdown'da görünür; öğretmen kullanıcısının kapsamı genişlemez.

### Q06 — P2 — Açıklamayı ve süre sınırını temizlemek kaydedilmiyor

- Durum: Kod doğrulandı; tarayıcı bekliyor.
- Yeniden üretim: Açıklaması ve 20 dakika sınırı olan sınavı düzenle; açıklamayı boşalt, Süre Sınırı'nı kapat, kaydet, yeniden aç.
- Beklenen: Açıklama boş ve süre sınırsız kalır.
- Gerçek: `create-quiz.tsx:177,182` bu alanlara `undefined` verir; JSON stringify alanları tamamen çıkarır. PATCH şeması ve `storage.updateQuiz` eksik alanı değiştirmez (`storage.ts:873,876`), önceki değerler kalır. Anket açıklaması da aynı payload'u kullanır.
- Öneri: Temizleme için `description: null/''`, `timeLimit: null`; yalnız gerçekten değiştirilmemiş alanları omit et.
- Kabul: Kaydet+yeniden yükle açıklama ve süre temizliğini korur; süre kapalı öğrenci önizlemede timer başlatmaz.

### Q07 — P2 — Silme nedeni kayboluyor, kalıcı sınav silmenin işlem kaydı yok

- Durum: API probu ve kod doğrulandı.
- Yeniden üretim: `/quizzes` silme modalında en az beş karakter gerekçeyle onayla; API payload/log davranışını incele. Gerçek silme bu denetimde uygulanmadı.
- Beklenen: Zorunlu neden kullanıcı/sınav/zamanla denetim kaydına işlenir.
- Gerçek: `quizzes.tsx:110-115` nedeni kontrol eder ama yalnız id gönderir; `api.ts:639-644` DELETE body göndermez. `quiz.ts:305-313` doğrudan siler; `createLog` yok. `/admin-quizzes` zaten neden istemez. `storage.ts:893` öğrenci sonuçlarını da kalıcı siler, modal `admin-quizzes.tsx:212` yalnız sınav ve sorulardan söz eder.
- Öneri: Gerekçe için API şeması ve transaction içinde DELETE_QUIZ logu; etkilenen sonuç sayısını modalda belirt.
- Kabul: Silme kullanıcı/id/gerekçe/etki/zaman kaydı oluşturur; hata halinde log başarılı işlem iddiası yaratmaz; modal sonuç kaybını açık belirtir.

### Q08 — P2 — API, seçeneklerde olmayan doğru cevabı ve yayındaki sınavın sıfır soruya düşmesini kabul ediyor

- Durum: İki API probu doğrulandı; storage davranışı kodla doğrulandı.
- Yeniden üretim: Yönetici sorular endpoint'ine options `[A,B]`, correctAnswer `C` gönder; ayrıca yanıtsız yayındaki sınavın sorularına `[]` gönder. Yalnız sahte storage ile denendi.
- Beklenen: İlk istek 400; yayındaki sınavı sorusuz bırakma reddedilir veya durum güvenle taslağa çekilir.
- Gerçek: `quiz.ts:281` yalnız seçenek sayısı ve cevap truthiness kontrol eder; answer membership, boş/tekrarlı seçenekler kontrol edilmez. Boş dizi `.some`'dan geçer; storage `1035` bütün eski soruları siler. Soru sayısı kontrolü yalnız yayın durumuna geçişte vardır (`quiz.ts:210-212`), mevcut yayındaki sınavı korumaz.
- Öneri: Türe göre doğru cevap/unique nonempty seçenek doğrulaması; published içerik için minimum soru sayısı invariant'ı.
- Kabul: Seçenek dışı cevap/boş seçenek/tekrar seçenek reddedilir; yayınlı içerik soru sayısı sıfıra düşemez; mevcut katılım koruması sürer.

### Q09 — P2 — API hataları birçok ekranda boş veri/0 toplam olarak sunuluyor

- Durum: Kod doğrulandı; ağ hatası tarayıcı bekliyor.
- Yeniden üretim: Dashboard, admin sınav listesi, sonuçlar ve sınıf istatistikleri veri isteğini 500/ağ hatasıyla reddet.
- Beklenen: Veriler yüklenemedi uyarısı ve yeniden dene eylemi; başarılı boş cevapla açık ayrım.
- Gerçek: Dashboard query error okumaz, stats fallback 0'dır (`dashboard.tsx:46-67,400`). Admin liste error okumaz; boş dizi `Sınav bulunamadı` olur (`admin-quizzes.tsx:55-66,131-135`); silme mutation'ında `onError` yok (`68-77`). Sonuçlar catch yalnız console'a yazar ve loading kapatır (`results.tsx:114-116`). Class analytics yalnız `isLoading`/`data.length` ayırır (`class-statistics.tsx:186-192`), error halinde KPI=0/boş durum görünür. Anket sonuçlarında isError/retry olumlu örnek olarak mevcut (`survey-results.tsx:331-335`).
- Öneri: Her bağımsız veri alanına hata/boş/yüklenme durumu; kullanıcı görünür silme hatası ve retry.
- Kabul: 500 ve ağ kesintisi boş veri sayılmaz; veri geri geldiğinde retry iyileşir; eski cache varsa eski veri olduğu belirtilir.

### Q10 — P2 — Son sayfadaki son kaydı silince sayfa sınır dışına çıkıyor

- Durum: Kod doğrulandı; tarayıcıda silme yapılmadı.
- Yeniden üretim: 11 sınavla ikinci sayfadaki tek kaydı sil; listeyi yeniden getir.
- Beklenen: Sayfa 1/1'e dönülür ve 10 kayıt gösterilir.
- Gerçek: `admin-quizzes.tsx:82-84` sayfa sadece searchTerm değişince sıfırlanır; mutation sonrası veri kısalınca currentPage 2 kalır. `filteredQuizzes.length > 0` iken slice boş, boş durum da çıkmaz; sayfa 2/1 gösterilir. `/quizzes` aynı mantığı kullanır (`quizzes.tsx:140-146`).
- Öneri: Veri/filtre/silme sonrası currentPage'i totalPages ile sınırla.
- Kabul: 11→10 ve 21→20 geçişlerinde dolu geçerli sayfa; 1→0 doğru boş durum.

### Q11 — P2 — Sınıf KPI'ları farklı büyüklükteki sınıflara eşit ağırlık veriyor

- Durum: Kod doğrulandı; ürün metrik tanımı gerekli.
- Yeniden üretim: 1 öğrencili %100 katılımlı sınıf ve 99 öğrencili %0 katılımlı sınıf seç.
- Beklenen: Toplam 100 öğrenci ve 1 katılımcıyla global Katılım Oranı %1; başarı sonuç sayısına ağırlıklandırılır veya açıkça Sınıf Ortalamalarının Ortalaması yazılır.
- Gerçek: `class-statistics.tsx:55-58` kişi toplamlarını toplar ama oranları sınıf sayısına böler; katılım KPI %50 olur. Hiç sonucu olmayan sınıfın 0 ortalaması başarıyı da düşürür. API `completedCount` sağlayarak ağırlıklandırmaya veri sunar (`storage.ts:1308`).
- Öneri: Katılım=sum(participant)/sum(student); başarı=sum(average*completedCount)/sum(completedCount), mümkünse yuvarlanmamış toplam puanla; veya metrik adını açıkça değiştir.
- Kabul: 1/100 fixture %1; sıfır sonuçlu sınıf global sınav başarı ortalamasını düşürmez.

### Q12 — P2 — Arşivlenmiş sınavlar Taslak etiketi alıyor

- Durum: Kod doğrulandı.
- Yeniden üretim: Status archived içeriği admin sınav listesinde ve `/quizzes` listesinde göster.
- Beklenen: Arşivlenmiş etiketi ve uygun eylemler.
- Gerçek: `admin-quizzes.tsx:164` ve `quizzes.tsx:288` published dışındaki her şeyi Taslak gösterir; API archived sınavları listeden çıkarmıyor.
- Öneri: Üç durum için ayrı metin/renk/eylem politikası.
- Kabul: draft/published/archived görsel ve erişilebilir olarak ayırt edilir; arşiv iş akışı yanıltıcı değil.

### Q13 — P3 iyileştirme — Dashboard Toplam Sınav sayacının içerik kapsamını açıklığa kavuştur

- Durum: API probu ve kod doğrulandı; ürün metni iyileştirmesi, kesin işlev hatası olarak sınıflandırılmadı. Alt açıklamanın toplam materyal demesi karma sayımı destekliyor.
- Yeniden üretim: Bir exam ve bir survey kaydıyla stats isteği yap; admin sınav listesini karşılaştır.
- Beklenen: Sınav sayısı 1 veya etiket toplam içerik olarak açıklanır.
- Gerçek: `dashboard.ts:34,41` tüm quiz tablosunun uzunluğu=2; `dashboard.tsx:226` başlık Toplam Sınav. Global sınav yönetimi ise survey filtreler (`quiz.ts:84`). Alt açıklama materyal dese de başlık ve Sınavları Görüntüle yolu tutarsız.
- Öneri: Exam filtresi veya ayrı sınav/anket kartları.
- Kabul: Bir exam+bir survey fixture'ında sayaç/etiket/listenin kapsamı tutarlıdır.

### Q14 — P2 — Form ve eylemlerin erişilebilir adları eksik veya belirsiz

- Durum: Kod doğrulandı; ekran okuyucu tarayıcı testi bekliyor.
- Yeniden üretim: Tab ve ekran okuyucu ile sınav satır menüsü, seçenek silme, süre/karıştırma switch'i, soru metni ve filtreleri dolaş.
- Beklenen: Her kontrol işlevini ve bağlamını anlatan programatik ad; seçili doğru cevap durumunu okuma.
- Gerçek: İkon menüleri `admin-quizzes.tsx:173`, `quizzes.tsx:293` ad taşımaz; soru/şık silme ikonları `QuestionItem.tsx:55,80` etiketsizdir. Soru metni Label textarea'ya bağlanmaz (`59`); bütün doğru cevap düğmelerinin adı aynı ve `aria-pressed/checked` yok (`78`). `QuizSettings.tsx:73,78` switch'lere bağlı id/htmlFor/aria-label yok; çeşitli rapor Select Label'ları ilişkisizdir.
- Öneri: Kontekstli aria-label, kontrol id/htmlFor, doğru cevabı radiogroup/radio veya pressed durumu olarak ifade et.
- Kabul: Klavye ve erişilebilirlik ağacında her eylem anlamlı ad taşır; doğru cevabın hangi şık olduğu ve seçili durumu okunur.

## Ek araştırma / doğrulanmamış riskler

- **QH01:** İstemcide `toISOString().slice(0,10)` yerel tarih yerine UTC alır (`class-statistics.tsx:18`, `survey-results.tsx:33`). İstanbul 00:00–02:59 arasında bugünün varsayılanı bir gün geriye kayabilir; server date filter sunucu timezone'u ile yorumlanır (`analytics.ts:24-25`, `survey.ts:40-41`). Saat kontrollü tarayıcı/sunucu doğrulaması gerekli; bütün günler için teyit edilmiş hata olarak raporlanmadı.
- **QH02:** Builder başarıda yalnız `['quizzes']` cache'ini invalidate eder (`create-quiz.tsx:230`); admin-quizzes/dashboard caches açık oturumda eski kalabilir. React Query varsayılan refetch-on-mount etkisi nedeniyle kesin kullanıcı etkisi navigasyon/cache süresiyle doğrulanmalı.
- **QH03:** Katılım başladığında değişiklik olmadan soru kaydetmek storage'da kabul edilir; seçenek/config/order normalizasyonunun AI/legacy sorularda farklılaşması gereksiz 409 doğurabilir. Belirli fixture olmadan bulgu sayılmadı.
- **QH04:** Mobil dashboard `md:grid-cols-7` öncesinde çocukların koşulsuz col-span-4/3 kullanması örtük sütunlar oluşturabilir (`dashboard.tsx:262-263,290`); gerçek dar ekran ölçümü ana tarayıcı denetimine bırakıldı.

## Testler ve güvenli tekrar kontrolü

Yeni dosya: `server/tests/api/admin-audit-quizzes.test.ts`. Beş prob mevcut davranışı belgeler: yönetici kendi sınav listesi/global liste ayrımı, seçenek dışı doğru cevap, published boş soru dizisi, audit log'suz silme ve dashboard survey sayımı. Bu testler mevcut hataların düzelmiş olduğunu iddia eden regresyon testleri değildir; düzeltme sonrası beklenen davranışa çevrilmelidir.

Komut: `pnpm --filter quiz-master-server test -- tests/api/admin-audit-quizzes.test.ts`. **Sonuç: 1 dosya, 5 test geçti; çıkış kodu 0; toplam süre 140,39 saniye, testlerin kendi süresi 809 ms.** Sahte storage gerçek DB'ye erişmez; proje global setup ayrıca yalnız `server/data/quizmaster-test-*` içindeki geçici DB'ye migrasyon uygular ve teardown ile temizler (`tests/global-setup.ts:8-22`). İlk başlatma `wait for runner spawn_ready` süreç oluşturma hatası verdi; tekrar çalıştırmada suite tamamlandı. Bu hata uygulama testi hatası değildir.

Tarayıcı checklist'i: arama/filtre temizleme, bütün ilgili sekmeler, soru türleri ve seçenek silme, ağ hataları/retry, doğru-yanlış-empty kayıt, sonuç filtre kapsamı, CSV/print filtre başlıkları, 360px taşma, tab odağı ve erişilebilir adlar. Kalıcı silme ve gerçek sınav/anket kayıt/yayın mutasyonları bu alt denetimde çalıştırılmadı.

### Frontend bileşen entegrasyonu — Q01/Q02'nin çalıştırılmış kanıtı

Yeni dosya: `client/src/test/admin-audit-question-editor.test.tsx`. Gerçek `QuizBuilder`, `QuestionItem`, `QuizSettings`, Radix Select/Tabs ve React state güncellemeleri çalıştırıldı. API yanıtları, Yapay Zeka/görsel yükleme bileşenleri ve navigasyon/toast bağımlılıkları sahtedir; jsdom'da eksik scroll/pointer-capture API'leri polyfill edildi. Sahte parent state veya uygulamadaki setState algoritmasının testte yeniden yazımı kullanılmadı.

Komut: `pnpm --filter quiz-master-client exec vitest run src/test/admin-audit-question-editor.test.tsx --pool=threads --maxWorkers=1` (tekrarlanan worker başlangıç timeout'larından sonra sandbox dışında). **Sonuç: 1 dosya, 4 test geçti; çıkış kodu 0; 60,47 saniye toplam süre, testler 4,41 saniye.** İlk forks ve ilk threads koşusu worker 60 saniyede başlayamadığı için test çalıştırmadan çıkış 1 verdi; başarılı tekrar koşusunda unhandled error yoktu.

Bu dört test **hata karakterizasyonudur**, doğru ürün davranışının geçtiği anlamına gelmez. Üç senaryoda kullanıcı Açık Uçlu/Derecelendirme/Likert seçtiği halde gerçek controlled combobox **Tek Seçim** kaldı. Açık Uçlu'da seçenekler silindi; Derecelendirme'de son config güncellemesi nedeniyle seçenekler de eski kaldı; Likert'te seçenekler değişti ama tür değişmedi. Dördüncü senaryoda B doğru seçildikten sonra A silindi; kaydetme sırasında gerçek üretim kodunun API'ye gönderdiği seçenekler `[B,C,D,E]`, `correctAnswer=C` oldu. Düzeltme sonrası testler istenen türün korunması ve `correctAnswer=B` beklentisine çevrilmelidir.

### Nihai tarayıcı doğrulaması

Yönetici sonuç filtresi testinde izole veritabanındaki öğretmen sınavı listede bulunmadı (Q05); [rota akışı JSON'u](./results-route-initial.json) başarısız assertion'ı kaydeder. `/quizzes/audit-exam` doğrudan gerçek tarayıcıda açıldı; Ayarlar ve Sorular (1) sekmeleri verileri yüklendikten sonra görüntülendi. [Soru sekmesi görüntüsü](./evidence/live-edit-question-loaded.png) bu sayfanın yalnız yükleme kabuğundan ibaret olmadığını doğrular. Soru ekleme/kaydetme, CSV indirme ve sonuç filtrelerinin tüm kombinasyonları tarayıcıda yürütülmedi. Bileşen testi seçici tip düzeltmesinden sonra tekrar çalıştırıldı: **4/4 geçti**.

### Düzeltme durumu — ilk paket

Q01/Q02 karakterizasyon testleri beklenen ürüne yönelik regresyon testlerine çevrildi. Düzeltme öncesi beşi de beklenen nedenle başarısız oldu: üç tür değişimi geri düştü, B yerine C kaydedildi ve silinmiş doğru cevapla kayıt sürdü. Fonksiyonel React state güncellemesi ve seçenek silmede cevap indeksinin düzeltilmesi/temizlenmesi sonrasında gerçek editör bileşen testleri **5/5 geçti**; istemci TypeScript kontrolü de geçti. Q03 ve sonraki rapor bulguları bu pakette açık kaldı.

### Düzeltme durumu — ikinci paket

Q03 için düzenleyici artık `PUT /api/quizzes/:id/content` veya `PUT /api/surveys/:id/content` ile ayarlar, soru senkronizasyonu ve yayın durumunu tek transaction'da kaydeder. Yeni içerik kimliği aynı açık düzenleyicide tekrar denemeler boyunca korunur. Gerçek SQLite hata enjeksiyonunda soru yazımı başarısız olunca ayarlar ve silinen sorular geri alındı; yeni içerik oluşmadı. Sahiplik/sınıf yetkisi, katılım sonrası soru koruması, kayıp yanıt sonrası aynı kimliğe tekrar yazma ve bildirim hatasının başarılı kaydı başarısız göstermemesi [API regresyonlarında](../../server/tests/api/content-save.test.ts) doğrulandı: ilk dokuz kontrol **9/9**, ek veritabanı hata enjeksiyonu **1/1** geçti. Mevcut POST/PATCH uçları uyumluluk için korunur; Q08'in bu eski uçlardaki kontrolleri açık kalır.

Q06 da yeni düzenleyici kaydında giderildi: açıklamayı boşaltmak ve süreyi kapatmak `null` gönderir, eski değerler kaldırılır. Gerçek API testi katılım sonrası değişmeyen sorularla metadata temizliğini doğruladı. [Gerçek soru düzenleyici ve taşıma testleri](../../client/src/test/admin-audit-question-editor.test.tsx) **9/9** geçti (altı editör, üç HTTP/CSRF taşıma testi); survey türleri kaydetme payload'ında da korundu.

Q04 başarı dağılımı ve ortalamalarda yalnız `completed` ve sonlu sayısal puanı kullanır. Katılım/notlandırılan sayıları ayrıdır; gerçek sıfır dahil kalır, puansız sınav “Henüz yok” gösterir. [Sonuç sayfası testleri](../../client/src/test/admin-results.test.tsx) önce yanlış 33/0 ortalamaları yeniden üretti, düzeltme sonrası üç kontrol geçti. [Gerçek Chromium akışı](../../tests-e2e/admin-results-regression.spec.ts) **1/1 geçti**: 100 + devam eden + puansız tamamlanmış kayıt için ortalama100/notlandırılan1; gerçek sıfır eklendikten sonra yenilemede ortalama50/notlandırılan2. İlk koşu yavaş Vite/tarayıcı açılışı nedeniyle toplam süre sınırına takıldı; tekrar tamamlandı.

Q05 yönetici filtresi mevcut global sınav API'sini kullanır; öğretmen listesi önceki yetki kapsamını korur. Dördüncü sonuç bileşen testi öğretmen sınavının eksikliğini önce yeniden üretti, düzeltme sonrası **4/4 geçti**. Diğer açık Q bulguları bu pakette tamamlanmış sayılmaz.

[Son hedefli Chromium koşusu](./results-atomic-and-selector-fix.json) **2/2 geçti**: öğretmen sınavı seçicide göründü; sunucu yayınlamayı tamamladıktan sonra HTTP yanıtı testte kesildi, aynı açık düzenleyiciden tekrar yayınlandı, veritabanında aynı kimliğe tek sınav/tek soru kaldı ve yenilemede yayınlı içerik görüldü. Kod incelemesinde yeni audienceSize sayımının pasif öğrencileri de içerdiği yakalandı; mevcut yayın davranışıyla eşleşmesi için aktif öğrenci filtresi uygulandı.
