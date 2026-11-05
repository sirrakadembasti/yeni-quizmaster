# Hibrit yükseltme provası sonuçları

13 Ekim 2026, üretim provası Görev 2. Kaynak motor `b5ad9a1`, güvenlik/oturum düzeltmeleri `8bbb515`, production bağımlılık düzeltmesi `9cf56f5`. Yalnız ayrı dizin, port ve süreçlere sahip sentetik kurulumlar kullanıldı; canlı veritabanı sorgulanmadı. Bu rapor [bakım işlemleri](production-maintenance.md) ile birlikte okunmalıdır.

## Kabul kapsamı

| Giriş noktası | Gerçek işlem ve sonuç | Korunumu doğrulananlar |
| --- | --- | --- |
| Windows terminal | Eski `1298cf8` sürümü, gerçek frozen install/build, `pnpm run upgrade`, 17→22 migration/status, resmi production start ve Chromium: geçti | Yedi iş koleksiyonu, ayarlar, kurulum kimliği, soru görseli; auth, Sunucu Durumu, arşiv/yıl seçimi, yenileme; sahip olunan süreçler ve portlar |
| Windows BAT + web | Gerçek `kurulum.bat --no-open`, tarayıcıdan yükseltme; production bağımlılık düzeltmesinden sonra ikinci tam tur ve başarı arayüzü yerleşmesini bekleyen üçüncü tam tur: geçti | İlk sürümün özgün oturumu yeniden giriş yapılmadan çalıştı; kullanıcı/parola/sessionVersion dahil yedi koleksiyon, veli/öğretmen ilişkileri, sınav/anket cevapları; tam generated Prisma şeması, 22 migration, integrity/FK, env/lock/görsel hash'leri; arşiv, reload, sıfır pageerror; owned process tree ve port kapanışı |
| Native Ubuntu 22.04/WSL2 SH + web | Eski sürüm kurulumu, gerçek `sh kurulum.sh --no-open`, tarayıcı güncellemesi, güncel motorla son frozen install/build/deploy/status tekrarı ve production web erişimi: geçti | Altı iş koleksiyonunun eski alanları, tam generated Prisma şeması, 22 migration, integrity/FK, ayar/görsel hash'leri; auth, durum, arşiv, görsel; Linux süreç kimlikleri ve kapalı portlar |

Generated şema karşılaştırması yalnız yorum ve biçim boşluklarını dışlar; quoted değerler, alanlar, varsayılanlar ve tipler dahil bütün lexical tokenlar karşılaştırılır. Sadece model adlarının eşleşmesi yeterli sayılmadı. BAT ve SH son başarı ekranları görsel olarak da incelendi; BAT ekran görüntüsü `success` durumu ve yeniden kullanılabilir buton görülene kadar beklendikten sonra alındı.

## Bulunan ve giderilen hatalar

- Production ortamından miras alınan `NODE_ENV=production`, pnpm install sırasında build araçlarını kaldırıyordu; gerçek BAT build `esbuild` bulunamadığı için reddedildi. Yükseltme ve Paketleri Kur/Onar komutları `--frozen-lockfile --prod=false` kullanır, production modu korunur; bağımlılık işlemi `CI=true` ile etkileşimsizdir. Komut sözleşmesi ve production HTTP negatifleri RED→GREEN; son Windows bakım/yükseltme/renderer regresyonu 20/20, exit 0.
- Kök `.env` fallback kapsamı, korunan hedef env dosyaları ve fallback port denetimi tamamlandı. Yetkili başlatıcı durum isteği kısa oturumu yeniler; yetkisiz isteğe yenileme verilmez. Başarı/hata mesajı rengi yeniden hesaplanır ve kurulu-sistem paket adımı doğru açıklanır.
- Önceki native şema karşılaştırmasındaki formatter farkı yanlış negatif oluşturuyordu; tüm tokenları karşılaştıran yöntemle giderildi.

## Başarı sayılmayan denemeler ve sınırlar

İlk Windows DLL-lock denemesi, süresi dolan başlatıcı çereziyle BAT 403, etkileşimli install, devDependency kaybı, native bağlantı kopması/cleanup deadline ve kalan operation lock denemeleri kabul değildir. Native fixture kilidi ancak kendi süreçleri yokken, portlar kapalıyken ve DB/migration/integrity/FK kontrolleri geçtikten sonra sahiplik kontrolüyle kaldırıldı. Windows düşük kullanılabilir bellek gözlendi; kernel OOM kanıtı olmadığından bağlantı hatasının nedeni OOM olarak ilan edilmedi.

Native Linux paket önbelleği kullanıldı; cache'siz internetten taze indirme ölçülmedi. Yoğun kaynak baskısında özel test başlatıcısının kapanış bekleme süresi uzatıldı; ürünün varsayılan süreç sahipliği sözleşmesi değiştirilmedi. Native ekran görüntüsünde font-ready beklemesi atlandı; font yükleme zamanlaması kabul kapsamında değildir. Ürün davranışı gerçek browser/HTTP/DB ve son piksellerle doğrulandı.

Özel loglar ve ekran görüntüleri Git dışındaki `.superpowers/sdd/2026-10-05-academic-archive-review-plan/` altında tutulur: `production-bat-web-upgrade-devdeps-repaired-final-20261013.log`, `production-bat-web-upgrade-ui-settled-final-20261013.log`, `production-native-sh-repeat-production-policy-final-20261013.log`, `production-upgrade-production-policy-final-20261013.log`, `production-bat-upgraded-round-3.png`, `production-native-sh-upgraded-bootstrap.png`. Ortam/oturum bilgileri içerebilen ham kayıtlar yayımlanmaz.

Görev 2 kapanmıştır. Hatalı yükseltmeden eski kod **ve** doğru veri yedeğiyle geri dönüş Görev 3; gerçekçi eşzamanlı yük ve frontend paket ölçümü Görev 4'tür. Bunların kabulü bu rapordan çıkarılamaz.
