# Xiaomi MiMo bağlantı incelemesi

> Güncelleme: Bu belge ilk inceleme anını kaydeder. Kullanıcı daha sonra Token Plan anahtarı girdi; doğru Singapur adresiyle erişim ve soru üretimi doğrulandı. [Düzeltmeler ve güncel sonuçlar](2026-10-15-ai-management-hardening-results.md).

15 Ekim 2026. Kapsam: kullanıcının kayıtlı Xiaomi profiliyle kontrollü tanı,
QuizMaster uyarlaması ve kaynak LLM eklentisinin incelemesi. Ürün kodu, canlı
profil, anahtar, erişim durumu veya çalışan uygulama bu incelemede değiştirilmedi.

## Sonuç

`LLM_AUTH` bir uygulama giriş hatası değil; mevcut sınıflandırıcıda sağlayıcının
HTTP 401/403 erişim reddidir. Kayıtlı anahtar var, AES-GCM ile çözülebiliyor ve
başında/sonunda boşluk yok. Anahtarın tamamı veya parçaları rapora yazılmadı.
Yapısal türü **kullandıkça öde**, kayıtlı adres ise **Token Plan Singapur**.

| Kontrollü gerçek istek | HTTP | Süre | Sağlayıcı yanıtı |
|---|---:|---:|---|
| Kayıtlı Token Plan adresi, Bearer | 401 | 1388 ms | Invalid API Key |
| Aynı adres/anahtar/gövde, api-key başlığı | 401 | 949 ms | Invalid API Key |
| Resmî kullandıkça öde adresi, aynı anahtar, Bearer | 402 | 1455 ms | Insufficient account balance |

İstekler kayıtlı `mimo-v2.6-flash` modeli, aynı küçük `OK` istemi, 256 token
üst sınırı, düşünme kapalı ve 20 saniye tanı deadline'ı kullandı. Redirect
izlenmedi. Anahtar yalnız resmî Xiaomi adreslerine sunucu tarafında gönderildi.
Başarılı model cevabı dönmedi; 1/3/10 soruluk gerçek üretim ve token/latency
karşılaştırması yapılmış sayılmaz. Bakiye hatası sonrası ek üretim denenmedi.

Bu sonuçlar header biçimi, şifreleme bozulması veya yanıt süresi ayarının birincil
neden olduğuna işaret etmiyor. Anahtar-adres türü uyuşmazlığı doğrulandı; doğru
resmî adreste sağlayıcı ayrı bir bakiye engeli bildirdi. 402, başarılı üretim
kabulü veya model erişiminin tüm koşullarda doğrulandığı anlamına gelmez.

Resmî belgeler iki anahtar türünün birbirinin yerine geçmediğini açıklar:
[API entegrasyonu](https://mimo.mi.com/docs/en-US/quick-start/faq/api-integration),
[ilk çağrı ve adresler](https://mimo.mi.com/docs/en-US/quick-start/summary/first-api-call),
[Token Plan bölgeleri](https://mimo.mi.com/docs/zh-CN/tokenplan/Token%20Plan/quick-access).

## Süre ve çıktı token değerlendirmesi

Kayıtlı profil: yanıt süresi **120000 ms = 120 saniye**, çıktı token üst sınırı
**32193**, düşünme **auto**. Karttaki **1045 ms**, testin hata alınana kadar geçen
süresidir; yapılandırılmış timeout değildir. Kimlik/bakiye reddi daha uzun
beklemekle düzelmez. Testlerdeki hızlı ret başarılı modelin üretim hızı değildir.

Yanıt süresi sınırı ve çıktı token sınırı uygulama için gereklidir: bekleme,
kaynak/maliyet üst sınırı ve aşırı uzun veya kesilen JSON davranışı kontrol edilir.
Token sınırı soru sayısı veya kesin kullanılacak token değildir; 32193 ayarı her
istekte bu kadar token harcandığı ya da yanıtın mutlaka yavaşlayacağı anlamına
gelmez. Ancak 1–10 okul sorusu için bu yüksek değeri gerektiren bir ölçüm yoktur.

MiMo'nun `auto` ayarında ilgili modellerin sağlayıcı varsayılanı düşünme açıktır.
`max_completion_tokens` düşünme ve son yanıtın toplamını sınırlar; düşünme açıkken
küçük bütçe son JSON'u kesebilir. Bu nedenle bütçe ve düşünme birlikte seçilmeli.
[Resmî düşünme davranışı](https://mimo.mi.com/docs/en-US/quick-start/usage-guide/text-generation/deep-thinking).

Önerilen ilk ayarlar (üretim ölçümüyle doğrulanacak): kısa test 20 s / 512 token /
düşünme kapalı; soru üretimi mevcut 120 s sınırıyla başlayabilir. Basit 1–3 soru
için 2048–4096, 4–10 soru için 4096–8192 token başlangıç aralıkları değerlendirilir;
bunlar ölçülmüş garantiler değildir. Yeni MiMo soru profillerinde düşünme kapalı
başlangıç tercih edilebilir; mevcut `auto`/açık ayarı sessizce değiştirilmemeli.
Karmaşık soru üretimi için admin açık düşünmeyi seçebilmelidir.

## QuizMaster'da doğrulanan eksikler

1. `ai-providers.ts`: Xiaomi için yalnız Token Plan Singapur preset'i var.
   Kullandıkça öde ve bölgesel Token Plan seçenekleri ayrılmıyor. UI/API anahtar
   türü–resmî adres uyumunu testten önce denetlemiyor.
2. `ai-runtime.ts`: `purpose: quick` gönderiliyor fakat çalışma politikası bu
   alanı kullanmıyor. Gerçek kod sahte transport ile yürütüldüğünde kısa test
   **32193 token** ve düşünme alanı **gönderilmeden** çalıştı. Orijinal eklenti
   aynı kısa testte **512 token, thinking disabled** hazırlıyor. Uyarlama kaybı.
3. `classifyLLMError`: HTTP 402 hem üründe hem eklentide `LLM_PROVIDER_ERROR`
   oluyor; ayrı bakiye mesajı yok. 401/403 de aynı auth kodunda birleşiyor.
4. Test geçmişi kod/süreyi saklıyor; güvenli açıklama, upstream HTTP durumu ve
   çözüm önerisi kartta yeterince sunulmuyor. `hasApiKey` yalnız kayıt varlığını
   gösterir; sağlayıcının kabul ettiği izlenimi verilmemeli.
5. Profil süre/token alanları teknik birimlerle sunuluyor; `auto` düşünmenin MiMo
   için varsayılan açık olduğu ve tokenın toplam bütçe olduğu açıklanmıyor.
6. `safeExternalFetch`: socket idle timeout ve generation abort sinyali var;
   DNS çözümü abort sinyalinden önce await ediliyor. DNS/connect/toplam deadline
   sınırları ayrı ve test edilebilir hale getirilmeli; SSRF/DNS pinleme korunmalı.

Mevcut Prisma depodaki zorunlu revizyon ve adres değişince yeni anahtar koruması
bu incelemede geri alınmadı. Hatalı anahtar veya URL otomatik taşınmadı.

## Kaynak eklentide doğrulanan eksikler

Kaynak: `F:/projeler/llm-yonetimi` (salt okunur). Bağımsız mevcut testleri **5/5**
geçti; bu testler aşağıdaki eksikleri kapsamadığından tam sağlayıcı kabulü değildir.

- Katalogda Xiaomi yalnız Token Plan preset'iyle sunuluyor; anahtar-adres türü
  eşleşmesi ve 402 bakiye ayrımı yok.
- Sentetik depoda `revision` verilmeden var olan profil düzenlenebildi.
- Sentetik depoda aynı sağlayıcı kalırken API adresi değiştirilip eski anahtar
  yeniden kullanılabildi. Bu, anahtarın yeni adrese gönderilmesine yol açabilecek
  depo sözleşmesi eksikliğidir; gerçek anahtar ile bu deney yapılmadı.
- Silme/etkinleştirme API'leri beklenen revizyonu zorunlu tutmuyor.
- Sohbet testi otel yönetimi/Manager bağlamına bağlı; genel amaçlı eklentide host
  tarafından özelleştirilebilir test tanımı olmalı. QuizMaster zaten soru testi
  kullanıyor; öğretmene serbest sohbet eklenmesi gerekmiyor.
- Runtime kesilmiş dolu yanıtı yalnız `purpose: manager` için reddediyor; diğer
  üretim amaçlarında tutarlı davranış ve payload boyutu sınırı gerekli.
- Tek etkin profil ve dosya/tek yazıcı yaklaşımı genel eklenti sözleşmesinde açık
  kalmalı; QuizMaster'ın çoklu açık profilleriyle karıştırılmamalı.

Kod tanısı (sahte transport ve sentetik profil dosyası) şu sonuçları üretti:
`appQuick.maxCompletionTokens=32193`, `pluginQuick.maxCompletionTokens=512`,
`app402=plugin402=LLM_PROVIDER_ERROR`, `pluginMissingRevisionAccepted=true`,
`pluginChangedEndpointReusedKey=true`. Kaynak eklenti veya canlı DB değiştirilmedi.

## Şu an yapılabilecek ayar

Mevcut kullandıkça öde anahtarı kullanılacaksa resmî adres
`https://api.xiaomimimo.com/v1` olmalı; sağlayıcı hesabındaki bakiye engeli de
giderilmelidir. Token Plan kullanılacaksa aboneliğe/bölgeye ait özel anahtar ve
adres çifti alınmalıdır. Kullanıcı adına satın alma, bakiye yükleme, anahtar
yenileme veya otomatik profil değişikliği yapılmadı.

Anahtarın gerçek değerini yeniden girmek gerekebilir: mevcut uygulama adres
değişikliğinde eski anahtarı sessizce başka adrese taşımayı reddeder. Bu güvenlik
koruması korunmalıdır. Ardından kısa test ve soru testi ayrı ayrı geçmelidir.

[Önerilen geliştirme planı](superpowers/plans/2026-10-15-xiaomi-ai-management-hardening.md).
