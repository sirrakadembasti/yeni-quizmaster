# Yerel Yedek Alanı

Bu dizin yalnız kısa süreli yerel yedekler içindir. `*.bak` ve veritabanı yedekleri Git'e gönderilmez.

Üretimde yedekler uygulama sunucusundan bağımsız, erişimi sınırlı ve geri yüklemesi düzenli olarak sınanan bir depoda tutulmalıdır. Aktif `quiz.db` veya `sessions.db` dosyasını uygulama çalışırken buraya taşımayın.

`reinstall-<tarih>/` klasörleri temiz kurulum bootstrap'ı tarafından oluşturulur. İçlerinde `.env`, SQLite/oturum dosyaları, dağıtım profili, yüklemeler ve her dosyanın boyutuyla SHA-256 özetini içeren `manifest.json` bulunabilir. `.env` gizli bilgi taşıdığı için bu dizinin erişimini kısıtlayın ve yedeği güvenli sunucu dışı depoya taşıyın.
