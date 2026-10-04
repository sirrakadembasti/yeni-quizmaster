# Veli paneli hata onarım planı

Başlangıç `411b56c`. Kullanıcı, denetim raporu ve önerilen düzeltme sırasını onaylayarak hataların düzeltilmesini istedi. Tasarım/kabul kriterleri `docs/parent-audit/findings.md` P-B01..10 ve ilgili P-U01..05'tir; ayrı yeni özellikler kapsam dışındadır.

**Hedef:** Veli salt okunur sınırını, öğrenci/duyuru görünürlüğünü, hata toparlama ve çocuk bağlamını düzeltmek; mevcut kurulum/diğer rol akışlarını korumak.

**Yaklaşım:** Sunucuda rol guard'ı ve ortak görünürlük/duyuru alıcı politikası; frontend'de mevcut query/API sözleşmelerinin açık loading/error/empty/retry durumları. Seçili çocuk URL parametresi yalnız gerçek bağlı listeden doğrulanır. Soru detayında mevcut HTTP/upload kullanımıyla uyumlu raster görsel doğrulaması. Baskı CSS'si yalnız ilgili viewport/pagination/form alanlarına sınırlandırılır; normal ekran davranışı korunur.

**Alternatifler:** Yalnız frontend yamaları rol/veri politikasını düzeltmez. Genel yeniden tasarım ise gereksiz kapsam/risktir. Onaylanan seçenek, kök nedenlere yönelik küçük düzeltmeler ve mevcut E2E regresyonlarıdır.

- [x] P-B01 answer role guard: veli403/DB değişmez, öğrenci200; deadline/ownership korunur.
- [x] P-B02 aktif bağlı sınıflar üzerinden duyuru alıcısı ve aynı veli dedup; rol/genel duyuru regresyonları.
- [x] P-B03 öğrenci/veli ortak sınav görünürlüğü; sınıfsız, sınıflı, draft/survey/archive sınırları.
- [x] P-B04..08/P-U01..03 dashboard/list/detail durumları, retry, çocuk bağlamı, güvenli görsel, anlamlı etiket/durum.
- [x] P-B09/10/P-U04/05 hedef etiketi,20 satırlık baskı, güvenli profil baskısı, güvenlikte parola formunu basmama, boş footer sayfasını giderme.
- [x] Birim/policy ve tam gerçek Chromium/API/SQLite E2E; ek race/403/query/rol kabul testleri; PDF metin/satır/render incelemesi.
- [x] Client/server type-check, uygun birim regresyonları, build ve bağımsız kod incelemesi.
- [x] README, öğrenci/veliyle ilişkili belgeler, onarım raporu ve Graphify güncelle; commit için doğrulanmış içeriği hazırla.

Korunan kullanıcı dosyaları `client/src/lib/api.ts`, `client/src/pages/server-setup.tsx`; staging dışında kalır. Gerçek `quiz.db` SHA256 `8210a4b79f2cfb9cf74de6a4989f5c8a5449ba1d17b2332abdbd018c3741a158`. İzole5560/5561 fixture, gerçek DB'ye yazmama, sahipli süreç temizliği ve geçmiş kırmızı kanıtları koruma zorunlu. Sesli ekran okuyucu, harici SMTP ve yeni kurulum bu onarım kapsamına eklenmez; hiçbir sınanmamış davranış geçti sayılmaz.
