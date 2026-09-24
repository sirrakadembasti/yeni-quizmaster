# QuizMaster Veli Kullanıcı Kılavuzu

Bu kılavuz `parent` rolündeki kullanıcıların kendileriyle ilişkilendirilmiş öğrencilerin sınav durumunu takip etmesi içindir.

## 1. Veli hesabının oluşturulması

Veli hesabını okul yöneticisi oluşturur. Yönetici ad, e-posta, ilk şifre, telefon, adres ve öğrenciyle yakınlık bilgilerini kaydeder; ardından hesabı bir veya daha fazla öğrenciyle ilişkilendirir.

Öğrencinin kayıtlarında yazan veli e-postası tek başına giriş hesabı oluşturmaz. Uygulamaya giriş için ayrıca `parent` rolündeki hesabın oluşturulmuş ve öğrenciyle bağlanmış olması gerekir.

## 2. Giriş ve şifre

1. Yönetici tarafından verilen e-posta ve ilk şifreyle giriş yapın.
2. İlk fırsatta **Ayarlar** üzerinden şifrenizi değiştirin.
3. Şifrenizi unutursanız **Şifremi Unuttum** ile Gmail bağlantısı isteyin.
4. Ortak cihazda **Güvenli Çıkış** yapın.

## 3. Veli paneli

Birden fazla öğrenci hesabınıza bağlıysa sağ üstteki öğrenci seçicisinden izlemek istediğiniz öğrenciyi seçin. Panelde:

- öğrencinin adı, sınıfı ve e-postası,
- ortalama başarı,
- tamamlanan sınav sayısı,
- bekleyen sınav sayısı,
- sınav sonuçları,
- atanmış sınavlar ve tamamlanma durumu

gösterilir.

## 4. Erişim sınırları

- Panel salt okunurdur; veli sınav başlatamaz, cevap değiştiremez veya öğrenci bilgisi güncelleyemez.
- Yalnız yönetici tarafından hesabınıza bağlanan öğrencileri görebilirsiniz.
- Başka bir öğrenci kimliğine doğrudan bağlantı veya API isteğiyle erişim sunucu tarafından engellenir.
- Anket cevapları ve öğrencinin özel sınav cevapları veli panelinde gösterilmez.

Bağlantı eksik veya yanlışsa okul yönetimiyle iletişime geçin.

## 5. Ayarlar ve bildirimler

**Ayarlar** ekranında kendi profil ve güvenlik bilgilerinizi yönetin. Bildirim sekmesinde bildirim sesini açıp kapatabilir ve bildirimleri silebilirsiniz. Üst menü en fazla son 5 bildirimi gösterir.

## 6. Sorun giderme

- **Bağlı öğrenci yok:** Yöneticiden veli hesabınızı öğrenciyle ilişkilendirmesini isteyin.
- **Sonuç eksik:** Öğrencinin sınavı sunucuya teslim ettiğini doğrulayın.
- **Şifre bağlantısı gelmedi:** Spam klasörünü kontrol edin; yöneticiden Şifre Talepleri ve E-posta Loglarını incelemesini isteyin.
- **Yetkisiz erişim:** Doğru veli hesabıyla giriş yaptığınızdan ve öğrenci bağlantısının kaldırılmadığından emin olun.
