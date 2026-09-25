# Yerel Yedek Alanı

Bu dizin yalnız kısa süreli yerel yedekler içindir. `*.bak` ve veritabanı yedekleri Git'e gönderilmez.

Üretimde yedekler uygulama sunucusundan bağımsız, erişimi sınırlı ve geri yüklemesi düzenli olarak sınanan bir depoda tutulmalıdır. Aktif `quiz.db` veya `sessions.db` dosyasını uygulama çalışırken buraya taşımayın.
