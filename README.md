# Quiz-Master

Quiz-Master, okul ortamları için geliştirilmiş, rol tabanlı bir çevrimiçi sınav yönetim platformudur. Yöneticiler okul yapısını (sınıf, öğretmen, ders) tanımlar; öğretmenler sınav oluşturur, yayınlar ve AI yardımıyla soru üretir; öğrenciler kendilerine atanan sınavları çözer ve sonuçlarını anlık olarak görür. Temel amacı, sınav sürecinin tüm aşamalarını (oluşturma, atama, çözme, değerlendirme) tek bir platformda güvenli biçimde yönetmektir.

## Kullanıcı Kılavuzları

Rolünüze uygun ayrıntılı kullanım kılavuzunu açın:

- [Yönetici Kullanıcı Kılavuzu](docs/user-guides/admin-guide.md)
- [Öğretmen Kullanıcı Kılavuzu](docs/user-guides/teacher-guide.md)
- [Öğrenci Kullanıcı Kılavuzu](docs/user-guides/student-guide.md)

### Güncel güvenlik ve kullanıcı davranışları

- API yanıtlarında parola ve hesap kurtarma belirteçleri merkezi olarak filtrelenir.
- Giriş ve kayıt sonrasında oturum kimliği yenilenir; tüm veri değiştiren istekler CSRF korumasından geçer.
- Açık kayıtla oluşturulan öğrenci kendi sınıfını belirleyemez; sınıf üyeliği yetkili kullanıcı tarafından atanır.
- Öğrenci kendi profil sayfasında (`/settings`) kişisel ve iletişim bilgilerini değiştiremez (salt okunur koruması), değişiklik için okul yönetimine başvurmalıdır.
- Yönetici, öğrenci analiz ekranında (`/students/:id`) doğrudan öğrenci ve veli sekmeleri üzerinden bilgi güncellemesi yapabilir.
- Yönetici, öğretmen detay ekranında (`/teachers/:id`) doğrudan öğretmeni düzenleyebilir veya silebilir.
- Sınıf mevcudu listesinde (`/classes/:id`) öğrenci avatar rozeti kaldırılarak temiz ve sade liste görünümü sağlanmıştır.
- Öğretmen yalnızca sorumlu olduğu sınıflara sınav ve duyuru atayabilir; öğrenci veli veya özel bilgilerine erişemez.
- Öğrenci yalnızca yayınlanmış ve kendisine atanmış sınavı başlatabilir.
- Sınav süresi sayfa yenilendiğinde sıfırlanmaz ve sunucu tarafından da denetlenir.
- Tamamlanmamış sınavlarda doğru cevap/cevap anahtarı öğrenciye gönderilmez.
- Parola sıfırlama belirteçleri veritabanında açık metin yerine özetlenmiş olarak saklanır.

> **Çevrimdışı kullanım:** Süresiz sınavlar öğrenci tarafından önceden **Çevrimdışı Hazırla** ile bu cihaza alınabilir. Cevaplar cihazda saklanır ve teslim bağlantı geri geldiğinde otomatik senkronize edilir. Süreli sınavlar güvenlik nedeniyle çevrimdışı başlatılamaz; sunucu süresi dolduktan sonra gelen yeni cevaplar kabul edilmez.

---

## Teknoloji Yığını

### Backend
| Katman | Teknoloji |
|--------|-----------|
| Çalışma ortamı | Node.js |
| Web çerçevesi | Express |
| ORM | Prisma |
| Veritabanı | SQLite (geliştirme) |
| Gerçek zamanlı | Socket.IO |
| Loglama | Pino |
| Oturum | express-session + connect-sqlite3 |
| Şifreleme | bcrypt |
| Doğrulama | Zod |

### Frontend
| Katman | Teknoloji |
|--------|-----------|
| Çerçeve | React + TypeScript |
| Derleme aracı | Vite |
| Sunucu durumu | TanStack Query (React Query) |
| Yönlendirme | Wouter |
| Stil | Tailwind CSS + shadcn/ui |
| İkonlar | lucide-react |
| Çevrimdışı çalışma | Service Worker + tarayıcı yerel depolaması |

### Monorepo
- **pnpm workspaces** — `server/` ve `client/` ayrı paket olarak yönetilir.

---

## Proje Yapısı

```
Quiz-Master/
├── client/                  # React frontend (Vite)
│   ├── src/
│   │   ├── components/      # Yeniden kullanılabilir UI bileşenleri
│   │   ├── hooks/           # Özel React hook'ları
│   │   ├── lib/             # API istemcisi ve yardımcı araçlar
│   │   └── pages/           # Sayfa bileşenleri (admin, teacher, student)
│   ├── public/sw.js         # Üretim PWA uygulama kabuğu önbelleği
│   └── vite.config.ts       # Vite yapılandırması (proxy kuralları dahil)
│
├── server/                  # Express backend
│   ├── api-routes/          # Endpoint grupları (auth, quiz, class, ai …)
│   ├── middleware/          # Auth, rol kontrolü
│   ├── prisma/
│   │   ├── schema.prisma    # Veri modeli
│   │   └── seed.ts          # Demo verisi
│   ├── data/
│   │   └── quiz.db          # SQLite veritabanı (aktif)
│   ├── storage.ts           # Prisma veri erişim katmanı
│   ├── socket.ts            # Socket.IO kurulumu
│   └── index.ts             # Uygulama giriş noktası
│
├── package.json             # Kök pnpm workspace tanımı
└── README.md
```

---

## Kurulum ve Çalıştırma

### Gereksinimler
- Node.js >= 18
- pnpm >= 8 (`npm install -g pnpm`)

### 1. Bağımlılıkları Kur

```bash
pnpm install
```

### 2. Ortam Değişkenlerini Ayarla

`server/.env` dosyasını oluştur (örnek değerler aşağıda):

```env
DATABASE_URL="file:../data/quiz.db"
SESSION_SECRET="gizli-ve-uzun-bir-anahtar"
NODE_ENV="development"
```

### 3. Veritabanını Hazırla

```bash
cd server
pnpm db:migrate              # Prisma migrasyonlarını uygula (veya prisma migrate deploy)
pnpm db:seed                 # Demo verilerini yükle (QuizMaster2026!)
```

### 4. Geliştirme Sunucusunu Başlat

Proje kökünden:

```bash
pnpm dev
```

| Servis | Adres |
|--------|-------|
| Backend API | http://localhost:5000 |
| Frontend | http://localhost:5173 |

> Vite, `/api` ve `/socket.io` isteklerini otomatik olarak `localhost:5000`'e yönlendirir.

### 5. E-Posta Servisi Yapılandırması

Quiz-Master, asenkron veritabanı destekli **Outbox Kuyruk Mimarisi** (`EmailQueue`) ile çalışır. Kullanıcı talepleri (şifre sıfırlama, bildirimler) kuyruğa yazılır ve arka plan işçisi tarafından sevk edilir.

#### A) Yerel Geliştirme (Local Offline — Mailpit)
Geliştirme ortamında test e-postalarını yakalamak ve tarayıcıda görselleştirmek için Mailpit kullanılır:
- **Başlatma:** `tools/mailpit/start-mailpit.bat` dosyasını çalıştırın.
- **Web Gelen Kutusu:** [http://127.0.0.1:8025](http://127.0.0.1:8025)
- **SMTP Portu:** `127.0.0.1:1026` (Windows Hyper-V / port çakışmalarını önlemek üzere 1026 olarak atanmıştır)
- `server/.env` ayarı:
  ```env
  EMAIL_HOST=127.0.0.1
  EMAIL_PORT=1026
  EMAIL_SECURE=false
  EMAIL_USER=
  EMAIL_PASS=
  EMAIL_FROM=noreply@quizmaster.com
  ```

#### B) Gmail SMTP

Gmail ile parola sıfırlama ve test e-postası göndermek için Google hesabında iki adımlı doğrulamayı açın ve normal hesap parolası yerine bir **Uygulama Parolası** üretin. `server/.env` dosyasına aşağıdaki değerleri ekleyin:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_REQUIRE_TLS=true
EMAIL_USER=your-smtp-email@gmail.com
EMAIL_PASS=your-16-character-app-password
EMAIL_FROM=your-smtp-email@gmail.com
EMAIL_FROM_NAME=QuizMaster
FRONTEND_URL=http://localhost:5173
```

> `EMAIL_PASS` kaynak koda veya Git'e eklenmemelidir. Depodaki `server/.env.gmail.example` şablon olarak kullanılabilir. Sunucu yeniden başlatıldıktan sonra yönetici API'sindeki `GET /api/admin/email-settings/status` ayarların hazır olup olmadığını parolayı göstermeden bildirir; `POST /api/admin/email-settings/test` ise SMTP bağlantısını ve gerçek gönderimi sınar.

Parola sıfırlama isteği tek kullanımlık ham bağlantıyı e-postaya koyar; veritabanında yalnızca SHA-256 özeti ve bir saatlik son kullanma zamanı tutulur. Gönderim başarısız olursa kayıt e-posta kuyruğunda hata bilgisiyle izlenebilir ve yönetici tarafından yeniden gönderilebilir.

#### C) Canlı Ortam (Production Online — Brevo / Sendinblue)
Canlıya çıkışta Brevo SMTP Relay servisi kullanılır:
1. Brevo (brevo.com) hesabınızda *Transactional > Settings > Configuration* adımından yeni bir **SMTP Key** (`xsmtpsib-...`) oluşturun.
2. Gönderici e-posta adresinizi (*Senders*) Brevo panelinde doğrulayın.
3. Sunucu ortam değişkenlerini (`server/.env`) güncelleyin:
  ```env
  EMAIL_HOST=smtp-relay.brevo.com
  EMAIL_PORT=587
  EMAIL_SECURE=false
  EMAIL_USER=hesap_epostaniz@domain.com
  EMAIL_PASS=xsmtpsib-anahtariniz
  EMAIL_FROM=noreply@dogrulanmis-domaininiz.com
  ```
> Sistem `EMAIL_USER` ve `EMAIL_PASS` alanlarının doluluğunu otomatik algılar; yerelde şifresiz Mailpit, canlıda kimlik doğrulamalı Brevo sıfır kod değişikliği ile şeffaf çalışır.

### 6. Testleri Çalıştırma

Quiz-Master kapsamlı unit, entegrasyon ve Playwright E2E test paketlerine sahiptir:

```bash
# Backend testleri (Vitest: 8 test paketi, 36 test)
pnpm --filter quiz-master-server test

# Frontend testleri (Vitest: 5 test paketi, 22 test)
pnpm --filter quiz-master-client test

# Uçtan Uca (E2E) testleri (Playwright)
pnpm test:e2e
```

> **Not (Windows & Kurumsal Ağ):** Vitest yapılandırmaları (`vitest.config.ts`), Windows ortamındaki Node `getaddrinfo ENOTFOUND localhost` hatasını önleyen dahili DNS çözümleyici hook'una sahiptir.

---

## Demo Hesapları

Seed scripti aşağıdaki kullanıcıları oluşturur:

| Rol | E-posta | Şifre |
|-----|---------|-------|
| Yönetici | admin@quizmaster.com | QuizMaster2026! |
| Öğretmen | teacher@quizmaster.com | QuizMaster2026! |
| Öğrenci | student@quizmaster.com | QuizMaster2026! |

---

## Öne Çıkan Özellikler

- **3 Alt Sekmeli Gelişmiş Log ve Denetim Merkezi** — Admin yönetim panelinde (`/management?tab=logs`) tüm operasyonlar 3 ayrı alt sekmede tasnif edilir:
  1. *Kullanıcı Logları:* Giriş, sınav, duyuru ve kullanıcı işlemleri (`ActionLog`).
  2. *E-Posta Logları:* Gönderilen tüm e-postaların Outbox kuyruk takibi, KPI sayaçları (Toplam, Başarılı, Bekleyen, Hatalı), HTML şablon önizleme modalı, hata detayı, tek tıkla **Tekrar Gönder (Retry)** ve **Sil** yetenekleri.
  3. *Sistem Hata & İşlemleri:* Yıl sonu arşivleme (`ARCHIVE_YEAR`), sınıf atlatma (`PROMOTE_STUDENTS`), arşiv tasfiyesi (`PURGE_ARCHIVED_DATA`) ve sistem hata kayıtları.
  Öğretmen ve öğrenciler ise kişisel hareketlerini Profil ayarlarından (`/settings?tab=logs`) izler.
- **Asenkron E-Posta Outbox Mimarisi** — Kullanıcı parola sıfırlama talepleri ana işlem akışını geciktirmeden `<10ms` içinde veritabanı kuyruğuna (`EmailQueue`) alınır. Arka plan işçisi e-postaları güvenle sırayla sevk eder. Yerel geliştirme için Mailpit (`tools/mailpit/start-mailpit.bat` - Port 1026), canlı üretim için Brevo SMTP Relay (`smtp-relay.brevo.com` - Port 587) şeffaf entegre edilmiştir.
- **Öğrenci & Veli Bilgileri Yönetimi** — Öğrenci detay ekranında (`/students/:id`) yöneticilere özel 3 sekmeli yapı: *Sınav Bilgileri*, *Öğrenci Bilgileri* ve *Veli Bilgileri* (Veli Adı, Yakınlık, Telefon, E-posta, Adres). Öğretmenler yalnızca sınav sonuçlarını görebilir; öğrenciler kendi veli bilgilerini Profil ayarlarında salt okunur olarak inceler.
- **Öğretmen Detay Sayfası** (`/teachers/:id`) — Öğretmen profil bilgileri, branş atamaları, sorumlu olduğu sınıflar ve oluşturduğu sınavların tek sayfada kapsamlı özeti.
- **Öğretmen Dashboard'u** — Dashboard başlık alanında branş badge'leri ve sorumlu sınıflar dinamik olarak gösterilir. Eğitmen ilgili sınıf detay sayfasına tek tıkla erişebilir.
- **Sınıf İstatistikleri & Sınav Sonuçları** (`/class-statistics`, `/results`) — Sınıf bazlı KPI metrik kartları (Toplam Öğrenci, Katılımcı Sayısı, Katılım Oranı, Ortalama Başarı %) ve sınıf bazında detaylandırılmış performans grafikleri.
- **Global ve Optimize Yazdırma (Print) Desteği** — Duyurular, Sınıf listeleri, Sınavlar ve Sonuç/İstatistik sayfalarında A4 dikey/yatay optimize edilmiş "Yazdır" altyapısı. İlk sayfa boş çıkma sorunu giderilmiş olup, filtre panelleri, Sidebar ve Navbar otomatik gizlenir.
- **AI Destekli Soru Üretimi (Gemini 3.8 Flash)** — Google Gemini API entegrasyonu (varsayılan: `gemini-3.8-flash`) ile konu bazlı, zorluk seviyesi ve soru tipi ayarlanabilir sorular saniyeler içinde üretilir. Hem standart Bearer hem de Google `x-goog-api-key` formatları tam desteklenir.
- **Duyuru Merkezi** — Tüm okul geneline veya spesifik bir sınıfa/role yönelik zengin içerikli duyuru yayınlama sistemi (Admin ve Öğretmen).
- **Çevrimdışı Sınav Desteği** — Süresiz sınavları önceden cihaza hazırlama, cevapları kullanıcı+sınav bazında yerelde saklama ve bağlantı geri geldiğinde atomik teslim senkronizasyonu.
- **Güvenlik ve Performans**
  - **CSRF Koruması:** Sayfa mount'unda otomatik token yenileme + başarısız mutasyonlarda şeffaf retry mekanizması.
  - **RBAC (Rol Tabanlı Erişim):** Backend seviyesinde `requireAuth` + `requireRole` middleware'leri; frontend'de rol bazlı UI kontrolü.
  - **Real-time:** Socket.IO ile sınav anında anlık iletişim ve bildirimler.
  - **Atomik İşlemler:** Prisma transaksiyonları ile veri bütünlüğü koruması.

---

## Teknik Detaylar

### Güvenlik Katmanı
- **CSRF Token:** Uygulama yüklendiğinde ve kritik sayfalara girildiğinde otomatik olarak taze token alınır. Her mutasyon isteğine `x-csrf-token` başlığı eklenir; token geçersizse şeffaf biçimde yenilenerek istek yeniden denenir (`csrf-sync` v4 + `apiFetch` retry logic).
- **Rate Limiting:** Kaba kuvvet (brute-force) saldırılarına ve AI API kötüye kullanımına karşı endpoint bazlı limitler (15 dk / 1000 istek genel, 20 istek auth).
- **SSRF Koruması:** AI modülünde sadece güvenli IP ve domain'lere izin veren filtreleme sistemi.
- **Çevrimdışı Sınav Güvenliği:** Çevrimdışı pakette cevap anahtarı bulunmaz; sınıf/yayın yetkisi hazırlama sırasında doğrulanır, puanlama sunucuda yapılır ve süreli sınavlar çevrimdışı başlatılmaz.

### Log ve Kuyruk Yönetimi
- Sistemdeki tüm önemli işlemler (`CREATE`, `UPDATE`, `DELETE`, `LOGIN`, `ARCHIVE_YEAR`, `PROMOTE_STUDENTS`, `PURGE_ARCHIVED_DATA` vb.) veritabanına kaydedilir.
- `/api/admin/logs` (Admin kullanıcı logları), `/api/admin/logs/emails` (E-posta Outbox kuyruğu), `/api/admin/logs/system` (Sistem operasyonları) ve `/api/admin/logs/me` (Bireysel geçmiş) endpoint'leri ile rol ve domain bazlı log ayrımı sağlanır.
- Dashboard'da her rol için son 5 hareket liste görünümünde gösterilir; "Tümünü Gör" linki ilgili denetim ekranına yönlendirir.

### Sayfa Yapısı (Önemli Rotalar)
| Rota | Erişim | Açıklama |
|------|--------|----------|
| `/` | Herkese açık | Ana sayfa / giriş yönlendirme |
| `/dashboard` | Admin, Teacher, Student | Rol bazlı dashboard |
| `/management?tab=logs` | Admin | Yönetim paneli — Log sekmesi |
| `/settings?tab=logs` | Teacher, Student | Ayarlar — Kişisel log sekmesi |
| `/teachers/:id` | Admin | Öğretmen detay sayfası |
| `/classes/:id` | Admin, Teacher | Sınıf detay sayfası |

### Yazdırma Optimizasyonu
- Tailwind v4 `print:hidden` / `print:block` sınıfları kullanılarak temiz çıktı düzeni.
- Duyurular, Sınıflar, Sınavlar, Sonuçlar, Öğretmen Detay sayfalarında hazır "Yazdır" butonları mevcut.

---

## Ortam Değişkenleri

`server/.env` dosyasında tanımlanması gereken değişkenler:

| Değişken | Zorunlu | Açıklama |
|----------|---------|----------|
| `DATABASE_URL` | ✅ | Prisma bağlantı dizesi. SQLite için `file:../data/quiz.db` |
| `SESSION_SECRET` | ✅ (prod) | Express session imzalama anahtarı. Üretimde eksikse uygulama başlamaz. |
| `NODE_ENV` | — | `development` veya `production`. Varsayılan: `development` |
| `PORT` | — | Backend portu. Varsayılan: `5000` |
| `GEMINI_API_KEY` | — | Google Gemini API anahtarı. Yalnızca resmi Google endpoint'lerine gönderilir. |

---

## Notlar ve Kısıtlamalar

- **Çevrimdışı çalışma:** Service worker yalnızca üretim derlemesinde kaydedilir. Yerel doğrulama için önce `pnpm build`, ardından istemci önizleme komutu kullanılmalıdır. Çevrimdışı veri tarayıcıya ve cihaza özeldir.
- **JSON alanları:** Prisma'nın `Json` tipi SQLite tarafından desteklenmediğinden `Question.options`, `QuestionBank.options` ve `StudentResult.answers` alanları şemada `String?` olarak tutulmaktadır. PostgreSQL'e geçişte bu alanlar `Json?` tipine dönüştürülecek ve `storage.ts`'deki manuel `JSON.stringify`/`JSON.parse` çağrıları kaldırılacaktır.
- **E-posta doğrulama:** `User` modeline `emailVerified` ve `emailVerificationToken` alanları eklendi; aktivasyon akışı (token oluşturma → e-posta gönderme → doğrulama endpoint'i) altyapı olarak hazır ancak henüz devreye alınmamıştır.
- **SQLite eş zamanlılığı:** Yüksek trafikli üretim ortamları için PostgreSQL'e geçiş önerilir. Geçiş için `schema.prisma` içindeki `provider = "sqlite"` satırını `"postgresql"` olarak değiştirmek yeterlidir.
