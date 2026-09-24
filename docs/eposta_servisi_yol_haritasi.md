# QuizMaster Gmail E-Posta Servisi

QuizMaster parola sıfırlama e-postalarını yalnız Gmail SMTP üzerinden gönderir. Mailpit, Brevo, Resend veya başka SMTP sunucuları etkin değildir.

## Yapılandırma

Google hesabında iki adımlı doğrulamayı etkinleştirin ve QuizMaster için ayrı bir Uygulama Parolası üretin. Gizli değerleri yalnız `server/.env` içinde tutun:

```env
EMAIL_USER=your-smtp-email@gmail.com
EMAIL_PASS=your-new-gmail-app-password
EMAIL_FROM=your-smtp-email@gmail.com
EMAIL_FROM_NAME=QuizMaster
EMAIL_PORT=587
FRONTEND_URL=http://localhost:5173
```

Sunucu adresi kodda `smtp.gmail.com` olarak sabittir. `EMAIL_PORT` yalnız 587 veya 465 olabilir; farklı değerler 587 olarak değerlendirilir.

## İşleyiş

1. Kullanıcı “Şifremi unuttum” formunu gönderir.
2. Ham token yalnız e-posta bağlantısında kullanılır; veritabanında SHA-256 özeti saklanır.
3. Talep `PasswordResetRequest`, teslimat ise `EmailQueue` tablosunda izlenir.
4. Yönetici **Yönetim > Loglar > Şifre Talepleri** ekranından talebi yenileyebilir veya iptal edebilir.
5. **E-posta Logları** yalnız teslimat metadatasını gösterir; token içeren gövde API yanıtına eklenmez.

İş ağı 587 ve 465 çıkışını engelliyorsa Gmail bağlantısı zaman aşımına uğrar. Bu durumda cep interneti gibi SMTP çıkışına izin veren bir ağda yeniden test edin; DNS veya proxy ayarlarını değiştirmek gerekmez.
