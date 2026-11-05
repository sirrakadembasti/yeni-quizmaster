# Başarısız yükseltmeden geri dönüş provası

14 Ekim 2026 tarihinde Windows üzerinde dört gerçek hata senaryosu, native Linux üzerinde gerçek migration hatası ve eski kod/veriyle geri dönüş geçti. Test aracı: `scripts/production-rollback-rehearsal.mjs`.

Eski kaynak `1298cf8266348cf2bfd338ad431b4136c5f2ae2e` (17 migration), yükseltme kaynağı `9cf56f5` (22 migration). Her senaryo bağımsız Git dışa aktarımı ve sentetik yükseltme öncesi yedek kullanır. Motorun oluşturduğu yedek, farklı boş eski kaynak dizinine geri yüklenir; eski kod22 migration bulunan veritabanında başlatılmaz.

| Gerçek hata | Windows | Native Linux |
| --- | --- | --- |
| Frozen lockfile uyuşmazlığı | Geçti; migration öncesi reddedildi, eski kod/veri/UI doğrulandı | Çalıştırılmadı |
| App.tsx sözdizimi hatası | Geçti; build reddedildi, eski kod/veri/UI doğrulandı | Çalıştırılmadı |
| Son eklenen geçersiz SQL migration | Geçti;22 tamamlanmış +1 başarısız → eski17 | Geçti;22 tamamlanmış +1 başarısız → eski17 |
| Başarılı yükseltme sonrası bozuk sunucu giriş dosyası | Geçti; resmî start kontrollü işaretle reddedildi → eski17 | Çalıştırılmadı |

Windows install/build vakaları ilk araç sürümüyle gerçek komutlar üzerinden çalıştırıldı. Sonrasında sağlamlaştırılmış araçla iki ayrı ORM/tarayıcı tekrar doğrulaması yapıldı; ayrıntılı süreç/port kapanış kanıtları saklandı. Windows migration/start ve Linux migration vakaları sağlamlaştırılmış araçla gerçek hata ve tam geri dönüş olarak çalıştırıldı. İlk iki vaka yeni araçla yeniden hata üretilmiş gibi raporlanmaz.

Her kabul edilen geri dönüşte yedi iş koleksiyonu; parola ve sessionVersion alanları; veli, ders ataması, sonuç, anket gönderimi ve cevap ilişkileri;17 tamamlanmış migration ve başarısız migration bulunmaması; eski üretilmiş Prisma şeması; SQLite integrity/FK; kurulum/yükleme dosyalarının SHA değerleri ve ayarlar doğrulandı. İlk oturum çerezi değiştirilmeden kullanıldı; `/api/auth/me` yanıtındaki yönetici ID’si ilk kayda eşitti. Arşiv gezintisi/yenileme, korunmuş anket/sınav kartları, görsel HTTP200 ve içerik SHA’sı geçti; tarayıcı pageerror sayısı0. Windows ve Linux arşiv ekranları doğrudan görsel olarak incelendi. Yüklenen görsel sentetik1px işaretleyicidir; içerik SHA’sı korunmayı, arşiv ekranları anlamlı UI görünümünü kanıtlar.

Windows migration kaynak kopyası298s, gerçek frozen install/build/deploy19s/83s/33.2s sürdü. Linux gerçek install/build/deploy51s/27s/4s sürdü. Kesin kontrollü hata tanıları, komut kodları ve sahip olunan süreç/port kapanış kanıtları özel dizinlerde tutulur. Linux tarayıcı, sunucu ve ORM kapanışı, port serbestliği ve korunan üç SHA ayrıca doğrulandı.

İlk Windows kurulumları mevcut pnpm deposundan623 paket kullandı, indirme yapmadı. Bağımsız node_modules oluşturma ilk eski kaynakta12m9.7s, build kaynağında12m50.8s sürdü. Migration/start vakalarında durdurulmuş, sahip olunan kaynaklardan bağımsız fiziksel bağımlılık kopyaları kullanıldı; ardından gerçek frozen install, build ve generate çalıştırıldı. Bunlar önbellekten bağımlılıklardır; yeni bağımlılık aktarımı olarak sunulmaz. Üretilen istemciler her hedefin kendi dizininde kaldı. Linux bağımlılıkları ayrı Linux sürücüsüne kuruldu; Windows native modülleri kullanılmadı. Sınırlı belleğe sahip makinede tüm ağır işler sırayla çalıştırıldı. Depolanmış sentetik oturum anahtarı ilk servisin anahtarıyla eşleşti; yeni giriş veya ayar değişikliği yapılmadan aynı anahtar ve yerel frontend originleri alt süreç ortamına verildi.

Bozuk yedek yayınlamadan önce reddedildi; mevcut verili hedefe restore reddedildi. DB/env/verifier bağlantısı için üç gerçek olumsuz test, yalnız sahip olunan sentetik işaretleyicilerle sorgu/yazma öncesi reddi ve değişmeyen SHA’yı gösterdi. Bağımlılık takma adı veri dizinine yönelirse kopya öncesi reddedildi. Girdi, yedek, kaynak, iç DB/ayar/verifier dosyaları ve kanıt yolları bağlantı/canonical kontrollerinden geçer; kanıt dizinleri ve dosyalar tek kullanımlık oluşturulur. Gerçek üretim DB yalnız SHA için okundu, sorgulanmadı. Korunan iki kaynak dosyası ve gerçek DB’nin üç SHA değeri değişmedi.

Tekrar çalıştırmak için Node22, çözülebilir pnpm JavaScript girişi (`npm_execpath`) ve `--backup=<sentetik-pre17-yedek>`, `--snapshot=<özel-yedi-koleksiyon-json>`, `--session=<ilk-storage-state-json>`, `--evidence=<sahip-olunan-plan-dizini>` verilir. `--cases=install,build,migrate,start` vakaları sırayla seçer. Native dışa aktarılmış sürücü `--git-repo=<salt-okunur-asıl-git-kaynak>` kullanabilir. `--verify-root=<korumalı-eski-hedef>` yeniden kurulum gerektirmeden ORM/ilk oturum/UI kontrolünü tekrarlar. Windows `--cache-current` ve `--cache-old` doğrulanmış bağımsız fiziksel kopya seçenekleridir.

Özel kayıtlar, çerezler, ayarlar ve backend günlükleri rapora veya commit’e alınmaz. Kamu çıktısı vaka ve durum bilgisidir. Ayrıntılı kanıtlar Task3 plan çalışma alanında tutulur.
