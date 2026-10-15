# Açık kapasite sorunlarının incelemesi

> **Tarihsel inceleme:** Aşağıdaki başarısız ölçümler düzeltme öncesindedir. 15 Ekim uygulama/sürücü düzeltmeleri ve 80 öğrencilik son kabul için [güncel rapora](2026-10-14-capacity-school-exam-results.md) bakın; 4.334 ölçülen istek sıfır hatayla tamamlandı. Gerçek okul Wi-Fi kapasitesi ölçülmedi.

14 Ekim 2026, `0a3bc1f` kaynak durumu. Önceki [performans kabulünün](production-performance-results.md) açık bıraktığı geç yazma, büyük sonuç listesi ve dashboard maliyeti incelendi. **20 aktör kapasitesi hâlâ başarısızdır; sayfalama deneyi tek başına sorunu kapatmadı.** Yalnız yeni sentetik kurulumlarda çalışıldı. Ürün rotaları, kullanıcı değişiklikleri ve canlı veri korunmuştur.

## Ortam ve yöntem

Windows x64 `10.0.26200`, Node `22.23.2`, Prisma `5.22.0`, sqlite3 `5.1.7`, 4 mantıksal CPU ve 8.506.515.456 byte toplam RAM. Bellek değeri işletim sisteminin anlık toplamıdır; deneylerin kaynak kullanım zaman serisi değildir. Önceki native Linux/WSL ölçümüyle aynı işletim ortamı kabul edilmez.

Yeni `quizmaster-test-academic-performance-*` dizinine gerçek 22 migration uygulandı. Önceki seed sözleşmesiyle 1.311 kullanıcı, 40 sınıf, 6 ders, 240 öğretmen ataması, 1.000 veli ilişkisi, 121 sınav/anket, 842 soru, 8.000 sonuç, 1.000 anket katılımı ve 5.000 cevap dahil **17.661 iş kaydı** oluşturuldu. Canlı DB kopyalanmadı veya SQL ile açılmadı. Mevcut kurulu bağımlılıklar kullanıldı; fresh install kabulü yapılmadı.

Araç: [production-capacity-investigation.mjs](../scripts/production-capacity-investigation.mjs). Üretim modundaki gerçek API girişinin bağımsız esbuild paketine ölçüm kodu eklenir. Ürün dosyaları düzenlenmez. SMTP ve dış ağ engellenir; Prisma yüklenmeden önce dış `.env` okuma engeli kurulur. Sunucu rastgele loopback portunda kernel süreç sahipliğiyle başlatılır. Frontend yalnız API deneyine gerekli sentetik HTML dosyasıdır; tarayıcı/UI veya arşiv kabulü bu çalışmada tekrarlanmadı.

Her ölçülen istek ayrı kimlikle istemci başlangıcı/bitişi, sunucunun `res.json` çağrısı, bağlantı kapanışı ve Prisma middleware operasyonlarıyla eşleştirildi. **ORM çağrı sayısı SQL statement sayısı değildir.** ORM süreleri bekleme ve sonuç üretimini içerir; SQLite kilit beklemesi, havuz beklemesi ve engine CPU zamanı ayrıca ayrıştırılmadı. `serverMs`, `res.json` çağrısından hemen önceki süredir; JSON serileştirme ve yanıt aktarımının tamamlanması değildir. İstemci süresi bütün JSON'un okunması ve parse edilmesini içerir. Senkron tanı dosyası yazımının maliyeti ölçüme dahildir.

İstekler 30 saniyelik istemci deadline'ı kullanır. Hazırlık/giriş ölçüm dışında, her aktörün çağrıları istemci tarafında seridir. Timeout sonrası sunucu işi devam edebilir. Bir fazın bütün istekleri sunucuda tamamlanmadan DB doğrulaması veya sonraki fazın sıfırlaması yapılmadı. Matris fazları ve A/B tekrarları aynı fixture üzerinde sırayla çalıştı; sıra rastgeleleştirilmedi, bağımsız çoklu yük tekrarları yapılmadı. Sonuçlar hedef sunucu SLA'sı veya azami kullanıcı sayısı değildir.

## Gerçek HTTP ve son DB onayı

Karma iş yükü önceki aktör/rol/endpoint dizisini kullanır: aktör başına 30 istek; yarısı gerçek CSRF/session ile `PATCH /api/notifications/preferences`, yarısı dört rolün okumalarıdır. Yalnız-yazma koşusunda 600 isteğin tamamı tercih yazımıdır; karma koşunun 300 yazımıyla aynı iş karışımı değildir.

| İş yükü | Aktör/istek | p50 ms | p95 ms | p99 ms | En yüksek ms | İstek/s | Timeout | Son DB/onay uyuşmazlığı |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Mevcut karma | 2/60 | 399,60 | 2.549,38 | 4.379,40 | 4.379,40 | 2,43 | 0 | 0 |
| Mevcut karma | 8/240 | 1.591,71 | 5.647,20 | 8.500,54 | 9.741,98 | 3,50 | 0 | 0 |
| Mevcut karma | 20/600 | 5.191,39 | 26.666,48 | 30.006,39 | 30.395,29 | 2,38 | 14 | 0 |
| Karma, deneysel 100 sonuç | 20/600 | 5.297,45 | 21.584,64 | 30.007,08 | 30.016,46 | 2,48 | 12 | 0 |
| Yalnız tercih yazımı | 20/600 | 9.174,50 | 30.008,19 | 30.014,07 | 30.038,77 | 1,47 | 54 | 3 |

Toplam 2.100 workload isteği ölçüldü. Mevcut 20 aktörde 586 HTTP200 ve 14 timeout, sınırlı sonuç deneyinde 588 HTTP200 ve 12 timeout, yalnız-yazmada 546 HTTP200 ve 54 timeout vardı. Timeout'lar başarıya çevrilmedi. Mevcut karma koşudaki timeout'ların 12'si tercih, 2'si dashboard isteğidir. Başarılı HTTP cevaplarına rağmen ORM izlerinde 8 aktörde 1, mevcut 20 aktörde 70, sınırlı listede 48 ve yalnız-yazmada 147 `P1008` görüldü; bunlar tekrar denemeleri dahil operasyon sayılarıdır.

Önceki rapordaki son DB/onay uyuşmazlığı mevcut karma koşuda tekrarlanmadı. **Yalnız-yazmada üç aktörün son başarılı onayı `true`, bütün sunucu istekleri tamamlandıktan sonraki DB değeri `false` idi.** Böylece son-değer uyuşmazlığı, büyük sonuç yanıtı bulunmayan ayrı bir iş yükünde yeniden üretildi. Aktörlerin son değerleri hiçbir fazda sessizce başarı sayılmadı.

## Geç tamamlanan yazmanın kanıtı

Mevcut karma koşuda bir tercih isteği istemcide 30.006 ms'de timeout aldı. Sunucu bağlantı kapanışını yaklaşık 29.851 ms'de gördü. Auth okuması 1.207 ms, ilk `User.update` 11.161 ms ve `P1008`, sonraki `User.update` 18.171 ms ve başarılı sonuç üretti. Sunucu `res.json` aşamasına 30.631 ms'de ulaştı. Başka tercih istekleri yaklaşık 43–49,6 saniyede sonlandı; bütün tekrarlarını tüketen geç hata da görüldü.

Kaynak izi [notification.ts](../server/api-routes/notification.ts) → [storage.ts](../server/storage.ts), `updateNotificationPreferences` metodudur. Tek boolean ataması için dört deneme sınırı vardır; 50/100/150 ms beklemeler toplam 300 ms ekler. **300 ms toplam işlem deadline'ı değildir:** her Prisma çağrısının beklemesi buna eklenir. HTTP bağlantısının kapanması bu metodu veya başlayan Prisma UPDATE'ini iptal etmez. Aynı değeri yeniden atamanın idempotent olması, timeout sonrası gönderilen farklı değerin sıra korunumu için yeterli değildir.

Bu izler geç tamamlanma ve son-değer belirsizliğini kanıtlar. Native engine içindeki kilit/havuz zamanını tek baskın sebebe indirgemek veya eski rapordaki belirli aktörün aynı olay sırasını yeniden üretmiş saymak için yeterli değildir.

Bağımsız yeni fixture'daki kontrollü deneyde ikinci SQLite bağlantısı `BEGIN IMMEDIATE` kilidi tuttu. İstemci 250 ms deadline ile tek `muted:true` isteği gönderdi; 254,54 ms'de timeout aldı. Kilit, timeout sonrası en az 750 ms daha tutulup bırakıldı. UPDATE middleware süresi 1.265 ms, sunucunun `res.json` aşaması 1.277 ms oldu. UPDATE'in istemci kesilmesinden önce başlayıp sonrasında tamamlandığı, bağlantının yanıt öncesi kapandığı ve başlangıçta `false` olan DB değerinin `true` olduğu ayrı ayrı assert edildi. Bu **250 ms kontrollü iptal semantiği** deneyidir; 30 saniyelik yük timeout'unun yerine geçirilmez. Gerçek 30 saniyelik örnek yukarıdaki karma yük koşusudur.

## Sonuç listesi maliyeti ve sayfalama sınırı

[result.ts](../server/api-routes/result.ts) bütün filtrelenmiş sonuçları döndürür. `getFilteredResults` ilişkileri dahil tüm sonuçları getirir ve cevap JSON'unu parse eder. Üç tekrarın medyanı:

| Ölçü | Mevcut 8.000 sonuç | Deneysel 100 sonuç |
|---|---:|---:|
| Decode edilmiş JSON UTF-8 byte | 12.567.453 | 157.213 |
| İstemci toplam süre, ms | 2.912,65 | 259,78 |
| `res.json` öncesi süre, ms | 1.281 | 72 |
| ORM çağrısı, auth dahil | 2 | 2 |

Boyutlar sıkıştırılmış ağ transferi değildir. Deney yalnız sonuç `findMany` çağrısına `take:100` ve deterministik `submittedAt,id` sırası ekledi. 100 dönen ID'nin tam sonuç kümesinde olduğu doğrulandı; tamamlanmış pagination API/UI sözleşmesi uygulanmadı. Genel yükte 12 timeout'un kalması, büyük yanıtı küçültmenin tek başına yeterli olmadığını gösterir. Tek ardışık koşudan 14→12 farkının tekrarlanabilir kapasite kazanımı olduğu çıkarılmaz.

[results.tsx](../client/src/pages/results.tsx) tüm sonuçları bir kez yükleyip filtre, notlandırılmış kayıt sayısı, ortalama, grafik, yazdırma ve Excel çıktısını bu diziden üretir. Ürüne yalnız `take:100` eklemek toplamları ve dışa aktarımı eksiltir. Kalıcı sayfalama; sunucuda yetkili filtreleme, deterministik sayfa sırası/toplam, tüm filtrelenmiş kümenin özetleri ve tüm filtrelenmiş export sözleşmesiyle birlikte uygulanmalıdır. Öğretmen kapsamı, aktif/geçmiş yıl ve sıfır puan davranışı korunmalıdır. Kullanıcının korunan `api.ts` dosyası bu incelemede düzenlenmedi.

## Dashboard seri sorgu maliyeti

[dashboard.ts](../server/api-routes/dashboard.ts) öğretmen için sınıfları ve içerikleri getirir, her sınıfta öğrenci listesi, her içerikte sonuç listesi yükler. ORM operasyon sayısı auth dahil `3 + sınıf sayısı + içerik sayısı` olarak büyür. Tam kayıtları yüklemek, yalnız count/average yanıtı için gereksiz veri üretir.

İlk seed'deki 1 sınıf/4 içerikli öğretmende 8 çağrı, yalnız gerekli ID/count/aggregate verilerini isteyen deneyde 6 çağrı görüldü. Üç tekrarın tüm istatistik yanıtları birebir eşleşti.

Yük matrisi bittikten sonra **ayrı ölçek deneyi** için yalnız sentetik atamalar değiştirilerek bir öğretmene 40 sınıf ve 121 içerik bağlandı. Bu değişiklik önceki karma yük koşularına taşınmadı. Her iki yöntemde yanıt tam olarak 121 içerik, 8.000 sonuç, 1.000 aktif öğrenci ve 75 ortalama puandı.

| 40 sınıf/121 içerik, üç tekrar medyanı | Mevcut | Deneysel toplulaştırma |
|---|---:|---:|
| ORM çağrısı, auth dahil | 164 | 6 |
| İstemci toplam süre, ms | 1.107,24 | 355,44 |
| `res.json` öncesi süre, ms | 940 | 56 |

Deneysel toplulaştırma yetkili sınıf ID'lerini seçer, aktif öğrencileri ve aktif içerikleri sayar; sonuç count ve tamamlanmış/puanı bulunan kayıtların average değerini DB'de hesaplar. Yalnız sentetik öğretmen vakaları doğrulandı. Admin/historical context, boş veri, pasif öğrenci, archived içerik, null/zero puan ve gerçek UI regresyonları ürün değişikliği öncesinde ayrıca gereklidir.

## Devam için somut sıra

1. Tercih yazımında timeout sonrası sonucun belirsiz olduğu açıkça ele alınmalı. Yeniden deneme sayısını veya istemci timeout'unu artırmak sıra/son-onay sorununu çözmez. Per-user revision/koşullu atama veya eşdeğer sıralama ve sonuç uzlaştırma tasarımı, önce gerçek geç tamamlama ve eski isteğin yeni tercihi ezmesi regresyonlarıyla sınanmalı. Başlamış bir DB işleminin iptal edilmiş sayılması güvenli değildir.
2. Öğretmen dashboard'u, doğrulanan count/aggregate yaklaşımı ve aynı rol/yıl/puan sözleşmesiyle ayrı dar değişiklik olarak ele alınabilir.
3. Sonuç sayfalaması, tüm filtrelenmiş toplam/istatistik/export kapsamıyla birlikte tasarlanmalı. Listeyi tek taraflı kısaltma uygulanmamalı.
4. Hedef sunucuda aynı karma workload ve bağımsız yazıcıyla, istek/SQL sürelerini ayıran ek ölçüm yapılmalı. Havuz/journal/lock ayarları ve varsa yazma kabul sınırı ancak ayrı kontrollü deneylerle değerlendirilmelidir. Bu incelemede canlı SQLite ayarı veya sağlayıcısı değiştirilmedi.

## Kanıt kapsamı ve kapanış

Özel ham kanıtlar Git dışındaki owned fixture dizinlerinde `investigation.json`, `load-*.json`, `timeline.jsonl` ve backend/migration logları olarak tutulur. Rapor kayıt, çerez, parola veya env içeriği yayımlamaz. İlk sandbox readiness (`EACCES`) ve Windows preload file-URL denemeleri ölçüm kabulü değildir; süreç temizliği ve korunan hash'ler doğrulandı.

Yük matrisinin 2.100 isteği ve 18 A/B dashboard/liste isteği tamamlandı. Ardından controlled-lock yardımcısının doğrudan `sqlite3` çözümlemesi başarısız olduğu için o tam araç koşusu exit 1 verdi; bu koşu tümü geçti diye sunulmaz. Yardımcı mevcut `connect-sqlite3` bağımlılığı üzerinden düzeltilmiştir. Yeni fixture ile `--late-only` kontrolü exit 0, `completed:true`, `protectedUnchanged:true`, `clean:true` verdi; integrity/FK kontrolleri geçti. Son yardımcı düzeltmesinden sonra 2.100 isteklik ağır matris tekrarlanmadı.

Tekrar komutları: `node scripts/production-capacity-investigation.mjs` bütün deneyleri yeni fixture'da çalıştırır; `node scripts/production-capacity-investigation.mjs --late-only` yalnız kontrollü bağlantı kesilmesini yeni fixture'da sınar. Araç canlı hedef yolu kabul etmez. Exit 0, tanı/koruma/temizlik tamamlandığını belirtir; başarısız kapasite örnekleri raporda başarısız kalır. Son yardımcı düzeltmesinden sonra bütün ağır matris tekrarlanmış sayılmaz.

Kapanış doğrulaması: iki ölçüm fixture'ı için ayrı guard'lı verifier 22 tamamlanmış migration, `integrity_check=ok`, sıfır FK ihlali, sayısal sonuçlar, üç protected SHA ve portların bind edilebilirliği kontrolünü geçti. Her iki sunucunun kernel-owned süreç temizliği kanıtı `clean:true` idi. Kullanıcının iki dosyası ve canlı `quiz.db` SHA-256 değerleri başlangıçla aynıdır; staged değişiklik yoktur.

`production-performance-guard.test.mjs` junction/traversal/mevcut hedef negatifleri 1/1 ve `vitest.performance-unit.config.ts` Prisma mock'lu tercih retry regresyonları 6/6 geçti. Junction ve pnpm realpath ilk denemeleri sandbox `EPERM` ile reddedildi; normal izinlerle son tekrarları exit 0 verdi. Tanı aracının son sürümü `node --check` ile doğrulandı. Genel backend/frontend suite ve üretim UI/build kabulü bu incelemede yeniden çalıştırılmadı. Ürün kaynakları ve bağımlılık manifestleri değiştirilmedi; yeni tanı aracı ve rapor, önceki sonuç raporuna bir bağlantıyla bırakılmıştır.
