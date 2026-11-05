# SQLite sınırı mı, yapılandırma ve uygulama sorunu mu?

> **Tarihsel teşhis:** Aşağıdaki Prisma 5.22.0 ve journal/havuz ölçümleri eski kaynak durumuna aittir. Güncel sürüm Prisma 6.19.3, SQLite 3.51.3, WAL/FULL, işlem yalıtımı ve ayrı okuma bağlantısı kullanır. [Uygulanan düzeltmeler ve 80 öğrencilik prova](2026-10-14-capacity-school-exam-results.md) güncel kabul ve sınırları açıklar.

14 Ekim 2026 devam incelemesi. **Önceki başarısızlık SQLite'ın 20 aktörlük kesin sınırı değildir.** Aynı uygulama sorguları ve sentetik veriyle, yalnız journal ve Prisma havuz yapılandırması değiştirildiğinde 20 aktörün hem 600 karma hem 600 yazma isteği hatasız ve son DB/onay değerleri eşleşerek tamamlandı. Bu, hedef sunucu kapasitesi veya genel üretim kabulü değildir.

Önceki [kapasite incelemesi](production-capacity-investigation-results.md) büyük sonuç yanıtını, dashboard seri sorgularını ve geç yazmayı göstermişti. Burada bunların SQLite ayarları ve ölçüm diskiyle ilişkisi ayrıldı. Ürün kaynakları, canlı ayarlar ve canlı DB değiştirilmedi. Canlı DB yalnız SHA-256 için okundu.

## İncelenen mevcut yapılandırma

- `server/storage.ts` ve `server/services/archive-db.ts` ayrı `PrismaClient` oluşturur; ana DB için merkezi WAL başlangıç ayarı veya açık havuz sınırı yoktur.
- `server/utils/session-store.ts` içindeki `concurrentDb:true` **sessions.db** içindir; ana uygulama DB'sini WAL yapmaz.
- `server/.env` içindeki yalnız DATABASE_URL parametreleri gizli bilgi göstermeden kontrol edildi: SQLite URL'sinde `connection_limit`, `socket_timeout`, `pool_timeout` tanımlı değildi. Çalışan servisin dışarıdan verilen ortamı bu dosyayı geçersiz kılabilir; canlı süreç ortamı veya canlı DB PRAGMA'ları okunmadı.
- Gerçek sentetik Prisma bağlantısında `journal_mode=delete`, `busy_timeout=5000`, `synchronous=2 (FULL)`, `locking_mode=normal`, `wal_autocheckpoint=1000` ölçüldü. Engine başlangıç kaydı **5 bağlantı** bildirdi. Bunlar tüm canlı bağlantıların PRAGMA teyidi değildir.

Kurulu Prisma `5.22.0` engine commit'i `605197351a3c8bdd595af2d2a9bc3025bca48ea2` kaynak kodunda varsayılan havuz CPU sayısına göre oluşturulur. Bu makinedeki 5 bağlantı ayrıca gerçek engine mesajıyla doğrulandı; yeni Prisma sürümlerinin varsayımları kullanılmadı. [Kurulu engine'in havuz kaynağı](https://github.com/prisma/prisma-engines/blob/605197351a3c8bdd595af2d2a9bc3025bca48ea2/quaint/src/pooled.rs).

## HTTP dışında journal/havuz karşılaştırması

[sqlite-configuration-investigation.mjs](../scripts/sqlite-configuration-investigation.mjs), süreçleri/portu kapanmış sentetik şablonun yeni ve bağımsız kopyasını kullandı. Canlı veriden şablon alınmadı. Şablon SHA'sı değişmedi. Kopya gerçek 22-migration şemasını, trigger'ları ve 17.661 iş kaydını içerir; fresh migration kabulü olarak sunulmaz.

Her koşuda aynı 20 öğretmen, kişi başına 10 seri auth biçimli `User.findUnique` + atomik tercih UPDATE'i yaptı: **200 mantıksal işlem**. Üründeki dört deneme/50-100-150 ms retry davranışı aynen sınandı. HTTP/session/timer iptali yoktu; bu doğrudan ORM izolasyonudur. Her koşudan önce istemci kapatıldı, journal değiştirildi ve yeni istemci açıldı. Sıra DELETE/default → DELETE/1 → WAL/default → WAL/1 → DELETE/default tekrar idi.

| Journal / Prisma havuzu | Toplam s | İşlem/s | p95 ms | Başarısız işlem | P1008 operasyonu |
|---|---:|---:|---:|---:|---:|
| DELETE / 5, ilk | 55,21 | 3,62 | 12.682,34 | 2 | 13 |
| DELETE / 1 | 52,53 | 3,81 | 5.967,44 | 0 | 0 |
| WAL / 5 | 12,25 | 16,33 | 3.186,14 | 0 | 1 |
| WAL / 1 | 13,27 | 15,07 | 2.451,80 | 0 | 0 |
| DELETE / 5, son tekrar | 53,44 | 3,74 | 13.857,63 | 1 | 11 |

Beş koşuda da FULL senkronizasyon ve 5.000 ms busy timeout korundu. Dayanıklılığı düşüren NORMAL/OFF deneyleri yapılmadı. Son 20 tercih değeri her koşuda beklenen `false` idi. Toplam 1.000 mantıksal ORM işlemidir; retry ve SQL statement sayıları bununla aynı değildir.

**Journal belirgin fark yarattı; tek bağlantı tek başına throughput çözümü olmadı.** DELETE/1, kilit tekrarlarını kaldırdı fakat süreyi yaklaşık 53 saniyeden 52 saniyeye ancak düşürdü. WAL, aynı disk ve aynı FULL dayanıklılık ayarıyla süreyi yaklaşık dörtte bire indirdi. WAL/5 ile WAL/1 benzer throughput üretti; /1'in gecikme kuyruğu daha düzenli ve retry sayısı sıfırdı. Son DELETE/default tekrarı da eski yavaşlık/hataları gösterdi; fark yalnız ilk koşunun soğuk cache'i olarak açıklanamaz. Engine içindeki kilit/havuz bekleme süreleri birbirinden tam ayrıştırılmadı.

## Gerçek 20 aktör HTTP karşılaştırması

Yeni sentetik kurulumların her birinde gerçek 22 migration, aynı 1.311 kullanıcı/17.661 iş kaydı, gerçek login/CSRF/session ve aynı endpoint dizisi kullanıldı. Aktör başına 30 istek vardır. İlk kurulumda yalnız ana DB WAL; ikinci kurulumda WAL ve **her Prisma istemcisinde** `connection_limit=1` uygulandı. API'de iki ayrı istemci (storage/archive) vardır; bu, uygulamadaki bütün bağlantıların küresel olarak tek bağlantı olduğu anlamına gelmez. Engine mesajları iki istemcinin de beklenen 5 veya 1 havuz sınırını doğruladı.

**Sonuç API'si hâlâ bütün 8.000 sonucu döndürdü; dashboard hâlâ eski seri sorguları kullandı.** Deneysel pagination veya aggregate başlığı gönderilmedi. Havuz URL parametresi yalnız disposable backend bundle'ına eklendi, ürün dosyaları düzenlenmedi. Parent kontrol bağlantısının journal/synchronous gözlemi ve engine havuz kaydı kanıta alındı.

| Yapılandırma | Karma 600: timeout / DB uyuşmazlığı | Karma p95 ms | Yalnız yazma 600: timeout / DB uyuşmazlığı | Yazma p95 ms |
|---|---:|---:|---:|---:|
| DELETE / 5, önceki Windows incelemesi | 14 / 0 | 26.666,48 | 54 / 3 | 30.008,19 |
| WAL / 5 | 0 / 0 | 11.505,59 | 69 / 3 | 30.007,85 |
| WAL / 1 | **0 / 0** | **7.390,44** | **0 / 0** | **8.085,78** |

WAL/5 karma koşusu 600 HTTP200, 129,26 s ve 4,64 istek/s; yalnız-yazması 531 HTTP200 +69 timeout, 407,25 s ve 1,47 istek/s verdi. WAL/1 karma koşusu 600 HTTP200, 122,94 s ve 4,88 istek/s; yalnız-yazması 600 HTTP200, 114,65 s ve 5,23 istek/s verdi. Son WAL/1 maksimumları karma 14,66 s, yazma 12,24 s idi. Timeout sonrası sunucuda kalan bütün ölçülen istekler tamamlanmadan DB onayı kontrolü veya reset yapılmadı.

WAL tek başına yoğun yazmayı çözmedi. Beş bağlantıda aynı dosyaya eşzamanlı UPDATE'ler bu iş yükünde hâlâ bekleme/retry ve geç onay sorunları üretiyor. WAL ile sınırlı havuzun birlikte aynı iki HTTP iş yükünü geçmesi, yapılandırmanın güçlü bir etken olduğunu doğrular. Bu sonuç her uygulamada tek bağlantının ideal olduğunu kanıtlamaz; uzun okuma veya arşiv işleri dar havuzda başka kuyruklar oluşturabilir. Bu ayarla arşiv/restore/upgrade/UI kabulü tekrarlanmadı.

## Ölçüm diski ve bekleme maliyeti

Salt okunur Windows disk eşlemesi F: sürücüsünü Disk #1 üzerindeki `ST500LT012-1DG142` SATA **HDD**, NTFS olarak doğruladı. Bu makinenin ölçümünü SSD kullanan bir hedef sunucuya genellemek doğru değildir.

HTTP süreçleri kapandıktan sonraki seri 20 adet 4 KiB write+fsync probe'unda F: medyan 36,46 ms / p95 52,31 ms; sistemin geçici klasöründe medyan 1,38 ms / p95 2,22 ms ölçüldü. Dosyalar yeni, münhasır oluşturulan sentetik dosyalardı ve kaldırıldı. Bu küçük anlık I/O örneği, SSD üzerinde aynı tam HTTP yükünün ölçümü değildir; disk konumunun kalıcı yazma maliyetini etkilediğini gösterir. Önceki hazırlık sırasında alınan ilk noktasal flush örneği son seri karşılaştırmanın yerine kullanılmadı.

İlk DELETE/default doğrudan ORM koşusunda Node + aynı süreçteki native Prisma CPU toplamı yaklaşık 1,70 s, wall süresi 55,21 s idi. Bu koşudaki yavaşlık CPU hesaplamasıyla açıklanamaz; I/O/lock/havuz beklemelerinin payı vardır. Genel HTTP'nin CPU/RSS sınırı ayrıca yeniden ölçülmedi.

## Uygulamada kalan eksikler

1. **SQLite'a uygun açık başlangıç/bağlantı politikası yok.** Session WAL ayarı ana DB için yeterli değil. Bu HDD/yazma profili için mevcut varsayılanların iyi çalışmadığı gösterildi. Journal ve havuz davranışı sürüm/dağıtım sözleşmesine alınmalı; rastgele bağlantılarda PRAGMA değiştirilmemeli.
2. **Timeout sonucu ve yazma sırası sözleşmesi eksik.** Mevcut metot dört denemeyi sınırlar, toplam süreyi veya iptal sonrası geç atamayı sınırlandırmaz. Bir değeri idempotent tekrar etmek, daha yeni başka değerin eski istek tarafından ezilmesini önlemez. WAL/1'in bu yükte başarılı olması kontrollü 250 ms disconnect testindeki davranışı düzeltilmiş saymaz. Bu sorun SQLite dosya bütünlüğü hatası değildir; önceki tüm integrity/FK kontrolleri geçti.
3. **Okumalar hâlâ gereğinden pahalı.** 12,6 MB tam sonuç yanıtı, istemcide bütün veriden filtre/istatistik/export hesaplama ve sınıf/içerik sayısıyla büyüyen dashboard ORM döngüleri kalıcı uygulama iyileştirme konularıdır. Önceki inceleme bunları ayrı ölçmüştür.
4. **Donanım ve hedef dağıtım farkı var.** HDD üzerinde yoğun kalıcı yazma gecikmesi ölçüldü; 20 eşzamanlı aktör toplam kullanıcı sayısı sınırı değildir. Hedef sunucu, storage ve gerçek sınav gönderim modeli üzerinde kabul gerekir.

SQLite WAL'da okuyucular ve yazıcılar birlikte ilerleyebilir, ancak aynı anda tek yazıcı sınırı devam eder. Bu nedenle sürdürülebilir yoğun yazma veya birden çok sunucu gereksiniminde PostgreSQL değerlendirmesi hâlâ geçerlidir; bu deneyler tek başına geçişin zorunlu olduğunu göstermiyor. [SQLite WAL resmî açıklaması](https://www.sqlite.org/wal.html).

## WAL için ayrıca gereken sürüm doğrulaması

Sentetik DB'de gerçek `SELECT sqlite_version()` Prisma engine için **3.45.0** verdi; yüklenen node-sqlite3 native modülünün VERSION değeri **3.44.2** idi. SQLite'ın resmî belgesi, çok bağlantılı WAL/checkpoint yarışında nadir dosya bozulmasına yol açabilen WAL-reset hatasının 2026'da düzeltildiğini bildiriyor; düzeltilmiş sürümler 3.51.3+, ayrıca backport 3.44.6/3.50.7'dir. Ölçülen iki sürüm bu düzeltme sürümlerinden değildir. [Resmî WAL-reset açıklaması](https://www.sqlite.org/wal.html#walreset).

Bu hata burada yeniden üretilmedi ve gözlenen timeout'ların nedeni olarak sunulmaz; ilk başarısız koşu DELETE modundaydı. Ancak **mevcut eski engine/sürücüyle yalnız bir ayar değiştirip kalıcı canlı WAL kabulü yapılmamalı**. Gerçekte kullanılan bütün SQLite kütüphaneleri için düzeltme içeren bağımlılık, Prisma veri/timestamp uyumu, session ve bakım/backup/restore doğruluğu kontrol edilmelidir. Bu incelemede sürücü, Prisma veya canlı journal modu değiştirilmedi.

## Kanıt, sınırlar ve tekrar

Bu turda 1.000 doğrudan ORM işlemi ve 2.400 gerçek HTTP workload isteği ölçüldü. Önceki DELETE HTTP satırı ayrı önceki çalışmanın sonucudur; yeni rastgeleleştirilmiş çoklu tam matris değildir. WAL/1'in tam HTTP kabulü tek koşudur. Synchronous FULL korunmuştur. Yeni kalıcı konfigürasyon veya tüm üretim kapasitesi onaylanmış sayılmaz.

Üç sentetik DB'nin integrity/FK kontrolleri, WAL/1 iki HTTP fazının 0 hata/0 son-değer uyuşmazlığı, engine havuz kayıtları, protected üç SHA ve HTTP süreç/port kapanışları bağımsız verifier ile doğrulandı. Son iki HTTP runner exit 0 / `completed:true` / `clean:true` / `protectedUnchanged:true` verdi; ORM probe exit 0 ve kaynak sentetik şablon hash'i aynıydı. Araçların syntax kontrolleri geçti. Yeni test DB'leri ve ham loglar Git dışındadır; başkalarının eklenen/değiştirilen/silinen belgelerine dokunulmadı, hiçbir dosya stage edilmedi.

Tekrar araçları:

```text
node scripts/sqlite-configuration-investigation.mjs <durmuş-sentetik-runtime.json>
node scripts/production-capacity-investigation.mjs --configuration-http --journal-wal
node scripts/production-capacity-investigation.mjs --configuration-http --journal-wal --pool-one
```

ORM probe yalnız canonical owned fixture/kanıt/kapalı port/yan journal yokluğu kontrolünü geçen sentetik şablonu yeni köke kopyalar; canlı URL veya mevcut hedefi kabul etmez. HTTP runner da her seferinde yeni sentetik DB oluşturur. SQLite sürüm bulgusu nedeniyle bu komutlar mevcut engine'in performans tanısıdır, canlı sistem için kullanım talimatı değildir.
