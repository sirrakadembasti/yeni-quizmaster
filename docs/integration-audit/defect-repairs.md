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

## Tarihsel UX kapsamı ve kapsam dışı öneriler

> 14 Ekim 2026: ayrı belge bu bölüme içeriği korunarak birleştirildi. Aşağıdaki metin özgün tarihli tasarım/kapsam kaydıdır; güncel açık görev listesi değildir.

## Kalan UX kapsamı — 4 Ekim 2026

Bu liste onarım öncesindeki kapsam ve önerileri korur. S-U01–08, T-U01–04 ve baskı sütunu kusurlarının sonraki düzeltme/kabul durumu [onarım raporundadır](defect-repairs.md). Yeni özellik tablosu bu onarıma dahil değildir.

Bu dosya ilk kaynak karşılaştırmasının kapsam listesidir. Sonraki gerçek Chromium, kontrollü ağ, çevrimdışı ve PDF kontrollerinin kabul sonuçları bu belgenin üst bölümünde, `ux-detail-results.json` ve `ux-extra-results.json` içindedir. Aşağıdaki “aday/henüz çalıştırılmadı” anlatımları bu listenin ilk hazırlanma aşamasını açıklar; son test durumu için doğrulama raporu esas alınır.

Bu kayıt mevcut kaynak ve önceki denetim raporlarının salt okunur karşılaştırmasıdır. Bu çalışma sırasında yeni tarayıcı koşusu, sunucu veya ağır test paketi başlatılmadı; aşağıdaki kabul kontrolleri henüz çalıştırılacak adaylardır. Ürün kodu değiştirilmedi. Öncelik P2 orta, P3 düşük; efor göreli tahmindir.

### Tarihsel kusurlarla karıştırılmaması gereken kapanışlar

- Öğretmen T-F01/T-F02 kapalı; ayrı T-U01–04 açık: `docs/teacher-audit/defect-repairs.md`.
- Öğrenci S-B01–06 kapalı; ayrı UX/yeni özellikler onarım kapsamı dışında: `docs/student-audit/defect-repairs.md`.
- Veli P-B01–10 **ve P-U01–05** uygulandı ve kabul kanıtı var: `docs/parent-audit/defect-repairs.md`. İlk bulgular dosyasındaki “uygulanmadı” metni tarihsel durumdur.
- Admin AX01–08, klavye/menü ve hesaplanan kontrol adları kapalı: `docs/admin-audit/verification-closure.md`, `accessibility-closure.md`. Gerçek sesli okuyucu kullanıcı kararıyla kapsam dışıdır.
- Admin Q13 eski “Toplam Sınav” önerisi kaynakta karşılanmış: `client/src/pages/dashboard.tsx:226` admin için “Toplam İçerik” gösterir. Yeniden açık kusur sayılmaz.

### Somut kalan UX kontrol listesi

| ID / yüzey | Öncelik / efor | Güncel kaynak kanıtı ve kalan öneri | Gerçek Chromium kabul adayı |
|---|---|---|---|
| T-U01 / admin+öğretmen `/results` araması | P3 / küçük | `client/src/pages/results.tsx:491` placeholder var, kalıcı bağlı label yok. Placeholder kaynaklı erişilebilir adın boş olduğu iddia edilmez. | Yazı girince amaç görünür mü; computed name; Tab; arama/reset ve 390 px düzeni. |
| T-U02 / öğretmen sınav önizlemesi | P2 / küçük | `student-quiz.tsx:433` kaydedilmez banner'ı; `:617` kaydedilecek ve sonuç sayfasına gider onayı. Rol/önizleme açıklaması ayrılmalı. | Öğretmen önizleme bitirme modalı ve öğrenci gerçek bitirme modalını ayrı kaydet; önizleme sonuç API'sini değiştirmemeli. |
| T-U03 / öğrenci rapor kodu ve PDF | P3 / küçük | `student-results.tsx:411–412` “Öğrenci Kodu” doğrudan `student.id.substring(0, 8)` gösterir. Tarihsel PDF'deki `teacher-` yalnız CSS kırpılması değildir; tam kod isteniyorsa kaynak truncation da ele alınmalı. | UUID/uzun sentetik ID ekran/PDF'de tam mı; mobil ve tablo taşması; gerçek PDF renderı. |
| T-U04 / `/statistics` hızlı baskı | P2 / orta | `teacher-audit/verification.md:84` gerçek transient SVG/PDF geometrisi; kararlı kareyi bekleyen test ürün baskı davranışını tek başına onarmaz. | İlk açılış ve filtre sonrası hemen baskı; gerçek PDF sütunları eksen alanında mı; sayı tablosuyla oran uyumu. |
| S-U01 / öğrenci dashboard detay eylemi | P2 / küçük | `student-dashboard.tsx:299` adsız ikon ve `opacity-0 group-hover:opacity-100`. Açık isim ve klavye/dokunmatik görünürlüğü. | Accessible name; hover olmadan 390 px; Tab odak görüntüsü ve Enter doğru sonucu açar mı. |
| S-U02 / `/student/quizzes` filtreler | P2 / küçük | `student-quizzes.tsx:186–197` placeholder arama; SelectTrigger ayrı label/ARIA adı yok. | Arama ve durum amaçlarının computed name'i; klavye seçim/reset; girilmiş arama sonrası görünür bağlam. |
| S-U03 / sınav cevap ve soru durumları | P2 / küçük–orta | `student-quiz.tsx:515` civarı cevap butonları seçimi CSS ile gösterir; soru gezgini de aktif/yanıtlı state semantiği için incelenmeli. | Seçim öncesi/sonrası ARIA snapshot; Tab/Enter ile cevap ve gezinme; aktif/yanıtlanan soru bilgisi. |
| S-U04 / anket yanıtı | P2 / küçük–orta | `take-survey.tsx:53–56`: açık metin soruyla ilişkilendirilmemiş; rating/single/Likert button'larında seçili semantik yok. `:27–28` hata/veri yok aynı bulunamadı mesajı; `:40` whitespace metni geçirebilir. | Beş tipte computed name/selected state; gerçek klavye; yalnız boşluk gönderimi; ayrı kontrollü 403/404/500 ve gerçek retry toparlanması. Yeni hata iddiası için koşu kanıtı gerekir. |
| S-U05 / başarı ölçütü | P2 / küçük, ürün ölçütü kararı gerekli | Dashboard `student-dashboard.tsx:272` başarı >=50; istatistik `student-stats.tsx:55` başarı >=70. Fark açıkça açıklanmalı veya aynı ürün ölçütü kullanılmalı. | 50/69/70 puanlı aynı izinli kayıtlar iki sayfada hangi anlamla sunuluyor. |
| S-U06 / çevrimdışı sınav listesi | P2 / orta | `student-quizzes.tsx:70–78` offline fallback results=[]; `:117–119` yalnız sunucu sonucu completed ise tamamlanan. Yerel devam/teslim kuyruğu yapılacakla karışabilir. S-B01 cevabın korunması onarımı bu listeyi kapatmaz. | Completed, devam eden, pendingSubmit fixture; offline reload; durum ve sayaç; online dönüşte gerçek sonuç uzlaştırması. |
| S-U07 / ortak başlık bildirimleri | P2 / küçük–orta | `components/layout/DashboardLayout.tsx:113–119` query error UI alınmaz; `:127–132` markAllRead onError yok. Tercih mutasyonunun onError'ı vardır, onu eksik diye saymayın. | Header popover GET 500 ve toplu-okundu başarısızlığı; hata/yeniden dene/gerçek toparlanma; ayarlar bildirimi başarısı bunun yerine geçmez. |
| S-U08 / istatistik baskı eylemi | P3 / küçük | `student-stats.tsx:103–105` window.print; `:143` “PDF İndir”. Eylemin “Yazdır / PDF olarak kaydet” açıklaması önerilir. | Düğme OS print akışını açıyor mu; görünen ad gerçek eylemi açıklıyor mu. Dosya bozukluğu iddiası değildir. |
| A-U01 / listelerin PDF işlemler kolonu | P3 / küçük | Admin `verification-closure.md:93` açık öneri; `admin-quizzes.tsx:132` İşlemler başlığı var. Baskıdaki global CSS etkisi yeni PDF'de ayrıca kontrol edilmeli. | Gerçek quiz/sınıf/öğretmen PDF'lerinde boş kolon kalıyor mu; silme/görüntüleme düğmeleri ve kolon birlikte gizli mi. |
| A-U02 / uzun çok sayfalı raporlar | P2 / orta test eforu | `verification-closure.md:94` kapsam genişletme; mevcut olumlu PDF kanıtı bütün veri hacimleri için sonuç değildir. | Uzun ad/soru/kod, çok satır; tekrar başlıkları, sayfa bölünmesi, tam kayıt sayısı ve sıfır puan; PDF metin+render. |

### Kusur sayılmayan yeni özellikler

| Rol / yüzey | Kalan öneri ve kaynak | Öncelik / efor | Tarayıcı incelemesinin sınırı |
|---|---|---|---|
| Veli dashboard | Son kayıtlarla sınırlama; `parent-dashboard.tsx:83` tüm `completed.map` gösterilir | P3 / küçük | Çok kayıtlı fixture mevcut görünümü gösterebilir; uygulanmayan sınır çalışıyor sayılmaz. |
| Veli sonuçlar | Arama, ders/tarih filtreleri, sayfalama; `parent-results.tsx:65–74` doğrudan results.map | P2 / orta | Mevcut kontrol yokluğu ve çok sonuç gezinme yükü incelenebilir. |
| Veli sonuç detayı | Doğrudan detay URL'si ve reload; `parent-results.tsx:17` resultId yalnız state; studentId URL'de korunur | P3 / orta | Detay aç→reload mevcut davranışı kaydet; çocuk bağlamı bug'ı kapalıdır. |
| Veli export | Veliye uygun Excel/PDF özet; findings.md yeni özellik tablosu | P3 / orta | Mevcut olmayan export'ı hata saymayın. |
| Öğretmen | Yaklaşan işler, sınav/anket kopyası, dönem karşılaştırması, kaydedilmiş filtreler, öğrenci son sonucu, sorumlu/ders sınıf ayrımı, duyuru alıcı önizlemesi, geçmiş tür/tarih filtreleri | P2/P3 / küçük–büyük | `teacher-audit/findings-source.md` özellik tablosu; bu özellikler audit kabulüne dahil değildir. Sınıf ayrımı mevcut assignment verisiyle küçük; diğerlerinin çoğu orta. |
| Öğrenci | Senkronizasyon merkezi, yanıtsız soru özeti, gelişim/hedef, bitiş tarihi yapılacaklar, öğretmen açıklaması, anket yerel taslak/çıkış uyarısı | P2/P3 / orta ağırlıklı | `student-audit/findings.md` yeni özellik tablosu; mevcut offline cevap korunması yeni senkronizasyon merkezi değildir. |
| Admin/ortak | Rapor menüsü; rota bazlı JS ayırma | P3/orta performans / orta–yüksek | `admin-audit/verification-closure.md:95–96`; bundle uyarısı tek başına ölçülmüş UX yavaşlığı değildir. Ayrı kontrollü performans bütçesi gerekir. |

### Bu alt görevin doğrulama sınırı

Kaynak konumları mevcut çalışma ağacından okundu; tarihsel line numaraları gerektiğinde yenilendi. Doküman dışında dosya değişmedi. `client/src/lib/api.ts`, `client/src/pages/server-setup.tsx`, gerçek veritabanı ve gizli değerler okunmadı/değiştirilmedi. Yeni browser kabul sonucu, yeni performans sonucu, sesli ekran okuyucu veya fiziksel baskı başarısı bu belgeden çıkarılamaz.
