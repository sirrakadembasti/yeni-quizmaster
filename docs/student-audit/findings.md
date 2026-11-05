# Öğrenci paneli: bulgular ve geliştirme önerileri

**Tarihsel başlangıç bulguları (`053138e`):** S-B01..S-B06 daha sonra düzeltildi; güncel doğrulama ve kapsam [onarım raporundadır](defect-repairs.md). Aşağıdaki açık hata anlatımları ilk denetimdeki davranışı ve tekrar adımlarını korur. UX/yeni özellik adayları altı onarımın kapsamı dışındadır.

Tarih: 2026-10-04. Bu rapor gerçek öğrenci oturumu, ayrı test veritabanı ve tarayıcı denemelerinden doğrulanan kusurları; kaynak incelemesindeki UX adaylarından ve yeni özellik önerilerinden ayırır. Ürün dosyaları bu rapor için değiştirilmedi. Çalıştırma sonuçları ve kapsam sınırları ayrı doğrulama kaydında değerlendirilmelidir; rapor bütün sayfa/sekme/işlemlerin çalıştığını iddia etmez.

Öncelik karşılığı: P0 kritik, P1 yüksek, P2 orta, P3 düşük. Bu incelemede doğrulanan P0 yoktur. [Son doğrulama ve kapsam](verification.md).

## Gerçek etkileşimle doğrulanan kusurlar

### S-B01 — Çevrimdışı cevap, bağlantı geri gelip sayfa yenilendiğinde kayboluyor — P1

- **Sayfa / işlem:** `/student/quiz/:quizId`; çevrimdışı cevap seçme → yeniden bağlanma → göndermeden yenileme.
- **Tekrar:** Yeni sınavı aç; tarayıcı bağlantısını kes; B seçeneğini seç; yerel kayıt mesajını gör; bağlantıyı geri aç; sayfayı yenile.
- **Beklenen:** Henüz sunucuya aktarılmamış yerel B cevabı korunmalı, tekrar görünmeli ve daha sonra aynı cevabı gönderebilmelidir.
- **Gerçek:** Yenilemeden önce seçilen B ve yerel kayıt görünür. Başarılı çevrimiçi başlatma isteği sonrasında eski sunucu cevapları yüklenir; B seçimi kaybolur.
- **Etki:** Öğrenci emeği ve cevabı kaybolur; bağlantısı kararsız öğrencinin notunu etkileyebilir. Çevrimdışı *tam teslim kuyruğunun* yeniden bağlantıda başarıyla senkronize olması, gönderilmemiş tek cevap için bu kaybı ortadan kaldırmaz.
- **Kanıt:** `results-browser.json`: “an answer saved offline survives reconnecting and reloading before submission” testi; `historical-defects/exams-offline-unsent-answer.png` ve `historical-defects/exams-offline-answer-after-reload.png`. Kaynak: `client/src/pages/student-quiz.tsx:89-114`, `setAnswers(data.existingAnswers || {})` ve aynı sunucu cevaplarıyla `saveOfflineSession` çağrısı yerel cevabı değiştirebiliyor.
- **Düzeltme:** Aynı kullanıcı/sınav/result oturumuna ait gönderilmemiş yerel cevapları çevrimiçi açılışta uzlaştır; doğrulanmış sunucu yanıtından önce yerel taslağı silme. Tamamlanmış/farklı oturuma ait eski taslağı aktarmamak için oturum kimliğini denetle.
- **Kabul:** B çevrimdışı seçilir; bağlantı/yenileme sonrasında B ve cevap sayısı korunur; teslim sonrası gerçek DB'de B bulunur. Tam teslim kuyruğu, eski oturum, farklı kullanıcı ve süreli sınav kuralları da regresyona uğramaz.

### S-B02 — Sınav hata ekranından dönüş öğrenciyi yetkisiz rotaya gönderiyor — P1

- **Sayfa / işlem:** Olmayan sınav `/student/quiz/does-not-exist`; “Quizlere Dön”.
- **Tekrar:** Öğrenci olarak olmayan sınavı aç; geri düğmesine bas.
- **Beklenen:** `/student/quizzes` ve öğrenci sınav listesi.
- **Gerçek:** `/quizzes` hedefine gider; bu rota öğrenciye kapalıdır ve rol koruması öğrenciyi `/` adresine yönlendirir.
- **Etki:** Hata sonrası beklenen listeye dönülemez; yetkisiz erişim mesajı kafa karıştırır.
- **Kanıt:** `results-depth.json`, S-N04. Kaynak: `student-quiz.tsx:292`; `App.tsx:110,203`. Aynı dosyadaki tamamlanmış/boş soru geri düğmeleri `:321,359` da aynı hedefi kullanır; bu iki varyant için ayrı etkileşim kanıtı tamamlanmalıdır. Önizleme dönüşü `:412` öğretmen/yönetici rolünde geçerli olabilir.
- **Düzeltme:** Öğrenci dönüş hedefini `/student/quizzes` yap; öğretmen/yönetici önizleme dönüşünü role göre koru.
- **Kabul:** Olmayan, zaten tamamlanmış ve soru bulunmayan sınavdan öğrenci dönüşü listeyi açar; yetkisiz toast çıkmaz; öğretmen/yönetici önizleme dönüşü çalışır.

### S-B03 — Dashboard “Tüm Sonuçları Gör” bağlantısı 404'e gidiyor — P1

- **Sayfa / işlem:** `/student/dashboard`; dörtten fazla tamamlanmış sonuçta tüm sonuçlar düğmesi.
- **Tekrar:** Aynı öğrenciye ait en az beş tamamlanmış sonuçla dashboard aç; “Tüm Sonuçları Gör”e bas.
- **Beklenen:** Yetkili `/student/results` sayfası ve öğrencinin sonuçları.
- **Gerçek:** Tanımlı olmayan `/student/statistics` adresine gider; 404 görünür.
- **Etki:** Biriken sonuçların tamamına dashboard üzerinden erişim kesilir.
- **Kanıt:** `results-depth.json`, S-D01; test aynı öğrenciye beş sonuç ekler ve yalnız kendi eklediği kayıtları temizler. Kaynak: `student-dashboard.tsx:300-302`; rota kayıtları `App.tsx:92,95`.
- **Düzeltme:** Sonuç listesinin kayıtlı rotasını kullan.
- **Kabul:** Beş veya daha çok tamamlanmış sonuçla düğme `/student/results` ve “Sınav Sonuçlarım” başlığını açar; 404 veya yetki hatası yoktur.

### S-B04 — Dashboard veri hatası sırasında “Tüm Sınavları Tamamladın” diyor — P2

- **Sayfa / işlem:** Dashboard açılışı; sonuç isteğinin HTTP 500 dönmesi.
- **Tekrar:** Oturum açıkken `/api/student/results` isteğine kontrollü 500 uygula; dashboard aç.
- **Beklenen:** Verinin yüklenemediği açıkça anlatılmalı; eksik veriden “tamamladın” veya gerçek sıfır istatistik sonucu üretilmemeli.
- **Gerçek:** Hata mesajının yanında “Tüm Sınavları Tamamladın!” başarı/boş durumu gösterilir.
- **Etki:** Öğrenci yapılacak sınav olmadığını düşünebilir; hata ile gerçek boş durum karışır.
- **Kanıt:** `results-depth.json`, S-D06. Burada ağ hatası **bilerek enjekte edilmiştir**; gerçek kullanıcı sunucusunda 500 gözlendiği iddia edilmez. Kaynak: `student-dashboard.tsx:31-57,125-131,203-215`.
- **Düzeltme:** Hata, yükleniyor, başarılı boş ve başarılı dolu durumlarını ayır; hata durumunda sahte başarı kartlarını gösterme ve yeniden dene ekle.
- **Kabul:** 500 durumunda hata ve yeniden dene görünür; “Tüm Sınavları Tamamladın!” görünmez. Başarılı boş veri aynı mesajı doğru olarak gösterebilir; yeniden deneme sonrası gerçek sayılar yüklenir.

### S-B05 — Anket API hatası “Anket bulunmuyor” olarak gösteriliyor — P2

- **Sayfa / işlem:** `/student/surveys`; GET `/api/surveys` HTTP 500.
- **Tekrar:** Anket liste isteğine kontrollü 500 uygula; öğrenci anket listesini aç.
- **Beklenen:** Yükleme hatası ve tekrar deneme; başarılı boş listeden ayrı bir durum.
- **Gerçek:** “Yanıtlamanız gereken anket bulunmuyor.” gösterilir.
- **Etki:** Öğrenci atanmış anketi kaçırabilir; ağ/sunucu sorunu fark edilmez.
- **Kanıt:** `results-depth.json`, S-D07; `survey-failure-observation.txt`, `historical-defects/survey-controlled-failure.png`. Bu hata da **bilerek enjekte edilmiştir**. Kaynak: `student-surveys.tsx:12-22`.
- **Düzeltme:** Query hata durumunu göster ve `refetch` düğmesi ekle. Detay sayfasında 403/404/ağ hatasını “bulunamadı” altında birleştirme davranışını ayrıca incele.
- **Kabul:** 500'de boş liste mesajı yok; hata ve tekrar dene var. İstek düzeldiğinde gerçek kartlar yüklenir. Başarılı boş liste mesajı korunur.

### S-B06 — Gerçek ders kategorisi seçilince o dersin sonuçları kayboluyor — P2

- **Sayfa / işlem:** `/student/results`; “Ders / Kategori” filtresinde “Audit Mathematics” seçimi.
- **Tekrar:** Öğrenci olarak sonuç listesini aç; “Student Audit Completed Exam” kaydını gör; başlangıçta mevcut olan “Audit Mathematics” kategorisini seç.
- **Beklenen:** Aynı derse ait tamamlanmış kayıt listede kalır; diğer dersler filtrelenir.
- **Gerçek:** Seçim sonrasında görünür olan tamamlanmış kayıt kaybolur.
- **Etki:** Ders bazında sonuç inceleme yanlış boş liste üretir; öğrenci geçmiş sonucunun olmadığını düşünebilir.
- **Kanıt:** `results-closure.json`, S-D03; `historical-defects/results-category-filter.png`. Test başlangıçta oluşturulmuş kategoriyi kullanır; sonradan eklenen kategorinin istemci önbelleğinde görünmemesi sorunu bu tekrarda yoktur. Kaynak: `student-results.tsx:489`, seçenek değeri `cat.name`; `:152`, seçilen değeri `item.id === filterCategory` ile arayan lookup.
- **Düzeltme:** Seçim değeri ve filtre lookup'ı için aynı kategori kimliğini veya aynı normalize adı kullan; boş kategoriyi “Tüm Dersler”den ayır.
- **Kabul:** Var olan gerçek ders seçimi, o dersin sonuçlarını korur; başka ders kaydı hariç kalır; “Tüm Dersler” ve filtre sıfırlama bütün izinli sonuçları geri getirir. Boş dersin boş durumu doğru gösterilir.

## Kaynak UX bulguları ve henüz doğrulanmayan adaylar

Bunlar yukarıdaki gerçek kusurlarla aynı doğrulama düzeyinde değildir. Erişilebilirlik ağacı/klavye veya uygun gerçek veri denemesi olmadan “testte doğrulandı” sayılmamalıdır.

| Aday | Kanıt / gözlem | Öneri / kabul ölçütü | Öncelik |
| --- | --- | --- | --- |
| Sonuç detay ikonunun adı/görünürlüğü | `student-dashboard.tsx:285-293`: ikon düğmesinde programatik ad yok; görünürlük `opacity-0 group-hover:opacity-100`. | Açık erişilebilir isim; klavye odaklanınca ve dokunmatik kullanımda görünür eylem. Erişilebilirlik ağacı ve Tab testi. | P2 |
| Sınav arama ve durum filtresi etiketi | `student-quizzes.tsx:186-197`: placeholder/seçili metin var; açık `Label`/`aria-label` yok. | Her kontrolün anlamlı erişilebilir adı olsun; ekran okuyucu ağacında doğrula. | P2 |
| Cevap ve aktif soru durumu yalnız CSS ile | `student-quiz.tsx:492-519,566-578`; `take-survey.tsx:53-56` açık metin etiketi, puan/tekli seçim semantiği. | Soruyla ilişkili label; doğru radio/group veya pressed semantiği; aktif/yanıtlanan soru bilgisi. Ekran okuyucu ve klavye denemesi. | P2 |
| Başarı eşiği tutarsız görünüyor | Dashboard `student-dashboard.tsx:262` >=50 başarı ikonu; istatistik `student-stats.tsx:55` >=70 başarılı sonuç. | Ürün başarı ölçütünü belirle; 50/69/70 sonuçlarını aynı açıklama veya açık farklı ölçütle göster. | P2 |
| Çevrimdışı liste durumları | `student-quizzes.tsx:70-78` sonuçları boşaltır; `:117-119` durumu sonuç listesinden çıkarır. | Tamamlanmış/başlamış/teslim kuyruğunda oturumları “Yapılacak”tan ayır. Gerçek çevrimdışı liste testi gerekir. | P2 |
| Başlıktaki bildirim hatalarının geri bildirimi | `DashboardLayout.tsx:113-119,127-132,163,318`: sorgu hatası boş listeye düşebilir; toplu okundu için hata callback yok. | Hata/yeniden dene ve mutasyon başarısızlık bildirimi; ayarlar sekmesinden ayrı test. | P2 |
| “PDF İndir” etiketi | `student-stats.tsx:103-105,143`: yazdırma penceresi açılıyor. Bu bir dosya bozukluğu bulgusu değildir. | Eylemi “Yazdır / PDF olarak kaydet” olarak açıkla; indirme beklentisini netleştir. | P3 |

## Doğrulanan olumlu davranışlar ve geri çekilen şüpheler

- Sınavda başlatma, cevap kaydetme, gezinme, çevrimiçi yenileme/devam, teslim ve gerçek DB puan kaydı için etkileşim kanıtı vardır. Başlatma/çevrimdışı hazırlama yanıt anahtarı gizliliği, farklı sınıf/yayımlanmamış/atanmamış sınav engelleri ve başka öğrencinin sonucuna erişim engeli gerçek API ile denetlenmiştir. Bu kanıt, bütün soru türleri veya bütün zamanlayıcı varyantlarını kendiliğinden kapsamaz.
- Tam çevrimdışı teslim kuyruğunun bağlantı geri geldiğinde sunucuya aktarılması ve tamamlanmış sonuç üretmesi doğrulanmıştır. **S-B01 ayrı bir akıştır ve açık kalır.**
- İstatistiklerde kategori adı gerçek sayfada görünmüştür. “Kategori nesnesi render hatası” şüphesi doğrulanmış kusur değildir; mevcut veri katmanı kategori adını düzleştirir.
- Sonuçlar ve istatistikler gerçek ZIP tabanlı `.xlsx` üretir. Sıfır puan korunmuş, başka öğrenci/sınıf kayıtları dışa aktarımda yer almamıştır. İlk kaynak incelemesindeki “Excel aslında CSV üretir” şüphesi geri çekilmiştir; `export-verification.json`, `student-results-export.xlsx`, `student-statistics-export.xlsx` esas alınmalıdır. Eski `.csv` adlı test çıktısı güncel formatın kanıtı değildir.
- Sonuç PDF'sinin tek sayfalık renderı okunabilir olarak incelenmiştir; sıfır puan ve 0/2 doğruluk gösterimi uygundur. `print-render/student-results-page-1.png` ve `export-verification.json` kanıttır. Fiziksel yazıcı ve bütün sayfaların baskı düzeni denenmemiştir.
- `results-closure.json`: şifre GUI üzerinden gerçekten değiştirilmiş; diğer açık cihaz/oturumun eski erişimi 401 ile reddedilmiş; yeni şifreyle giriş doğrulanmış ve test sonunda eski şifre geri yüklenmiştir.
- Aynı kapanış koşumunda bildirim GUI sayfalama, okundu işaretleme ve kendi fixture bildirimini silme doğrulanmıştır; yabancı bildirimi silme isteği 404 ile reddedilmiştir. İşlem geçmişinde API tarih filtresi ve GUI sayfalama, eski ve başka kullanıcı kayıtlarının hariç kalmasıyla doğrulanmıştır.
- Tema tercihi yenileme sonrasında korunmuş; mobil menüde odak kapanı ve kapanış gerçek klavye etkileşimiyle doğrulanmıştır. Bu başarı bildirim popover'ının bütün hata senaryolarını veya her sayfanın mobil düzenini kapsamaz.

`results-closure.json` içindeki S-N01 kök rota denemesinde dashboard yüklenmesi 15 saniyelik sınırı aşmıştır. Sonraki fresh `results-completion.json` koşusunda gerçek veri30s bekleme sınırında yüklendi; iki rota grubunda hata/başarısız API/taşma/kalan spinner yoktu. Tek15s timeout doğrulanmış ürün performans kusuru değildir; yük testi yapılmadı.

Son ARIA snapshot'larında anket açık metin alanı isimsiz `textbox`, puan/tekli/Likert seçimleri seçili durumu olmayan `button` olarak görünüyor; çoklu seçim checkbox adları mevcut. `screenshots/-student-survey-55555555-5555-4555-8555-555555555555-accessible.txt` bunu doğrudan destekler. Sınav aramasının placeholder kaynaklı adı vardır; durum `combobox` kontrolünün ayrı programatik adı eksiktir (`screenshots/-student-quizzes-accessible.txt`). Bu erişilebilirlik ağacı gözlemleri sesli gerçek ekran okuyucu kullanım testi değildir.

## Sayfa bazında iyileştirme planı

Efor: **Küçük** yerel UI/durum düzeltmesi; **Orta** birkaç bileşen/API veya gerçek akış testi; **Büyük** veri/senkronizasyon tasarımı ve kapsamlı regresyon. Bunlar süre taahhüdü değildir.

| Sayfa / yüzey | Önce yapılacak iş | Öğrenciye fayda | Efor / sıra |
| --- | --- | --- | --- |
| Sınav çözümü | S-B01 yerel/sunucu cevap uzlaştırma; S-B02 doğru geri hedefi | Cevap kaybı önlenir; hata sonrası sınava dönüş anlaşılır | Orta + Küçük; P1 |
| Dashboard | S-B03 rota; S-B04 hata/boş ayrımı; görünür ve isimli detay eylemi | Geçmiş sonuçlara erişim, güvenilir durum, klavye kullanımı | Küçük; P1/P2 |
| Sınav listesi | Etiketler; çevrimdışı durum ayrımı ve doğrulaması | Filtreler anlaşılır, çevrimdışı yapılacaklar güvenilir | Küçük/Orta; P2 |
| Sonuç listesi | S-B06 kategori seçim/lookup eşleştirmesini düzelt; filtre regresyonu | Ders bazında doğru inceleme | Küçük; P2 |
| Sonuç detayı | Kontrol isimleri/uzun soru ve görsel senaryoları, mobil/baskı kapsamını genişlet | Cevaplarını rahat karşılaştırma | Küçük/Orta; P2/P3 |
| İstatistik | Başarı ölçütünü tutarlı açıklama; baskı eylemi etiketi | Grafik ve başarı oranı anlaşılır | Küçük; P2/P3 |
| Anket listesi | S-B05 hata/retry ayrımı | Atanmış anket kaybolmuş sanılmaz | Küçük; P2 |
| Anket yanıtı | Açık metin/seçim semantiği; hata türlerini ayır; boşluk metni için erken geri bildirim | Erişilebilir yanıt ve daha az başarısız gönderim | Küçük/Orta; P2 |
| Duyurular | Uzun metin, boş/hata ve öğrenci hedefleme regresyonlarını tamamla | Okul bilgisi rahat okunur | Küçük; P3 |
| Ayarlar / bildirimler / işlem geçmişi | Dört sekmenin bağımsız hata/sayfalama senaryoları, başarı/hata geri bildirimi | Hesap durumunu güvenle anlama | Orta; P2/P3 |
| Ortak başlık/mobil menü | Menü/odak, bildirim popover/mutasyon hataları, mobil programatik adlar | Telefonda ve klavyede güvenilir gezinti | Küçük/Orta; P2 |

## Yeni özellik önerileri — mevcut kusurlardan ayrı

| Özellik | Fayda | Öncelik / efor | Başarı ölçütü |
| --- | --- | --- | --- |
| Sınav taslak/senkronizasyon merkezi | “Bu cihazda”, “sunucuya aktarıldı”, “teslim bekliyor” durumlarını ve güvenli tekrar denemeyi gösterir | S-B01 giderildikten sonra; Orta | Öğrenci hangi cevabın nerede kayıtlı olduğunu görebilir; yanlış tekrar teslim üretilmez |
| Sınavda boş sorular özeti | Bitirmeden önce yanıtsız soruları sayar ve soru numarasına götürür | P2; Küçük/Orta | Onay ekranı gerçek yanıtsız sayıyı gösterir; öğrenci gezginle geri döner |
| Ders bazında gelişim ve kişisel hedef | Yalnız ortalama yerine zaman içindeki ilerlemeyi açıklar | P3; Orta | Tarih aralığı/ders seçimi yalnız kendi tamamlanmış verisini doğru hesaplar |
| Öğrenciye açık bitiş tarihi / yapılacaklar görünümü | Sınav ve anketin önceliği anlaşılır | P3; Orta/Büyük | Tarih ve timezone kaynağı tutarlı; süresi dolan iş yanlış başlatılmaz |
| Sonuç incelemesinde öğretmen açıklaması | Yanlış cevaptan öğrenmeyi destekler | P3; Orta | Açıklama yetkili öğretmen tarafından eklenir; yalnız izinli sonuç incelemesinde açılır |
| Anket yerel taslak ve çıkış uyarısı | Uzun metin yanıtı gezinmede kaybolmaz | P3; Orta | Kullanıcı/anket bazlı taslak korunur; gönderilmiş veya yetkisi kalkmış ankete eski yanıt aktarılmaz |

İlk uygulama sırası: cevap kaybını gider → iki bozuk dönüş hedefini düzelt → iki yanıltıcı hata durumunu ayır → kategori filtresini düzelt ve erişilebilirlik adaylarını kesinleştir → regresyon kontrolleri → yeni özellikler. Kullanıcının mevcut `client/src/lib/api.ts` ve `client/src/pages/server-setup.tsx` değişiklikleri korunmalıdır.
