# Uygulama planı

> **Tarihsel plan/tasarım kaydı.** 14 Ekim 2026 belge kontrolü: gelecek zaman, açık kutular ve ara sonuçlar özgün çalışma sırasını korur; güncel yapılacaklar olarak okunmamalıdır. [Sonuç ve kapsam kaydı](../../integration-audit/defect-repairs.md) esas alınır.

1. Tarihsel ölçümleri koru; SMTP kullanıcı teslim doğrulamasını kaydet.
2. AI, öğrenci UX ve bildirim/baskı alanlarında ayrı sahiplerle önce başarısız regresyon, sonra en küçük düzeltme ve odaklı yeşil test çalıştır.
3. İzole fixture üzerinde diğer testlerden ayrı yük profili al; bir hipotezi değiştirip aynı ölçümü karşılaştır. Kanıtlanan kök nedeni regresyonla düzelt.
4. Karakterizasyon araçlarını ürün kabul kriterlerini gerçekten assert eden tarayıcı/PDF kontrollerine dönüştür. Kontrollü hata, yeniden deneme, çevrimdışı durum ve hızlı baskıyı doğrula.
5. Sırasıyla tam testler, type-check/build, Chromium, PDF, iki çağrı sınırıyla gerçek AI, Socket ve temiz yük koşusunu çalıştır. Başarısızlıkları gizleme.
6. Bağımsız diff incelemesi, README/ilgili docs, Graphify güncelleme/tanı, gizli değer taraması, DB hash ve kullanıcı dosyalarının korunma kontrolünü tamamla.
7. Yalnız bu çalışmanın dosyalarını stage et ve commit at; mevcut kullanıcı değişikliklerini commit dışında bırak.
