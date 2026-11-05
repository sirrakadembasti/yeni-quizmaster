# Veli paneli hata onarımları

4 Ekim 2026; başlangıç `411b56c`. Onaylanan on hata ve ilgili beş kullanılabilirlik iyileştirmesi uygulandı. Bu belge ilk denetimden ayrıdır: [tarihsel bulgular](findings.md), [ilk kapsam](verification.md), [uygulama planı](../superpowers/plans/2026-10-04-parent-defect-repairs.md).

## Değişiklik ve kabul sözleşmeleri

| Bulgu | Değişiklik | Başarı kriteri ve kanıt kaynağı |
|---|---|---|
| P-B01 | Cevap yazma endpoint'inde öğrenci rolü zorunlu | Veli eski kendi denemesine403; DB değişmez. Öğrenci geçerli cevap200, sahiplik403/süre409/kapanış400 korunur. Security E2E ve student-exam birim testi. |
| P-B02 | Veli duyuru hedef sınıfı aktif bağlı çocuklardan çözülür; tek alıcı | İki kardeş tek bildirim; pasif/kaldırılmış bağ/ilişkisiz kullanıcı0. Gerçek POST/list/API/SQLite E2E. |
| P-B03 | Öğrenci ve veli ortak yayımlanmış `exam` kapsamı | Sınıfsız yalnız atanmamış sınav; sınıflı yalnız atanmış sınıf. Draft/archive/survey/material/unknown dışlanır. Ortak scope birim ve API E2E. |
| P-B04–06 | Öğrenci, özet ve detay için yükleniyor/hata/tekrar dene dalları |500/403 hata görünür; boş veriyle karışmaz; retry gerçek200 ile toparlar; eski metrik/detay gösterilmez. Kontrollü hata E2E. |
| P-B07 | Bağlı listeyle doğrulanan `studentId` URL bağlamı | Dashboard→sonuç, refresh ve geri aynı çocuk; yabancı/kaldırılmış ID için yabancı istek yok; geç gelen önceki çocuk yanıtı yeni seçimi değiştirmez. Yeni page-repairs E2E. |
| P-B08 | Görsel, alt metin, responsive boyut ve bozuk görsel mesajı | Raster data/HTTP(S)/upload görselleri; executable/SVG data reddedilir. Gerçek PNG detay E2E ve sekiz görsel/durum birim testi. |
| P-B09 | Duyuru hedef etiketinde veli ayrımı | Veli kartı VELİLERE; admin hedef seçicisinde Veliler; öğretmen hedef yetkisi korunur. Print/audience E2E. |
| P-B10 | Yalnız bildirim baskısında scroll viewport sınırlaması kaldırılır | Mevcut sayfadaki20 kaydın20'si PDF'de; normal ekran400px ve sayfalama korunur. Gerçek Chromium PDF/metin/render. |
| P-U01–03 | İlişki yok yönlendirmesi, öğrenci seçici adı, doğru/yanlış/yanıtsız metni | Eşleştirme için okul yöneticisine yönlendirme; iki seçicinin erişilebilir adı; durum yalnız renk/ikonla aktarılmaz. E2E ve birim testleri. |
| P-U04–05 | Kaydedilmiş profil baskısı, parola alanlarını gizleme, baskıdan sayfalama kaldırma | Ad/e-posta/telefon/adres PDF'de; girilmiş parola ve parola alanı yok; güvenlikte normal Yazdır yok; pagination-only footer yok. PDF ve ortak rol E2E. |

Bağımsız incelemede iki ek kapsam açığı kapatıldı: aynı sınıftaki öğrenciye veli hedefli duyuru verilmesi, veli listesine sınav dışındaki yayımlanmış içeriğin girmesi. İlk hata gerçek route birim testinde, ikinci hata scope testinde önce başarısız üretildi; ortak politika düzeltmelerinden sonra yeniden doğrulanır.

## Doğrulama

- Gerçek Chromium/Express/SQLite kabul kapsamı **50/50 geçti;0 başarısız,0 çalıştırılmamış,0 skip**: [son kapsam](repairs-coverage-summary.json). İlk tam onarım koşusu47 geçti/3 test-seçici hatası verdi; son kapsam/baskı değişikliklerinden sonra [16/16](results-repairs-review.json), tip düzeltmesinden sonra [7/7](results-repairs-types.json) tekrarlandı. Sonuç tablosu her testin en son koşusunu kullanır; tek bir kesintisiz50/50 koşusu iddiası değildir.
- İlk onarım koşusunun üç hatası, yeni shared-role testindeki çoğul input seçicisinin Playwright strict mode ihlaliydi. `input:visible` sayısının0 olmasıyla doğru kontrol kuruldu; admin/teacher/student profil ve güvenlik baskısı yeniden geçti. Ürün hatası gibi raporlanmadı.
- [Beş gerçek PDF ve metin/render sonucu](print/verification.json) geçti: bildirim20/20, geçmiş mevcut sayfasındaki50/50 detay, profilin dört kayıtlı alanı. Girilmiş parola/alanı ve yabancı kayıt yok; boş PDF sayfası yok. Sekiz render sayfası görsel olarak incelendi; geçmişin üçüncü sayfası gerçek kayıt içerir. Çıktı kapsamı üstte görünür, kontrol düğmeleri/footer basılmaz.
- İzole Windows runner cleanup her gerçek koşuda geçti: [tam koşu](runner-repairs-final.json), [kapsam tekrar](runner-repairs-review.json), [sonuç tekrar](runner-repairs-types.json). Port5560/5561 serbest; sahiplenilmeyen süreç sonlandırılmaz.
- Runner/sansürleyici regresyonu **5 geçti/0 başarısız/1 Windows symlink skip**. İlk deneme aktif E2E'nin5560 portuna rastladığından bind hatası verdi; gerçek runner tamamlanınca aynı testler yeniden geçti. [Port koruma sonucu](runner-windows-port-guard.json) bilinçli dolu portu reddeder; `cleanup-failed` bu testte sahibine dokunulmadığını belirtir, uygulama süreç temizliği başarısızlığı değildir.

Tam birim/entegrasyon kontrolleri aşağıdadır; Graphify doğrulaması ayrı bölümde belgelenir.

- Backend tam birim/entegrasyon koşusu **34 dosya/196 test geçti;0 fail/skip**: [rapor](unit-server-repairs.json). Komut `pnpm --filter quiz-master-server run test --reporter=json --outputFile=../docs/parent-audit/unit-server-repairs.json`. İlk `exec vitest` çağrısında195/196 geçti; migration testi `npm_execpath` eksikliği nedeniyle doğru script girişini istedi ([ilk sonuç](unit-server-invocation.json)); test veya guard değiştirilmeden tam koşu yeniden geçti. Mock-hoisting uyarıları mevcut quizzes/student-exam testlerinden gelir; bilinçli rollback/teslimat/DB hata logları başarısız test değildir.
- Frontend tam birim koşusu **25 dosya/149 test geçti;0 fail/skip**: [rapor](unit-client-repairs.json). Komut `pnpm --filter quiz-master-client exec vitest run --maxWorkers=2 --reporter=json --outputFile=../docs/parent-audit/unit-client-repairs.json`. Testler ve build aynı anda çalıştırılmadı; kaynak sınırı nedeniyle frontend worker sayısı2 ile sınırlıdır.
- Hedefli red→green kanıtı: görsel/durum8 beklenen başarısız→8 geçti; bildirim/sınıfsız kapsam2 başarısız→ilgili12 geçti; bağımsız incelemenin material/öğrenci duyuru kapsamı2 başarısız→ilgili14 geçti. Son bağımsız ürün diff incelemesinde ciddi açık/regresyon bulunmadı.
- Client/server `type-check` ve `pnpm run build` çıkış0. Üretim frontend3373 modül, ana JS1472.87kB (gzip402.15kB). Mevcut500kB paket uyarısı ve API modülünün static/dynamic karışık import uyarısı sürer; bu onarım genel bundle parçalama içermez.

## Graphify

Son çalışma ağacından AST güncellemesi ve multigraph tanısı çıkış0: **2583 düğüm/6795 kenar/148 topluluk**. Eksik/sarkan/yinelenen/unverified/external uç0; self-loop11/producer suppression12. Gerçek CDN renderer `ParentResultsPage()` için JSON/canvas21 bağlantıyı eşleştirdi; sayfa/konsol/ağ hatası0, browser/server cleanup başarılı: [tanı](graphify/update-diagnostic.json), [görsel test](graphify/result.json), [harita](graphify/map.png).

`built_at_commit=411b56c...` başlangıç HEAD'idir; commit öncesi onarım kaynakları ve commit dışında kalan iki kullanıcı düzenlemesi çıkarılmıştır. SQL parser14 dosyada yok; Graphify PDF modülü yokken PDF doğruluğu ayrı runtime ile sınandı. CSS/Markdown/görsel semantiği ve LLM etiketleri bu AST koşusundan doğrulanmış sayılmaz;142 kayıtlı etiket/148 topluluk/50 merkez adıyla yeniden adlandırma. Post-build tanısı ham üretici kaybının sıfır olduğunu kanıtlamaz.

## Veri, kurulum ve kapsam sınırları

Tüm yazma senaryoları5560/5561 portlarında yeni, izole SQLite fixture ile çalışır; gerçek kullanıcı verisi kullanılmaz. Backend API gövdeleri, veritabanı şeması ve terminal/BAT/SH→web hibrit kurulum akışı değiştirilmedi. Kullanıcının `client/src/lib/api.ts` ve `client/src/pages/server-setup.tsx` düzenlemeleri korunur ve commit dışında kalır.

Görsel fixture, doğrudan DB'ye enjekte edilen SVG data yerine desteklenen PNG data kullanır; resim görünürlük beklentisi korunur, ayrıca SVG/executable reddi ayrı birim testidir. Başarılı API yanıtları gerçek sunucudan gelir;500/403/delay senaryolarında yalnız hedef istek kontrollü değiştirilir. Bildirim baskısı mevcut20 satırlık sayfayı kapsar; tüm sayfalar için yeni toplu dışa aktarma eklenmedi.

Sesli ekran okuyucu, harici SMTP teslimatı, yeni hibrit kurulum ve Linux/WSL tekrar kurulumu bu onarım koşusunun kapsamı değildir. Önceki panellerin tüm akışları yeniden denetlenmedi; paylaşılan ayar ekranları ve sunucu politikaları ilgili regresyonlarla kontrol edilir. Admin'in Veliler seçeneği kaynak üzerinden incelendi; ayrı GUI oluşturma akışı sınanmadı, gerçek admin API/bildirim/DB akışı geçti. İlk hatalı ekran/PDF/API/harita gözlemleri `historical-defects`, `historical-print`, `historical-observations`, `historical-graphify` altında korunur.
