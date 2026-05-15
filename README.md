# Quiz-Master

Quiz-Master, okul ortamları için geliştirilmiş, rol tabanlı bir çevrimiçi sınav yönetim platformudur. Yöneticiler okul yapısını (sınıf, öğretmen, ders) tanımlar; öğretmenler sınav oluşturur, yayınlar ve AI yardımıyla soru üretir; öğrenciler kendilerine atanan sınavları çözer ve sonuçlarını anlık olarak görür. Temel amacı, sınav sürecinin tüm aşamalarını (oluşturma, atama, çözme, değerlendirme) tek bir platformda güvenli biçimde yönetmektir.

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

- **Modern Dashboard & RBAC Log Sistemi** — Adminler tüm sistem hareketlerini, öğretmen ve öğrenciler ise yalnızca kendi aktivitelerini modern bir liste görünümünde izleyebilir.
- **Global Yazdırma (Print) Desteği** — Sınıf listeleri, sınavlar ve sonuç raporları için optimize edilmiş "Yazdır" özelliği. Yazdırma sırasında Sidebar ve Navbar otomatik olarak gizlenir.
- **AI Destekli Soru Üretimi** — Gemini API entegrasyonu ile saniyeler içinde konu bazlı, zorluk seviyesi ayarlanabilir çoktan seçmeli sorular.
- **Duyuru Merkezi** — Tüm okul geneline veya spesifik bir sınıfa/role yönelik zengin içerikli duyuru yayınlama sistemi.
- **Güvenlik ve Performans**
  - **CSRF Koruması:** Otomatik yenileme mekanizmalı, mutasyon bazlı güvenlik.
  - **RBAC (Rol Tabanlı Erişim):** Backend seviyesinde katı yetkilendirme middleware'leri.
  - **Real-time:** Socket.IO ile sınav anında anlık iletişim ve bildirimler.
  - **Atomik İşlemler:** Prisma transaksiyonları ile veri bütünlüğü koruması.

---

## Teknik Detaylar

### Güvenlik Katmanı
- **CSRF Token:** Her mutasyon isteğinde frontend tarafından otomatik eklenir, geçerliliğini yitirdiğinde şeffaf biçimde yenilenir.
- **Rate Limiting:** Kaba kuvvet (brute-force) ve AI API kötüye kullanımını engellemek için endpoint bazlı limitler.
- **SSRF Koruması:** AI modülünde sadece güvenli IP ve domain'lere izin veren filtreleme sistemi.

### Log Yönetimi
- Sistemdeki her önemli işlem (`CREATE`, `UPDATE`, `DELETE`, `LOGIN` vb.) veritabanına kaydedilir.
- `/api/admin/logs/me` endpoint'i ile kullanıcılar kendi işlem geçmişlerini gizlilik içinde görebilir.

### Yazdırma Optimizasyonu
- Tailwind v4 `print:` sınıfları kullanılarak temiz çıktı düzeni.
- Detay sayfalarında (Öğretmen Detay vb.) ve tüm ana listeleme sayfalarında hazır yazdırma butonları.

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
