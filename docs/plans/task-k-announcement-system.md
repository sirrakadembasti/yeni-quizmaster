# Task K: Duyuru ve Bildirim Sistemi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Admin ve öğretmenlerin duyuru yapabileceği, öğrencilerin ise bu duyuruları ve sınav bildirimlerini görebileceği kapsamlı bir sistem oluşturmak.

**Architecture:** 
1. Backend: Prisma schema'sına Announcement modeli eklenecek. 
2. API: /api/announcements rotaları oluşturulacak. 
3. Frontend: Duyuru yönetim ve görüntüleme sayfaları eklenecek. 
4. Bildirimler: Mevcut sağ üst bildirim bileşeni duyuru sistemiyle entegre edilecek.

**Tech Stack:** React, Tailwind, Prisma, Socket.IO (anlık bildirimler için).

---

### Task 1: Veritabanı Modeli ve API Oluşturma

**Files:**
- Modify: server/prisma/schema.prisma
- Create: server/api-routes/announcement.ts
- Modify: server/storage.ts

- [ ] **Step 1: Prisma Schema Güncelle**
  Announcement modelini ekle: id, title, content, createdBy, targetRole, targetClassId, createdAt.
- [ ] **Step 2: Storage Metotlarını Ekle**
  createAnnouncement, getAllAnnouncements, getAnnouncementsForUser, deleteAnnouncement metotlarını ekle.
- [ ] **Step 3: API Rotalarını Yaz**
  CRUD işlemlerini ve kullanıcı bazlı listeleme rotalarını oluştur.

### Task 2: Duyuru Yönetim Sayfası (Admin & Öğretmen)

**Files:**
- Create: client/src/pages/announcements.tsx
- Modify: client/src/components/layout/DashboardLayout.tsx (Side Menu)

- [ ] **Step 1: Yan Menüye "Duyurular" Ekle**
  Admin, Öğretmen ve Öğrenci için yan menüye link ekle.
- [ ] **Step 2: Duyuru Sayfasını Tasarla**
  - Admin: Tüm duyuruları görür ve yenisini oluşturabilir.
  - Sınıf Öğretmeni: Sorumlu olduğu sınıf için duyuru oluşturabilir.
  - Öğrenci/Branş Öğretmeni: Kendisine gelen duyuruları listeleyebilir.

### Task 3: Bildirim ve Profil Temizliği

**Files:**
- Modify: client/src/pages/settings.tsx (veya profil sayfası)
- Modify: client/src/components/NotificationListener.tsx (varsa)

- [ ] **Step 1: Profil sayfasındaki eski bilgilendirme kısmını kaldır.**
- [ ] **Step 2: Sağ üst bildirim ikonunu duyurular sayfasına yönlendir.**
- [ ] **Step 3: Sınav bildirimlerinin (Socket.IO üzerinden) doğru şekilde düşmesini sağla.**
