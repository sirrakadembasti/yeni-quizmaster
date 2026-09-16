# Quiz Master Yönetici Kullanıcı Kılavuzu

Bu kılavuz, `admin` rolündeki kullanıcıların okul yapısını, kullanıcıları, sınavları ve sistem kayıtlarını yönetmesi içindir.

## 1. Giriş ve hesap güvenliği

1. Ana sayfadaki **Giriş Yap** alanını açın.
2. Yönetici e-posta adresinizi ve şifrenizi girin.
3. Girişten sonra yönetici paneline yönlendirilirsiniz.

Şifrenizi unuttuysanız giriş penceresindeki **Şifremi Unuttum** bağlantısını kullanın. Gelen bağlantı tek kullanımlık ve süreli bir parola sıfırlama belirteci taşır. Ortak cihazlarda işiniz bittiğinde sağ üst kullanıcı menüsünden **Güvenli Çıkış** yapın.

## 2. Yönetici menüsü

- **Dashboard:** Sistem özeti ve son hareketler.
- **Sınav Yönetimi:** Sistemdeki sınavları yönetme ve gerektiğinde silme.
- **Sınavlar:** Sınav oluşturma ve düzenleme ekranı.
- **İstatistikler / Sınav Sonuçları:** Başarı, katılım ve sınav raporları.
- **Öğrenciler:** Öğrenci hesabı oluşturma, güncelleme ve silme.
- **Eğitmenler:** Öğretmen hesabı ve öğretmen detayları.
- **Sınıflar:** Sınıf listesi, öğrenci ve öğretmen atamaları.
- **Yönetim:** Dersler, sınıflar, kullanıcılar ve sistem logları.
- **Arşiv:** Arşivlenmiş kayıtlar.
- **Duyurular:** Okul, rol veya sınıf hedefli duyurular.
- **Ayarlar:** Profil, bildirim, işlem geçmişi ve şifre işlemleri.

## 3. Kullanıcı ve veli yönetimi
 
**Yönetim > Kullanıcılar** veya ilgili **Öğrenciler/Eğitmenler** ekranından:
 
1. **Yeni Kullanıcı** düğmesini seçin.
2. Ad, e-posta, rol ve gerekli başlangıç bilgilerini girin.
3. Öğrenci hesabı eklenirken veya düzenlenirken **Veli Bilgileri** sekmesinden Veli Adı, Yakınlık Derecesi (Anne, Baba vb.), Telefon, E-posta ve Adres bilgilerini kaydedebilirsiniz.
4. Kaydı tamamladıktan sonra öğrenciyi sınıfa, öğretmeni sorumlu olduğu sınıf ve branşa atayın.
 
### Öğrenci detay görünümü (`/students/:id`)
Yöneticiler bir öğrencinin adına tıkladığında 3 sekmeli detaylı arayüze erişir:
- **Sınav Bilgileri:** Öğrencinin tamamladığı sınavlar, puanlar, başarı trendi ve sınav detayına bağlantılar.
- **Öğrenci Bilgileri:** Öğrencinin temel kimlik, iletişim, okul numarası ve hesap durum bilgileri.
- **Veli Bilgileri:** Öğrenci velisine ait irtibat numaraları, yakınlık derecesi, e-posta ve açık adres bilgileri.
 
Önemli güvenlik davranışı: Herkese açık kayıt ekranından oluşturulan hesaplar yalnızca öğrenci rolü alır ve kendi isteğiyle bir sınıfa katılamaz. Sınıf ataması ve veli bilgisi tanımlamaları yetkili yönetim ekranından yapılmalıdır. Öğretmenler öğrencinin veli veya kişisel bilgilerine erişemez; yalnızca sınav sonuçlarını görebilir.
 
Kullanıcı silme kalıcı sonuç doğurabilir. Onay penceresinde doğru kullanıcıyı seçtiğinizi kontrol edin.
 
## 4. Ders ve sınıf yönetimi
 
### Ders oluşturma
 
1. **Yönetim > Dersler** sekmesini açın.
2. **Yeni Ders** seçeneğini kullanın.
3. Ders adı ve açıklamasını girip kaydedin.
 
### Sınıf oluşturma ve düzenleme
 
1. **Yönetim > Sınıflar** sekmesini açın.
2. Sınıf seviyesi, şubesi, açıklaması ve öğretmen bilgisini girin.
3. Sınıf detayından öğrenci ve branş öğretmeni atamalarını yönetin.
 
Seviyesi farklı bir öğrenciyi sınıfa taşırken uygulama ek onay isteyebilir. Sınıf silmeden önce bağlı öğrenci, öğretmen ve sınavları kontrol edin.
 
## 5. Sınav yönetimi ve yapay zeka ile soru üretimi
 
1. **Sınavlar > Yeni Sınav** ekranını açın.
2. Başlık, açıklama, ders, zorluk ve süreyi belirleyin.
3. Sınavın atanacağı sınıfları seçin.
4. **Sorular** sekmesinde seçenekleri ve doğru cevabı ekleyin.
5. **Yapay Zeka ile Soru Üret:** Google Gemini (`gemini-3.8-flash`) modeli kullanılarak belirtilen konu, zorluk ve soru adedine göre otomatik soru setleri oluşturabilirsiniz.
6. Önce taslak olarak kaydedin; kontrol tamamlanınca **Yayınlandı** durumuna alın.
 
En az bir sorusu olmayan sınav yayınlanamaz. Öğrenciler yalnızca yayınlanmış ve kendilerine atanmış sınavları görebilir. Taslak sınavlar öğrenci tarafından doğrudan bağlantı kullanılarak da başlatılamaz.
 
## 6. Sonuçlar, istatistikler ve yazdırma
 
- **Sınav Sonuçları (`/results`):** Sınav veya öğrenci bazında sonuçları filtreleyebilir, detayları inceleyebilirsiniz.
- **Sınıf İstatistikleri (`/class-statistics`):** Sınıf bazlı KPI metrikleri (Toplam Öğrenci, Katılımcı Sayısı, Katılım Oranı, Ortalama Başarı %) ve sınıf karşılaştırma grafiklerini içerir.
- **Yazdırma (Print):** Ekrandaki "Yazdır" butonu A4 sayfa yapısına ve dikey/yatay yönlendirmeye tam uyumludur. İlk sayfanın boş çıkması engellenmiş, arama ve filtreleme panelleri yazdırma çıktısında otomatik gizlenmiştir.

## 7. Duyurular ve bildirimler

Yönetici; okul geneline, belirli bir role veya sınıfa duyuru gönderebilir. Başlık, içerik ve hedefi kontrol ederek yayımlayın. Sağ üstteki zil simgesi okunmamış bildirimleri gösterir; **Hepsini Oku** ile bildirimleri topluca işaretleyebilirsiniz.

## 8. Loglar ve denetim

**Yönetim > Loglar** bölümünde giriş, oluşturma, güncelleme ve silme gibi sistem hareketlerini izleyin. Şüpheli bir işlemde kullanıcı, zaman ve işlem türünü birlikte değerlendirin.

## 9. Çevrimdışı sınav yönetimi

PWA çevrimdışı sınav altyapısı süresiz sınavlarda etkindir. Öğrenci, bağlantısı varken yayınlanmış ve sınıfına atanmış sınavı cihazına hazırlayabilir; çevrimdışı cevaplar aynı tarayıcıda saklanır ve bağlantı geri geldiğinde teslim sunucuya aktarılır.

- Doğru cevaplar cihazdaki çevrimdışı pakete eklenmez.
- Yetki ve sınıf ataması çevrimdışı paket hazırlanırken sunucuda denetlenir.
- Puanlama ve kesin teslim durumu yalnızca sunucuda oluşturulur.
- Süreli sınavlar güvenlik nedeniyle çevrimdışı hazırlanamaz veya başlatılamaz.
- Tarayıcı verilerinin temizlenmesi, cihaz değişimi veya gizli pencere kullanımı yerel cevapların kaybına neden olabilir.

## 10. Sorun giderme

- **Yetkisiz erişim:** Hesabın rolünü ve oturum durumunu kontrol edin.
- **Sınav öğrencide görünmüyor:** Sınavın yayın durumunu ve sınıf atamasını kontrol edin.
- **Duyuru yanlış grupta görünmüyor:** Rol ve sınıf hedefinin birlikte doğru seçildiğini doğrulayın.
- **İstek reddedildi:** Sayfayı yenileyip tekrar giriş yapın; güvenlik belirteci otomatik yenilenir.
- **Bağlantı sorunu:** İşlemi tekrarlamadan önce internet erişimini doğrulayın.
- **Çevrimdışı teslim bekliyor:** Öğrencinin aynı cihaz ve tarayıcıda sınavı yeniden açıp bağlantının geri gelmesini beklemesini sağlayın.
