# Quiz-Master: AI Destekli Sınav Yönetim Platformu

Quiz-Master, eğitim kurumları için tasarlanmış, öğretmenlerin **Gemini 3 (Flash & Pro)** yardımıyla sınav hazırlayabildiği ve öğrencilerin bu sınavları interaktif bir şekilde çözebildiği modern bir web uygulamasıdır.

## 🚀 Öne Çıkan Özellikler

- **🤖 AI Soru Üretimi:** En yeni **Gemini 3 Flash** ve **Gemini 3 Pro** API entegrasyonu ile saniyeler içinde konu bazlı sınav hazırlama.
- **🛡️ Gelişmiş Admin Yönetimi (CRUD):** 
  - **Öğretmen ve Öğrenci Panelleri:** Sisteme yeni kişiler ekleme, düzenleme, silme ve doğrudan şifre atama yetenekleri (Merkezi UI bileşenleri ile güçlendirilmiş).
  - **Sınıf Yönetimi:** Sanal sınıflar oluşturma, her sınıfa çoklu öğretmen ve öğrenci atayabilme.
  - **Global Sınav Yönetimi:** Sistemdeki tüm sınavları tek bir ekrandan kontrol edebilme.
- **👥 Çoklu Rol Sistemi:** Admin, Öğretmen ve Öğrenci rolleri için tamamen izole edilmiş dashboardlar.
- **📄 PDF Raporlama:** Sınav sonuçlarını profesyonel PDF formatında dışa aktarma.
- **🎨 Modern Arayüz:** React 19 ve TailwindCSS v4 ile inşa edilmiş, ultra hızlı ve duyarlı tasarım.
- **⚙️ Temiz Mimari:** Modüler backend yapısı (`api-routes`) ve pnpm workspace ile tek merkezden bağımlılık yönetimi.

## 🚧 Yol Haritası (Gelecek Özellikler)
- **📊 Canlı Takip:** Sınav sonuçlarını anlık izleme ekranı (Backend altyapısı hazır).
- **📱 Mobil Uygulama:** Flutter veya React Native desteği.

## 📦 Kurulum ve Demo Giriş Bilgileri

### 1. Kurulum
Uygulama monorepo yapısında pnpm workspace kullanmaktadır. Kök dizinde tek bir pnpm kurulumu yeterlidir.
```bash
pnpm install
cd server
pnpm db:generate
pnpm db:seed
pnpm dev
```

### 📧 E-posta Yapılandırması (Şifre Sıfırlama)
Uygulama, şifre sıfırlama işlemleri için e-posta gönderim desteğine sahiptir. Yerel geliştirme ortamında hata almamak için bu özellik varsayılan olarak "pasif" (loglama modunda) tutulmuştur. Aktifleştirmek için:
1. `server/.env` dosyasına SMTP bilgilerinizi ekleyin (`EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS` vb.).
2. `server/utils/email.ts` dosyasındaki `transporter.verify` bloğunun yorum satırlarını kaldırın.

### 🔑 Demo Hesapları (Varsayılan Şifre: `QuizMaster2026!`)
| Rol | E-posta | Şifre |
| :--- | :--- | :--- |
| **Admin** | `admin@quizmaster.com` | `QuizMaster2026!` |
| **Öğretmen** | `teacher@quizmaster.com` | `QuizMaster2026!` |
| **Öğrenci** | `student@quizmaster.com` | `QuizMaster2026!` |

---
*Geliştirici Notu: Bu proje en güncel Gemini 3 modelleri ve React 19 standartları ile optimize edilmiştir.*
