# Yönetici doğrulama kapanışı uygulama planı

> **Tarihsel plan/tasarım kaydı.** 14 Ekim 2026 belge kontrolü: gelecek zaman, açık kutular ve ara sonuçlar özgün çalışma sırasını korur; güncel yapılacaklar olarak okunmamalıdır. [Sonuç ve kapsam kaydı](../../admin-audit/verification-closure.md) esas alınır.

> **Ajan olarak çalışanlar için:** Bu planı bağımsız görevlendirilmiş incelemeler ve seri çalışan doğrulama araçlarıyla görev görev uygula.

**Amaç:** Öğretmen paneli denetimine başlamadan önce kalan yönetici dışa aktarımlarını, yazdırmayı, erişilebilirliği ve taze hibrit kurulumu doğrulamak.

**Mimari:** Tarayıcı testleri izole denetim çalışma ortamını kullanır. Üretilen kimlik bilgileri, dağıtım yapılandırması ve SQLite dosyalarının çalışan kurulumu hedefleyememesi için taze kurulum ayrı proje dizininde çalışmalıdır. Erişilebilirlik ağacı ve baskı görüntüleme kanıtları fiziksel ekran okuyucu ve yazıcı erişiminden ayrı raporlanır.

**Teknolojiler:** Playwright Chromium, Node test çalıştırıcısı, OOXML, pnpm, Windows BAT ve Bash SH başlatıcıları.

## Genel kısıtlar

- client/src/lib/api.ts ve client/src/pages/server-setup.tsx içindeki mevcut kullanıcı değişikliklerini koru.
- server/data/quiz.db veya gerçek kurulum sırlarını/yapılandırmasını asla değiştirme.
- Tarayıcı, kurulum, derleme ve Graphify çalıştırıcılarını seri çalıştır.
- Kullanılamayan veya çalıştırılmayan kontrolleri geçti sayma; yönetici kapsamında kal.

## Dışa aktarım ve yazdırma doğrulaması

- [x] Her yönetici dışa aktarım ve yazdırma giriş noktasını belirle.
- [x] Gerçek indirilen içerik doğrulamaları ve baskı ortamı/yerleşim kanıtlarıyla tests-e2e/admin-export-print.spec.ts ekle.
- [x] Yeni senaryoyu izole verilerle çalıştır; adlandırılmış sonuçları ve çıktıları sakla.
- [x] Başarısızlıkları araştır ve regresyon testli düzeltmeler uygula; son üretim dışa aktarım/yazdırma turu, 21 sınavlık PDF'deki tam metin dahil 16/16 geçti.

## Erişilebilirlik doğrulaması

**Kapsam kararı, 3 Ekim 2026:** Kullanıcı gerçek sesli ekran okuyucu kullanımını güncel yönetici kabulünden çıkardı. Mevcut ARIA etiketleri, hesaplanan ad, klavye ve odak kontrolleri zorunlu kalır. Tarihsel Narrator denemesi doğrulanmamış kalır ve başarılı sayılmaz. Elle ekran okuyucu kabulü veya ekran okuyucuyla ilgili bekletme kalmamıştır. Son taze hibrit kabul 3/3 geçti; öğretmen paneli çalışması başlamadı.

- [x] Kullanılabilir ekran okuyucu erişimini ve tarayıcı erişilebilirlik kontrollerini belirle.
- [x] Adlandırılmış kontroller, klavye odağı ve sekme akışları için tests-e2e/admin-accessibility-closure.spec.ts ekle.
- [x] İlk tam senaryoyu (47/53) çalıştır; sayfaya özel bulguları incele ve gerçek ekran okuyucu kapsamını otomatik kanıtlardan ayır.
- [x] Doğrulanan hataları odaklı regresyonlarla onar ve 53 üretim tarayıcı senaryosunun tamamını yeniden kontrol et; gerçek ekran okuyucu kapsamı açıkça kullanılamaz durumda kalır.

## Taze hibrit kurulum

**Son durum, 3 Ekim 2026:** İkinci tam BAT turu çıkış 0 ile geçti; 13:07:32.905–13:14:43.008 UTC. Gerçek kurulum/derlemeler/14 migration, yönetici/kalıcılık/yeniden giriş, üretim API/Vite arayüz girişi ve korunan kaynak özetleri değişmeden doğrulanan temizlik dahildir. Tarihsel kabul toplamları: BAT 1/2, terminal 1/10, Git SH 1/2. Dokuzuncu terminal denemesi bütün ürün aşamalarını geçti ancak önceki PID-sıfır anlık görüntüsünü kullanırken temizlikte başarısız oldu; tam kabulü başarısız kalır. İkinci tam Git SH turu çıkış 0 ile, 13:59:05.376–14:09:50.009 UTC aralığında geçti; kurulum/sihirbaz/API/Vite arayüz girişi, temizlik ve korunan özetler doğrulandı. [SH tam başarı](../../admin-audit/evidence/closure/hybrid/sh-second-passed/result.json). Onuncu tam terminal turu çıkış 0 ile, 14:10:59.825–14:16:26.729 UTC aralığında geçti: sihirbaz/API/Vite yönetici girişi, temizlik ve korunan özetler doğrulandı. [Terminal tam başarı](../../admin-audit/evidence/closure/hybrid/terminal-tenth-passed/result.json). Son aynı kodla terminal/BAT/Git SH kabulü 3/3; tarihsel başarısızlıklar korunur. Git SH, Linux/WSL kanıtı değildir.
Gerçek CIM, tek geçersiz anlık görüntü satırı olarak System Idle PID 0'ı ayırdı; düzeltme yalnız sayısal sıfırı dışlar ve belirsizlikte reddeden pozitif kimlik kontrollerini korur.
Koşulsuz tanıtıcı serbest bırakma, süreç durdurma kanıtından ayrıdır. Odaklı VM ve tanıtıcı testleri RED 7 başarılı/3 başarısız → GREEN 10/10 (543.600 → 463.488 ms); taze kurulum kanıtı değildir. [Tekrar deneme kanıtı](../../admin-audit/evidence/closure/hybrid/retry-2026-10-03-process-cleanup.json) ve [BAT tam başarı](../../admin-audit/evidence/closure/hybrid/bat-second-passed/result.json).

- [x] Terminal, BAT/SH ve web sihirbazı önkoşullarını ve izolasyon sınırlarını incele.
- [x] Üretim DB'si veya kimlik bilgileri olmadan taze geçici proje hazırla.
- [x] Terminal, BAT ve Git SH başlatıcılarını gerçek sihirbaz ve API/arayüz girişiyle çalıştır; son aynı kodlu matris 3/3 geçti; Linux/WSL doğrulanan kapsamın dışında kalır.
- [x] Üretilen ayarları, kalıcılığı, yeniden giriş korumalarını ve sahip olunan süreçlerin temizliğini kontrol et; son üç turun tamamı korunan kaynak özetleri değişmeden geçti.

**Gerçek matris, 2 Ekim 2026:** Terminal sekiz, BAT bir, Git SH bir izole tam deneme tamamladı; tam kabul **0/8, 0/1, 0/1**. Yedinci terminal denemesi, BAT ve SH gerçek kurulumu, iki derlemeyi, migration/ilk yöneticiyi, üretilen config/env/lock dosyalarını ve kalıcı ayarlar/yeniden giriş korumalarını tamamladı. BAT ayrıca üretim API yönetici girişini geçti; ardından gerçek arayüz `/auth` DOM gezinmesi 30 saniyede başarısız oldu. SH, API/arayüz girişinden önce API açılışının tek kontrol sınırında başarısız oldu. BAT/SH temizliği doğrulanmamış kaldı ve kaynak korunan dosya özetleri değişmedi. [Korunan sonuçlar ve aşama kanıtları](../../admin-audit/hybrid-setup-closure.md), geçen bu aşamaları başarısız tam kabulden ayırır.

2 Ekim'deki tekrar denememe kararı tarihseldir. 3 Ekim'de koordinatör Windows test düzeneği üstverilerini araştırdı ve gerçek terminal/BAT/Git SH kurulum tekrarlarını tamamladı. Öngörülen 120 saniyelik taze giriş gezinme bütçesine kayıtlı SH turunda ulaşılmadı; bu süre herhangi bir başarı veya performans onarımı kanıtlamaz. Son aynı kodlu hibrit matris artık 3/3 geçti; bu kabul bekletmesi çözüldü, öğretmen paneli çalışması başlamadı. Gerçek ekran okuyucu sesi/etkileşimi tarihsel olarak doğrulanmamış kalır ve yukarıdaki kullanıcı kararıyla güncel kabulden çıkarılmıştır. Git SH, Linux/WSL kanıtı değildir. Taze kurulum kutuları tarihsel kısmi turlar üzerinden değil, son üç API/arayüz ve temizlik başarısı üzerinden tamamlandı.

## Entegrasyon ve rapor

Doğrulanan matrisin sınırları: kontrollü `--no-open` ile Windows terminal/BAT/Git SH; yerel Linux/WSL, varsayılan işletim sistemi tarayıcı açıcısı, sihirbaz geliştirme başlatma düğmesi, fiziksel yazıcı, gerçek masaüstü Excel ve SMTP teslimi bu kanıtın dışında kalır. Ekran okuyucu gereksinimi kullanıcı tarafından kapsamdan çıkarıldı; geçti sayılmadı. Öğretmen paneli denetimi başlamadı.

- [x] README ve ilgili yönetici/kurulum belgelerini kanıtlarla ve açık sınırlarla güncelle.
- [x] Değişen kod için uygun kontrolleri çalıştır ve değişiklikleri bağımsız incele; başarısız birleşik turu geçen odaklı tekrar denemeden ayrı sakla.
- [x] Graphify'ı güncelle, üretilen çıktıları tanıla ve gerçek tarayıcı grafik/arama/bilgi panelini doğrula.
- [x] Commit öncesinde son üretim DB parmak izini doğrula: SHA256 8210a4b79f2cfb9cf74de6a4989f5c8a5449ba1d17b2332abdbd018c3741a158, değişmedi.
- [x] Bu çalışmaya ait dosyaların açık commit listesini hazırla ve kullanıcının hazırlama alanına alınmamış API/localhost kurulum düzenlemelerini koru; oluşan commit'i ayrı raporla.

Güncel entegrasyon durumu: tamamlanan birleşik Node turunda 31 test vardı; 30 başarılı/1 başarısız, çıkış 1, toplam 108.821 saniye. Açılış senaryosu 50.352 saniye sürdü: yerel PNG geçti ancak 30 saniyelik API süresinde CSRF gelmedi; yaşam döngüsü spawned=true/exited=false/closed=false ve yalnız pnpm çağrısı çıktısı uygulama kaynaklı neden kanıtlamaz. Önceki kesilen birleşik tur EKSİK kalır (2 başarılı/1 başarısız, kalanı çalıştırılmadı, Ctrl+C çıkış1; açılış110.48s). Önceki açılış1/1başarılı17.84s ve gerçek BAT API/giriş başarısı ayrı kanıtlar olarak kalır. Yalnız testlere ait finally/pipe-unref/stop-proof test ortamı temizliği RED0/3→GREEN3/3 ve hata çıktısı koruması RED3başarılı1başarısız767.411ms→GREEN4/4 462.748ms sahipliği korur ve hassas hata çıktısını bastırır. Ayrı son yalnız yerel tur 1/1 geçti, çıkış0, test71.9360927s/toplam72.6083536s; API süresi30s yerine120s, yerel PNG/CSRF/dosya doğrulamaları değişmedi. Komut: pnpm exec node --test --test-concurrency=1 scripts/server-build-startup.test.mjs; CHECKPOINT_DISABLE=1 ile. Bu, birleşik30/31 turunu31/31 yapmaz; performans/taze kurulum iddiası değildir. Graphify update/diagnose ve gerçek görsel kontroller aşağıdaki kayda göre tamamlandı; son DB parmak izi değişmedi; commit ayrı raporlanır. Önceki tekrar denememe kararı tarihseldir; gerçek terminal/BAT/Git SH tekrarları 3 Ekim 2026'da son aynı kodlu kabul 3/3 ile tamamlandı.

**Graphify, 3 Ekim 2026:** update/diagnose çıkış 0; 2206 düğüm, 6030 kenar, 114 topluluk, üretilen grafikte 0 eksik/boşta/tam yinelenen/doğrulanmamış kayıt ve 3 kendine döngü. Gerçek CDN/Chromium görsel turu çıkış 0: görünür tuval, eşleşen grafik sayıları, arayüz aramasıyla seçilen `deploySetupDatabase()` kaynağı ve derece 6, sayfa/konsol/istek hatası yok, sahip olunan tarayıcı/sunucu kapandı.
[Kalıcı güncelleme/tanılama sınırları](../../admin-audit/evidence/closure/graphify/graph-update-diagnostic.json) ve [gerçek görsel sonuç](../../admin-audit/evidence/closure/graphify/result.json) uygulama/taze kurulum kabulünden ayrı kalır. Yerel AST, 14 SQL dosyasını ve PDF metnini atladı; LLM anlamsal yenileme/yeniden etiketleme çalışmadı. Çalışma ağacındaki kullanıcı localhost düzenlemeleri haritaya dahil edildi ancak bu çalışmanın commit'i dışında kalır. Commit öncesi `built_at_commit` 5b83a1163e6a49d7d2c392350813823d2e91172f tek başına güncellik kanıtı değildir. Oluşan commit, üretim zamanı kanıtlarına gömülmek yerine Git ve son yanıtla belirtilir.
