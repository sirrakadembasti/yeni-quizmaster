# Çalışma Verileri

Bu dizin uygulamanın yerel çalışma verilerini barındırır ve veritabanı dosyaları Git'e eklenmez.

- `quiz.db`: Aktif SQLite uygulama veritabanıdır. Uygulama çalışırken silinmemeli veya taşınmamalıdır.
- `sessions.db`: Aktif HTTP oturum deposudur. Silinmesi tüm kullanıcı oturumlarını kapatır.
- `deployment-config.json`: Kurulum sihirbazı veya açıkça yetkilendirilmiş **Sunucu Durumu** ekranınca kaydedilen, gizli olmayan dağıtım profilidir.
- `installation.lock`: Tek kullanımlık ilk kurulumun tamamlandığını gösterir; çalışan sistemi yeniden kurulum saldırılarından korur.
- `setup-artifacts/`: Sihirbazın ürettiği gizli bilgi içermeyen reverse proxy ve ortam örnekleridir.

Yedekleri bu dizinde biriktirmeyin. Yedekler `server/backups` veya tercihen uygulama sunucusu dışındaki şifreli/yetkili bir yedek deposunda tutulmalıdır.

Kurulum bootstrap ekranındaki **Temiz kurulum**, uygulama servisi durdurulduktan sonra bu çalışma verilerini ve `server/uploads` içeriğini aktif sistemden kaldırır. İşlem öncesinde `server/backups/reinstall-...` altında SHA-256 doğrulamalı yedek ve `manifest.json` oluşturulması zorunludur. `README.md`, migration dosyaları ve kaynak kod temizlenmez.
