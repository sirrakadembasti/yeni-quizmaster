# Quiz Master Öğretmen Kullanıcı Kılavuzu

Bu kılavuz, `teacher` rolündeki kullanıcıların kendi sınıfları için sınav, öğrenci sonucu ve duyuru süreçlerini yönetmesi içindir.

## 1. Giriş ve ana ekran

E-posta ve şifrenizle giriş yaptığınızda öğretmen dashboard'u açılır. Ana ekranda branşlarınız, sorumlu olduğunuz sınıflar, özet bilgiler ve son hareketler gösterilebilir.

Şifrenizi unuttuysanız **Şifremi Unuttum** akışını kullanın. Ortak cihazlarda sağ üst menüden **Güvenli Çıkış** yapın.

## 2. Öğretmen menüsü

- **Sınavlarım:** Oluşturduğunuz sınavlar.
- **İstatistikler:** Kişisel/sınav bazlı başarı özetleri.
- **Sınav Sonuçları:** Öğrenci teslimleri ve raporlar.
- **Öğrenciler:** Yetkiniz kapsamındaki öğrenci listeleri.
- **Sınıflarım:** Sorumlu olduğunuz sınıflar ve sınıf detayları.
- **Duyurular:** Sınıfa yönelik duyuru oluşturma ve görüntüleme.
- **Ayarlar:** Profil, bildirimler, kişisel işlem geçmişi ve şifre.

## 3. Sınav oluşturma

1. **Sınavlarım** ekranından yeni sınav oluşturun.
2. **Ayarlar** sekmesinde başlık, açıklama, ders, zorluk, süre, soru karıştırma ve sınıf atamalarını belirleyin.
3. **Sorular** sekmesinde soru metnini, seçenekleri ve doğru cevabı girin.
4. İsterseniz yapılandırılmış AI soru üretme aracını kullanıp üretilen soruları mutlaka gözden geçirin.
5. Sınavı taslak kaydedin; son kontrolden sonra yayınlayın.

En az bir soru eklenmeden sınav yayınlanamaz. Öğretmen yalnızca sorumlu olduğu sınıflara sınav atayabilir; başka bir sınıf kimliği API üzerinden gönderilse bile sunucu isteği reddeder.

## 4. Sınavı yayınlama ve öğrenci erişimi

Yayınlamadan önce şunları kontrol edin:

- Doğru ders ve sınıf seçildi mi?
- Süre dakika cinsinden doğru mu?
- Her sorunun doğru cevabı işaretli mi?
- Soru metni ve seçeneklerde hata var mı?

Öğrenci yalnızca yayınlanmış ve kendi sınıfına atanmış sınavı başlatabilir. Taslak veya başka sınıfa ait bir sınav doğrudan bağlantıyla açılamaz.

Süre alanı çevrimdışı kullanımı da belirler:

- **Süresiz sınav:** Öğrenci bağlantısı varken sınavı cihazına hazırlayıp daha sonra çevrimdışı çözebilir.
- **Süreli sınav:** Güvenlik ve sunucu zamanı denetimi nedeniyle çevrimdışı hazırlanamaz veya başlatılamaz.

## 5. Sınav sırasında güvenlik davranışı

- Öğrencinin seçimi sunucuya otomatik kaydedilir.
- Cevap kaydından sonra doğru/yanlış bilgisi öğrenciye verilmez.
- Sayfa yenilendiğinde sınav süresi baştan başlamaz; kalan süre sunucudaki başlangıç zamanına göre hesaplanır.
- Süre bittikten sonra sunucu yeni cevap kabul etmez.
- Öğrenci tamamlanmamış sınavın cevap anahtarını sonuç ekranından görüntüleyemez.

## 6. Sonuçları inceleme

**Sınav Sonuçları** ekranında sınavı seçerek katılım, puan ve öğrenci bazlı sonuçları inceleyin. Filtreleri kullanabilir, raporları yazdırabilir veya mevcut dışa aktarma seçeneğini kullanabilirsiniz.

## 7. Sınıflar ve öğrenciler

**Sınıflarım** ekranında yalnızca sorumlu olduğunuz sınıflar görüntülenir. Sınıf detayından öğrenci listesini ve ilgili bilgileri inceleyebilirsiniz. Yetkiniz dışında bir sınıfa sınav veya duyuru atamaya çalışırsanız işlem güvenlik nedeniyle reddedilir.

## 8. Duyuru oluşturma

1. **Duyurular** ekranını açın.
2. Başlık ve içeriği girin.
3. Sorumlu olduğunuz hedef sınıfı seçin.
4. Duyuruyu yayımlayın.

Öğretmen duyurularında hedef sınıf zorunludur. Sınıfa özel duyuru yalnızca o sınıftaki öğrencilere görünür. Okul geneline duyuru yetkisi yöneticidedir.

## 9. Hesap ve bildirimler

Sağ üst zil simgesinden bildirimleri okuyabilir ve tümünü okundu işaretleyebilirsiniz. **Ayarlar** ekranında profilinizi güncelleyebilir, işlem geçmişinizi inceleyebilir ve şifrenizi değiştirebilirsiniz.

## 10. Çevrimdışı kullanım

Öğrenci, süresiz sınavı internet bağlantısı varken **Çevrimdışı Hazırla** ile kullandığı cihaza alabilir. Cevaplar bağlantı yokken cihazda tutulur; teslim bağlantı geri geldiğinde sunucuya aktarılır ve puanlama sunucuda yapılır. Çevrimdışı pakette doğru cevaplar bulunmaz.

Süreli sınavlar çevrimdışı başlatılamaz. Çevrimiçi başlayan süreli sınavda bağlantı kesilirse öğrenci cevaplamaya devam edebilir; ancak sunucudaki süre dolduktan sonra ulaşan yeni cevaplar güvenlik nedeniyle kabul edilmez.

## 11. Sorun giderme

- **Sınıf seçilemiyor:** Yöneticiden öğretmen–sınıf atamasını kontrol etmesini isteyin.
- **Sınav yayınlanmıyor:** En az bir geçerli soru bulunduğunu kontrol edin.
- **Öğrenci sınavı göremiyor:** Yayın durumunu ve sınıf atamasını doğrulayın.
- **Cevap sunucuya ulaşmadı:** Öğrencinin aynı cihaz ve tarayıcıyı kullandığını, bekleyen teslim ekranını yeniden açtığını ve internet bağlantısının geri geldiğini kontrol edin.
- **403/yetki hatası:** Hedef sınıfın sorumluluğunuzda olduğundan emin olun.
