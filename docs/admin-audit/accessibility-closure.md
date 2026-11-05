# Yönetici erişilebilirlik kabulünün kapsamı

2026-10-01 tarihinde hazırlandı. Test paketi: `tests-e2e/admin-accessibility-closure.spec.ts`.
**Son üretim tarayıcısı doğrulaması: 53/53 geçti**, çıkış 0; atlanan veya kararsız test yok.
Koşu **2026-10-01, 17:18:02 UTC**'de başladı ve
650.37 saniyede (10.84 dakika) tamamlandı. Ham kanıt: `results-accessibility-final.json`;
korunan çıktılar: `test-results-accessibility-final/`.

İlk tam 53 testlik tarayıcı koşusunda 47 test geçti, 6 test başarısız oldu.
Ham sonuç ve çıktılar `results-accessibility-full-initial.json`
ve `test-results-accessibility-full-initial` olarak korunur. Altı başarısızlık,
masaüstü ve mobilde üç kusuru yeniden üretti. Aşağıdaki onarımlardan sonraki
son üretim tarayıcısı tekrarında 53 testin tamamı geçti. Birim test sonuçları ayrı destekleyici kanıtlardır.

## Koşu kapsamı

Tarayıcı test paketini denetim yapılandırmasıyla çalıştırın:

```powershell
pnpm exec playwright test --config playwright.admin-audit.config.ts admin-accessibility-closure.spec.ts
```

Test paketi, kaydedilen geçici çalışma ortamını, 5510 arka uç portunu ve 5511 üretim
önizleme portunu gerektirir; diğer temel URL'leri veya veritabanı yollarını reddeder.
Denetim için hazırlanan yönetici hesabıyla giriş yapar. İletişim kutularını açıp iptal eder,
sekme ve menülerde gezinir, sonuç seçicisini açıp kapatır; form göndermez, veri silmez,
bildirim tercihlerini veya dağıtım yapılandırmasını değiştirmez. Giriş işlemi geçici
veritabanında oturum/denetim kayıtları oluşturabilir.

Kapsam: 1440x900 ve 390x844 boyutlarında 23 rota; ilk ve erişilebilir sekme durumları;
Playwright raporuna eklenen hesaplanmış ARIA anlık görüntüleri; parola alanları dahil
sunulan kontrollerin hesaplanmış erişilebilir adları; anlamlı profil etiketleri;
Tab ile gerçek erişim; ayarlarda ok/Home/End tuşlarıyla sekme davranışı; kategori
iletişim kutusunda ileri/geri odak tuzağı ve Escape sonrası odak dönüşü; sonuç
seçicisinin klavyeyle açılması, seçenek odağı ve Escape sonrası odak dönüşü;
hesaplanmış ad envanterlerinden önce API/yükleme hazır olma kontrolü yapılan dört
yönetim günlüğü görünümü (Kullanıcı Logları, E-Posta Logları, Şifre Talepleri,
Sistem Hata & İşlemleri); mobil menü odak tuzağı, arka planın dışlanması,
Escape sonrası odak dönüşü ve klavyeyle bağlantı gezintisi. Programatik odak yalnız
kapsamlı sekme envanterinin başlangıç noktasını belirler; özel klavye akışları
başlangıç kontrollerine Tab ile ulaşır. Ekran görüntüleri insan incelemesi için
klavye odağını kaydeder; otomatik odak kontrastı testi sayılmaz.

Her anlık görüntü durumunda kontrol sayısı rol başına bir kez (parola alanları için de
bir kez) okunur; her kontrol aynı görünürlük/ad denetiminden geçmeye devam eder.
Tam sekme envanterleri `/management` üzerinde yaklaşık 14 durumu (ilk durum,
dört ana sekme, beş kullanıcı rolü sekmesi ve dört günlük düğmesi görünümü),
`/settings` üzerinde beş durumu (ilk durum ve dört sekme) tekrarlar. Bu makinede
temel rota denetimleri 22–33 saniye sürdüğü için bu iki kapsamlı test sırasıyla
600 ve 240 saniyeye açıkça izin verir. Tekil doğrulama zaman aşımı ve ağın durulma
kontrolleri değişmedi. Bunlar test işlemi süre bütçeleridir; uygulamanın yanıt verme
hızını mazur göstermez veya kanıtlamaz.

Bu Chromium'da kaydedilen masaüstü anket RED koşusu, iki yerel
`input[type=date]` kontrolünü adsız `textbox` rolleri olarak sundu. Rol/ad
envanteri bu nedenle iki tarih etiketi hatasını da yakaladı. Bu, denetimde
kullanılan tarayıcıya ilişkin kanıttır; her tarayıcı veya erişilebilirlik API'sinin
yerel tarih kontrollerini aynı rolle sunduğunu garanti etmez. Açık etiket
ilişkileri ve `getByLabelText` birim kontrolleri bu alanlar için hâlâ uygundur.

## Ekran okuyucu erişimi ve sınırları

**Güncel kapsam kararı, 3 Ekim 2026:** Kullanıcı, gerçek sesli ekran okuyucu
kullanımı gereksinimini bu yönetici kabul kapsamından çıkardı. Mevcut ARIA
etiketleri, hesaplanmış erişilebilir ad kontrolleri ve klavye/odak gereksinimleri
korunur. Aşağıdaki tarihsel okuyucu denemesi, başarılı kontrol veya öğretmen paneli
çalışmasının ön koşulu olarak değil, doğrulanmamış kanıt olarak saklanır.
Son aynı kodlu terminal/BAT/Git SH kurulum kabulü 3 Ekim'de 3/3 geçti;
hibrit kurulum beklemesi çözüldü. Öğretmen paneli denetimi başlamadı.

İlk salt okunur PowerShell envanterinde `C:\Windows\System32\Narrator.exe` bulundu.
`C:\Program Files\NVDA\nvda.exe` ve
`C:\Program Files (x86)\NVDA\nvda.exe` bulunmadı. Okuyucu başlatılmadan önce
`Get-Process` çıktısında Narrator, nvda, jfw veya ZoomText ile eşleşen süreç yoktu.
İki Program Files kökünde NVDA/Freedom/JAWS/ZoomText ile eşleşen üst düzey dizin
bulunmadı. Bu sınırlı bir kurulum envanteridir; başka okuyucu bulunmadığının kanıtı değildir.

Koordinasyon ajanı daha sonra Windows arayüz yardımcısını sıfırladı,
uygulamaları başarıyla listeledi ve `Narrator.exe`'yi başlattı. Yardımcı bir
Narrator penceresi döndürdü; ancak `get_window_state`, pencerenin yardımcıdan daha
yüksek Windows bütünlük düzeyinde çalıştığını bildirdi. Mevcut ekran görüntüsü
çok küçüktü ve pencerenin erişilebilirlik ağacı alınamadı. Ses yakalama yeteneği
sunulmadı. **Narrator başlatıldı; ancak gerçek konuşma, okuma sırası ve okuyucu
etkileşimi doğrulanmadı.** Bu belirli bir bütünlük düzeyi/ses sınırlamasıdır;
tüm yerel uygulama erişiminin kapalı olduğu iddiası değildir.

Playwright ARIA anlık görüntüleri ve erişilebilir ad eşleştiricileri, tarayıcıda
hesaplanan erişilebilirlik temsilini inceler. Narrator/NVDA telaffuzunu, duyuruları,
gezinme modunu, okuma sırasını, okuyucuya özgü kısayolları veya gerçek ekran okuyucu
kullanılabilirliğini kanıtlamaz. Bunlar etkileşimli okuyucu oturumu gerektirir;
3 Ekim kullanıcı kararıyla bu oturum güncel kabul kapsamından çıkarılmıştır.
Tam WCAG uyumu, renk kontrastı, tüm doğrulama/canlı duyurular ve tüm yıkıcı
akışlar bu test paketinin doğrulamaları dışındadır.

## Etiket onarımı ve birim regresyon kanıtı

Kaynak incelemesi `client/src/pages/settings.tsx` içinde ilişkilendirilmemiş
profil/parola etiketleri buldu; telefon, adres ve e-posta yer tutucuları görünür
etiketlerden farklıydı. Güncel yama dört profil alanını ve üç parola alanını
`htmlFor`/`id` çiftleriyle bağlar. `client/src/test/admin-inventory.test.tsx`
içindeki iki regresyon, anlamlı erişilebilir adları ve her görünür etikete
tıklandığında ilgili kontrolün odaklanmasını gerektirir. Etiket tıklama
kontrolleri, ad alanının eşleşen yer tutucudan ad alma durumunu da yakalar.
Bunlar DOM/birim kontrolleridir; gerçek okuyucunun sesli okuma doğrulaması değildir.
Burada tam tarayıcı test paketinin geçtiği iddia edilmez.

Ayrı bir rapor hazır olma/istek yarışı kontrolü gerçek API veri biçimini kullanır:
öğrenci sonuçları uç noktası `quiz.category` değerini `{ name }` nesnesi olarak
değil, `server/storage.ts` içinde düzleştirilmiş metin olarak döndürür.
İstek yarışı sınanmadan önce test verileri bu biçime düzeltildi.

`client` dizininden çalıştırılan aşağıdaki yarış komutu, etki temizliği yamasından
önce çıkış 1 ile başarısız oldu; B'nin rapor üst verilerine A'nın dışa aktarılan
satırları eşlik etti (B satırı yerine `result-student-a` ve `Sınav A`):

```powershell
pnpm exec vitest run src/test/admin-student-report-request-race.test.tsx
```

Yama, istek başında eski satırları/kategorileri/kimliği temizler, etkin olmayan
istekleri yok sayar, sonuçları/kategorileri/kimliği birlikte uygular ve eski hata
ve yükleme tamamlanması bildirimlerine karşı koruma sağlar. Ardından sırayla
çalıştırılan hedefli koşu çıkış 0 ile **2 test dosyası ve 4 test geçti**
sonucunu verdi (91.94 saniye):

```powershell
pnpm exec vitest run src/test/admin-student-report-readiness.test.tsx src/test/admin-student-report-request-race.test.tsx --maxWorkers=1
```

Bu dört test, bekleyen rapor kontrollerini, tamamlanmış gerçek sayısal sıfırla
birlikte yüklenen seçili öğrenci kimliğini, eksik kimliği ve geciktirilmiş
A'dan B'ye istek yarışını kapsar. Narrator konuşmasını doğrulamaz;
ayrı son tarayıcı tekrarında 53/53 geçti.

## İlk koşunun son kusurları ve odaklı onarım kanıtı

AX06: masaüstü ve mobil `/admin/archive` hesaplanmış envanterleri iki adsız
sınıf atlatma seçim kutusu gösterdi. Kaynak ve hedef sınıf etiketleri
ilişkilendirilmemişti. Onarım görünür etiketleri benzersiz tetikleyici kimliklerine
bağlar; eğitim yılı alanını da görünür etiketiyle ilişkilendirir.

AX07: masaüstü ve mobil `/student/results` üç adsız filtre seçim kutusu gösterdi.
Onarım kategori, puan ve sıralama tetikleyicilerini görünür etiketleriyle
ilişkilendirir; sınav adı arama alanını da bağlar. Adlar artık kontrolün amacını
seçili değerinden veya yer tutucusundan bağımsız açıklar. Filtre değerleri,
işleyicileri ve rapor isteği davranışı değişmedi.

AX08: kategori iletişim kutusunda Escape sonrası odak dönüşü iki görünüm
boyutunda da başarısız oldu. Kutu Radix `DialogTrigger` olmadan programatik
açılmıştı; kapanışta odak sayfa gövdesine dönüyordu. Onarım, hem yeni ders hem
ders düzenleme yollarında gerçek düğmeyi saklar ve kapanışta odağı hâlâ bağlı
olan açıcıya döndürür. Mevcut gönderim ve veri değişikliği davranışı değişmedi.

Odaklı regresyon, yedi anlamlı etiket adının tamamını ve ekleme/düzenleme için
klavyeyle Enter/Escape odak dönüşünü gerektirir. Üretim onarımlarından önce
aşağıdaki komut çıkış 1 ile **4 başarısız test** verdi (68.10 saniye): adlar
boştu ve iki kapanış yolu da gövdeyi odakladı. Onarımlardan sonra çıkış 0 ile
**1 dosya ve 4 test geçti** (39.17 saniye). `client` dizininden:

```powershell
pnpm exec vitest run src/test/admin-accessibility-final-repairs.test.tsx --maxWorkers=1
```

`git diff --check`, bu üç kaynak dosyası ve yeni test için yalnız satır sonu
bildirimleriyle geçti. Bu DOM/birim sonuçları onarımları destekler;
son tarayıcı matrisi 53/53 geçti ve gerçek okuyucu konuşması doğrulanmadı.

Mevcut denetimin adsız kontrol kontrolü textContent/ARIA/title özniteliklerinin
varlığına bakar. Bu sezgisel yöntem bozuk referansları ve yalnız yer tutucuya
dayanan adları kaçırabilir; yeni test paketi hesaplanmış anlık görüntüleri
kaydeder ve hesaplanmış adları denetler.

## İlk tam koşunun çalışma zamanı kanıtı

Korunan ilk 53 testlik koşu **47 geçti ve 6 başarısız** sonucuyla
822.84 saniyede tamamlandı. Bu ilk kanıttır; sonraki tekrarın sonucu değildir.
Ham rapor `results-accessibility-full-initial.json`; çözümlenen rota ve görünüm
boyutu kayıtları `evidence/closure/accessibility/runtime-summary-initial.json` içindedir.

53 çalışma zamanı eki incelendi. **0 yakalanmamış sayfa hatası, 1 konsol hatası,
0 API HTTP hata yanıtı, 1 başarısız istek ve 0 iptal edilmiş istek** kaydedildi.
Konsol hatası ve başarısız istek, geçen mobil `/management` testindeki
(390 × 844) aynı olaya aittir: GET `/api/admin/logs/system` isteği
`net::ERR_NETWORK_CHANGED` ile başarısız oldu. Bu, tarayıcı aktarım hatası
olarak kaydedilir; HTTP hata durumu veya yakalanmamış JavaScript hatası yoktu.
Temel neden ve sonraki toparlanma bu koşuda kanıtlanmadı. Erişilebilirlik
testinin geçmesi bu isteğin başarılı olduğunu göstermez.

Kaydedilen 53 belge gezinme örneğinde yükleme tamamlanma medyanı
1,342.1 ms, yüzde 95 değeri 3,096.2 ms ve maksimum 3,980.2 ms idi.
DOMContentLoaded medyanı 582.2 ms (yüzde 95 değeri 1,458.8 ms;
maksimum 3,320.6 ms) idi. Yanıt başlangıcı medyanı 21.3 ms,
DOM etkileşime hazır olma medyanı 47.4 ms idi. Bunlar yerel denetim
makinesinde test başına son kaydedilen belge gezinme süreleridir; tüm SPA
geçişleri veya kontrollü performans karşılaştırması değildir. Kaydedilen
1,429 bayt aktarım boyutu yalnız belge yanıtıdır; tüm sayfa varlıkları değildir.
Tanı toplayıcısı uyarıları değil konsol hatalarını, HTTP 400 ve üzeri API
yanıtlarını ve istek başarısızlıklarını/iptallerini ayrı kaydeder. Kalıcı özet,
ölçüm sınırlarını ve tekil kayıtları kimlik bilgileri veya token değerleri olmadan korur.

## Son tam koşunun çalışma zamanı kanıtı

**53 son çalışma zamanı ekinin** tamamı çözümlenip incelendi. Rota ve görünüm
boyutu kayıtları `evidence/closure/accessibility/runtime-summary-final.json`
içinde korunur. Gerçek son sayaçlar: **0 yakalanmamış sayfa hatası, 1 konsol
hatası, 0 API HTTP hata yanıtı, 1 başarısız istek ve 0 iptal edilmiş istek**.
Sıfır olmayan iki olay, geçen mobil `/student/result/audit-result` testindeki
(390 × 844) tek olayı anlatır: GET `/css2`, `net::ERR_NAME_NOT_RESOLVED`
ile başarısız oldu. Yol, `client/index.html` içinde tanımlanan Google Fonts
stil dosyasıyla eşleşir; tanı ekleri sunucu adını değil yalnız yol adını
sakladığından bu dış yazı tipi isteğine atıf bir çıkarımdır. HTTP hata durumu
veya yakalanmamış JavaScript istisnası yoktu. Testin geçmesi başarısız isteğin
toparlandığını kanıtlamaz. Bu son DNS olayı, ilk koşunun yukarıda açıklanan
`/api/admin/logs/system` aktarım olayından ayrıdır.

Son gezinme ölçümleri 53 pozitif yanıt başlangıcı, DOM etkileşime hazır olma ve
DOMContentLoaded örneği içerir; ancak yalnız **40 pozitif yükleme tamamlanma
örneği** vardır: kaydedilen 13 `loadEventEnd` değeri sıfırdı, dolayısıyla bu
testlerde yükleme tamamlanması ölçülmedi. DOMContentLoaded medyanı 431.2 ms
(yüzde 95 değeri 1,411.0 ms; maksimum 4,695.0 ms) idi. 40 pozitif yükleme
tamamlanma örneğinde medyan 1,443.65 ms, yüzde 95 değeri 5,063.2 ms ve
maksimum 7,930.2 ms idi; bunlar 53 testin tamamının ölçümü sayılamaz.
Belge aktarım boyutu 1,428 bayttı; diğer sayfa varlıklarını kapsamaz.
Bunlar yerel belge süreleridir; kontrollü performans karşılaştırması veya tam
SPA geçiş ölçümü değildir. Konsol uyarıları ve gerçek yardımcı okuyucu konuşması
bu doğrulamanın dışındadır; son tarayıcı geçişi sıfır ağ hatasını kanıtlamaz.
