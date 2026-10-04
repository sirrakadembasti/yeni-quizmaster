# Veli paneli sayfa/sekme doğrulaması

4 Ekim 2026. Başlangıç commit'i `b1257eb`; yalnız veli paneli denetlendi. Ürün koduna düzeltme uygulanmadı. Test dosyaları, izole fixture/başlatıcı ve raporlar eklendi. Kullanıcının `client/src/lib/api.ts` ve `client/src/pages/server-setup.tsx` değişiklikleri korunur ve bu audit commit'ine alınmaz.

## Son kapsam

Son manifest ve tamamlanan koşular birleştirildi: **41 E2E kontrolü:26 geçti,15 başarısız,0 çalıştırılmamış,0 atlanmış**. [Sayfa/test bazlı özet](coverage-summary.json). PDF bütünlük kontrolü bu41 E2E sonucuna ek bir kontroldür; aşağıda ayrı belirtilir.

| Sayfa/sekme | Geçen kontroller | Başarısız/kısmi kontroller |
|---|---|---|
| Dashboard/home | Doğrudan URL ve alias, reload; normal/uzun ad/e-posta375/390px belge taşması yok; klavye çocuk seçimi/focus; gerçek metrikler, iki çocuk | Öğrenci/overview500 hata ayrımı/retry; seçili çocuğun sonuç bağlantısı; accessible-name |
| Sonuç listesi | Gerçek bağlı çocuğun sonucu; çocuk değiştirme; doğrudan URL/reload, mobil | Öğrenci/overview hata ve yavaş yüklenme boş veriye düşer; bağlantısız veli açıklaması; accessible-name |
| Sonuç detayı | Kendi çocuklarına ait gerçek soru/cevap,0 ve50 puan/doğru sayısı; geri; çocuk değişince eski detay kapanır | Detay500 hata/retry; görsel render eksik. Detay URL'si yok; yenilemede aynı detay kalması özellik olarak önerildi |
| Profil Bilgileri | GUI ad/telefon/adres değişimi, gerçek PATCH200/DB/reload; finally restore | E-posta alanı erişilebilir/editable doğrulandı; e-posta değişimi/çakışma/biçim negatifleri bu kohortta çalıştırılmadı |
| Bildirimler | GUI sayfalama20 kayıt; okundu/silme/DB/reload; başka kullanıcı bildirimi404; ses tercihi/reload; kontrollü500→hata→gerçekretry200 | Bildirim toplu okundu/ses mutasyonu500 ve websocket gerçek zamanlı teslim testi yapılmadı |
| İşlem Geçmişi | Kendi son altı ay kaydı,50 sayfalama, yabancı/eski kayıt dışlama; kontrollü500→retry200 | Tarih filtresi UI yok; çok büyük veri performansı sınanmadı |
| Güvenlik | Şifre uyuşmazlığı, yanlış mevcut şifre, GUI gerçek şifre değişimi, eski diğer oturum401, eski parola401/yeni parola200; test hesabı hash'i geri yüklenir | Doğal24h cookie expiry ve harici e-posta sıfırlama/SMTP sınanmadı |
| Ayarlar dört sekme | Mobil klavye ArrowRight, selected/focus, query URL ve reload; Yazdır handler/PDF | Tarayıcı geri/ileri ve bütün dropdown/mobil menü odak kapanı ayrı kapsamda tam sınanmadı |
| Duyurular | Herkese/veliye duyuru doğru görünür; öğretmen özel duyurusu yok; veli oluştur/sil403; kontrollü500→retry200; Yazdır/PDF | Sınıf bazlı veli bildirim DB0; hedef parent etiketi öğretmenlere diye gösterilir |
| Oturum/mahremiyet | Gerçek GUI login/logout; anonim401/yanlış rol403; yabancı öğrenci/sonuç403; kayıp/bitmemiş sonuç404; bağ kaldırma/pasifleştirme yeniAPI403; sessionVersion401+girişe dönüş; başka veliye geçiş eski cache'i temizler | Eski öğrenci kimliğinin kendi açık denemesi veli rolüyle cevap yazabiliyor |

Ürün görünürlüğü/işlevi bulunan tüm veli sayfa ve ayar sekmeleri kapsandı; bütün olası davranışların test edildiği iddia edilmez. Olmayan arama/filtre/sıralama/sayfalama/CRUD “geçti” sayılmaz; [özellik önerileri](findings.md) ayrı tutulur.

## Koşular ve test aracı düzeltmeleri

- [baseline](results-baseline.json):32 kontrol; **19 geçti/13 başarısız**, runner exit1. [Temizlik](runner-baseline.json) başarılı. Başarısız testler beklenen ürün davranışını ileri sürer, xfail/skip ile gizlenmez.
- [depth](results-depth.json):10 kontrol; **7 geçti/3 başarısız**, exit1. Üç backend adayında aynı davranış tekrar üretildi ve gerçek DB/API gözlemleri kaydedildi. GUI login/logout/cache sınırları, settings notifications/logs error-retry, uzun mobil ad/e-posta ve print invocation geçti. [Temizlik](runner-depth.json) başarılı.
- [readiness](results-readiness.json):2 kontrol; **0 geçti/2 başarısız**, exit1. İlk P-E07'nin test route temizliği “already handled” hatası düzeltildi: bekletilen route devamını tamamlamadan unroute yapılmıyor. Son başarısızlık gerçek eksik “yükleniyor”/yanlış boş mesajıdır. P-A03 sonuç sayfasının erişilebilir adını diğer sayfadan bağımsız sınar. [Temizlik](runner-readiness.json) başarılı.
- [print](results-print.json):2 kontrol; **1 geçti/1 başarısız**, exit1 ve cleanup başarılı. Son print koşusu animasyonları bitmiş DOM/fontlar üzerinde PDF alır; önceki hızlı yakalama güvenlik kartını kısmen görünmez almıştı. İlk PDF metin doğrulayıcı ayrıca Chromium'un kalın başlıktaki glyph boşluklarını birebir metin eşlemesinde reddetti. Test aracı düzeltilerek normalize metin+görüntü denetlendi; ürün düzeltmesi yapılmadı. İlk [PDF gözlemi](print/verification-initial.json) korunur. Beş PDF'nin çekirdek metni/render kontrolü geçti; **görsel inceleme bildirimlerin yalnız ilk6 satırının basıldığını gösterdi**. Ek satır bütünlüğü doğrulaması başarısız; P-B10. PDF üretimi basılı içeriğin tam olduğu anlamına gelmez.

Ham runtime logları, session/cookie bilgileri ve fixture DB'leri commit edilmez. Test JSON'ları fixture parolası, raw/encoded signed cookie ve hassas alanlar için sanitize edilir. Kaynak test dosyalarındaki parolalar yalnız disposable örnek hesap içindir.

## Kanıtlar

- Audit altyapısı `node --test scripts/parent-audit-windows-runner.test.mjs scripts/student-audit-report-sanitize.test.mjs`: **5 geçti/0 başarısız/1 symlink testi Windows'ta atlandı**, çıkış0. Dolu5560 portunda runner kullanıcının port sahibini öldürmeden ve gerçek DB'ye dokunmadan reddeder. [Port guard gözlemi](runner-windows-port-guard.json) bu kasıtlı reddi `cleanup-failed` diye kaydeder; dört normal E2E kohortunun temizliğinden ayrı bir negatif kontroldür.
- Yeni server fixture `pnpm --filter quiz-master-server type-check` çıkış0. Ürün değiştirilmediğinden önceki panelin tam frontend regresyonu/derlemesi bu audit'te tekrarlanmadı; bu kohortun başarısı olarak sayılmadı.

- [Legacy veli cevabı HTTP200/DB kaydı](legacy-answer-observation.json)
- [Sınıfsız çocuk API kapsam farkı](classless-exams-observation.json)
- [Sınıfa hedefli duyuru POST201/liste var/bildirim0](class-announcement-observation.json)
- [Rota/konsol/API/mobil gözlemleri](navigation-observations.json): başarılı taramada hata0; kontrollü hata testleri bu başarıya dahil edilmez.
- [PDF metin/render doğrulaması](print/verification.json), Chromium çıktıları ve tüm render sayfaları `print/` altında. Fiziksel yazıcı/OS baskı diyalogu test edilmedi; window.print çağrısı sayacı+gerçek print CSS/PDF denetlendi.
- [Güncel görsel Graphify testi](graphify/result.json); tanı ve parser/LLM sınırları [harita belgesinde](../graphify.md).
- Harita AST güncellemesi ve multigraph exit0:2558 düğüm/6734 kenar/142 topluluk; eksik/sarkan/yinelenen/unverified/external uç0, self-loop11, suppression12. Gerçek renderer ParentResultsPage düğümünü19 bağlantıyla doğruladı; hata0 ve cleanup başarılı.

## Sınırlar ve veri bütünlüğü

Native Windows, tek Playwright worker, gerçek Chromium ve gerçek Express/Prisma/SQLite fixture. Linux/WSL, yeni hibrit kurulum ve diğer panellerin tekrar denetimi bu kohortta yapılmadı. Kurulumun terminal/BAT/SH + web modeli korunur. Gerçek sesli ekran okuyucu önceki kullanıcı talebiyle kapsam dışı; klavye/ARIA kontrolleri yapılır. Harici SMTP/e-posta, doğal cookie expiry, gerçek websocket teslimi ve yük/stres/performance bütçesi sınanmadı.

Profil/bildirim/şifre/bağ/aktiflik mutasyonları yalnız izole test verilerinde; finally ile restore/cleanup. Dört normal kohortun API/UI5560/5561 süreçleri kapandı, portları boşaldı; görsel harita tarayıcısı/sunucusu da kapandı. Gerçek `server/data/quiz.db` başlangıç ve kapanış SHA256'sı aynı: `8210a4b79f2cfb9cf74de6a4989f5c8a5449ba1d17b2332abdbd018c3741a158`. Salt okunur audit tamamlanması, panelin kusursuz veya tüm testlerinin yeşil olduğu anlamına gelmez. [Bulgular ve kod değişikliği gerektiren plan](findings.md).
