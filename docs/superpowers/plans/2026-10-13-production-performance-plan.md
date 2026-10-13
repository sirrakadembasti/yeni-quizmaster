# Üretim performansı ve paket küçültme uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Üst üretim planı Görev 4; geri dönüş kabulü kapandıktan sonra uygulanır.

**Goal:** Gerçekçi izole yükü ölçmek ve çevrimdışı öğrenci akışını koruyarak başlangıç frontend indirmesini azaltmak.

**Architecture:** Rol denetiminden sonra yüklenen lazy sayfalar ve yerel hata/yükleniyor sınırı. Eager öğrenci kritik akışı ve sadece public app asset cache'i. Bağımsız sentetik DB/süreç/portlara sahip gerçek HTTP/Chromium ölçümü.

**Tech Stack:** React 19, Wouter 3, Vite 7, Vitest, Playwright, Prisma/SQLite, mevcut owned-process araçları.

## Global Constraints

- Kullanıcı değişiklikleri `client/src/lib/api.ts` ve `client/src/pages/server-setup.tsx` düzenlenmez/stage edilmez. Canlı `server/data/quiz.db` yalnız hash; testlerde açılmaz.
- Fixture/evidence plan workspace veya canonical own test prefix altında; private env/oturum/DB/log Git dışında. Süreç kimliği ve port kapanışı doğrulanır.
- Ağ/ücretli servis veya sistem yapılandırması değiştirilmez. Host test/build/browser işleri seri çalışır.
- [Tasarım](../specs/2026-10-13-production-performance-design.md) kabul sözleşmesi korunur; Task3 runner/report başka görev sahipliğindedir.

## Task 1: Gerçekçi yük ve başlangıç ölçümü

**Files:** `scripts/production-performance-rehearsal.mjs` (guard, sentetik ölçüm/rapor), gerekirse ayrı seed/server fixture yardımcıları; `docs/production-performance-results.md` (sonuç). Mevcut `server/tests/api/academic-archive-volume.test.ts`, `scripts/integration-load-ux.mjs` ve owned-process helperları kaynak olarak incelenir; eski canlı fixture kimliklerine güvenilmez.

- [ ] Yeni fixture guard'larını negatif traversal/link/mevcut hedef testleriyle doğrula; protected hash başlangıcını kaydet.
- [ ] En az 1.000 kullanıcı ve 10.000 iş kaydını gerçek migration DB'sine sentetik olarak seed et; sınıf/öğretmen/veli/sınav/anket/sonuç/cevap sayıları raporla.
- [ ] Aynı ortamda concurrency 2, 8 ve 20 ile gerçek HTTP iş yükü; okuma/yazma ve arşiv sırasında bağımsız writer latency ölç. Başarı/status/body/DB ilişki doğrulaması yap, p50/p95/p99/max ve throughput/resource kapsamını kaydet.
- [ ] Aynı production config ile `vite build --manifest` başlangıç ölçümü al; entry static imports grafiği toplam JS/gzip, toplam JS/CSS ve büyük chunkları kaydet. Sonraki build için config/deps aynı kalır.

## Task 2: Sayfa yüklemesi ve offline düzeltme

**Files:** `client/src/App.tsx`, yeni `client/src/components/RouteLoadBoundary.tsx` ve testleri; gerçek RED gerekiyorsa `client/public/sw.js`, `client/src/main.tsx`, `client/src/pages/student-quizzes.tsx`, küçük offline-shell helper/test. Protected dosyaları değiştirme.

- [ ] RouteGuard/lazy yetki davranışı, bekleme durumu ve reddedilen import kurtarma için anlamlı Vitest testlerini yaz; eksik boundary karşısında RED kaydet.
- [ ] Public/auth/reset ve kritik eager öğrenci sayfaları dışındaki statik page importlarını `lazy(() => import(...))` yap. RouteGuard'ın dışındaki render için HomeRoute da aynı Suspense altında olur; boundary provider/AcademicRouteBoundary sırasını değiştirmez.
- [ ] `role="status"` ile loading, `role="alert"` ile chunk hatası; kullanıcı kontrollü `window.location.reload()` ve home link; route değişince reset. React.lazy reddi cache'lediği için yalın state retry başarı gibi gösterilmez.
- [ ] Gerçek production ilk ziyaret offline testini mevcut worker ile çalıştır. RED ise public app-shell JS/CSS prefetch + readiness handshake uygula; küme entry ve statik import closure'dır, lazy/report parçaları değildir. Readiness geçmeden preparedIds/session başarıpublish edilmez. Base/origin/asset allowlist, failed install/preparation, upgrade ve özel API/upload'un cache dışında olması için test ekle.
- [ ] Type-check ve ilgili testleri çalıştır; aynı manifest ölçümüyle başlangıç gzip azalmasını doğrula. Hedef %25; public/student eager yolların dinamik chunk gerektirmediğini asset grafiğinde kontrol et.

## Task 3: Gerçek tarayıcı, yeniden ölçüm ve kapanış

**Files:** guarded production Chromium runner/tests, `docs/production-performance-results.md` ve üst plan/bakım/README (parent günceller).

- [ ] Dört rol direct/refresh/izin-red/returnUrl/back/alias/base-path, admin geçmiş yıl salt okunur, yeni chunk hata ekranı ve kurtarma akışlarını gerçek browser ile çalıştır; screenshot/network/pageerror kanıtı kaydet.
- [ ] Taze profilde offline prepare→daha önce açılmamış sınav URL'si→offline reload/cevap→queued submit→reconnect/tek kayıt DB doğrula.
- [ ] Gerçekçi yükte hata bulunduysa dar düzeltme ve aynı workload tekrarını raporla. Önce/sonra JS/gzip, CSS, p50/p95/p99/max/errors ve host sınırlarını yaz.
- [ ] Task-scoped bağımsız spec/quality review; gerekli fix ve tekrar. Protected3hash/süreç/port kanıtı ve staged guard sonrası ayrı görev commit'i. Son Graphify/Markdown/push üst plan kapanışında yapılır.
