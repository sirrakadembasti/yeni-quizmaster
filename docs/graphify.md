# QuizMaster Graphify Mimari Haritası

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

2 Ekim 2026 admin kapanış güncellemesi tamamlandı: **2204 düğüm, 6022 kenar,
115 topluluk**; gerçek `graphify update .` işlemi çıkış **0** verdi. Ardından
`graphify diagnose multigraph --graph graphify-out/graph.json` çıkış **0** ile
eksik uç **0**, sarkan uç **0**, tam yinelenen kenar **0**, unverified **0** ve
self-loop **3** kaydetti. Bu tanı oluşturulmuş son grafiği inceler; üretici ham
çıktısında ilişki kaybı olmadığını tek başına kanıtlamaz.

Bu üretim yerel AST güncellemesidir. `tree_sitter_sql` eksikliği nedeniyle **14
SQL dosyası** katkı vermedi; Graphify'nin kendi Python ortamında `pypdf` olmadığı
için PDF metni çıkarılmadı. Bu, başka Python ortamıyla yapılmış gerçek export/PDF
kontrollerinin yapılmadığı anlamına gelmez. Markdown, görsel ve belge semantiği
için LLM çıkarımı yenilenmedi. **109 kayıtlı etiket / 115 güncel topluluk** ve
merkez düğüm adıyla **46 yeniden adlandırma** kaydedildi; LLM yeniden etiketleme
yapılmadı. Migration güvenliği, erişilebilirlik, kurulum ve runtime başarısı bu
haritadan çıkarılamaz.

Grafik commit öncesi çalışma ağacını içerir: kullanıcıya ait `api.ts` ve
`server-setup.tsx` localhost düzenlemeleri haritada bulunabilir, fakat bu kullanıcı
hunk'ları commit kapsamı dışındadır. `built_at_commit` değeri
`e54537d72a6385ea8e3e088febba2e94f17404ed`, üretim anındaki önceki HEAD'dir;
tek başına yeni commit veya fresh kurulum kanıtı değildir. Güncellemeden sonra
AST kaynakları değişmedi; sonraki Markdown/tanı kayıtları semantik olarak
yenilenmiş sayılmaz. [Güncelleme/tanı kaydı](admin-audit/evidence/closure/graphify/graph-update-diagnostic.json)
bu kapsamı saklar.

Gerçek Chromium görsel kontrolü **2 Ekim 2026 06:28:19–06:29:47 UTC** arasında
çıkış **0** ile geçti. Harita yalnız `graphify-out` dosyalarını sunan geçici
loopback sunucudan açıldı; gerçek CDN `vis-network` isteği HTTP **200** verdi,
renderer taklit edilmedi. Görünen canvas **1320 × 1000**, sayılan grafik
**2204/6022/115** idi. Arama üzerinden `deploySetupDatabase()` seçildi;
ayrıntı paneli `server/setup-wizard/migration.ts`, derece **4** ve **4 bağlı
kenar** gösterdi. Komşular `applySetup()`, `server.ts`,
`setup-migration.test.ts` ve `migration.ts` idi. Sayfa/konsol/başarısız istek
hataları **0/0/0**; yalnız bu runner'ın tarayıcısı ve sunucusu kapatıldı.
[Gerçek sonuç](admin-audit/evidence/closure/graphify/result.json),
[genel görünüm](admin-audit/evidence/closure/graphify/overview.png),
[seçili harita](admin-audit/evidence/closure/graphify/map.png) ve
[bilgi paneli](admin-audit/evidence/closure/graphify/selected-info.png) korunur.
Koordinatör harita ve panel görsellerini görüntüleyip inceledi. Bu görsel kontrol
gerçek uygulama E2E'si, tam semantik çıkarım veya kurulum başarısı değildir.

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
