# Yönetici dışa aktarma ve yazdırma kabulü

PR04 dahil son üretim önizleme doğrulaması: korumalı 5510/5511 denetim servislerinde **16/16 geçti**, çıkış 0, **227.78 saniye (3.8 dakika)**. Koşu **2026-10-01, 16:03:58 UTC**'de başladı. Ham kanıt: [results-export-print-pagination-final.json](results-export-print-pagination-final.json); tüm son çalışma kitabı/PDF çıktıları: [test-results-export-pagination-final](test-results-export-pagination-final/). Atlanan veya kararsız test yoktu. Test paketi komutunu tekrarlayın:

```powershell
pnpm exec playwright test --config playwright.admin-audit.config.ts admin-export-print.spec.ts --workers=1
```

Denetim yapılandırması test dosyasını açık `testMatch` listesine alır. Test verileri ve oturumlar yalnız geçici denetim veritabanını hedefler; gerçek veritabanı veya uygulama ayarları değiştirilmez.

PR04 öncesi tarihsel üretim kanıtı korunur: **15/15 geçti**, çıkış 0, yaklaşık 2.4 dakika; başlangıç **2026-10-01, 14:54:26 UTC**. Ham sonuçları `results-export-print-final.json`, çıktıları `test-results-export-final/` içindedir; önceki kaynak öğretmen sayfalama düzeltmesini içermiyordu.

## Kapsam

İlk on beş test, yöneticinin erişebildiği on bir tarayıcı Excel/PDF giriş noktasını (öğretmenler, öğrenciler, sınıf listesi, sınıf ayrıntısı, yönetim sınıf ayrıntısı, öğretmen ayrıntısı, sınav sonuçları, yönetici öğrenci analizi, tekil sonuç ayrıntısı, sınıf istatistikleri ve anket sonuçları) ve sınavlar, yönetim, duyurular ve ayarlardaki dört yalnız yazdırma eylemini kapsar. PR04 bir öğretmen ayrıntısı test verisi daha ekleyerek son paketi on altı teste çıkarır. Yalnız öğrenciye açık `/my-stats` bu yönetici kabulünün dışındadır.

PR04, 21 sınavlı öğretmen ayrıntısı yazdırması için on altıncı testi ekler; yeniden derlenen son üretim koşusunda geçti. Bu PDF doğrulaması `pypdf` yüklü Python çalışma ortamını gerektirir. `AUDIT_PDF_PYTHON` değerini bu yorumlayıcıya ayarlayın (aksi halde test `python` çağırır); yorumlayıcı/ayrıştırıcı bulunmaması atlanan doğrulama değil açık başarısızlıktır. Bu denetim makinesindeki yüklü yorumlayıcı: `C:\Users\ahmet\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe`.

| Giriş noktası | Doğrulanan çıktı sözleşmesi |
| --- | --- |
| `/teachers` | Filtrelenmiş öğretmen satırı, Türkçe ad, ders/sınıf ilişkileri; dikey baskı |
| `/students` | Filtrelenmiş öğrenci satırı, sınıf numarası ve yalnız yöneticiye açık veli/iletişim alanları; dikey baskı |
| `/classlist` | Filtrelenmiş sınıf sayısı ve sorumlu öğretmen; dikey baskı |
| `/classes/:id` | Aranan öğrenci listesi, öğrenci numarası/e-posta, görünür sınıf kimliği ve eşleşen sayı; dikey baskı |
| `/admin/classes/:id` | Aranan yönetim öğrenci listesi, öğrenci numarası/e-posta, görünür sınıf kimliği ve eşleşen sayı; dikey baskı |
| `/teachers/:id` | Öğretmen üst verileri ve sınıf/sınav kayıtları; dikey baskı |
| `/results` | Seçili öğretmen/öğrenci kaynağı, yetkili e-posta tamamlama, gerçek sayısal sıfır; dikey baskı |
| `/student/results?studentId=…` | Yönetici raporunda öğrenci kimliği ve tamamlanmış gerçek sıfır; dikey baskı |
| `/student/result/:resultId` | Gerçek soru, öğrencinin yanlış cevabı, doğru cevap ve durum; dikey baskı |
| `/statistics` | Gerçek sınıf mevcudu, tamamlanmış katılım ve sıfır ortalama; dikey grafik/tablo |
| `/survey-results` | Gerçek açık metin yanıtı, formül açısından güvenli XLSX değeri ve katılımcı; tüm PDF sayfaları yatay |
| `/quizzes`, `/management`, `/announcements`, `/settings` | Dört yalnız yazdırma dikey rapor eylemi, korunan başlıklar, gizlenen etkileşim kontrolleri |

Testler yalnız korumalı geçici denetim veritabanında UUID ile sınırlandırılmış veriler oluşturur ve ardından bunları siler. Her çalışma kitabı gerçek Playwright tarayıcı indirmesinden gelir. Test, ZIP merkezi dizinini bağımsız okur, çalışma sayfası XML'ini ayrıştırır ve hücreleri elle yazılmış beklentilerle karşılaştırır. Türkçe metni, XML özel karakterlerini, veli iletişim bilgilerini, sınıf/öğretmen ilişkilerini, tamamlanmış sayısal sıfırı, yanlış cevap ayrıntılarını, anket formül enjeksiyonunu ve arama/seçici filtrelerini kontrol eder.

Baskı kontrolleri, işletim sistemi iletişim kutusu taklidiyle gerçek sayfa eylemini çağırır, A4 içerik genişliğinde baskı ortamını benzetir; görünür rapor metnini, gizli gezinme/eylemleri, tekrarlanan tablo başlıklarını ve yatay tablo kesilmesini kontrol eder. Chromium ayrıca gerçek PDF üretip baskı ortamı PNG'si ve yerleşim JSON'u yanında saklar. PDF sayfa boyutları dikey veya anket için yatay yönü doğrular. PR04 testi gerçek PDF'den metin çıkarır ve 21 başlığın tamamını tam bir kez denetler; oluşturulan örnek PDF'lerin görsel incelemeleri aşağıda ayrıca belgelenir. Bu testler masaüstü Excel'de onarımsız açılışı veya fiziksel yazıcı davranışını kanıtlamaz.

## Doğrulanan değişiklikler

- `/results` artık seçili öğretmen/öğrenci adlarını hem çalışma kitabı filtrelerine hem baskı `PrintMeta` verilerine kaydeder. Sonuç API'sinin sınırlı öğrenci ilişkisindeki eksik e-posta, zaten yetkilendirilmiş öğrenci listesinden tamamlanır; sonucun kendi e-posta değeri korunur.
- Baskı CSS'i rapor başlıklarını korurken yönetim arayüzünün üst başlığını gizler. Böylece yönetim raporunun başlığı korunur.
- `/classes/:id` artık sınıfını, sorumlu öğretmenini, filtrelenmiş sayıyı ve aramayı tanımlayan `PrintMeta` içerir. İki sınıf ayrıntısı E2E testi de görünür sınıf kimliğini ve aranan öğrenci listesiyle eşleşen sayıyı doğrular.

## Anket yatay sayfa tanısı ve ölçülen düzeltme

Son tam koşuda anket çalışma kitabının hücreleri geçti; PDF'de yalnız ortak üst başlığı taşıyan 594.95996 × 841.91998 dikey sayfayı, 841.91998 × 594.95996 yatay rapor sayfası izledi. Yönetim arayüzünün `main` öğesine `page: landscape` uygulamak bu sınırı düzeltmedi.

Odaklı Chromium tanısı, üretilen üretim stil dosyasını ve hesaplanmış baskı stillerini okudu. Seçici eşleşti ve `main.page` değeri `landscape` idi; ancak alt öğeleri `[data-print-content]`, `.print-masthead` ve `.dashboard-page` için hesaplanan değer `page: auto` oldu: page özelliği ortak üst başlığa aktarılmadı. `.print-landscape` raporunun kendi hesaplanan değeri `landscape` idi.

Baskı ortamında doğrudan `body:has(.print-landscape) { page: landscape; }` kuralını uygulamak, ortak üst başlık ve anket raporunu içeren tek yatay sayfa üretti. Tanı önce temel çıktıda dikey sayfa bulunduğunu, ardından düzeltilmiş PDF'nin her sayfasının yatay olduğunu ve ortak başlığın artık ek sayfa oluşturmadığını doğruladı. `!important` gerekmedi. Üretim CSS'i artık yatay raporlar için adlandırılmış sayfayı belge gövdesine atar; olağan raporlar varsayılan dikey A4 kuralını korur. İlk tüm sayfalar yön doğrulaması değişmedi.

Kanıt `test-results-export-landscape-recheck/computed-original.json`, `computed-body-plain-named.json`, `diagnostic-original.pdf` ve `diagnostic-body-plain-named.pdf`/`.png` içinde korunur. Odaklı tarayıcı tanısı çıkış 0 ile tamamlandı. Sonraki üretim derlemesi ve tam test paketi, değişmeyen her sayfanın yatay olması doğrulaması dahil **15/15** geçti. Regresyon sırası: gerçek dikey üst başlık sayfasıyla üretim **14/15** → tarayıcıda doğrulanan doğrudan belge düzeyi sayfa kuralı → yeniden derlenen üretim **15/15**.

## Son PDF görsel ve metin kalite kontrolü

Üç son PDF ve örnek XLSX dosyaları anlamlı adlarla kalıcı `evidence/closure/export/` dizinine kopyalandı. Paketli Poppler `pdftoppm` ilk sayfalarını 120 dpi'de görüntüye dönüştürdü; belgeleri hazırlayan ajan üç görüntünün tamamını inceledi. Paketli Poppler kurulumunda `pdftotext` çalıştırılabilir dosyası yoktu; yerine yüklü `pypdf` UTF-8 metin çıkardı. PDF karakter aralıkları çıkarılan metne boşluk eklediği için boşluklar yalnız metin doğrulamaları için normalleştirildi; ham metin korunur. `visual-qa.json` sayfa boyutlarını ve başarılı Türkçe başlık/ad kontrollerini kaydeder.

| Kalıcı dosyalar | Gerçek görsel bulgular |
| --- | --- |
| `teacher-list.pdf`, `.xlsx`, `teacher-list-page-1.png`, `teacher-list.txt` | Tek dikey sayfa; öğretmen listesi başlığı, arama üst verileri, Şule İğde, Türkçe ve sınıf adı okunaklı; tablo kenar boşluklarına sığıyor |
| `class-roster.pdf`, `.xlsx`, `class-roster-page-1.png`, `class-roster.txt` | Tek dikey sayfa; sınıf/öğretmen/arama üst verileri görünür; filtrelenmiş sayı 1, Çağrı Işık ve öğrenci numarası 7 doğru; imza çizgileri ve öğrenci listesi kesilmiyor |
| `survey-results.pdf`, `.xlsx`, `survey-results-page-1.png`, `survey-results.txt` | Tek yatay sayfa; ortak üst başlık ve rapor birlikte; tarih/anket üst verileri, katılım özeti, soru ve tam yanıt görünür; tablo sütunları kenar boşluklarına sığıyor |

Bu kontroller tarayıcı indirmelerini, çalışma kitabı XML hücrelerini, Chromium PDF yerleşimini ve görüntüye dönüştürülmüş üç örnek PDF'yi doğrular. **Fiziksel yazıcı kullanılmadı ve hiçbir çalışma kitabı masaüstü Microsoft Excel'de açılmadı.** Bu nedenle masaüstü Excel'de onarımsız açılış ve fiziksel yazıcıya özgü kenar boşlukları iddia edilmez. İlk sayfa görsel örnekleri, test paketinin her sayfa yön kontrollerinin yerine geçmez veya keyfi büyük veri sayfalamasını kanıtlamaz.

## Kapsam notları

- `/results` özet tablo araması yalnız özet tabloya uygulanır. Excel, ana filtrelerle denetlenen ayrıntılı sonuç koleksiyonunu dışa aktarır. Bu kasıtlı olabilir ve kusur olarak doğrulanmaz; dosya başlığı “Sınav Sonuçları”dır.
- Yönetici öğrenci analizi dışa aktarıcısı eksik puanı sayısal sıfıra dönüştürür. Ana sınav sonuçları dışa aktarımı eksik puanları boş bırakır. Bu fark inceleme için bildirilir; güncel öğrenci analizi testi tamamlanmış gerçek sıfırı kapsar.

Sunucunun `/api/results/quiz/:quizId/export` uç noktası bağımsız CSV üretir; güncel istemci dışa aktarma düğmelerinin hiçbiri onu kullanmaz. CSV sözleşmesi, tarayıcı XLSX giriş noktası kontrollerinin dışındadır.

## PR04: öğretmen ayrıntısı baskı sayfalaması

Salt okunur inceleme, 20'den fazla sınavı olan öğretmen için DOM'a yalnız
geçerli on kayıtlık sayfanın eklendiğini doğruladı. Excel zaten tüm sınavları
dışa aktarıyor, baskı sayacı toplamı gösteriyordu; baskı CSS'i sayfa gezintisini
gizliyordu. Dolayısıyla atlanan sayfalar PDF'de görünemiyordu.

`admin-teacher-detail-export.test.tsx` içindeki 21 sınavlı regresyon ilk kez
**21 yerine 10 başlık düğümü** ile başarısız oldu (mevcut iki test geçti;
yeni bir test başarısız oldu). En küçük kaynak değişikliği tüm öğretmen
sınavlarını işler, ekrandaki geçerli sayfada `flex`, diğer satırlarda `hidden`
tutar ve tüm satırlara `print:flex` uygular. Ekran sayfalaması her seferinde
on kayıt seçmeye, Excel tüm kayıtları içermeye devam eder. Sonraki odaklı
birim koşusu çıkış 0 ile **3/3 geçti**; süre 21.85 saniye:

```powershell
pnpm exec vitest run src/test/admin-teacher-detail-export.test.tsx --maxWorkers=1
```

Yeni tarayıcı testi, korumalı geçici veritabanında kendi UUID kapsamlı öğretmenini
ve 21 sınavını oluşturur; bunları `finally` içinde siler, birbirinden ayrı iki
on kayıtlık ekran sayfasını, 21 çalışma kitabı satırının tamamını ve baskı
ortamında tüm başlıkların görünürlüğünü kontrol eder. Gerçek üretilen PDF'den
metin çıkarır ve 21 tam sınav başlığının her birinin tüm PDF sayfalarında bir
kez geçmesini gerektirir. Yeniden derlenen son üretim koşusu bu yeni test
dahil **16/16 geçti**. Gerçek PDF iki dikey sayfa içerir; çıkarılan metin,
21 tam sınav başlığının her birinin sayfalar boyunca bir kez bulunduğunu kanıtlar.
Ham Playwright metin eki `evidence/closure/export/many-quizzes.txt` içinde,
kalıcı `many-quizzes.pdf` ve `many-quizzes.xlsx` yanında korunur.

Poppler iki sayfayı `many-quizzes-page-1.png` ve `many-quizzes-page-2.png`
olarak görüntüye dönüştürdü; ikisi de incelendi. İlk sayfa 01–15, ikinci sayfa
16–21 sınav başlıklarını içerir. Öğretmen/rapor başlıkları, e-posta ve Türkçe
üst veriler okunaklıdır; test başlıkları ve sınav satırları kesilmiyor veya
kısaltılmıyor. `many-quizzes-visual-qa.json` sayfa boyutlarını ve 21 başlığın
tam bir kez bulunma kontrollerini kaydeder. Bu, iki sayfalık bu test verisini
doğrular; keyfi başlık uzunlukları ve daha büyük veri kümeleri, masaüstü Excel'de
açılış ve fiziksel yazıcı çıktısı iddianın dışında kalır.
