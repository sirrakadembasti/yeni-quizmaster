# AI yönetimi düzeltmeleri — 15 Ekim 2026

Kullanıcı onayıyla mevcut uygulama ve `F:/projeler/llm-yonetimi` kaynak paketi
güncellendi. Sınav/öğretmen akışı ve rol sınırları korunur; yeni migration yoktur.

## MiMo tanısı ve gerçek sonuç

İlk incelemedeki PAYG anahtarı Token Plan adresinde 401, doğru PAYG adresinde
402 döndürmüştü. Bu çalışmanın başında kullanıcı yeni bir Token Plan anahtarı
girmişti; PAYG adresinde gerçek test yine 401 döndürdü. Kullanıcının verdiği
`https://token-plan-sgp.xiaomimimo.com/v1` adresiyle kısa test geçti. Profil bu
adrese revizyon denetimiyle kaydedildi; anahtar değeri korundu. Profil erişimi
kendiliğinden öğretmenlere açılmadı.

Kayıtlı model `mimo-v2.6-flash`, süre sınırı 120 saniye. JSON moduyla sentetik
Türkiye tarihi sorularının sayı/biçim/cevap tutarlılığı kontrol edildi:

| Soru | Düşünme | Token üst sınırı | Süre | Sonuç |
| --- | --- | --- | --- | --- |
| 1 | Otomatik | 32000 | 2559 ms | Geçti |
| 3 | Otomatik | 32000 | 7530 ms | Geçti |
| 10 | Otomatik | 32000 | 9196 ms | Geçti |
| 10 | Kapalı | 8192 | 17850 ms | Geçti |

Kayıtlı profil kısa testi 2194 ms'de geçti. JSON modu öncesindeki ilk 10 soru
koşusu başarısız oldu; ham yanıt tutulmadığından kesin neden çıkarılamaz. Tekrarı
23382 ms'de geçti. JSON modu şema/içerik doğrulamasını kaldırmaz. Bunlar tekil
gözlemlerdir; gecikme yüzdelikleri, içerik doğruluğu veya kapasite garantisi
değildir. Token sütunu gerçek tüketim değildir; usage/reasoning token ölçümü bu
çalışmada toplanmadı. Mevcut 32000/otomatik seçimi değiştirilmedi; 8192 yalnız
geçici karşılaştırmada kullanıldı ve yeni profil başlangıcı olarak kalır.

Model keşfi gerçek Google hizmetinde 46 üretim destekleyen model, MiMo'da 8
model döndürdü; kayıtlı modeller listelerde bulundu. Diğer sağlayıcıların
hesapları/anahtarları olmadan canlı erişim doğrulandı denemez.

## Düzeltmeler

- PAYG ve Token Plan CN/SGP/AMS hizmet seçimi; bilinen resmî adreslerde yanlış
  anahtar türünü sır sızdırmadan reddetme. Mevcut sağlayıcı kimlikleri korundu.
- 401, 402, 403, 429, ağ ve süre hataları ayrıldı. Test kartlarında kontrollü
  açıklama, upstream HTTP durumu, test tarihi ve revizyon gösterilir.
- Kısa test en çok 20 saniye/512 token; MiMo kısa testinde düşünme kapalı.
  Normal üretimde kayıtlı tercihler korunur. Destekli MiMo soru modellerinde
  JSON modu ve mevcut kesin soru/cevap doğrulaması birlikte uygulanır.
- Düzenlemede maskeli, düzenlemeye kapalı kayıtlı anahtar durumu ve ayrı
  **Anahtarı değiştir / Kayıtlı anahtarı koru** işlemi. Sır tarayıcıya dönmez.
- Gerçek model seçme listesi ve elle kimlik girişi birlikte çalışır. Değişmiş
  adres/anahtarla eski kayıt üzerinden keşif yapılması engellenir. Google'da
  üretim desteği filtrelenir; Google/Anthropic sayfaları sınırlı sürede alınır.
- Süre saniye olarak gösterilir; token sınırı gelişmiş ayarda açıklanır.
  DNS beklemesi iptal/deadline'ı aşamaz; IP doğrulama/pin, redirect ve 2 MiB
  yanıt korumaları korunur.
- Kaynak eklenti: update/delete/activate revizyonu zorunlu; adres değişince yeni
  anahtar zorunlu; ödeme/izin ayrımı, her amaçta kesilmiş yanıt reddi, 2 MiB
  yanıt sınırı, kısa test politikası, hizmet seçimi ve host test istemi/validator
  parametreleri. Dosya deposu tek yazıcı içindir; çok süreçli CAS garantisi yoktur.

## Doğrulama ve koruma

Sunucu AI/depo/native/DNS 48 test; yönetim API/yetki/soru biçimi 28 test;
istemci admin/öğretmen 9 test; kaynak eklenti 10 test geçti. İki TypeScript
kontrolü ve üretim derlemeleri geçti. Gerçek Chromium, sentetik API ile
derlenmiş UI'da anahtar koruma/değiştirme, model seçimi/elle giriş, MiMo hizmet
seçimi, saniye birimi, 402 açıklaması, mobil taşma ve öğretmen üretimini sınar.
Bu tarayıcı testi gerçek sağlayıcı E2E'si değildir; yukarıdaki sağlayıcı
çağrıları gerçek runtime/model keşfi üzerinden ayrı çalıştırılmıştır.

Yerel uygulama `http://127.0.0.1:5000` adresinde güncellendi. Gizli tam yedek
`server/backups/before-ai-hardening-20261015`: sekiz dosya hash ile doğrulandı.
Yetkilendirilen MiMo profil adres/test kaydı dışında 29 tablo aynı kaldı;
diğer profil satırları ve tüm çözülmüş API anahtarı değerleri aynı. DB integrity
`ok`, FK ihlali 0. Kaynak eklentinin özgün dosyaları ayrıca
`server/backups/llm-plugin-before-hardening-20261015` altında yedeklendi.
Kullanıcının `client/src/lib/api.ts`, `client/src/pages/server-setup.tsx`,
paket yöneticisi değişiklikleri ve diğer yerel çalışması korunur.

Resmî belgeler: [Xiaomi anahtar/hizmet eşleşmesi](https://mimo.mi.com/docs/en-US/quick-start/faq/api-integration),
[adresler](https://mimo.mi.com/docs/en-US/quick-start/summary/first-api-call),
[JSON modu ve sınırları](https://mimo.mi.com/docs/en-US/quick-start/usage-guide/text-generation/structured-output),
[Google model listesi](https://ai.google.dev/api/models),
[Anthropic model listesi](https://platform.claude.com/docs/en/api/models/list).
