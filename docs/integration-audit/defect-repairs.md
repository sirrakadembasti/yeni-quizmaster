# Entegrasyon ve UX onarımları — 4 Ekim 2026

Başlangıç denetimi `5d8a4d8` commit'indedir. [Tarihsel bulgular](verification.md), [tasarım](../superpowers/specs/2026-10-04-integration-repairs-design.md) ve [uygulama planı](../superpowers/plans/2026-10-04-integration-repairs.md) bu onarımın kapsamını tanımlar. Kullanıcı rapordaki çözüm ve kabul kriterlerinin uygulanmasını istedi. Veritabanı şeması, API rotaları, roller ve terminal/BAT/SH + web hibrit kurulumu değiştirilmedi.

**Onarım kabulü tamamlandı:** tam frontend/backend regresyonu, gerçek AI/Socket,18 tarayıcı kabulü,540 GET yük isteği, TypeScript/build ve Graphify AST/tanı kontrolleri geçti. Bu sonuçlar yalnız aşağıdaki kapsamı doğrular.

## Uygulanan düzeltmeler

| Bulgu | Değişiklik | Kabul kanıtı |
|---|---|---|
| AI yanlış puan anahtarı | Cevap özgün seçenek sırasına tek ve kesin biçimde çözülür; sonra karıştırılır. Geçersiz/belirsiz cevap sessiz indeks0 yerine reddedilir. |47 API testi, RED25 hata → GREEN47/47; gerçek Google üretiminde cevap/indeks eşleşti. |
| AI girdi/çıktı ve hazır durumu | Konu,1–10 count, difficulty/model/type/contentType doğrulanır; boş/eksik adet reddedilir. URL/anahtar/model değişince HAZIR temizlenir; eski async probe yeni ayarı hazır ilan edemez. |4 UI regresyonu RED4 → GREEN4/4; SSRF ve sunucu anahtarının özel adrese gitmeme sınırı korunur. |
| Oturum yükü | Aynı `sessions.db` Store'u desteklenen WAL seçeneğiyle kurulur. Uygulama DB'si ve iptal/expiry kuralları korunur. |3 gerçek Store testi RED1 → GREEN3/3; [eşlenmiş profil](load-repair-analysis.md). Son2/8/20 kademesinde540/540 HTTP200. |
| S-U01/02/03/04 | Görünür ve adlı detay eylemi; kalıcı arama/filtre adları; seçili cevap/mevcut soru semantiği; anket sorusuna bağlı kontrol; whitespace reddi ve403/404/500 ayrımı/retry. | Gerçek Tab+Enter, kontrol/ARIA, beş anket tipi, boşluk doğrulama ve hata→retry kabulü. |
| S-U06 | Kullanıcı bazlı liste+sonuç cache'i; yalnız id/quizId/status/score saklanır. Completed, started ve pendingSubmit ayrılır. Tekrar hazırlama yerel cevap/revision/teslim niyetini uzlaştırır; başarılı teslim cache'i completed yapar. |19 yeni öğrenci regresyonu geçti; eski11 offline testi geçti. Gerçek browser abort/503+reload completed durumunu korudu, teslim bekleme ayrı göründü. |
| S-U07 | Bildirim yükleme/hata/boş ayrımı ve retry; mark-all başarısızlığında toast ve okunmamış içeriğin korunması. | Gerçek Chromium kontrollü GET500, loading, retry→empty ve POST500 kabulü. |
| T-U02/S-U05 | Öğretmen önizleme modalı kaydedilmediğini açıklar; dashboard başarı göstergesi mevcut istatistik eşiği>=70 ile aynı. Backend puanlama değişmez. | Öğretmen ve gerçek öğrenci modal unit regresyonları; browser50/69/70 kıyaslaması. |
| T-U01/T-U03/S-U08 | Sonuç araması kalıcı label, tam öğrenci kodu, “Yazdır / PDF olarak kaydet” adı. | Gerçek browser ve tam kodu içeren PDF; window.print çağrısı. |
| T-U04/A-U01 | Baskı grafiği animasyon/ResizeObserver'dan bağımsız son SVG geometrisinde; eylem header+cell sütunları birlikte gizlenir. | İlk yükleme ve filtre sonrası anlık Chromium PDF'sinde iki100% çubuk + tablo uyumu;30 sınıf için altı sabit boyutlu grafik,3 sayfa ve tüm30 ad doğrulandı. Admin8 kayıt ve öğrenci raporu baskısı. |
| A-U02 | Uzun rapor bütünlüğü tekrar doğrulandı. |60 kayıt/60 END işareti,7 sayfa, sıfır puan ve tam kod; boş sayfa yok. |

## Tamamlanan gerçek kontroller

- Gmail: ilk izinli tek gönderim SMTP tarafından kabul edildi; **kullanıcı gelen kutusunda aynı mesajı doğruladı**. [İnsan teslim doğrulaması](smtp-delivery-confirmation.json). Araçla kutu okunmadı, yeniden gönderilmedi.
- Gerçek Google:2 çağrı, bağlantı200, üretim200,1 sentetik soru, doğru cevap indeksi doğrulandı: `ai-live-evidence.json`, `ai-live-results.json`. Gerçek DB ve kişisel içerik kullanılmadı. Harness gerçek AI rotasını ve HTTP sağlayıcısını kullanır; auth/storage sentetiktir, tam browser/CSRF canlı AI testi değildir.
- Mobil:390×844 üzerinde9 rol/sayfa taşma, JS/API hatası olmadan incelendi: `ux-repair-first-attempt.json`. Bu ilk runner bildirim tıklaması ve ilk kapanışta başarısız çıktı;9 mobil gözlemi ayrı geçerlidir, tam runner geçişi diye sunulmaz. Son detail/extra koşularında sahip olunan API/UI kapandı ve portlar serbesttir.
- Ayrıntılı kabul16/16: `ux-detail-results.json`; çevrimdışı/uzun rapor2/2: `ux-extra-results.json`. Karakterizasyon `observed` yerine artık assertion sonrası `passed` yazılır; hata/eksik kapsam runner'ı başarısız yapar.
- Altı gerçek PDF'nin tüm sayfaları metinle; dokuz örnek sayfa görsel olarak denetlendi: `pdf-verification.json`, `pdf-visual-review.json`. Hızlı baskı çubukları/table yüzdeleri eşleşir; uzun raporun son sayfasında tekrar başlık ve son kayıt eksiksizdir.

## Test ve ortam notları

| Son koşu | Sonuç | Kanıt |
|---|---|---|
| Tam frontend |28 dosya,176/176 geçti | `results-client-repairs.json` |
| Tam backend, mevcut forks havuzu |35 dosya,199/199 geçti | `results-server-repairs.json` |
| Ayrı AI route entegrasyonu |47/47 geçti; sağlayıcı taklit | `ai-repair-green-results.json` |
| Gerçek Google |1/1 geçti,2 gerçek HTTP çağrısı | `ai-live-results.json`, `ai-live-evidence.json` |
| Gerçek Socket, yeni Store ile |18/18, süreç/veri bağlantıları temiz | `../live-audit/socket-results.json` |
| Browser kabulü |16/16 +2/2 geçti | `ux-detail-results.json`, `ux-extra-results.json` |
| Son yük |540/540 HTTP200;0 hata; gerçek DB aynı, API kapandı ve5560/5561 serbest | `load-repair-results.json`, `load-profile-final.json` |
| TypeScript/build | Server0, client0, üretim build0 | `verification-commands.json` |
| Graphify yerel AST |2770 düğüm,7126 kenar,159 topluluk; update/tanı0 | `graphify-diagnostic.txt`, `../../graphify-out/GRAPH_REPORT.md` |

Son yükte normal log açık, profilin journaling override'ı kapalıydı; etkili PRAGMA **wal** okundu. Başka test/build/GUI koşusu bu yükle eşzamanlı çalışmadı. Dört ayrı rol oturumu ve altı GET rotası; küçük izole fixture/Windows geliştirme sunucusu,15s istemci sınırı. Bu sonuç bir üretim kapasitesi veya eşzamanlı kullanıcı garantisi değildir.

| Eşzamanlı | HTTP200 | P50 / P95 | En uzun | İstek/sn |
|---|---|---|---|---|
|2 |180/180 |110 /2017ms |2890ms |6,72 |
|8 |180/180 |603 /2651ms |3232ms |8,15 |
|20 |180/180 |1629 /3066ms |3483ms |11,62 |

İlk tam frontend koşusu174/175 geçti. Yeni print SVG'de aynı sınıf adı bulununca eski genel metin seçicisi belirsiz oldu; test tablo hücresine kapsamlandı, ağırlıklı yüzde beklentileri korunarak odaklı9/9 ve sonraki tam175/175 geçti. İlk başarısız tam JSON `results-client-repairs-first.json` içinde korunur.

Son tip kontrolü Testing Library'nin desteklemediği test-seçici `exact` seçeneğini yakaladı. String `name` zaten birebir eşleştiği için seçenek kaldırıldı; ilgili9 test tekrar geçti, her iki type-check ve build çıkış0 verdi. Bu son düzenleme ürün kodunu değiştirmedi. İlk tip koşusu `verification-commands-first.json` içinde korunur. Build'de mevcut büyük JS chunk uyarısı sürer (1478,24kB, gzip403,75kB); rota bazlı JS ayırma bu onarımın yeni özellik kapsamına alınmadı.

Graphify update0/tanı0; eksik/sarkan/yinelenen/unverified/external uç0, self-loop12 ve producer suppression12. Başlangıç HEAD `5d8a4d8e8e7c79a312cc462c3f3351f0485e68fd` yanında commit öncesi çalışma ağacı da çıkarıldı. Yeni oturum Store'u grafiktedir. SQL parser14 dosyada eksik; Markdown/PDF/görsel LLM semantiği yenilenmedi;166 kayıtlı etiket/159 topluluk,53 merkez adıyla yeniden adlandırma. Yeni canvas testi yapılmadı; harita çalışma zamanı kabulünün yerine geçmez. Yanlış servise login/yazma göndermeme negatif kontrolü1/1 tekrar geçti (`node --test scripts/integration-target-guard.test.mjs`).

Backend threads denemesi Windows native access-violation çıkışıyla tamamlanamadı: `server-thread-attempt.json`. Mevcut forks havuzunda aynı assertion'lar35 dosya/199 test olarak tamamlandı. Native çıkışın kesin iç nedeni bu koşuda belirlenmedi; başarılı fork tekrarı thread denemesini başarılı saydırmaz. Mevcut nested vi.mock uyarıları ve jsdom boyutsuz chart uyarıları test altyapısı notudur; gerçek browser/PDF kontrollerinin yerine geçmez.

Odaklı testlerin bazı Windows worker başlangıçları60s handshake hatası verdi; bu koşul ürün assertion'ı değildir. Başarılı thread-worker tekrarında öğrenci19/19 ve eski offline11/11 çalıştı. İlk browser retry tıklaması timeout oldu; aynı ürün koduyla tekrarında16/16 geçti. İlk UI stop kanıtı gecikti; sonraki başlatma portları serbest doğruladı, son koşuların temizliği geçti. Başarısızlık kaydı `ux-repair-first-attempt.json` içinde korunur.

Tarihsel başarısız AI/yük/PDF JSON'ları `before-repairs/` içindedir; özgün görüntü/PDF sürümleri `5d8a4d8` Git geçmişindedir. Gerçek DB başlangıç hash'i `8210a4b79f2cfb9cf74de6a4989f5c8a5449ba1d17b2332abdbd018c3741a158`; bütün mevcut izole runner'larda değişmedi. Kullanıcının `client/src/lib/api.ts` ve `client/src/pages/server-setup.tsx` değişiklikleri korunur ve commit dışında tutulur.

Gerçek sesli ekran okuyucu kullanıcı kararıyla kapsam dışıdır. Fiziksel yazıcı/OS diyalogu, canlı parola sıfırlama/kuyruk teslimi, bütün panel işlemlerinin yeniden E2E koşusu, üretim kapasitesi ve yeni özellik önerileri bu dar onarım kapsamının geçtiği kontroller değildir. Eski offline liste formatındaki sonuç durumu ancak çevrimiçi yenilemeden sonra bilinir; yeni yerel completion skor olmadan gösterilebilir, çevrimiçi sonuç geldiğinde güncellenir.

Son kod incelemesinde baskı SVG genişliğinin sınıf sayısıyla büyüyüp etiketleri küçülttüğü yeni P2 bulundu.30 sınıflı regresyon RED1 hata/3 geçiş verdi; grafik en çok beş sınıflık sabit600×240 gruplara bölündü ve GREEN4/4 geçti. Ekran grafiği korunur; uzun etiketler iki satırla sınırlandırılır, tam adlar tabloda kalır. Gerçek Chromium altı grubu,11px etiketleri,100%/75% geometrisini ve tüm30 tablo kaydını doğruladı. Üç sayfalık PDF metin ve görsel olarak kontrol edildi. Son salt okuma incelemesi yeni blocker bulmadı.

Bu son doğrulamanın ilk eşzamanlı tarayıcı/frontend koşusunda dört mevcut test5s süresini aştı; tarayıcı ekran görüntüsü font beklemesinde5s sınırını aştı. Başarısız koşular results-client-repairs-contention.json, ux-detail-contention.json ve ux-runner-contention.json içinde korunur. Assertion veya süre sınırları gevşetilmeden ayrı koşular tekrarlandı; tarayıcı16/16 ve süreç temizliği geçti. Tam frontend tek worker ile28 dosyada176/176 geçti (339,44s).
