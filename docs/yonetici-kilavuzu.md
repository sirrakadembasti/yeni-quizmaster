# QuizMaster Yönetici Kullanıcı Kılavuzu

**AI Yönetimi:** **ai profil yönetimi** sekmesinde sağlayıcı/model profilleri ve şifreli API anahtarları yönetilir. Profili test edip öğretmenlere açın; birden fazla model kullanılabilir. **öğretmen ai kullanımı** sekmesinde öğretmen, ders, sınav/model ve gerçek token tüketimini filtreleyin. Bilinmeyen tüketim sıfır sayılmaz. [Ayrıntılı kullanım ve anahtar yedeği](yapay-zeka-yonetimi.md).

Bu kılavuz `admin` rolündeki kullanıcıların okul yapısını, hesapları, sınavları, anketleri, raporları ve sistem kayıtlarını yönetmesi içindir.

Güncel onarımların kabul kapsamı ve kanıtları: [Entegrasyon onarımları](denetim-raporlari/entegrasyon-denetim-raporu.md).

## 1. Giriş ve güvenlik

1. **Giriş Yap** ekranında yönetici e-postanızı ve şifrenizi kullanın (salt-okunur canlı vitrin modunda `/demo` sayfasından `demo-admin@quizmaster.com` / `demo123456` veya **Hemen İncele** düğmesiyle giriş yapılabilir; bkz. [`demo/demo-vitrin-hesaplari.md`](../demo/demo-vitrin-hesaplari.md)).
2. Şifrenizi bilmiyorsanız **Şifremi Unuttum** ile kayıtlı e-postanıza bağlantı isteyin veya sunucu terminalinden `npm run db:reset-admin --workspace=server` komutuyla yerel kurtarma uygulayın.
3. Ortak cihazda işiniz bittiğinde kullanıcı menüsünden **Güvenli Çıkış** yapın.

Parola sıfırlama bağlantısı tek kullanımlıktır ve bir saat geçerlidir. Bağlantıyı başka biriyle paylaşmayın.

## 2. Yönetici menüsü

- **Dashboard:** Sistem özeti, sınav katılımı, son sınavlar ve son hareketler.
- **Sınav Yönetimi:** Sistemdeki sınavların yönetim görünümü.
- **Sınavlar:** Tablo ve sayfalama ile sınav listesi; yeni sınav oluşturma/düzenleme.
- **Sınıf İstatistikleri:** Tarih ve sınıf bazlı katılım/başarı analizi.
- **Sınav Sonuçları:** Ders, sınav, sınıf, öğretmen ve diğer filtrelerle sonuç raporu.
- **Anket Yönetimi:** Anket oluşturma/düzenleme ve anket sonuçları.
- **Öğrenciler:** Öğrenci listesi, detay, Excel ve yazdırma.
- **Öğretmenler:** Öğretmen hesabı, iletişim, branş ve sınıf atamaları.
- **Sınıflar:** Sınıf listesi, mevcudu ve öğretmen atamaları.
- **Yönetim:** Dersler, sınıflar, kullanıcılar ve loglar.
- **Arşiv:** Manuel kapsam seçimi, yıllık kapanış, sınıf geçiş kuralları, iş takibi ve paket indirme.
- **Sunucu Durumu:** Veritabanı, yükleme alanı, HTTPS, reverse proxy ve e-posta yapılandırmasının güvenli sağlık özeti.
- **Duyurular:** Okul, rol veya sınıf hedefli duyurular.
- **Ayarlar:** Profil, bildirim sesi, bildirim silme, kişisel hareketler ve parola.

## 3. Öğrenci yönetimi

**Öğrenciler** veya **Yönetim > Kullanıcılar** ekranından hesap oluşturabilirsiniz. Öğrenci listesindeki **Detaylar** düğmesi düzenleme sekmelerine açılır; ayrı hızlı düzenleme kaldırılmıştır. Öğrenci kaldırıldığında kayıt fiziksel olarak silinmez, pasife alınır ve sınav/sınıf geçmişi korunur.

Sınıf numarası sınıfa atama anında sistemce otomatik verilir. Sınıf içinde benzersizdir; yönetici dahil hiçbir kullanıcı bu değeri elle değiştiremez.

- Öğrencinin adı, e-postası, iletişim bilgileri ve sınıfı yönetilebilir; **Sınıf No** yalnız görüntülenir ve sistem tarafından otomatik yönetilir.
- Açık kayıtla gelen öğrenci kendi sınıfını seçemez; sınıf atamasını yetkili kullanıcı yapar.
- Öğrenci detayında sınav geçmişi, kişisel bilgiler ve veli bilgileri ayrı alanlarda gösterilir.
- Öğrenci kendi kişisel/veli bilgilerini salt okunur görür; değişiklikleri yönetici yapar.
- Öğretmenler veli ve özel iletişim bilgilerini göremez.

Öğrenci listesi ve detay ekranındaki **Yazdır** temiz A4 görünümü, **Excel** ise filtre ve tablo yapısını koruyan `.xlsx` çalışma kitabı üretir.

## 4. Veli hesabı ve öğrenci ilişkisi

Ana menüdeki **Veli Eşleştirme** sayfası yüzlerce öğrenci için aramalı ilişki yönetimi sunar. Öğrenci adı, e-posta, sınıf ve numara ile arama yapılabilir. Öğrenci detayındaki **Veli Hesapları** bölümünde de iki yöntem bulunur:

1. **Yeni Veli Hesabı:** Ad, e-posta, ilk şifre, telefon, adres ve yakınlık eksiksiz girilerek hesap oluşturulur ve öğrenciye bağlanır.
2. **Mevcut Veliyi Bağla:** Daha önce oluşturulmuş veli hesabı seçilen öğrenciyle ilişkilendirilir. Yakınlık değeri her iki yöntemde de **Anne / Baba / Diğer** listesinden seçilir.

Aynı veli birden fazla öğrenciye bağlanabilir. Bağlı veli satırındaki **Düzenle** ile ad, e-posta, telefon, adres ve yakınlık güncellenir. **Bağlantıyı Kaldır** yalnız öğrenci-veli ilişkisini siler; veli hesabının kendisini otomatik silmez.

Öğrenci kaydındaki eski tip veli iletişim alanları ile giriş yapabilen `parent` hesabı farklı amaçlara sahiptir: iletişim alanları okul kaydıdır; veli hesabı uygulamaya giriş ve takip içindir.

**Yönetim > Kullanıcılar** ekranında **Sistem Rolü > Veli** seçilebilir. Hesap bilgileri burada kaydedilir; öğrenci bağları modal yerine ayrı **Veli Eşleştirme** sayfasında yönetilir. Rol daha sonra öğrenci, öğretmen veya yöneticiye çevrilirse eski veli bağları kaldırılır.

Yeni bir kullanıcı kendi kaydını tamamladığında yöneticilere **Yeni Üye Kaydı** bildirimi gelir.

Pasife alınan öğrenci giriş yapamaz; aktif öğrenci, sınıf ve veli eşleştirme listelerinde gösterilmez. Kayıt fiziksel olarak durduğu için eski sınav sonuçları ve sınıf ilişkisi raporlama/veri bütünlüğü amacıyla korunur.

## 5. Öğretmen yönetimi

**Öğretmenler** sayfasından öğretmen hesabı oluşturun veya düzenleyin. Öğretmen detayında:

- ad, e-posta, telefon ve adres gibi kişisel/iletişim bilgilerini,
- branş/ders yetkilerini,
- sorumlu olduğu sınıfları ve dersine girdiği sınıfları,
- oluşturduğu sınavları

inceleyebilirsiniz. Atama değişikliklerini kaydettikten sonra ilgili öğretmen yalnız yeni yetki kapsamındaki öğrenci, sınıf, sınav ve anket verilerine erişir. Öğretmen kendi **Ayarlar > Profil** ekranından iletişim ve adres bilgilerini güncelleyebilir; rol ve ders/sınıf atamalarını değiştiremez.

## 6. Ders ve sınıf yönetimi

1. **Yönetim > Dersler** alanından ders adı ve açıklamasını oluşturun.
2. **Yönetim > Sınıflar** veya **Sınıflar** sayfasından sınıfı oluşturun.
3. Öğrencileri sınıfa, öğretmenleri sorumlu sınıfa ve branş derslerine atayın.
4. Sınıf detayında mevcudu ve branş öğretmenlerini doğrulayın.

Sorumlu öğretmeni kaldırmak veya değiştirmek, eski öğretmenin aynı sınıftaki genel yetkisini kaldırır. Bağımsız branş/ders atamaları korunur ve ekran kalan dersleri açıklar. Erişimi tamamen kaldırmak için kalan ders atamalarını da kaldırın. Başka bir öğretmenin atamaları etkilenmez.

Sınıfta `maxStudents` sınırı tanımlanmışsa aktif öğrenciler kapasiteye sayılır. Dolu sınıfa yeni kayıt, nakil veya toplu sınıf atlatma reddedilir; mevcut öğrencinin kişisel bilgilerini düzenlemek engellenmez. Pasif öğrenciler kapasite tüketmez.

Sınıf silmeden önce bağlı öğrenci, öğretmen, sınav ve anketleri kontrol edin. Liste ve detay ekranlarında **Excel** ve **Yazdır** seçeneklerini kullanabilirsiniz.

## 7. Sınav oluşturma ve yönetme

**Sınavlar > Yeni Sınav** yalnız sınav oluşturur; anket seçeneği bu ekranda bulunmaz.

1. Başlık, açıklama, ders, zorluk, süre ve soru karıştırma ayarlarını belirleyin.
2. Hedef sınıfları seçin.
3. Soruları ve doğru cevapları ekleyin.
4. İsterseniz **Soru Görseli (Opsiyonel)** alanını açıp görsel yükleyin. Alan varsayılan olarak kapalıdır.
5. **Soru Ekle** ile oluşturulan yeni soru listenin en üstünde görünür.
6. İsterseniz Gemini AI ile soru üretin ve sonuçları eklemeden önce kontrol edin.
7. Taslak kaydedin; en az bir geçerli soru bulunduğunda yayınlayın.

AI üretimi için konu, soru adedi ve sağlayıcı ayarlarının geçerli olması gerekir; sunucu geçersiz istekleri reddeder. Özel sağlayıcı adresi, anahtarı, model veya sağlayıcı seçimi değiştiğinde eski **HAZIR** göstergesi kaldırılır. Yeni ayarlarla yapılandırma testini tekrar çalıştırın ve üretilen soruları eklemeden önce inceleyin.

Ayarlar, sorular ve yayın durumu birlikte kaydedilir. Kayıt yanıtı bağlantı nedeniyle alınamazsa aynı açık düzenleyicide yeniden deneyin; tekrar deneme ikinci bir taslak oluşturmaz. Katılım başladıktan sonra sorular değiştirilemez; reddedilen soru değişikliği ayarları da değiştirmez. Açıklamayı boşaltmak ve süreyi kapatmak kaydedildiğinde eski değerler kaldırılır.

Görsel yüklemede yalnız desteklenen görsel dosyaları kullanın; istemci dosya boyutunu, sunucu dosya türünü ve piksel sınırını doğrular.

## 8. Anket Yönetimi

**Anket Yönetimi** iki sekmeli çalışır:

- **Anket Oluştur:** Anket başlığı, açıklama, sınıf ataması ve sorular.
- **Anket Sonuçları:** Tarih ve anket filtresi, katılım, dağılımlar, açık uçlu cevaplar, grafikler ve tablolar.

Anketlerde puan, doğru cevap, başarı notu veya sınav süresi kullanılmaz. Desteklenen türler tek seçim, çoklu seçim, açık uçlu, derecelendirme ve Likert ölçeğidir. Görsel soru alanı sınavdaki gibi açılır/kapanır ve yeni eklenen soru en üstte gösterilir.

Sonuç görünümünde grafik ve tablo birlikte okunabilir. **Excel** ayrıntılı `.xlsx`, **Yazdır** ise A4 uyumlu sonuç raporu üretir.

## 9. Sınav sonuçları ve sınıf istatistikleri

- **Sınav Sonuçları:** Anketler bu filtrede gösterilmez. Ders seçimine göre sınav filtresi daralır; sınıf, öğretmen ve diğer filtreler backend sorgusuna uygulanır.
- **Sınıf İstatistikleri:** Başlangıç/bitiş tarihi ve sınıf filtresiyle katılım, ortalama başarı ve sınıf karşılaştırmalarını gösterir.
- Sonuç ve istatistik ekranlarında tablo/grafik verileri gerçek veritabanı sonuçlarından üretilir.

Yönetici sınav seçicisinde öğretmenlerin sınavları da görünür. Sonuç ekranında katılım ve notlandırılan kayıt sayıları ayrı gösterilir. Başarı dağılımı ve ortalama yalnız tamamlanan, puanı bulunan kayıtlarla hesaplanır; devam eden ve puansız kayıtlar sıfır sayılmaz. Tamamlanmış gerçek sıfır puan hesaba katılır. Henüz notlandırılmamış sınavın ortalaması “Henüz yok” olarak gösterilir.

Filtre seçiminiz yazdırma başlığında ve Excel dosyasında rapor bilgisi olarak yer alır.

Öğrenci raporundaki **Öğrenci Kodu** tam kimliği gösterir; uzun kod satıra bölünür. Sınıf istatistiğinde veri yüklendiğinde baskı grafiği katılım ve başarı değerlerini tamamlanmış çubuklarla gösterir. Filtreyi değiştirdiğinizde yeni verinin yüklenmesini bekleyip yazdırın.

## 10. Duyurular ve bildirimler

Yönetici okul geneline, role veya sınıfa duyuru gönderebilir. Duyuruda gönderen adı ve rolü alıcıya gösterilir.

- Üst menü en fazla son 5 bildirimi gösterir.
- **Tüm Bildirimleri Gör** ile Ayarlar bildirim sekmesine geçilir.
- Bildirim tek tek silinebilir.
- Zil alanından veya **Ayarlar > Bildirimler** üzerinden ses açılıp kapatılabilir.
- Gerçek zamanlı bağlantı varsa duyuru/bildirim anında; bağlantı yeniden kurulduğunda önbellek yenilenerek gösterilir.
- Bildirim yükleme hatasında **Yeniden dene** seçeneği görünür; boş liste mesajı gösterilmez. **Hepsini Oku** başarısız olursa hata mesajı görünür ve okunma durumu korunur.

## 11. Loglar, e-posta ve şifre talepleri

**Yönetim > Loglar** dört alt sekmeden oluşur:

1. **Kullanıcı Logları:** Giriş ve kullanıcı/sınav/duyuru işlemleri.
2. **E-Posta Logları:** Outbox teslimat durumu, alıcı, konu, deneme sayısı ve hata bilgisi (`password_reset`, `registration_welcome` vb.). Token içeren gövde istemciye verilmez.
3. **Şifre Talepleri:** Kullanıcı adına e-posta ile talep oluşturma, **Bağlantı Üret (SMTP'siz)** ile doğrudan tek kullanımlık sıfırlama bağlantısı üretip kopyalama, durum/arama filtresi, yeni bağlantı gönderme (**Yenile**), satır bazında **Bağlantı Üret** ve bekleyen talebi iptal etme (**İptal**).
4. **Sistem Hata & İşlemleri:** Arşivleme, sınıf atlatma, tasfiye ve sistem operasyonları.

Yeni kullanıcı kaydında (`POST /api/auth/register` veya yönetici tarafından kullanıcı ekleme) e-posta doğrulama zorunluluğu uygulanmaz; kayıtlı adrese `registration_welcome` tipinde kayıt başarı bilgilendirme e-postası Outbox kuyruğuna eklenir. Şifre talebi oluşturulduğunda eski bekleyen bağlantı iptal edilir ve yeni bağlantı Gmail Outbox kuyruğuna alınır. Kurum ağında SMTP erişimi yoksa veya Gmail yapılandırılmamışsa **Bağlantı Üret (SMTP'siz)** ya da tablodaki **Bağlantı Üret** düğmesiyle e-posta kuyruğuna girmeden 60 dakikalık tek kullanımlık sıfırlama bağlantısı üretilir ve **Bağlantıyı Kopyala** ile kullanıcıya güvenli kanaldan iletilir. Yönetici kendi şifresini unuttuğunda sunucu terminalinden `npm run db:reset-admin --workspace=server` komutuyla yeni şifre atayabilir veya tek kullanımlık sıfırlama bağlantısı üretebilir. Ayrıntılı kurulum için [Gmail e-posta belgesine](e-posta-yapilandirma.md) bakın.

Dört log bölümünde toplam kayıt ve sayfa bilgisi gösterilir; **Önceki / Sonraki** ile geçmiş kayıtlara ulaşılır. Filtre değişiminde ilk sayfaya dönülür. Şifre taleplerinin tarih filtresi yoktur; durum ve arama filtreleri uygulanır. **Ayarlar > İşlem Geçmişi** son altı aylık kişisel kayıtları sunucu üzerinden sayfalar.

## 12. Excel ve yazdırma

- **Excel** gerçek `.xlsx` dosyası indirir; Türkçe karakterler Unicode olarak korunur.
- Excel dosyaları standart OpenXML öğe sırasıyla üretilir ve Microsoft Excel masaüstü uygulamasında onarım uyarısı vermeden açılacak şekilde doğrulanır.
- Rapor başlığı, aktif filtreler, başlık biçimi, kenarlıklar, otomatik genişlik ve sabit başlık satırı çalışma kitabına eklenir.
- **Yazdır** menüleri, düğmeleri ve filtre kontrollerini gizler; tarih, başlık, filtre özeti ve tabloyu A4'e sığdırır.
- Tablo eylemlerinin **İşlemler / Eylem** başlıkları ve hücreleri baskıda gizlenir. Loglardaki işlem türü ve işlem detayları rapor verisi olarak korunur.
- Dashboard sayfalarında yazdırma bulunmaz; anlamlı rapor/listelerde kullanılır.

## 13. Çevrimdışı sınav

Yalnız süresiz sınavlar öğrenci tarafından bağlantı varken cihaza hazırlanabilir. Cevap anahtarı pakete girmez; teslim ve puanlama sunucuda tamamlanır. Süreli sınavlar çevrimdışı başlatılamaz.

Tarayıcı verilerini temizlemek veya cihaz değiştirmek bekleyen yerel cevapları kaybettirebilir.

Öğrencinin **Sınavlarım** ekranında tamamlanan, devam eden ve teslim bekleyen sınavlar ayrı durumlarla gösterilir. Aynı süresiz sınavı yeniden çevrimdışı hazırlamak gönderilmemiş yerel cevapları veya bekleyen teslimi sıfırlamaz.

## 14. Sorun giderme

### Sunucu durumu ve ilk kurulum

İlk sunucu kurulumu yönetici panelinden yapılmaz. Yeni ve temiz bir sunucuda, ana uygulama başlatılmadan önce sunucu yöneticisi `npm run setup` (veya Windows `kurulum.bat` / Linux `./kurulum.sh`) komutuyla tek kullanımlık kurulum sihirbazını çalıştırır. Sihirbaz yalnız `127.0.0.1` üzerinde açılır; uzak VPS için internete port açmak yerine SSH tüneli kullanılmalıdır.

Kurulum sihirbazı son adımda **Uygulamayı başlat** düğmesi sunar:

- **Yerel / localhost:** `npm run dev` arka planda başlar (terminal penceresi açılmaz); giriş `http://127.0.0.1:5173/auth`
- **Kurum (subdomain/alt yol):** üretim servisi başlatılır; Nginx + DNS sonrası `https://.../auth`

Kör yönlendirme yoktur; uygulama ayakta değilse “sayfaya ulaşılamıyor” yerine düğme ve açıklama gösterilir. Ayrıntılar için [Sunucu Kurulum Kılavuzu](sunucu-kurulum-kilavuzu.md) izlenmelidir.

Paneldeki **Sunucu Durumu** ekranı normal kullanımda salt okunurdur. Profil kaydetme ve kalıcı saklama temizliği yalnız sunucu yöneticisinin bakım sırasında `ALLOW_RUNTIME_DEPLOYMENT_CHANGES=true` ayarını açıkça etkinleştirmesiyle açılır. Bu ayarı sürekli açık bırakmayın. Gizli anahtarlar ve Gmail uygulama parolası bu ekranda gösterilmez.

**Sunucuyu Yeniden Algıla** kaydedilmemiş değişiklikleri korur. Temizlik için önce politikayı kaydedin; ekrandaki politika sunucunun güncel kayıtlı politikasıyla eşleşmelidir. Onayda kayıt türlerinin süreleri, başarılı sonuçta silinen kayıt sayıları gösterilir.

### Yıl sonu arşivi ve kalıcı silme

**Arşiv** ekranı manuel arşiv, yıllık kapanış, geçmiş işler ve sınıf geçiş kurallarını yönetir. Manuel işlem seçilen içeriği arşivler; öğrencileri taşımaz ve yılı kapatmaz. Yıllık iş İstanbul saatiyle 15 Temmuz 00:05'te, doğrulanmış paket sonrasında bir kez terfi/mezuniyet ve yeni yıl aktivasyonu yapar. Öğretmen atamaları korunur.

Sekmelerin adım adım kullanımı, önkontrol, başarısız iş kurtarma, indirme ve geçmiş yıl seçimi [Eğitim yılı geçişi ve arşivleme kılavuzunda](yil-gecisi-ve-arsivleme.md) tek yerde açıklanır.

Kalıcı sınav silme, bağlı sonuçları da kaldırır. Silme penceresinde gerekçe girilmesi zorunludur; gerekçe ve etkilenen kayıt sayıları işlem geçmişinde saklanır. İşlem kaydı yazılamazsa sınav da silinmez.

- **Öğretmen bir sınıfı/öğrenciyi göremiyor:** Ders-sınıf ve öğretmen atamalarını kontrol edin.
- **Öğrenci sınavı/anketi göremiyor:** Yayın durumunu ve sınıf atamasını kontrol edin.
- **Excel eski veriyi içeriyor:** Aktif filtreleri kontrol edin ve sorgunun tamamlanmasını bekleyip yeniden indirin. Öğrenci analizi, öğrenci kimliği ve sonuçları birlikte yüklenene kadar Excel/Yazdır işlemlerini kapalı tutar; yükleme hatası giderilmeden çıktı alınamaz. Sonuçlar çıktısında seçili öğretmen ve öğrenci filtreleri yer alır. Sınıf çıktısında sınıf adı, sorumlu öğretmen, arama ve filtrelenmiş öğrenci sayısı gösterilir.
- **Görsel yüklenmiyor:** Dosya türü/boyutu, piksel sınırı ve sunucu erişimini kontrol edin.
- **Gmail gönderilmiyor:** Şifre Talepleri ve E-posta Loglarını kontrol edin; Gmail uygulama parolası ile 587/465 ağ erişimini doğrulayın.
- **Bildirim geç görünüyor:** Oturumu ve Socket.IO bağlantısını kontrol edin; sayfayı yenileyerek sunucu listesini tekrar alın.

## Bakım sonrası veri ve oturum kuralları

12 Ekim arşiv kabulünde seçili manuel arşiv, parola onaylı ZIP indirme, yıllık kapanış/terfi/mezuniyet, hata kurtarma ve geçmiş yıl görünümü ayrı gerçek tarayıcı senaryolarıyla doğrulandı. Geçmiş yıl canlı veriden doldurulmaz; hazırlık sürerse tekrar deneme durumu gösterilir. Aktif yıla dönerek normal işlemlere devam edin. [Kabul kapsamı ve sınırlar](denetim-raporlari/akademik-arsiv-kabul-raporu.md).

Profil/parola sıfırlama talebi öğretmen atamalarını ve veli bağlantılarını korur; temizleme yalnız gerçek rol değişiminde yapılır. Öğrenci profilini okul yönetimi düzenler. Öz parola değişimi mevcut parolanın doğrulanmasını gerektirir; parola/rol değişikliği eski oturumları geçersiz kılar.

Katılımı başlamış sınavın veya yanıt alınmış anketin soruları değiştirilemez. Yeni sürüm için yeni içerik oluşturun. Sınıf yükseltme ve dönem damgası tek işlemde yapılır; hedef sınıfta öğrenci numarası çakışması önlenir. E-posta worker'ı kayıtları geçici olarak sahiplenir.

[Migration ve bakım notları](guvenlik-ve-bakim.md).

Öğretmen ayrıntısındaki sınav listesi ekranda sayfalansa da Excel ve baskı bütün ilgili sınavları içerir. Öğrenci analizinde kimlik ve sonuçlar yüklenene kadar Excel/Yazdır kapalıdır; yükleme hatasında görünen hata giderildikten sonra rapor alınabilir. Raporlarda seçili kişi ve sınıf filtreleri yer alır. [Dışa aktarma ve baskı doğrulama kapsamı](denetim-raporlari/yonetici-denetim-raporu.md).

Çok sınıflı istatistik raporlarında baskı grafikleri en çok beş sınıflık gruplara ayrılır; yazı boyutu sabit kalır. Uzun grafik etiketleri kısaltılabilir; tam sınıf adları ve bütün değerler ayrıntılı tabloda bulunur.
