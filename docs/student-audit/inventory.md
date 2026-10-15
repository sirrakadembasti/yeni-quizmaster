# Öğrenci paneli envanteri ve denetim kapsamı

> **Tarihsel kapsam/inceleme kaydı.** Kaynak satırları ve ölçümler özgün denetim tarihine aittir. Sonraki onarım kabulü [sonuç raporundadır](defect-repairs.md); buradaki ölçüm güncel üretim kapasitesi garantisi değildir.

Tarih: 2026-10-04. Bu belge kaynak kodu incelemesidir; aşağıdaki akışlar tarayıcıda veya gerçek API ile bu belge hazırlanırken çalıştırılmadı. `Kaynak bulgusu` çalışma zamanı testi yerine geçmez. Satır referansları inceleme anındaki kaynak içindir; düzeltmelerden sonra değişebilir.

## Sayfalar, sekmeler ve işlemler

Rota kaydı: `client/src/App.tsx:85-128`; öğrenci menüsü: `client/src/components/layout/DashboardLayout.tsx:168-201`.

| Rota / yüzey | Öğrenciye görünen kapsam | İşlemler / durumlar | Kanıt |
| --- | --- | --- | --- |
| `/`, `/student/dashboard` | Karşılama, sınıf/numara, ortalama başarı, tamamlanan/bekleyen sayıları; sıradaki sınavlar ve son dört sonuç | Sınavlara git; tüm sınavlar; başla; geçmiş sınavlar; sonuç detayı; dörtten fazla sonuçta tüm sonuçlar; yükleniyor/hata/boş | `student-dashboard.tsx:31-67,113,125,196-302`; `App.tsx:69-74,102` |
| `/student/quizzes`, `/my-quizzes` | Sınav tablosu: ad/açıklama, ders/öğretmen, zorluk, soru/süre, durum/puan | Başlık/konu arama; tümü/yapılacak/tamamlanan filtresi; 10 kayıt/sayfa; önceki/sonraki; başla; sonuç detayı; süresiz sınav için çevrimdışı hazırla; tekrar yükle; önbellekli çevrimdışı görünüm | `student-quizzes.tsx:49-134,182-276`; `App.tsx:103,106` |
| `/student/quiz/:quizId` | Aktif soru/seçenekler/görsel, zamanlayıcı, ilerleme, cevap kayıt durumu, numaralı soru gezgini | Cevap seç; önceki/sonraki/soruya atla; kaydı yeniden dene; bitir/onaydan vazgeç/onayla; otomatik süre bitişi; çevrimdışı cevap/gönderim kuyruğu; yükleniyor/hata/tamamlandı/boş soru | `student-quiz.tsx:42-263,278-607`; `App.tsx:93` |
| `/student-quizzes/:quizId` | Eski sınav bağlantısı | `/student/quiz/:quizId` yönlendirmesi | `App.tsx:227-232` |
| `/student/results`, `/my-results` | Sonuç özeti ve sınav kayıtları | Başlık arama; ders filtresi; puan filtresi; tarih/puan sıralama; filtre sıfırla; detay; yazdır; XLSX indir; yükleniyor/hata/boş | `student-results.tsx:85-177,348-370,445-644`; `App.tsx:95,107` |
| Sonuç sayfasının yönetici sekmeleri | Sınav/Öğrenci/Veli sekmeleri yalnızca `role === admin && student` koşulunda | Öğrenci rolünde bu sekmeler ve kullanıcı düzenleme/veli yönetimi görünmemeli | `student-results.tsx:420-443` |
| `/student/result/:resultId` | Sınav/puan/doğru/yanlış/süre ve soru incelemesi; doğru cevap/öğrenci cevabı etiketleri | Sonuçlara dön; yazdır; XLSX indir; yükleniyor/hata | `quiz-result-detail.tsx:23-148,150-293`; `App.tsx:94` |
| `/my-stats` | Tamamlanan sınav/ortalama/başarı oranı/toplam süre; son on sınav ve ders bazında grafikler | Excel/XLSX; PDF etiketli yazdır; yükleniyor/hata/boş veri | `student-stats.tsx:32-106,125-151`; `App.tsx:92` |
| `/student/surveys` | Sınıfa atanmış anket kartları, bekliyor/yanıtlandı | Anketi yanıtla; tamamlanmış kartta devre dışı düğme; yükleniyor/boş | `student-surveys.tsx:12-31`; `App.tsx:104` |
| `/student/survey/:id` | Açık metin, puanlama, çoklu seçim, tekli seçim, Likert soruları | Seç/yaz; tüm yanıtlar tamamlanınca gönder; gönderim hatası toast; başarıda listeye dön; daha önce yanıtlandı/yükleniyor/bulunamadı | `take-survey.tsx:20-60`; `App.tsx:105` |
| `/announcements` | Duyuru listesi, yazar ve hedef bilgileri | Yazdır; yükleniyor/hata/tekrar dene/boş. Oluştur/sil yalnızca yetkili roller için | `announcements.tsx:42-73,119-197`; `App.tsx:91` |
| `/settings?tab=profile` | Profil ve öğrenci/veli bilgileri | Öğrenci adı/e-posta/telefon/adres alanları salt okunur; yazdır; izin veriliyorsa profil kaydet | `settings.tsx:223-406`; `App.tsx:90` |
| `/settings?tab=notifications` | Bildirim listesi ve ses tercihi | Tümünü okundu işaretle; sesi aç/kapat; sil; sayfalama; hata/tekrar dene/boş | `settings.tsx:408-525` |
| `/settings?tab=logs` | Kişisel işlem geçmişi | Tarih filtresi; önceki/sonraki; yükleniyor/hata/tekrar dene/boş | `settings.tsx:527-610` |
| `/settings?tab=security` | Mevcut/yeni/tekrar şifre alanları | Şifre değiştir; doğrulama ve başarı/hata geri bildirimi | `settings.tsx:182-196,612-677` |
| Ortak başlık/menü | Mobil menü; tema; bildirim önizlemesi; profil menüsü | Menü aç/kapat/Escape/odak kapanı; bildirim sesi; tümünü okundu işaretle; bildirimi sil; duyurulara git; tüm bildirimler; Profilim; Güvenli Çıkış | `DashboardLayout.tsx:67-165,208-422`; `NotificationListener.tsx` |

## Kaynak bulguları ve doğrulanacak riskler

| ID | Öncelik | Kaynak kanıtı | Etki / gerekli doğrulama |
| --- | --- | --- | --- |
| ST-UX-01 | P1 | `student-dashboard.tsx:300-302`: `/student/statistics`; kayıtlı öğrenci istatistik rotası `App.tsx:92`: `/my-stats`; sonuç rotası `App.tsx:95` | Dörtten fazla sonuçta “Tüm Sonuçları Gör” kayıtlı olmayan rotaya gider. Düzeltme sonrası tıklama testi gerekli. |
| ST-UX-02 | P1 | `student-quiz.tsx:292,321,359`: geri düğmeleri `/quizzes`; `App.tsx:110,203`: yalnız öğretmen/yönetici | Öğrencinin hata/tamamlanmış/boş soru geri akışı yetkisiz erişime düşer. `student-quiz.tsx:412` önizleme dönüşü ise öğretmen/yönetici için geçerli olabilir; role göre korunmalı. |
| ST-UX-03 | P2 | `student-surveys.tsx:12,21-22`: yalnız `isLoading`, aksi durumda `data?.surveys || []`; `take-survey.tsx:20,30-31`: `!data` için “Anket bulunamadı” | API/ağ hatası boş başarı veya bulunamadı gibi gösterilir; hata ve yeniden deneme ayrılmalı. Gerçek veya taklit 500/ağ hatası testi gerekli. |
| ST-A11Y-01 | P2 | `student-dashboard.tsx:285-293`: ikon düğmesinde isim yok; `opacity-0 group-hover:opacity-100` | Sonuç detay düğmesi ekran okuyucu için adsız; klavye odağında görünürlük ve dokunmatik keşfedilebilirlik incelenmeli. |
| ST-A11Y-02 | P2 | `student-quizzes.tsx:186-197`: arama ve durum seçicide etiket/`aria-label` yok | Placeholder erişilebilir ad yerine güvenilmemeli. Arama ve filtre için programatik ad doğrulanmalı. |
| ST-A11Y-03 | P2 | `student-quiz.tsx:492-519,566-578`: seçilen cevap ve aktif soru sadece CSS ile; `take-survey.tsx:53-56`: açık metin etiketsiz, puan/tekli seçim durumu yalnız görünüm ile | Cevap/soru seçili durumu ekran okuyucuya iletilmeli; soruyla ilişkili label ve uygun seçim semantiği doğrulanmalı. |
| ST-UX-04 | P2 | `student-dashboard.tsx:52,125-131,203-215`; `student-stats.tsx:42,148-155` | Hata uyarısına rağmen sıfır sayılar/başarı veya boş durum ve dışa aktarma görünür. Verinin yüklenemediği durumda “tamamladın” mesajı yanıltıcı; arıza senaryosu kontrol edilmeli. |
| ST-UX-05 | P2 | `student-quizzes.tsx:70-78,117-119`: önbellek fallback sonuçları `[]`; durum sonuç listesinden çıkarılıyor | Çevrimdışı tamamlanmış sınavlar da “Yapılacak” sayılabilir. Önbellek sonucu ve tamamlanmış oturum senaryosu gerekli. |
| ST-UX-06 | P2 | `student-dashboard.tsx:262`: başarı 50; `student-stats.tsx:55`: başarı 70 | Öğrenciye verilen başarı değerlendirmesi tutarsız görünebilir. Ürün geçme eşiği belirlenmeli; 50/69/70 puanları karşılaştırılmalı. |
| ST-UX-07 | P3 | `student-stats.tsx:84,103-105,135,143` | Merkezî downloadCsv yardımcı adı yanıltıcıdır; downloadExcel üzerinden gerçek XLSX üretir. Excel/CSV hatası iddiası geri çekildi. “PDF İndir” yazdırma penceresi açar. Etiketlerin gerçek eylemi açıklaması ve indirilen/yazdırılan veri kontrolü gerekli. |
| ST-UX-08 | P2 | `DashboardLayout.tsx:113-119,127-132,163,318`: bildirim sorgu hatası ayrıştırılmıyor; toplu okundu mutasyonunda hata callback yok | Ortak başlıkta hata boş bildirim gibi görünebilir ve okundu işlemi sessiz başarısız olabilir. Ayarlar bildirim sekmesinden ayrı denetlenmeli. |

Bu bulgular ön inceleme içindir; aynı satıra başka bir denetim ajanının düzeltmesi gelirse kayıt son doğrulama raporuyla birlikte değerlendirilmelidir.

## Tam denetim kontrol listesi

- [ ] Öğrenci girişi, oturum yenileme/sona erme, çıkış ve giriş sonrası hedef rotanın korunması.
- [ ] Her menü, doğrudan rota ve eski alias; anonim erişim, yanlış rol, bilinmeyen/başka öğrenciye ait sınav/sonuç/anket ID'si. UI görünürlüğü API yetkisi yerine kabul edilmez.
- [ ] Dashboard: sıfır veri, tek/çok sonuç, beşten fazla sonuç, uzun ad/başlık, atanmış bekleyen sınavlar; tüm düğmelerin hedefleri.
- [ ] Sınav listesi: Türkçe arama, kategori/durum filtreleri, boş eşleşme, 11+ kayıt sayfalama, hazırlama beklemesi/hatası, süresiz/süreli çevrimdışı kuralları.
- [ ] Sınav oturumu: yeni/devam/tamamlanmış; her cevap tipi/görsel; önceki/sonraki/numara; timer/otomatik bitiş; kaydetme hatası/yeniden dene; bitir/onaydan vazgeç; hızlı çift tıklama; yenileme/bağlantı kesilmesi/yeniden bağlantı ve kuyruk senkronizasyonu.
- [ ] Sonuçlar: arama/ders/puan/sıralama/reset; doğru/yanlış/boş ve devam eden sonuç; detayda doğru cevap/öğrenci cevabı; CSV ve yazdırma çıktısının ekrandaki filtrelerle tutarlılığı.
- [ ] İstatistik: gerçek puan/süre hesapları, boş veri, ders ve son on sınav grafiği, başarı eşiği, CSV/print ve başarısız veri isteğinde dışa aktarma.
- [ ] Anketler: beş soru tipi, gerekli yanıtlar/boşluk metni, çift gönderim, daha önce gönderilmiş, 403/404/500 ve bağlantı kesilmesi; sınıf dışı ankete doğrudan erişim.
- [ ] Duyurular: öğrencinin hedeflenen duyuruları; yönetici/öğretmen yazma/silme araçlarının görünmemesi ve API'de engellenmesi; hata/boş/retry/print.
- [ ] Ayarlar: dört sekme ve query param/back/forward; profil salt okunur alanlar/veli verisi; bildirim silme/okundu/ses/pagination/hata; işlem geçmişi tarih/pagination/hata; parola doğrulama/başarı/hata.
- [ ] Ortak başlık: tema, bildirim popover, mutasyon hataları, profil/çıkış; mobil menü kapanışı, Escape, odak kapanı ve odak dönüşü.
- [ ] Masaüstü ve 375px mobil: yatay taşma, tablo kaydırma, uzun metin, koyu tema, klavye ile bütün eylemler, görünür focus, programatik kontrol isimleri/seçili durum ve hata duyuruları.

## Sınırlar ve kayıt ilkesi

Bu envanter ürün dosyalarını veya testleri değiştirmez. Kullanıcının mevcut `client/src/lib/api.ts` ve `client/src/pages/server-setup.tsx` değişiklikleri bu görevde korunur. Çalıştırılmayan alan `doğrulanmadı`, kaynak incelemesi `kaynak bulgusu`, yalnız test/gerçek etkileşimle doğrulanan alan `doğrulandı` olarak kaydedilmelidir. Statik görünümden tüm panel için “çalışıyor” sonucu çıkarılmaz.
