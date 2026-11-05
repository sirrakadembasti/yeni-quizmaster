# Yönetici Paneli Denetim, Onarım Sözleşmeleri ve Kapanış Raporu

Bu belge; yönetici (`admin`) panelinin 23 rota ve sekmesini kapsayan denetim bulgularını, veri bütünlüğü/onarım sözleşmelerini, Excel/yazdırma, erişilebilirlik ve hibrit kurulum (Windows Terminal/BAT ve Linux/WSL2 SH) kapanış doğrulamalarını tek raporda birleştirir. Kullanıcı işlemleri için [Yönetici Kılavuzuna](../yonetici-kilavuzu.md) bakın.

## 1. Yönetici Veri Bütünlüğü ve Davranış Sözleşmeleri

### Sınıf ve Öğretmen Erişimi
- Sorumlu öğretmen atanması tek `classTeacherId` bağlantısı oluşturur. Mevcut sorumlu öğretmen değiştirildiğinde veya kaldırıldığında eski öğretmenin aynı sınıftaki genel bağlantısı da aynı veritabanı işlemi (transaction) içinde kaldırılır.
- Bağımsız branş/ders atamaları (`ClassTeacherCourse`) ve diğer öğretmenlerin bağlantıları korunur. Kalan bir ders ataması erişim sağlamaya devam eder; son ders ataması da kaldırıldığında erişim sona erer.
- Öğretmen ataması aktif `teacher` hesabı gerektirir; geçersiz kimlik veya olmayan ders/sınıf için `400`/`404` yanıtı verilir.

### Sınıf Kapasitesi (`maxStudents`)
- `maxStudents` pozitif tam sayıysa aktif öğrenciler sınırı oluşturur; `null` sınırsızdır.
- Yeni kayıt, nakil, rol değişimi, yeniden etkinleştirme ve sınıf atlatmada kapasite kontrolü aynı transaction içindeki aktif kayıt sayısına uygulanır. Pasif öğrenciler kapasite tüketmez.

### Atomik İçerik Kaydı, Arşiv ve Silme
- Sınav ve anket düzenleyicisinde ayarlar, sorular ve yayın durumu tek atomik işlemde kaydedilir; katılım başlamış sınav/anket soruları değiştirilemez.
- Arşiv adayları ve sonuç yıl etiketleri `ARCHIVE_YEAR` işlem kaydıyla birlikte tamamlanır veya birlikte geri alınır.
- Kalıcı sınav silme işleminde gerekçe, içerik adı ve silinen soru/sonuç/anket teslimi sayıları `DELETE_QUIZ` kaydına aynı transaction içinde yazılır.

## 2. Doğrulanan ve Kapatılan Başlıca Bulgular

| Kod | Alan | Kapatılan Sorun ve Kabul Özeti |
|---|---|---|
| **Q01–Q05** | Sınav / Anket / Sonuçlar | Anket soru türü değişiminin sıfırlanması, doğru cevap kayması, atomik sınav kaydı, devam eden sınavın 0 puan sayılması ve yönetici sonuç filtresinde öğretmen sınavlarının görünmesi düzeltildi. |
| **PE01–PE06** | Öğretmen / Sınıf / Veli | Öğretmen ders-sınıf atama kaybı, ilişkisel önbellek (cache) yenilemesi, kaldırılan sorumlu öğretmenin eski erişimi ve veli eşleştirme hata bildirimleri düzeltildi. |
| **INV01–INV13** | Yönetim / Ayarlar / Loglar | Profil güncellemesinin `AuthContext`'e yansıması, sunucu taraflı log sayfalaması, duyuru hata durumu ayrımı ve dağıtım adresi doğrulaması düzeltildi. |
| **EX01–EX04** | Excel Dışa Aktarma | Yönetici öğretmen detayında tüm sınıf/sınavların aktarılması, sonuç raporunda yetkili kişi e-postası/filtresi, yükleme tamamlanmadan erken indirme engeli ve öğrenci geçişinde eski istek temizliği (race condition) düzeltildi. |
| **PR01–PR04** | A4 Yazdırma / PDF | Yönetim ve sınıf detayında rapor başlığının korunması, anket sonuçlarında yatay (landscape) sayfa bütünlüğü ve öğretmen detayında sayfalama dışındaki tüm sınavların (21/21) baskıda yer alması doğrulandı. |
| **AX01–AX08** | Erişilebilirlik ve Klavye | Ayarlar, sonuç filtreleri, anket tarih filtreleri, sunucu durumu, sınıf geri bağlantısı, arşiv sınıf atlatma kontrolleri için görünür `label`/`htmlFor` eşlemeleri ve modal kapanışında odak dönüşü (Escape) tamamlandı. |
| **HY01–HY06** | Hibrit Kurulum ve Üretim Derlemesi | Seçili API portunun Vite proxy ile senkronizasyonu, `/api/status` tekil sorgu kilidi, kurulu sistemde yeniden kurulum koruması (`409`), Prisma `RUST_LOG=info` SQLite oluşturma uyumu ve `sharp` native bağımlılık (`--external:sharp`) üretim başlangıcı doğrulandı. |

## 3. Kabul ve Regresyon Sonuçları

- **Birim ve API Regresyonu:** İstemci **117/117** (19 dosya), sunucu **189/189** (31 dosya), kurulum/proxy testleri **20/20** geçti.
- **Excel ve Yazdırma (Üretim Derlemesi):** **16/16** gerçek tarayıcı ve PDF/XLSX kontrolü geçti.
- **Erişilebilirlik (Masaüstü ve Mobil 390 px):** **53/53** kontrol sıfır yakalanmamış sayfa hatasıyla geçti.
- **Hibrit Kurulum Matrisi:** Windows Terminal, `kurulum.bat` ve Git SH üzerinde temiz kurulum **3/3**, Ubuntu 22.04.5 LTS / WSL2 üzerinde yerel Linux `kurulum.sh` temiz kurulumu **1/1** tam geçti. Test kanıtları `tests/denetim-kanitlari/yonetici/` dizinindedir.
