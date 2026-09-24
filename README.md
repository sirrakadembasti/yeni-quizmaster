# QuizMaster

QuizMaster; yöneticiler, öğretmenler, öğrenciler ve veliler için rol tabanlı çalışan bir sınav, anket ve okul takip uygulamasıdır. Sınav oluşturma, sınıfa atama, çevrimiçi/çevrimdışı çözme, sonuç analizi, anket yönetimi, duyuru-bildirim, Excel dışa aktarma ve Gmail üzerinden parola sıfırlama süreçlerini tek uygulamada toplar.

## Kullanıcı kılavuzları

- [Yönetici kullanıcı kılavuzu](docs/admin-guide.md)
- [Öğretmen kullanıcı kılavuzu](docs/teacher-guide.md)
- [Öğrenci kullanıcı kılavuzu](docs/student-guide.md)
- [Veli kullanıcı kılavuzu](docs/parent-guide.md)
- [Gmail e-posta ve parola sıfırlama yapılandırması](docs/e-posta-yapilandirma.md)
- [Graphify mimari haritası ve geliştirici kılavuzu](docs/graphify.md)

## Güncel özellikler

- **Dört rol:** `admin`, `teacher`, `student` ve `parent`.
- **Sınav yönetimi:** Sınav oluşturma, soru ekleme, görsel yükleme, sınıfa atama, yayınlama ve sonuç analizi.
- **Anket Yönetimi:** Sınavdan ayrılmış oluşturma ve sonuç akışı; tek seçim, çoklu seçim, açık uçlu, derecelendirme ve Likert soru türleri.
- **Yetkilendirme:** Öğretmen yalnız yetkili olduğu sınıfları, öğrencileri, sınavları ve anketleri görür. Veli yalnız kendisiyle ilişkilendirilen öğrencilerin salt okunur sınav özetlerine erişir.
- **Raporlama:** Anket, sınav sonucu, sınıf istatistiği, öğrenci, öğretmen ve sınıf ekranlarında A4 uyumlu yazdırma; uygun ekranlarda biçimlendirilmiş `.xlsx` Excel çıktısı.
- **Türkçe Excel desteği:** Dışa aktarımlar gerçek Excel çalışma kitabı üretir; Türkçe karakter, sütun genişliği, başlık, filtre bilgisi ve sabit başlık satırı korunur.
- **Duyuru ve bildirim:** Rol/sınıf hedefleme, gönderen adı ve rolü, son beş bildirim, tekil silme ve ses açma/kapatma.
- **Gmail parola sıfırlama:** Tek kullanımlık bağlantı, SHA-256 token özeti, `PasswordResetRequest` takibi ve veritabanı tabanlı `EmailQueue` Outbox kuyruğu.
- **Çevrimdışı sınav:** Süresiz sınavı önceden cihaza hazırlama, cevapları yerelde tutma ve bağlantı geldiğinde sunucuya gönderme.
- **Güvenlik:** Oturum yenileme, CSRF koruması, hız sınırı, rol tabanlı API denetimi, parola/token alanlarının yanıtlardan temizlenmesi ve sunucu taraflı sınav süresi doğrulaması.

## Teknoloji yığını

| Katman | Teknoloji |
|---|---|
| Frontend | React, TypeScript, Vite, TanStack Query, Wouter, Tailwind CSS, shadcn/ui |
| Backend | Node.js, Express, TypeScript, Socket.IO, Pino |
| Veri | Prisma ORM, SQLite (yerel geliştirme) |
| Kimlik ve güvenlik | `express-session`, `connect-sqlite3`, bcrypt, CSRF, Zod |
| E-posta | Nodemailer, Gmail SMTP, veritabanı Outbox kuyruğu |
| Test | Vitest, Supertest, Playwright |
| Paket yönetimi | pnpm workspaces |

## Proje yapısı

```text
Quiz-Master/
├── client/                       # React istemcisi
│   ├── public/sw.js              # Üretim service worker'ı
│   └── src/
│       ├── components/           # Ortak arayüz bileşenleri
│       ├── lib/                  # API, çevrimdışı sınav ve Excel yardımcıları
│       └── pages/                # Rol bazlı sayfalar
├── server/                       # Express API
│   ├── api-routes/               # API rota grupları
│   ├── middleware/               # Kimlik, rol ve CSRF kontrolleri
│   ├── prisma/                   # Şema, migrasyonlar ve seed
│   ├── services/                 # Parola sıfırlama gibi iş servisleri
│   └── utils/                    # E-posta, loglama ve yetki yardımcıları
├── docs/                         # Kullanıcı ve işletim belgeleri
├── graphify-out/                 # Paylaşılan mimari harita, rapor ve sorgu grafiği
└── package.json                  # pnpm workspace komutları
```

## Gereksinimler

- Node.js 22 veya 24 LTS uyumlu çalışma ortamı
- pnpm `9.15.1` (projedeki `packageManager` alanıyla sabitlenmiştir)

Kurumsal bilgisayarda global PATH kullanmak istemiyorsanız proje için hazırlanmış yerel Node başlatıcısını kullanabilirsiniz. Normal bir Node kurulumu olan ortamda aşağıdaki standart pnpm komutları yeterlidir.

## Kurulum

### 1. Bağımlılıkları kurun

```bash
pnpm install --frozen-lockfile
```

### 2. Ortam değişkenlerini hazırlayın

`server/.env` oluşturun. Gizli anahtarları Git'e eklemeyin.

```env
DATABASE_URL="file:../data/quiz.db"
SESSION_SECRET="uzun-ve-rastgele-bir-deger"
NODE_ENV="development"
PORT=5000
FRONTEND_URL=http://localhost:5173

# Gmail SMTP
EMAIL_USER=your-smtp-email@gmail.com
EMAIL_PASS=your-google-app-password
EMAIL_FROM=your-smtp-email@gmail.com
EMAIL_FROM_NAME=QuizMaster
EMAIL_PORT=587

# İsteğe bağlı AI üretimi
GEMINI_API_KEY=
```

E-posta ayarları ve ağ sorunları için [e-posta yapılandırma belgesine](docs/e-posta-yapilandirma.md) bakın.

### 3. Veritabanını hazırlayın

```bash
pnpm --filter quiz-master-server db:migrate
pnpm --filter quiz-master-server db:seed
```

Mevcut bir veritabanını güncelliyorsanız seed komutunu yalnız örnek veriyi yeniden oluşturmak istediğinizde kullanın.

### 4. Uygulamayı başlatın

```bash
pnpm dev
```

| Servis | Adres |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:5000 |

Vite, `/api` ve `/socket.io` isteklerini backend'e yönlendirir.

## Temel kullanım akışları

### Sınav

1. Yönetici ders, sınıf, öğrenci ve öğretmen atamalarını oluşturur.
2. Yönetici veya öğretmen **Sınavlar > Yeni Sınav** üzerinden sınavı hazırlar.
3. Sorular elle, AI yardımıyla veya isteğe bağlı soru görseliyle eklenir.
4. Sınav yetkili sınıflara atanıp yayınlanır.
5. Öğrenci sınavı çözer; puanlama sunucuda yapılır.
6. Sonuçlar sınıf, ders, sınav, öğretmen ve tarih filtreleriyle incelenir.

### Anket

1. Yönetici veya öğretmen **Anket Yönetimi > Anket Oluştur** sekmesini açar.
2. Anket ayarları, hedef sınıflar ve puansız soru türleri belirlenir.
3. Yayınlanan anket öğrencinin **Anketlerim** ekranında görünür.
4. Sonuçlarda katılım, cevap dağılımları, açık uçlu yanıtlar, grafikler ve tablolar birlikte gösterilir.

### Veli

1. Yönetici öğrenci detayındaki **Veli Hesapları** alanından veli hesabı oluşturur veya mevcut veliyi öğrenciye bağlar.
2. Veli kendi hesabıyla giriş yapar.
3. Yalnız bağlı öğrencileri seçebilir; tamamlanan ve bekleyen sınavları salt okunur biçimde görür.

## Rol ve erişim özeti

| İşlem | Yönetici | Öğretmen | Öğrenci | Veli |
|---|:---:|:---:|:---:|:---:|
| Tüm okul yapısını yönetme | ✓ | — | — | — |
| Yetkili sınıfta sınav/anket oluşturma | ✓ | ✓ | — | — |
| Sınav/anket çözme | — | — | ✓ | — |
| Tüm sonuçları görme | ✓ | — | — | — |
| Yetkili sınıf sonuçlarını görme | ✓ | ✓ | — | — |
| Kendi sonuçlarını görme | — | — | ✓ | — |
| Bağlı öğrenci özetini görme | — | — | — | ✓ |
| Veli hesabı oluşturma/bağlama | ✓ | — | — | — |
| Şifre taleplerini yönetme | ✓ | — | — | — |

Arayüzde bir alanın gizlenmesi tek güvenlik katmanı değildir; aynı erişim sınırları API ve veri sorgularında da uygulanır.

## E-posta ve parola sıfırlama

- Sistem yalnız `smtp.gmail.com` kullanır; alternatif SMTP sağlayıcı ayarları bilinçli olarak devre dışıdır.
- `EMAIL_PORT` yalnız `587` veya `465` kabul eder; diğer değerler `587` olarak değerlendirilir.
- Kullanıcı **Şifremi Unuttum** formunu gönderdiğinde e-posta Outbox kuyruğuna alınır.
- Ham token yalnız e-postadaki bağlantıda bulunur; veritabanında özeti tutulur ve bağlantı bir saat geçerlidir.
- Yönetici **Yönetim > Loglar > Şifre Talepleri** alanından talep oluşturabilir, yenileyebilir veya bekleyen talebi iptal edebilir.
- **E-posta Logları** teknik teslimat durumunu gösterir; token içeren e-posta gövdesi istemciye açılmaz.

## Çevrimdışı sınav davranışı

- Yalnız süresiz, yayınlanmış ve öğrenci sınıfına atanmış sınavlar çevrimdışı hazırlanabilir.
- Çevrimdışı pakette cevap anahtarı bulunmaz.
- Cevaplar kullanıcı+sınav bazında aynı tarayıcıda saklanır.
- Bağlantı geldiğinde teslim sunucuya aktarılır ve kesin puan sunucuda hesaplanır.
- Süreli sınav çevrimdışı başlatılamaz; çevrimiçi başladıktan sonra bağlantı kesilirse sunucudaki süre sınırı geçerliliğini korur.

## Excel ve yazdırma

- **Excel** düğmeleri `.xlsx` dosyası üretir; CSV uzantısı kullanılmaz.
- Çalışma kitabında rapor başlığı, seçili filtreler, otomatik sütun genişliği, tablo kenarlıkları, filtre ve sabit başlık satırı bulunur.
- Yazdırma görünümü navigasyon, buton ve gereksiz kontrolleri gizler; içerik A4 ve siyah-beyaz çıktıya göre düzenlenir.
- Dashboard ekranlarında yazdırma kaldırılmıştır; yalnız anlamlı liste, detay, sonuç ve rapor sayfalarında sunulur.

## Test ve doğrulama

```bash
# Backend
pnpm --filter quiz-master-server test

# Frontend
pnpm --filter quiz-master-client test

# Üretim derlemesi
pnpm build

# Uçtan uca testler
pnpm test:e2e
```

## Önemli rotalar

| Rota | Roller | Açıklama |
|---|---|---|
| `/` | Herkes / role göre | Ana sayfa veya rol dashboard'u |
| `/quizzes` | Yönetici, öğretmen | Sınav listesi |
| `/create-quiz` | Yönetici, öğretmen | Yalnız sınav oluşturma |
| `/survey-results` | Yönetici, öğretmen | Anket Yönetimi: oluşturma ve sonuçlar |
| `/results` | Yönetici, öğretmen | Sınav Sonuçları |
| `/statistics` | Yönetici, öğretmen | Sınıf İstatistikleri |
| `/students` | Yönetici, öğretmen | Yetkiye göre öğrenci listesi |
| `/teachers` | Yönetici | Öğretmenler |
| `/management` | Yönetici | Ders, sınıf, kullanıcı ve log yönetimi |
| `/student/quizzes` | Öğrenci | Sınavlarım |
| `/student/surveys` | Öğrenci | Anketlerim |
| `/parent/dashboard` | Veli | Bağlı öğrenci sınav takibi |
| `/settings` | Tüm giriş yapmış roller | Profil, bildirim ve güvenlik |

## Veri ve güvenlik notları

- SQLite geliştirme ve düşük eşzamanlı kullanım için uygundur; yüksek trafikli üretimde PostgreSQL değerlendirilmelidir.
- Öğrenci açık kayıt sırasında sınıf seçemez; sınıf üyeliğini yetkili kullanıcı atar.
- Öğretmen öğrenci veli/özel iletişim alanlarına erişemez ve yalnız dersine girdiği sınıflardaki öğrencileri görür.
- Öğrenci kişisel ve veli bilgilerini salt okunur görür; değişiklik için okul yönetimine başvurur.
- Veli hesabı öğrenciyle açık bir ilişki kurulmadan hiçbir öğrenci verisine erişemez.
- Tamamlanmamış sınavlarda cevap anahtarı öğrenciye gönderilmez.
- Görsel yüklemeleri dosya türü, boyut ve piksel sınırlarıyla doğrulanır.

## Sorun giderme

- `concurrently bulunamadı`: proje kökünde `pnpm install --frozen-lockfile` çalıştırın.
- Prisma istemcisi hazır değil: `pnpm --filter quiz-master-server exec prisma generate` çalıştırın.
- Vite API için `ECONNREFUSED`: backend'in `5000` portunda çalıştığını kontrol edin.
- Gmail zaman aşımı: kurumsal ağın `587/465` çıkışını engelleyip engellemediğini kontrol edin; DNS/proxy değiştirmeden izinli bir ağda deneyin.
- Çevrimdışı teslim bekliyor: aynı cihaz ve tarayıcıyla sınavı açıp bağlantının geri gelmesini bekleyin.
