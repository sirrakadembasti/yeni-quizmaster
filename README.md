# Quiz-Master

Quiz-Master, okul ortamları için geliştirilmiş, rol tabanlı bir çevrimiçi sınav yönetim platformudur. Yöneticiler okul yapısını (sınıf, öğretmen, ders) tanımlar; öğretmenler sınav oluşturur, yayınlar ve AI yardımıyla soru üretir; öğrenciler kendilerine atanan sınavları çözer ve sonuçlarını anlık olarak görür. Temel amacı, sınav sürecinin tüm aşamalarını (oluşturma, atama, çözme, değerlendirme) tek bir platformda güvenli biçimde yönetmektir.

## Kullanıcı Kılavuzları

Rolünüze uygun ayrıntılı kullanım kılavuzunu açın:

- [Yönetici Kullanıcı Kılavuzu](docs/user-guides/admin-guide.md)
- [Öğretmen Kullanıcı Kılavuzu](docs/user-guides/teacher-guide.md)
- [Öğrenci Kullanıcı Kılavuzu](docs/user-guides/student-guide.md)

### Güncel güvenlik davranışları

- API yanıtlarında parola ve hesap kurtarma belirteçleri merkezi olarak filtrelenir.
- Giriş ve kayıt sonrasında oturum kimliği yenilenir; tüm veri değiştiren istekler CSRF korumasından geçer.
- Açık kayıtla oluşturulan öğrenci kendi sınıfını belirleyemez; sınıf üyeliği yetkili kullanıcı tarafından atanır.
- Öğretmen yalnızca sorumlu olduğu sınıflara sınav ve duyuru atayabilir.
- Öğrenci yalnızca yayınlanmış ve kendisine atanmış sınavı başlatabilir.
- Sınav süresi sayfa yenilendiğinde sıfırlanmaz ve sunucu tarafından da denetlenir.
- Tamamlanmamış sınavlarda doğru cevap/cevap anahtarı öğrenciye gönderilmez.
- Parola sıfırlama belirteçleri veritabanında açık metin yerine özetlenmiş olarak saklanır.

> **Çevrimdışı kullanım:** PWA/çevrimdışı sınav altyapısı henüz uygulanmamıştır. Sınavı başlatmak, cevapları kaydetmek ve teslim etmek için internet bağlantısı gerekir.

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
pnpm dlx prisma db push      # Şemayı veritabanına uygula
pnpm dlx prisma db seed      # Demo verilerini yükle
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

- **Modern Dashboard & RBAC Log Sistemi** — Adminler tüm sistem hareketlerini (`/management?tab=logs`), öğretmen ve öğrenciler ise yalnızca kendi aktivitelerini (`/settings?tab=logs`) modern bir liste görünümünde izleyebilir. Son 5 hareket dashboard'da doğrudan görüntülenir.
- **Öğretmen Detay Sayfası** (`/teachers/:id`) — Öğretmen profil bilgileri, branş atamaları, sorumlu olduğu sınıflar ve oluşturduğu sınavların tek sayfada kapsamlı özeti.
- **Öğretmen Dashboard'u** — Dashboard başlık alanında branş badge'leri ve sorumlu sınıflar dinamik olarak gösterilir. Eğitmen ilgili sınıf detay sayfasına tek tıkla erişebilir.
- **Global Yazdırma (Print) Desteği** — Duyurular, Sınıf listeleri, Sınavlar ve Sonuç/İstatistik sayfalarında optimize edilmiş "Yazdır" butonu. Yazdırma sırasında Sidebar ve Navbar Tailwind `print:hidden` ile otomatik gizlenir.
- **AI Destekli Soru Üretimi** — Gemini API entegrasyonu ile saniyeler içinde konu bazlı, zorluk seviyesi ayarlanabilir çoktan seçmeli sorular.
- **Duyuru Merkezi** — Tüm okul geneline veya spesifik bir sınıfa/role yönelik zengin içerikli duyuru yayınlama sistemi (Admin ve Öğretmen).
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

### Log Yönetimi
- Sistemdeki her önemli işlem (`CREATE`, `UPDATE`, `DELETE`, `LOGIN` vb.) veritabanına kaydedilir.
- `/api/admin/logs` (Admin) ve `/api/admin/logs/me` (Teacher/Student) endpoint'leri ile rol bazlı log erişimi sağlanır.
- Dashboard'da her rol için son 5 log liste görünümünde gösterilir; "Tümünü Gör" linki rolün ilgili sayfasına yönlendirir.

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

- **JSON alanları:** Prisma'nın `Json` tipi SQLite tarafından desteklenmediğinden `Question.options`, `QuestionBank.options` ve `StudentResult.answers` alanları şemada `String?` olarak tutulmaktadır. PostgreSQL'e geçişte bu alanlar `Json?` tipine dönüştürülecek ve `storage.ts`'deki manuel `JSON.stringify`/`JSON.parse` çağrıları kaldırılacaktır.
- **E-posta doğrulama:** `User` modeline `emailVerified` ve `emailVerificationToken` alanları eklendi; aktivasyon akışı (token oluşturma → e-posta gönderme → doğrulama endpoint'i) altyapı olarak hazır ancak henüz devreye alınmamıştır.
- **SQLite eş zamanlılığı:** Yüksek trafikli üretim ortamları için PostgreSQL'e geçiş önerilir. Geçiş için `schema.prisma` içindeki `provider = "sqlite"` satırını `"postgresql"` olarak değiştirmek yeterlidir.
