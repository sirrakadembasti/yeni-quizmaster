# Quiz-Master: Güncel Teknik Analiz Raporu

**Rapor Tarihi:** 17 Mart 2026  
**Durum:** Kapsamlı (Modüler API, Optimize Edilmiş Arayüz, Veritabanı, AI, React 19, Admin CRUD Yönetimi)

## 1. Mimari Genel Bakış
Quiz-Master, modern bir monorepo yapısında inşa edilmiştir. Uygulama pnpm workspace üzerinden tek bir `pnpm-lock.yaml` dosyası ile yönetilir. Backend modüler (`server/api-routes/`), frontend ise merkezi bileşenlere sahip (`client/src/components/management/`) sürdürülebilir bir mimariye geçirilmiştir.

---

## 2. Veritabanı Şeması (Prisma & SQLite)
Veritabanı yapısı Prisma ORM ile yönetilmektedir. Yönetim paneline entegre edilmiş temel tablo ilişkileri şunlardır:

### 2.1 Ana Tablolar ve İlişkiler
- **`User`**: Kullanıcı bilgilerini ve rollerini (`admin`, `teacher`, `student`) tutar. Öğrenciler `classId` üzerinden doğrudan bir sınıfa bağlıyken (`1-to-N`), Öğretmenler `Many-to-Many` ilişki ile birden çok sınıfa atanabilir. Ayrıca öğrenci numarası (`classNo`) alanı mevcuttur.
- **`Class`**: Sınıf yapılandırmasıdır. Öğretmenler, öğrenciler ve ders kategorileri ile ilişkilidir. Admin, öğretmensiz sınıf oluşturabilir.
- **`Category`**: Derslerin (Örn: Matematik, Yazılım) listesini tutar.
- **`Quiz`**: Sınav başlıklarını barındırır.
- **`Question`**: Sınav sorularını barındırır. JSON formatında çoktan seçmeli seçenekleri tutar.
- **`StudentResult`**: Öğrencilerin sınav performanslarını saklar.

---

## 3. API Uç Noktaları (Endpoints)
Backend rotaları önceden tek bir dosyadayken artık `server/api-routes/` altında modüler hale getirilmiştir:

### 3.1 Yönetim ve Kullanıcı API'leri (`user.ts`, `admin.ts`)
- **`POST /api/users`**: Yeni Öğretmen veya Öğrenci oluşturur.
- **`PATCH /api/users/:id`**: Öğretmen veya Öğrenci bilgilerini günceller.
- **`DELETE /api/users/:id`**: Kullanıcıyı siler.

### 3.2 Sınıf Yönetimi (`class.ts`)
- **`POST /api/classes`**: Yeni sınıf oluşturur (Öğretmen ataması isteğe bağlıdır).
- **`PATCH /api/classes/:id`**: Sınıf adı ve açıklamasını günceller.
- **`DELETE /api/classes/:id`**: Sınıfı siler (İçindeki öğrenciler sınıfsız duruma düşer).
- **`POST /api/classes/:id/teachers`**: Sınıfa yeni bir öğretmen atar (Many-to-Many).
- **`DELETE /api/classes/:id/teachers/:teacherId`**: Öğretmeni sınıftan çıkarır.
- **`POST /api/classes/:id/students`**: Öğrenciyi sınıfa atar (1-to-N).

### 3.3 Sınav Yönetimi (`quiz.ts`, `category.ts`)
- **`GET /api/quizzes`**: Rol bazlı sınav listesi (Öğretmen: sadece **kendi oluşturduğu**, Öğrenci: yayınlananlar).
- **`GET /api/quizzes/admin/quizzes`**: **Admin Özel:** Sistemdeki tüm öğretmenlerin oluşturduğu tüm sınavları getirir.
- **`POST /api/quizzes`**: Yeni sınav oluşturur.
- **`PATCH /api/quizzes/:id`** & **`DELETE /api/quizzes/:id`**: Sınavı düzenler veya siler.

### 3.4 Öğrenci ve Sonuç Yönetimi (`student.ts`)
- **`GET /api/student/quizzes`**: Öğrencinin görebileceği sınavlar.
- **`GET /api/student/results`**: Öğrenci sonuç geçmişi.
- **`POST /api/student/quiz/:quizId/start`**: Öğrencinin sınava başlama işlemi.

### 3.5 Yapay Zeka (`ai.ts`)
- **`POST /api/ai/generate-questions`**: Gemini 3 Flash/Pro kullanarak konu bazlı soru üretir.
- **`POST /api/ai/test-config`**: AI API anahtarının geçerliliğini test eder.

---

## 4. Frontend (İstemci) Yenilikleri
1. **Merkezi Yönlendirme (Routing):** `App.tsx` içindeki devasa routing yapısı `PublicRoutes`, `StudentRoutes` ve `AdminTeacherRoutes` olarak üçe bölünmüştür.
2. **Ortak UI Bileşenleri:** Öğrenci ve Öğretmen yönetimi sayfalarındaki tekrar eden tablo ve form kodları `UserManagementTable.tsx`, `UserFormModal.tsx` bileşenleri ve `useUserManagement` kancası (hook) altında toplanarak DRY (Don't Repeat Yourself) prensibi uygulanmıştır.
3. **Modüler Sınav Oluşturma Ekranı:** Sınav oluşturma ekranındaki (`create-quiz.tsx`) ayar ve soru formları alt bileşenlere ayrılarak sayfa okunabilirliği dramatik oranda artırılmıştır.

---

## 5. Yapay Zeka (Gemini 3)
Uygulama, Google'ın en güçlü modelleri olan **Gemini 3 Flash** ve **Gemini 3 Pro**'yu kullanır. 
- **Prompt Mühendisliği:** AI'ya sistem promptu olarak 5 seçenekli, doğru cevabı işaretli ve JSON formatında çıktı vermesi için kısıtlamalar uygulanır.
- **Dinamik Model Seçimi:** Arayüzden Flash (hız) veya Pro (yüksek kalite) modeli arasında geçiş yapılabilir.
