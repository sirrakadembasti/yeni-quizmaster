# Oturum yükü kök neden analizi

> **Tarihsel kapsam/inceleme kaydı.** Kaynak satırları ve ölçümler özgün denetim tarihine aittir. Sonraki onarım kabulü [sonuç raporundadır](defect-repairs.md); buradaki ölçüm güncel üretim kapasitesi garantisi değildir.

4 Ekim 2026, HEAD `5d8a4d8` sonrası izole fixture. Altı mevcut GET rotası, dört ayrı rol oturumu, gerçek Express/Prisma/SQLite ve 15s istemci sınırı kullanıldı. Bu sonuçlar üretim kapasitesi veya eşzamanlı gerçek kullanıcı garantisi değildir.

## Karşılaştırma

| Koşu | 20 eşzamanlı / 60 istek | P95 | Süre | Oturum SQLite run P95 |
|---|---|---|---|---|
| İlk eski mod profili |59 HTTP200,1 ECONNRESET |9174ms |24621ms |7649ms |
| Log kapalı, eski mod |28 HTTP200,32 hata |15019ms |38839ms |15003ms |
| WAL, normal log |60 HTTP200,0 hata |2338ms |5043ms |1502ms |
| DELETE karşılaştırması, normal log |60 HTTP200,0 hata |12492ms |31079ms |11062ms |

İlk iki profilde ölçüm özeti senkron yazılıyordu; sonraki WAL/DELETE çiftinde aynı asenkron profil yazıcısı kullanıldı. Bu nedenle tek log-kapalı denemesinden logların etkisizliği veya kesin olay döngüsü sebebi çıkarılmaz. Log kapatma bir çözüm olarak uygulanmadı. Eşlenmiş WAL/DELETE koşuları aynı araç, fixture ve istek sayısıyla oturum deposunun journaling etkisini ayırır; sistem/disk değişkenliği tümüyle kontrol edilmedi.

`connect-sqlite3`, salt okunur kimlikli GET sonunda bile süreyi `touch` ile UPDATE eder. Varsayılan rollback journal modunda oturum okumaları/yazmaları birikiyordu. Desteklenen `concurrentDb:true` seçeneği WAL açar. Bu karşılaştırmada oturum yazma P95'i11s yerine1,5s oldu. SQL işinin bekleme sürelerine olay döngüsü gecikmesi de dahildir; bunlar SQLite CPU süreleri değildir.

## En küçük düzeltme

`server/utils/session-store.ts` mevcut `sessions.db` ve aynı Store'u WAL seçeneğiyle kurar; `server/index.ts` bunu kullanır. Uygulama veritabanı, Prisma şeması, kullanıcı ilişkileri, oturum çerezi, süresi ve iptal kuralları değiştirilmez. Dış tip tanımı yanlışlıkla `concurrentDB` yazdığı için çalışma zamanındaki doğru `concurrentDb` adı seçenek nesnesinde korunur; gerçek PRAGMA regresyonu bunu doğrular.

Yeni3 Store testi önce1 WAL beklentisinde başarısız oldu, düzeltme sonrası3/3 geçti: gerçek WAL,30 eşzamanlı read/touch + destroy ve süresi dolmuş kaydın reddi. Profil kodu yalnız test girişinden opt-in yüklenir; SQL, kullanıcı/oturum kimliği veya içerik kaydetmez. Güncel profiler etkili PRAGMA modunu ayrıca okur; karşılaştırma modunu kütüphanenin mevcut pragma'sının yerine koyar.

## İşletim sınırı

Son normal ürün koşusu (profiler override kapalı, gerçek PRAGMA `wal`):2/8/20 kademelerinin her birinde180/180 HTTP200, toplam540/540; P95 sırasıyla2017/2651/3066ms, en uzun3483ms. API süreci kapandı,5560/5561 serbest ve gerçek DB hash'i aynı. Ayrıntılar `load-repair-results.json`, `load-profile-final.json` ve [onarım raporundadır](defect-repairs.md).

SQLite oturum dosyasını yerel, yazılabilir diskte tutun. WAL'in `sessions.db-wal`/`sessions.db-shm` yan dosyalarını işletim sırasında elle silmeyin; yedekleme için tutarlı SQLite yedek yöntemi veya sunucunun kapalı olduğu kopya kullanın. Bu çalışma uygulama DB'sinin yedekleme/kurulum sözleşmesini değiştirmez. Tam180 istekli 2/8/20 kabulünün güncel sonucu [onarım raporuna](defect-repairs.md) yazılır.

Kanıtlar: `load-profile-*-results.json` ve `load-profile-*.json`; asıl tarihsel ölçümler `before-repairs/load-ux-results.json`. Gerçek DB hash'i bütün profil koşularında değişmedi; süreç/port kapanışı raporlarda yer alır.
