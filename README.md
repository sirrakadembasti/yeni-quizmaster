# QuizMaster

QuizMaster; yöneticiler, öğretmenler, öğrenciler ve veliler için rol tabanlı çalışan bir sınav, anket ve okul takip uygulamasıdır. Sınav oluşturma, sınıfa atama, çevrimiçi/çevrimdışı çözme, sonuç analizi, anket yönetimi, duyuru-bildirim, Excel dışa aktarma ve Gmail üzerinden parola sıfırlama süreçlerini tek uygulamada toplar.

## Kullanıcı kılavuzları

- [Yönetici kullanıcı kılavuzu](docs/admin-guide.md)
- [Öğretmen kullanıcı kılavuzu](docs/teacher-guide.md)
- [Öğrenci kullanıcı kılavuzu](docs/student-guide.md)
- [Veli kullanıcı kılavuzu](docs/parent-guide.md)
- [Gmail e-posta ve parola sıfırlama yapılandırması](docs/e-posta-yapilandirma.md)
- [Graphify mimari haritası ve geliştirici kılavuzu](docs/graphify.md)
- [SQLite'tan PostgreSQL'e geçiş kılavuzu](docs/postgresql-gecis-rehberi.md)
- [Sunucu, domain ve reverse proxy kurulum kılavuzu](docs/sunucu-kurulum-kilavuzu.md)

## Güncel özellikler

- **Dört rol:** `admin`, `teacher`, `student` ve `parent`.
- **Sınav yönetimi:** Sınav oluşturma, soru ekleme, görsel yükleme, sınıfa atama, yayınlama ve sonuç analizi.
- **Anket Yönetimi:** Sınavdan ayrılmış oluşturma ve sonuç akışı; tek seçim, çoklu seçim, açık uçlu, derecelendirme ve Likert soru türleri.
- **Yetkilendirme:** Öğretmen yalnız yetkili olduğu sınıfları, öğrencileri, sınavları ve anketleri görür. Veli yalnız kendisiyle ilişkilendirilen öğrencilerin salt okunur sınav sonuçlarına ve soru/cevap detaylarına erişir.
- **Öğrenci yaşam döngüsü:** Sınıf içinde benzersiz otomatik öğrenci numarası, manuel değişikliğe kapalı alan ve sınav/sınıf geçmişini koruyan pasife alma.
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
| Veri | Prisma ORM, SQLite (mevcut sağlayıcı) |
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

Gerçek parolalar, Gmail uygulama parolası, oturum anahtarı ve veritabanı bağlantı bilgileri GitHub deposunda bulunmaz. Kurulumu yapan kişi veya kurum bunları kendi `server/.env` dosyasında ya da secret yöneticisinde tanımlar. `.env` dosyasını Git'e eklemeyin.

### Kişisel veya yerel bilgisayara kurulum

Bu akış uygulamayı bağımsız bir bilgisayara kurup kullanmak içindir.

#### 1. Depoyu indirin

Özel depoda GitHub hesabınızın erişim yetkisi bulunmalıdır.

```bash
git clone https://github.com/sirrakadembasti/yeni-quizmaster.git
cd yeni-quizmaster
```

#### 2. Kurulum başlatıcısını çalıştırın

Windows'ta dosyaya çift tıklayın veya terminalden çalıştırın:

```powershell
.\kurulum.bat
```

Linux/macOS'ta:

```bash
chmod +x kurulum.sh
./kurulum.sh
```

Başlatıcı, herhangi bir uygulama verisini değiştirmeden önce Node.js ve pnpm sürümlerini denetler. Eksik veya uyumsuz bileşen varsa gereken sürümü, resmî indirme bağlantılarını ve tekrar çalıştırma adımını gösterir; proxy, DNS veya sistem `PATH` ayarlarını değiştirmez.

Node.js 22/24 ve pnpm 9.15.1 zaten doğru kuruluysa başlatıcı yerine doğrudan şu komut da kullanılabilir:

```bash
pnpm run setup
```

#### 3. Grafik kurulum akışını tamamlayın

İlk ekran yalnız `127.0.0.1:5049` üzerinde açılır. Burada:

- uygulamanın bulunduğu dizin ve çalışma ortamı gösterilir,
- `pnpm install --frozen-lockfile` **Paketleri Kur / Onar** ile çalıştırılır (sihirbaza geçiş bu adım bitmeden açılmaz),
- gerçek pnpm çıktısı ve hata bilgisi ekranda izlenir,
- 5050 (sihirbaz) portu doluysa süreç PID ile gösterilir ve durdurulması istenir.

Ana sihirbaz `127.0.0.1:5050` üzerinde açılır; kurulum biçimi, adres, SQLite, saklama politikası, ilk yönetici ve isteğe bağlı Gmail ayarlarını toplar. Alanların yanındaki **?** simgesi her seçeneği kısaca açıklar.

**Kurulum biçimleri:**

| Biçim | Adres örneği | Not |
|---|---|---|
| **Yerel / localhost** | `http://127.0.0.1:5173` | `pnpm dev`: arayüz 5173, API 5000; reverse proxy/TLS gerekmez |
| **Subdomain** | `https://sinav.kurum.gov.tr` | Üretim önerilen |
| **Subpath** | `https://okul.gov.tr/quizmaster` | Kurum sitesi altı |

Ardından `.env`, migration, ilk yönetici ve production build işlemleri canlı adımlarla izlenir.

**Bitiş ekranı (önemli):** Sihirbaz, kurulum biter bitmez tarayıcıyı giriş adresine **kör yönlendirmez**. Bitişte üç düğme vardır (Windows ve Linux aynıdır):

1. **Uygulamayı başlat** — yerel kurulumda `pnpm dev` arka planda başlar (terminal penceresi açılmaz); kurum kurulumunda üretim servisi ayağa kalkar,
2. **Giriş sayfasına git** — port/domain denetlenerek `/auth` açılır,
3. **Uygulamayı aç** — yapılandırılan adres.

Yerel (localhost) kurulumda giriş adresi `http://127.0.0.1:5173/auth` (Vite) şeklindedir. Kurum (subdomain/alt yol) kurulumunda Nginx + DNS hazır olmadan adres açılmaz; örn: `server/data/setup-artifacts/nginx.conf.example`.

Linux/macOS’ta sihirbaz aynıdır; yalnız başlatıcı `./kurulum.sh` ve süreç durdurma `kill <PID>` ile yapılır.

> **Terminali sihirbaz bitene kadar kapatmayın.** Sihirbaz kurulum başlatıcısının alt sürecidir; terminal kapanırsa kurulum yarıda kalır. Başarıyla biterse başlatıcı otomatik kapanır.

#### 4. Uygulamayı başlatın

Sihirbaz bitişindeki **Uygulamayı başlat** düğmesi:

- Yerelde: `pnpm dev` (API 5000 + arayüz 5173) → `http://127.0.0.1:5173/auth`
- Kurumda: üretim servisi (`dist/index.cjs` / `pnpm start`) → yapılandırılan `https://.../auth`

Elle çalıştırmak için:

```bash
# Yerel geliştirme / demo
pnpm run dev

# Üretim (derleme sonrası)
pnpm --filter quiz-master-server start
```

Geliştirme yapmak isteyenler production sihirbazı yerine manuel geliştirme akışını kullanabilir:

```bash
pnpm install --frozen-lockfile
# server/.env.example dosyasını server/.env olarak kopyalayıp yer tutucuları değiştirin
pnpm --filter quiz-master-server db:migrate
pnpm --filter quiz-master-server db:seed   # yalnız geliştirme/demo verisi
pnpm dev
```

Seed komutunu gerçek veya üretim veritabanında kullanmayın. Manuel `.env` ve Gmail ayrıntıları için [e-posta yapılandırma belgesine](docs/e-posta-yapilandirma.md) bakın.

### Kurum sunucusuna veya VPS'e kurulum

Üretimde önerilen yöntem, tek kullanımlık güvenli kurulum sihirbazıdır.

#### 1. Sunucuyu hazırlayın ve depoyu indirin

Özel depoya erişebilen bir hesap veya deploy key ile:

```bash
git clone https://github.com/sirrakadembasti/yeni-quizmaster.git
cd yeni-quizmaster
```

#### 2. Güvenli ön kontrolü ve bootstrap ekranını başlatın

```bash
chmod +x kurulum.sh
./kurulum.sh
```

Başlatıcı Node.js 22/24 LTS ve pnpm `9.15.1` denetimini yapar. Eksikse yalnız resmî bağlantı ve komutları göstererek durur. Gereksinimler tamamsa bağımlılıksız bootstrap ekranı açılır ve paketler kullanıcı onayından sonra kurulur.

Uzak Linux/VPS kurulumu için hem bootstrap hem ana sihirbaz portunu SSH tüneline alın; bu portları internete açmayın:

```bash
ssh -L 5049:127.0.0.1:5049 -L 5050:127.0.0.1:5050 kullanici@sunucu
```

Terminalde gösterilen `http://127.0.0.1:5049/setup?token=...` adresini kendi bilgisayarınızdaki tarayıcıda açın. Paketler tamamlandığında ekran ana sihirbaza yönlendirir.

#### 3. Sihirbaz adımlarını tamamlayın

Sihirbaz sırasıyla sunucu ön kontrolünü, domain/alt yolu, SQLite ve saklama politikasını, ilk yönetici hesabını ve isteğe bağlı Gmail ayarlarını toplar. Onaydan sonra:

- `server/.env` dosyasını güvenli biçimde yazar,
- production migration'larını uygular,
- ilk yönetici hesabını oluşturur,
- frontend ve backend üretim derlemesini alır,
- `server/data/installation.lock` oluşturarak kendisini kapatır.

#### 4. Uygulamayı servis olarak çalıştırın

Elle kısa bir canlılık kontrolü için:

```bash
pnpm --filter quiz-master-server start
```

Kalıcı kullanımda bu komutu doğrudan açık terminalde bırakmayın. Linux'ta `systemd`, Windows Server'da uygun bir Windows Service yöneticisi kullanın; Node.js servisini yalnız `127.0.0.1` üzerinde çalıştırıp Nginx/IIS reverse proxy arkasından yayınlayın.

#### 5. Domain, HTTPS ve canlılık kontrollerini tamamlayın

DNS, TLS sertifikası, Nginx/IIS, servis hesabı, güvenlik duvarı ve yedekleme sihirbaz tarafından değiştirilmez. Bunları kurum politikasına göre yapılandırın ve uygulamadaki **Sunucu Durumu** ekranından origin/proxy/HTTPS algılamasını doğrulayın.

Eksiksiz production yapılandırması, örnek `systemd`, Nginx/IIS, alt yol, güncelleme, yedekleme ve geri dönüş adımları için [Sunucu Kurulum Kılavuzu](docs/sunucu-kurulum-kilavuzu.md) zorunlu başvuru belgesidir.

### Kurulum başlatıcısını yeniden çalıştırma ve temiz kurulum

Başlatıcı `installation.lock`, `.env`, SQLite dosyaları, dağıtım profili ve yüklenen dosyaları birlikte denetler. Tamamlanmış sistemde **Uygulama zaten kurulu**, eksik kilit veya kalıntı bulunan sistemde **Yarım/eski kurulum** bilgisini verir.

**Temiz kurulum** normal güncelleme değildir ve tüm kullanıcı, sınav, anket, sonuç, oturum, yapılandırma ve yüklenen dosyaları aktif sistemden kaldırır. Bu işlem:

1. uygulama servisi durdurulmadan başlamaz,
2. yalnız standart yerel SQLite kurulumunda kullanılabilir,
3. `.env`, SQLite dosyaları, yüklemeler ve dağıtım profilini `server/backups/reinstall-...` altına kopyalar,
4. her yedek dosyasını SHA-256 ile doğrular ve `manifest.json` üretir,
5. kullanıcının `QUIZMASTER VERİLERİNİ SİL` metnini eksiksiz yazmasını ister,
6. kaynak kodu, migration'ları ve oluşturulan yedeği silmez.

Üretimde yerel yedeği ayrıca sunucu dışındaki erişimi sınırlı yedek alanına taşıyın. Harici/PostgreSQL veritabanı otomatik temizlenmez.

### Kurulum yeniden açıldığında port çakışması (EADDRINUSE)

Önceki kurulum penceresi veya `kurulum.bat` / `kurulum.sh` düzgün kapatılmazsa arka planda kalan süreç `127.0.0.1:5049` (başlatıcı) veya `127.0.0.1:5050` (sihirbaz) portunu tutmaya devam eder:

```
Kurulum başlangıç sunucusu açılamadı: listen EADDRINUSE: address already in use 127.0.0.1:5049
```
veya sihirbaza geçerken:
```
Kurulum sihirbazı açılamadı: 127.0.0.1:5050 portu zaten kullanımda.
```

Bu hata kurulum verilerine zarar vermez. `kurulum.bat`, `kurulum.sh` ve başlatıcı artık:

1. portu tutan süreci (PID) gösterir,
2. hatanın nedenini açıklar,
3. süreci durdurmayı teklif eder (`taskkill` / `kill`),
4. sihirbaz butonunda da 5050 için onay sorar.

Hâlâ açık bir kurulum sekmesi varsa önce onu kullanın veya kapatın; ardından kalan süreci durdurup kurulum betiğini yeniden çalıştırın.

Sihirbaz 5050, kurulum başlatıcısı 5049 portunu kullanır. `SETUP_PORT` ortam değişkeni sihirbaza aittir; betikler bunu ezmez (`CHECK_PORT` kullanır).

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

1. Yönetici veli hesabını oluşturur; telefon ve adres veli hesaplarında zorunludur.
2. **Veli Eşleştirme** sayfasında öğrenci adı, e-posta, sınıf veya sınıf numarasıyla arama yaparak veliyi bir ya da daha fazla öğrenciye bağlar. Yakınlık yalnız **Anne / Baba / Diğer** olabilir.
3. Veli kendi hesabıyla giriş yapar.
4. **Sınav Sonuçları** sayfasından bağlı öğrencinin sonuç listesini ve soru/cevap detayını salt okunur görüntüler.
5. Yalnız bağlı öğrencileri seçebilir; tamamlanan ve bekleyen sınavları salt okunur biçimde görür.

## Rol ve erişim özeti

| İşlem | Yönetici | Öğretmen | Öğrenci | Veli |
|---|:---:|:---:|:---:|:---:|
| Tüm okul yapısını yönetme | ✓ | — | — | — |
| Yetkili sınıfta sınav/anket oluşturma | ✓ | ✓ | — | — |
| Sınav/anket çözme | — | — | ✓ | — |
| Tüm sonuçları görme | ✓ | — | — | — |
| Yetkili sınıf sonuçlarını görme | ✓ | ✓ | — | — |
| Kendi sonuçlarını görme | — | — | ✓ | — |
| Bağlı öğrenci sonucunu ve soru/cevap detayını görme | — | — | — | ✓ |
| Veli hesabı oluşturma/bağlama | ✓ | — | — | — |
| Öğrenciyi pasife alma (geçmişi korur) | ✓ | — | — | — |
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
- Üretilen paket, Microsoft Excel'in beklediği OpenXML öğe sırasını kullanır; Türkçe karakterler UTF-8/Unicode olarak korunur ve dosya Microsoft Excel 16 ile açma testinden geçirilmiştir.
- Çalışma kitabında rapor başlığı, seçili filtreler, otomatik sütun genişliği, tablo kenarlıkları, filtre ve sabit başlık satırı bulunur.
- Yazdırma görünümü navigasyon, buton ve gereksiz kontrolleri gizler; içerik A4 ve siyah-beyaz çıktıya göre düzenlenir.
- Dashboard ekranlarında yazdırma kaldırılmıştır; yalnız anlamlı liste, detay, sonuç ve rapor sayfalarında sunulur.

## Test ve doğrulama

```bash
# Backend
pnpm --filter quiz-master-server exec vitest run

# Frontend
pnpm --filter quiz-master-client exec vitest run

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
| `/parent/results` | Veli | Bağlı öğrenci sonuç listesi ve detayları |
| `/guardian-management` | Yönetici | Aramalı veli-öğrenci eşleştirme |
| `/settings` | Tüm giriş yapmış roller | Profil, bildirim ve güvenlik |
| `/server-setup` | Yönetici | Salt okunur sunucu/sağlık durumu; açıkça etkinleştirilirse dağıtım profili ve saklama bakımı |

## Veri ve güvenlik notları

- SQLite geliştirme ve düşük eşzamanlı kullanım için uygundur; yüksek trafikli üretimde PostgreSQL değerlendirilmelidir.
- Öğrenci açık kayıt sırasında sınıf seçemez; sınıf üyeliğini yetkili kullanıcı atar.
- Öğretmen öğrenci veli/özel iletişim alanlarına erişemez ve yalnız dersine girdiği sınıflardaki öğrencileri görür.
- Öğrenci kişisel ve veli bilgilerini salt okunur görür; değişiklik için okul yönetimine başvurur.
- Veli hesabı öğrenciyle açık bir ilişki kurulmadan hiçbir öğrenci verisine erişemez.
- Öğrenci sınıf numarası sınıfa atama sırasında sistem tarafından otomatik üretilir, sınıf içinde benzersizdir ve hiçbir rol tarafından elle değiştirilemez.
- Öğrenci kaldırma işlemi fiziksel silme değildir: hesap pasife alınır; sınıf ve sınav geçmişi korunur, aktif listelerden ve girişten çıkarılır.
- Yeni kullanıcı kaydında yöneticilere kalıcı ve anlık bildirim oluşturulur.
- Tamamlanmamış sınavlarda cevap anahtarı öğrenciye gönderilmez.
- Görsel yüklemeleri dosya türü, boyut ve piksel sınırlarıyla doğrulanır.

## SQLite'tan PostgreSQL'e geçiş

Uygulama şu anda **SQLite** ile çalışır. Prisma veri modeli PostgreSQL'e büyük ölçüde uyumludur: 
kimlikler uygulama tarafından UUID olarak üretilir, ilişkiler Prisma üzerinden tanımlıdır ve çalışan uygulama kodunda SQLite'a özel ham SQL sorgusu yoktur.
 Anket cevapları ve soru ayarları ilk geçişte `String` içinde JSON metni olarak kalabilir; böylece veri modeli değiştirilmeden taşınabilir.
 Bunların daha sonra PostgreSQL `Json`/`jsonb` alanlarına dönüştürülmesi ayrı ve kontrollü bir iyileştirmedir.

Ancak geçiş **yalnızca** `provider = "postgresql"` ve `DATABASE_URL` değişikliği değildir:

| Alan | Durum | Geçişte yapılacak işlem |
|---|---|---|
| Prisma modelleri ve ilişkiler | Uyumlu | PostgreSQL sağlayıcısıyla yeni başlangıç migration'ı üret |
| Mevcut `prisma/migrations` geçmişi | SQLite'a özel | PostgreSQL için ayrı ve temiz migration geçmişi oluştur |
| Mevcut uygulama verileri | Otomatik taşınmaz | Denenmiş bir ETL/aktarım aracıyla kimlik ve ilişkileri koruyarak taşı |
| Oturum deposu | `connect-sqlite3` kullanıyor | Çok sunuculu üretimden önce PostgreSQL veya merkezi bir oturum deposuna geçir |
| JSON benzeri alanlar | PostgreSQL'de metin olarak çalışır | İlk geçişte koru; gerekirse daha sonra `jsonb` için ayrı migration yap |
| Yüklenen görseller | Veritabanı dışında | `uploads` içeriğini ayrıca yedekle ve hedef ortama taşı |

Özet güvenli geçiş sırası:

1. Ayrı bir Git dalında çalışın; uygulama sürümünü sabitleyin.
2. `quiz.db`, `sessions.db` ve yüklenen dosyaların doğrulanmış yedeğini alın.
3. UTF-8 kodlamalı boş bir PostgreSQL geliştirme/veri aktarım veritabanı hazırlayın.
4. SQLite migration geçmişini silmeyin; arşivleyin. PostgreSQL için yeni bir migration geçmişi başlatın.
5. `schema.prisma` sağlayıcısını `postgresql` yapın ve PostgreSQL bağlantı adresini yalnız `.env`/secret yöneticisinde tutun.
6. Boş PostgreSQL üzerinde yeni başlangıç migration'ını üretip uygulayın.
7. Verileri, UUID değerleri ve yabancı anahtar ilişkileri korunacak biçimde taşıyın. Prisma migration komutlarının veriyi kendiliğinden taşımadığını unutmayın.
8. Model bazında kayıt sayılarını, ilişkileri ve sınav/anket örneklerini kaynak SQLite ile karşılaştırın.
9. Oturum deposunu merkezi hale getirip rol, sınav, anket, bildirim, parola sıfırlama ve çevrimdışı teslim regresyon testlerini çalıştırın.
10. Üretimde şema uygulamak için `prisma migrate deploy` kullanın; üretimde `migrate dev` çalıştırmayın. Kesinti ve geri dönüş planı olmadan geçiş yapmayın.

Komutlar, veri doğrulama sorguları, oturum deposu kararı, geri dönüş planı ve ayrıntılı kontrol listesi için [PostgreSQL geçiş kılavuzuna](docs/postgresql-gecis-rehberi.md) bakın.
 PostgreSQL'e geçildikten sonra geliştirme, test ve üretimde aynı veritabanı sağlayıcısının kullanılması önerilir; SQLite ve PostgreSQL için aynı migration klasörü paylaşılmamalıdır.

## Sorun giderme

- `concurrently bulunamadı`: proje kökünde `pnpm install --frozen-lockfile` çalıştırın.
- Prisma istemcisi hazır değil: `pnpm --filter quiz-master-server exec prisma generate` çalıştırın.
- Vite API için `ECONNREFUSED`: backend'in `5000` portunda çalıştığını kontrol edin.
- Gmail zaman aşımı: kurumsal ağın `587/465` çıkışını engelleyip engellemediğini kontrol edin; DNS/proxy değiştirmeden izinli bir ağda deneyin.
- Çevrimdışı teslim bekliyor: aynı cihaz ve tarayıcıyla sınavı açıp bağlantının geri gelmesini bekleyin.

## Güvenlik ve veri bütünlüğü bakımı

30 Eylül 2026 bakımında yetki/rol ilişkileri, sınav/anket geçmişi, eşzamanlı kayıt, oturumlar, AI dış bağlantıları ve çevrimdışı kuyruk güçlendirildi. [Bakım notları](docs/guvenlik-ve-bakim.md) ayrıntıları ve işletim sınırlarını açıklar.

Mevcut kurulumlarda tutarlı SQLite yedeği alın; `pnpm install`, `pnpm --filter quiz-master-server db:deploy`, `pnpm build` ve sunucu yeniden başlatma adımlarını uygulayın. Migration mevcut kayıtları koruyarak oturum sürümü, e-posta sahiplenme alanı ve sonuç indeksleri ekler; anket sorularının boş doğru cevap alanını migration geçmişiyle uyumlu hale getirir.

Backend testleri geçici SQLite ve taklit SMTP kullanır. Kontroller: `pnpm --filter quiz-master-server test`, `pnpm --filter quiz-master-client exec vitest run`, `pnpm -r type-check` ve `pnpm build`.
