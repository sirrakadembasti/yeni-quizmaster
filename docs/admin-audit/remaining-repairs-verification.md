# Kalan yönetici onarımları — doğrulama

1 Ekim 2026. Bu kayıt uygulanan onarımları ve tamamlanan doğrulama kapsamını açıklar; denenmeyen davranışları başarılı saymaz. [İlk denetim envanteri](./README.md), [sistem/ayarlar](./inventory-settings.md), [kişi/sınıf](./people.md), [sınav/rapor](./quizzes.md) ve [ikinci paket doğrulaması](./repair-verification.md) tarihsel kayıtlardır. Kabul edilen güncel davranışlar [onarım sözleşmelerindedir](./repair-contracts.md).

## Kapsam

Kalan onarımlar yönetici ekranları ve bunların API/storage sözleşmelerini kapsar: ilişkisel cache ve erişim, sorumlu öğretmen değişikliği, aktif öğrenci kapasitesi, arşiv adayları ve atomik arşiv/audit, gerekçeli atomik sınav silme, eski sınav/anket uçlarının soru ve yayın doğrulaması, log/geçmiş/arşiv sayfalaması, yükleme/hata/yeniden deneme durumları, bildirim görünürlüğü, kaydedilmemiş sunucu politikası koruması ve ilgili klavye kontrol adları/odak davranışları.

Sorumlu öğretmenin eski genel bağlantısı açık değişiklik sırasında kaldırılır; bağımsız ders atamaları ve diğer öğretmen ilişkileri korunur. Bu politika yeni bir bekleyen ürün kararı değildir. Arşiv içerik, sonuç yıl etiketi ve işlem kaydını birlikte tamamlamayı hedefler. Bu davranışların kaynakta bulunması tek başına API veya tarayıcı testinin geçtiğini kanıtlamaz.

## Güncel kesin kanıt

| Kontrol | Bu kayıt hazırlanırken durum |
|---|---|
| İstemci Vitest | **19 dosya, 117/117 test geçti.** Bu sayı yalnız tamamlanan istemci koşusuna aittir. |
| Sunucu thread koşusu | Prisma native Tokio paniği nedeniyle kesildi. Başarılı toplu sunucu doğrulaması sayılmaz. |
| Sunucu fork tekrarı | **31 dosya, 189/189 test geçti**, çıkış 0; 403,98 saniye. |
| Yeni yönetici E2E regresyonları | İlk koşu **7 geçti / 3 başarısız**; test seçicisi, yanlış hata enjeksiyonu adresi ve geç yükleme/fixture temizliği düzeltildi. İkinci koşu **10/10 geçti**, çıkış 0, 5 dakika. [Başarılı ham sonuç](./results-remaining-critical.json), [ilk koşu](./results-remaining-initial.json). |
| İstemci TypeScript | `pnpm --filter quiz-master-client type-check`, çıkış 0. |
| Sunucu TypeScript | `pnpm --filter quiz-master-server type-check`, çıkış 0. |
| Üretim derlemeleri | `pnpm run build`, çıkış 0. İstemci 3373 modül; 1462,78 kB JS (399,40 kB gzip). Mevcut büyük paket ve karma statik/dinamik import uyarıları sürer. |
| Üretim arayüzü Chromium toplu koşusu | **53 geçti / 2 başarısız**, 55 test, 20,2 dakika. İki başarısızlık test hazırlığı: boş sayfadan göreli fetch ve yanlış oturum çerezi adı. [Ham sonuç](./results-remaining-production.json). |
| Düzeltilmiş hedefli Chromium tekrarı | **4/4 geçti**, çıkış 0, 4 dakika: profil, yetkisiz/çerezi temizlenmiş oturum, ders CRUD ve sunucuda süresi dolan oturum. [Ham sonuç](./results-remaining-targeted.json). Böylece 55 benzersiz kontrol hedefli tekrarlarla geçti; bu, tek koşuda 55/55 sonucu değildir. |

Tarayıcı komutları: `pnpm exec playwright test --config playwright.admin-audit.config.ts` ve ardından `--grep 'profile state after save and navigation|unauthorized and expired sessions|management category create edit delete persists|expired server session'`. `PLAYWRIGHT_BROWSERS_PATH` yerel audit Chromium dizinine, `PW_TEST_SCREENSHOT_NO_FONTS_READY=1` olarak ayarlandı. Backend geçici SQLite başlatıcısıdır; son toplu koşuda arayüz `pnpm --filter quiz-master-client exec vite preview --config vite.admin-audit.config.ts --host 127.0.0.1 --port 5511 --strictPort` ile üretim derlemesinden servis edildi. Önceki geliştirme sunucusu koşuları soğuk yükleme ve eski navigasyondan kalan istek takibi nedeniyle kesildi; bunlar başarılı toplu koşu sayılmaz.

23 rota için güncel masaüstü/mobil görüntüler ve JSON ölçümleri [ayrı kanıt klasöründedir](./evidence/remaining-repairs/); eski kanıt dosyaları HEAD'den korunmuştur. 23 JSON'da JavaScript sayfa hatası 0, belge düzeyinde yatay taşma 0. DOM'un basit ad/etiket sayacı erişilebilirlik sertifikası değildir: label-for ile adlandırılmış switch'leri de aday olarak sayabilir. Özellikle sonuç/anket/ayar/sunucu alanlarının tam erişilebilir ad denetimi genişletilmiş UX planında kalır.

Komutlar: istemci için `pnpm --filter quiz-master-client exec vitest run --pool=threads --maxWorkers=1 --testTimeout=30000 --reporter=dot`; sunucu için `pnpm --filter quiz-master-server exec vitest run --pool=forks --maxWorkers=1 --reporter=dot`. Önceki paketlerin build ve Graphify sonuçları bu değişiklikler için yeniden kullanılamaz. Yeni koşular tamamlandığında komut, çıkış kodu, gerçek sonuç ve ortam hataları ayrı olarak kaydedilir.

## Sayfa ve sekme bazında onarım kapsamı

| Sayfa / sekme | Onarım ve mevcut doğrulama |
|---|---|
| Arşiv / Sınav Arşivi | Aynı aday koşulları, sunucudan güncel sayı, 20 kayıtlık geçmiş sayfalaması; sonuç/audit hatasında gerçek SQLite rollback API testleri; Chromium hata-tekrar-yenileme geçti. |
| Arşiv / Sınıf Atlatma | Kaynak/hedef doğrulaması, aktif öğrenci kapasitesi, başarısız aktarımda yıl etiketinin geri alınması; API testleri geçti. Chromium terfi/mezuniyet/yenileme kontrolleri geçti. |
| Sınıf ayrıntısı / sorumlu ve branş öğretmeni | Aktif öğretmen doğrulaması, eski genel erişimi kaldırma ve bağımsız dersi koruma; gerçek Prisma/API testleri geçti. Chromium erişim/kaldırma/yenileme kontrolü geçti. |
| Öğrenciler, Öğretmenler, Sınıflar, Veli Eşleştirme | Yükleme-hata-boş ayrımı, tekrar deneme, mutasyon hataları/pending, etiketli kontroller; kapasite ve ilişkiler API, gerçek bileşen testleri geçti. Chromium öğrenci/öğretmen oluşturma, veli bağla/kaldır, nakil ve yenileme geçti. |
| Yönetim / Dersler, Sınıflar, Kullanıcılar | Kaynak sorgusu hataları ve mutasyon durumları, adlı kontroller; gerçek bileşen testleri ve Chromium ekle/düzenle/iptal/sil/yenileme kontrolleri geçti. |
| Yönetim / Loglar: işlem, e-posta, parola, bildirim | Dört görünümde sunucu sayfalaması/toplam, filtre sonrası sayfa sıfırlama, hata/tekrar; parola görünümünde desteklenmeyen tarih filtresi gizli. Bileşen testleri geçti. |
| Sınav Yönetimi, Sınavlar | Gerekçeli atomik silme ve etki sayıları, yayın/soru doğrulaması, hata/tekrar, sayfa sınırları, arşiv etiketi, ortak cache; API ve bileşen testleri geçti. Chromium gerekçeli silme, audit ve yenileme kontrolü geçti. |
| Düzenleyici / ayarlar ve sorular | Ortak seçenek doğrulaması, boş/tekrarlı seçenek ve geçersiz doğru cevap reddi, adlı soru/ayar kontrolleri. API ve bileşen testleri geçti; Chromium kayıp yanıt sonrası tekrarın tek içerik/soru oluşturması ve yenileme geçti. |
| Sonuçlar, Sınıf İstatistikleri, Dashboard | Önceki atomik kayıt/sonuç/cache onarımları korundu; katılım ağırlığı ve karma içerik KPI etiketi düzeltildi. Toplu Vitest geçti; bu, bütün grafik/tarih kombinasyonlarının tarayıcı kanıtı değildir. |
| Ayarlar / Profil, Bildirimler, İşlem Geçmişi, Güvenlik | Profil oturum eşitleme, URL/geri geçmişi, gerçek createdAt tarihleri ve sunucudan sayfalama, hata/tekrar. Profil, sekme ve gerçek geçmiş Chromium kontrolleri geçti; parola ve her tercih kombinasyonu tekrar sınanmadı. |
| Duyurular | Hata/boş ayrımı, onay/iptal, başarısız silmede yeniden deneme; bileşen ve Chromium hata/iptal/tekrar/yenileme kontrolleri geçti. |
| Sunucu Durumu | Kaydedilmemiş taslağı yenilemede koruma, kaydedilen güncel politika ile temizlik, görünür ayrıntılı URL doğrulama hatası/sonuç sayıları; API ve bileşen testleri geçti. Taze hibrit kurulum kapsam dışı. |
| Ortak mobil menü/bildirimler | Modal odak tuzağı, Escape/odak geri verme, arka plan inert, görünür Sonner hatası. 390 px Chromium kontrolleri geçti. |

## Graphify kanıtı

`graphify update .` geçici yardımcılar kaldırıldıktan sonra tekrar çalıştırıldı: **2027 düğüm, 5705 kenar, 109 topluluk**. `graphify diagnose multigraph --graph graphify-out/graph.json` çıkış0; eksik/sarkan uç0, yinelenen kenar0, self-loop2. Geçici staging yardımcı dosyası grafikte yok. Yerel HTML haritasında gerçek Chromium canvas'ı, `archiveQuizzesAndResults` aramasının bir sonuç bulması ve düğüm seçimi doğrulandı; [ekran görüntüsü](./evidence/remaining-repairs/graphify-archive.png). 14 SQL dosyası için `tree_sitter_sql` yok; Markdown/görsel semantik LLM çıkarımı yapılmadı. AST haritası çalışma zamanı yetki ve transaction testlerinin yerine geçmez.

## Önceliklendirilmiş geliştirme planı

Doğrulanmış veri bütünlüğü ve erişim hataları (INV04, PE03/PE04/PE05, Q07/Q08) yüksek faydalı, orta-yüksek eforlu kod onarımlarıdır. Log/geçmiş sayfalaması, sorgu hata durumları, profil/sekme düzeltmeleri ve saklama politikası koruması (INV01–INV13, PE06) yüksek faydalı, orta eforlu onarımlardır. Kontrol adları/odak ve karma içerik etiketi (PE07, Q13/Q14) kullanıcı deneyimi iyileştirmeleridir; bunlar da kodda uygulanmıştır, kabul kapsamları yukarıdadır.

Öğretmen paneline geçmeden admin tarafındaki export dosya içerikleri/yazdırma, ekran okuyucu/klavye ve taze terminal/BAT/SH/web kurulum kontrolleri tamamlanmalı veya erişim engelleri açıkça kaydedilmelidir. Bu ek çalışmanın güncel durumu [kalan doğrulamalar ve düzeltmeler raporundadır](verification-closure.md); aşağıdaki denenmeyen alanlar önceki onarım koşusunun tarihsel sınırlarıdır. Gerçek zaman TTL geçişi ayrıca sınanmalıdır. Mevcut 1462,78 kB istemci paketinin ölçüm ve bölümlenmesi (orta fayda/orta-yüksek efor) ayrıca değerlendirilmelidir. Veli hedefli duyuru ayrı bir **yeni özellik önerisidir**; hata olarak kapatılmadı ve uygulanmadı. Eski genel öğretmen bağlarının toplu temizliği, bağ kaynağı veride bulunmadığı için yapılmadı; bu onarım yalnız açık sorumlu değiştir/kaldır işlemlerine uygulanır.

## Denenmeyen davranışlar

- CSV indirme dosyalarının içerik/görsel doğrulaması ve gerçek yazdırma çıktısı bu kalan onarım doğrulamasında denenmedi. Kaynakta export/yazdırma bulunması başarı sayılmaz.
- Ekran okuyucu ile duyuru/etiket okuma, eksiksiz klavye tab sırası ve bütün mobil görünümler doğrulanmadı. Hedefli bileşen kontrolleri bu kapsamın yerine geçmez.
- TTL/saklama sürelerinin gerçek zaman geçişiyle uçtan uca davranışı ve üretim verisi üzerinde kalıcı temizlik denenmedi. Kaydedilmiş politika koruması veya birim testi gerçek TTL geçişini kanıtlamaz.
- Hibrit terminal, `kurulum.bat`, `kurulum.sh` ve yerel web sihirbazıyla taze kurulum uçtan uca denenmedi. Çalışan sunucunun ayar ekranının sınanması taze kurulum kanıtı değildir.
- Güncel rota ve CRUD tekrarları yukarıdaki kapsamda geçti. Rota kabuğu açılışı bütün veri/filtre kombinasyonlarını, Gmail gönderim/yenileme/iptal işlemlerini veya her log alt işlemini test etmiş sayılmaz; log sayfalaması gerçek bileşen testlerinde doğrulandı.
- Sunucu oturum kaydının son kullanma zamanı yalnız ilgili test oturumu için geçmişe alındı; çerez korunurken API401 ve giriş ekranına dönüş geçti. Gerçek 24 saatlik süre beklenmedi. Giriş formunun kendisinden başarılı/başarısız parola gönderimi bu onarım koşusunda yeniden sınanmadı.
- Öğretmen paneli denetimi henüz başlamadı. Yönetici hesabından öğretmen ilişkilerini yönetmek ayrı öğretmen paneli denetimi değildir; öğrenci ve veli panelleri de bu raporun kapsamı dışındadır.

Doğrulama izole test veritabanı ve ayrı 5510/5511 sunucusunda yapıldı. Gerçek `server/data/quiz.db` parmak izi yeniden okundu: SHA-256 `8210a4b79f2cfb9cf74de6a4989f5c8a5449ba1d17b2332abdbd018c3741a158`, 348160 bayt, `mtime=1790766759.5147812`; üç değer de başlangıçla aynı. Test başlatıcı/guard üretim veritabanını hedeflemez.

Koşular kullanıcının önceden var olan `api.ts` localhost tipi ve `server-setup.tsx` localhost arayüz düzenlemelerini içeren çalışma ağacında yapıldı. Bu iki özgün değişiklik korunur ve onarım commit'ine dahil edilmez. Dolayısıyla çalışma ağacı kanıtı, yalnız commit'in temiz bir checkout'unda aynı localhost UI'nin bulunduğu iddiası değildir. Admin rota/kişi testlerinde oturum API ile kurulur; burada oturum açma formunun kendisi yeniden sınanmış sayılmaz.
