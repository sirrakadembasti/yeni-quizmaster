# QuizMaster Gmail E-Posta ve Parola Sıfırlama Kılavuzu

Bu belge e-posta servisinin yapılandırmasını, parola sıfırlama iş akışını, yönetici ekranlarını ve ağ sorunlarını tek yerde açıklar.

4 Ekim 2026 gerçek bağlantı kontrolünde 587/STARTTLS, Gmail hesap doğrulaması ve kullanıcının izin verdiği adrese tek test gönderimi geçti; SMTP bir alıcıyı kabul etti. Kullanıcı bu konuşmada aynı test e-postasının ulaştığını ve mesaj içeriğini doğruladı. Bu teslim kanıtı kullanıcının beyanıdır; araçlarla gelen kutusu okunmadı ve yeni test e-postası gönderilmedi. Gerçek parola sıfırlama gönderimi bu koşuda doğrulanmadı. [Kullanıcı teslim doğrulaması](../tests/denetim-kanitlari/entegrasyon/smtp-delivery-confirmation.json), [gizli değer içermeyen transport sonucu](../tests/denetim-kanitlari/entegrasyon/smtp-probe.json), [güncel kabul kapsamı](denetim-raporlari/entegrasyon-denetim-raporu.md).

## 1. Desteklenen servis

QuizMaster yalnız Gmail SMTP kullanır:

- Sunucu: `smtp.gmail.com` (kod içinde sabit)
- Önerilen port: `587` (`STARTTLS`)
- Alternatif port: `465` (TLS)
- Kimlik doğrulama: Gmail adresi + Google Uygulama Parolası

`EMAIL_HOST`, `EMAIL_SECURE`, Mailpit, Brevo, Resend veya başka SMTP sağlayıcı ayarları kullanılmaz. Bu sınır, Gmail kimlik bilgilerinin yanlışlıkla farklı bir sunucuya gönderilmesini önler.

## 2. Gmail hesabını hazırlama

1. Gönderici Google hesabında iki adımlı doğrulamayı etkinleştirin.
2. Google hesabı güvenlik ayarlarından QuizMaster için ayrı bir **Uygulama Parolası** üretin.
3. Normal Gmail parolasını uygulamada kullanmayın.
4. Uygulama parolasını yalnız `server/.env` içinde tutun; ekrana, loga, commit'e veya destek mesajına yazmayın.

Kurumsal Google Workspace hesabında Uygulama Parolası seçeneği görünmüyorsa alan yöneticisinin güvenlik politikası bunu engelliyor olabilir. Bu durumda yetkili Google Workspace yöneticisine başvurun.

## 3. Ortam değişkenleri

Yeni ve temiz bir sunucuda `npm run setup` kurulum sihirbazı Gmail alanlarını güvenli form üzerinden alıp `server/.env` dosyasına yazabilir. Sihirbaz yalnız Gmail adresi ve Google Uygulama Parolası kabul eder; parolayı kurulum profiline, kilit dosyasına veya üretilen Nginx örneğine eklemez. Mevcut kurulumlarda veya elle yapılandırmada aşağıdaki alanları kullanın.

`server/.env` dosyasına aşağıdaki alanları ekleyin:

```env
EMAIL_USER=your-smtp-email@gmail.com
EMAIL_PASS=your-google-app-password
EMAIL_FROM=your-smtp-email@gmail.com
EMAIL_FROM_NAME=QuizMaster
EMAIL_PORT=587
FRONTEND_URL=http://localhost:5173

# İsteğe bağlı bağlantı zaman aşımları (milisaniye)
EMAIL_CONNECTION_TIMEOUT=10000
EMAIL_GREETING_TIMEOUT=10000
EMAIL_SOCKET_TIMEOUT=20000
```

Alanların anlamı:

| Değişken | Açıklama |
|---|---|
| `EMAIL_USER` | Gmail SMTP hesabı |
| `EMAIL_PASS` | Google Uygulama Parolası |
| `EMAIL_FROM` | Gönderen adresi; boşsa `EMAIL_USER` kullanılır |
| `EMAIL_FROM_NAME` | Alıcıda görünen gönderen adı |
| `EMAIL_PORT` | Yalnız `587` veya `465`; diğer değerler `587` olur |
| `FRONTEND_URL` | E-postadaki parola belirleme bağlantısının uygulama adresi |

Üretimde `FRONTEND_URL` değerini gerçek HTTPS adresi olarak ayarlayın. `.env` dosyasını Git'e eklemeyin.

## 4. Parola sıfırlama işleyişi

1. Kullanıcı giriş ekranındaki **Şifremi Unuttum** formuna e-postasını girer.
2. Sistem, e-posta adresi kayıtlı olsun veya olmasın hesap keşfini önleyen genel bir yanıt verir.
3. Kayıtlı kullanıcı için önceki bekleyen talepler iptal edilir.
4. Kriptografik olarak rastgele ham token üretilir.
5. Ham token yalnız e-postadaki bağlantıya yazılır; veritabanında SHA-256 özeti ve bir saatlik son kullanma zamanı saklanır.
6. Talep `PasswordResetRequest`, e-posta teslimatı `EmailQueue` tablosuna yazılır.
7. Arka plan işçisi bekleyen e-postayı Gmail SMTP üzerinden gönderir.
8. Kullanıcı bağlantıyı açıp yeni parolayı kaydettiğinde talep `completed` olur ve token geçersizleştirilir.

Parola sıfırlama bağlantısı tek kullanımlıdır. Yeni bir talep oluşturulması eski bekleyen bağlantıyı geçersiz kılar.

## 5. Outbox kuyruğu

E-posta HTTP isteği sırasında doğrudan gönderilmek yerine önce veritabanına kaydedilir. Arka plan işçisi kuyruğu düzenli aralıklarla işler.

Başlıca durumlar:

| Durum | Anlamı |
|---|---|
| `pending` | Kuyrukta veya yeniden denenecek |
| `sent` | Gmail SMTP gönderimi kabul etti |
| `failed` | Azami deneme sayısı sonunda gönderilemedi |

`sent` durumu e-postanın alıcının gelen kutusunda kesin okunduğu anlamına gelmez; Gmail SMTP sunucusunun mesajı kabul ettiğini gösterir.

## 6. Yönetici işlemleri

**Yönetim > Loglar** içinde iki ilgili alan vardır.

### Şifre Talepleri

- Kullanıcı e-postasıyla yönetici tarafından yeni talep oluşturma (SMTP üzerinden gönderim veya **Bağlantı Üret (SMTP'siz)** ile tek kullanımlık bağlantıyı doğrudan üretip kopyalama)
- Durum ve metin filtresi
- Talep zamanı, son geçerlilik ve bağlı e-posta kuyruğu durumu
- **Bağlantı Üret:** SMTP çıkışının engelli olduğu yerel/kurumsal ağlarda ilgili talep için tek kullanımlık sıfırlama bağlantısını yeniden üretir ve kopyalanabilir kutuda gösterir
- **Yenile:** Yeni token ve yeni e-posta üretir; eski bekleyen talebi geçersizleştirir
- **İptal:** Yalnız bekleyen talebi ve kullanıcıdaki eşleşen tokeni geçersiz kılar
- **Terminal / CLI kurtarma:** Yönetici paneline erişilemediği durumlarda `npm run db:reset-admin --workspace=server` komutuyla tek kullanımlık sıfırlama bağlantısı üretilebilir veya `--password` ile parola doğrudan güncellenebilir.

### Kayıt Bilgilendirme E-postası

- Kendi kendine kayıt olan (`POST /api/auth/register`) veya yönetici/öğretmen tarafından oluşturulan (`POST /api/users`) kullanıcılar için kayıt işleminin başarıyla tamamlandığını bildiren `registration_welcome` türünde bilgilendirme e-postası Outbox kuyruğuna eklenir. E-posta doğrulama zorunluluğu yerine bilgilendirme + kayıtlı e-posta üzerinden parola sıfırlama modeli uygulanır.

### E-Posta Logları

- Alıcı, konu, tür, durum, deneme sayısı ve hata bilgisi
- Bekleyen/hatalı kayıtları tekrar kuyruğa alma
- Gereksiz teknik logu silme
- Teslimat durumu sayaçları ve filtreler

Güvenlik nedeniyle token içeren HTML e-posta gövdesi API yanıtıyla yönetici arayüzüne gönderilmez. E-posta Logları teknik izleme içindir; kullanıcıya parola bağlantısı göstermenin alternatif yolu değildir.

## 7. Güvenlik kuralları

- `EMAIL_PASS` yalnız Google Uygulama Parolası olmalıdır.
- Gizli değerleri loglamayın, ekran görüntüsüne koymayın ve commit etmeyin.
- Parola tokeninin yalnız özeti veritabanında tutulur.
- Token kullanım, iptal veya süre bitiminde geçersiz olur.
- Yönetici parola sıfırlama endpoint'leri oturum, `admin` rolü ve CSRF koruması gerektirir.
- E-posta kuyruğu yanıtları token içeren gövdeyi istemciye açmaz.
- Üretimde `SESSION_SECRET` ve `FRONTEND_URL` güvenli/doğru değerlerle ayarlanmalıdır.

## 8. Bağlantıyı test etme

1. Backend'i yeniden başlatın; `.env` değişiklikleri çalışan sürece otomatik uygulanmayabilir.
2. Yönetici hesabıyla **Yönetim > Loglar > Şifre Talepleri** bölümünü açın.
3. Test kullanıcısının kayıtlı e-postası için talep oluşturun.
4. Talebin `pending`, ardından e-posta kaydının `sent` olmasını bekleyin.
5. Gelen e-postadaki bağlantıyı açın ve test parolasını belirleyin.
6. Aynı bağlantıyı ikinci kez kullanmayı deneyin; sistemin reddetmesi gerekir.

Canlı testte gerçek kullanıcının parolasını değiştirmeyin; ayrı bir test hesabı kullanın.

## 9. Kurumsal ağ ve Outlook ilişkisi

Bilgisayarda Outlook ve kurumsal POP3/SMTP hesabının bulunması QuizMaster'ın Gmail ayarlarını otomatik değiştirmez. Outlook kendi hesap yapılandırmasını kullanır; QuizMaster Node.js üzerinden doğrudan `smtp.gmail.com` bağlantısı açar.

Ancak kurum ağı dışarı giden SMTP trafiğini merkezi güvenlik duvarında engelleyebilir. Bu durumda:

- Outlook'un kurum içi sunucusuna bağlanması çalışırken Gmail `587/465` zaman aşımına uğrayabilir.
- `ETIMEDOUT`, bağlantının SMTP sunucusuna ulaşmadan ağda engellenmesine işaret edebilir.
- `EAUTH` veya `535` hatası genellikle Gmail hesabı/Uygulama Parolası problemidir.
- `ENOTFOUND` ad çözümleme problemidir; fakat tarayıcı/curl çalışırken yalnız Node etkileniyorsa yerel Node çalışma ortamı da kontrol edilmelidir.

Proxy veya DNS ayarlarını değiştirmeden önce cep interneti gibi SMTP çıkışına izin veren ayrı bir ağda aynı testi yapın. Cep internetinde çalışıp kurum ağında çalışmıyorsa sorun büyük olasılıkla kurumun çıkış kuralıdır; kurum bilgi işlem birimiyle görüşün.

## 10. Sorun giderme tablosu

| Belirti | Olası neden | Kontrol |
|---|---|---|
| Gmail yapılandırılmadı | Kullanıcı/parola boş | `EMAIL_USER`, `EMAIL_PASS` |
| `EAUTH` / `535` | Normal parola veya geçersiz Uygulama Parolası | 2FA ve yeni Uygulama Parolası |
| `ETIMEDOUT` | Ağ 587/465 çıkışını engelliyor | Cep internetinde tekrar test |
| `ECONNREFUSED` | Hedefe erişim/port sorunu | Port ve güvenlik duvarı |
| `ENOTFOUND` | DNS/Node ad çözümleme sorunu | Sistem ve Node çözümlemesini karşılaştır |
| Kayıt `pending` kalıyor | İşçi çalışmıyor veya SMTP hatası | Backend logu ve E-posta Logları |
| Kayıt `sent`, e-posta yok | Spam/karantina/alıcı politikası | Spam ve Gmail teslimat durumu |
| Bağlantı geçersiz | Süre doldu, iptal edildi veya yenisi üretildi | Yeni Şifre Talebi oluştur |
| Yanlış adrese yönleniyor | `FRONTEND_URL` hatalı | Ortam adresini düzeltip backend'i yeniden başlat |

## 11. Bakım notları

- E-posta kayıtlarını operasyonel saklama politikasına göre temizleyin.
- Çok sayıda `failed` kaydı varsa yeniden denemeden önce temel ağ/kimlik sorununu çözün.
- Gmail hesabı veya Uygulama Parolası değiştiğinde backend'i yeniden başlatın.
- Uygulama Parolasını düzenli olarak döndürün ve eski parolayı Google hesabından iptal edin.
- Üretim geçişinde `FRONTEND_URL`, HTTPS, oturum çerezi ve ters proxy ayarlarını birlikte doğrulayın.

## Eşzamanlı worker ve oturumlar

Worker e-postayı gönderimden önce beş dakika için veritabanında sahiplenir. Başka worker bu sürede aynı kaydı seçmez; başarı/hata kaydı sahiplenmeyi serbest bırakır. Çöken işlemin kaydı süre dolunca yeniden alınabilir. SMTP kabulünden sonra başarı kaydı yazılmadan çökme tekrar teslim üretebilir; Outbox en az bir kez teslim yaklaşımıdır. Aktif gönderim manuel yeniden denemeyle kopyalanamaz.

Sıfırlama talebi öğretmen/veli ilişkilerini korur. Parola gerçekten değiştiğinde oturum sürümü artar; eski HTTP oturumları geçersiz olur ve bildirim bağlantıları kapanır. SMTP testleri gerçek Gmail kimlik bilgilerini yüklemez.
