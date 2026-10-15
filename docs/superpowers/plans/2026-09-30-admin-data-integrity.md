# Yönetici veri bütünlüğü uygulama planı

> **Tarihsel plan/tasarım kaydı.** 14 Ekim 2026 belge kontrolü: gelecek zaman, açık kutular ve ara sonuçlar özgün çalışma sırasını korur; güncel yapılacaklar olarak okunmamalıdır. [Sonuç ve kapsam kaydı](../../admin-audit/remaining-repairs-verification.md) esas alınır.

> **Ajan olarak çalışanlar için:** ZORUNLU ALT BECERİ: Bu planı görev görev uygulamak için superpowers:subagent-driven-development veya superpowers:executing-plans kullanın. Adımların takibinde onay kutusu sözdizimi kullanılır.

**Amaç:** Öğretmen oluştururken seçilen atamaları ve soru düzenleyicisindeki tür/cevap verilerini korumak.

**Mimari:** Mevcut API rotaları ve istek verileri korunur. Seçilen ilişki kimlikleri kullanıcı rotasında doğrulanır ve mevcut Prisma kullanıcı işlemi içinde bağlanır. Soru durumu güncellemeleri işlevsel hale getirilir; seçenek kaldırılırken cevap indeksi ayarlanır.

**Teknolojiler:** React, TypeScript, Express, Prisma SQLite, Vitest, Playwright.

## Genel kısıtlar

- Hibrit terminal, `.bat`/`.sh` ve web kurulum akışlarını koru.
- Bütün veritabanı yazmalarını geçici `quizmaster-test-*` SQLite veritabanlarında çalıştır.
- `client/src/lib/api.ts` ve `client/src/pages/server-setup.tsx` dosyalarındaki önceden var olan düzenlemeleri koru.

---

### Görev 1: Öğretmen oluşturma atamaları

**Dosyalar:** `server/tests/api/admin-audit-people.test.ts`, `server/api-routes/user.ts`, `server/storage.ts`.

**Arayüzler:** POST `/api/users`, yönetici tarafından oluşturulan öğretmen için `assignedCategoryIds: string[]` ve `classIds: string[]` kabul eder; `storage.createUser` bir işlem yürütür ve oluşturulan kullanıcıyı döndürür.

- [x] Mevcut hatayı tanımlayan doğrulamayı, oluşturma sonrası okumada beklenen ilişkiyi doğrulayan kontrolle değiştir; hesap oluşturulmadan reddedilen geçersiz kimlik senaryosu ekle.
- [x] Kapsama özel gerçek Prisma API testini çalıştır ve mevcut davranışın doğrulamada başarısız olduğunu teyit et.
- [x] Rotada dizileri/kimlikleri ve öğretmen rolünü doğrula; ilişkileri `createUser` işlemi içinde bağla.
- [x] Kapsama özel gerçek Prisma testlerini (9/9) ve öğretmen tarayıcı akışını (1/1) çalıştır; mevcut form/API sözleşmesine göre boş seçim geçerli kalır.

### Görev 2: Soru düzenleyicisinde veri korunumu

**Dosyalar:** `client/src/test/admin-audit-question-editor.test.tsx`, `client/src/pages/create-quiz.tsx`, `client/src/components/quiz/QuestionItem.tsx`.

**Arayüzler:** `QuestionItem`, güncellemeleri mevcut geri çağırımlar aracılığıyla gönderir; `QuestionForm.correctAnswer` formda indeks olarak kalır, kayıtta cevap metnine dönüştürülerek serileştirilir.

- [x] Davranış tanımlama testlerini, seçilen anket türünün ve önceki bir seçenek silindikten sonra cevap metninin korunmasını bekleyecek şekilde değiştir; seçili cevabın kaldırılması için doğrulama ekle.
- [x] Kapsama özel bileşen testini çalıştır ve beklenen başarısızlıkları doğrula.
- [x] İşlevsel soru durumu güncellemelerini kullan; seçenek silindiğinde cevap seçimini ayarla/temizle.
- [x] Kapsama özel gerçek bileşen testini (5/5) ve istemci tip kontrolünü çalıştır. Düzenleyici sayfası izole tarayıcıda açıldı; düzeltilen üç etkileşimin her biri gerçek React bileşen testleriyle doğrulandı.

### Görev 3: Doğrulama ve raporlama

**Dosyalar:** `docs/admin-audit/denetim-ozeti.md`, `docs/admin-audit/people.md`, `docs/admin-audit/quizzes.md`.

- [x] Etkilenen gerçek API/bileşen/tarayıcı testlerini ve iki TypeScript tip kontrolünü yeniden çalıştır.
- [x] Sorun durumunu ve kanıtları güncelle; sonraki onarım bölümlerini açıkça açık bırak.
- [x] Tamamlandığını bildirmeden önce farkı ve gerçek veritabanı parmak izini kontrol et; gerçek `quiz.db` özeti, boyutu ve değişiklik zamanı denetim başlangıcıyla eşleşir.

## Birleştirilen ilk onarım tasarımı

> 14 Ekim 2026: ayrı belge bu bölüme içeriği korunarak birleştirildi. Aşağıdaki metin özgün tarihli tasarım/kapsam kaydıdır; güncel açık görev listesi değildir.

## Yönetici veri bütünlüğü: ilk onarım bölümü

Onaylanan yönetici denetimi, önce onarılacak iki bağımsız veri kaybı yolu belirledi: öğretmen oluşturma seçilen atamaları düşürüyor; soru düzenleyicisi ise seçenekler değiştiğinde anket türünü kaybediyor veya doğru cevabı kaydırıyor. Bu bölüm, mevcut yönetici rotalarını, API yanıt biçimlerini, hibrit terminal/web kurulumunu ve ilgisiz kullanıcı düzenlemelerini koruyarak bu yolları değiştirir.

Öğretmen oluşturma, yazmadan önce yöneticinin sağladığı kategori ve sınıf kimliği dizilerini doğrulayacak. Mevcut `createUser` işlemi öğretmeni oluşturup seçilen ilişkileri birlikte bağlayacak. Boş seçimler geçerli kalır. Geçersiz kimlikler, bozuk diziler veya öğretmen olmayan bir kişi için sağlanan atamalar hesap oluşturulmadan reddedilir. Oluşturma sonrası okuma, formun gönderdiği ilişkilerin aynısını göstermelidir.

Soru düzenleyicisi ardışık güncellemeleri mevcut React durumuna uygulayacak; böylece tek olaydan gelen tür/seçenek/yapılandırma değişiklikleri birikir. Önceki bir seçenek kaldırıldığında seçili cevap indeksi ayarlanacak; seçili cevabın kaldırılması ise kaydetmeden önce yeni seçim gerektirecek. Formun mevcut API sözleşmesi değişmez.

Gerçek Prisma/API testleri ve gerçek React bileşen testleri önce istenen davranış için başarısız olacak, ardından asgari onarımlar sonrası geçecek. İzole denetim tarayıcı ortamı, son yönetici iş akışı kontrolü için kullanılabilir kalır. Sonraki onarım bölümleri eski öğretmen erişimini, atomik sınav/arşiv yazmalarını, sonuç hesaplamalarını ve denetim raporundaki daha geniş kullanıcı deneyimi sorunlarını kapsar.
