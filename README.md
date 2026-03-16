# QuizMaster AI - Eğitim ve Quiz Platformu

QuizMaster AI, Gemini Yapay Zeka desteğiyle öğretmenlerin hızlıca sınav oluşturmasını, öğrencilerin ise kendilerini test etmesini sağlayan kapsamlı bir eğitim platformudur.

## 🚀 Yeni Mimari ve Teknolojiler

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Query.
- **Backend:** Node.js (v20+), Express.js, **Prisma ORM**.
- **Veritabanı:** SQLite (Prisma ile yönetilen ilişkisel yapı).
- **Yapay Zeka:** Google Gemini 1.5/2.0 API (OpenAI uyumluluk katmanı ile).
- **Güvenlik:** express-session (cookie tabanlı), bcryptjs, express-rate-limit.

## 🛠 Kurulum ve Başlatma

### 1. Bağımlılıkları Kurun
```bash
# Kök dizinde
pnpm install
cd server && pnpm install
cd ../client && pnpm install
```

### 2. Veritabanını Başlatın (Prisma)
Aşağıdaki komutları sırasıyla `server` dizininde çalıştırın:
```bash
# 1. Şemayı veritabanına uygulayın
pnpm db:migrate --name init

# 2. Prisma Client'ı oluşturun
pnpm db:generate

# 3. Yeni Demo Hesapları ve Kategorileri Yükleyin (Seed)
pnpm db:seed
```

### 3. Uygulamayı Çalıştırın
```bash
# server dizininde
pnpm dev

# client dizininde
pnpm dev
```

## 🔐 Yeni Güvenli Demo Hesapları

| Rol | E-posta | Şifre |
|-----|---------|-------|
| **Admin** | admin@quizmaster.com | `QuizMaster2026!` |
| **Öğretmen** | teacher@quizmaster.com | `QuizMaster2026!` |
| **Öğrenci** | student@quizmaster.com | `QuizMaster2026!` |

## 📡 API Uç Noktaları (RESTful)

### Auth
- `POST /api/auth/register` - Yeni kullanıcı kaydı
- `POST /api/auth/login` - Giriş yap
- `GET /api/auth/me` - Mevcut kullanıcı bilgisi

### Quiz & Sorular
- `GET /api/quizzes` - Tüm quizleri listele (Role göre filtrelenir)
- `POST /api/quizzes` - Yeni quiz oluştur (Admin/Teacher)
- `POST /api/quizzes/:id/questions` - Quize toplu soru ekle
- `GET /api/quizzes/:id` - Quiz detaylarını ve sorularını getir

### Kategori Yönetimi (Admin/Teacher)
- `GET /api/categories` - Tüm kategoriler
- `POST /api/categories` - Yeni kategori oluştur
- `DELETE /api/categories/:id` - Kategori sil

### Sınıf Yönetimi (Admin)
- `GET /api/classes` - Sınıfları listele
- `POST /api/classes` - Yeni sınıf oluştur
- `POST /api/classes/:id/students` - Sınıfa öğrenci ata (Öğrenci başına tek sınıf kısıtı)

### Yapay Zeka (AI)
- `POST /api/ai/generate-questions` - Gemini API kullanarak soru üret

## 💡 Temel Özellikler
- **AI Soru Üretici:** `gemini-3-flash-preview` ve `gemini-3-pro-preview` modellerini destekler.
- **Canlı İzleme:** Öğretmenler aktif sınavları anlık olarak takip edebilir.
- **İlişkisel Veri:** Prisma sayesinde sınıflar, öğrenciler ve öğretmenler arasındaki bağlar kesin kısıtlamalarla korunur.
