# QuizMaster Graphify Mimari Haritası

## 5 Kasım 2026 `docs/` Türkçe yeniden yapılandırması, `domain/demo` salt-okunur ikinci kopya (`demo.db`), `/demo` URL ad alanı koruması ve PostgreSQL hazırlık güncellemesi

`graphify update . --force` ve `graphify diagnose multigraph --graph graphify-out/graph.json --json` çıkış 0 ile tamamlandı: **3.758 düğüm, 8.453 kenar, 253 topluluk**. `docs/` dizini Türkçe kılavuzlar ve `docs/denetim-raporlari/` altındaki 6 birleştirilmiş kabul raporuyla sadeleştirildi; aktif test/kanıt çıktıları `tests/denetim-kanitlari/` altına taşındı. Salt-okunur `domain/demo` ikinci kopya mimarisi (`server/utils/demo-mode.ts`, `server/middleware/demo-guard.ts`, `isRequestInDemoContext`, `server/prisma/prepare-demo-db.ts`, `client/src/lib/demo-mode.ts`, `DemoAwareRouter`, `enterDemoNamespace`, `getAccountDemoPassword`, `renderIndexHtmlForBasePath`), 4 hazır vitrin hesabı (`demo-admin`, `demo-ogretmen`, `demo-ogrenci`, `demo-veli`), kayıt başarı bilgilendirme e-postası (`sendRegistrationSuccessEmail`), SMTP'siz tek kullanımlık parola sıfırlama bağlantısı (`issueOfflinePasswordReset`), yerel yönetici kurtarma betiği (`server/prisma/reset-admin.ts`), PostgreSQL hazırlık yardımcıları (`detectDatabaseProvider`, `resolveConfiguredDatabaseUrl`, `getDatabaseMigrationReadiness`) ve 40 demo veli hesabı belgeleri çalışma ağacından çıkarıldı. Eksik/sarkan/dış uç, unverified düğüm, tam yinelenen kenar ve self-loop 0; producer suppression 11. Tanı üretilmiş grafiği inceler; ham üretici ilişki kaybını kanıtlamaz.

25 SQL dosyası `tree_sitter_sql` eksikliği nedeniyle katkı vermedi. Markdown/görsel semantiği ve LLM topluluk etiketleri yenilenmedi; token maliyeti 0. Aşağıdaki üretimler tarihsel kayıttır.

## Tarihsel Mimari Harita Güncellemeleri Özeti

| Tarih | Düğüm / Kenar / Topluluk | Kapsam ve İlgili Rapor |
|---|---|---|
| **16 Ekim 2026** | 4.161 / 10.699 / 208 | AI profil yönetimi, sağlayıcı doğrulaması, token kullanım kaydı ve iki sekmeli yönetici arayüzü — [Yapay Zeka Yönetimi Kılavuzu](yapay-zeka-yonetimi.md) |
| **15 Ekim 2026** | 3.881 / 10.032 / 201 | İşlem kapısı, bağımsız okumalar, revizyonlu bildirim tercihleri ve 80 öğrencilik sınav provası — [Performans ve Kapasite Raporu](performans-ve-kapasite-raporu.md) |
| **14 Ekim 2026** | 3.563–3.806 / 9.212–9.855 / 188–207 | Üretim yükseltme/geri dönüş provası ve kod tabanı envanter incelemesi — [Üretim ve Bakım Kılavuzu](uretim-ve-bakim-kilavuzu.md) ve [Dokümantasyon İnceleme Özeti](dokumantasyon-inceleme.md) |
| **12 Ekim 2026** | 3.238 / 8.407 / 183 | Akademik arşiv (`warmHistoryProjection`) kapanışı — [Akademik Arşiv Kabul Raporu](denetim-raporlari/akademik-arsiv-kabul-raporu.md) |
| **4 Ekim 2026 (Entegrasyon)** | 2.770 / 7.126 / 159 | Çapraz rol ve oturum (`createSessionStore`) onarımları — [Entegrasyon Denetim Raporu](denetim-raporlari/entegrasyon-denetim-raporu.md) ve [tanı kaydı](../tests/denetim-kanitlari/entegrasyon/graphify-diagnostic.txt) |
| **4 Ekim 2026 (Veli)** | 2.583 / 6.795 / 148 | Veli portalı (`ParentResultsPage`) onarımları — [Veli Denetim Raporu](denetim-raporlari/veli-denetim-raporu.md) ve [görsel kanıt](../tests/denetim-kanitlari/veli/graphify/result.json) |
| **4 Ekim 2026 (Öğrenci)** | 2.465 / 6.556 / 130 | Öğrenci sınav (`StudentQuiz`, `reconcileOfflineSession`) onarımları — [Öğrenci Denetim Raporu](denetim-raporlari/ogrenci-denetim-raporu.md) ve [görsel kanıt](../tests/denetim-kanitlari/ogrenci/graphify/result.json) |
| **4 Ekim 2026 (Öğretmen)** | 2.340 / 6.316 / 124 | Öğretmen doğru cevap raporu ve PDF/yazdırma düzeltmeleri — [Öğretmen Denetim Raporu](denetim-raporlari/ogretmen-denetim-raporu.md) |
| **3 Ekim 2026 (Yönetici)** | 2.317 / 6.260 / 122 | Yönetici paneli, hibrit kurulum (`deploySetupDatabase`) ve dışa aktarma kapanışı — [Yönetici Denetim Raporu](denetim-raporlari/yonetici-denetim-raporu.md) ve [görsel kanıt](../tests/denetim-kanitlari/yonetici/evidence/closure/graphify/result.json) |

---

## Paylaşılan Çıktılar

Bu belge, QuizMaster kod tabanının Graphify ile oluşturulan bilgi grafiğini incelemek ve güncellemek isteyen geliştiriciler içindir. Graphify uygulamanın çalışma zamanı bağımlılığı değildir; geliştirme, mimari keşif ve etki analizi aracıdır.

Depoda yalnız üç temel çıktı sürümlenir:

| Dosya | Amaç |
|---|---|
| [`graph.html`](../graphify-out/graph.html) | Tarayıcıda açılan etkileşimli görsel mimari harita |
| [`GRAPH_REPORT.md`](../graphify-out/GRAPH_REPORT.md) | Ana düğümler, topluluklar, şaşırtıcı bağlantılar ve önerilen sorular |
| [`graph.json`](../graphify-out/graph.json) | `query`, `path` ve `explain` komutlarının kullandığı sorgulanabilir tam grafik |

Güncel düğüm, kenar ve topluluk sayıları her üretimde [`GRAPH_REPORT.md`](../graphify-out/GRAPH_REPORT.md) içinde yeniden yazılır.

---

## Görsel Haritayı Açma

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

---

## Graphify Kurulumu

Python 3.10 veya üzeri gereklidir. İzole kurulum önerilir:

```powershell
uv tool install graphifyy
graphify install --platform codex
```

`uv` yoksa `pipx install graphifyy` kullanılabilir. Kurulumu kontrol edin:

```powershell
graphify --help
```

---

## Grafiği Sorgulama

Komutları proje kökünde çalıştırın:

```powershell
graphify query "kimlik doğrulama akışı nasıl çalışıyor"
graphify path "DashboardLayout" "PrismaStorage"
graphify explain "IStorage"
graphify god-nodes --top 10
```

Bu komutlar varsayılan olarak `graphify-out/graph.json` dosyasını kullanır. Böylece asistanın bütün kaynak dosyalarını tekrar okuması gerekmez.

---

## Grafiği Güncelleme

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

---

## Commit Öncesi Kontrol

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

---

## Neden Diğer Dosyalar Paylaşılmıyor?

Aşağıdaki dosyalar makineye özgü, geçici veya yeniden üretilebilir olduğu için `.gitignore` kapsamında kalır:

- `cache/` ve tarihli yedekler
- `manifest.json` ve `cost.json`
- `.graphify_python` ve `.graphify_root`
- analiz/etiket ara dosyaları
- `memory/` ve `reflections/`
- isteğe bağlı veya eski dışa aktarımlar

Bu yaklaşım, görsel keşif ve geliştirici sorguları için gerekli çıktıları paylaşırken depoda yerel geçmiş ve gereksiz üretim dosyalarının birikmesini önler.

---

## Güncellik ve Doğrulama Kuralı

Graphify çıktıları kaynak kodun yerine geçmez. AST import/çağrı/sınıf ilişkilerini gösterir; yetkilendirme, transaction, arşivleme, yükseltme veya geri dönüş güvenliğini tek başına kanıtlamaz. Bu davranışlar [Üretim ve Bakım Kılavuzu](uretim-ve-bakim-kilavuzu.md), [Performans ve Kapasite Raporu](performans-ve-kapasite-raporu.md) ve `docs/denetim-raporlari/` altındaki kabul raporlarıyla doğrulanır.
