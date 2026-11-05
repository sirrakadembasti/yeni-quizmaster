# Yapay zekâ entegrasyonu denetimi

> **Tarihsel kapsam/inceleme kaydı.** Kaynak satırları ve ölçümler özgün denetim tarihine aittir. Sonraki onarım kabulü [sonuç raporundadır](defect-repairs.md); buradaki ölçüm güncel üretim kapasitesi garantisi değildir.

Bu belge onarım öncesi denetimin tarihsel kaydıdır. Aşağıdaki cevap için varsayılan seçeneğe dönme, girdi/çıktı doğrulama ve eski ayarlara bağlı hazır durumu bulguları daha sonra giderildi; kabul ve gerçek sağlayıcıyla yeniden kontrol sonuçları [onarım raporundadır](defect-repairs.md). İlk başarısız sonuçlar `before-repairs/` altında tutulur; ilk çevrimdışı davranış belirleme sonuçları değiştirilmemiştir.

## Kanıt ve kapsam

`ai-offline-results.json`: gerçek Express/kimlik doğrulama/AI rotalarıyla, sağlayıcı yanıtları `safeExternalFetch` noktasında taklit edilerek 22/22 kontrol geçti. Uygulama veritabanına veya harici sağlayıcıya çağrı yapılmadı. Üç kontrol, denetim anındaki kusurları tanımlar; geçmeleri bu kusurların onarıldığı anlamına gelmez. Bunlar rota entegrasyonu testleridir; gerçek Google/TLS testi değildir.

Ayrı korumalı `ai-live.test.ts` en fazla iki gerçek resmî Google isteği gönderir: beş tokenlık bağlantı kontrolü ve yalnız bu başarılıysa bir sentetik aritmetik sorusu. Anahtar yapılandırmasını uygulamanın öncelik sırasıyla yükler, sunucunun varsayılan modelini kullanır, yalnız veri saklama ve günlük yazmayı taklit eder; üretilen soru sayısını, türünü, seçenekleri ve doğru cevap indeksini doğrular. Hassas alanları temizlenmiş, yalnız durum içeren kanıt yazar. Üretilen soruları veya kullanıcı verilerini kaydetmez.

İzin verilen gerçek Google testi, kullanıcı anahtarı güncelledikten sonra 4 Ekim 2026'da çalıştı. `ai-live-evidence.json`, kimlik bilgilerinin yapılandırıldığını, iki sağlayıcı isteğini ve bağlantı/üretim kontrollerinde HTTP 200 yanıtlarını kaydeder. `ai-live-results.json` sonucu **1 başarısız test, 0 geçen test** olarak kaydeder: üretilen cevap/indeks tutarlılığı başarısızdı. Seçilen seçenek sentetik `83` sayısıyken `correctAnswer` değeri `A` harfiydi. Bu, doğru cevap indeksi yerine varsayılan seçeneğin kullanılması kusurunu gerçek sağlayıcıyla yeniden üretir; başarılı HTTP yanıtı geçerli puanlama verisi üretildiği anlamına gelmez.

Önceki anahtarın HTTP 402 bağlantı reddi `ai-live-previous-key.json` içinde ayrı tutulur. İlk incelemenin eksik anahtar gözlemleri, sonraki gerçek başarılı bağlantı ve üretim istekleriyle güncellenmiştir.

## Kontroller

| Alan | Sınanan davranış |
| --- | --- |
| Erişim | Oturumsuz kullanıcı, öğrenci ve veli sağlayıcı çağrısından önce engellenir |
| Kimlik bilgileri | Resmî uç noktaya dönüş; özel uç noktaya sunucu anahtarı gönderilmemesi; açıkça verilen özel anahtar |
| Uç nokta güvenliği | HTTP, localhost ve loopback adresleri engellenir |
| Yanıtlar | Ham dizi, questions sarmalayıcısı, Markdown JSON ve açıklama metninden alternatif çözümleme |
| Sınav anlamı | Seçenekleri karıştırma doğru cevap başvurusunu korur |
| Anket anlamı | Derecelendirme yapılandırması ve boş doğru cevap değeri korunur |
| Hatalar | Bozuk şema, çözümlenemeyen JSON, boş mesaj, sağlayıcı 429 yanıtı ve iptal |
| Kusur gözlemleri | Boş dizinin kabulü, eksik cevapta sıfırıncı seçeneğin seçilmesi, doğrulanmamış konu/adet bilgisinin sağlayıcıya ulaşması |

## Bulgular

1. `server/api-routes/ai.ts:306`: sağlayıcının cevabı seçeneklerde yoksa sıfırıncı indeks kullanılır. Geçersiz AI soruları bu nedenle yanlış puanlama cevabıyla kaydedilebilir. Hem çevrimdışı hem izin verilen gerçek Google üretimiyle yeniden üretildi: sayısal seçeneklere harf cevabı eşlendi ve doğrulayıcı başarısız oldu.
2. `server/api-routes/ai.ts:183`: gelen istek şeması konu/adet/zorluk/model alanlarını denetlemiyor. Eksik konu ve negatif adet sağlayıcıya ulaşıyor. Çevrimdışı yeniden üretildi.
3. `server/api-routes/ai.ts:55`: yanıt dizilerinde asgari uzunluk/adet sınırı yok. Boş dizi HTTP 200 döndürüyor. Çevrimdışı yeniden üretildi; arayüz daha sonra hata gösteriyor.
4. `client/src/components/quiz/AIQuestionGenerator.tsx:288`, `:299`, `:310`: özel temel URL/anahtar/model değişince başarılı `testResult` temizlenmiyor; hazır durumu önceki ayarlara bağlı kalıyor. Bu kaynak gözlemidir; burada tarayıcıyla yeniden üretilmedi.
5. `server/api-routes/ai.ts:121`, `:187`: varsayılan `gemini-3.8-flash`. Gerçek bağlantı ve üretim istekleri tam bu varsayılanla HTTP 200 döndürdü. Google model açıklaması [Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash) sayfasındadır. Model erişimi yalnız denenen anahtar ve o tarihli koşu için doğrulanmıştır.

## Yeniden çalıştırma

Depo kökünden (PowerShell):

```powershell
pnpm --filter quiz-master-server exec vitest run --config F:/projeler/yeni-quizmaster-main/docs/integration-audit/ai-offline.config.mts --root F:/projeler/yeni-quizmaster-main --reporter=json --outputFile=F:/projeler/yeni-quizmaster-main/docs/integration-audit/ai-offline-results.json
```

İzin verilen gerçek sağlayıcı testi için `GEMINI_API_KEY` değerini yerel `server/.env`, kök `.env` veya süreç ortamında yapılandırın; anahtarı komut argümanlarına veya günlük kayıtlarına yazmayın. Ardından:

```powershell
$env:LIVE_AI='1'
pnpm --filter quiz-master-server exec vitest run --config F:/projeler/yeni-quizmaster-main/docs/integration-audit/ai-live.config.mts --root F:/projeler/yeni-quizmaster-main --reporter=json --outputFile=F:/projeler/yeni-quizmaster-main/docs/integration-audit/ai-live-results.json
Remove-Item Env:LIVE_AI
```

Gerçek sağlayıcı testinin atlanması, kontrolün engellendiği anlamına gelir; başarılı entegrasyon sayılmaz. Gerçek sağlayıcı rota test aracı, sentetik kimliği doğrulanmış Express uygulaması kurarak uygulamanın kalıcı oturum ve CSRF katmanlarını devre dışı bırakır; tam tarayıcı oturumu/CSRF entegrasyonu ayrı denetimdir.
