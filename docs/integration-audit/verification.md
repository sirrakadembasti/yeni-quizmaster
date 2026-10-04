# SMTP, AI, Socket, yük ve UX doğrulaması — 4 Ekim 2026

Bu koşu `6367b54d` sonrası çalışma ağacını inceledi. Ürün kodu değiştirilmedi; yeniden çalıştırılabilir test araçları ve kanıtlar eklendi. Kullanıcının `client/src/lib/api.ts` ve `client/src/pages/server-setup.tsx` düzenlemeleri korundu. Gerçek `server/data/quiz.db` SHA256 değeri koşuların öncesi/sonrası aynı: `8210a4b79f2cfb9cf74de6a4989f5c8a5449ba1d17b2332abdbd018c3741a158`.

## Sonuçlar

| Alan | Sonuç | Kanıt / sınır |
|---|---|---|
| Gmail SMTP | TLS, hesap doğrulaması ve izin verilen adrese tek gönderim başarılı; Gmail bir alıcıyı kabul etti, reddetme yok | `smtp-probe.json`; 587/STARTTLS. Gelen kutusu/okunma doğrulanmadı. Kuyruk yerine gerçek Nodemailer transport sınandı; admin test endpoint'i veya gerçek parola sıfırlama e-postası bu koşuda çağrılmadı. |
| Gerçek AI | Yeni anahtarla bağlantı **200**, bir sentetik soru üretimi **200**; cevap doğruluğu kontrolü **başarısız** | `ai-live-results.json`, `ai-live-evidence.json`. Seçenek metni `83`, doğru cevap `A`; eşleme bulunmayınca indeks 0 seçiliyor. İlk anahtarın 402 sonucu `ai-live-previous-key.json` içinde tarihsel. |
| AI entegrasyonu | 22/22 test beklentisi geçti | Sağlayıcı taklit edildi; üç test mevcut hataları yeniden üretiyor, düzelttikleri anlamına gelmez. Ayrıntı `ai-audit.md`. |
| Gerçek Socket | **18/18 geçti** | `../live-audit/socket-results.json`: WebSocket/polling, Origin, oda izolasyonu, gerçek DB bildirimi, logout/parola/oturum iptali. Boşta kalan iptal edilmiş bağlantı 30.004 ms içinde kapandı. Tam index CSRF/proxy/TLS bileşimi ayrı kapsam. |
| Mobil sayfalar | 9/9 sayfa ağın durulması sonrası incelendi; taşma, JS hatası, başarısız API kaydı yok | `ux-runner-results.json`, ilgili ekran ve ARIA dosyaları. Bu sayfalardaki bütün işlemlerin hatasızlığı anlamına gelmez. |
| Ayrıntılı UX | 16 karakterizasyon + iki ek kontrol çalıştırıldı | `ux-detail-results.json`, `ux-extra-results.json`. `observed` ölçüm alındığı anlamındadır; kabul kriterinin geçtiği anlamına gelmez. İlk S-U06 gözlemi yükleme aşamasında kaldı; kesin çevrimdışı sonuç ek koşudadır. |
| PDF | 60 uzun kayıt / 60 satır / 60 başlık sonu; 8 sayfa, boş sayfa yok | `pdf-verification.json`, `ux-extra-large-report.pdf`. Dört gerçek Chromium PDF'si okundu; beş örnek sayfa görsel olarak incelendi. Bütün sekiz sayfa metinle denetlendi, ilk/son sayfa görsel örneklendi. Fiziksel yazıcı sınanmadı. |
| Süreç/veri temizliği | İzinli UX/yük koşularında sahip olunan API/UI süreçleri kapandı, 5560/5561 serbest, gerçek DB değişmedi | `load-ux-results.json`, `ux-runner-results.json`, `ux-extra-runner-results.json`. İlk sandbox denemesinde EPERM oluştu; tarihsel başarısızlık `load-ux-sandbox-attempt.json`. Sonraki dış kontrol eski listener kalmadığını doğruladı. |

## Yük ölçümleri

Tam uygulama başlangıcı, gerçek SQLite uygulama/oturum depoları, dört ayrı rol oturumu ve altı GET uç noktası kullanıldı. Giriş sonrası GET yükü; sınav cevabı/teslim veya AI/SMTP yükü değildir. Her kademede 180 istek, 15 saniye istemci sınırı, kapalı döngü eşzamanlı istek modeli kullanıldı. Küçük fixture, Windows geliştirme sunucusu ve bu makineye ait ölçümlerdir; eşzamanlı gerçek kullanıcı veya üretim kapasitesi garantisi değildir. İlk kademeler sırasında küçük AI bağlantı testleri de çalıştı; donanım/sistem kullanımı profillenmedi.

| Eşzamanlı istek | HTTP 200 | İstek hatası | P50 / P95 | İstek/sn | Kabul |
|---|---|---|---|---|---|
| 2 | 180/180 | 0 | 599 / 1320 ms | 2,86 | HTTP başarı ölçütü geçti |
| 8 | 178/180 | 2 | 2576 / 4731 ms | 2,88 | Geçmedi |
| 20 | 127/180 | 53: 39 timeout, 14 diğer istek hatası | 9438 / 15014 ms | 1,98 | Geçmedi |

`load-ux-results.json` ham ölçüm özeti. Ayrı native fetch tek `/api/student/quizzes` tanısı (`load-diagnostic.json`): 2 eşzamanlı/40 istekte40 başarı; 20 eşzamanlı/40 istekte37 başarı, bir ECONNRESET ve iki timeout. Tanı tarayıcı koşusuyla aynı fixture ömründe çalıştı; birinci benchmarkın bire bir tekrarı değildir. 8 kademesinin sınıflandırılmamış iki hatasının ve yavaşlamanın kök nedeni henüz belirlenmedi; yalnız bu sonuçtan SQLite, bağlantı havuzu veya uygulama kodunu tek neden ilan etmiyoruz. Prod build, daha büyük veri, kontrollü kaynak ölçümü ve cevap/teslim trafiğiyle ayrı profil gerekir.

## Doğrulanmış sorunlar ve öneriler

| Öncelik / tür | İşlem ve tekrar | Beklenen → gerçekleşen | Çözüm / kabul kriteri |
|---|---|---|---|
| Yüksek / hata | AI ile bir çoktan seçmeli soru üret | Doğru cevap geçerli seçeneğe bağlı → sağlayıcının harf cevabı metinle eşleşmeyince sessiz indeks0 | Açık cevap sözleşmesi ve güvenli doğrulama; eşleşmeyen cevabı reddet. Sayı/metin/harf yanıtlarında doğru seçenek korunmalı; geçersiz cevap hiçbir zaman varsayılan puan anahtarı olmamalı. `ai.ts:306`, gerçek + taklit sağlayıcı kanıtı. |
| Orta / hata | AI API'ye konu olmadan negatif count gönder; sağlayıcı boş dizi versin | Erken400 / başarısız üretim → sağlayıcıya gider / boş liste200 | İstek şeması, 1–10 sınırı ve çıktı sayısı/boşluk kontrolü; harici çağrıdan önce reddetme ve anlaşılır mesaj. Üç karakterizasyon testi. |
| Yüksek / performans incelemesi | Yukarıdaki8/20 GET yükü | Bütün istekler15s içinde başarılı → hata/zaman aşımı | Önce istek/oturum/SQL/zamanlama profilini ayır; üretim benzeri temiz koşuda sözleşilmiş SLO'yu doğrula. Kök nedeni bilinmeden depolama değişikliği önerilmez. |
| Orta / UX hatası | Öğrenci dashboard detay ikonuna Tab ile git | Görünür, adı olan eylem → odakta opacity0, adsızbutton | Erişilebilir ad ve focus/touch görünürlüğü; Tab+Enter doğru sonucu açmalı. S-U01. |
| Orta / UX | Sınav durum filtresi, sınav/anket seçeneklerini seç | Kontrol amacı ve seçili durum programatik olarak anlaşılır → adsızcombobox, seçimi göstermeyenbutton; ankettextarea adsız | Bağlı label, radio/pressed/checked semantiği; gerçek klavye ve ARIA öncesi/sonrası testleri. S-U02/03/04. |
| Orta / hata | Ankete yalnız boşluk yaz, diğer soruları doldur;403/404/500 yanıtı | Boş cevap engellenir, hata ayırt edilir ve toparlanılır → gönderim etkin; hepsi“bulunamadı”, retry yok | Trim tabanlı doğrulama, yetki/bulunamadı/sunucu ayrımı ve retry; gerçek reload ile toparlanma bu koşuda geçti. S-U04. |
| Orta / hata | Bildirim popover GET500; toplu-okundu500 | Hata ve yeniden deneme →“Henüz bildirim yok”; mutasyon hata bildirimi yok | Hata/boş ayrımı, retry ve işlem başarısızlığı bildirimi. S-U07; kontrollü ağ kanıtı. |
| Orta / hata | Tamamlanan sınav listesi yükle; iki liste isteğine503 verip yenile | Tamamlanan önbellek durumu korunur →“Yapılacak” | Güvenli sonuç durumunu da kullanıcı bazında cachele/uzlaştır; tamamlandı/yereldevam/teslimbekliyor durumları ayrı kalsın. S-U06 kesin ekkoşu. |
| Orta / UX hatası | Öğretmen önizlemesinde bitirme modalı | Sonucun kaydolmadığı tutarlı açıklama → banner“kaydedilmez”, modal“kaydedilecek” | Önizlemeye özel metin; gerçek öğrenci ve öğretmen modalı ayrı test. T-U02. |
| Orta / baskı hatası | İstatistiği aç, SVG görünür olur olmazPDF üret | Tabloda iki sınıf%100 katılım ve grafikte karşılıkları → hızlıPDF'de katılım çubukları yok | Baskı için animasyonsuz/kararlı grafik; ilk açılış ve filtre sonrası hemen baskıda eksen/tablo uyumu. T-U04 PDF ve render kanıtı; bütün zamanlamalar sınanmadı. |
| Düşük / UX önerisi |50/69/70 aynı sonuçlarıdashboard/istatistikte göster | Başarı ölçütü açık → dashboard üç trophy, istatistik yalnız70 başarılı | Ürün eşiğini belirle veya farklı anlamları açıkla. S-U05; ürün kararı gerekir. |
| Düşük / UX önerisi | Rapor öğrenci kodu, baskı tabloları, istatistikPDFdüğmesi | Tanımlayıcı/eylem anlaşılır → kod8 karakter; boşİşlemler/Eylemkolonu;“PDFİndir”window.print çağırır | Tam kod/başka doğru etiket, baskı işlemler kolonunu kaldır, “Yazdır / PDF olarak kaydet”. T-U03/A-U01/S-U08; JavaScript printçağrısı geçti, OSdiyaloğu yönetilmedi. |
| Düşük / UX önerisi | Sonuç aramasına yaz | Amaç kalıcı görünür → yalnızplaceholder, bağlılabelyok | Kalıcılabel; mevcutplaceholder erişilebilir adının varlığı hata diye reddedilmez. T-U01. |

Kaynak incelemesinde ayrıca AI özel sağlayıcı ayarı değişince eski başarılı hazır durumunun korunduğu görüldü (`AIQuestionGenerator.tsx`). Bu koşuda tarayıcıyla yeniden üretilmedi; doğrulanmış hata grubuna katılmadı. Veli filtre/export/doğrudan detay URL'si, rapor menüsü ve rota JS ayırma gibi yeni özellikler [ayrı UX kapsamındadır](ux-scope.md); uygulanmadı.

PDF görsel incelemesinin ayrıntıları `pdf-visual-review.json` içindedir. A-U01 çıktısı yüklenen tabloyu değil başlangıç spinner'ını yakaladı; İşlemler başlığının baskıda kaldığı doğrulandı, bu PDF'den dolu admin listesinin satır bütünlüğü çıkarılmaz. T-U04 hızlı baskısında grafik eksenleri/tablo görünürken iki%100 katılım çubuğu yoktur. Uzun raporun ilk/son sayfaları okunabilir ve tablo başlığı son sayfada tekrar ediyor.

## Yeniden çalıştırma ve kapsam

`node scripts/integration-smtp-probe.mjs` yalnız doğrular; alıcı argümanı eklemek **gerçek e-posta gönderir**, sadece açık izinli adresle kullanılır. Ortam anahtarları raporlanmaz. `pnpm --filter quiz-master-server exec tsx tests/live-socket-audit.ts` yeni fixture oluşturur. AI komutları `ai-audit.md` içinde; gerçek çağrı anahtar + `LIVE_AI=1` gerektirir ve ücret doğurabilir. AI sonucu saklamayan sentetik içerik kullanılır.

`node scripts/integration-load-ux.mjs` yeni izole fixture ile yük/UX çalıştırır. `INTEGRATION_UX_ONLY=1` yalnız pathguard'dan geçen eski fixture'ı kullanır; `INTEGRATION_UX_EXTRA=1` ek çevrimdışı/PDF kontrollerini seçer. Portlar doluysa mevcut uygulama kapatılmaz. Windows sandboxta Chromium veya süreç temizliği engellenirse uygun süreç izniyle çalıştırılır. `scripts/integration-print-verify.py` için mevcut pypdf/pypdfium2 runtime kullanılır.

Sunucu type-check çıkış0. Yeni test araçları syntax açısından kontrol edildi. Ürün kodu değişmediği için bütün panellerin eski tamE2E/birim testleri tekrar çalıştırılmadı; bu rapor eski bütün kontrollerin soncommit üzerinde tekrar geçtiğini iddia etmez. Gerçek ekran okuyucu sesli testleri kullanıcı kararıyla kapsam dışıdır; burada ARIA/klavye kontrolü yapıldı. Fiziksel yazıcı ve SMTP gelen kutusu teslimi sınanmadı.

Bağımsız inceleme sonrası araçlar güçlendirildi: test entrypoint'i her başlatmada farklı `x-quizmaster-audit-fixture` işaretini verir; doğrudan araçlar bu işareti girişten önce doğrular. İşaret yalnız test girişlerinde kurulur, üretim sunucusunda yoktur. Yanlış servise karşı negatif kontrol1/1 geçti; hiçbir login/yazma gönderilmedi (`node --test scripts/integration-target-guard.test.mjs`). Son nonce korumalı ekkoşu çıkış0, kimlik doğrulaması/iki kontrol/port temizliği geçti. Mobil kabul ve eksik gözlem koşuları artık runner çıkışını başarısız yapar; `observed` hâlâ ürün kabulü anlamına gelmez. SMTP aracı izinli alıcı istenip gönderim kabul edilmezse başarısız çıkar; PDF aracı boş sayfa/satır/başlık sonu kaybında başarısız çıkar. Gerçek SMTP yeniden gönderilmedi; kayıtlı tek gönderim korunur. Son helper'larla sunucu type-check tekrar çıkış0.
