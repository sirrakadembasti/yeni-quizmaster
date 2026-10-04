# QuizMaster Graphify Mimari Haritası

**4 Ekim 2026 entegrasyon denetimi sonrası güncel AST haritası:** `graphify update .` ve `diagnose multigraph` çıkış0: **2708 düğüm,6994 kenar,154 topluluk**. Eksik/sarkan/yinelenen/unverified/external uç0; self-loop12, producer suppression12. `built_at_commit=6367b54d6cae9bac602df211282a9d0cfc9d58aa` üretimin başlangıç HEAD'idir; yeni test kaynakları ve korunan iki kullanıcı düzenlemesi çalışma ağacından çıkarıldı. SQL parser/pypdf eksikleri ve Markdown/LLM semantiğinin yenilenmemesi sürer;151 kayıtlı etiket/154 topluluk,41 merkez adıyla yeniden adlandırma. Bu koşuda canvas görsel testi yeniden çalıştırılmadı. [Tanı](integration-audit/graphify-diagnostic.txt) ve [çalışma zamanı testleri](integration-audit/verification.md) ayrı kanıtlardır; harita güncellemesi testlerde bulunan hataları düzeltmez. Aşağıdaki sayılar önceki üretimlerin tarihsel kayıtlarıdır.

**4 Ekim 2026 veli onarımları sonrası güncel AST haritası:** `graphify update .` ve `diagnose multigraph` çıkış0: **2583 düğüm,6795 kenar,148 topluluk**. Eksik/sarkan/yinelenen/unverified/external uç0; self-loop11, producer suppression12. `built_at_commit=411b56cbb160cfb5cf9ef1f6f00da4cb56054e12` üretim başlangıcındaki HEAD'dir; onarım kodu ve commit dışında korunan iki kullanıcı client düzenlemesi çalışma ağacından çıkarıldı.

Gerçek CDN renderer ile `ParentResultsPage()` seçimi geçti: JSON ve canvas **21 bağlantıda** eşleşti, sayfa/konsol/ağ hatası0; browser/server cleanup başarılı. [Görsel sonuç](parent-audit/graphify/result.json), [harita](parent-audit/graphify/map.png), [tanı](parent-audit/graphify/update-diagnostic.json). Çalışma zamanı kabulü ayrı kanıttır: [50/50 E2E ve onarım raporu](parent-audit/defect-repairs.md).

14 SQL dosyasında `tree_sitter_sql`, Graphify PDF çıkarımında `pypdf` eksikliği sürer; PDF'ler ayrı runtime ile doğrulandı. CSS AST çıkarımında sınıflandırılmadı; baskı davranışı gerçek PDF kontrolleriyle sınandı. Markdown/görsel semantiği ve LLM etiketleri yenilenmedi:142 kayıtlı etiket/148 topluluk,50 merkez adıyla yeniden adlandırma. Tanı post-build grafiği ölçer; ham üretici kaybının sıfır olduğunu kanıtlamaz. Aşağıdaki üretimler tarihsel kayıttır; önceki veli haritası `parent-audit/historical-graphify` altında korunur.

**4 Ekim 2026 veli denetimi sonrası güncel harita:** Yerel kod AST güncellemesi ve multigraph tanısı çıkış0: **2558 düğüm,6734 kenar,142 topluluk**. Eksik/sarkan/yinelenen/unverified/external uç0; self-loop11, producer suppression12. Tanı post-build grafiği ölçer; ham üretici kaybının sıfır olduğu anlamına gelmez. `built_at_commit=b1257ebd6094bacc4ca746e7c8d874b8d181159a` üretim başlangıcındaki HEAD'dir. Veli audit testleri çalışma ağacından çıkarıldı; korunmuş iki kullanıcı client düzenlemesi haritada yer alır, audit commit kapsamı dışında kalır.

Gerçek CDN renderer ile `ParentResultsPage()` seçimi geçti; JSON/canvas üzerinde19 bağlantı eşleşti, sayfa/konsol/ağ hatası0 ve tarayıcı/yerel sunucu cleanup başarılı: [görsel test](parent-audit/historical-graphify/result.json), [harita](parent-audit/historical-graphify/map.png), [tanı](parent-audit/historical-graphify/update-diagnostic.json). Harita güncelliği veli hatalarının giderildiği anlamına gelmez; [41 kontrolün26 geçtiği,15 başarısız olduğu veli denetimi](parent-audit/verification.md).

14 SQL dosyası `tree_sitter_sql` eksikliği nedeniyle katkı vermedi; Graphify PDF metin çıkarımında pypdf eksikliği sürer. PDF'ler ayrı runtime ile metin/render ve bildirim satır bütünlüğü açısından denetlendi. Markdown/görsel semantiği ve LLM etiketleri yenilenmedi:130 kayıtlı etiket/142 güncel topluluk,40 merkez adıyla yeniden adlandırma. Son belge değişiklikleri semantik olarak çıkarılmadı. Aşağıdaki sayılar önceki tarihsel üretimlerdir.

**4 Ekim 2026 öğrenci onarımları sonrası güncel harita:** Yerel AST üretimi ve `diagnose multigraph` çıkış0 ile tamamlandı: **2465 düğüm,6556 kenar,130 topluluk**; öğrenci audit kaynaklarından89 düğüm. Eksik/sarkan/yinelenen/unverified/external uç0; self-loop8, producer suppression12. Tanı post-build grafiği inceler; ham üretici kaybının sıfır olduğunu kanıtlamaz. `built_at_commit=053138e72aa141a4b5ddde08beb84af08d21fc2b` üretim başlangıcındaki HEAD'dir; onarımlar ve commit dışında korunan iki kullanıcı client düzenlemesi çalışma ağacından çıkarıldı.

Gerçek vis-network CDN renderer testi geçti: `StudentQuiz()` düğümü32 bağlantıyla JSON ve canvas üzerinde eşleşti; `reconcileOfflineSession()` ve `acknowledgeOfflineAnswer()` komşuları doğrulandı. Sayfa/konsol/ağ hatası0; tarayıcı ve yerel sunucu kapandı. [Görsel sonuç](student-audit/graphify/result.json), [harita](student-audit/graphify/map.png), [tanı](student-audit/graphify/update-diagnostic.json). Çalışma zamanı kapanışı ayrı kanıttır: [altı hata onarımı ve39 E2E kontrolü](student-audit/defect-repairs.md).

14 SQL dosyasında `tree_sitter_sql` ve Graphify PDF çıkarımı için `pypdf` eksikliği sürer. Markdown/görsel semantiği ve LLM etiketleri yenilenmedi;137 kayıtlı etiket/130 güncel topluluk arasında45 topluluk merkez adıyla yeniden adlandırıldı. Son belge değişiklikleri semantik olarak tekrar çıkarılmadı. PDF ayrıca gerçek export doğrulayıcısıyla denetlendi.

Aşağıdaki öğrenci denetimi ve daha eski üretim sayıları tarihsel kayıttır; bunların ekran/JSON bağlantıları son görsel koşuyla güncellenmiştir.

**4 Ekim 2026 öğrenci denetimi sonrası güncel harita:** Son yerel AST üretimi çıkış0 ile **2454 düğüm, 6536 kenar, 137 topluluk** oluşturdu; öğrenci audit kaynaklarından82 düğüm içerir. `diagnose multigraph` çıkış0: eksik/sarkan/yinelenen/unverified/external uç0; self-loop8 ve producer suppression12. Bu tanı ham üretici ilişki kaybının sıfır olduğunu kanıtlamaz. `built_at_commit=38afee6b960649aad658bd1965ada7cc33bdd8c2` üretim başlangıcındaki HEAD'dir. Harita commit öncesi çalışma ağacını ve kullanıcının commit dışında korunan iki client düzenlemesini içerir.

14 SQL dosyasında `tree_sitter_sql`, Graphify ortamında PDF metin çıkarımı için `pypdf` eksikliği sürer; Markdown/görsel semantiği ve LLM topluluk etiketleri yenilenmedi. Bu koşuda128 kayıtlı etiket/137 topluluk ve merkez adlarıyla41 yeniden adlandırma bildirildi. Öğrenci PDF'si ayrı Python runtime ile pypdf/pypdfium2 kullanılarak denetlendi. Görsel harita testi gerçek CDN renderer ile `StudentQuiz()` düğümünü seçer; [görsel sonuç](student-audit/graphify/result.json), [genel harita](student-audit/graphify/overview.png), [öğrenci bilgi paneli](student-audit/graphify/selected-info.png). Harita doğrulaması altı açık ürün kusurunun giderildiği anlamına gelmez; [öğrenci kapsam raporu](student-audit/verification.md).

Aşağıdaki önceki üretim sayıları tarihsel kayıttır.

**4 Ekim 2026 öğretmen düzeltmeleri:** Gerçek yerel AST güncellemesi çıkış0 ile **2340 düğüm,6316 kenar,124 topluluk** üretti. Doğru cevap raporu, reset gönderim koruması ve Windows regresyon başlatıcısı son kaynaklardan çıkarıldı. `diagnose multigraph` çıkış0: eksik/sarkan/yinelenen/unverified uç0, self-loop4, producer suppression12. Bunlar ham üretici kaybının sıfır olduğunun kanıtı değildir. SQL parser bulunmadığı için14 SQL dosyası; Graphify ortamında pypdf olmadığı için PDF metni atlandı. LLM semantik etiketleri yenilenmedi. PDF doğruluğu Graphify dışındaki gerçek Chromium+pypdf/PyMuPDF testleriyle doğrulandı; [öğretmen kapanışı](teacher-audit/defect-repairs.md).

Haritanın `built_at_commit` değeri `2c2e9fd` güncelleme başlangıcındaki HEAD'dir; commit öncesi çalışma ağacı, kullanıcının iki bağımsız client değişikliği dahil, haritaya alınır. Aşağıdaki3 Ekim sayıları tarihsel üretimleri anlatır.

Bu belge, QuizMaster kod tabanının Graphify ile oluşturulan bilgi grafiğini incelemek ve güncellemek isteyen geliştiriciler içindir. Graphify uygulamanın çalışma zamanı bağımlılığı değildir; geliştirme, mimari keşif ve etki analizi aracıdır.

## Paylaşılan çıktılar

Depoda yalnız üç temel çıktı sürümlenir:

| Dosya | Amaç |
|---|---|
| [`graph.html`](../graphify-out/graph.html) | Tarayıcıda açılan etkileşimli görsel mimari harita |
| [`GRAPH_REPORT.md`](../graphify-out/GRAPH_REPORT.md) | Ana düğümler, topluluklar, şaşırtıcı bağlantılar ve önerilen sorular |
| [`graph.json`](../graphify-out/graph.json) | `query`, `path` ve `explain` komutlarının kullandığı sorgulanabilir tam grafik |

Güncel düğüm, kenar ve topluluk sayıları her üretimde [`GRAPH_REPORT.md`](../graphify-out/GRAPH_REPORT.md) içinde yeniden yazılır.

30 Eylül 2026'daki ilk admin veri bütünlüğü düzeltmesinden sonra `graphify update .` çalıştırıldı: 1867 düğüm, 5284 kenar ve 90 topluluk. `graphify diagnose multigraph --graph graphify-out/graph.json` sıfır eksik uç ve sıfır yinelenen kenar raporladı. Bu güncelleme yerel AST çıkarımıdır; Graphify'nin belirttiği SQL ayrıştırıcı bağımlılığı kurulu olmadığı için 14 SQL dosyası grafiğe katkı vermedi. Markdown değişiklikleri için semantik LLM çıkarımı bu koşuda yapılmadı. Hibrit `.bat`/`.sh` ve web kurulum akışı mimarisini değerlendirirken kaynak belgeleri ayrıca okuyun.

Graphify raporundaki `Built from commit` alanı, komutun başladığı andaki HEAD'i gösterir. Bu üretimde commit öncesi çalışma ağacındaki yeni kod da çıkarıldı; bu nedenle yalnız HEAD karşılaştırması grafiğin bu düzeltmeler açısından eski olduğunu göstermez.

İkinci admin onarım paketinden sonra kod AST haritası tekrar üretildi: **1906 düğüm, 5393 kenar, 94 topluluk**. Yeni atomik içerik handler'ı, transaction kaydı, HTTP taşıması ve ilişkisel cache yenilemesi haritadadır. Multigraph tanısı eksik/sarkan uç0 ve yinelenen kenar0 raporladı; iki self-loop kaldı. Topluluk yapısı değiştiğinden önceki semantik topluluk etiketlerinin bir kısmı merkez düğüm adıyla yenilendi; LLM etiketleme çalıştırılmadı. 14 SQL dosyası için ayrıştırıcı eksikliği ve Markdown semantik çıkarımı sınırı sürer. Bu görsel harita çalışma zamanı/E2E doğrulamasının yerine geçmez.

## Görsel haritayı açma

1 Ekim 2026 kalan admin onarımlarından sonra harita tekrar üretildi: **2027 düğüm, 5705 kenar, 109 topluluk**. Arşiv/audit transaction'ı, sorumlu öğretmen bağının kaldırılması, kapasite/rol doğrulaması, ortak soru doğrulaması ve yeni E2E'ler çalışma ağacından çıkarıldı. Kullanıcının commit dışında korunan localhost düzenlemeleri de çalışma ağacının parçasıdır. Geçici yardımcı dosyalar üretimden önce kaldırıldı. Bu güncelleme AST içindir; 14 SQL dosyasında ayrıştırıcı eksikliği ve Markdown/görsel içerik için semantik LLM çıkarımı sınırı sürer. Güncel çalışma zamanı kanıtları [onarım doğrulama raporundadır](admin-audit/remaining-repairs-verification.md).

3 Ekim 2026 önceki Windows admin kapanışındaki tarihsel harita **2206 düğüm,
6030 kenar, 114 topluluk** içeriyordu; update ve diagnose çıkış **0**, eksik/sarkan
uç, duplicate ve unverified **0**, self-loop **3** idi. O aşamanın görsel kontrolü
**14:45:56–14:46:22 UTC** arasında geçti: gerçek CDN HTTP 200, canvas 1320 × 1000,
seçilen `deploySetupDatabase()` derece/bağlı kenar **6/6**, sayfa/konsol/istek
hataları **0/0/0**. Bu tarihsel sayılar sonraki haritanın güncel sonucu değildir.

### 3 Ekim 2026 native Linux ve öğretmen denetimi sonrası güncel harita

Gerçek `graphify update .` çıkış **0** verdi: **2317 düğüm, 6260 kenar,
122 topluluk**; **537 uncached dosya** işlendi. Linux süreç temizliği, rapor
sansürleyicisi ve öğretmen denetimi kaynakları çalışma ağacından çıkarıldı.
`graphify diagnose multigraph --graph graphify-out/graph.json` çıkış **0** ile
eksik uç **0**, sarkan uç **0**, tam yinelenen kenar **0**, unverified **0**,
external **0** ve self-loop **3** kaydetti. Tanı 6260 geçerli ham kenar ve
oluşturulan Graph tipinde 6260 kenar raporladı; **12 producer suppression site**
notu ham üreticide ilişki kaybı olmadığının kanıtı değildir.

Yerel AST üretiminde `tree_sitter_sql` eksikliği nedeniyle **14 SQL dosyası**
katkı vermedi; Graphify Python ortamında `pypdf` olmadığı için PDF metni
çıkarılmadı. Ayrı runtime ile gerçek öğretmen PDF kontrolleri bu sınırdan
etkilenmez. Markdown, görsel ve belge semantiği için LLM çıkarımı yenilenmedi.
**114 kayıtlı etiket / 122 güncel topluluk** ve merkez düğüm adıyla **32 yeniden
adlandırma** kaydedildi; LLM yeniden etiketleme yapılmadı. Grafik migration,
yetkilendirme, erişilebilirlik veya runtime güvenliğini tek başına kanıtlamaz.

Grafik commit öncesi çalışma ağacını içerir. `built_at_commit`
**1570797aeca197c07c4166dc55bf59d201757e08** üretim anındaki HEAD'dir;
kullanıcının `client/src/lib/api.ts` ve `client/src/pages/server-setup.tsx`
localhost hunk'ları haritada bulunabilir, commit kapsamı dışındadır. Sonraki
Markdown/tanı değişiklikleri semantik olarak yenilenmiş sayılmaz.
[Güncelleme/tanı kaydı](admin-audit/evidence/closure/graphify/graph-update-diagnostic.json).

Güncel haritanın gerçek Chromium görsel kontrolü **3 Ekim 2026
19:19:21.759–19:19:58.073 UTC** arasında çıkış **0** ile geçti. Yalnız
`graphify-out` sunan geçici loopback sunucudan açılan sayfada gerçek CDN
`vis-network` isteği HTTP **200** verdi; renderer taklit edilmedi. Görünen
canvas **1320 × 1000**, sayılan grafik **2317/6260/122** idi. Aramayla seçilen
`deploySetupDatabase()` bilgi panelinde `server/setup-wizard/migration.ts`,
derece **6** ve **6 bağlı kenar** gösterdi. Altı komşu `applySetup()`, `server.ts`,
`setup-migration.test.ts`, `migration.ts`, “Görsel haritayı açma” ve
“Integration and report” idi; belge komşuları yeni LLM çıkarımı kanıtı değildir.
Sayfa/konsol/başarısız istek hataları **0/0/0**, yalnız runner'ın kendi tarayıcı
ve sunucusunun kapanması true. Koordinatör güncel harita ve bilgi panelini
görüntüleyip inceledi.
[Güncel gerçek sonuç](admin-audit/evidence/closure/graphify/result.json),
[genel görünüm](admin-audit/evidence/closure/graphify/overview.png),
[seçili harita](admin-audit/evidence/closure/graphify/map.png) ve
[bilgi paneli](admin-audit/evidence/closure/graphify/selected-info.png)
bu güncel üretime aittir. Görsel geçiş uygulama E2E'si, tam semantik çıkarım,
ham üretici kayıpsızlığı veya kurulum kabulü değildir.

GitHub HTML dosyasını uygulama olarak çalıştırmaz. Depoyu indirdikten sonra `graphify-out/graph.html` dosyasını tarayıcıda açın.

Windows PowerShell:

```powershell
Start-Process .\graphify-out\graph.html
```

İsterseniz proje kökünden yalnız harita dizinini sunan yerel bir statik sunucu başlatabilirsiniz:

```powershell
python -m http.server 8080 --bind 127.0.0.1 --directory graphify-out
```

Ardından `http://127.0.0.1:8080/graph.html` adresini açın. Haritada düğüm arayabilir, topluluklara göre filtreleyebilir ve bağlantıları inceleyebilirsiniz.

## Graphify kurulumu

Python 3.10 veya üzeri gereklidir. İzole kurulum önerilir:

```powershell
uv tool install graphifyy
graphify install --platform codex
```

`uv` yoksa `pipx install graphifyy` kullanılabilir. Kurulumu kontrol edin:

```powershell
graphify --help
```

## Grafiği sorgulama

Komutları proje kökünde çalıştırın:

```powershell
graphify query "kimlik doğrulama akışı nasıl çalışıyor"
graphify path "DashboardLayout" "PrismaStorage"
graphify explain "IStorage"
graphify god-nodes --top 10
```

Bu komutlar varsayılan olarak `graphify-out/graph.json` dosyasını kullanır. Böylece asistanın bütün kaynak dosyalarını tekrar okuması gerekmez.

## Grafiği güncelleme

Kod değişikliklerinden sonra yerel AST tabanlı güncelleme:

```powershell
graphify update .
```

Dosya silinen veya kapsamlı yeniden düzenleme yapılan bir değişiklikten sonra:

```powershell
graphify update . --force
```

Markdown, belge veya görsel içerikleri değiştiğinde semantik çıkarım da yenilenmelidir. Graphify becerisi bulunan AI asistanında:

```text
/graphify . --update
```

CI veya doğrudan CLI kullanımında yapılandırılmış sağlayıcıyla örnek:

```powershell
graphify extract . --backend gemini
```

API anahtarlarını komuta, belgeye veya Git geçmişine yazmayın; yalnız güvenli ortam değişkenlerinde tutun.

## Commit öncesi kontrol

1. `graphify update .` veya uygun semantik güncellemeyi çalıştırın.
2. Grafik bütünlüğünü kontrol edin:

   ```powershell
   graphify diagnose multigraph --graph graphify-out/graph.json
   ```

3. `graph.html` dosyasını açıp arama ve düğüm ayrıntısını deneyin.
4. Çıktılarda gizli değer, `.env` içeriği veya yerel kullanıcı yolu bulunmadığını kontrol edin.
5. Yalnız üç temel çıktının Git durumuna girdiğini doğrulayın:

   ```powershell
   git status --short graphify-out
   ```

## Neden diğer dosyalar paylaşılmıyor?

Aşağıdaki dosyalar makineye özgü, geçici veya yeniden üretilebilir olduğu için `.gitignore` kapsamında kalır:

- `cache/` ve tarihli yedekler
- `manifest.json` ve `cost.json`
- `.graphify_python` ve `.graphify_root`
- analiz/etiket ara dosyaları
- `memory/` ve `reflections/`
- isteğe bağlı veya eski dışa aktarımlar

Bu yaklaşım, görsel keşif ve geliştirici sorguları için gerekli çıktıları paylaşırken depoda yerel geçmiş ve gereksiz üretim dosyalarının birikmesini önler.

## Güncellik kuralı

Graphify çıktıları kaynak kodun yerine geçmez. Grafik ve raporun son committe güncel olup olmadığını kontrol edin; şüphe varsa kaynak kodu doğrulayın ve grafiği yeniden üretin. Bir özellik değişikliğinde mümkünse kod ve üç Graphify çıktısı aynı committe güncellenmelidir.

## Bakımda güncellik kontrolü

Gerçek Graphify 0.9.72 CLI ile yerel AST çıkarımı yenilenir. AST import/çağrı/sınıf ilişkilerini gösterir; yetkilendirme, transaction veya cascade güvenliğini kanıtlamaz. Bunlar kaynak ve regresyon testleriyle doğrulanır. Şema/lockfile AST kapsamından ayrı incelenir.

`built_at_commit` üretim anındaki HEAD'dir; commitlenmemiş kaynak için tek başına yeterli değildir. Manifest içerik özetlerini kaynaklarla karşılaştırın, HTML/JSON düğüm/kenar tutarlılığını doğrulayın. Tarihli yedekler eski snapshot olabilir.

Windows uv trampoline hatasında izole ortamın `Scripts/python.exe -m graphify update . --force` komutu kullanılabilir; ortam yolu makineye özeldir. Markdown semantiğinin LLM çıkarımı yerel AST bakımına dahil değildir.

SQL parser eklentisi olmayan ortamda CLI .sql dosyalarının düğüm üretmediğini bildirir; migration güvenliği AST haritasından çıkarılamaz. İstenirse Graphify SQL extra ayrıca kurulabilir. Bakım haritası mevcut çalışma ağacını içerir; commit dışındaki yerel kurulum düzenlemeleri de çalışma ağacında bulunabilir.
