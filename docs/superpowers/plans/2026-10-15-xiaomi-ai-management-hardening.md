# Xiaomi ve AI yönetimi iyileştirme planı

Durum: 15 Ekim 2026 kullanıcı onayıyla hedefli düzeltmeler uygulandı. Uygulama ve kaynak eklenti güncellendi; kullanıcı tarafından verilen Singapur adresi gerçek Token Plan anahtarıyla doğrulandı. [Uygulama ve doğrulama kaydı](../../2026-10-15-ai-management-hardening-results.md).

Aşağıdaki ayrıntılı maddeler özgün kabul kontrol listesidir. Tamamlanan kapsam: Xiaomi hizmet seçimi/uyum kontrolü, güvenli hata tanıları, kısa test politikası, anahtar koruma/değiştirme UX'i, model seçimi/elle giriş, native model sayfaları, DNS iptali ve kaynak eklenti güvenliği. Gerçek token tüketimi dağılımı, tüm sağlayıcılarda hesapla canlı test ve p95/SLA ölçümü yapılmış sayılmaz.

**Amaç:** Xiaomi anahtar-adres uyuşmazlığını önlemek; ödeme/yetki/ağ/timeout
hatalarını anlaşılır göstermek; soru üretimine uygun test ve kaynak sınırları
sağlamak. Sınav, yetki, arşiv ve öğretmenin yalnız model seçmesi korunur.

**Yaklaşım:** Mevcut profil/Prisma yapısı ve sağlayıcı kimlikleri korunur. Xiaomi
için hizmet/adres preset'leri, güvenli tanı DTO'su ve amaç bazlı çalışma politikası
eklenir. Yeni bir AI sohbeti veya genel ayar refactoru yapılmaz.

**Alternatifler:** Yalnız URL'yi düzeltmek mevcut bakiye ve UI/test eksiklerini
çözmez. Tüm sağlayıcı katmanını yeniden yazmak gereksiz kapsamdır. Önerilen,
mevcut adaptör ve güvenlik sınırlarında hedefli iyileştirmedir.

## Koruma ve sınırlar

- Anahtarlar, ciphertext, Authorization başlığı ve sağlayıcı ham hata gövdeleri
  log/rapor/UI'ya verilmez. Preset uyarısı yalnız anahtar türünü belirtir.
- Anahtar-adres değişikliği sessizce yapılmaz. Mevcut profile yeni adres/kayıtlı
  anahtar yönlendirmesi için admin'in açık işlemi ve mevcut revizyonu gerekir;
  mevcut yeni anahtar girme koruması korunur.
- Mevcut `auto` düşünme anlamı ve profil seçimleri sessizce değiştirilmez.
- Kalıcı tablo değişikliği zorunlu değildir; test JSON tanısına isteğe bağlı
  güvenli alanlar eklenebilir. Eski test kayıtları okunabilir kalır.
- Mevcut Bun/pnpm değişiklikleri, `start-local.ps1` silinmesi ve kişisel istemci
  değişiklikleri kullanıcının çalışma ağacında korunur.
- Gerçek sağlayıcı çağrıları kullanıcı isteğiyle yapıldı. İlk incelemedeki 401/402 sonrasında kullanıcı Token Plan anahtarını ve doğru Singapur adresini sağladı; 1/3/10 soru üretimi doğrulandı. Sonuçlar ayrı uygulama raporundadır.

### 1. Xiaomi hizmet seçimi ve yerel uyum kontrolü — P0

Dosyalar: `server/services/ai-providers.ts`, yeni odaklı
`server/services/ai-provider-validation.ts`, `ai-profiles.ts`,
`client/src/pages/ai-management.tsx`, `client/src/lib/ai-management-api.ts`.

- [x] Kataloğa aynı Xiaomi sağlayıcısı altında PAYG, Token Plan CN/SGP/AMS
  preset'leri ekle; mevcut `xiaomi_mimo` kimliğini ve kayıtlı adresleri koru.
- [x] Saf `credentialEndpointProblem(provider, baseURL, apiKey)` fonksiyonu:
  bilinen resmî Xiaomi adresinde bilinen anahtar türü uyuşmuyorsa
  `AI_CREDENTIAL_ENDPOINT_MISMATCH` ile kontrollü hata üret; URL önerisi mesajı üret fakat
  anahtarı/adresi otomatik taşıma. Özel sağlayıcıları yanlışlıkla reddetme.
- [x] UI hizmet/bölge seçimi, resmî adres ve anahtar türü açıklaması sunsun.
  `Anahtar kayıtlı` ile `Son test başarılı` durumları ayrışsın.
- [x] Önce başarısız testler: PAYG anahtar + SGP reddi; Token Plan + PAYG reddi;
  doğru eşleşmeler; eski profil okunması; özel sağlayıcı; sır sızmaması.
  Sonra minimum uygulama ve aynı testlerin geçmesi.

### 2. Anlaşılır hata ve test geçmişi — P0

Dosyalar: `server/services/ai-runtime.ts`, `ai-http.ts`, `ai-profiles.ts`,
`server/api-routes/ai-management.ts`, istemci tipleri ve profil kartı.

- [x] 401 `LLM_AUTH`, 403 `LLM_FORBIDDEN`, 402 `LLM_BILLING`, 429 hız/kota,
  timeout, ağ ve geçersiz soru durumlarını ayrı güvenli açıklamayla göster.
- [x] Admin tanısı `{code,upstreamStatus?,message,actionHint?,durationMs,testedAt}`
  olsun. Bu uygulamada yönlendirme ayrıca `actionHint` alanı yerine kontrollü açıklama içine alındı. Metinler kontrollü yerel şablonlardan gelsin; ham upstream mesajı yok.
- [x] Tarihçede kısa/soru testini, tarihini ve profil revizyonunu ayrı göster;
  kod yanında “bakiye yetersiz”, “anahtar/adres eşleşmiyor” gibi açıklama ver.
- [x] Önce 402/401/403, değişen revizyon, eski JSON kayıtları ve secret-redaction
  testleri; sonra DTO/arayüz uygulaması ve doğrulama.

### 3. Kısa test ile soru üretimini ayır — P0

Dosyalar: `ai-runtime.ts`, `ai-management.ts`, sağlayıcı yetenek tablosu.

- [x] `resolveRuntimePolicy(profile,{purpose,count?})` saf ve test edilebilir
  olsun. Kısa test 20 saniye toplam sınır ve en çok 512 token kullansın
  (`min(profile.maxOutputTokens,512)`). MiMo kısa testinde düşünme kapatılsın;
  UI bunun yalnız bağlantı testi politikası olduğunu açıklasın.
- [x] Soru testinde gerçek QuizMaster soru prompt/parser'ı korunsun. Öğretmen
  üretiminde kayıtlı profil ayarı ve mevcut puanlama doğrulaması korunsun.
- [x] Kısa test tanısı yalnız HTTP başarısı değil boş/kesilmiş yanıtı da sınasın.
- [x] Önce `purpose=quick` ve kayıtlı 32193/auto için beklenen 512/disabled red
  testi; normal üretimde açık/auto anlamı ve kullanıcı iptali testleri; sonra
  amaç politikası uygulanıp doğrulansın.

### 4. Süre ve token alanlarını ürün diline çevir — P1

Dosyalar: admin profil formu, runtime policy ve HTTP taşıma testleri.

- [x] Alanı “Yanıt bekleme sınırı (saniye)” olarak göster; dönüşüm yalnız API
  sınırında ms'ye olsun. Mevcut kayıtlardaki 120000 değeri 120 sn görünmeli.
- [x] Kart süresini “Son testin tamamlanma süresi” diye ayır; 1045 ms'nin timeout
  olmadığını açıkla. Süre/token için rastgele artırmayı çözüm gibi sunma.
- [x] “Yanıt uzunluğu üst sınırı (token)” gelişmiş ayarda kalsın. Soru adedi
  değildir, gerçek kullanım garantisi değildir ve MiMo'da düşünmeyi de kapsar.
- [x] Yeni MiMo soru profili için düşünme kapalı başlangıç öner; mevcut auto
  değerini koru ve bu modelin sağlayıcı varsayılanının açık olduğunu açıkla.
- [ ] Başlangıç önerileri: 1–3 soru için 2048–4096, 4–10 için 4096–8192;
  bunları ölçülmüş limit gibi sunma. Genel 8192 varsayılanını veri olmadan
  topluca düşürme; admin üst sınırı korunsun.
- [ ] DNS, bağlantı, gövde okuma ve toplam deadline testleri ekle. DNS iptal regresyonu ve mevcut pin/redirect kontrolleri geçti; ayrıntılı bağlantı/gövde zaman aşımı matrisi henüz tamamlanmış sayılmaz. DNS beklemesi
  iptal/deadline'ı aşamasın; mevcut public-IP doğrulaması ve adres pinlemesi
  hiçbir koşulda kaldırılmasın. Yanıt boyutu 2 MiB sınırı korunsun.

### 5. Kaynak eklentiyi ayrı paket olarak güçlendir — P1

Dosyalar (ayrı repo/kapsam): `llm-yonetimi/src/providers.js`, `runtime.js`,
`profileStore.js`, `index.js`, `public/llm-ui.js`, `tests/plugin.test.js`.

- [x] Ortak endpoint/hata/policy sözleşmesini iki projede sözleşme testleriyle
  koru; otomatik kontrolsüz kaynak kopyalama yapma.
- [x] Update/delete/activate için revizyonu zorunlu tut; adres veya sağlayıcı
  değişince eski anahtarı sessizce yeniden kullanma. Sentetik regresyonla önce
  bug'ı göster, sonra düzelt. Tek yazıcı/dosya deposu sınırı açık kalsın.
- [x] Kesilmiş dolu yanıtı amaç fark etmeksizin kontrollü reddet; payload boyutu
  sınırı, 402 ayrımı ve iptal tanısı ekle.
- [x] Host test istemi/doğrulayıcısı eklenebilsin; otel/Manager örneği hostlara
  zorunlu olmasın. Manager kısa testindeki 512/disabled politikasını kaybetme.
- [x] Dış kaynak paketinde yalnız test edilmiş dosyalar, eski içerik hash kontrolü ve yedekle değiştirildi. Veri/anahtar dosyaları değiştirilmedi.

### 6. Kabul, yayın ve gerçek üretim ölçümü — P1

- [x] İzole server/UI testleri: doğru/yanlış eşleşme, tüm hata sınıfları,
  çoklu profil, revizyon, iptal, form koruması, key sızıntısı ve eski kayıtlar.
- [x] Gerçek Chromium'da PAYG/Token Plan seçimi, anlaşılır 401/402 mesajı,
  süre/token birimleri ve öğretmenin yalnız model seçebilmesi.
- [ ] Sağlayıcı hesabı kullanılabilir hale geldiğinde kullanıcının açık test
  izniyle 1/3/10 sentetik soru için düşünme kapalı; gerekirse açık A/B ölçümü.
  Süre, actual completion/reasoning tokenları, finish_reason ve mevcut soru
  parser sonucu kaydedilsin; gizli muhakeme ve API anahtarı kaydedilmesin.
- [ ] 256/512 kısa test politikası ve 2048/4096/8192 üretim bütçelerinden uygun
  olanları gerçek sonuçlara göre ayarla. Tek örnekten p95/SLA iddiası üretme.
- [x] Tip kontrolleri, ilgili regresyonlar ve standart build; ardından doğrulanmış
  yedekle kullanıcı onaylı yayın. Mevcut sırlar/iş verileri değişmesin.

## Tamamlanma koşulu

Yanlış anahtar-adres çifti dış isteğe çıkmadan açıklanır; gerçek 402 ayrı bakiye
hatası görünür; kısa test profilin büyük üretim bütçesini tüketmez; öğretmen
yalnız açık model seçer; kayıtlı anahtarların güvenlik ve revizyon korumaları
korunur. Başarılı Xiaomi üretimi, bakiye engeli kalkmadan tamamlanmış sayılmaz.

## İnceleme kanıtı ve kaynaklar

[Bulgular ve gerçek testler](../../2026-10-15-xiaomi-ai-management-analysis.md).
Resmî [anahtar/adres](https://mimo.mi.com/docs/en-US/quick-start/faq/api-integration),
[endpoint](https://mimo.mi.com/docs/en-US/quick-start/summary/first-api-call),
[düşünme/token](https://mimo.mi.com/docs/en-US/quick-start/usage-guide/text-generation/deep-thinking)
ve [yapısal JSON](https://mimo.mi.com/docs/en-US/quick-start/usage-guide/text-generation/structured-output)
belgeleri inceleme tarihinde doğrulandı.
