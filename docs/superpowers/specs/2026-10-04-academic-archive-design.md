# Eğitim yılı arşivi ve geçiş sözleşmesi

Kullanıcı 4 Ekim 2026'da uygulamayı ve her görev sonunda ayrı commit'i onayladı. SQLite/Prisma, Express ve React korunur; Redis/Mongo zorunluluğu eklenmez. Gerçek veritabanına test veya migration uygulanmaz. Önceden değişmiş api.ts ve server-setup.tsx korunur.

## Kapsam

Manuel arşiv açıkça seçilen içerikleri ve ilişkili iş verilerini kopyalar; öğrenci taşımaz veya yılı kapatmaz. Otomatik kapanış Europe/Istanbul 15 Temmuz 00:05'te kapanan yılın bütün iş verilerini alır. Geçmiş yıllar canlı tablolardan tahmin edilmez. İlk kayıt sistemi mevcut aktif yılı başlatır; geçmişte çalışmamış yıllar için sahte snapshot oluşturmaz. Kurulmuş sistemde kaçırılan kapanış kalıcı yıl kaydından bulunur.

Kopyalara parola, reset token, session, API/SMTP anahtarı dahil edilmez. Snapshot kişi/sınıf, ders/öğretmen ataması, içerik/soru ve sonuç/anket cevaplarını korur. PDF sınıf/şube→ders→içerik altında, CSV dört mantıksal veri grubu olarak hazırlanır. Bu dışa aktarım tam DB/uygulama geri yükleme yedeği değildir.

## İş akışı

Kalıcı iş durumları queued→capturing→files_generating→verified→completed; hata retry_wait veya failed. Kısa transaction veri kopyasını ve etkilenen kayıtların mutasyon engelini kurar. Ağır dosya IO transaction dışında yapılır. Dosyalar geçici dizinde üretilir, checksum doğrulamasından sonra yayımlanır. Payload manifesti meta/ZIP'in kendisini kapsamaz; ZIP hash'i DB'de ayrıca saklanır, döngüsel checksum yoktur.

Dosyalar doğrulanmadan sınıf atlatma/yeni yıl aktivasyonu yapılmaz. Son transaction kayıtları arşivler, başlangıçtaki öğrenci listesine göre her öğrenciyi bir kez taşır, son sınıf için mezuniyet yılı/tarihi yazar ve yeni yılı aktive eder. Öğretmen atamaları değişmez. Son commit öncesindeki hata canlı yıl geçişini geri alır. Kilit/lease/retry kalıcıdır; restart işi devam ettirir. Otomatik yıl geçişi için yıl başına tek benzersiz işlem bulunur; manuel snapshot ayrı kimlikle tekrarlanabilir.

Sınıf→hedef veya mezuniyet eşleştirmesi admin tarafından açıkça kaydedilir. Eksik hedef, aktif kapasite ve öğrenci numarası çakışmaları geçişi engeller; ada göre tahmin yapılmaz. Öğrenci hesabı mezuniyette silinmez. Geçmiş kayıt UPDATE/DELETE ile değişmez; bağımlı soru/cevap ve cascade işlemleri de API/SQLite seviyesinde korunur. Eski purge rotası kilidi aşamaz.

## Admin geçmiş modu

Sol menünün üstündeki yıl listesinde aktif yıl ilk ve varsayılan seçenektir. Geçmiş seçim ilgili tamamlanmış yıllık snapshot'ı açar. Geçmişin kişi/sınıf/atama/içerik/sonuç ekranları snapshot kayıtlarından okunur; canlı kişi isimleri veya sınıf değişimleri geçmişe sızmaz. Geçmiş modunda yazma UI'si kapalıdır; sunucu da seçili yıl bağlamında mutasyonları reddeder. Snapshot indirme yalnız admin ve kısa ömürlü parola tekrar doğrulaması ile mümkün olur. İstemciden mode:auto gönderilmesi zamanlayıcı yetkisi vermez.

## Kabul

Fail-first birim/API/gerçek SQLite testleri; trigger bypass/cascade, snapshot içeriği ve checksum, retry/lease/restart, İstanbul sınır zamanı, çift tetikleme, tek yükseltme, mezuniyet, öğretmen atamasının korunması ve geçmiş dönem yazma reddi. Gerçek Chromium manuel/kapanış/indirme/yıl seçimi akışları ve gerçek PDF metin/render doğrulaması. Her görev test sonrası ayrı commit; en sonda belgeler ve Graphify update/diagnose + final commit. Başarısız veya çalıştırılamayan kontrol başarılı sayılmaz.
