# Kalan UX kapsamı — 4 Ekim 2026

Bu dosya ilk kaynak karşılaştırmasının kapsam listesidir. Sonraki gerçek Chromium, kontrollü ağ, çevrimdışı ve PDF kontrollerinin güncel sonuçları [doğrulama raporunda](verification.md), `ux-detail-results.json` ve `ux-extra-results.json` içindedir. Aşağıdaki “aday/henüz çalıştırılmadı” anlatımları bu listenin ilk hazırlanma aşamasını açıklar; son test durumu için doğrulama raporu esas alınır.

Bu kayıt mevcut kaynak ve önceki denetim raporlarının salt okunur karşılaştırmasıdır. Bu çalışma sırasında yeni tarayıcı koşusu, sunucu veya ağır test paketi başlatılmadı; aşağıdaki kabul kontrolleri henüz çalıştırılacak adaylardır. Ürün kodu değiştirilmedi. Öncelik P2 orta, P3 düşük; efor göreli tahmindir.

## Tarihsel kusurlarla karıştırılmaması gereken kapanışlar

- Öğretmen T-F01/T-F02 kapalı; ayrı T-U01–04 açık: `docs/teacher-audit/defect-repairs.md`.
- Öğrenci S-B01–06 kapalı; ayrı UX/yeni özellikler onarım kapsamı dışında: `docs/student-audit/defect-repairs.md`.
- Veli P-B01–10 **ve P-U01–05** uygulandı ve kabul kanıtı var: `docs/parent-audit/defect-repairs.md`. İlk bulgular dosyasındaki “uygulanmadı” metni tarihsel durumdur.
- Admin AX01–08, klavye/menü ve hesaplanan kontrol adları kapalı: `docs/admin-audit/verification-closure.md`, `accessibility-closure.md`. Gerçek sesli okuyucu kullanıcı kararıyla kapsam dışıdır.
- Admin Q13 eski “Toplam Sınav” önerisi kaynakta karşılanmış: `client/src/pages/dashboard.tsx:226` admin için “Toplam İçerik” gösterir. Yeniden açık kusur sayılmaz.

## Somut kalan UX kontrol listesi

| ID / yüzey | Öncelik / efor | Güncel kaynak kanıtı ve kalan öneri | Gerçek Chromium kabul adayı |
|---|---|---|---|
| T-U01 / admin+öğretmen `/results` araması | P3 / küçük | `client/src/pages/results.tsx:491` placeholder var, kalıcı bağlı label yok. Placeholder kaynaklı erişilebilir adın boş olduğu iddia edilmez. | Yazı girince amaç görünür mü; computed name; Tab; arama/reset ve 390 px düzeni. |
| T-U02 / öğretmen sınav önizlemesi | P2 / küçük | `student-quiz.tsx:433` kaydedilmez banner'ı; `:617` kaydedilecek ve sonuç sayfasına gider onayı. Rol/önizleme açıklaması ayrılmalı. | Öğretmen önizleme bitirme modalı ve öğrenci gerçek bitirme modalını ayrı kaydet; önizleme sonuç API'sini değiştirmemeli. |
| T-U03 / öğrenci rapor kodu ve PDF | P3 / küçük | `student-results.tsx:411–412` “Öğrenci Kodu” doğrudan `student.id.substring(0, 8)` gösterir. Tarihsel PDF'deki `teacher-` yalnız CSS kırpılması değildir; tam kod isteniyorsa kaynak truncation da ele alınmalı. | UUID/uzun sentetik ID ekran/PDF'de tam mı; mobil ve tablo taşması; gerçek PDF renderı. |
| T-U04 / `/statistics` hızlı baskı | P2 / orta | `teacher-audit/verification.md:84` gerçek transient SVG/PDF geometrisi; kararlı kareyi bekleyen test ürün baskı davranışını tek başına onarmaz. | İlk açılış ve filtre sonrası hemen baskı; gerçek PDF sütunları eksen alanında mı; sayı tablosuyla oran uyumu. |
| S-U01 / öğrenci dashboard detay eylemi | P2 / küçük | `student-dashboard.tsx:299` adsız ikon ve `opacity-0 group-hover:opacity-100`. Açık isim ve klavye/dokunmatik görünürlüğü. | Accessible name; hover olmadan 390 px; Tab odak görüntüsü ve Enter doğru sonucu açar mı. |
| S-U02 / `/student/quizzes` filtreler | P2 / küçük | `student-quizzes.tsx:186–197` placeholder arama; SelectTrigger ayrı label/ARIA adı yok. | Arama ve durum amaçlarının computed name'i; klavye seçim/reset; girilmiş arama sonrası görünür bağlam. |
| S-U03 / sınav cevap ve soru durumları | P2 / küçük–orta | `student-quiz.tsx:515` civarı cevap butonları seçimi CSS ile gösterir; soru gezgini de aktif/yanıtlı state semantiği için incelenmeli. | Seçim öncesi/sonrası ARIA snapshot; Tab/Enter ile cevap ve gezinme; aktif/yanıtlanan soru bilgisi. |
| S-U04 / anket yanıtı | P2 / küçük–orta | `take-survey.tsx:53–56`: açık metin soruyla ilişkilendirilmemiş; rating/single/Likert button'larında seçili semantik yok. `:27–28` hata/veri yok aynı bulunamadı mesajı; `:40` whitespace metni geçirebilir. | Beş tipte computed name/selected state; gerçek klavye; yalnız boşluk gönderimi; ayrı kontrollü 403/404/500 ve gerçek retry toparlanması. Yeni hata iddiası için koşu kanıtı gerekir. |
| S-U05 / başarı ölçütü | P2 / küçük, ürün ölçütü kararı gerekli | Dashboard `student-dashboard.tsx:272` başarı >=50; istatistik `student-stats.tsx:55` başarı >=70. Fark açıkça açıklanmalı veya aynı ürün ölçütü kullanılmalı. | 50/69/70 puanlı aynı izinli kayıtlar iki sayfada hangi anlamla sunuluyor. |
| S-U06 / çevrimdışı sınav listesi | P2 / orta | `student-quizzes.tsx:70–78` offline fallback results=[]; `:117–119` yalnız sunucu sonucu completed ise tamamlanan. Yerel devam/teslim kuyruğu yapılacakla karışabilir. S-B01 cevabın korunması onarımı bu listeyi kapatmaz. | Completed, devam eden, pendingSubmit fixture; offline reload; durum ve sayaç; online dönüşte gerçek sonuç uzlaştırması. |
| S-U07 / ortak başlık bildirimleri | P2 / küçük–orta | `components/layout/DashboardLayout.tsx:113–119` query error UI alınmaz; `:127–132` markAllRead onError yok. Tercih mutasyonunun onError'ı vardır, onu eksik diye saymayın. | Header popover GET 500 ve toplu-okundu başarısızlığı; hata/yeniden dene/gerçek toparlanma; ayarlar bildirimi başarısı bunun yerine geçmez. |
| S-U08 / istatistik baskı eylemi | P3 / küçük | `student-stats.tsx:103–105` window.print; `:143` “PDF İndir”. Eylemin “Yazdır / PDF olarak kaydet” açıklaması önerilir. | Düğme OS print akışını açıyor mu; görünen ad gerçek eylemi açıklıyor mu. Dosya bozukluğu iddiası değildir. |
| A-U01 / listelerin PDF işlemler kolonu | P3 / küçük | Admin `verification-closure.md:93` açık öneri; `admin-quizzes.tsx:132` İşlemler başlığı var. Baskıdaki global CSS etkisi yeni PDF'de ayrıca kontrol edilmeli. | Gerçek quiz/sınıf/öğretmen PDF'lerinde boş kolon kalıyor mu; silme/görüntüleme düğmeleri ve kolon birlikte gizli mi. |
| A-U02 / uzun çok sayfalı raporlar | P2 / orta test eforu | `verification-closure.md:94` kapsam genişletme; mevcut olumlu PDF kanıtı bütün veri hacimleri için sonuç değildir. | Uzun ad/soru/kod, çok satır; tekrar başlıkları, sayfa bölünmesi, tam kayıt sayısı ve sıfır puan; PDF metin+render. |

## Kusur sayılmayan yeni özellikler

| Rol / yüzey | Kalan öneri ve kaynak | Öncelik / efor | Tarayıcı incelemesinin sınırı |
|---|---|---|---|
| Veli dashboard | Son kayıtlarla sınırlama; `parent-dashboard.tsx:83` tüm `completed.map` gösterilir | P3 / küçük | Çok kayıtlı fixture mevcut görünümü gösterebilir; uygulanmayan sınır çalışıyor sayılmaz. |
| Veli sonuçlar | Arama, ders/tarih filtreleri, sayfalama; `parent-results.tsx:65–74` doğrudan results.map | P2 / orta | Mevcut kontrol yokluğu ve çok sonuç gezinme yükü incelenebilir. |
| Veli sonuç detayı | Doğrudan detay URL'si ve reload; `parent-results.tsx:17` resultId yalnız state; studentId URL'de korunur | P3 / orta | Detay aç→reload mevcut davranışı kaydet; çocuk bağlamı bug'ı kapalıdır. |
| Veli export | Veliye uygun Excel/PDF özet; findings.md yeni özellik tablosu | P3 / orta | Mevcut olmayan export'ı hata saymayın. |
| Öğretmen | Yaklaşan işler, sınav/anket kopyası, dönem karşılaştırması, kaydedilmiş filtreler, öğrenci son sonucu, sorumlu/ders sınıf ayrımı, duyuru alıcı önizlemesi, geçmiş tür/tarih filtreleri | P2/P3 / küçük–büyük | `teacher-audit/findings-source.md` özellik tablosu; bu özellikler audit kabulüne dahil değildir. Sınıf ayrımı mevcut assignment verisiyle küçük; diğerlerinin çoğu orta. |
| Öğrenci | Senkronizasyon merkezi, yanıtsız soru özeti, gelişim/hedef, bitiş tarihi yapılacaklar, öğretmen açıklaması, anket yerel taslak/çıkış uyarısı | P2/P3 / orta ağırlıklı | `student-audit/findings.md` yeni özellik tablosu; mevcut offline cevap korunması yeni senkronizasyon merkezi değildir. |
| Admin/ortak | Rapor menüsü; rota bazlı JS ayırma | P3/orta performans / orta–yüksek | `admin-audit/verification-closure.md:95–96`; bundle uyarısı tek başına ölçülmüş UX yavaşlığı değildir. Ayrı kontrollü performans bütçesi gerekir. |

## Bu alt görevin doğrulama sınırı

Kaynak konumları mevcut çalışma ağacından okundu; tarihsel line numaraları gerektiğinde yenilendi. Doküman dışında dosya değişmedi. `client/src/lib/api.ts`, `client/src/pages/server-setup.tsx`, gerçek veritabanı ve gizli değerler okunmadı/değiştirilmedi. Yeni browser kabul sonucu, yeni performans sonucu, sesli ekran okuyucu veya fiziksel baskı başarısı bu belgeden çıkarılamaz.
