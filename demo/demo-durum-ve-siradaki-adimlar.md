# Demo Simülasyon Durumu ve Sıradaki Adımlar

**Son Güncelleme:** 5 Kasım 2026

## Tamamlanan Adımlar
1. **10 Branş Öğretmeni Oluşturuldu & Yetkilendirildi:**
   - Branşlar: Biyoloji, Coğrafya, Edebiyat, Felsefe, Fizik, Geometri, Kimya, Matematik, Programlama, Tarih.
   - Tüm öğretmenlerin 16 sınıfla `ClassTeacherCourse` (branş-sınıf-öğretmen) ve sınıf öğretmenliği (`classTeacherId`) bağlantıları tamamlandı.
   - Giriş Formatı: `adı@quizmaster.com` / `adı123456`
   - Dosyalar: `demo/demo-ogretmen.json` ve `demo/demo-ogretmen.md`
2. **160 Öğrenci Oluşturuldu:**
   - 16 Sınıf (9-A..D, 10-A..D, 11-A..D, 12-A..D) × 10 Öğrenci.
   - Giriş Formatı: `ad.sinifkodu@quizmaster.com` / `ad123456`
   - Dosyalar: `demo/demo-ogrenci.json` ve `demo/demo-ogrenci.md`
3. **Demo Sınavlar, Sorular, Anketler ve Çözüm/İstatistik Simülasyonu Tamamlandı:**
   - 10 branş öğretmeni üzerinden 9, 10, 11 ve 12. sınıflar için toplam **40 Sınav (400 özgün soru)** ve **400 Soru Havuzu** kaydı oluşturuldu.
   - Sınavlar ilgili sınıf şubelerine atandı; **1152** tamamlanmış öğrenci sınav sonucu ve **16** devam eden sınav oturumu simüle edildi.
   - Her öğrencide hem tamamlanmış sınav/istatistik geçmişi hem de canlı deneme için **2 adet bekleyen (sıradaki) sınav** bırakıldı.
   - Ayrıca **2 okul anketi (128 öğrenci yanıtı)**, **5 duyuru**, bildirimler ve işlem geçmişi (`ActionLog`) eklendi.
   - Dosyalar: `demo/demo-sinavlar.json` ve `demo/demo-sinavlar.md`
4. **40 Demo Veli (`parent`) Hesabı Oluşturuldu & Öğrencilerle Eşleştirildi:**
   - 9, 10, 11 ve 12. sınıf seviyelerinin her birinde **10'ar veli** (A şubesinden 3, B şubesinden 3, C şubesinden 2, D şubesinden 2 öğrenciye bağlı) olmak üzere toplam **40 veli** hesabı ve `GuardianStudent` bağlantısı oluşturuldu.
   - Giriş Formatı: `<veli_ad>.veli.<sinifkodu>@quizmaster.com` / `<veli_ad>123456`
   - Dosyalar: `demo/demo-veli.json` ve `demo/demo-veli.md`
5. **`domain/demo` Salt-Okunur İkinci Kopya (`demo.db`) ve 4 Hazır Vitrin Hesabı Oluşturuldu:**
   - Bağımsız `server/data/demo.db` veritabanı ve `APP_DEMO_MODE=true` / `APP_BASE_PATH=/demo` ikinci kopya altyapısı (`pnpm run db:prepare-demo`, `pnpm run start:demo`) hazırlandı.
   - 4 hazır vitrin hesabı (`demo-admin@quizmaster.com`, `demo-ogretmen@quizmaster.com`, `demo-ogrenci@quizmaster.com`, `demo-veli@quizmaster.com` / Şifre: `demo123456`), tek tıkla giriş kartları, üst bar rol değiştirici ve yazma işlemlerinde salt-okunur uyarı (`DEMO_MODE_READ_ONLY`) katmanı eklendi.
   - Dosyalar: `demo/demo-vitrin-hesaplari.md` ve `demo/demo-vitrin-hesaplari.json`

## Durum
- **Tüm demo hazırlık, simülasyon ve `domain/demo` salt-okunur vitrin ikinci kopya adımları eksiksiz tamamlanmıştır.**
