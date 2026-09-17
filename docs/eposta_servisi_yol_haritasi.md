# Quiz-Master E-Posta Servisi & Outbox Kuyruk Altyapısı Yol Haritası

Yapılan mimari görüşme ve kararlar doğrultusunda, **Quiz-Master** e-posta altyapısının yerel (offline) geliştirme aşamasından canlıya (online) çıkışına kadar izlenecek uçtan uca yol haritası belirlenmiştir.

---

## 1. Mimari Karar Özeti

| Karar Alanı | Seçilen Yaklaşım | Gerekçe & Avantajı |
| :--- | :--- | :--- |
| **Yerel Test (Offline)** | **Yerel Mock SMTP (Mailpit)** | İnternet bağlantısı, API anahtarı veya gerçek e-posta hesabı gerektirmez. Port 1025'ten mailleri yakalar, Port 8025 Web arayüzünde görüntüler. |
| **Canlı Ortam (Online)** | **Modern Bulut Sağlayıcı (Resend / SendGrid / AWS SES)** | Yüksek teslimat oranı (deliverability), spam kutusuna düşmeme, SPF/DKIM doğrulaması ve analitik izleme. |
| **Gönderim Mimarisi** | **Veritabanı Destekli Outbox / Retry Pattern** | HTTP isteklerini bloke etmez (anında 200 döner). Ağ/sağlayıcı kesintilerinde e-postalar kaybolmaz, otomatik yeniden denenir (retry). |
| **Şablon Motoru** | **Modüler Responsive HTML (TypeScript)** | Quiz-Master kurumsal renkleri, butonları ve mobil uyumluluğu olan harici bağımlılıksız inline-CSS şablonlar. |

---

## 2. Sistem Mimarisi & Veri Akış Şeması

```mermaid
flowchart TD
    subgraph ClientLayer["İstemci Katmanı"]
        User([Kullanıcı: 'Şifremi Unuttum']) --> APIReq[POST /api/auth/forgot-password]
    end

    subgraph ServerLayer["Sunucu & Outbox Katmanı"]
        APIReq --> RouteHandler[Auth Router]
        RouteHandler --> TokenGen[Tek Kullanımlık Hash'li Token Üretimi]
        TokenGen --> OutboxWrite[(Prisma: EmailQueue Tablosuna Yaz)]
        OutboxWrite --> InstantResponse[İstemciye Anında 200 OK Yanıtı]

        subgraph BackgroundWorker["E-posta Arka Plan Worker (Outbox Dispatcher)"]
            Timer([Kuyruk Dinleyici - 5 sn]) --> FetchPending[Bekleyen Mailleri Çek (status: pending)]
            FetchPending --> TransporterChoice{NODE_ENV}
            
            TransporterChoice -->|development (Offline)| Mailpit[Yerel SMTP: localhost:1025]
            TransporterChoice -->|production (Online)| CloudAPI[Bulut Sağlayıcı: Resend / SendGrid API]
            
            Mailpit --> SuccessDev[status = 'sent']
            CloudAPI --> SuccessProd[status = 'sent']
            CloudAPI -->|Hata/Kesinti| Failure[attempts++, status = 'failed' / retry]
        end
    end

    subgraph MailViewer["Görüntüleme & Teslimat"]
        Mailpit --> WebUI[Geliştirici Arayüzü: http://localhost:8025]
        CloudAPI --> RealInbox[Kullanıcının Gerçek Gelen Kutusu]
    end
```

---

## 3. BÖLÜM A: Yerel (Offline) Test Yol Haritası

Yerel geliştirme sırasında hiçbir dış internet servisine ve gerçek e-posta şifresine ihtiyaç duymadan çalışılır.

### Adım 1: Mailpit Kurulumu (Hafif ve Tek Dosya)
Mailpit, Go ile yazılmış, veritabanı veya karmaşık ayar gerektirmeyen tek bir `.exe` çalıştırılabilir dosyadır.

1. **İndirme (Windows):**
   - [Mailpit GitHub Releases](https://github.com/axllent/mailpit/releases) adresinden `mailpit-windows-amd64.zip` indirilir.
   - Proje içine veya sistem araçlarına konulur (örn: `Tools/mailpit.exe` veya `scoop install mailpit` / `choco install mailpit`).
2. **Çalıştırma:**
   ```powershell
   # Terminalde doğrudan çalıştırmak yeterlidir:
   mailpit
   ```
   - **SMTP Sunucusu:** `localhost:1025` (Quiz-Master buraya e-posta atar)
   - **Web Arayüzü:** `http://localhost:8025` (Gelen tüm e-postalar burada canlı açılır)

### Adım 2: Geliştirme `.env` Yapılandırması (`server/.env`)
```env
# ==================== EMAIL CONFIGURATION (DEVELOPMENT - MAILPIT) ====================
EMAIL_HOST=localhost
EMAIL_PORT=1025
EMAIL_SECURE=false
EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM="QuizMaster Destek <noreply@quizmaster.com>"
FRONTEND_URL=http://localhost:5173
```

### Adım 3: Offline Doğrulama Testi
1. Mailpit başlatılır (`http://localhost:8025` açılır).
2. Quiz-Master başlatılır (`.\start-local.ps1`).
3. Tarayıcıda `/auth` -> **Şifremi Unuttum** ekranından `student@quizmaster.com` yazılır.
4. E-posta anında Mailpit web arayüzüne düşer.
5. Mailpit içerisindeki **"Şifremi Sıfırla"** butonuna tıklanır ve `/reset-password?token=...` ekranında yeni şifre belirlenerek akış test edilir.

---

## 4. BÖLÜM B: Canlıya Çıkış (Online) Yol Haritası

Canlı ortamda kurumsal teslimat oranı (Inbox Delivery) sağlamak için izlenecek adımlar:

### Adım 1: Sağlayıcı Seçimi & Hesap Açılışı
- **Öneri 1: Resend (Modern & En Kolay Entegrasyon):**
  - Ayda 3.000 e-posta ücretsiz. Node.js SDK'sı ve SMTP relay desteği mükemmeldir.
- **Öneri 2: Amazon SES (Büyük Ölçek & En Ekonomik):**
  - 10.000 e-posta ~ 1$. Okul veya üniversite çapında yüksek hacimler için idealdir.
- **Öneri 3: SendGrid / Postmark:**
  - Köklü kurumsal transactional servisler.

### Adım 2: Alan Adı (Domain) ve DNS Doğrulamaları (Spam Önleme)
E-postaların spam veya gereksiz kutusuna düşmemesi için okul alan adının (örn: `quizmaster.okul.k12.tr` veya `quizmaster.com`) DNS kayıtlarına şunlar eklenir:
1. **SPF Kaydı (TXT):**
   `v=spf1 include:resend.com ~all` (Kullanılan sağlayıcıya göre)
2. **DKIM Kaydı (CNAME / TXT):**
   Sağlayıcının verdiği benzersiz kriptografik anahtar (E-postanın değiştirilmediğini kanıtlar).
3. **DMARC Kaydı (TXT):**
   `v=DMARC1; p=none; rua=mailto:dmarc-reports@okul.com`

### Adım 3: Canlı Ortam Çevre Değişkenleri (`Production .env`)
```env
# ==================== EMAIL CONFIGURATION (PRODUCTION) ====================
EMAIL_PROVIDER=resend # veya smtp
EMAIL_HOST=smtp.resend.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=resend
EMAIL_PASS=re_123456789_GercekApiAnahtari
EMAIL_FROM="QuizMaster Bilgilendirme <bildirim@quizmaster.okul.k12.tr>"
FRONTEND_URL=https://quizmaster.okul.k12.tr
```

---

## 5. BÖLÜM C: Veritabanı Destekli Outbox / Retry Kuyruk Mimarisi

Kullanıcı arayüzünün gecikmesini sıfırlamak ve e-posta teslimatını garanti altına almak için kurulacak veri modeli ve servis yapısı:

### 1. Prisma Şemasına Eklenecek Model (`schema.prisma`)
```prisma
model EmailQueue {
  id          String    @id @default(uuid())
  to          String
  subject     String
  html        String
  text        String?
  type        String    // "PASSWORD_RESET", "VERIFICATION", "QUIZ_NOTIFICATION"
  status      String    @default("pending") // pending, processing, sent, failed
  attempts    Int       @default(0)
  maxAttempts Int       @default(5)
  lastError   String?
  scheduledAt DateTime  @default(now())
  sentAt      DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([status, scheduledAt])
}
```

### 2. E-posta Ekleme Fonksiyonu (Hızlı & Non-blocking)
API uçları (örn: `forgot-password`, `createQuiz`) e-postayı doğrudan internete göndermez; sadece veritabanına ekler:
```typescript
// İstek 10 milisaniyede tamamlanır:
await storage.enqueueEmail({
  to: user.email,
  subject: "Şifre Sıfırlama Talebi",
  html: renderPasswordResetTemplate({ name: user.name, resetUrl }),
  type: "PASSWORD_RESET"
});
```

### 3. Outbox Worker (Arka Plan Servisi)
Sunucu başladığında (`index.ts`) periyodik olarak bekleyen e-postaları işleyen hafif worker:
```typescript
export function startEmailWorker() {
  setInterval(async () => {
    const pendingEmails = await storage.getPendingEmails(10); // 10'ar 10'ar işle
    for (const email of pendingEmails) {
      try {
        await storage.updateEmailStatus(email.id, 'processing');
        await sendEmailDirectly({ to: email.to, subject: email.subject, html: email.html });
        await storage.updateEmailStatus(email.id, 'sent', { sentAt: new Date() });
      } catch (err: any) {
        const attempts = email.attempts + 1;
        const status = attempts >= email.maxAttempts ? 'failed' : 'pending';
        await storage.updateEmailStatus(email.id, status, { attempts, lastError: err.message });
      }
    }
  }, 5000); // Her 5 saniyede bir kontrol et
}
```

---

## 6. BÖLÜM D: Responsive Şablon Tasarımı

Modüler şablon motoru, tüm istemcilerde (Outlook, Gmail, Apple Mail, Mobil) kusursuz açılacak HTML yapısı sunar:

```
+-------------------------------------------------------------+
|  [Logo] Quiz-Master Sınav Platformu                         |
+-------------------------------------------------------------+
|  Merhaba {Ad Soyad},                                        |
|                                                             |
|  Hesabınız için şifre sıfırlama talebinde bulunuldu.        |
|                                                             |
|             +-------------------------------+               |
|             |       ŞİFREMİ SIFIRLA         |               |
|             +-------------------------------+               |
|                                                             |
|  * Bu bağlantı 1 saat boyunca geçerlidir.                   |
|  * Bu talebi siz yapmadıysanız bu mesajı yok sayabilirsiniz.|
|                                                             |
|  Quiz-Master Destek Ekibi                                   |
+-------------------------------------------------------------+
```

---

## 7. Uygulama Adımları & Sıradaki Eylemler

1. [ ] **Adım 1:** Prisma şemasına `EmailQueue` modelinin eklenmesi ve migrasyonun oluşturulması.
2. [ ] **Adım 2:** `server/utils/email-templates.ts` modülü ile responsive kurumsal şablonların hazırlanması (Şifre Sıfırlama + Doğrulama + Bildirim).
3. [ ] **Adım 3:** `server/utils/email.ts` içine `EmailWorker` (Outbox Poller) ve Mailpit/Cloud ayrımının eklenmesi.
4. [ ] **Adım 4:** `server/api-routes/auth.ts` (`forgot-password`) ve bildirim akışlarının kuyruğa bağlanması.
5. [ ] **Adım 5:** Yerel Mailpit testi ve otomatik entegrasyon testlerinin yazılması.
