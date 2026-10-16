# AI yönetimi sekmeleri ve öğretmen kullanım takibi

**Durum:** Kullanıcı onayıyla uygulandı. Geliştirme ve hedef testler 15 Ekim 2026, yedekli yerel devreye alma 16 Ekim 2026 tamamlandı. [Doğrulama ve koruma kaydı](../../2026-10-15-ai-usage-results.md). Aşağıdaki metin onaylanan kapsamı korur.

**Amaç:** Mevcut AI/sınav akışını koruyarak yönetimi iki sekmeye ayırmak,
öğretmen kullanımını gerçek sağlayıcı token bilgisiyle göstermek, varsayılan
profil seçimini anlaşılır yapmak ve token sınırını soru senaryolarıyla açıklamak.

## Mevcut durum ve kararlar

- Dal: `codex/academic-archive-hardening-20261012`; son commit `2f98a77`.
  Çalışma ağacındaki mevcut AI geliştirmeleri ve kullanıcı değişiklikleri korunur.
- `ai-management.tsx` tek sayfa; mevcut Radix `Tabs` bileşeni kullanılabilir.
- Varsayılan listesi `profiles.filter(p => p.enabled)` kullanıyor. Kapalı
  profiller görünmüyor; sunucu da kapalı profili varsayılan yapmayı reddediyor.
  Bu birden çok profil sayısından kaynaklanan bir koşul değil, erişim filtresidir.
- Runtime yalnız son metni döndürüyor; sağlayıcı usage alanı kayboluyor.
  Geçmiş tüketim mevcut veriden güvenilir biçimde yeniden hesaplanamaz.
- Öğretmen AI isteği ders/sınav bağlamını ayrı alanlarla göndermiyor. Yeni
  sınavın UUID'si yalnız kaydederken oluşturuluyor; AI çağrısı çoğunlukla daha önce.
- Tek üretim istemci ve sunucuda 1–10 soru ile sınırlı. Bu planda 20 soruluk
  sınav iki 10 soruluk üretimdir; tek istekte 20 soru sınırı açılmaz.

Alternatifler: İstemciden tahmini tüketim kaydetmek kolay fakat gerçek kullanım
değildir. Tüm AI altyapısını yeniden kurmak gereksiz kapsamdır. Öneri: mevcut
runtime'a kullanım metadatası eklemek ve mevcut SQLite yazıcısıyla küçük,
ayrı bir kullanım defteri tutmak. Öğretmenin model seçme yetkisi değişmez.

## 1. Yönetim görünümü

Sekme adları kullanıcının istediği biçimde:

1. **ai profil yönetimi** — mevcut profil CRUD, testler, model seçimi, varsayılan
   model ve Gemini aktarımı burada kalır; başlangıçta bu sekme açıktır.
2. **öğretmen ai kullanımı** — yalnız admin tarafından görülen kullanım tablosu.

Sekme geçişi kaydedilmemiş profil formunu sıfırlamaz. Tablo verisi ikinci sekme
açıldığında yüklenir; filtreli sunucu sayfalaması kullanılır. Mobilde tablo yatay
kaydırılabilir; klavye ve ekran okuyucu sekme ilişkileri mevcut bileşeni izler.

Sayfa yalnız ilgili sorumluluklarla bölünür: `AIProfilesTab`, `AIUsageTab`,
`AITokenBudgetHelp`; sınav/diğer admin sayfaları yeniden tasarlanmaz.

## 2. Varsayılan profil sorunu

- Tanımlı bütün profiller listede **profil adı · sağlayıcı · model · durum** ile
  görünür. Aynı sağlayıcının farklı model profilleri ayrı seçeneklerdir.
- Kapalı profiller görünür ama seçilemez; yanında “Öğretmenlere kapalı — önce
  bağlantı testini tamamlayıp kullanıma açın” açıklaması bulunur.
- Seçilebilir profiller öğretmene açık olanlardır. Hiçbiri açık değilse sessizce
  boş liste yerine nedeni ve profil kartındaki sonraki işlem belirtilir.
- Seçim açıkça yapılır; ilk profil kendiliğinden varsayılan olmaz. Kapalı model
  öğretmene otomatik açılmaz. Ayar/target revizyonu, test zorunluluğu ve
  kapatma/silme/düzenlemede mevcut varsayılan temizleme korumaları sürer.
- En az iki açık ve bir kapalı profil ile görünürlük, seçim, çakışma ve
  öğretmen başlangıç seçimi sınanır.

## 3. Öğretmen kullanım tablosu

**Her sağlayıcı üretim isteği bir satırdır.** Aynı sınava tekrar üretim yapılırsa
gerçekte tüketim oluştuğundan yeni satır eklenir. Soru ekleme/kaydetme yeni bir
sağlayıcı çağrısı veya ikinci bir kullanım kaydı oluşturmaz.

Sütunlar: tarih/saat; öğretmen adı ve hesap bilgisi; ders; sınav/anket adı;
taslak/kayıtlı durumu; profil; sağlayıcı/model; istenen ve doğrulanan soru sayısı;
girdi tokenı; çıktı tokenı; varsa düşünme tokenı (çıktının alt kalemi); süre;
sonuç (başarılı, geçersiz soru, sağlayıcı hatası, süre aşımı, iptal veya sonucu
bilinmiyor). Filtreler: tarih, öğretmen, ders, sınav adı, model ve sonuç.
Varsayılan sayfa 25, üst sınır 100 satırdır; sorgular indeksli ve sunucudadır.

Filtrelenen kapsamın istek sayısı ve **bilinen** girdi/çıktı toplamları gösterilir;
token bilgisi eksik istek sayısı ayrıca belirtilir. Eksik tüketim sıfır sayılmaz.
İlk kullanım tarihinden önceki kayıtlar üretilemez; boş görünüm bunu açıklar.
Admin bağlantı/örnek soru testleri öğretmen tüketimine karıştırılmaz.

### Gerçek token verisi

Runtime'ın metin döndüren mevcut fonksiyonu uyumluluk sarmalayıcısı olarak
korunur; yeni ayrıntılı sonuç `{text, usage, finishReason}` döndürür. Kullanım
bilgisi içerik/soru ayrıştırması başarısız olsa bile kaybolmaz. Ham hata gövdesi,
API anahtarı, istem, üretilen soru metni veya düşünme metni kullanım tablosunda
tutulmaz; yalnız gerekli bağlam ve sayısal tanı saklanır.

- OpenAI uyumlu/MiMo: `prompt_tokens`, `completion_tokens`; varsa
  `completion_tokens_details.reasoning_tokens` çıktının alt kalemidir, yeniden
  toplanmaz. Standart dışı sağlayıcının eksik alanı tahmin edilmez.
- Google: `usageMetadata` içindeki prompt, candidate, thoughts, total ve cache
  alanları belgelenmiş anlamlarıyla eşlenir; çıktı/düşünme çift sayılmaz.
- Anthropic: input/output ve cache read/write alanları ayrı okunur; toplam
  girdide cache kalemleri hesaba katılır. Sağlayıcıya özgü sayılar normalleştirilir.
- Düşünme/cache alt kalemi yoksa bilinmiyor gösterilir. Faturadaki parasal
  tutar hesaplanmaz; token sayısı fiyat veya kalan kota anlamına gelmez.
- Timeout/iptalde sağlayıcı tüketimi bildirmediyse **“Bilinmiyor”** gösterilir;
  isteğin ücretlenmediği varsayılmaz. Başarısız fakat usage dönen yanıtın gerçek
  tüketimi kaydedilir. Otomatik ücretli tekrar eklenmez.

### Taslak, ders ve sahiplik

Öğretmen kimliği oturumdan, ders adı yetkili `Category` kaydından alınır. İstek
başlığı ve seçili ders, üretim anının görüntüsü olarak tutulur. Ders seçilmemişse
“Ders seçilmedi”; içerik kaydedilmemişse sınav başlığı yanında “Taslak” görünür.
Kullanım takibi için sınavı önceden kaydetme zorunluluğu eklenmez.

Oluşturucuda sabit bir taslak kimliği tutulur; her üretim için ayrı istek kimliği
sunucuda üretilir. İçerik kaydedildiğinde ilgili taslak kullanımları gerçek quiz
ID'sine bağlanır. Bağlama, istemcinin serbest kullanım ID'sine göre yapılmaz;
oturum sahibi + taslak kimliği + sınav sahipliği sunucuda doğrulanır. Mevcut
başka öğretmenin ders/sınavına ilişkilendirme ve başka kullanım satırını taşıma
reddedilir. Sınav adı/profil sonradan değişse bile üretim anının adı/modeli korunur.
Anket üretimi mevcut ortak oluşturucudan geldiği için içerik türüyle ayrıştırılır.

### Kayıt güvenilirliği ve depolama

Eklemeli `AIUsage` migration'ı; zaman/kimlik, öğretmen, ders, quiz ve profil
kimlikleri ile gerekli ad/model görüntüleri; durum; soru adedi; nullable token
sayıları; kullanılan süre/token sınırı ve profil revizyonu. Zaman, öğretmen/zaman,
ders/zaman ve taslak/öğretmen indeksleri eklenir. Profil silinmesi geçmiş kullanım
satırlarını cascade ile silmez; kullanıcı/veri saklama işlemleri uygulamanın
mevcut politikasına uyarlanır.

Mevcut tek DB yazıcısı kullanılır; sağlayıcı beklerken açık transaction tutulmaz.
İstek önce kısa işlemle başlatılır, sonuçta aynı satır idempotent güncellenir.
Sonuç kaydı için sınırlı yerel yeniden deneme yapılabilir; **sağlayıcı çağrısı
tekrarlanmaz**. Kayıt arızası başarılı soruları kaybettirmez; eksik tamamlanan
kayıt/token bilgisi gizlenmez, operasyon uyarısı bırakılır. Süreç çöküşünden sonra
bekleyen eski kayıt “sonucu bilinmiyor” olarak değerlendirilir; tüketim uydurulmaz.
Tabloya yazma başarısızlığının sınav cevaplama akışına etkisi test edilir.

## 4. Token alanının kullanıcıya açıklanması

Alan adı: **Bir üretim için yanıt üst sınırı (token)**. Alt not:

> Token, modelin metni işlerken kullandığı parçadır; soru veya kelime sayısı
> değildir. Bu değer bir isteğin yanıtına izin verilen en yüksek miktardır.
> Model daha az kullanırsa sınırın tamamı tüketilmiş olmaz. Düşük sınır soruları
> yarıda kesebilir. Yüksek sınır daha fazla soru üretme garantisi vermez.
> MiMo'da düşünme açıksa düşünme de bu bütçeden kullanılır. Öğretmen kullanım
> tablosu burada seçilen sınırı değil, sağlayıcının bildirdiği gerçek tüketimi gösterir.

**Teknik aralık:** mevcut uyumluluk korunarak **256–32768**; varsayılan **8192**.
Aralık hem istemci hem sunucuda denetlenir. 256 kısa yanıt içindir; çok sorulu
üretimde yetersiz kalabilir. Sağlayıcının seçilen model için daha düşük bir üst
sınırı varsa ayrıca uygulanır; doğrulanmamış model kapasitesi uydurulmaz.
Mevcut profil değeri sessizce değiştirilmez.

**İlk açıklama için hesap varsayımı:** kısa/orta uzunlukta, beş seçenekli Türkçe
soru ve cevap JSON'u başına ortalama **300**, aralık **200–500** çıktı tokenı;
bir isteğe yaklaşık **200** yapı payı. Bunlar ölçülmüş ortalama değildir.
Girdi uzunluğu ve düşünme bu örnek çıktı hesabının dışındadır.

| Senaryo | Orta örnek hesap | Örnek aralık | Başlangıç üst sınırı |
| --- | --- | --- | --- |
| Tek çağrıda 10 soru | 200 + 10 × 300 = 3200 | 2200–5200 | 8192 / çağrı |
| 20 soruluk sınav, 2 × 10 çağrı | 2 × 3200 = 6400 | 4400–10400 toplam | Her çağrıda 8192 |

20 soruluk sınavda iki çağrının izin verilen toplam tavanı 16384 olabilir;
bu, gerçek tüketim 16384 olacak demek değildir. Uzun paragraf, uzun seçenek,
detaylı açıklama veya açık düşünme tüketimi artırır. Gelecekte tek çağrıda 20
soru desteklenirse yaklaşık orta hesap 6200 olur; bunun üst sınırı ve gecikmesi
ayrı kabul testine bağlıdır, bu sürümde varmış gibi anlatılmaz.

Girdi tokenı; öğretmenin konusu/başlığı, uygulamanın soru kuralları ve varsa
başka sağlanan içerikten gelir. Yanıt üst sınırı doğrudan girdi tokenını sınırlamaz.
Mevcut üretim görselleri modele göndermediğinden görsel tokenı ölçülmüş sayılmaz.

En az beş uygun başarılı örnek birikince aynı model, düşünme modu ve soru adedi
için **gözlenen ortalama** ayrıca gösterilir. Örnek sayısı/tarih aralığı görünür;
başarısız istekler toplam tüketimden dışlanmaz ama örnek başarılı üretim
ortalamasına katılmaz. Gerçek ölçüm yokken “henüz ölçüm yok — örnek hesap” yazılır.
Model ve konu değiştikçe kesin yeterlilik/hız garantisi verilmez.

## 5. Uygulama sırası ve dosyalar

### A. Usage sözleşmesi ve sağlayıcı adaptörleri

Dosyalar: `server/services/ai-runtime.ts`, yeni `ai-usage-metadata.ts`,
`server/tests/utils/ai-management-runtime.test.ts` ve yeni usage testleri.

1. Önce üç protokol için bilinen/eksik/cache/düşünme sayıları, çift sayma,
   kesilmiş/boş yanıt ve ham sır sızmaması testleri başarısız gösterilir.
2. Ayrıntılı sonuç ve metin uyumluluk sarmalayıcısı uygulanır; mevcut runtime
   çağrılarının davranışı korunur. Negatif/uygunsuz sayılar kabul edilmez.
3. Testler ve sunucu tip kontrolü geçirilir.

### B. Kullanım defteri, bağlam ve güvenli ilişkilendirme

Dosyalar: `server/prisma/schema.prisma`, yeni migration,
`server/services/ai-usage.ts`, `server/api-routes/ai.ts`,
`server/api-routes/content-save.ts`, gerekiyorsa `server/storage.ts`,
`server/services/ai-question-format.ts`, `client/src/pages/create-quiz.tsx`,
`client/src/components/quiz/AIQuestionGenerator.tsx`, `client/src/lib/ai-management-api.ts`.

1. İzole DB'de üretim–taslak–kaydetme ilişkisi, öğretmen sahipliği, tekrar
   üretim, anket, kaydedilmeyen sınav ve tarihsel kayıt testleri yazılır.
2. Eklemeli migration, mevcut yazıcı üzerinden kayıt ve güvenli bağlam eklenir.
3. Geçersiz soru/timeout/iptal/DB kayıt hatası durumlarında soru üretimi ve
   kullanım tanısının beklenen davranışı doğrulanır. Mevcut içerik kayıt işlemi
   ve öğrenci cevap yazma güvenlikleri korunur.

### C. Admin listeleme API'si ve iki sekme

Dosyalar: `server/api-routes/ai-management.ts`, `server/services/ai-usage.ts`,
`client/src/pages/ai-management.tsx`, yeni `client/src/components/ai-management/`
altındaki sekmeler, token yardım bileşeni; istemci API tipleri.

1. Admin dışı okuma reddi, sayfa sınırı, filtre doğrulama, eksik usage,
   silinen profil ve birden çok açık/kapalı profil seçim testleri yazılır.
2. Filtreli `/api/admin/ai/usage` ve kapsam toplamları mevcut admin yetkisiyle
   eklenir; tüm satırları tarayıcıya indiren tasarım kullanılmaz.
3. Sekmeler, form durumunu koruma, kullanım tablosu, varsayılan model
   seçenekleri ve açıklamalı token alanı uygulanır.
4. Gerçek Chromium ile iki sekme, mobil görünüm, tablo ve form doğrulanır.

### D. Doğrulama, belgeler ve güvenli devreye alma

1. Sunucu/istemci hedef testleri; auth/CSRF, revizyon ve içerik kaydı
   regresyonları; iki tip kontrolü ve üretim build çalıştırılır.
2. Token toplamları üç sağlayıcı protokolü fixture'larıyla doğrulanır. Gerçek
   API çağrısı bu onaylı kapsamda sınırlı 10 ve 2×10 sentetik ölçüm içindir;
   kullanım metadatası kaydedilir, anahtar ve düşünme metni rapora yazılmaz.
3. Migration canlı DB'nin ayrı kopyasında prova edilir; kayıt sayıları,
   eski alanlar, profil anahtarlarının çözülebilmesi ve integrity/FK sınanır.
4. README, `docs/ai-management.md`, admin/öğretmen kılavuzları ve sonuç raporu
   güncellenir. İlk takip tarihinden önce tüketim olmadığı açık yazılır.
5. Kullanıcının uygulama onayı kapsamında, doğrulanmış tam yedekten sonra
   mevcut yerel kurulumda migration/yayın yapılır; aktif sınav varsa yayın
   ertelenir. Anahtar dosyası ve mevcut kullanıcı değişiklikleri korunur.

## Kabul ölçütleri

- İstenen iki sekme çalışır; mevcut profil/test/öğretmen üretim akışı korunur.
- Admin tüm profilleri durumuyla görür; uygun açık modeli varsayılan seçebilir.
- Bir öğretmen isteğinde öğretmen, ders, taslak/sınav ve kullanılan model doğru
  bağlanır; başka öğretmenin verisine ilişkilendirme mümkün değildir.
- Sayılar sağlayıcı yanıtıyla eşleşir; eksik bilgi 0 yapılmaz; düşünme çift
  sayılmaz. Taslak kaydedilince yeniden ücret/tüketim satırı oluşturulmaz.
- Kullanıcı 10/20 soru örneklerinde sınır ile gerçek tüketimin farkını anlar.
- Yeni tablo/sorgular mevcut sınav cevaplama yoluna bağlanmaz. Kullanıcı
  dosyaları, anahtarlar ve eski veriler doğrulamayla korunur.

## Teknik kaynaklar

- [Xiaomi düşünme/çıktı bütçesi ve usage](https://mimo.mi.com/docs/en-US/quick-start/usage-guide/other/deep-thinking)
- [Google GenerateContent usageMetadata](https://ai.google.dev/api/generate-content)
- [Anthropic cache ve input/output kullanım kalemleri](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)

Kaynak anlamları uygulama sırasında kullanılan API sürümünün resmî örnekleriyle
tekrar eşlenir; model kapasitesi ve Türkçe token tahmini evrensel sabit sayılmaz.
