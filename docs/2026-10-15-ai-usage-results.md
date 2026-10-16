# AI sekmeleri ve öğretmen kullanımı — doğrulama kaydı

Geliştirme: 15 Ekim 2026. Kullanıcı onayıyla yerel devreye alma: **16 Ekim 2026**.
Onaylı [tasarım ve yol haritası](superpowers/plans/2026-10-15-ai-tabs-teacher-usage.md)
uygulandı. Mevcut öğretmen/sınav akışı ve tek istekte 10 soru sınırı korunur.

## Sonuç

- AI Yönetimi, **ai profil yönetimi** ve **öğretmen ai kullanımı** sekmelerine
  ayrıldı. Sekme geçişi kaydedilmemiş profil girdilerini korur.
- Varsayılan listesinde bütün profiller ad/sağlayıcı/model/durumuyla görünür;
  kapalı seçenekler açıklanarak engellenir. Test ve öğretmene açma şartı sürer.
- Öğretmen kullanımı ders, sınav/anket/taslak, model, soru sayısı, süre, durum
  ve gerçek token tüketimiyle tutulur. Admin testleri tabloya eklenmez.
- Taslak üretimleri sahiplik kontrolüyle kaydedilen içeriğe bağlanır. Yeniden
  kaydetme tüketim satırını çoğaltmaz; profil/başlık değişse de önceki görüntü kalır.
- OpenAI uyumlu/MiMo, Google ve Anthropic metadata alanları ayrı normalleştirilir.
  Düşünme/önbellek çift sayılmaz; eksik bilgi sıfır olarak gösterilmez. Hatalı
  HTTP veya geçersiz soru yanıtı tüketim bildiriyorsa o tüketim de korunur.
- Kısa kayıt işlemleri mevcut yazıcıyı, raporlar mevcut salt okunur bağlantıyı
  kullanır. Sağlayıcı beklenirken transaction tutulmaz. Kayıt arızası sağlayıcı
  tekrarına veya başarılı soruların kaybına yol açmaz; operasyon uyarısı verilir.
- Token alanında 256–32768 uygulama aralığı, 8192 varsayılanı, 10 soru ve iki
  10 üretimiyle 20 soru hesabı açıklanır. Kuramsal örnek ve gerçek ölçüm ayrıdır.
  Aynı sağlayıcı/model/düşünme/10 soru için en az beş başarılı örnek olduğunda
  filtre kapsamının gözlenen ortalaması ve gerçek örnek tarihleri gösterilir.

## Testler

| Kontrol | Sonuç |
| --- | --- |
| Runtime, metadata, profil, native DB, kullanım defteri, DNS | 83 test geçti |
| AI API/yetki/CSRF, soru biçimi ve iptal/arızalar | 38 test geçti |
| Admin sekmeleri ve öğretmen üretim arayüzü | 14 test geçti |
| Gerçek içerik kaydetme ve AI güvenlik regresyonları | 19 test geçti |
| Sunucu ve istemci TypeScript | Geçti |
| Sunucu ve istemci üretim derlemesi | Geçti |
| Gerçek Chromium / derlenmiş UI / sentetik API | Geçti; sayfa hatası 0 |

Toplam **154 hedef test**. Tüm depo testlerinin çalıştırıldığı iddia edilmez.
Build'deki mevcut büyük JS chunk/dinamik import uyarıları devam eder.

Chromium; iki sekme, gecikmeli kullanım yükleme, taslak formunun korunması,
tablo/filtreler, bilinmeyen token, kapalı varsayılan seçenek, mobil yatay taşma,
anahtar koruma ve öğretmenin üretim bağlamını doğruladı. Özel kanıt dizini
`server/data/quizmaster-test-ai-browser-vUkN8U`. Bu tarayıcı testi API taklididir;
gerçek sağlayıcı ve DB kabulü ayrı testlerdir.

Arıza regresyonları: bağlantı iptalinde cancelled kayıt; ledger yazımı üç kez
başarısızken başarılı soruların korunması; kayıp başlangıç onayında tek satır;
ilişkilendirme hatasında tamamlanmış sınav kaydının korunması; raporun yazıcı
transaction'ı doluyken ayrı okuyucuda tamamlanması. Bağımsız incelemede bulunan
HTTP hata yanıtından usage kaybı ve raporun yazıcıyı tutması düzeltildi; kapsamlı
yeniden incelemede kalan engelleyici bulgu bildirilmedi.

## Gerçek MiMo ölçümü

Canlı anahtar değeri gösterilmeden, kullanıcı onaylı Singapur hizmetinde üç
sentetik çağrı yapıldı. Yalnız ayrı DB kopyasında sentetik öğretmen/ders/taslak
kayıtları oluşturuldu. Canlı öğretmen hesabı veya sınav kaydı oluşturulmadı.
Kayıtlı 32000 üst sınırı / otomatik düşünme tercihi değiştirilmedi.

| Deneme | Geçerli soru | Girdi | Çıktı | Düşünme (çıktının içinde) | Süre |
| --- | ---: | ---: | ---: | ---: | ---: |
| Ayrı 10 soru isteği | Doğrulama reddetti | 152 | 858 | 56 | 23382 ms |
| 20 soruluk sınavın ilk 10'u | 10 | 152 | 898 | 47 | 21890 ms |
| 20 soruluk sınavın ikinci 10'u | 10 | 152 | 812 | 38 | 23089 ms |

20 soruluk başarılı senaryonun toplamı **304 girdi / 1710 çıktı** tokenıdır.
Üç isteğin tamamı, başarısız deneme dahil, defterde **456 girdi / 2568 çıktı**
olarak doğrulandı. İki 10 soruluk kullanım aynı kaydedilmiş sentetik sınava
bağlandı. İlk denemedeki geçersiz içerik sınava eklenmedi; bildirilen tüketimi
kaybolmadı. Bu koşunun tamamı başarılı soru kabulü değildir; kullanım takibinin
başarı ve hata ayrımını da doğrular.

Bu küçük örneklerden genel ortalama, hız/kapasite veya içerik doğruluğu garantisi
çıkarılmaz. Gerçek token sayısı; model, konu, soru uzunluğu, düşünme ve cache
durumuna bağlıdır. 32000 seçmek 32000 tüketildiği anlamına gelmez. Yeni UI'daki
300 token/soru örneği ölçülmüş ortalama olarak sunulmaz.

## Migration ve canlı koruma

`scripts/ai-usage-upgrade-rehearsal.mjs` canlı kaynağı yalnız okuyarak ayrı
kopyada gerçek Prisma `migrate deploy` çalıştırdı. Önceki 30 tablonun kayıtları,
profil ciphertext'leri ve anahtarla çözülmeleri korundu; integrity `ok`, FK 0.

Yayımlanmış sınav bulunmadığı kontrol edildikten sonra süreç kısa süre
durduruldu. Tam özel yedek: `server/backups/before-ai-usage-20261016`, sekiz
dosya. Prisma Client üretimi başarıyla tamamlandı; yalnız eklemeli
`20261015000200_ai_usage` migration'ı uygulandı. Uygulama üretim kipinde
`http://127.0.0.1:5000` adresinde yeniden başlatıldı.

Son kontrolde sekiz yedek dosyasının hash'i, eski 30 tablonun korunması,
değişmeyen profil/anahtarlar, integrity `ok` ve FK 0 doğrulandı. Kullanım tablosu
başlangıçta boş; gerçek salt okunur rapor sıfır kayıt/özet döndürdü. `/` ve
`/ai-management` 200, oturumsuz yönetim/kullanım/model uçları 401 döndürdü;
sunucu stderr boştu. Önceki süreç kontrolü kullanım limiti nedeniyle otomatik
onay incelemesinde çalıştırılamamıştı; 16 Ekim'deki kullanıcı onayından sonra
yeniden deneme ve devreye alma başarıyla tamamlandı.

Kullanıcının `client/src/lib/api.ts`, `client/src/pages/server-setup.tsx`,
paket yöneticisi dosyaları ve diğer önceki çalışması korunur. Bu iş için
commit/push veya başka dala birleştirme yapılmadı. Yeni kullanım geçmişi bu
devreye almadan itibaren oluşur; geçmiş çağrılara tüketim uydurulmaz.
