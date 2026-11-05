# İkinci admin onarım paketi — doğrulama

> **Tarihsel paket doğrulaması.** Bu dosyadaki 153/153, 53/53, build/type-check, Chromium ve Graphify sonuçları ikinci paketin 30 Eylül 2026 koşularına aittir. Daha sonraki kalan onarımlar için yeniden başarı kanıtı değildir. Güncel sonuçlar ve bekleyen kontroller [kalan onarımlar doğrulama kaydında](./remaining-repairs-verification.md), güncel davranış politikası [onarım sözleşmelerindedir](./repair-contracts.md).

30 Eylül 2026. Q03/Q04/Q05, düzenleyici için Q06 ve PE02 giderildi. İlk paket PE01/Q01/Q02'yi kapsıyordu. Diğer panel denetimleri ve kalan admin bulguları tamamlanmış sayılmaz.

| Kontrol | Sonuç |
|---|---|
| `pnpm --filter quiz-master-server test` | 29 dosya, **153/153**, çıkış0 |
| `pnpm --filter quiz-master-client exec vitest run --pool=threads --maxWorkers=1` | 11 dosya, **53/53**, çıkış0 |
| İki paketin `type-check` komutu | İkisi de çıkış0 |
| İki paketin `build` komutu | İkisi de çıkış0 |
| Sonuç hesapları, gerçek Chromium ve izole DB | **1/1**: puansız/devam eden ile100; gerçek sıfır eklendikten sonra yenilemede50 |
| [SPA cache kontrolü](./results-cache-fix.json) | **1/1**: öğrenci çıkarıldıktan sonra listeye yenilemeden dönüldüğünde mevcut1→0 |
| [Öğretmen sınavı filtresi ve kayıp yanıt sonrası kayıt](./results-atomic-and-selector-fix.json) | **2/2**: öğretmen sınavı görünür; tekrar yayında tek kimlik/tek sınav/tek soru |
| Graphify güncelleme/tanı | 1906 düğüm,5393 kenar,94 topluluk; eksik/sarkan uç0, yinelenen kenar0 |

API testleri gerçek geçici Prisma/SQLite kullanır. Veri yazımı sırasında trigger ile hata üretildi: mevcut ayar/soru değişiklikleri geri alındı, başarısız yeni kayıt oluşmadı. Katılım sonrası soru değişikliği409 ve metadata rollback; doğru cevap/seçenek doğrulama; öğretmen sahiplik/sınıf yetkisi; bildirim teslim hatası sonrası başarılı kayıt; tekrar denemede soru kimliklerinin korunması ve aktif öğrenci audienceSize sayımı sınandı.

İlk çalışan regresyonlar uygulama hatalarını gösterdi; düzeltme sonrasında beklenen davranış geçti. Bazı Vitest başlangıçları worker zaman aşımı nedeniyle test çalıştırmadı; tekrar koşuları tamamlandı. İlk sonuç Chromium koşusu yavaş yerel Vite/tarayıcı açılışında toplam süreyi tüketti; trace ilk kontrollerin geçtiğini gösterdi, hedefli tekrar tamamlandı. Bu ortam başarısızlıkları ürün assertion başarısı sayılmadı. Sunucu toplu koşusunda bir fork kapanma uyarısı ve mevcut mock hoisting uyarıları görüldü; çıkış0 ve153 test geçti. Enjekte edilen bildirim/veritabanı hatalarının beklenen logları vardır.

İstemci build'i mevcut karma statik/dinamik API import ve yaklaşık1,43MB JS chunk uyarılarını üretir. Graphify kod AST'sini yeniledi; SQL ayrıştırıcısı eksik14 dosya ve Markdown/LLM semantik çıkarımı bu koşuda kapsanmadı. Harita çalışma zamanı testinin yerine geçmez.

Gerçek `server/data/quiz.db` başlangıç SHA-256, boyut ve mtime değerleriyle aynı kaldı. Kullanıcının mevcut `DeploymentConfig.mode` ve `server-setup.tsx` düzenlemeleri korunur; API dosyasında yalnız transport helper export'ları bu pakete aittir. Hibrit kurulum kodu değiştirilmedi; taze terminal/bat/sh/web kurulumu bu pakette E2E sınanmadı.

**İkinci paket sonundaki tarihsel açık işler:** PE05 eski ikinci öğretmen bağının kaldırılma politikası o tarihte ürün yanıtını bekliyordu; INV04 arşiv transaction'ı henüz düzeltilmemişti. Q08'in eski POST/PATCH uçları ve raporlardaki diğer orta/düşük bulgular o paket kapsamı dışında kalmıştı. PE05 politikası artık [onarım sözleşmesinde](./repair-contracts.md) belirlenmiştir; INV04 ve eski uçların doğrulama korumaları kalan onarımların kapsamına alınmıştır. Bütün admin sayfa/sekme kontrollerinin güncel toplu başarısı bu tarihsel dosyadan çıkarılamaz.
