# Çalışma Verileri

Bu dizin uygulamanın yerel çalışma verilerini barındırır ve veritabanı dosyaları Git'e eklenmez.

- `quiz.db`: Aktif SQLite uygulama veritabanıdır. Uygulama çalışırken silinmemeli veya taşınmamalıdır.
- `sessions.db`: Aktif HTTP oturum deposudur. Silinmesi tüm kullanıcı oturumlarını kapatır.
- `deployment-config.json`: Yönetici **Sunucu Kurulumu** ekranından kaydedilen, gizli olmayan dağıtım profilidir. Değişikliklerin çoğu yeniden başlatmada etkinleşir.

Yedekleri bu dizinde biriktirmeyin. Yedekler `server/backups` veya tercihen uygulama sunucusu dışındaki şifreli/yetkili bir yedek deposunda tutulmalıdır.
