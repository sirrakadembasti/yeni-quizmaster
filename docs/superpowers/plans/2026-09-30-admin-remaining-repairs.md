# Kalan admin onarımları

Kullanıcının onayladığı sıra: önce arşiv atomikliği ve sorumlu öğretmen erişimi, sonra kalan admin bulguları; öğretmen paneli bu kapsam tamamlanmadan başlamaz.

- [x] INV04: quiz/result/audit log aynı transaction; sonuç ve log yazımında gerçek SQLite hata enjeksiyonu ile rollback.
- [x] PE05: yeni sorumlu atamasında otomatik ikinci bağ oluşturma; sorumlu değişince eski genel bağı transaction içinde kaldır; bağımsız ders ilişkileri ve farklı öğretmen bağları korunur. API erişim403/200 ve tarayıcı kontrolü.
- [x] PE03: sorumlu ve branş atamasında öğretmen rolü/varlık/aktiflik doğrulaması.
- [x] Kalan admin kişi, sınav ve ayar ekranlarında doğrulanmış hataları test ederek gider; kapsamları ayrı ajanlar inceler, ortak veri katmanı ana ajanındır.
- [x] API/gerçek bileşen/Chromium, hata durumları ve yenileme kontrolleri; test edilmemiş davranışları açık kaydet.
- [x] README/ilgili dokümanlar/Graphify güncelle; gerçek DB parmak izi ve kullanıcının mevcut diff'ini koru; ilgili değişiklikleri commit et.

Gerçek `server/data/quiz.db` hiçbir testte yazılmaz. Mevcut `api.ts` localhost tipi ve `server-setup.tsx` düzenlemeleri korunur. Eski ikinci bağın kaynağı veri modelinde saklanmadığından seçilen kaldırma politikası: eski sorumlunun genel sınıf bağı kaldırılır; ayrı ders atamaları kalır. Toplu eski veri temizliği yapılmaz, yalnız yöneticinin sorumlu değiştir/kaldır işlemi uygulanır.
