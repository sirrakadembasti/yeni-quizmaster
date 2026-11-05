# Yönetici onarımlarının davranış sözleşmeleri

1 Ekim 2026. Bu belge kabul edilen davranışı tanımlar; test geçişi iddiası içermez. Güncel koşu kanıtları ve bekleyen kontroller [kalan onarımlar doğrulama kaydında](./remaining-repairs-verification.md), önceki paket sonuçları [tarihsel doğrulama kaydında](./repair-verification.md) bulunur.

## Sınıf ve öğretmen erişimi

Sorumlu öğretmen atanması tek `classTeacherId` bağlantısı oluşturur. Aynı öğretmen ayrıca genel öğretmen listesine otomatik eklenmez. Mevcut sorumlu öğretmen değiştirildiğinde veya kaldırıldığında eski öğretmenin aynı sınıftaki genel bağlantısı da aynı transaction içinde kaldırılır. Bağımsız ders atamaları ve diğer öğretmenlerin bağlantıları korunur. Kalan bir ders ataması erişim sağlamaya devam eder; son ders ataması da kaldırıldığında erişim sona erer.

Eski genel bağlantıların otomatik mi elle mi kurulduğuna ilişkin köken bilgisi veritabanında bulunmaz. Bu nedenle mevcut kayıtlar topluca değiştirilmez; kural yalnız yöneticinin açık sorumlu öğretmen değişikliği sırasında uygulanır. Eski öğretmen ayrıca genel yetkiyle kalacaksa açıkça yeniden atanmalıdır.

Öğretmen ataması aktif `teacher` hesabı gerektirir. Öğrenci hesabı, geçersiz kimlik veya olmayan ders/sınıf için anlaşılabilir 400/404 yanıtı verilir.

## Sınıf kapasitesi

`maxStudents` pozitif tam sayıysa aktif öğrenciler sınırı oluşturur; `null` sınırsızdır. Yeni kayıt, nakil, rol değişimi, yeniden etkinleştirme ve sınıf atlatmada kontrol aynı transaction içindeki kayıt sayısına uygulanır. Pasif öğrenciler kapasite tüketmez. Mevcut sınıfta ad/iletişim bilgisi düzenlemek veya aynı sınıfa yeniden atamak yeni kontenjan tüketmez. Kapasiteyi mevcut aktif sayının altına indirmek reddedilir.

## Arşiv ve silme

Arşiv adayları yıl etiketi olmayan ve henüz `archived` olmayan içeriklerdir. Yıl etiketi olmayan öğrenci sonuçları da arşiv yılıyla etiketlenir. Önizleme API'si aynı koşulları sayar; önizleme başka bir yöneticinin eşzamanlı değişikliklerini kilitlemez, kesin etki başarılı işlem yanıtındaki sayıdır.

İçerik durumları, sonuç yıl etiketleri ve `ARCHIVE_YEAR` işlem kaydı birlikte tamamlanır veya birlikte geri alınır. Tekrar denemede önceki arşiv kayıtları yeniden etiketlenmez. Kalıcı sınav silme işleminde gerekçe, içerik adı ve silinen soru/sonuç/anket teslimi sayıları `DELETE_QUIZ` kaydına aynı transaction içinde yazılır; log yazılamazsa silme de geri alınır.

## Sunucu ayarları ve hibrit kurulum

Terminal, `kurulum.bat` / `kurulum.sh` ve yerel web sihirbazıyla yapılan hibrit ilk kurulum korunur. Yönetici paneli ilk kurulumun yerine geçmez; çalışan uygulamanın durumunu ve izin verilmiş bakım ayarlarını yönetir. Yeni kurulumda anahtarlar panelde gösterilmez.

Sunucu durumu yenilenirken kaydedilmemiş form değerleri korunur. Kalıcı temizlik yalnız kaydedilmiş, etkin ve ekranda gösterilen politikayla eşleşen ayarlar için çalıştırılabilir. Onay metni her kayıt türünün süre sınırını, sonuç bildirimi her türün silinen kayıt sayısını açıklar.

Bu belge davranışı açıklar. Testlerin güncel sonucu ve çalıştırılmamış kontroller doğrulama raporunda ayrıca belirtilir; kaynak incelemesi tek başına E2E başarısı değildir.
