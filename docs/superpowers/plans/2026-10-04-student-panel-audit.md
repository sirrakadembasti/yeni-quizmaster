# Öğrenci paneli inceleme planı

> **Tarihsel plan/tasarım kaydı.** 14 Ekim 2026 belge kontrolü: gelecek zaman, açık kutular ve ara sonuçlar özgün çalışma sırasını korur; güncel yapılacaklar olarak okunmamalıdır. [Sonuç ve kapsam kaydı](../../student-audit/defect-repairs.md) esas alınır.

1. Rota, sayfa, sekme ve işlem envanterini çıkar; her kontrolü kanıtla ilişkilendir.
2. 5540/5541 portlarında ayrı SQLite veritabanı ve sentetik öğrenci/sınıf/sınav/anket oluştur. Gerçek verileri ve kullanıcı değişikliklerini koru.
3. Gerçek Chromium ile navigasyon, sınav devam/teslim, anketin beş türü, sonuç/istatistik, hesap ve duyuru akışlarını çalıştır; API ve veritabanını kontrol et.
4. Mobil, klavye, hata/boş/yüklenme durumları ve yetkisiz erişimi test et. Başarısız kontrolleri gizleme; kaynak bulgusunu çalışma zamanı doğrulamasından ayır.
5. Sayfa/sekme bazında sonuç, sorun, öncelik, yeniden üretim, kabul kriteri ve açık kalan testleri raporla. Ürün düzeltmelerini sonraki uygulama planında belirt.

Bu aşama incelemedir; uygulama dosyaları değiştirilmez. Windows yerel test ortamı kullanılacaktır. Linux/WSL ve gerçek ekran okuyucu doğrulaması bu tarayıcı koşusuyla yapılmış sayılmaz.
