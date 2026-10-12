# Akademik arşiv yeniden değerlendirme ve düzeltme planı

> **Durum: 5 Ekim 2026'da kullanıcı tarafından onaylandı; uygulama sürüyor.** Görevler sırayla uygulanır, doğrulanan her görev ayrı commit ile kapatılır. Görev 0, `55aae48`, `a368974` ve `a96160d` ile tamamlandı; güncel başlatıcıyla gerçek Chromium kontrolü ve ayrı kod incelemesi geçti. Görev 1, `7ae258e` ile tamamlandı; backend 7/7, frontend 24/24, gerçek Chromium 1/1, iki tip kontrolü ve bağımsız inceleme geçti. Görev 2, `779a8c8` ile tamamlandı; API 34/34, frontend 16/16, gerçek SQLite 19/19 ve ek manifest regresyonu, gerçek Chromium 1/1, tip kontrolleri ve bağımsız inceleme geçti. Görev 3, `8c1bbca` ile tamamlandı; gerçek SQLite 35/35, guard 15/15, üç ayrı Chromium senaryosu, tip kontrolü ve bağımsız inceleme geçti. Test e-posta izolasyonu gerçek modülle ayrıca doğrulandı. Görev 4, `8bf9de8` ile tamamlandı; gerçek SQLite 55/55, API 34/34, worker 30/30, arayüz 22/22, gerçek Chromium 1/1, tip kontrolleri ve iki düzeltme turu sonrası bağımsız inceleme geçti. Görev 5, `9d32cb4` ile tamamlandı; API 14/14, arayüz 71/71, gerçek SQLite 1/1, tip kontrolleri, iki taze gerçek Chromium kabulü ve bağımsız inceleme geçti. Önceki aralıklı Chromium kabul başarısızlığının nedeni kanıtlanmadı; Görev 7 daha geniş regresyon kabulü sürdürür. Görev 6 sürüyor; Görev 7 bekliyor.

**12 Ekim güncel durum:** Görev 6 `48f88ba`, Görev 7 test kabulü `df104eb` ile tamamlandı. Backend genel regresyonu 412/412, frontend 272/272, ayrı gerçek veritabanı/hacim 74/74, dosya 27/27, geçmiş 18/18, worker 30/30, guard/cursor/rollback 4/4, setup 14/14 ve iki tip kontrolü geçti. Beş ayrı Chromium senaryosu, gerçek PDF metin/render/bütünlük kontrolleri ve üretim derlemesi başarılıdır. Belgeler ve Graphify son kaynaklara göre güncellendi; kapanış commit/push işlemleri son adımdır. Yukarıdaki başlangıç durumu ve aşağıdaki ilk kontrol listesi tarihsel plandır; nihai kanıtlar [doğrulama kaydındadır](../../academic-archive-review/verification.md). Taze hibrit kurulum, tam yedek/geri yükleme, yükseltme/geri dönüş, eşzamanlı performans ve paket küçültme [ayrı onaylı üretim provasıdır](2026-10-06-production-rehearsal-plan.md), arşiv kabulünün tamamlanması bu görevleri tamamlanmış yapmaz.

| Görev | Nihai kaynak/test commit'i | Durum |
|---|---|---|
| 0 — İzole altyapı | `55aae48`, `a368974`, `a96160d`; runner `6e05912` | Tamamlandı |
| 1 — Geçmiş veri kapsamı | `7ae258e` | Tamamlandı |
| 2 — İş kurtarma | `779a8c8` | Tamamlandı |
| 3 — API/DB yıllık sınır | `8c1bbca` | Tamamlandı |
| 4 — Geçiş önkontrolü | `8bf9de8` | Tamamlandı |
| 5 — Yıl seçici | `9d32cb4` | Tamamlandı |
| 6 — Paket ve hacim | `48f88ba` | Tamamlandı |
| 7 — Kabul testleri | `df104eb` | Tamamlandı; belge/harita yayını kapanış adımı |

Tarayıcı zinciri tek paylaşılan veritabanında birleştirilmedi: manuel, geçmiş, sınır, kurtarma ve geçiş spec'leri ayrı taze runtime'larda yürütüldü. Snapshot/year sabitlerinin çakışmasını önleyen bu ayrım kabul kapsamını değiştirmez. Varsayılan tsx açılışı ve yeni sürümün taze hibrit kurulumu bu opt-in kanıtıyla geçti sayılmaz.

**Amaç:** 15 Temmuz yıllık arşivini, manuel arşivi, sınıf geçişini ve admin geçmiş yıl seçimini kullanıcının talimatına uygun, kurtarılabilir ve doğrulanabilir hale getirmek.

**Mimari:** Mevcut React/Express/Prisma/SQLite yapısı ve kalıcı snapshot/iş altyapısı korunur. Kısa atomik veri kopyalama, transaction dışında dosya üretimi ve doğrulama, ardından atomik yıl geçişi kullanılır. Geçmiş dönem canlı tablolar yerine değişmez snapshot verilerinden okunur.

**Teknolojiler:** TypeScript, Prisma/SQLite, Express, React/TanStack Query/Wouter, Vitest/Supertest ve gerçek Chromium/Playwright. Redis veya Mongo zorunlu bağımlılığı eklenmez.

## Kaynak ve mevcut durum

- Kullanıcının yeniden gönderdiği `Pasted text.txt` talimatı: İstanbul saatinde 15 Temmuz 00:05, kaçırılan kapanışın açılışta telafisi, idempotency, sınırlı retry, API/DB salt okunurluk, dört CSV grubu/PDF/meta/checksum/ZIP, parola tekrar doğrulaması, audit ve E2E.
- Son ek gereksinim: admin sol menüsünün üstünde mevcut ve geçmiş eğitim yılları listesi; aktif yıl ilk ve varsayılan, geçmiş dönem pasif/salt okunur ve kendi verileriyle erişilebilir.
- Referans commitler: `74bab4d` sözleşme; `3070f53` model; `d1999f0` değişmez snapshot; `71b2905` export; `f3fc892` fingerprint düzeltmesi; `12fbc66` worker; `648e611` arşiv UI; son commit `1298cf8` geçmiş yıl modu.
- GPT-6.1 Sol ile salt okunur kaynak incelemesi yapıldı. Aşağıdaki statik bulguların tamamı runtime hata yeniden üretimi olarak sunulmaz.
- Çalışma ağacındaki `client/src/lib/api.ts` ve `client/src/pages/server-setup.tsx` önceden var olan kullanıcı değişiklikleridir. `graphify-out` içindeki üç ana çıktı değiştirilmiş, henüz commit edilmemiştir.
- Gerçek `server/data/quiz.db` SHA-256 değeri yeniden kontrol edildi: `8210A4B79F2CFB9CF74DE6A4989F5C8A5449BA1D17B2332ABDBD018C3741A158`. Test veya migration bu dosyada çalıştırılmaz.

## İnceleme bulguları

| Kimlik | Öncelik | Bulgu ve kaynak | Kanıtın sınırı |
|---|---|---|---|
| A1 | Yüksek | `server/api-routes/academic-history.ts:52,76,79` anket/sınav ayrımı için `type` okuyor; gerçek Quiz alanı `contentType`. `server/tests/academic-history-api.test.ts` yanlış `type` fixture'ıyla hatayı gizliyor. | Kaynak/Prisma/snapshot alanları karşılaştırması; gerçek capture→history regresyonu gerekli. |
| A2 | Yüksek | `archive-worker.ts:77–78,146` başarısız manuel işleri de yıllık kapanış engeli sayıyor; `archive.ts:96` 20 denemeden sonra retry yasaklıyor. Güvenli terminal kurtarma yolu yok. | Statik akış doğrulaması; failed→recovery→annual E2E gerekli. |
| A3 | Yüksek | Yıllık capture fence migration'ı yalnız INSERT koruyor; kullanıcı/sınıf/ders/atama/duyuru/soru bankası UPDATE/DELETE ve implicit join yazmaları tam kapsanmıyor. HTTP guard kapsamı DB garantisi yerine geçmez. | SQL/API sınır incelemesi; doğrudan SQL/arka plan/yetkili HTTP test matrisi gerekli. |
| A4 | Orta | `archive-worker.ts:13` pasif öğrencileri de taşıyor/mezun ediyor. Test bunu bekliyor ancak bu iş kuralı kullanıcı tarafından açıkça tanımlanmadı. | Mevcut davranış kesin; değişiklik önerisi iş politikasıdır. |
| A5 | Orta | `academic-year-context.tsx:29–30` önceki geçmiş yıl seçimini yeni açılışta geri getiriyor; aktif yıl varsayılanı açıkça ayrıştırılmamış. | Kaynak ve mevcut component testleri. |
| A6 | Orta | Provider merkezi yıl yenilemesi yapmıyor; rollover tamamlanma yenilemesi arşiv sayfasına bağlı. Diğer admin ekranları eski yıl etiketi/önbelleğiyle kalabilir. | Kaynak akışı; iki sekmeli gerçek tarayıcı kabulü gerekli. |
| A7 | Orta | Geçmiş görünüm genel kayıt tablosu. Sayfa/sekme kapsamı eksik; `/management` işlem günlüğü yerine genel kişi kayıtlarını gösterebiliyor. | Rota eşleştirme incelemesi; sayfa bazında kabul matrisi gerekli. |
| A8 | Ölçülecek | Capture 250 bin satıra kadar tek tek INSERT'i 120 saniyelik transaction'da yapıyor; history her sorguda bütün snapshot'ı yüklüyor. | Ölçek riski, ölçülmüş performans hatası değil. |
| A9 | Kapsam eksikliği | `meta.json` toplam boyut/ZIP özeti ve gerçek capture zamanı sözleşmesini tam taşımıyor; boyut/ZIP hash DB'de. PDF tek dosyada bölümlemeli; görsel dosyaları pakette dondurulmuyor. | Export kaynağı incelendi; dosya sözleşmesi ve görsel korunumu kabul testleri gerekli. |

## Önceki test kanıtlarının değerlendirilmesi

- `pnpm --filter quiz-master-server exec vitest run --config vitest.rollover-db.config.ts` son tekil turda **9/9** geçti (155,53 saniye). Bu tur gerçek SQLite/ZIP kullanır; PDF üreticisi bu entegrasyon dosyasında sentetik fixture'dır.
- Tam frontend/backend turu bitmedi; backend rollover testlerinin ikisi zaman aşımı, setup-migration testi başarısızlık bildirdi. Her iki genel süreç durduruldu. Bu tur başarılı sayılmaz.
- Genel backend config 30 saniye, ayrı rollover config 120 saniye sınırı kullanıyor. Bu fark rollover zaman aşımına aday neden; migration ve tam tur sorunu açıklanmış kabul edilmez.
- Önceki odaklı worker/API/component testleri ve type-check/build çıktıları tarihsel kanıttır. Yeni kabulde yeniden çalıştırılacak, yanlış fixture'lar düzeltilecek.
- Yeni akademik yıl akışının manuel→yıllık→restart→history zincirini kapsayan izole gerçek tarayıcı E2E teslimi henüz doğrulanmış değil. Eski admin E2E'leri yeni davranışın yerine geçmez.
- Graphify AST üretimi 2978 düğüm/7678 kenar/168 topluluk; bu görsel harita runtime işleyiş kanıtı değildir. Son onarım kodlarından sonra yeniden üretilecek.

## Onaya sunulan davranış sözleşmesi

1. **Manuel arşiv:** açıkça seçilen sınav/anket ve ilişkili veriler kopyalanır. Başarıdan sonra seçilen içerik arşivlenir ve değiştirilemez; öğrenci/sınıf/öğretmen hesapları korunur, yıl kapanmaz, sınıf atlatılmaz. Seçilmemiş içerik etkilenmez.
2. **Yıllık arşiv:** 15 Temmuz 00:05 Europe/Istanbul. Sistem kapalıysa kalıcı aktif yılın kaçırılan işi restart'ta devam eder. Yıl başına tek etkin geçiş; dosya doğrulanmadan yıl kapanışı/terfi/mezuniyet yok. Kurulum öncesine sahte geçmiş yıl üretilmez; mevcut eski kurulumun başlangıç yılı migrasyon önkontrolünde açıkça doğrulanır.
3. **Aktif uygulama:** kapanan yılın sınav/anketleri aktif listeler ve istatistiklerden ayrılır. Fiziksel silme yapılmaz; geçmiş, snapshot ve yetkili indirme korunur. İlgili bütün panel/API tüketicileri sınanır.
4. **Sınıf geçişi:** her aktif öğrenci başlangıç üyeliğine göre yalnız bir defa taşınır. Son sınıf aktif öğrencileri mezuniyet yılı/tarihiyle pasif olur; hesap/geçmiş silinmez. Öğretmenin ders/sınıf/şube atamaları aynı kalır. Önerilen politika: önceden pasif öğrenciler/eski mezunlar yeniden taşınmaz veya mezun edilmez, sınıfsız öğrencilere hayali hedef atanmaz.
5. **Geçiş sekmesi:** kaynak→hedef/mezuniyet eşleştirmesi açık kaydedilir. Eksik/uygunsuz hedef, kapasite ve numara çakışması dosya üretiminden önce önkontrolde gösterilir. Yıl kapanınca tamamlanan geçişin sayıları ve yeni yılın kuralları görünür.
6. **Yıl seçici:** admin menüsünün üstünde; aktif yıl ilk. Yeni girişte aktif yıl varsayılan. Aynı oturumda kullanıcı geçmiş yılı seçtiyse sayfa yenileme seçimi korur. Aktif moddaki açık ekran otomatik rollover sonrası yeni aktif yılı alır; geçmişi bilinçli seçmiş kullanıcı yerinden çıkarılmaz. Yalnız gerçek tamamlanmış yıllık arşivi olan geçmiş yıllar kullanılabilir.
7. **Geçmiş:** görünür yıl etiketi ve salt okunur uyarısı; kişi/sınıf/ders/atama/sınav/anket/soru/cevap/sonuç/veli/duyuru/soru bankası kapanıştaki veriyle gösterilir. Canlı veriyle doldurma yok. Desteklenmeyen sistem ekranları açıklamalı kapsam mesajı verir, ilgisiz kayıt göstermez. UI ve doğrudan API yazmaları reddedilir/audit edilir.
8. **Dosya sözleşmesi:** `backup_root/{academicYear}/{snapshotId}/csv/`, `pdfs/`, dondurulmuş JSON, meta, checksum ve ZIP. Dört CSV grubu korunur; sınıf/şube→ders→içerik PDF bölümleri açık indeksle erişilebilir. Capture zamanı, başlatan admin/otomatik, boyut ve SHA-256 anlaşılır biçimde kaydedilir. ZIP kendisini hash'leyen döngü kurulmaz. Kişisel iş verileri korunur, parola/token/oturum/SMTP/AI anahtarı dışarı verilmez; bu paket tam sunucu geri yükleme yedeği olarak sunulmaz.

## Görev 0 — Kanıt ve izole kabul altyapısı

**Dosyalar:** `server/vitest.config.ts`, `server/vitest.rollover-db.config.ts`, `server/tests/utils/setup-migration.test.ts`; yeni `playwright.academic-archive.config.ts`, `tests-e2e/academic-archive-helpers.ts`, `docs/academic-archive-review/verification.md`.

- [ ] Genel tur hatalarını tek tek yeniden üret; test/altyapı hatası ile ürün kusurunu ayır. Rollover 30/120 saniye config farkını ölç; migration hata çıktısının tamamını kaydet, süreyi körlemesine artırma.
- [ ] Yardımcı başlatıcı yalnız geçici DB/artifact/port ve sentetik admin/veri kullansın; mevcut sunucuyu `reuseExistingServer` ile kullanmasın. Test süreçlerini kapatıp yalnız oluşturduğu dizinleri temizlesin.
- [ ] `server/data/quiz.db` hash'i ve iki korunan kullanıcı diff'i önce/sonra karşılaştırılsın. Kanıt dosyalarında gerçek anahtar/parola/kullanıcı verisi bulunmasın.
- [ ] Doğrulanan altyapı/kanıt değişikliklerini `test: isolate academic archive acceptance` commit'iyle kapat.

## Görev 1 — Geçmiş veri türleri ve sayfa kapsamı

**Dosyalar:** `server/api-routes/academic-history.ts`, `server/tests/academic-history-api.test.ts`, `client/src/components/academic-history/history-model.ts`, `HistoricalWorkspace.tsx`; yeni `server/tests/api/academic-history-db.test.ts` ve `tests-e2e/academic-history.spec.ts`.

- [ ] Önce gerçek Prisma `contentType: 'exam'|'survey'` kayıtlarıyla capture→history testini yaz ve A1 hatasını göster.
- [ ] Ayrımı/istatistikleri `contentType` ile düzelt; sentetik `type` fixture'larını gerçek şemayla eşleştir.
- [ ] Admin rota/sekme matrisi oluştur: öğrenci/öğretmen/sınıf detayları, ders/atama, sınav/anket soru-cevapları ve sonuçlar. Yönetim sekmesinin URL/iç durumunu geçmiş eşdeğerine eşleştir; log/ayar gibi kapsam dışı ekranları açıklamalı göster.
- [ ] Capture sonrası canlı ad/sınıf/atama değiştir; geçmişte eski değerlerin kaldığını, sınav/anket listelerinin ayrıldığını doğrula.
- [ ] Odaklı API/SQLite/component ve Chromium kontrolleri geçince `fix: correct historical academic data` commit'i at.

## Görev 2 — Başarısız arşivden güvenli kurtarma

**Dosyalar:** `server/services/archive-worker.ts`, `archive-jobs.ts`, `archive-export.ts`, `server/api-routes/archive.ts`, `client/src/pages/admin/archive.tsx`; ilgili worker/API testleri ve yeni `tests-e2e/academic-archive-recovery.spec.ts`. Gerekirse yeni ek migration; uygulanmış migration dosyaları değiştirilmez.

- [ ] Failed manuel iş, 20 deneme sınırı ve bozuk yayımlanmış paket senaryolarını önce başarısız testle göster.
- [ ] Aktif bekleyen iş ile terminal başarısız işi ayıran çözüm tasarla: snapshot satırları silinmeden güvenli onarım/yeniden üretim; her manuel kurtarma ayrı audit ve sınırlı retry döngüsü. İş engeli sessizce kaldırılıp veri kaybı yaratılmasın.
- [ ] Tamamlanmış paket değiştirilemesin; tamamlanmamış bozuk artifact gerekçeli karantinaya alınabilsin ve aynı frozen input ile yeniden üretilebilsin.
- [ ] Admin'e yıllık işi engelleyen iş kimliği/neden/çözüm göster; başarısız denemeler ve otomatik başlangıç audit kaydında olsun. Başarısız otomatik iş admin'e bildirim/e-posta kuyruğu üretsin.
- [ ] Kabul: aynı snapshot güvenli tamamlanır, annual bir defa ilerler; restart/retry/20 sınırı uygulamayı kalıcı çıkmaza sokmaz. `fix: recover blocked academic archive jobs` commit'i at.

## Görev 3 — API ve DB yıllık veri sınırı

**Dosyalar:** yeni `server/prisma/migrations/20261005_annual_boundary_repair/migration.sql`, `server/middleware/annual-capture-guard.ts`, `server/services/archive-capture.ts`, `archive-worker.ts`, `server/tests/api/archive-readonly.test.ts`, `annual-capture-guard.test.ts`, `archive-worker-integration.test.ts`.

- [ ] Kopyalama sonrası UPDATE/DELETE/INSERT ve implicit join/cascade bypass testleri yaz: kişi, sınıf, ders, öğretmen ataması, veli eşleşmesi, duyuru, soru bankası, sınav/soru/sonuç/anket cevabı.
- [ ] Desteklenen bütün yazma yollarını koru. Worker'ın zorunlu terfi/mezuniyet/yıl kapatma yazılarına yalnız doğrulanmış artifact ve geçerli sahiplik/lease bağlamında kontrollü izin ver; herkesçe kullanılabilir bypass ekleme.
- [ ] Giriş/çıkış/parola sıfırlama gibi işletim yollarını açık tut; iş verisini etkileyen profil yazıları snapshot sınırını aşamasın. Hata sonrası admin kurtarma kullanılabilir olsun.
- [ ] Kabul: yetkili HTTP mutasyonları anlamlı 403/423 ve audit döndürür; doğrudan DB mutasyonları reddedilir; worker geçişi ve rollback çalışır. `fix: enforce annual archive write boundaries` commit'i at.

## Görev 4 — Önkontrol ve doğru öğrenci yaşam döngüsü

**Dosyalar:** `server/services/archive-worker.ts`, `archive-jobs.ts`, `server/api-routes/archive.ts`, `client/src/lib/archive-api.ts`, `client/src/pages/admin/archive.tsx`, ilgili gerçek DB ve component testleri.

- [ ] Aktif/pasif/eski mezun/sınıfsız öğrenci testlerini onaylanan sözleşmeye göre yaz; mevcut pasif taşıma testinin davranışını bilinçli güncelle.
- [ ] Aynı geçiş planlama kurallarını önkontrol ve finalize'da kullan. Eksik hedef/kapasite/numara çakışmasını önce göster; son transaction yeniden doğrulasın.
- [ ] Her aktif öğrenci tek kez yükselsin; zincir/döngü/numara rezervasyonu korunmalı. Mezuniyet alanları doğru olsun; bütün öğretmen bağlantıları önce/sonra eşit kalsın.
- [ ] Sınıf Geçişi sekmesi terfi/mezuniyet/atlanan pasif-sınıfsız sayıları ve tamamlanan geçişi göstersin. Aktif içerik tüketicileri eski sınav/anketleri aktif veriye karıştırmasın.
- [ ] 15 Temmuz öncesi/00:05/sonrası, birden çok yıl kesintisi, eşzamanlı iki worker ve transaction fault injection doğrulansın. `fix: validate academic year transitions` commit'i at.

## Görev 5 — Yıl seçici ve otomatik bağlam yenileme

**Dosyalar:** `client/src/context/academic-year-context.tsx`, `AcademicYearSelector.tsx`, `AcademicRouteBoundary.tsx`, `DashboardLayout.tsx`, `server/api-routes/academic-history.ts`, `server/middleware/academic-context.ts`, ilgili component/API testleri ve `tests-e2e/academic-history.spec.ts`.

- [ ] Yeni girişte aktif yıl, aynı oturumda geçmiş seçimi/refresh, başka admin sayfasında rollover ve iki sekmenin farklı yıl seçimi testlerini yaz.
- [ ] Aktif yılı üstte/default göster; merkezi yıl değişimi/focus yenilemesi kur. Yıl değişirken sorguları iptal et, eski yanıtın yeni yıla sızmasını engelle; query anahtarları dönem kapsamını taşısın.
- [ ] Ortak session bağlamının sekmelerde etkisini açıkça yönet; bir sekmenin geçmiş seçimi diğer sekmede yanıltıcı aktif yazma ekranı bırakmasın.
- [ ] Geçmişte UI mutasyonları kapalı; doğrudan API yazmaları reddedilsin. Desteklenmeyen/missing snapshot canlı veriyle doldurulmasın. Aktif yıla dönüş kullanılabilir kalsın.
- [ ] Masaüstü/mobil/klavye, doğrudan URL/refresh, konsol ve ağ kontrolleri geçince `fix: synchronize academic year selection` commit'i at.

## Görev 6 — Snapshot dosya sözleşmesi ve hacim

**Dosyalar:** `server/services/archive-capture.ts`, `archive-export.ts`, `archive-package.ts`, `server/tests/utils/archive-export.test.ts`; yeni `server/tests/api/academic-archive-volume.test.ts` ve `docs/academic-archive-review/artifacts.md`.

- [ ] Meta'ya capture zamanı ve açık boyut/hash sözleşmesi ekle; ZIP hash'i DB ve indirme doğrulamasında korunur, kendini hash'leyen paket oluşturulmaz. Dizin/CSV/PDF/index dosyaları örneklerle belgelenir.
- [ ] Görsel soruların geçmişte korunmasını değerlendir; yerel izinli görselleri immutable pakete dahil et veya açık kabul sınırı yaz. Uzak URL'leri otomatik ağ çağrısıyla fetch etme; dış bağlantı güvenliğini zayıflatma.
- [ ] Gerçek Chromium PDF üret; PDF metin/render, çok sınıflı katılım, soru/cevap/puan bütünlüğü, dört CSV, ZIP CRC/SHA-256 doğrula. Parola/anahtar/token alanlarının yokluğunu denetle.
- [ ] 1k/10k/50k sentetik satırda capture transaction süresi, history sayfalama/arama süresi ve bellek ölç. Limitin uygun hata vermesini doğrula; tek tek INSERT/tam snapshot okuma darboğazını ölçüme göre gider.
- [ ] Kabul: dosya IO transaction dışında, history sayfalaması her istekte bütün snapshot'ı parse etmeden çalışır, test bütçeleri ve ölçülen hacim sınırları belgelenir. `fix: complete archive artifacts and bounded reads` commit'i at.

## Görev 7 — Tam kabul, belgeler ve Graphify kapanışı

**Dosyalar:** `tests-e2e/academic-archive-*.spec.ts`, `tests-e2e/academic-history.spec.ts`, `docs/academic-archive-review/verification.md`, `README.md`, `docs/admin-guide.md`, `docs/guvenlik-ve-bakim.md`, `docs/sunucu-kurulum-kilavuzu.md`, `docs/graphify.md`, eski/yeni akademik planlar, `graphify-out/{graph.json,graph.html,GRAPH_REPORT.md}`.

- [ ] İzole gerçek tarayıcı zinciri: seçili manuel arşiv→parola onaylı indirme→15 Temmuz otomatik kapanış→terfi/mezuniyet→restart telafisi→hata/retry→geçmiş seçimi/refresh→yazma reddi→aktif yıla dönüş. UI/API/DB/dosya çıktısı birbiriyle karşılaştırılsın.
- [ ] Tam backend ve frontend turu, setup testi, type-check ve build çalıştır. Başarısız/çalıştırılamayan test açık kaydedilsin; paket başarıları E2E yerine sunulmasın.

```powershell
pnpm --filter quiz-master-server test
pnpm --filter quiz-master-client exec vitest run
pnpm test:setup
pnpm --filter quiz-master-server run type-check
pnpm --filter quiz-master-client run type-check
pnpm build
node scripts/academic-archive-runner.mjs tests-e2e/academic-archive-boundary.spec.ts
node scripts/academic-archive-runner.mjs tests-e2e/academic-archive-recovery.spec.ts
node scripts/academic-archive-runner.mjs tests-e2e/academic-archive-transition.spec.ts
node scripts/academic-archive-runner.mjs tests-e2e/academic-history.spec.ts
node scripts/academic-archive-runner.mjs tests-e2e/academic-archive-manual.spec.ts
```

Runner private runtime olmadan doğrudan Playwright config çağrısını bilerek reddeder. Her senaryo taze DB ile ayrı yürütülür; aynı frozen yıl etiketini kullanan spec'ler tek DB'de birleşik başarı sayılmaz. 12 Ekim ölçümünden sonra geçici migration CLI sınırı 240 s'dir (iki seri koşuda 180 s içinde 19/22 migration; `180*22/19+30` gerekçesi). Tarayıcı/PDF/transaction bütçeleri değişmedi. Güncel geçen, başarısız ve bekleyen sonuçlar [doğrulama kaydında](../../academic-archive-review/verification.md) tutulur.

- [ ] Kabul testlerini ve sonuçlarını `test: verify academic archive lifecycle` commit'iyle kapat.
- [ ] README/admin/kurulum-yedek/güvenlik belgelerini nihai davranışa göre güncelle; test edilmiş/edilmemiş alanlar ve bütün görev commitlerini kaydet. Eski planı tarihsel kayıt olarak yeni plana bağla.
- [ ] Graphify'ı son kaynaklardan güncelle ve diagnose çalıştır; harita göstergelerini ayrı runtime kanıtlarıyla bağla. SQL parser/Markdown semantik sınırlamalarını koru, haritayı işlevsel test diye sunma.

```powershell
& 'C:\Users\ahmet\AppData\Roaming\uv\tools\graphifyy\Scripts\python.exe' -m graphify update .
& 'C:\Users\ahmet\AppData\Roaming\uv\tools\graphifyy\Scripts\python.exe' -m graphify diagnose multigraph --graph graphify-out\graph.json
git diff --check
git status --short
```

- [ ] Kanıtlar/artifact/Graphify üzerinde gizli veri taraması, gerçek DB hash ve korunan diff karşılaştırması yap. Son `docs: refresh academic archive docs and graph` commit'ini at; yalnız iki korunan kullanıcı değişikliğinin kaldığını doğrula.

## Onay kapısı

Bu belge ve inceleme dışında kaynak kodu, migration, gerçek veri veya commit değişikliği yapılmadı. Kullanıcı onayı; yukarıdaki davranış sözleşmesi, görev sırası ve her doğrulanan görev sonrası ayrı commit ile ilerlemeyi kapsar. Onay verilene kadar Görev 0 dahil uygulama/düzeltme çalışması başlamaz.

