# Üretim performansı ve paket küçültme uygulama planı

> **Tarihsel plan/tasarım kaydı.** 14 Ekim 2026 belge kontrolü: gelecek zaman, açık kutular ve ara sonuçlar özgün çalışma sırasını korur; güncel yapılacaklar olarak okunmamalıdır. [Sonuç ve kapsam kaydı](../../production-performance-results.md) esas alınır.

> **Ajan olarak çalışanlar için:** ZORUNLU ALT BECERİ: superpowers:subagent-driven-development kullan. Üst üretim planı Görev 4; geri dönüş kabulü kapandıktan sonra uygulanır.

**Amaç:** Gerçekçi izole yükü ölçmek ve çevrimdışı öğrenci akışını koruyarak başlangıç frontend indirmesini azaltmak.

**Mimari:** Rol denetiminden sonra yüklenen lazy sayfalar ve yerel hata/yükleniyor sınırı. Eager öğrenci kritik akışı ve sadece public app asset cache'i. Bağımsız sentetik DB/süreç/portlara sahip gerçek HTTP/Chromium ölçümü.

**Teknolojiler:** React 19, Wouter 3, Vite 7, Vitest, Playwright, Prisma/SQLite, mevcut owned-process araçları.

## Genel kısıtlar

- Kullanıcı değişiklikleri `client/src/lib/api.ts` ve `client/src/pages/server-setup.tsx` düzenlenmez/stage edilmez. Canlı `server/data/quiz.db` yalnız hash; testlerde açılmaz.
- Fixture/evidence plan workspace veya canonical own test prefix altında; private env/oturum/DB/log Git dışında. Süreç kimliği ve port kapanışı doğrulanır.
- Ağ/ücretli servis veya sistem yapılandırması değiştirilmez. Host test/build/browser işleri seri çalışır.
- [Tasarım](../specs/2026-10-13-production-performance-design.md) kabul sözleşmesi korunur; Task3 runner/report başka görev sahipliğindedir.

## Görev 1: Gerçekçi yük ve başlangıç ölçümü

**Dosyalar:** `scripts/production-performance-rehearsal.mjs` (guard, sentetik ölçüm/rapor), gerekirse ayrı seed/server fixture yardımcıları; `docs/production-performance-results.md` (sonuç). Mevcut `server/tests/api/academic-archive-volume.test.ts`, `scripts/integration-load-ux.mjs` ve owned-process helperları kaynak olarak incelenir; eski canlı fixture kimliklerine güvenilmez.

- [x] Yeni fixture guard'larını negatif traversal/link/mevcut hedef testleriyle doğrula; protected hash başlangıcını kaydet.
- [x] En az 1.000 kullanıcı ve 10.000 iş kaydını gerçek migration DB'sine sentetik olarak seed et; sınıf/öğretmen/veli/sınav/anket/sonuç/cevap sayıları raporla. Gerçek 22 migration sonrası 1.311 kullanıcı ve 17.661 iş satırı doğrulandı.
- [x] Aynı ortamda concurrency 2, 8 ve 20 ile gerçek HTTP iş yükü; okuma/yazma ve arşiv sırasında bağımsız writer latency ölç. Başarı/status/body/DB ilişki doğrulaması yap, p50/p95/p99/max ve throughput/resource kapsamını kaydet. 2/8 aktör ve arşiv yazıcısı geçti; 20 aktörün 10 timeout/1 DB onayı uyuşmazlığı başarısız kapasite sonucu olarak korunur.
- [x] Aynı production config ile `vite build --manifest` başlangıç ölçümü al; entry static imports grafiği toplam JS/gzip, toplam JS/CSS ve büyük chunkları kaydet. Sonraki build için config/deps aynı kalır. Tam dağıtım public SW dahil ölçüldü; aynı config/orijinal kaynak karşılaştırması doğrulandı.

## Görev 2: Sayfa yüklemesi ve offline düzeltme

**Dosyalar:** `client/src/App.tsx`, yeni `client/src/components/RouteLoadBoundary.tsx` ve testleri; gerçek RED gerekiyorsa `client/public/sw.js`, `client/src/main.tsx`, `client/src/pages/student-quizzes.tsx`, küçük offline-shell helper/test. Protected dosyaları değiştirme.

- [x] RouteGuard/lazy yetki davranışı, bekleme durumu ve reddedilen import kurtarma için anlamlı Vitest testlerini yaz; eksik boundary karşısında RED kaydet.
- [x] Public/auth/reset ve kritik eager öğrenci sayfaları dışındaki statik page importlarını `lazy(() => import(...))` yap. RouteGuard'ın dışındaki render için HomeRoute da aynı Suspense altında olur; boundary provider/AcademicRouteBoundary sırasını değiştirmez.
- [x] `role="status"` ile loading, `role="alert"` ile chunk hatası; kullanıcı kontrollü `window.location.reload()` ve home link; route değişince reset. React.lazy reddi cache'lediği için yalın state retry başarı gibi gösterilmez. Birim RED/GREEN, kontrollü negatifler ve gerçek production lazy-404 kurtarma kanıtı alındı.
- [x] Gerçek production ilk ziyaret offline testini mevcut worker ile çalıştır. RED ise public app-shell JS/CSS prefetch + readiness handshake uygula; küme entry ve statik import closure'dır, lazy/report parçaları değildir. Readiness geçmeden preparedIds/session başarıpublish edilmez. Base/origin/asset allowlist, failed install/preparation, upgrade ve özel API/upload'un cache dışında olması için test ekle. Gerçek `Vary: Origin` cache eşleşmesi RED/GREEN; `/` ve `/school/` production offline diyagram/teslim kontrolleri geçti.
- [x] Type-check ve ilgili testleri çalıştır; aynı manifest ölçümüyle başlangıç gzip azalmasını doğrula. Hedef %25; public/student eager yolların dinamik chunk gerektirmediğini asset grafiğinde kontrol et. %43,37 azalma; 295 frontend/422 düzenli backend/23 hedefli/11 yardımcı test ve iki typecheck geçti. Önceki 50k dosyası yeniden çalıştırılmadı.

## Görev 3: Gerçek tarayıcı, yeniden ölçüm ve kapanış

**Dosyalar:** guarded production Chromium runner/tests, `docs/production-performance-results.md` ve üst plan/bakım/README (parent günceller).

- [x] Dört rol direct/refresh/izin-red/returnUrl/back/alias/base-path, admin geçmiş yıl salt okunur, yeni chunk hata ekranı ve kurtarma akışlarını gerçek browser ile çalıştır; screenshot/network/pageerror kanıtı kaydet. Root/base/history ve son settled dört rol kabulü geçti; beklenen lazy 404 ile beklenmeyen ağ hataları ayrıldı.
- [x] Taze profilde offline prepare→daha önce açılmamış sınav URL'si→offline reload/soru görseli/cevap→queued submit→reconnect/tek kayıt DB doğrula. Resim veya storage/kota reddi yeniden üretilirse public asset cache'ini kullanmadan kullanıcı offline session'ı içinde dar düzeltme yap; yanlış hazır durumu ve queued cevap kaybını negatif testle reddet. Gerçek kota, in-flight logout, HTML-200 eksik JS, eski worker upgrade ve cevap/revision/submit korunumu geçti; görseller ayrıca incelendi.
- [x] Gerçekçi yükte hata bulunduysa dar düzeltme ve aynı workload tekrarını raporla. Önce/sonra JS/gzip, CSS, p50/p95/p99/max/errors ve host sınırlarını yaz. Dar atomik tercih retry düzeltildi; 20 aktör kapasite sınırı açık bırakıldı, genel pagination/timeout sözleşmesi değiştirilmedi.
- [x] Task-scoped bağımsız spec/quality review; gerekli fix ve tekrar. Protected3hash/süreç/port kanıtı ve staged guard sonrası ayrı görev commit'i. `619bdf4` commit'i; bağımsız spec/quality PASS, açık P1/P2 yok. Ölçümün statik paket kapsamı ve başarısız 20 aktör sınırı açıklandı. Son Graphify/Markdown/push üst plan kapanışında yapılır.

14 Ekim kapanış: bu planın uygulama ve ölçüm görevleri belgelenen kapasite sınırıyla tamamlandı. Bu, bütün yük düzeylerinin başarılı olduğu veya canlı üretim kapasitesinin onaylandığı anlamına gelmez. [Sonuçlar ve sınırlar](../../production-performance-results.md).
