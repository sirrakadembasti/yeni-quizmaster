# Öğrenci paneli hata onarımları

4 Ekim 2026. Başlangıç commit'i `053138e`; kullanıcı S-B01..S-B06'nın düzeltilmesini onayladı. İlk audit bulguları ve kırmızı çıktılar tarihsel kayıttır. Son doğrulama bu belgede ayrıca değerlendirilir.

## Değişiklikler

| Kusur | Kök neden ve değişiklik | Regresyon kapsamı |
|---|---|---|
| S-B01 yüksek | Başlatma yanıtı yerel cevabı eziyordu. Cache artık gönderilmemiş cevap ve soru bazında değişiklik sürümü tutar. Aynı öğrenci/sınav/sonuç oturumunda yalnız geçerli soru/seçenekler uzlaştırılır; kayıtlar sırayla gönderilir. Geç gelen cevap kaydı yalnız aynı sürümü onaylar. | Çevrimdışı B → online reload → gerçek DB B → teslim; A→B→A gecikmeli kayıt/final ağ hatası → pending A → reload/DB A; tam teslim kuyruğu; farklı/eskimiş oturum; temiz cache ve legacy cache |
| S-B02 yüksek | Öğrenci geri düğmeleri `/quizzes` hedefine gidiyordu. Role göre `/student/quizzes`; önizleme `/quizzes` korunur. | Olmayan/tamamlanmış/boş sınav öğrenci dönüşü; boş öğretmen önizleme dönüşü |
| S-B03 yüksek | Dashboard bütün sonuçlar düğmesi kayıtlı olmayan `/student/statistics` adresine gidiyordu; `/student/results` kullanılır. | Beş kendi tamamlanmış sonuçla gerçek düğme ve sonuç sayfası |
| S-B06 orta | Kategori seçimi adı gönderirken filtre/export lookup kimlik arıyordu; Select değeri kategori kimliği oldu. | Gerçek boot kategorisi sonucunu korur; diğer sonuç filtreleri/sıralama/sıfırlama |
| S-B04 orta | Dashboard veri hatasından sonra başarı/boş ekranı render ediyordu. Ayrı hata kartı ve retry; hatalı veriden sıfır/başarı türetilmez. | Kontrollü500, sahte tamamlandı/ortalama yok, hata kaldırılır ve gerçek200/sonuç görünür |
| S-B05 orta | Anket query hata durumu boş başarıya düşüyordu. Ayrı error/refetch, tekrar deneme sırasında düğme kilidi. | Kontrollü500, sahte boş liste yok, hata kaldırılır ve gerçek200/anket görünür |

Ürün şeması, endpoint sözleşmeleri, kurulumu ve diğer paneller değiştirilmedi. Kullanıcının api.ts/server-setup.tsx düzenlemeleri korunur. UX/yeni özellik önerileri bu altı onarımın kapsamı dışındadır.

## Kanıt ve koşu geçmişi

- `results-repairs-red.json`: altı kontrolün tamamı beklendiği gibi başarısız; gerçek tarayıcı/API ile ilk altı kök neden yeniden üretildi. `runner-repairs-red.json` cleanup true.
- `results-repairs-green.json`: dört geçti, iki test adımı yanlıştı. Offline B ekranda ve DB'de korunmuştu; yeni bitirme adımı ilk soruda düğme arayıp timeout aldı. Anket gerçek200 ile dönmüştü; kart başlığı heading rolü taşımadığından yanlış locator başarısız oldu. Sonraki koşu bu iki adımı düzelterek sınar; bu ara koşu başarılı kapanış değildir.
- Bağımsız incelemenin bulduğu A→B→A geç onay yarışı birim testte kırmızı gösterildi; sürüm takibi ve sıralı kayıtla yeşil oldu. Legacy kuyruk testi de kırmızıdan yeşile geçti.
- `results-repairs-full.json`:38 geçti/1 zaman aşımı. Altı kusur, A→B→A, DB teslim, preview ve deadline testleri geçti. Güvenlik formunun ilk boş-düğme kontrolü15s içinde hazır olamadı; hata ekran görüntüsünde form ve disabled düğme sonradan görünür. Diğer ağır regresyon/derleme ile eşzamanlı bu koşu tam yeşil sayılmaz; bağımsız tekrar çalıştırılır.
- İlk sınırsız Vitest koşusu:7 timeout,8 worker başlangıç hatası;13 dosya/84 test geçti ama8 dosya başlayamadı. `--maxWorkers=2` koşusunda137/138 geçti, kalan test ayrıca incelenir. Ürün veya test timeout ayarları bu sonuçları gizlemek için değiştirilmedi.
- Kalan Vitest kontrolü ayrı dosya koşusunda da aynı beklentiyle başarısız oldu: öğretmen sayfalamasında ekran dışı satırların DOM'dan kalkmasını bekliyordu. Mevcut baskı tasarımı bütün satırları DOM'da tutup ekranda `hidden`, baskıda `print:flex` yapar. Sadece eski test güncellendi: ikinci sayfa göstergesi, ilgili ekran satırı ve baskı için saklanan satır kontrol edilir. Öğretmen ürün kodu değiştirilmedi; jsdom Tailwind üretmediğinden bu kontrol CSS sınıflarını sınar, gerçek baskı testinin yerine geçmez.
- Başlangıç kusur ekranları `historical-defects/` altında korunur. `screenshots/` ve rota gözlemleri son onarım koşularında yeniden üretilir; tarihsel kusur kanıtı için son yeşil ekran kullanılmamalı.

## Son doğrulama

Son kontroller izole test verileriyle tamamlandı. Önceki başarısız koşular yukarıda korunur; kapanış kanıtı aşağıdaki son çıktılardır.

| Kontrol | Sonuç ve kanıt |
|---|---|
| Gerçek Chromium + API + SQLite | **39/39 geçti**, çıkış0: [tam E2E](results-repairs-final.json), [süreç temizliği](runner-repairs-final.json). Önceki güvenlik formu zaman aşımı aynı test değiştirilmeden bu koşuda geçti. |
| Ders filtresi ek kabul kontrolü | **1/1 geçti**, çıkış0: boş ders, bütün derslere dönüş ve filtre temizleme [çıktısı](results-repairs-category.json). |
| Sayfa/sekme kapsamı | [Onarım kapsam özeti](repairs-coverage-summary.json):39 geçti,0 başarısız,0 çalıştırılmamış,0 atlanmış. |
| Frontend regresyonu | `pnpm --filter quiz-master-client exec vitest run --maxWorkers=2`: **141/141 geçti**,24 dosya, çıkış0; [JSON](client-repairs-final.json). Offline cache/sürüm/legacy senaryolarının11 testi bu koşuya dahildir. |
| Tip ve üretim derlemesi | Client/server `type-check` ve `pnpm build`: çıkış0. Mevcut api.ts karma import ve yaklaşık1.47MB ana JS paket uyarıları sürer; bunlar bu onarımlarda giderilmedi. |
| Excel/PDF regresyonu | Son E2E'nin iki XLSX ve PDF çıktısı ayrı doğrulayıcıyla geçti: [kanıt](export-verification.json), [PDF görüntüsü](print-render/student-results-page-1.png). Fiziksel baskı doğrulanmadı. |
| Graphify | Yerel AST güncellemesi ve multigraph tanısı çıkış0;2465 düğüm,6556 kenar,130 topluluk. Gerçek CDN renderer ile StudentQuiz seçimi,32 bağlantı ve yeni uzlaştırma/onay yardımcıları doğrulandı: [görsel test](graphify/result.json), [tanı](graphify/update-diagnostic.json). Konsol/sayfa/ağ hatası0. |

Bağımsız kod incelemesinin bulduğu geç onay yarışı giderilip yeniden incelendi; engelleyici bulgu kalmadı. Test API/UI süreçleri kapandı,5540/5541 portları serbest kaldı. Gerçek `server/data/quiz.db` SHA256 başlangıç ve kapanışta aynı: `8210a4b79f2cfb9cf74de6a4989f5c8a5449ba1d17b2332abdbd018c3741a158`. Kullanıcının api.ts/server-setup.tsx değişiklikleri commit kapsamı dışındadır.

Harita kod AST'sini yeniler;14 SQL dosyasının parser eksikliği, Graphify ortamındaki PDF çıkarım eksikliği ve yenilenmeyen LLM etiketleri [harita belgesinde](../graphify.md) açıklanır. Bu sınırlar çalışma zamanı testlerinin yerine geçirilmedi.

## Uyumluluk sınırları

- `pendingAnswers`/`answerRevisions` cache alanları opsiyonel; DB migration gerektirmez. Eski cache'te pending metadata yoksa yalnız sunucuda bulunmayan cevaplar korunur. Çelişkili eski taslakta hangi değerin yeni olduğu bilinmediği için sunucu tercih edilir. Açık teslim kuyruğunun aynı oturuma ait geçerli snapshot'ı ise korunur.
- Süreyi sunucu belirler; expired kayıt/teslim kontrolleri değişmedi. Önizleme cache/cevap yazmaz. Tamamlanmış sınav start409 cevabı yerel cache'le başarıya çevrilmez.
- Kalıcı browser storage kapalı/temizlenmişse yerel draft korunamaz. Farklı cihazlardaki eşzamanlı düzenleme için yeni çatışma çözümü özelliği eklenmedi.
- Native Windows doğrulaması; Linux/WSL, fiziksel yazıcı, doğal oturum süresi sonlanması, harici SMTP/socket ve yük testi kapanış kapsamında değil. Sesli gerçek ekran okuyucu önceki kullanıcı talebine göre kapsam dışı; klavye/ARIA audit kanıtı korunur.
