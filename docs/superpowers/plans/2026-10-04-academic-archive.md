# Akademik arşiv uygulama planı

> **Tarihsel plan/tasarım kaydı.** 14 Ekim 2026 belge kontrolü: gelecek zaman, açık kutular ve ara sonuçlar özgün çalışma sırasını korur; güncel yapılacaklar olarak okunmamalıdır. [Sonuç ve kapsam kaydı](../../academic-archive-review/verification.md) esas alınır.

> **Ajan olarak çalışanlar için:** Görev görev uygulamak için executing-plans kullan; tamamlanan her görev testlerle ve bir commit ile biter.

**Amaç:** Güvenli manuel/yıllık arşiv, kalıcı 15 Temmuz yıl geçişi ve yöneticinin geçmişi salt okunur görüntülemesi.

**Mimari:** SQLite kalıcı işleri ve değişmez anlık görüntü satırları; kısa işlemlerin dışında arka plan dışa aktarımları. Atomik yıllık sınıf yükseltme/aktivasyon öncesinde doğrulanmış bir çıktı bulunur. Yönetici geçmiş görünümleri anlık görüntü verilerini kullanır.

**Teknolojiler:** Mevcut Prisma/SQLite, Express, React, Vitest ve Playwright; Redis/Mongo zorunluluğu yok.

## Genel kısıtlar
- Gerçek server/data/quiz.db üzerinde asla migration/test çalıştırma; test veritabanını ve çıktıları izole et.
- Önceden var olan client/src/lib/api.ts ve server-setup.tsx değişikliklerini koru; yeni yıl/arşiv istemci yardımcılarını ayrı ekle.
- Europe/Istanbul 15 Temmuz 00:05; kurulum öncesine uydurma geçmiş dönem ekleme.
- Parola/token/oturum/sağlayıcı sırları dışa aktarıma dahil edilmez.
- API/DB düzeyinde değişmez arşivler; yıl geçişinden önce dosyalar doğrulanır; öğretmen atamaları değişmez.

## Görev 0 — Onaylanan sözleşme
- [x] Tasarımı ve bu takip planını kaydet; manuel/yıllık davranışı, sağlama toplamını ve geçmiş kapsamını incele.
- [x] Commit `docs: define academic archive contract` —74bab4d.

## Görev 1 — Kalıcı yıl/anlık görüntü/iş modeli
Dosyalar: server/prisma/schema.prisma; yeni migration; server/services/academic-year.ts; server/tests/api/academic-year.test.ts.
Arayüzler: getOrCreateActiveYear(db, now), getYearSchedule(label), anlık görüntü/iş modelleri ve açık geçiş kuralları.
- [x] RED: expect(getYearSchedule('2025-2026').toISOString()).toBe('2026-07-14T21:05:00.000Z'); geçersiz etiket reddedilir; yinelenen yıllık iş DB tarafından reddedilir; izole migration eski verileri korur.
- [x] GREEN: aktif/kapalı yıllar, anlık görüntü satırları, kiralama/tekrar denemeler, benzersiz yıllık anahtar, mezuniyet alanları ve açık sınıf geçiş kuralları ekle; yalnız Prisma istemcisini üret.
- [x] 16/16 odaklı testi ve odaklı tip kontrolünü doğrula; bağımsız inceleme onaylandı. Commit `feat: persist academic years and archive jobs`.

## Görev 2 — Değişmez kopyalama ve API/DB korumaları
Dosyalar: yeni arşiv kopyalama/koruma servisleri ve API ara katmanı; migration tetikleyicileri; mevcut sınav/içerik/anket/sonuç mutasyonları; testler.
- [x] RED: eksik kopyalama modülü, aktif sonucun üst ilişkisinin değiştirilmesiyle korumanın aşılması, ilgisiz manuel kullanıcı dahil edilmesi ve eksik capturedAt işaretçisi düzeltmelerinden önce yeniden üretildi.
- [x] GREEN: değişmez iş bağlamı, kopyalama işaretçisi ve kiralama sınırıyla seçilen kapsamın işlem içinde kopyalanması; SQLite/API korumaları ve denetim kaydına alınan retler; eski doğrudan arşiv/yükseltme/temizleme yolları kapatıldı. Esas önizleme Görev 3'te gelir.
- [x] 13/13 izole SQLite/API testini, odaklı katı TypeScript kontrolünü ve bağımsız kapsam incelemesini doğrula; commit `feat: enforce immutable archive snapshots`.

## Görev 3 — Dosyalar ve korunan yönetici uçları
Dosyalar: arşiv dışa aktarıcısı/paketleyicisi; arşiv yönlendiricisi; çıktı doğrulama testleri; dışa aktarım bağımlılıkları yalnız gerektiğinde.
- [x] RED: eksik dışa aktarıcı, ilişki biçimindeki dersin atlanması, yabancı/sınıfsız katılımcının atlanması, girdi bütçesi ve herkese açık client/dist yedek kökü korumasının aşılması düzeltmelerinden önce yeniden üretildi.
- [x] GREEN: dört CSV grubu, dondurulmuş JSON, hiyerarşik PDF, manifest/meta/ZIP; sınırlı kopyalama/dışa aktarım; güvenli yedek kökü ve atomik yayımlama; yönetici parolası/oturum kapsamlı doğrulanmış indirmeler; kapsamlı önizleme ve işler API'si. Playwright üretim bağımlılığıdır ve Chromium hazırlığı kurulumda çalışır.
- [x] Gerçek Chromium dahil 13/13 dışa aktarıcı testini,16/16 API testini,9/9 izole DB entegrasyonunu ve sunucu derlemesini doğrula; kontrollü PDF'nin 4 sayfasının tamamını bağımsız çıkar/görüntüle ve ZIP CRC/SHA-256 doğrula (test ZIP'i9363ce2132011b96047718f3e0839944c1390a033a634b2a0261a9c754bcbbf5). Commit `feat: export protected archive packages`.

## Görev 4 — Kalıcı işçi ve yıllık geçiş
Dosyalar: arşiv işçisi; akademik geçiş servisi; server/index.ts işçi bağlantısı; saat/DB testleri.
- [ ] RED: Temmuz sınırı, yeniden başlatmada telafi, yarışan iş sahiplenmeleri, eski kiralama, sınırlı üstel tekrar deneme, dosya hatasının yükseltmeyi engellemesi; eşleştirme zinciri başlangıçtaki her öğrenciyi bir kez taşır, mezuniyet ve öğretmen bağları korunur.
- [ ] GREEN: kalıcı kiralamalar/yıl kilitleri, geçişten önce doğrulayan durum makinesi, atomik yıl kapanışı/yükseltme/yeni yıl oluşturma; hata bildirimleri ve denetim; otomatik mod yalnız iç kullanımda.
- [ ] İşlem hata enjeksiyonunu ve izole yeniden başlatmayı doğrula; commit `feat: automate durable annual rollover`.

## Görev 5 — Arşiv ve sınıf yükseltme arayüzü
Dosyalar: yeni istemci arşiv yardımcısı; admin/archive.tsx; ilerleme/liste/eşleştirme arayüzü; frontend/E2E testleri.
- [ ] RED: açık kapsam önizlemesi, bekleyen/hata/tekrar deneme, eksik eşleştirmenin yıllık çalışmayı engellemesi, doğru anlık görüntü durumu, korunan indirme doğrulaması; normal gezinme kullanılabilir kalır.
- [ ] GREEN: manuel/yıllık kontroller ve anlık görüntü durumları, sınıf yükseltme sekmesinde kalıcı eşleştirme ve tamamlanan geçiş.
- [ ] Gerçek Chromium akışlarını ve odaklı frontend testlerini doğrula; commit `feat: manage yearly archive and promotions`.

## Görev 6 — Yönetici geçmiş yıl seçicisi
Dosyalar: akademik yıl bağlamı/seçicisi; DashboardLayout; anlık görüntüye dayanan geçmiş ekranları/API okumaları ve mutasyon ara katmanı; testler.
- [ ] RED: aktif yıl ilk/varsayılan, canlı mutasyonlardan sonra önceki dönemin adları/sınıfları/sonuçları değişmez, yenileme seçimi korur, eksik anlık görüntü yanlış biçimde gösterilmez; geçmiş modunda arayüz ve doğrudan HTTP yazmaları engellenir.
- [ ] GREEN: yıl seçici ve kişi/sınıf/ders/içerik/sonuç için açıkça anlık görüntüye dayanan geçmiş görünümleri; yıllar arasında sorgu önbelleği yeniden kullanılmaz; güncel paneller mevcut rotalarında devam eder.
- [ ] Tarayıcı yıl değiştirme/yenilemesini ve API yetkilendirmesini doğrula; commit `feat: browse historical academic years`.

## Görev 7 — Regresyon ve hata kabulü
- [ ] Tam frontend/backend, tip kontrolü/derleme; gerçek izole kopyalama/dışa aktarım/yıl geçişi/yeniden başlatma/geçmiş tarayıcı akışları, sağlama toplamı ve gerçek PDF; gerçek DB özetinin/kullanıcı farklarının korunduğunu doğrula.
- [ ] Doğrulanan her başarısızlığı RED/GREEN ile onar; kabul testlerini ve kanıtlarını commit et: `test: verify archive rollover and history`.

## Görev 8 — Belgeler ve Graphify kapanışı
- [ ] README/yönetici/kurulum/yedek/güvenlik belgelerini ve test edilen/edilmeyen kapsamı tam olarak güncelle; görev commit kimliklerini kaydet.
- [ ] Son kaynaklardan sonra Graphify update/diagnose; kalıcı kanıtlarda/çıktılarda gizli veri taraması; son fark kontrolü.
- [ ] Commit `docs: document yearly archives and refresh graph` ve yalnız korunan kullanıcı değişikliklerinin kaldığını doğrula.
