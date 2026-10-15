# QuizMaster Veli Kullanıcı Kılavuzu

Bu kılavuz `parent` rolündeki kullanıcıların kendileriyle ilişkilendirilmiş öğrencilerin sınav durumunu takip etmesi içindir.

## 1. Veli hesabının oluşturulması

Veli hesabını okul yöneticisi oluşturur. Yönetici ad, e-posta, ilk şifre, telefon, adres ve öğrenciyle yakınlık bilgilerini kaydeder; ardından hesabı bir veya daha fazla öğrenciyle ilişkilendirir.

Yönetici hesabı oluşturduktan sonra ayrı **Veli Eşleştirme** sayfasında arama yaparak öğrenciyi bağlar. Öğrenci detayındaki **Giriş Yapabilen Veli Hesapları** alanı da aynı güvenli ilişki tablosunu kullanır. Yakınlık **Anne / Baba / Diğer** seçeneklerinden biridir.

Öğrencinin kayıtlarında yazan veli e-postası tek başına giriş hesabı oluşturmaz. Uygulamaya giriş için ayrıca `parent` rolündeki hesabın oluşturulmuş ve öğrenciyle bağlanmış olması gerekir.

## 2. Giriş ve şifre

1. Yönetici tarafından verilen e-posta ve ilk şifreyle giriş yapın.
2. İlk fırsatta **Ayarlar** üzerinden şifrenizi değiştirin.
3. Şifrenizi unutursanız **Şifremi Unuttum** ile Gmail bağlantısı isteyin.
4. Ortak cihazda **Güvenli Çıkış** yapın.

## 3. Veli paneli

Sol menüdeki **Sınav Sonuçları** sayfasında bağlı öğrenci seçilir. Tamamlanan sınavlar puan ve tarih ile listelenir; **Detay** düğmesi soru bazında öğrencinin cevabını ve doğru cevabı salt okunur gösterir. Başka bir veliye veya öğrenciye ait sonuç doğrudan adresle açılamaz.

Birden fazla öğrenci hesabınıza bağlıysa sağ üstteki öğrenci seçicisinden izlemek istediğiniz öğrenciyi seçin. Panelde:

- öğrencinin adı, sınıfı ve e-postası,
- ortalama başarı,
- tamamlanan sınav sayısı,
- bekleyen sınav sayısı,
- sınav sonuçları,
- atanmış sınavlar ve tamamlanma durumu

gösterilir.

Öğrenci seçimi bağlantıdaki `studentId` ile korunur. Öğrenci Takibi sayfasından sonuçlara geçtiğinizde, sayfayı yenilediğinizde veya tarayıcının geri düğmesini kullandığınızda aynı bağlı öğrenciyi izlersiniz. Bağlantıdaki öğrenci artık hesabınıza bağlı değilse ilk bağlı öğrenci seçilir.

Sonuç detayında soru görseli, öğrencinin cevabı, doğru cevap ve **Doğru / Yanlış / Yanıtsız** durumu gösterilir. Görsel yüklenemezse açıklayıcı mesaj görüntülenir.

## 4. Erişim sınırları

- Panel salt okunurdur; veli sınav başlatamaz, cevap değiştiremez veya öğrenci bilgisi güncelleyemez.
- Yalnız yönetici tarafından hesabınıza bağlanan öğrencileri görebilirsiniz.
- Başka bir öğrenci kimliğine doğrudan bağlantı veya API isteğiyle erişim sunucu tarafından engellenir.
- Anket cevapları veli panelinde gösterilmez. Tamamlanan sınavlarda soru, öğrencinin cevabı ve doğru cevap yalnız salt okunur sonuç detayı olarak gösterilir.

Veli bağlı öğrencilerin yalnız tamamlanmış sınavlarını veli panelinin özel rotalarından okur. Genel öğrenci/sınıf rotaları veliye açık değildir; başka öğrencilerin listeleri veya devam eden sınavın cevap anahtarı görüntülenemez. Duyurular veli/tüm roller ve uygun sınıf hedefiyle süzülür.

Profil/parola sıfırlama talebi öğrenci bağlantısını kaldırmaz. Parola sıfırlanınca eski oturumlarla yeniden giriş gerekir.

Bağlantı eksik veya yanlışsa okul yönetimiyle iletişime geçin.

## 5. Ayarlar ve bildirimler

**Ayarlar** ekranında kendi profil ve güvenlik bilgilerinizi yönetin. Bildirim sekmesinde bildirim sesini açıp kapatabilir ve bildirimleri silebilirsiniz. Üst menü en fazla son 5 bildirimi gösterir.

Aktif bağlı öğrencinizin sınıfına gönderilen veli duyuruları size de bildirilir. Aynı sınıfta birden fazla bağlı öğrenciniz varsa aynı duyuru için tek bildirim alırsınız.

Profil yazdırılırken kaydedilmiş bilgiler kullanılır. Bildirimlerde mevcut sayfadaki tüm satırlar yazdırılır; sonraki sayfanın çıktısı için önce o sayfaya geçin. Güvenlik sekmesinde Yazdır düğmesi bulunmaz; tarayıcının yazdırması da parola alanlarını ve girilmiş değerleri gizler.

## 6. Sorun giderme

- **Bağlı öğrenci yok:** Yöneticiden veli hesabınızı öğrenciyle ilişkilendirmesini isteyin.
- **Bilgiler getirilemedi:** **Tekrar dene** düğmesini kullanın. Bağlantı hatası, öğrenci veya sınav kaydı olmadığı anlamına gelmez. Sonuç detayında listeye dönerek yeniden seçim yapabilirsiniz.
- **Sonuç eksik:** Öğrencinin sınavı sunucuya teslim ettiğini doğrulayın.
- **Şifre bağlantısı gelmedi:** Spam klasörünü kontrol edin; yöneticiden Şifre Talepleri ve E-posta Loglarını incelemesini isteyin.
- **Yetkisiz erişim:** Doğru veli hesabıyla giriş yaptığınızdan ve öğrenci bağlantısının kaldırılmadığından emin olun.
