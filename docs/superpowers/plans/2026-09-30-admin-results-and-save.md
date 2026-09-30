# Admin sonuç, cache ve atomik kayıt düzeltmeleri

Kullanıcının onayladığı admin onarım sırasının devamıdır. Hibrit terminal/bat/sh/web kurulumu korunur. Gerçek `server/data/quiz.db` testlerle değiştirilmez; önceden var olan API ve sunucu kurulum ekranı düzenlemeleri korunur.

## Q04 — Sonuç hesaplama

- [x] Gerçek sonuç sayfasında tamamlanmamış/puansız kayıtların ortalama ve başarı dağılımına katılmasını üç başarısız regresyon testiyle yeniden üret.
- [x] Başarıyı yalnız `completed` ve sonlu sayısal puandan hesapla; gerçek sıfır puanı koru.
- [x] Katılım ile notlandırılan kayıt sayısını ayrı göster; puan yoksa sıfır yerine “Henüz yok” göster.
- [x] Gerçek Chromium, izole Prisma fixture, yenileme sonrası 100/50 ortalama doğrulaması (1/1).

## PE02 — İlişkisel cache

- [x] Kullanıcı değişikliğinden sonra kullanıcı ve sınıf cache anahtarlarının iki biçimini de yenileyen başarısız regresyon testi.
- [x] Kullanıcı/sınıf/atama mutasyonlarında ortak invalidasyon; aktif ekranlar yeniden sorgulanır, pasif ekranlar eski veriyle dönmez.
- [x] İlgisiz cache korunur; gerçek QueryClient/QueryObserver (1/1) ve SPA geçişi Chromium (1/1).

## Q03 — Atomik kayıt

- [x] Sınav/anket ayarı, soru senkronizasyonu ve yayın durumunu aynı transaction içinde kaydet.
- [x] Yeni düzenleyicinin sabit UUID'si ile tekrar deneme aynı içeriği günceller; ikinci taslak oluşturmaz; kayıp HTTP yanıtı Chromium (1/1).
- [x] Sahiplik ve sınıf yetkisi korunur; katılım sonrası değişiklik reddinde metadata geri alınır.
- [x] Gerçek izole Prisma API regresyonları (9/9 + hata enjeksiyonu1/1), soru düzenleyici/taşıma testleri (9/9).

## Q05/Q06 ve inceleme

- [x] Yönetici sonuç seçicisinde öğretmen sınavı için başarısız test, global sınav API'si düzeltmesi, bileşen4/4 ve Chromium1/1.
- [x] Açıklama/süre temizliğini null ile sakla; katılım sonrası değişmeyen soru ve metadata testi.
- [x] İncelemede yakalanan pasif öğrenci audienceSize farkını aktif öğrenci sayımıyla düzelt ve regresyonu doğrula.

## Kanıt ve teslim

- [x] İlgili testler, tip kontrolleri, yapılandırma/derleme kontrolleri; sunucu153/153, istemci53/53, iki type-check/build.
- [x] Alt raporları ve README'yi güncelle; Graphify AST haritasını yenile (1906/5393/94, tanı temiz).
- [x] Gerçek DB parmak izi ve kullanıcının mevcut diff'i korunur; yalnız bu paketin dosyalarını commit et.

PE05'in eski ikinci öğretmen bağının kökeni saklanmadığından ürün tercihi ayrıca sorulmuştur. Yanıt gelmeden bağımsız ders yetkisi kaldırılmaz.
