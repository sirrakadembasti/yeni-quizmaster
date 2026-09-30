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

GitHub HTML dosyasını uygulama olarak çalıştırmaz. Depoyu indirdikten sonra `graphify-out/graph.html` dosyasını tarayıcıda açın.

Windows PowerShell:

```powershell
Start-Process .\graphify-out\graph.html
```

İsterseniz proje kökünde yerel bir statik sunucu da başlatabilirsiniz:

```powershell
python -m http.server 8080
```

Ardından `http://localhost:8080/graphify-out/graph.html` adresini açın. Haritada düğüm arayabilir, topluluklara göre filtreleyebilir ve bağlantıları inceleyebilirsiniz.

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
