# QuizMaster

QuizMaster; yöneticiler, öğretmenler, öğrenciler ve veliler için rol tabanlı çalışan bir sınav, anket ve okul takip uygulamasıdır. Sınav oluşturma, sınıfa atama, çevrimiçi/çevrimdışı çözme, sonuç analizi, anket yönetimi, duyuru-bildirim, Excel dışa aktarma ve Gmail üzerinden parola sıfırlama süreçlerini tek uygulamada toplar.

## AI yönetimi ve kullanım takibi

16 Ekim 2026 sürümünde adminin **AI Yönetimi** sayfası iki sekmelidir: **ai profil yönetimi** ve **öğretmen ai kullanımı**. Sağlayıcı, model, şifreli API anahtarı ve varsayılan profili yalnız admin yönetir; öğretmen sınav/anket üretiminde kullanıma açık modellerden seçim yapar. Birden fazla profil, MiMo hizmet/bölge seçimi, kayıtlı anahtarı koruma, listeden model seçme ve elle kimlik girişi desteklenir.

Öğretmen üretimleri ders ve sınav/taslak bağlamıyla, sağlayıcının bildirdiği gerçek girdi/çıktı tokenları üzerinden izlenir. Geçmiş tüketim geriye dönük uydurulmaz; bilinmeyen sayı sıfır sayılmaz. Yanıt üst sınırı ile gerçek tüketim farklıdır; token alanında 10 soru ve iki 10 üretimiyle 20 soru örneği açıklanır. Tek istekte en fazla 10 soru sınırı korunur.

- [Yapay zeka kullanımı, profil/anahtar yönetimi, öğretmen token takibi ve devreye alma](docs/yapay-zeka-yonetimi.md)

Mevcut yerel kurulumda 25 migration uygulanmıştır; diğer kurulumlarda iki AI migration'ı dahil yükseltmeyi önce ayrı kopyada prova edin ve profil DB'siyle `server/data/ai-encryption.key` dosyasını birlikte yedekleyin. Bu dosya ve canlı veriler Git'e dahil değildir.

## Kullanıcı kılavuzları ve denetim raporları

Gmail gönderimi, gerçek Gemini/Socket, oturum yükü, çevrimdışı durum, bildirim, erişilebilir kontrol ve baskı düzeltmelerinin kabul kanıtları [Entegrasyon Denetim Raporundadır](docs/denetim-raporlari/entegrasyon-denetim-raporu.md).

Öğrenci panelinin sayfa/sekme denetimi, 6 hatanın düzeltmeleri ve gerçek Chromium/API/veritabanı regresyonları [Öğrenci Denetim Raporunda](docs/denetim-raporlari/ogrenci-denetim-raporu.md) yer alır.

Veli panelinin sayfa/sekme kapsamı, bağlı öğrenci erişimi, sınıf bildirimleri, öğrenci seçimi, hata toparlama ve yazdırma düzeltmelerinin kabul sonuçları [Veli Denetim Raporundadır](docs/denetim-raporlari/veli-denetim-raporu.md).

- [Yönetici kullanıcı kılavuzu](docs/yonetici-kilavuzu.md)
- [Öğretmen kullanıcı kılavuzu](docs/ogretmen-kilavuzu.md)
- [Öğrenci kullanıcı kılavuzu](docs/ogrenci-kilavuzu.md)
- [Veli kullanıcı kılavuzu](docs/veli-kilavuzu.md)
- [Eğitim yılı geçişi ve arşivleme](docs/yil-gecisi-ve-arsivleme.md)
- [Sunucu, domain ve reverse proxy kurulum kılavuzu](docs/sunucu-kurulum-kilavuzu.md)
- [Üretim, bakım, yedekleme ve yükseltme kılavuzu](docs/uretim-ve-bakim-kilavuzu.md)
- [Performans, paket boyutu ve kapasite raporu](docs/performans-ve-kapasite-raporu.md)
- [Gmail e-posta ve parola sıfırlama yapılandırması](docs/e-posta-yapilandirma.md)
- [Güvenlik ve bakım sözleşmeleri](docs/guvenlik-ve-bakim.md)
- [SQLite'tan PostgreSQL'e geçiş kılavuzu](docs/postgresql-gecis-rehberi.md)
- [Graphify mimari haritası ve geliştirici kılavuzu](docs/graphify-mimari-haritasi.md)
- [Belge güncellik ve temizlik kaydı](docs/dokumantasyon-inceleme.md)

## Dokümantasyon ve kanıt dizinleri

5 Kasım 2026 düzenlemesi: proje ve dokümantasyon için tek giriş belgesi bu ana README’dir. Tüm kullanım ve işletim kılavuzları Türkçe dosya adlarıyla `docs/` kökünde, rol ve sistem kabul raporları `docs/denetim-raporlari/` altında, otomatik test ve ekran/PDF kanıt çıktıları ise `docs/` dışındaki `tests/denetim-kanitlari/` dizininde yer alır.

| Dizin / Belge Grubu | Amaç | İçerik ve kullanım |
|---|---|---|
| [`docs/`](docs) | Ana kullanım ve işletim kılavuzları | Yönetici, öğretmen, öğrenci, veli, kurulum, bakım, e-posta, yapay zeka, arşiv, güvenlik, performans, PostgreSQL ve Graphify kılavuzları. |
| [`docs/denetim-raporlari/`](docs/denetim-raporlari) | Rol ve sistem kabul/denetim raporları | Yönetici, öğretmen, öğrenci, veli, entegrasyon ve akademik arşiv kabul raporları. |
| [`demo/`](demo) | Demo okul simülasyonu ve vitrin hesapları | 10 branş öğretmeni, 160 öğrenci, 40 veli, 40 sınav ve `domain/demo` 4 hazır vitrin rolü belgeleri. |
| [`tests/`](tests) | Test süiti, E2E ve denetim kanıtları | Uçtan uca Playwright testleri (`tests/e2e/`), denetim yapılandırmaları (`tests/yapilandirma/`) ve otomatik test/kanıt çıktıları (`tests/denetim-kanitlari/`). |

### Kurulum ve işletim

- [Sunucu kurulumu](docs/sunucu-kurulum-kilavuzu.md): localhost, domain, `domain/demo`, TLS/proxy ve servis.
- [Bakım, tam yedek/restore, yükseltme ve geri dönüş](docs/uretim-ve-bakim-kilavuzu.md).
- [Gmail ve parola sıfırlama](docs/e-posta-yapilandirma.md).
- [Güvenlik ve bakım sözleşmeleri](docs/guvenlik-ve-bakim.md).
- [Akademik paket içeriği ve sınırları](docs/denetim-raporlari/akademik-arsiv-kabul-raporu.md): dönem dışa aktarımı; tam sunucu yedeği değildir.
- [PostgreSQL geçiş hazırlığı](docs/postgresql-gecis-rehberi.md): ayrı geliştirme/prova gerektirir; mevcut sürüm SQLite kullanır.
- [Graphify kaynak haritası ve sınırları](docs/graphify-mimari-haritasi.md).

### Kabul sonuçları ve kapasite raporları

| Konu | Sonuç kaynağı |
|---|---|
| Akademik arşiv, geçmiş ve sınıf geçişi | [Akademik arşiv kabul raporu](docs/denetim-raporlari/akademik-arsiv-kabul-raporu.md) |
| Terminal/BAT/SH yükseltmesi ve hatalı yükseltmeden kurtarma | [Üretim ve bakım kılavuzu](docs/uretim-ve-bakim-kilavuzu.md) |
| Frontend paket, çevrimdışı sınav ve 80 öğrencilik kapasite provası | [Performans ve kapasite raporu](docs/performans-ve-kapasite-raporu.md) |
| Yönetici paneli | [Yönetici denetim raporu](docs/denetim-raporlari/yonetici-denetim-raporu.md) |
| Öğretmen paneli | [Öğretmen denetim raporu](docs/denetim-raporlari/ogretmen-denetim-raporu.md) |
| Öğrenci paneli | [Öğrenci denetim raporu](docs/denetim-raporlari/ogrenci-denetim-raporu.md) |
| Veli paneli | [Veli denetim raporu](docs/denetim-raporlari/veli-denetim-raporu.md) |
| AI, Socket, bildirim, UX ve oturum yükü | [Entegrasyon denetim raporu](docs/denetim-raporlari/entegrasyon-denetim-raporu.md) |

### Belge düzeni ve bakım

Aynı bilgiyi birden fazla kılavuza kopyalamak yerine ana belgeye bağlantı verin. İşlem değiştiğinde ilgili kılavuzu, kabul durumu değiştiğinde `docs/denetim-raporlari/` altındaki ilgili raporu güncelleyin.

[Dosya bazında güncellik ve temizlik kaydı](docs/dokumantasyon-inceleme.md), birleştirilen dosyaları, Türkçe adlandırma yapısını ve kontrol kapsamını listeler.

## Güncel özellikler

- **Dört rol:** `admin`, `teacher`, `student` ve `parent`.
- **Sınav yönetimi:** Sınav oluşturma, soru ekleme, görsel yükleme, sınıfa atama, yayınlama ve sonuç analizi.
- **Anket Yönetimi:** Sınavdan ayrılmış oluşturma ve sonuç akışı; tek seçim, çoklu seçim, açık uçlu, derecelendirme ve Likert soru türleri.
- **Yetkilendirme:** Öğretmen yalnız yetkili olduğu sınıfları, öğrencileri, sınavları ve anketleri görür. Veli yalnız kendisiyle ilişkilendirilen öğrencilerin salt okunur sınav sonuçlarına ve soru/cevap detaylarına erişir.
- **Öğrenci yaşam döngüsü:** Sınıf içinde benzersiz otomatik öğrenci numarası, manuel değişikliğe kapalı alan ve sınav/sınıf geçmişini koruyan pasife alma.
- **Eğitim yılı ve arşiv:** Manuel arşiv seçili iş verilerini korur; yılı kapatmaz veya öğrenci taşımaz. 15 Temmuz 00:05 İstanbul yıllık işi, doğrulanmış ZIP/PDF paketi sonrasında yılı kapatır, önkontrolden geçen aktif öğrencileri bir kez ilerletir ve son sınıfları mezun eder. Öğretmen atamaları korunur. Admin menüsündeki yıl seçici tamamlanmış geçmiş dönemleri salt okunur açar; yeni girişte aktif yıl seçilir. Akademik paket tam sunucu geri yükleme yedeği değildir.
- **Yönetici işlem tutarlılığı:** Arşiv ve kalıcı sınav silme işlemleri işlem kaydıyla birlikte tamamlanır veya geri alınır. Sınıf kapasitesi aktif öğrencilere uygulanır; sorumlu öğretmen değişiminde bağımsız ders atamaları korunur. Ayrıntılar [Yönetici Denetim Raporundadır](docs/denetim-raporlari/yonetici-denetim-raporu.md).
- **Raporlama:** Anket, sınav sonucu, sınıf istatistiği, öğrenci, öğretmen ve sınıf ekranlarında A4 uyumlu yazdırma; uygun ekranlarda biçimlendirilmiş `.xlsx` Excel çıktısı.
- **Türkçe Excel desteği:** Dışa aktarımlar gerçek Excel çalışma kitabı üretir; Türkçe karakter, sütun genişliği, başlık, filtre bilgisi ve sabit başlık satırı korunur.
- **Duyuru ve bildirim:** Rol/sınıf hedefleme, gönderen adı ve rolü, son beş bildirim, tekil silme ve ses açma/kapatma.
- **Kayıt bilgilendirme ve parola sıfırlama:** Yeni kullanıcı kaydında veritabanı tabanlı `EmailQueue` Outbox kuyruğuna kayıt başarı bilgilendirme e-postası (`registration_welcome`), tek kullanımlık parola sıfırlama bağlantısı, SHA-256 token özeti, `PasswordResetRequest` takibi, yönetici panelinde SMTP'siz tek kullanımlık bağlantı üretme (**Bağlantı Üret (SMTP'siz)**) ve terminal üzerinden yerel yönetici kurtarma (`db:reset-admin`).
- **Canlı Demo Vitrin (`domain/demo`) ve 4 hazır rol hesabı:** Ayrı bir `server/data/demo.db` veritabanı ve `APP_DEMO_MODE=true` (`APP_BASE_PATH=/demo`) ile çalışan ikinci kopya desteği; `demo-admin`, `demo-ogretmen`, `demo-ogrenci` ve `demo-veli` hesaplarıyla tek tıkla (**Hemen İncele**) veya **Forma Doldur** (`demo123456`) ile giriş, üst bardan anında rol değiştirme, tüm alt sayfalarda `/demo/...` tarayıcı URL önekinin korunması (`DemoAwareRouter`), `/demo` modunda yeni kullanıcı kaydı/şifre sıfırlama/demo dışı girişlerin engellenmesi ve veri değiştiren işlemlerde salt-okunur simülasyon koruması (`DEMO_MODE_READ_ONLY`). Ayrıntılar [`demo/demo-vitrin-hesaplari.md`](demo/demo-vitrin-hesaplari.md) belgesindedir.
- **Çevrimdışı sınav:** Süresiz sınavı önceden cihaza hazırlama, cevapları yerelde tutma ve bağlantı geldiğinde sunucuya gönderme.
- **Güvenlik:** Oturum yenileme, CSRF koruması, hız sınırı, rol tabanlı API denetimi, parola/token alanlarının yanıtlardan temizlenmesi ve sunucu taraflı sınav süresi doğrulaması.

## Teknoloji yığını

| Katman | Teknoloji |
|---|---|
| Frontend | React, TypeScript, Vite, TanStack Query, Wouter, Tailwind CSS, shadcn/ui |
| Backend | Node.js, Express, TypeScript, Socket.IO, Pino |
| Veri | Prisma 6.19.3, better-sqlite3 12.8.0 / SQLite 3.51.3, WAL |
| Kimlik ve güvenlik | `express-session`, SQLite oturum deposu, bcrypt, CSRF, Zod |
| E-posta | Nodemailer, Gmail SMTP, veritabanı Outbox kuyruğu |
| Test | Vitest, Supertest, Playwright |
| Paket yönetimi | pnpm workspaces (önerilen/varsayılan) / Bun (deneysel) |

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
├── scripts/                      # Kurulum, derleme ve bakım betikleri
├── tests/                        # Test süiti, E2E ve denetim kanıtları
│   ├── e2e/                      # Uçtan uca Playwright testleri
│   ├── denetim-kanitlari/        # Otomatik test ve ekran/PDF kanıt çıktıları
│   └── yapilandirma/             # Rol ve denetim test yapılandırmaları
├── docs/                         # Kullanıcı ve işletim belgeleri
│   └── denetim-raporlari/        # Rol ve sistem kabul raporları
├── demo/                         # Demo okul simülasyonu ve vitrin hesapları
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

Başlatıcı, herhangi bir uygulama verisini değiştirmeden önce Node.js ve pnpm sürümlerini denetler. Eksik veya uyumsuz bileşen varsa gereken sürümü, resmî indirme bağlantılarını ve sistemde npm/corepack durumuna göre dinamik komut alternatiflerini gösterir; proxy, DNS veya sistem `PATH` ayarlarını değiştirmez. `kurulum.sh` ayrıca Linux/macOS ayrımı, root yetki uyarısı, yazma izinleri, disk alanı (>3 GB) ve native derleme araçları kontrollerini yürütür.

Node.js 22/24 ve pnpm 9.15.1 zaten doğru kuruluysa başlatıcı yerine doğrudan şu komut da kullanılabilir:

```bash
pnpm run setup
```

#### 3. Grafik kurulum akışını tamamlayın

İlk ekran yalnız `127.0.0.1:5049` üzerinde açılır. Burada:

- uygulamanın bulunduğu dizin ve çalışma ortamı (Node.js, pnpm ve sistemde varsa deneysel Bun seçeneği) gösterilir,
- varsayılan olarak `pnpm install --frozen-lockfile --prod=false` (veya panelden deneysel Bun seçildiyse `bun install`; Bun yolunda migration/derleme adımları henüz doğrulanmamıştır, üretim için pnpm kullanın) **Paketleri Kur / Onar** ile etkileşimsiz çalıştırılır; production ortamında da sihirbaz/derleme araçları kurulur (sihirbaza geçiş bu adım bitmeden açılmaz),
- gerçek paket yöneticisi çıktısı ve hata bilgisi ekranda izlenir,
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
- Kurumda: üretim servisi (`pnpm --filter quiz-master-server start`) → yapılandırılan `https://.../auth`

Elle çalıştırmak için:

```bash
# Yerel geliştirme / demo
pnpm run dev

# Üretim (derleme sonrası)
pnpm --filter quiz-master-server start
```

Geliştirme yapmak isteyenler production sihirbazı yerine manuel geliştirme akışını kullanabilir:

```bash
pnpm install --frozen-lockfile --prod=false
# server/.env.example dosyasını server/.env olarak kopyalayıp yer tutucuları değiştirin
pnpm --filter quiz-master-server db:migrate
pnpm --filter quiz-master-server db:seed   # yalnız geliştirme/demo verisi
pnpm dev
```

Seed komutunu gerçek veya üretim veritabanında kullanmayın. Manuel `.env` ve Gmail ayrıntıları için [e-posta yapılandırma belgesine](docs/e-posta-yapilandirma.md) bakın.

### İlk admin hesabı ve giriş

Girişte kullanıcı adı yerine **e-posta adresi** kullanılır. Üretim için ortak bir varsayılan admin e-postası/şifresi yoktur. Kurulum sihirbazında ilk yöneticinin e-postasını ve şifresini kuran kişi belirler. Güncelleme mevcut hesabı veya şifreyi değiştirmez; gerçek şifreler README'ye yazılmaz.

Sihirbaz kullanmadan manuel kurulum yapan kişi, bağımlılıklar ve migration'lar tamamlandıktan sonra ilk admin'i şu komutla oluşturur:

```powershell
$env:BOOTSTRAP_ADMIN_NAME = Read-Host 'Yönetici adı'
$env:BOOTSTRAP_ADMIN_EMAIL = Read-Host 'Yönetici e-postası'
$adminSecurePassword = Read-Host 'En az 12 karakterlik benzersiz yönetici şifresi' -AsSecureString
try {
  $env:BOOTSTRAP_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $adminSecurePassword).Password
  pnpm --filter quiz-master-server db:create-admin
} finally {
  Remove-Item Env:BOOTSTRAP_ADMIN_PASSWORD, Env:BOOTSTRAP_ADMIN_EMAIL, Env:BOOTSTRAP_ADMIN_NAME -ErrorAction SilentlyContinue
  $adminSecurePassword.Dispose()
}
```

Linux/macOS'ta aynı `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` ortam değişkenlerini güvenli terminal girdisiyle tanımlayıp `pnpm --filter quiz-master-server db:create-admin` çalıştırın; işlem sonunda değişkenleri temizleyin. Şifre en az 12 karakter olmalı; `quizmaster`, `password` veya `123456` gibi tahmin edilebilir ifadeler içermemelidir. Zaten admin varsa komut hesabı ezmez, ikinci admin oluşturmaz ve şifreyi sıfırlamaz.

Ardından uygulamanın giriş ekranında belirlediğiniz e-posta ve şifreyi kullanın. Mevcut bir kurulumda şifre unutulduysa **Şifremi unuttum** akışı, yönetici panelindeki **Şifre Talepleri > Bağlantı Üret (SMTP'siz)** seçeneği veya sunucu terminalinden `pnpm --filter quiz-master-server run db:reset-admin` komutuyla yetkili yerel kurtarma uygulanmalıdır; `db:seed` çalıştırmayın. Seed yalnız ayrı demo ortamları içindir ve mevcut verileri siler. Demo ortamı için hazırlanan öğretmen, öğrenci ve veli hesapları `demo/` dizinindeki belgelerde (`demo-ogretmen.md`, `demo-ogrenci.md`, `demo-veli.md`) listelenir.

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

Sınav/anket düzenleyicisi ayarları, soruları ve yayın durumunu birlikte kaydeder. Yanıt alınamayan kaydı aynı düzenleyicide yeniden denemek ikinci bir taslak oluşturmaz. Sonuç ekranındaki başarı hesapları yalnız tamamlanan ve puanı bulunan kayıtları kullanır; devam eden katılım ayrıca gösterilir.

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

# Uçtan uca testler (önce bir kez: Chromium artık pnpm install ile indirilmez)
pnpm --filter quiz-master-server run archive:prepare
pnpm test:e2e
```

> Chromium yalnızca uçtan uca testler ve akademik arşiv PDF'i için gerekir; `pnpm install` sırasında indirilmez. PDF üretimi Chromium bulamazsa açıklayıcı bir hata verir.

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
| `/demo` ve `/demo/*` | Herkes (4 demo vitrin rolü) | Salt okunur canlı demo vitrin giriş ekranı ve `/demo` URL önekli rol dashboard/alt sayfaları (`demo-admin`, `demo-ogretmen`, `demo-ogrenci`, `demo-veli`) |

## Veri ve güvenlik notları

- SQLite kapasitesi iş yüküne ve yapılandırmaya bağlıdır. 15 Ekim izole 80 öğrencilik provada 4.334 istek hatasız tamamlandı; eşzamanlı yazmalar hâlâ sıraya girer. Gerçek okul Wi-Fi kapasitesi ayrıca ölçülmelidir; [sonuçlar ve sınırlar](docs/performans-ve-kapasite-raporu.md).
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

Mevcut sürüm SQLite kullanır. PostgreSQL için ham arşiv SQL’i, trigger korumaları, oturum ve bakım araçları ayrıca uyarlanmalıdır; aşağıdaki sıra tamamlanmış sağlayıcı desteği anlamına gelmez.

Uygulama şu anda **SQLite** ile çalışır. Prisma veri modeli PostgreSQL'e büyük ölçüde uyumludur: 
kimlikler uygulama tarafından UUID olarak üretilir ve ilişkiler Prisma üzerinden tanımlıdır. Arşiv, oturum ve bakım yollarında SQLite'a özel ham SQL ve sürücü davranışları bulunur; bunlar PostgreSQL için ayrıca uyarlanmalıdır.
 Anket cevapları ve soru ayarları ilk geçişte `String` içinde JSON metni olarak kalabilir; böylece veri modeli değiştirilmeden taşınabilir.
 Bunların daha sonra PostgreSQL `Json`/`jsonb` alanlarına dönüştürülmesi ayrı ve kontrollü bir iyileştirmedir.

Ancak geçiş **yalnızca** `provider = "postgresql"` ve `DATABASE_URL` değişikliği değildir:

| Alan | Durum | Geçişte yapılacak işlem |
|---|---|---|
| Prisma modelleri ve ilişkiler | Uyumlu | PostgreSQL sağlayıcısıyla yeni başlangıç migration'ı üret |
| Mevcut `prisma/migrations` geçmişi | SQLite'a özel | PostgreSQL için ayrı ve temiz migration geçmişi oluştur |
| Mevcut uygulama verileri | Otomatik taşınmaz | Denenmiş bir ETL/aktarım aracıyla kimlik ve ilişkileri koruyarak taşı |
| Oturum deposu | Ayrı `sessions.db`, better-sqlite3 tabanlı depo | Çok sunuculu üretimden önce PostgreSQL veya merkezi bir oturum deposuna geçir |
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

- `concurrently bulunamadı`: proje kökünde `pnpm install --frozen-lockfile --prod=false` çalıştırın. Production ortamında kurulum/derleme araçları da gereklidir.
- Prisma istemcisi hazır değil: `pnpm --filter quiz-master-server exec prisma generate` çalıştırın.
- Vite API için `ECONNREFUSED`: backend'in yapılandırılan `PORT` üzerinde çalıştığını kontrol edin; varsayılan `5000`'dir. Vite, süreç ortamı → `server/.env` → kök `.env` sırasıyla yalnız `PORT` değerini okuyarak API, yükleme ve Socket.IO isteklerini aynı sunucuya iletir. Port değişince Vite'ı yeniden başlatın.
- Gmail zaman aşımı: kurumsal ağın `587/465` çıkışını engelleyip engellemediğini kontrol edin; DNS/proxy değiştirmeden izinli bir ağda deneyin.
- Çevrimdışı teslim bekliyor: aynı cihaz ve tarayıcıyla sınavı açıp bağlantının geri gelmesini bekleyin.

## Güvenlik ve veri bütünlüğü bakımı

12 Ekim 2026 akademik arşiv kabulü: backend genel regresyonu 412/412, frontend 272/272, ayrı gerçek DB/hacim kabulü 74/74; beş ayrı gerçek Chromium arşiv senaryosu, PDF/ZIP/görsel bütünlüğü, tip kontrolleri ve üretim derlemesi geçti. [Akademik arşiv kabul raporu](docs/denetim-raporlari/akademik-arsiv-kabul-raporu.md) kullanılan izole ortamı ve sınırları açıklar.

Yerel SQLite uygulama verisi için `pnpm maintenance backup --project <kurulum> --name <ad>` ve `pnpm maintenance restore --backup <yedek> --project <bağımsız-boş-veri-hedefi>` komutları eklendi. Önce tüm uygulama süreçlerini durdurun. Native WAL/session turu, gerçek şema/taşınan arşiv API'si ve geri yüklenen admin hesabıyla Chromium girişi doğrulandı; kullanım, özel ayar kapsamı ve sınırlar [Üretim ve Bakım Kılavuzunda](docs/uretim-ve-bakim-kilavuzu.md) açıklanır.

Kurulu sistemi verileri koruyarak güncellemek için onaylı sürüm kodunu yerleştirip app/worker süreçlerini durdurun, ardından `pnpm run upgrade --project <kurulum>` kullanın. Terminal/BAT/SH başlangıç ekranındaki **Mevcut Kurulumu Güncelle** aynı motoru çağırır: doğrulanmış yedek, etkileşimsiz frozen install (`--prod=false` ile build araçları dahil), build, production migration ve status. İlk admin yeniden oluşturulmaz. Varsa kök `.env` fallback ayarları da özel yedek kapsamındadır; hedefteki mevcut env dosyaları ezilmez. İşlem sırası, yükseltme ve geri dönüş kabulü [Üretim ve Bakım Kılavuzundadır](docs/uretim-ve-bakim-kilavuzu.md).

30 Eylül 2026 bakımında yetki/rol ilişkileri, sınav/anket geçmişi, eşzamanlı kayıt, oturumlar, AI dış bağlantıları ve çevrimdışı kuyruk güçlendirildi. [Bakım notları](docs/guvenlik-ve-bakim.md) ayrıntıları ve işletim sınırlarını açıklar.

14 Ekim hatalı yükseltme kurtarma kabulü: Windows dört hata aşaması ve native Linux kısmi migration hatası sonrası bağımsız eski kaynak/yedekle geri dönüş geçti. Özgün oturum, yedi iş koleksiyonu, eski şema/17 migration, integrity/FK, ayar/görsel ve süreç/port kapanışı korundu. Otomatik rollback yoktur; kurtarma işlemi [Üretim ve Bakım Kılavuzunda](docs/uretim-ve-bakim-kilavuzu.md) açıklanır.

14–15 Ekim performans ve kapasite provalarında başlangıç JavaScript gzip boyutu **%43,37 küçüldü**, ardından 5 Kasım'da `manualChunks` ile 500 kB üzeri parça uyarısı sıfırlandı; dört sınıf × 20 öğrenci, 20 görselli soru ve 30 dakika sınav ayarıyla izole prova **4.334 ölçülen istek, 0 hata; 1.600 cevap ve 80 sonuç** ile tamamlandı. Cevap kaydı p95 **7,24 sn**, teslim **9,66 sn**, teslimden sonraki kişisel sonuç **0,31 sn** ölçüldü. Ayrıntılar [Performans ve Kapasite Raporundadır](docs/performans-ve-kapasite-raporu.md).

Mevcut kurulumlarda uygulama/worker süreçlerini durdurup tutarlı SQLite yedeğini doğrulayın; `pnpm install --frozen-lockfile --prod=false`, `pnpm --filter quiz-master-server exec prisma generate`, `pnpm --filter quiz-master-server db:deploy`, `pnpm build` ve sunucu yeniden başlatma adımlarını uygulayın. [Bakım ve geri dönüş adımları](docs/uretim-ve-bakim-kilavuzu.md).

Backend testleri geçici SQLite ve taklit SMTP kullanır. Kontroller: `pnpm --filter quiz-master-server test`, `pnpm --filter quiz-master-client exec vitest run`, `pnpm -r type-check` ve `pnpm build`.

Yönetici panelinin sayfa/sekme denetimi, gerçek Excel/PDF çıktı kontrolleri, erişilebilirlik ve izole hibrit kurulum denemeleri [Yönetici Denetim Raporunda](docs/denetim-raporlari/yonetici-denetim-raporu.md) izlenir.

3 Ekim 2026 Windows tekrarında terminal, BAT ve Git SH üzerinden ayrı temiz kurulumlar **3/3 geçti**; Ubuntu 22.04.5 LTS / WSL2 üzerinde native Linux SH temiz kurulumu **1/1 geçti**. [Linux/WSL kanıtı](tests/denetim-kanitlari/yonetici/evidence/closure/hybrid/linux-wsl-first-passed/result.json).

Öğretmen panelinin 29 maddelik sayfa/sekme envanteri, gerçek API/Chromium kontrolleri, Excel/PDF kanıtları ve hata onarımları [Öğretmen Denetim Raporundadır](docs/denetim-raporlari/ogretmen-denetim-raporu.md).
