# Task A: Sınıf Listesi ve Detay Sayfası İyileştirmeleri

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Sınıf detay sayfasındaki branş öğretmeni hatasını düzeltmek, öğrenci tablosunu modern bir görünüme kavuşturmak ve yazdırma özelliği eklemek.

**Architecture:** Frontend tarafında React ve Tailwind CSS kullanılacak. Mevcut tablolar Material Design prensiplerine uygun olarak modernize edilecek. Yazdırma işlemi için tarayıcı print özelliği (window.print()) ve CSS @media print kuralları kullanılacak.

**Tech Stack:** React, Tailwind CSS, Lucide React (ikonlar için).

---

### Task 1: Branş Öğretmeni Atama Hatasını Araştır ve Düzelt

**Files:**
- Modify: D:\dnm\Quiz-Master\client\src\pages\class-detail.tsx (veya ilgili admin sayfası)
- Modify: D:\dnm\Quiz-Master\server\routes.ts (veya ilgili API route)

- [ ] **Step 1: Mevcut kodu incele**
  Sayfada branş öğretmenlerinin nasıl çekildiğini ve uyarının hangi koşulda tetiklendiğini kontrol et. D:\dnm\Quiz-Master\client\src\pages\class-detail.tsx dosyasını oku.

- [ ] **Step 2: Backend API'yi doğrula**
  API'nin branş öğretmeni verisini doğru formatta döndürdüğünden emin ol.

- [ ] **Step 3: UI koşulunu güncelle**
  Ders bilgisi olmasına rağmen çıkan uyarıyı, verinin varlığını daha doğru kontrol edecek şekilde güncelle.

### Task 2: Öğrenci Listesi Tablosu Redizaynı

**Files:**
- Modify: D:\dnm\Quiz-Master\client\src\pages\class-detail.tsx

- [ ] **Step 1: Tablo yapısını sadeleştir**
  Material Design prensiplerine uygun, daha geniş aralıklı ve sade bir tablo yapısına geç.
- [ ] **Step 2: S.No sütunu ekle**
  Tablonun en başına index + 1 değerini gösteren "S.No" sütunu ekle.
- [ ] **Step 3: Sütunları güncelle**
  "İletişim Bilgisi" sütununu kaldır. "Öğrenci Profili" sütun adını "Öğrenci Adı Soyadı" olarak değiştir.

### Task 3: Yazdır Butonu ve Print Formatı

**Files:**
- Modify: D:\dnm\Quiz-Master\client\src\pages\class-detail.tsx

- [ ] **Step 1: Yazdır butonu ekle**
  Sayfanın sağ üst köşesine bir Print ikonu ve butonu ekle.
- [ ] **Step 2: Print CSS ekle**
  Sadece tabloyu ve gerekli başlıkları yazdıracak, yan menüyü ve butonları gizleyecek @media print stillerini ekle.
