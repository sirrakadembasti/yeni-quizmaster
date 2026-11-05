# Veli Paneli Denetim, Hata Onarımları ve Kabul Raporu

Bu belge; veli (`parent`) panelinin bağlı öğrenci sınav takibi, salt okunur sonuç/soru-cevap incelemesi, duyuru bildirimleri ve yazdırma davranışlarına ilişkin denetim bulgularını ve 4 Ekim 2026 tarihli 15 onarım/iyileştirme maddesinin kabul sonuçlarını birleştirir. Kullanıcı işlemleri için [Veli Kılavuzuna](../veli-kilavuzu.md) bakın.

## 1. Kapatılan Hatalar ve Kullanılabilirlik İyileştirmeleri (`P-B01` – `P-B10`, `P-U01` – `P-U05`)

| Kod | Değişiklik ve Kabul Sözleşmesi | Doğrulama Kanıtı |
|---|---|---|
| **P-B01** | Sınav cevap yazma uç noktasında öğrenci rolü zorunlu kılındı; veli oturumuyla gönderilen denemelere `403` dönülür ve veritabanı değişmez. | Güvenlik E2E ve `student-exam` birim testleri. |
| **P-B02** | Veli duyuru hedef sınıfı aktif bağlı öğrenciler üzerinden çözülür; aynı sınıfta iki kardeşi olan veliye tek bildirim gider, pasif/kaldırılmış bağlara bildirim gitmez. | Gerçek `POST` / liste / SQLite E2E testi. |
| **P-B03** | Öğrenci ve veli panellerinde ortak yayınlanmış sınav (`exam`) kapsamı uygulanır; taslak, arşiv veya anket kayıtları sınav listesine girmez. | Ortak kapsam birim ve API E2E testleri. |
| **P-B04–06** | Bağlı öğrenci listesi, özet ve sonuç detayı için yükleniyor / hata / **Tekrar dene** durumları ayrıldı; `500`/`403` hataları boş veriyle karışmaz. | Kontrollü hata ve toparlama E2E testleri. |
| **P-B07** | Seçili öğrenci kimliği (`studentId`) URL parametresiyle korunur; sayfa yenileme, geri dönüş ve dashboard $\rightarrow$ sonuçlar geçişinde aynı bağlı öğrenci izlenir, yabancı öğrenci kimliği reddedilir. | Sayfa geçiş ve URL bağlamı E2E testleri. |
| **P-B08** | Sonuç detayında soru görseli, alternatif metin ve bozuk görsel uyarısı eklendi; güvenli olmayan veri URL'leri (SVG/çalıştırılabilir içerik) reddedilir. | Gerçek PNG detay E2E ve 8 birim testi. |
| **P-B09** | Duyuru hedef etiketlerinde `VELİLERE` ayrımı ve yönetici hedef seçicisinde `Veliler` seçeneği doğrulandı. | Baskı ve hedef kitle E2E testleri. |
| **P-B10** | Bildirim yazdırma görünümünde kaydırma alanı (`scroll viewport`) sınırı kaldırılarak mevcut sayfadaki 20 bildirimin tamamının PDF çıktısında yer alması sağlandı. | Gerçek Chromium PDF metin ve görüntü doğrulaması. |
| **P-U01–05** | Bağlı öğrencisi olmayan veli için okul yönetimi yönlendirmesi, öğrenci seçici erişilebilir adı, soru detayında **Doğru / Yanlış / Yanıtsız** metni ve güvenlik sekmesinde parola alanlarının baskıda gizlenmesi tamamlandı. | Ortak rol PDF ve erişilebilirlik E2E testleri. |

## 2. Doğrulama ve Kabul Sonuçları

- **Gerçek Chromium + Express + SQLite Kabul Kapsamı:** **50/50** kontrol (`0` başarısız, `0` atlanan) geçti.
- **Birim ve Entegrasyon Regresyonları:** Sunucu **196/196** (34 dosya), istemci **149/149** (25 dosya) geçti; TypeScript ve üretim derlemesi çıkış `0` ile tamamlandı.
- **PDF ve Baskı Doğrulaması:** Bildirim (20/20 satır), işlem geçmişi (50/50 satır) ve profil (4 kayıtlı alan, sıfır parola alanı) PDF çıktıları metin ve görsel olarak doğrulandı. Test kanıtları `tests/denetim-kanitlari/veli/` dizinindedir.
