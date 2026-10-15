# Hatalı yükseltmeden geri dönüş provası

> **Tarihsel plan/tasarım kaydı.** 14 Ekim 2026 belge kontrolü: gelecek zaman, açık kutular ve ara sonuçlar özgün çalışma sırasını korur; güncel yapılacaklar olarak okunmamalıdır. [Sonuç ve kapsam kaydı](../../production-rollback-rehearsal-results.md) esas alınır.

Üst plan: [Üretime hazırlık](2026-10-06-production-rehearsal-plan.md), Görev 3. Kullanıcı uygulamayı ve bulunan hataların düzeltilmesini onayladı. Görev 2 kabulü kapatıldıktan sonra aşağıdaki sıra uygulanır. Otomatik rollback özelliği eklenmez; mevcut çevrimdışı bakım ve manuel sürüm geri dönüşü sınanır.

14 Ekim 2026 kabulü tamamlandı: Windows dört gerçek hata aşaması ve native Linux kısmi migration kurtarması geçti. Özgün oturum/veri/şema, arşiv/görsel ve süreç/port kanıtları [sonuç raporunda](../../production-rollback-rehearsal-results.md). Diğer üç Linux hata aşaması tekrarlanmadı; tüm platformlarda 4/4 iddiası yoktur.

## Sınırlar

- Yalnız sentetik verili, ayrı kök/port/süreç sahipliği bulunan kurulumlar kullanılır. Canlı DB ve kullanıcı değişiklikleri korunur.
- Kaynak sürüm ve veri yedeği birlikte geri döner. Yeni şemayı eski kodla açmak başarılı geri dönüş sayılmaz.
- Orijinal 17-migration kaynak `1298cf8266348cf2bfd338ad431b4136c5f2ae2e` ve doğrulanmış yükseltme öncesi yedek referans alınır. Yeni sürümün migration sayısı 22'dir.
- Kurtarma mevcut veri alanını ezmez. Doğru eski kaynak ve bağımlılıklar bağımsız boş hedefe hazırlanır; doğrulanmış yedek oraya yüklenir. Başarısız kurulum tanı için korunur.
- Eksik/bozuk yedek kabul edilmez. Portların kapanması ve yalnız sahip olunan süreçlerin temizliği ayrıca kanıtlanır.

## 1. Hata matrisi

Her senaryo bağımsız kopyada uygulanır; gerçek komutun çıkış kodu, başarısız adım, önceden oluşturulan yedeğin manifest/hash ve DB bütünlüğü kaydedilir.

1. Bağımlılık: paket manifesti ve frozen lockfile bilinçli uyuşmazlığıyla gerçek install reddi.
2. Derleme: izole kaynakta kontrollü geçersiz sözdizimiyle gerçek build reddi.
3. Migration: 22 başarılı migration sonrasında eklenen geçersiz SQL ile deploy reddi; kısmen yükselmiş veri de eski yedekle kurtarılır.
4. Açılış: başarılı yükseltme sonrasında izole sunucu çıktı dosyasının kontrollü bozulmasıyla gerçek start reddi. Upgrade başarısı uygulamanın yeniden açıldığı iddiası olarak sunulmaz.

## 2. Kurtarma ve doğrulama

Her başarısız kurulum için eski sürüm kaynağı/frozen bağımlılıklar/gerçek derleme bağımsız hedefte hazırlanır. Başarısız adım öncesindeki yedek mevcut bakım restore komutuyla geri yüklenir. Şunlar karşılaştırılır:

- Tam kullanıcı/parola hash/sessionVersion, öğretmen atamaları, veli ilişkileri, quizler, sonuçlar, anket cevapları.
- 17 tamamlanmış migration, bekleyen migration olmaması, integrity/FK kontrolleri.
- Ayarlar, soru görselleri ve varsa akademik paketlerin SHA-256'ları.
- Gerçek sunucu açılışı, tarayıcı girişi, arşiv ekranı ve görsel erişimi. Önceden alınmış eski oturum varsa aynen kullanılır.
- Kod ve Prisma istemcisinin eski şemayla uyumu; istemci şeması yorum/biçim farkları hariç tüm sözcükler, alanlar ve tipler bakımından karşılaştırılır.

Bozulmuş yedek ayrı boş hedefte reddedilir; hiçbir veri/ayar yayımlanmadığı doğrulanır. Ardından doğru yedekle aynı boş hedefte kurtarma tekrarlanır.

## 3. Kapanış

Windows ve native Linux sonuçları ayrı raporlanır. Önbellek/kopyalanmış bağımlılıklar kullanıldığında bunun fresh install olmadığı belirtilir. Çalışmamış veya ortam nedeniyle kesilmiş testler geçmedi olarak tutulur. Güvenli rollback işlemi ve sınırları bakım belgesine eklenir; anlamlı regresyonlar, korunan dosya hash'leri ve süreç/port kontrollerinden sonra ayrı görev commit'i atılır. Son Graphify/belge/push kapanışı üst planın son görevidir.
