# QuizMaster Canlı Demo Vitrin (`domain/demo`) ve Hazır Rol Hesapları

Bu belge, uygulamanın **`domain/demo`** adresinde ayrı bir veritabanı (`server/data/demo.db`) ile çalışan **salt-okunur (mock/vitrin) ikinci kopyasını** ve her rol için tanımlanmış 4 hazır vitrin hesabını açıklar.

## 1. Hazır Vitrin Rol Hesapları

Ziyaretçiler `/demo` ekranındaki kartlardan **"Hemen İncele"** düğmesiyle tek tıkla (şifre yazmadan) veya **"Forma Doldur"** seçeneğiyle aşağıdaki hazır hesaplarla giriş yapabilirler. Ayrıca içerideyken üst bardaki **Rol Değiştir** düğmeleriyle çıkış yapmadan 4 rol arasında anında geçiş yapılabilir:

| Rol | Anahtar | Ad Soyad | E-posta | Şifre | Kapsam |
|---|---|---|---|---|---|
| **Yönetici (`admin`)** | `demo-admin` | Demo Yönetici (Okul Müdürü) | `demo-admin@quizmaster.com` | `demo123456` | Okul geneli 16 sınıf, öğretmenler, öğrenciler, veli eşleştirme, 64+ sınav, istatistikler, loglar, AI ve arşiv ekranları |
| **Öğretmen (`teacher`)** | `demo-ogretmen` | Demo Öğretmen (Matematik Zümresi) | `demo-ogretmen@quizmaster.com` | `demo123456` | Atanmış sınıflar (9-A, 9-B, 10-A, 11-A, 12-A), yayınlanmış vitrin sınavları, sınıf istatistikleri ve öğrenci sonuçları |
| **Öğrenci (`student`)** | `demo-ogrenci` | Demo Öğrenci (9-A Sınıfı) | `demo-ogrenci@quizmaster.com` | `demo123456` | 9-A sınıfı öğrenci dashboard'u, tamamlanmış sınav karneleri/cevap anahtarları, konu istatistikleri ve bekleyen sınavlar |
| **Veli (`parent`)** | `demo-veli` | Demo Veli (Öğrenci Velisi) | `demo-veli@quizmaster.com` | `demo123456` | 9-A ve 10-A sınıflarında bağlı 2 öğrenci arasında geçiş, başarı ortalaması ve soru bazlı sınav sonuç detayları |

---

## 2. Salt-Okunur (Mock) İşlem Davranışı ve `/demo` Koruma Kontrolleri

- **Okuma (`GET`) İstekleri:** Tüm dashboardlar, grafikler, öğrenci karneleri, soru-cevap analizleri ve Excel/yazdırma görünümleri `server/data/demo.db` üzerindeki gerçek simülasyon verileriyle eksiksiz çalışır.
- **Yazma (`POST`, `PUT`, `PATCH`, `DELETE`) İstekleri:** `createDemoModeGuard` (`server/middleware/demo-guard.ts`) tarafından veritabanına ulaşmadan HTTP `403` (`code: "DEMO_MODE_READ_ONLY"`) ile durdurulur ve arayüzde otomatik olarak şu bilgilendirme mesajı (toast) gösterilir:
  > **"Demo modundasınız: Bu işlem örnek amaçlıdır, veritabanında değişiklik yapılmaz."**
- **Kayıt Ol, Şifre Sıfırlama ve Demo Dışı Giriş Koruması:** Ziyaretçi `/demo` sayfasındayken (`isRequestInDemoContext`: `APP_DEMO_MODE=true`, `x-quizmaster-demo: 1` başlığı, `Referer: .../demo` veya `req.session.isDemoSession`) **Kayıt Ol** sekmesindeki form alanları devre dışı bırakılır (`demo-register-blocked-banner`), `POST /api/auth/register`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` ve 4 vitrin hesabı dışındaki e-postalarla `POST /api/auth/login` istekleri hem arayüzde hem sunucuda `403 DEMO_MODE_READ_ONLY` ile reddedilir.
- **Kartlarda Şifre Gösterimi ve "Forma Doldur" Desteği:** Express'in küresel `secureJsonReplacer` filtresi `"password"` adlı alanları maskelediği için vitrin şifresi `GET /api/auth/demo-info` yanıtında `demoPassword: "demo123456"` olarak taşınır; böylece 4 rol kartında şifre her zaman görünür ve **"Forma Doldur"** düğmesi e-posta ile birlikte şifre alanını da eksiksiz doldurur.
- **Tarayıcı Adres Çubuğunda `/demo` Önekinin Korunması (`DemoAwareRouter`):** `/demo` üzerinden giriş yapıldığında veya aktif oturum bir demo vitrin hesabına ait olduğunda Wouter yönlendiricisi `base="/demo"` olarak çalışır. Tüm alt sayfalar tarayıcı adres çubuğunda `/demo/results`, `/demo/quizzes`, `/demo/student/dashboard`, `/demo/parent/dashboard` şeklinde `/demo` altında kalır. Demo oturumundan çıkış yapıldığında kullanıcı `/demo` vitrin ekranına döner; sol üstteki Ana Sayfa düğmesi (`exitDemoNamespace`) ile `/demo` modundan çıkılarak ana `/` adresine geçilir.

---

## 3. `domain/demo` İkinci Kopya Çalıştırma ve Nginx Yapılandırması

### A) Demo Veritabanını (`server/data/demo.db`) Hazırlama / Yenileme
```bash
pnpm run db:prepare-demo
```
Bu komut `demo-admin`, `demo-ogretmen`, `demo-ogrenci` ve `demo-veli` hesaplarını hazırlar ve `VACUUM INTO` ile bağımsız `server/data/demo.db` dosyasını üretir.

### B) İkinci Kopyayı (`PORT=5001`, `APP_BASE_PATH=/demo`, `APP_DEMO_MODE=true`) Başlatma
```bash
# Derleme (Ana uygulama ve demo kopyası aynı client/dist çıktısını paylaşabilir)
pnpm run build

# Demo ikinci kopyayı 5001 portunda başlatma (server/data/demo.db ve ayrı demo-sessions deposu kullanır)
pnpm run start:demo
```

### C) Nginx Reverse Proxy (`domain/demo`) Örneği
Ana uygulama `127.0.0.1:5000` (`quiz.db`) üzerinde, demo kopyası `127.0.0.1:5001` (`demo.db`) üzerinde çalışırken Nginx `server` bloğuna aşağıdaki tanım eklenir:

```nginx
location = /demo {
    return 301 /demo/;
}

location /demo/ {
    proxy_pass http://127.0.0.1:5001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```
> Not: İkinci kopya `APP_BASE_PATH=/demo` ile çalıştığında tüm API (`/demo/api/...`), görsel (`/demo/uploads/...`), WebSocket (`/demo/socket.io/...`) ve oturum çerezi (`quizmaster.demo.sid`) trafiği ana uygulamadan tamamen izole biçimde `5001` portuna yönlenir.
