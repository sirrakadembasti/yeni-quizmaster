# Veri koruyan hibrit güncelleme tasarımı

Kullanıcının 6 Ekim üretim provası talimatı yükseltme/rollback/yük testlerini ve bulunan hataların giderilmesini önceden onaylar; kullanıcı çevrimiçi olmadan sürdürmemizi ister. Bu tasarım o kapsamın Görev 2 ayrıntısıdır; ayrıca onay beklenmez.

## Sorun ve seçenekler

Kurulu sistemde başlatıcı paket onarabilir ama migration/derleme için veri koruyan güncelleme işlemi sunmaz; ilk kurulum sihirbazı installation.lock ve mevcut yönetici nedeniyle yeniden çalıştırılamaz. Belgelerde yalnız elle terminal komutları vardır. Mevcut sihirbazı kurulu DB üzerinde yeniden kullanmak ilk yönetici/config semantiğini değiştirir; yalnız belge eklemek web/BAT/SH yükseltme talebini karşılamaz. Seçilen yaklaşım ayrı yerel yükseltme motoru ve mevcut loopback başlatıcıya bir güncelleme işlemidir.

## Sözleşme

Operatör onaylı sürüm kodunu mevcut checkout'a yerleştirir ve uygulama/işçilerini durdurur. Motor kaynak kod indirme, remote Git değiştirme veya servis durdurma yetkisi almaz. Kurulu lock/env/standart SQLite bulunmalı; canlı port, eşzamanlı yükseltme ve bozuk yedek durumları güvenli reddedilir. Terminal komutu açık proje dizini ister; web komutu yalnız başlatıcının sabit proje dizinini kullanır. BAT/SH aynı başlatıcıyı açmaya devam eder.

Sıra: özel verinin SQLite backup API ile yedeği → frozen-lockfile paket kurulumu → server/client derleme → production migration deploy → migration status. Önce derleme yapılması derleme hatasında DB migration'ını önler. Mevcut admin, ayar, kurulum lock'u, uploads ve arşivler korunur; ilk yönetici oluşturma ve reset çağrılmaz. Sabit pnpm komutları shell string birleştirmesi olmadan çalışır. Web mevcut cookie/CSRF/origin kontrolünü, job durumunu ve logs sınırını kullanır; yeni parola veya env içeriği UI'ye gönderilmez.

Başarı mesajı migration/derleme sonucu ve yedek konumunu belirtir; operatör servis yöneticisiyle yeniden başlatır. Health/login/web ayarlarının kabulü ayrı gerçek prova adımıdır. Herhangi bir hata işi başarısız gösterir, yedeği korur ve adımı belirtir. Migration uygulanmış bir hatada otomatik eski kodu başlatmak güvenli değildir; sürüm+veri birlikte geri dönüş Görev 3'te sınanır. Yükseltme kontrol kilidi yalnız bu motordaki paralel işleri önler; bakım boyunca uygulamayı kapalı tutma zorunluluğu sürer.

## Kabul

Test önce kurulu başlatıcıda eksik güncelleme akışını RED gösterir. Birim/entegrasyon: yedeğin komutlardan önce alınması, yanlış/eksik kurulum, frozen install/build/migration hata sırası, lock/ayar/dosya korunumu, tekrar/eşzamanlı iş ve auth/CSRF/origin negatifleri. Gerçek izole önceki commit `1298cf8` (14 migration) → güncel commit (22 migration) için terminal ve BAT+web; Ubuntu/WSL native SH+web turu. Gerçek paket kurulum/migration/build/start/login, ilişkiler/veriler/dosyalar, Sunucu Durumu, yeniden başlatma ve bütün sahip olunan süreç/port temizliği kanıtları gerekir. Controlled pnpm veya schema-template kopyası bu gerçek upgrade kabulünün yerine geçmez.

Kapsam: scripts/upgrade-lib.mjs, scripts/upgrade.mjs, testleri, scripts/setup-bootstrap.mjs, package komutları, ilgili README/kurulum/bakım belgeleri. Korunan iki kullanıcı frontend dosyası ve canlı veri değişmez. Tasarım gözden geçirilmiştir; rollback ve yük/bundle ayrı görevlerdir.
