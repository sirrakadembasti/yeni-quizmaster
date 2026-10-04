# QuizMaster Öğretmen Kullanıcı Kılavuzu

Bu kılavuz `teacher` rolündeki kullanıcıların yetkili oldukları ders ve sınıflarda sınav, anket, öğrenci sonucu ve duyuru süreçlerini yönetmesi içindir.

Güncel onarımların kabul kapsamı ve kanıtları: [Entegrasyon onarımları](integration-audit/defect-repairs.md).

## 1. Giriş ve profil

E-posta ve şifrenizle giriş yaptığınızda öğretmen dashboard'u açılır. Branşlarınız, sorumlu sınıflarınız ve dersine girdiğiniz sınıflar yetki kapsamınızı belirler.

- **Şifremi Unuttum** bağlantısı Gmail üzerinden bir saat geçerli parola belirleme bağlantısı gönderir.
- **Ayarlar > Profil** alanından telefon, adres ve kişisel iletişim bilgilerinizi güncelleyebilirsiniz.
- Ders, branş, rol ve sınıf atamalarını yalnız yönetici değiştirebilir.

## 2. Öğretmen menüsü

- **Sınavlarım:** Tablo ve sayfalama ile sınavlarınız; yeni sınav oluşturma.
- **Sınıf İstatistikleri:** Yetkili sınıfların tarih aralıklı analizleri.
- **Sınav Sonuçları:** Yetkili sınavların öğrenci sonuçları.
- **Anket Yönetimi:** Anket oluşturma/düzenleme ve sonuçlar.
- **Öğrenciler:** Yalnız dersine girdiğiniz veya yetkili olduğunuz sınıflardaki öğrenciler.
- **Sınıflarım:** Yetkili sınıflar ve sınıf detayları.
- **Duyurular:** Yalnız dersine girdiğiniz sınıflardaki öğrencilere duyuru.
- **Ayarlar:** Profil, bildirim, işlem geçmişi ve parola.

Bu sınırlar yalnız arayüzde değil API ve veritabanı sorgularında da uygulanır.

## 3. Sınav oluşturma

1. **Sınavlarım > Yeni Sınav** ekranını açın.
2. Başlık, açıklama, ders, zorluk, süre, karıştırma ve hedef sınıfları girin.
3. Soruyu, seçenekleri ve doğru cevabı ekleyin.
4. Gerekirse varsayılan olarak kapalı **Soru Görseli (Opsiyonel)** alanını açıp görsel yükleyin.
5. **Soru Ekle** sonrası yeni soru listenin en üstünde görünür.
6. Gemini AI ile konu, zorluk ve adet belirleyerek soru üretebilir; soruları eklemeden önce düzenleyebilirsiniz.
7. Önce taslak kaydedin, kontrol ettikten sonra yayınlayın.

**Yeni Sınav** yalnız sınav oluşturur; anket işlemleri **Anket Yönetimi** içindedir. Yetkiniz olmayan sınıf kimliği gönderilirse sunucu işlemi reddeder.

AI üretiminde konu, soru adedi ve sağlayıcı alanlarını geçerli değerlerle doldurun. Sunucu geçersiz üretim isteğini reddeder. Özel sağlayıcı adresini, anahtarını, modelini veya sağlayıcı seçimini değiştirdiğinizde önceki **HAZIR** göstergesi kaldırılır; yeni ayarlarla yapılandırma testini tekrar çalıştırın. Üretilen soruları sınava eklemeden önce inceleyin.

## 4. Sınav yayını ve güvenlik

- En az bir geçerli soru olmadan sınav yayınlanamaz.
- Öğrenci yalnız yayınlanmış ve kendi sınıfına atanmış sınava erişir.
- Cevap kaydında doğru/yanlış bilgisi gösterilmez.
- Sayfa yenileme süreyi sıfırlamaz; süre sunucu başlangıcına göre hesaplanır.
- Sunucudaki süre dolduktan sonra yeni cevap kabul edilmez.
- Tamamlanmamış sınavın cevap anahtarı öğrenciye gönderilmez.

**Önizle** ile açılan sınavda bitirme onayı da önizleme olduğunu belirtir. Önizleme sonucunuz kaydedilmez ve öğrenci sonucu oluşturmaz.

## 5. Anket Yönetimi

**Anket Yönetimi** sayfasında:

- **Anket Oluştur** sekmesinden hedef sınıf ve soruları belirleyin.
- Tek seçim, çoklu seçim, açık uçlu, derecelendirme ve Likert türlerini kullanın.
- Puan ve doğru cevap tanımlamayın; anketler notlandırılmaz.
- İsteğe bağlı görsel alanını açıp soru görseli ekleyin.
- **Anket Sonuçları** sekmesinde tarih/anket filtresi, katılım oranı, cevap dağılımı, açık uçlu cevap, grafik ve tabloları inceleyin.

Yalnız kendi oluşturduğunuz veya yetkili sınıflarınıza atanmış anketlere erişebilirsiniz. **Excel** ayrıntılı `.xlsx`, **Yazdır** A4 uyumlu rapor üretir.

## 6. Sonuçlar ve sınıf istatistikleri

- **Sınav Sonuçları** ekranında ders, sınav ve sınıf filtrelerini kullanın. Anketler sınav filtresinde görünmez.
- **Sınıf İstatistikleri** ekranında başlangıç/bitiş tarihi ile yetkili sınıfların katılım ve başarı grafiklerini karşılaştırın.
- Öğrenci detayında yalnız sınav bilgisi ve sonuçları gösterilir; kişisel veli alanları gösterilmez.
- Filtrelenmiş listeyi **Excel** ile indirin veya **Yazdır** ile A4/PDF çıktısı alın.

Öğrenci raporundaki **Öğrenci Kodu** tam kimliği gösterir; uzun kod satıra bölünür. Sınıf istatistiği verileri yüklendiğinde baskı grafiği katılım ve başarı değerlerini tamamlanmış çubuklarla gösterir; filtre değişikliğinden sonra yeni verinin yüklenmesini bekleyin.

## 7. Öğrenciler ve sınıflar

**Öğrenciler** ve **Sınıflarım** ekranları yalnız yetkili olduğunuz sınıfları temel alır. Doğrudan URL veya API isteği kullanarak başka sınıfın öğrencilerine erişemezsiniz.

Yönetici tarafından pasife alınmış öğrenci aktif listelerde gösterilmez. Öğrencinin sınıf numarası sistem tarafından atanır; öğretmen bu numarayı elle değiştiremez.

Liste ve sınıf detayında **Excel** ve **Yazdır** seçenekleri; rapor başlığı, tarih, filtre ve tabloyu korur.

## 8. Duyuru ve bildirim

1. **Duyurular > Yeni Duyuru** alanını açın.
2. Başlık ve içeriği yazın.
3. Dersine girdiğiniz hedef sınıfı seçin.
4. Yayımlayın.

Öğretmen başka öğretmenlere veya okul geneline duyuru gönderemez. Duyuru yalnız seçilen sınıfın öğrencilerine ulaşır ve alıcıda gönderen adı/rolü görünür.

- Üst menü son 5 bildirimi gösterir.
- Bildirim tek tek silinebilir.
- **Tüm Bildirimleri Gör** Ayarlar bildirim sekmesini açar.
- Bildirim sesi zil alanından veya Ayarlardan kapatılıp açılabilir.
- Sınavı tamamlayan ilgili öğrencilerin bildirimleri sınavın öğretmenine yönlendirilir.
- Yükleme hatasında **Yeniden dene** görünür; hata boş bildirim listesi olarak gösterilmez. **Hepsini Oku** başarısız olursa hata mesajı görünür ve bildirimlerin okunma durumu korunur.

## 9. Excel ve yazdırma

- **Excel** düğmesi gerçek `.xlsx` dosyası indirir ve Türkçe karakterleri korur.
- Başlık, seçili filtreler, tablo başlığı, otomatik sütun genişliği ve filtre satırı Excel dosyasına eklenir.
- Yazdırmada yan menü, üst menü, düğmeler ve filtre kontrolleri gizlenir.
- Rapor tablolarındaki **İşlemler / Eylem** başlıkları ve bu sütunların hücreleri de baskıda gizlenir; sonuç ve kimlik bilgileri korunur.
- Dashboard'da yazdırma yoktur; rapor ve detay sayfalarında bulunur.

## 10. Çevrimdışı sınav

- Süresiz sınav öğrencinin cihazına bağlantı varken hazırlanabilir.
- Cevaplar aynı cihaz/tarayıcıda yerel olarak saklanır.
- Bağlantı geldiğinde teslim sunucuya aktarılır ve puanlama sunucuda yapılır.
- Süreli sınav çevrimdışı başlatılamaz; çevrimiçi başladıktan sonra bağlantı kesilse de sunucu süresi işlemeye devam eder.

## 11. Sorun giderme

- **Sınıf/öğrenci görünmüyor:** Yöneticiden ders-sınıf yetkinizi kontrol etmesini isteyin.
- **Sınav/anket yayınlanmıyor:** Geçerli soru ve hedef sınıf bulunduğunu doğrulayın.
- **Görsel yüklenmiyor:** Desteklenen görsel türü, 5 MB istemci sınırı ve bağlantıyı kontrol edin.
- **Sonuç filtresi boş:** Seçilen ders-sınav ilişkisinin ve tarih aralığının uyumlu olduğunu kontrol edin.
- **403 hatası:** Hedef kaydın yetki alanınızda olduğundan emin olun.
- **Çevrimdışı teslim bekliyor:** Öğrencinin aynı cihaz/tarayıcıyla bağlantıya dönmesini sağlayın.

## Düzenleme ve erişim sınırları

Katılım/yanıt sonrası soru değişikliği 409 ile reddedilir; cevap geçmişi korunur. Taslaklarda mevcut soru kimlikleri korunur. Yeni sürüm için yeni sınav/anket oluşturun.

Öğrenci taşırken kaynak ve hedef sınıf yetkili olmalıdır. Çıkarma yalnız belirtilen sınıfa ait öğrenci için yapılabilir. Önizleme kendi sınavlarınızla sınırlıdır. Sonuç raporları öğrenci/veli adresi, telefon ve kurtarma bilgilerini içermez.

Kendi parola değişiminde mevcut parola doğrulanır. Profil/parola işlemi branş/sınıf atamalarınızı değiştirmez. AI özel sağlayıcısı genel internet üzerinde HTTPS kullanmalıdır; özel ağ adresleri ve redirect reddedilir.

Sınav Sonuçları → Öğrenci Raporları bölümünde Doğru/Toplam alanı sıfır doğru cevabı da gösterir. Excel ve öğrenci filtresi Genel Bakış sekmesindedir; aynı filtre Öğrenci Raporları ve yazdırılan karnelere uygulanır.

Parola sıfırlama bağlantısında gönderim sırasında “Güncelleniyor...” görünür ve tekrar gönderim engellenir. İstek başarısız olursa form değerleri korunur ve yeniden deneme açılır; geçersiz veya süresi dolmuş bağlantı için yeni bağlantı isteyin.

Çok sınıflı istatistik raporlarında baskı grafikleri en çok beş sınıflık gruplara ayrılır; yazı boyutu sabit kalır. Uzun grafik etiketleri kısaltılabilir; tam sınıf adları ve bütün değerler ayrıntılı tabloda bulunur.
