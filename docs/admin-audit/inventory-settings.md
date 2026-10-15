# Yönetici denetimi: rota envanteri, yönetim, ayarlar, sunucu, arşiv, duyurular

> **Tarihsel denetim anlık görüntüsü (30 Eylül 2026).** Aşağıdaki bulgular, kaynak satırı referansları ve açık durum ifadeleri güncel ağacı değil, ilk denetimi ve önceki onarım notlarını anlatır. Kabul edilen davranış için [onarım sözleşmelerine](./repair-contracts.md), güncel kanıt ve sınırlar için [kalan onarımların doğrulamasına](./remaining-repairs-verification.md) bakın. Güncel doğrulanmış istemci sonucu: 19 dosya, 117/117 test. Sunucunun thread koşusu Prisma native Tokio paniğiyle karşılaştı; fork tekrarı sürüyor. Yeni E2E kontrolleri çalıştırılmadı. Öğretmen paneli denetimi başlamadı.

Tarih: 2026-09-30. Yöntem: güncel çalışma ağacının salt okunur kaynak incelemesi. Bu belge tarayıcı çalıştırılması veya veritabanı değişikliği iddia etmez. `client/src/lib/api.ts` ve `client/src/pages/server-setup.tsx` dosyalarındaki mevcut değişiklikler incelendi, ancak korundu. Kontrol edilen depo/client/src/pages/docs üst dizinlerinde AGENTS.md bulunmadı.

## Tam yönetici rota envanteri

Rota kaydı: `client/src/App.tsx:82-127`. Yan menü: `client/src/components/layout/DashboardLayout.tsx:120-153`.

| Yönetici yan menü etiketi | Rota | Yönetici erişimi |
|---|---|---|
| Dashboard | `/` | Oturum açılmış ana sayfa DashboardPage gösterir |
| Sınav Yönetimi | `/admin-quizzes` | Yalnız yönetici |
| Sınavlar | `/quizzes` | Öğretmen + yönetici |
| Sınıf İstatistikleri | `/statistics` | Öğretmen + yönetici |
| Sınav Sonuçları | `/results` | Öğretmen + yönetici |
| Anket Yönetimi | `/survey-results` | Öğretmen + yönetici |
| Öğrenciler | `/students` | Öğretmen + yönetici |
| Öğretmenler | `/teachers` | Yalnız yönetici |
| Veli Eşleştirme | `/guardian-management` | Yalnız yönetici |
| Sınıflar | `/classlist` | Öğretmen + yönetici |
| Yönetim | `/management` | Yalnız yönetici |
| Arşiv | `/archive` | Yalnız yönetici |
| Sunucu Durumu | `/server-setup` | Yalnız yönetici |
| Duyurular | `/announcements` | Oturum açmış tüm roller |
| Ayarlar | `/settings` | Oturum açmış tüm roller |

Kapsanması gereken, yöneticinin erişebildiği ek rotalar: `/create-quiz`, `/quizzes/:id`, `/classes/:id`, `/admin/classes/:id`, `/teachers/:id`, `/student/quiz/:quizId`, `/student/result/:resultId`, `/student/results`. Herkese açık `/auth`, oturum açmış yöneticiyi `/` yoluna yönlendirir; `/reset-password` herkese açık kalır. Eski `/student-quizzes/:quizId`, `/student/quiz/:quizId` yoluna yönlenir. Yalnız öğrenci/veliye açık rotalar bilinçli olarak yönetici kapsamı dışındadır.

## Sekme envanteri

| Sayfa | Sekmeler / alt sekmeler | Kaynak |
|---|---|---|
| Yönetim | Dersler (`categories`), Sınıflar (`classes`), Kullanıcılar (`users`), Loglar (`logs`) | admin-management.tsx:395-398 |
| Yönetim / Kullanıcılar | Tümü, Yöneticiler, Öğretmenler, Öğrenciler, Veliler | admin-management.tsx:548-552 |
| Yönetim / Loglar | Kullanıcı Logları, E-Posta Logları, Şifre Talepleri, Sistem Hata & İşlemleri (düğmelerle denetlenen alt görünümler) | admin-management.tsx:624-657 |
| Ayarlar | Profil, Bildirimler, İşlem Geçmişi, Güvenlik | settings.tsx:223-234 |
| Arşiv | Sınav Arşivi, Sınıf Atlatma | admin/archive.tsx:108-109 |
| Sınav Sonuçları | Genel Bakış (`overview`), Raporlar (`reports`, koşullu) | results.tsx:265-271 |
| Sınav oluştur/düzenle | Sınav Ayarları (`settings`), Sorular (`questions`) | create-quiz.tsx:347-354 |
| Anket Yönetimi | Sonuçlar, Anket Oluştur | survey-results.tsx:283-284 |
| Öğrenci sonuçları (yönetici erişebilir) | Sınavlar (`exams`), Öğrenci (`student`), Veli (`parent`) | student-results.tsx:411-419 |

Duyurular ve sunucu durumunda sekmeler yerine kartlar/formlar bulunur. Dashboard, öğretmen, sınıf, kişi ve sınav bulguları tamamlayıcı denetim raporlarındadır.

## Doğrulanmış kod kusurları ve kabul kriterleri

### INV-01 — P2: başarılı profil kaydı yönetici kimliğini eski bırakıyor

Kanıt: `settings.tsx:171-174`, `authApi.updateProfile(formData)` çağırır ve ardından `['/api/auth/me']` sorgusunu geçersiz kılar. `auth-context.tsx:22-24` kullanıcıyı React durumunda saklar; `auth-context.tsx:43-45` ilk sorgusu yalnız bileşen bağlanırken çalışır. Bağlam login/register/logout sunar; refresh/updateUser veya React Query aboneliği yoktur (`auth-context.tsx:9-18`, `:108-118`). `settings.tsx:139-159`, formu bu değişmeyen kullanıcıdan yeniden doldurur ve kaydedilmemiş değişiklik durumunu hesaplar.

Geçici veride yeniden üretim: yönetici profil adını değiştirip başarıyla kaydedin; üst başlığı ve kayıt düğmesinin değişiklik durumunu inceleyin; başka sayfaya gidip geri dönün. Üst başlık/bağlam eski adı tutar, kayıt durumu değişmiş kalır; yeniden ziyaret, sunucuda kalıcı veri olmasına rağmen eski değerleri geri getirebilir. Tam yeniden yükleme sorunu gizler.

Kabul: dönen/yeniden sorgulanan kullanıcı kimlik doğrulama bağlamını hemen günceller; üst başlık ve profil alanları kalıcı adı gösterir, değişiklik durumu temizlenir, gezinmede korunur ve çevrimdışı kullanıcı önbelleği eşitlenir.

### INV-02 — P2: yönetim günlük geçmişi sessizce ilk sayfada duruyor

Kanıt: `admin-management.tsx:158-198`, kullanıcı, e-posta, sıfırlama ve sistem günlüğü sorgularına page/limit olmadan filtre verir; görüntüleyiciler dönen dizileri sonraki/önceki kontrolleri olmadan işler (`:731`, `:794`, `:902`, `:1022`). API'ler sayfalama destekler; varsayılanları 100 kullanıcı/e-posta/sistem kaydı (`server/api-routes/admin.ts:133`, `:158`, `:237`) ve 50 sıfırlama isteğidir (`:73-75`). Yanıttaki totalPages sayfa tarafından yok sayılır. Sayılar geçerli dizi uzunluğu olarak gösterilir.

Yeniden üretim: eşleşen 101 günlük satırı veya 51 sıfırlama isteği olan test verisi kullanın; tüm zamanları ve hepsini eşleştiren filtreyi seçin. Filtre daraltılmadan/API erişimi olmadan eski satıra ulaşılamaz. Ortak tarih filtresi tüm günlük alt görünümlerinin üzerinde gösterilmesine (`:666-684`) rağmen parola sıfırlama isteklerini de etkilemez (`admin-management.tsx:183-186`).

Kabul: sayfalama veya daha fazla yükleme tüm eşleşen satırlara eriştirir, toplam/sayfa bilgisini gösterir ve filtre değişince sayfayı sıfırlar; tarih filtresi tutarlı desteklenir veya sıfırlama istekleri için gizlenir.

### INV-03 — P2: arşiv geçmişi 20 kayıtla kesin sınırlandırılmış

Kanıt: `client/src/pages/admin/archive.tsx:189`, arşivlenmiş sınavlara `.slice(0, 20)` uygular. Arama, eğitim yılı filtresi, sayfalama veya ayrıntı bağlantısı yoktur. Özet, tablodan erişilebilenden fazla arşivlenmiş sınav bildirebilir.

Yeniden üretim: 21 arşivlenmiş sınav içeren test verisi; 21. satır yoktur ve erişilemez.

Kabul: her arşivlenmiş sınav sayfalama/yıl/arama yoluyla bulunabilir; görünür sayı ve toplam ayrılır; amaçlanan yerlerde salt okunur ayrıntı bağlantısı bulunur.

### INV-04 — P1: toplu arşiv işlemi kısmen kalıcılaşabiliyor

Kanıt: `server/storage.ts:1456-1465`, transaction dışında önce sınav updateMany, sonra sonuç updateMany işlemi yapar. İkinci yazma başarısız olursa sınavlar arşivlenirken sonuçların academicYear değeri null kalır; API başarısızlık bildirir (`server/api-routes/admin.ts:278-291`). Bu doğrulanmış atomik olmayan kod yoludur; gerçek veritabanı hatası enjekte edilmedi.

Kabul: iki güncelleme ve temel denetim kaydı atomik yapılır veya kurtarma/tekrar güvenliği açıkça tanımlanır; sonuç güncelleme hatası enjekte eden test kısmi arşiv kalmadığını doğrular.

### INV-05 — P2: arşiv önizlemesi ve veri değişikliği farklı kayıtları seçiyor

Kanıt: arayüz aktif sayı için `status !== 'archived'` kullanır (`admin/archive.tsx:42`) ve tüm aktif sınavların kilitleneceğini söyler (`:129`, `:279`). Depolama, durum filtresi olmadan `academicYear: null` seçer (`server/storage.ts:1458`). academicYear değeri olan arşivlenmemiş sınav sayılır ama değişmez; academicYear değeri null olan arşivlenmiş sınav sayımdan dışlansa da değişikliğe dahil edilir. Bu, böyle kayıtların varlığına bağlıdır; güncel veri hakkında iddia değildir.

Kabul: sunucu değişiklikle aynı seçimi kullanarak kesin aday sayılarını sağlar, onay bunları kullanır; durum/yıl tutarlılığı zorunlu kılınır veya migration tutarsız tarihsel satırları düzeltir.

### INV-06 — P2: duyuru hemen siliniyor ve hatalar sessiz kalıyor

Kanıt: `announcements.tsx:154`, çöp kutusu simgesinden doğrudan deleteMutation çağırır; silme işlemi (`:91-97`) yalnız başarıyı işler; onay, bekleyen işlem koruması, geri alma veya onError yoktur. API silmesi kalıcıdır (`server/api-routes/announcement.ts:103-110`).

Veri değiştirmeden yeniden üretim: çöp kutusu işleyicisini ve eksik onayı inceleyin; geçici test verisinde varsayımsal silmeyi iptal etmek mümkün değildir. Hata deneyimi için DELETE isteğini engelleyin: satır kalır ama hata/tekrar mesajı verilmez.

Kabul: onay duyurunun adını belirtir ve iptal destekler; işlem tekrarlı gönderimi kapatır; başarısızlık yapılabilir bir eylem sunan hata gösterir; başarılı silme listeyi günceller. Arka uç destekliyorsa geri alma mekanizması onayın yerine geçebilir.

### INV-07 — P2: istek hataları boş/varsayılan içerik olarak sunuluyor

Kanıt: duyurular yalnız data/isLoading alır (`announcements.tsx:64-67`), boş listeyi varsayılan yapar (`:99`) ve 'Henüz bir duyuru...' gösterir (`:137-144`). Arşiv sorguları (`admin/archive.tsx:29-40`) boş dizilere döner, hata durumu olmadan sıfır sayıları gösterir; arşivleme hâlâ sunulur. Yönetim günlük görüntüleyicileri de yalnız yükleme/boş dallarına sahiptir. Sunucu durumu ilk status GET başarısızlığında isError arayüzü olmadan örnek emptyConfig (`server-setup.tsx:15-28`, `:63-64`), `changesAllowed=false` ve boş algılanan kartlar kullanır.

Yeniden üretim: ilgili GET isteğini engelleyip tekrarları bekleyin. Kesinti, yükleme hatası yerine sıfır kayıt/varsayılan yapılandırma gibi görünür. Güncel kaynak gerçek salt okunur sunucu politikasını başarısız durum sorgusundan ayırmaz.

Kabul: açık yükleme/hata/boş/başarı durumları; tekrar kontrolü ve yararlı hata metni; kesin adaylar yüklenene kadar yıkıcı arşivleme kapalı; örnek değerler algılanmış yapılandırma gibi sunulmaz.

### INV-08 — P2: sunucu yenilemesi kaydedilmemiş değişiklikleri kaybedebiliyor; saklama işlemi görünen taslağı değil kayıtlı politikayı kullanıyor

Kanıt: durum verisi etkisi her yeni sorgu sonucunda form ve kaynakları ezer (`server-setup.tsx:72-76`); `:135` manuel sorgusunda değişiklik koruması yoktur. Saklama düğmesi yerel `form.retention.enabled` ile etkinleşir (`:203`), ancak `runRetention` taslak göndermez (`:117-123`); `server/api-routes/deployment.ts`, kayıtlı yapılandırmayla runDataRetention çağırır. Görünen kaydedilmemiş günler gerçek silme politikasından farklı olabilir; kayıtlı politika kapalıyken yerelde etkinleştirmek 409 üretir.

Salt okunur incelemede yeniden üretim: alanı düzenleyip Sunucuyu Yeniden Algıla düğmesine basın; başarılı sorguda değerler değiştirilir. Çalışma zamanı değişiklikleri açık geçici ortamda saklama günlerini kaydetmeden düzenleyin, çalıştırma POST isteğini inceleyin: görünen değerler gönderilmez.

Kabul: kaydedilmemiş değişiklikler korunur veya yenilemeden önce uyarılır; 'Şimdi Temizle' kayıtlı ve değişmemiş politika gerektirir, onay kalıcı eşikleri gösterir; başarılı işlem kayıt türüne göre silme sayılarını gösterir.

### INV-09 — P2: sunucu/üst başlık bildirim çağrılarının bağlı görüntüleyicisi yok

Kanıt: `server-setup.tsx:13` ve `DashboardLayout.tsx:53`, toast öğesini `sonner` içinden alır; sunucunun kopyalama/kaydetme/çalıştırma işleyicileri toast.success/error çağırır (`server-setup.tsx:49`, `:81-90`, `:99-119`). `NotificationListener.tsx:4` da Sonner kullanır. `App.tsx:5`, farklı Radix görüntüleyicisini `components/ui/toaster` içinden alıp `:255` satırında bağlar. `main.tsx:7-11` yalnız App gösterir. Tam istemci kaynak taraması, `components/ui/sonner.tsx` içinde Sonner görüntüleyicisini buldu, ancak bileşenin içe aktarımı/bağlanması yoktu. Bu nedenle Sonner olaylarının görünür bildirim alanı yoktur. Sunucu doğrulama ve istek hataları ile gerçek zamanlı bildirim geri bildirimi gizlenebilir.

Kabul: Sonner görüntüleyicisi bağlanır veya tüm çağıranlar etkin bildirim mekanizmasında birleştirilir; kopyalama, doğrulama, başarısız durum değişikliği, bildirim susturma/silme hatası ve gerçek zamanlı duyuru alımı için görünür başarı/hata mesajları doğrulanır.

### INV-10 — P2: kişisel ayarlar geçmişi altı aylık eksiksizlik iddiasıyla çelişiyor

Kanıt: `settings.tsx:78-88`, getLogsMe sorgusunu sayfalamasız yapar ve dönen satırları yerelde altı ayla filtreler. `server/api-routes/admin.ts:14-25`, en yeni 50 kaydı varsayılan alır ve sayfalama döndürür; `api.ts:1033-1037` sayfalama sözleşmesini atar. `settings.tsx:523` son altı aydaki tüm sistem işlemlerini vaat eder, ancak sonraki sayfa kontrolü yoktur. Kişisel sayfa altı aylık aralıktan bağımsız yalnız 50 kayıt alıp filtrelediğinden INV-02'den ayrılır.

Kabul: gerçek altı aylık aralık sunucu tarafında sayfalamayla sorgulanır; eşleşen her satıra erişilir ve toplam/sayfa bilgisi gösterilir. Altı ayda 51 işlem içeren test verisi en eski işlemi de göstermelidir.

## Hedefli doğrulama gerektiren ek riskler

- Sınıf atlatma academicYear göndermez (`api.ts:1048-1053`); arka uç sınıf değişmeden önce tamamlanmış sonuçlara yıl etiketi eklemeyi destekler (`storage.ts:1478-1479`). Atlatmadan önce arşivlemenin zorunlu iş kuralı olup olmadığını doğrulayın; aksi halde tarihsel sonuçlar yeni sınıf altında görünebilir. Denetimde gerçek öğrencileri atlatmayın.
- Sınıf atlatma ve arşiv onay düğmeleri işlemleri beklerken kapatılmaz (`admin/archive.tsx:284`, `:317-320`); tekrarlı arşiv istekleri mükerrer denetim günlüğü oluşturabilir, tekrarlı atlatma çoğunlukla ikinci sefer sıfır bildirir. Tıklama/hata davranışını geçici test verileriyle doğrulayın.
- Arşiv/sunucu/duyuru formlarında etiketler sıkça htmlFor, alanlar ids içermez; yalnız simgeli kategori düzenle/sil ve kullanıcı düzenle/sil düğmelerinde erişilebilir ad yoktur (`admin-management.tsx:444-447`, `:600-603`). Erişilebilir adları tarayıcı DOM'u ve klavye/ekran okuyucu kontrolleriyle doğrulayın. Yönetim kategori/sınıf/kullanıcı silmelerinde ön onay vardır.
- `settings.tsx:135-138`, izin listesi olmadan her sorgu dizesi `tab` değerini kabul eder. `/settings?tab=unknown` hiçbir paneli etkinleştirmez. Kabul: desteklenmeyen sekme profile döner; geçerli doğrudan bağlantılar istenen sekmeyi açar ve geri/ileri davranışı tutarlıdır.
- Yönetim günlüğü alt sekmeleri normal düğmelerdir; özellikle dört düğme ve tarih filtresi için mobil yatay taşmayı ve odak sırasını doğrulayın.
- Duyuru hedefleri tümü/öğretmen/öğrenciye izin verir, ancak arka uç okuma politikası veli desteklese de özel veli seçeneği yoktur (`announcements.tsx:237-239`). Bu ürün kapsamı sorusudur, kanıtlanmış kusur değildir; yöneticilerin yalnız veliye yönelik duyuruya ihtiyacı olup olmadığını belirleyin.

## Salt okunur tarayıcı kontrol listesi

Durum değerleri: SOURCE = kaynakta incelendi, LIVE = ana denetimde tarayıcı çalıştırıldı, MUTATION = izole test verisi/açık işlem yetkisi gerektirir. Bu alt rapor yalnız SOURCE atar; veri değişikliği yapılmadı.

| Rota/görünüm | Salt okunur kontroller ve eylem envanteri | Durum |
|---|---|---|
| Genel yan menü/üst başlık | 15 yönetici bağlantısı, etkin öğe, tarayıcı geri, mobil çekmece, tema, bildirim penceresi/okuma/susturma/silme, hesap menüsü/ayarlar/çıkış | SOURCE |
| /management / Dersler | Yükleme/boş/hata, liste sayıları; oluşturma/düzenleme aç/iptal; zorunlu ad, açıklama; silme aç/iptal; yazdır/yenile | SOURCE; kaydet/sil MUTATION |
| /management / Sınıflar | Kartlar ve sayı; ayrıntıya tıklama; menü düzenle/ayrıntı/sil; form aç/iptal; seviye/şube/öğretmen/açıklama; öğretmensiz seçim | SOURCE; kaydet/sil MUTATION |
| /management / Kullanıcılar | Beş rol sekmesinin her biri, sayılar ve boş durum; oluştur/düzenle/sil kutuları; zorunlu alanlar/veli telefon-adres; veli bağlama gezintisi | SOURCE; kaydet/sil MUTATION |
| /management / Kullanıcı Logları | Tarih tümü/yıl/30 gün/yıl; rol tümü/yönetici/öğretmen/öğrenci/veli; eylem arama; satır içerik/tarih; 101 kayıt eksiksizliği | SOURCE |
| /management / E-Posta Logları | Tarih/durum/arama/sayı rozetleri; yenile/5 saniyelik sorgu; gövde/ayrıntı aç; bekliyor/gönderildi/başarısız; tekrar gönder/sil seçenekleri, e-posta görünümü kapatma | SOURCE; tekrar gönder/sil MUTATION |
| /management / Şifre Talepleri | Durum/arama/sayılar; 5 saniyelik sorgu; e-posta alanı; bekliyor/tamamlandı/iptal/süresi doldu; yenile/iptal erişimi; tarih tutarlılığı ve 51 satır eksiksizliği | SOURCE; gönder/yenile/iptal MUTATION |
| /management / Sistem Hata & İşlemleri | Tarih/arama, JSON/ayrıntı okunabilirliği, önem derecesi, yükleme/boş/hata, 101 satır eksiksizliği | SOURCE |
| /settings / Profil | Mevcut ad/e-posta/telefon/adres, değişiklik durumu düğmesi, form doğrulama, profil özeti, yazdırma | SOURCE; kaydet MUTATION |
| /settings / Bildirimler | Okundu/okunmadı stilleri, tümünü oku, susturma anahtarı, silme simgesi, 20/sayfa önceki-sonraki/sayı; boş/hata; gezinme bildirim penceresi tutarlılığı | SOURCE; işaretle/sustur/sil MUTATION |
| /settings / İşlem Geçmişi | Altı aylık ifade, 50 satır API sınırı ile gösterilen eksiksizlik karşılaştırması, eylem/ayrıntı/tarih, hata ile boş durum ayrımı | SOURCE |
| /settings / Güvenlik | Mevcut/yeni/tekrar parola, varsa göster/gizle, uyuşmazlık, minimum uzunluk, bekleyen işlem, başarıda temizlenen alanlar | SOURCE; parola değişikliği MUTATION |
| /archive / Sınav Arşivi | Sayılar, yıl etiketi, boşluk/kısa yıl doğrulaması, onay içeriği/iptal, 21 satır eksiksizliği | SOURCE; arşivle MUTATION |
| /archive / Sınıf Atlatma | Kaynak sayıları/yükleme, hedef kaynak sınıfı dışlar, mezuniyet seçeneği, seviye uyarısı, onay/iptal, hedef seçildikten sonra kaynak değişikliği | SOURCE; sınıf atlatma MUTATION |
| /server-setup | Durum GET ve yenileme; politika kaynağı salt okunur mesajı; dört sağlık rozeti; algılanan özet; mod/url/origin/proxy doğrulama; yeniden başlatma bekliyor metni; saklama alanları; şablon kopyalama; başarısız sorgu | SOURCE; profil kaydet/saklama MUTATION |
| /announcements | Liste/yazar/tarih/rol/sınıf rozetleri, yazdır, oluşturma kutusu/iptal, büyük harf Türkçe başlık, içerik, hedef kitle/sınıf seçenekleri, doğrulama/bekleyen işlem/hata, çöp kutusu erişilebilir etiketi | SOURCE; yayımla/sil MUTATION |

Listelenen her görünüm için ortak kabul: masaüstü ve 390px mobilde temel eylemler kesilmeden kullanılabilirlik; görünür klavye odağı ve iletişim kutularında odak tuzağı/geri dönüş; ayırt edilebilir yükleme/hata/boş durumları; arama/filtrelerde tutarlı sayılar; gezinmeyi dışlayan ve amaçlanan güncel içeriği kapsayan baskı çıktısı. LIVE/başarılı işaretlemeden önce tarayıcı kanıtı bu kaynak bulgularını tamamlamalıdır.

## Tarayıcı doğrulama eki — 2026-09-30

### INV-11 — P2: bilinmeyen ayarlar sekmesi etkin panel bırakmıyor

Durum: gerçek Chromium E2E ile yeniden üretildi. Yönetici girişi sonrası `GET /settings?tab=unknown`; beklenen profil sekmesine dönüş, gerçek sayfada `tabpanel` yok. Kanıt: `docs/admin-audit/results-route-initial.json` ve `docs/admin-audit/evidence/settings-unknown-tab.png`. Etki: yanlış yazılmış/paylaşılmış doğrudan bağlantı boş ayarlar gövdesi açıyor. Düzeltme: sorgu `tab` değerini profile/notifications/logs/security ile doğrulayıp geçersiz değerleri profile normalleştirin. Kabul: geçersiz sekme profili etkinleştirir; geçmiş gezintisi geçerli sekmeleri korur.

### INV-12 — P2: mobil gezinme Escape ile kapanmıyor

Durum: gerçek Chromium E2E ve 390px arayüz gözlemi. Menüyü aç ile mobil menüyü açıp Escape'e basın. Beklenen örtünün kapanması ve odağın tetikleyiciye dönmesi; gerçekte Menüyü kapat arka planı 20 saniye sonra da görünür. Kanıt: `docs/admin-audit/results-route-initial.json` ve `docs/admin-audit/evidence/live-mobile-after-escape.png`. Düzeltme: modal çekmece davranışı, Escape işleyicisi ve odak dönüşü/tuzağı. Kabul: Escape çekmeceyi kapatır, odak menü düğmesine döner; açıkken Tab yalnız ilgili kontroller arasında dolaşır.

### INV-13 — P2: hatalı dağıtım URL'si HTTP 500 döndürüyor

Durum: gerçek izole tarayıcı/API E2E. /server-setup üzerinde genel URL'ye `not-an-origin` yazıp Profili Kaydet'e basın. Beklenen alan hatası ve görünür doğrulama mesajıyla HTTP 400; gerçek HTTP 500. `server/utils/deployment-config.ts` superRefine, originSchema tarafından zaten reddedilen değeri korumadan localhost için `new URL(value.publicUrl)` çağırır; rota bunu sunucu hatası olarak yakalar. Kanıt: `docs/admin-audit/flow-failures/admin-audit-system-flows-d-063f6-r-instead-of-silent-failure/error-context.md` ve sonraki hedefli sonuç. Düzeltme: superRefine içinde URL oluşturmayı koruyup Zod alan hatası döndürün; görünür hata için bildirim görüntüleyicisini bağlayın. Kabul: hatalı girdi 400 verir, yapılandırma yazılmaz, alana özgü görünür mesaj gösterilir, form düzenlenebilir kalır.
