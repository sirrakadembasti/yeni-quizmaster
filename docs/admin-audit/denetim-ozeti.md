# Yönetici paneli denetimi — 30 Eylül 2026

> **Tarihsel denetim kaydı.** Aşağıdaki envanter, bulgular, açık iş ifadeleri ve test sayıları 30 Eylül'deki ilk denetim/önceki onarım paketlerini anlatır; güncel çalışma ağacının durumunu göstermez. 1 Ekim kalan onarımlarının kapsamı ve doğrulama durumu [güncel doğrulama kaydında](./remaining-repairs-verification.md), kabul edilen davranışlar [onarım sözleşmelerinde](./repair-contracts.md) bulunur. Öğretmen paneli denetimi henüz başlamadı.

Bu rapor yalnız yönetici hesabıyla açılan sayfaları kapsar. Ayrıntılı yeniden üretim, beklenen/gerçek davranış, etki, öncelik, kod kanıtı, çözüm ve kabul ölçütleri [sistem/ayarlar](./inventory-settings.md), [kişi/sınıf](./people.md) ve [sınav/rapor](./quizzes.md) raporlarındadır. Öğrenci, öğretmen ve veli panelleri ayrıca denetlenmedi.

**Düzeltme notu:** Bu belgedeki 34/7 tarayıcı sonucu ilk denetimin temel durumudur. İlk pakette PE-01 ve Q01/Q02; ikinci pakette PE-02, Q03/Q04/Q05 ve düzenleyici için Q06 düzeltildi. Hedefli API, gerçek bileşen ve Chromium regresyonları alt raporlarda belirtilir. Diğer bulgular açık kalır. Aşağıdaki öncelik listesi ilk denetimin tamamını gösterir; 34/7 güncel kodun toplu test sonucu değildir.

İkinci paketin komutları, test sonuçları, ortam kısıtları ve o tarihte kalan işler [tarihsel doğrulama kaydındadır](./repair-verification.md). Kalan onarımlar için kesinleşen güncel kanıt: istemci 19 dosyada **117/117** test geçti. Sunucu thread koşusu Prisma native Tokio paniğiyle kesildi; ayrı süreçlerle tekrarında 31 dosyada 189/189 test geçti. Kritik Chromium regresyonu 10/10 geçti. Üretim arayüzünde toplu koşu 53/55; iki test hazırlığı hatası düzeltildikten sonra hedefli tekrar 4/4 geçti. 55 benzersiz kontrol hedefli tekrarlarla doğrulandı. Güncel kanıt ve sınırlar bağlantılı rapordadır.

## Ortam ve kanıt sınırı

İnceleme README, rota kaydı, kenar menüsü, API/Prisma katmanı ve mevcut Vitest/Playwright altyapısıyla yapıldı. Test sunucusu [izole başlatıcı](../../server/tests/admin-audit-server.ts) ile geçici SQLite, ayrı 5510/5511 portları ve sahte kullanıcı/sınıf/sınav/sonuç/duyuru kayıtları kullandı. Gerçek `server/data/quiz.db` üzerinde değişiklik yapılmadı. Önceden var olan `client/src/lib/api.ts` ve `client/src/pages/server-setup.tsx` çalışma alanı düzenlemelerine dokunulmadı.

API: [kişi testleri](../../server/tests/api/admin-audit-people.test.ts) 8/8, [sınav testleri](../../server/tests/api/admin-audit-quizzes.test.ts) 5/5 geçti. Gerçek React bileşenleriyle [soru düzenleyici testleri](../../client/src/test/admin-audit-question-editor.test.tsx) 4/4 geçti ve Q01/Q02 hatalarını yeniden üretti.

İlk tarayıcı koşusu [ham sonuç](./results-route-initial.json): 31 kontrolden 24 geçti, 7 başarısız oldu. İkisi testin yanlış API seçimi/yanıt biçiminden kaynaklandı; [düzeltilmiş iki hedefli test](./results.json) geçti. Beş gerçek başarısızlık: profil adının oturumda eski kalması, sonuç filtresinin öğretmen sınavını göstermemesi, duyuru GET 500'ün boş veri gibi görünmesi, geçersiz ayar sekmesinin boş panel açması ve mobil menünün Escape ile kapanmaması. [İlk kişi/sistem akışında](./results-flows-initial.json) 10 kontrolden 5'i geçti; öğretmen atama kaybı ve geçersiz dağıtım adresi gerçek hatalar, diğer üç başarısızlık test/ortam beklentisiydi. [Hedefli tekrar](./results-flows-targeted.json) kullanıcı CRUD ve dağıtım ayarının kaydını doğruladı, geçersiz adresin 500 ve görünmeyen bildirim üretmesini yeniden doğruladı. [Son sınıf CRUD tekrarı](./results-flows.json) geçti. Böylece 41 benzersiz tarayıcı kontrolünün hedefli tekrarlarla düzeltilmiş sonucu **34 geçti / 7 beklenen ürün hatası**dır; bu toplam tek bir toplu koşu sonucu değildir.

23 doğrudan rota için yenileme ve 390 px görünüm kontrol edildi. Yakalanan JavaScript sayfa hatası ve belge düzeyinde yatay taşma yoktu. İlk anonim `/auth/me` 401 beklenen oturum kontrolüdür; harici Google Fonts isteğinde tek ağ başarısızlığı görüldü. [Ekran görüntüleri ve rota JSON'ları](./evidence/) mevcuttur. Rota kabuğu açılışı içerik/CRUD başarısı sayılmaz: `/results` ve `/admin/classes/:id` görüntülerinin bir kısmı yükleme durumunda alındı. `/quizzes/:id` soru sekmesinin veriler yüklendikten sonraki görünümü ayrıca [gerçek tarayıcıda kaydedildi](./evidence/live-edit-question-loaded.png). Ekran okuyucu, gerçek yazdırma çıktısı ve eksiksiz klavye tab sırası denenmedi.

## Sayfa ve sekme kontrol listesi

**G** rota+yenileme+mobil kabuk, **S** sekme geçişi, **İ** işlem/API/bileşen doğrulaması, **H** yeniden üretilen hata, **B** henüz sınanmayan işlem. Ana menü 15 bağlantıdır; 8 ek yönetici erişimli ayrıntı rotası vardır.

| Sayfa ve sekme | Durum | Kontrol / bulgu |
|---|---|---|
| Dashboard `/` | G | KPI/grafik rakamlarının tüm kombinasyonları B; karma sınav+anket sayım adı iyileştirmesi Q13. |
| Sınav Yönetimi `/admin-quizzes` | G | Arama/sayfalama kaynak incelendi; son sayfa silme Q10, hata durumu Q09, arşiv etiketi Q12. Gerçek silme B. |
| Sınavlar `/quizzes` | G | Önizleme/düzenleme erişimi, silme gerekçesi Q07; silme ve filtre sınırları B. |
| Sınıf İstatistikleri `/statistics` | G | KPI ağırlığı Q11; tarih sınırları, CSV ve yazdırma B. |
| Sınav Sonuçları `/results` | G,H | Öğretmen sınavı seçimde yok Q05; devam eden sonuç 0 puan sayılıyor Q04. |
| Anket Yönetimi `/survey-results`: Sonuçlar, Anket Oluştur | G,S,İ,H | Tür seçimi geri düşüyor Q01; rapor karşılaştırma/CSV B. |
| Öğrenciler `/students` | G,İ | Kayıt ve otomatik numara tarayıcıda geçti; cache PE02, CSV/yazdırma B. |
| Öğretmenler `/teachers` | G,İ,H | Seçili ders/sınıf kaybolması PE01 API ve tarayıcıda doğrulandı. |
| Veli Eşleştirme `/guardian-management` | G,İ | Bağla/kaldır/reload tarayıcıda geçti; hata geri bildirimi PE06. |
| Sınıflar `/classlist` | G | Eski cache PE02; arama/detay/CSV/yazdırma tamamı B. |
| Yönetim `/management`: Dersler, Sınıflar, Kullanıcılar, Loglar | G,S,İ | Ders, sınıf ve kullanıcı ekle/düzenle/sil/iptal+reload geçti. Dört log alt görünümü ve beş kullanıcı rol sekmesi açıldı; log sayfalama INV02. |
| Arşiv `/archive`: Sınav Arşivi, Sınıf Atlatma | G,S,İ | Liste 20'de kesiliyor INV03; iki yazma atomik değil INV04; aday sayısı farklı INV05. Arşiv batch B, izole terfi/mezuniyet tarayıcıda geçti. |
| Sunucu Durumu `/server-setup` | G,İ,H | Hibrit terminal+web kurulum akışı kaynak ve eski 14 kurulum testiyle incelendi; taze kurulum E2E B. Konfigürasyon kaydet/yenile geçti; geçersiz URL 500 ve görünmeyen hata INV09/INV13. |
| Duyurular `/announcements` | G,İ,H | Ekle/sil/yenile geçti; GET 500 boş veri sayılıyor INV07, silme koruması INV06. |
| Ayarlar `/settings`: Profil, Bildirimler, İşlem Geçmişi, Güvenlik | G,S,İ,H | Profil API'ye kaydedildi ama başlık eski kaldı INV01. Geçersiz tab boş panel; işlem geçmişi ilk 50 INV10. Parola/bildirim dolu hata akışları B. |
| Ek rotalar: `/create-quiz`, `/quizzes/:id`, `/teachers/:id`, `/classes/:id`, `/admin/classes/:id`, `/student/result/:id`, `/student/quiz/:id`, `/student/results` | G | Soru bileşenleri Q01/Q02 doğrulandı. Ayrıntı verilerinin tüm yükleme/eylem durumları henüz B. |

## Öncelik ve yapılacak değişiklikler

**Yüksek:** Q01 soru türü değişiminin ezilmesi; Q02 doğru cevap kayması; Q03 kısmi sınav kaydı; Q04 tamamlanmamış sonucun sıfır sayılması; PE01 öğretmen atama kaybı; PE02 bayat cache; PE05 kaldırılan sorumlu öğretmenin eski erişimi; INV04 yarım kalabilen arşiv. Q03 ve INV04 için hata enjeksiyonlu transaction testi ayrıca gereklidir.

**Orta:** Q05–Q12, Q14; PE03/PE04/PE06/PE07; INV01–INV03 ve INV05–INV13. Geçersiz ayar sekmesi, mobil Escape ve bozuk dağıtım adresi tarayıcıda doğrulandı. **Düşük iyileştirme:** Q13 karma içerik KPI adlandırması. **Yeni ürün seçeneği:** veli hedefli duyuru; ihtiyaç doğrulanmadan hata sayılmadı.

| Sayfa grubu | İlk çözüm ve kabul ölçütü özeti | Fayda / efor |
|---|---|---|
| Sınav/anket oluşturma | Fonksiyonel soru state, doğru cevap kimliği, atomik ayar+soru kaydı; değiştir/sil/yeniden dene testi | Çok yüksek / yüksek |
| Öğretmen-sınıf-öğrenci-veli | Atamaları transaction/rol doğrulamasıyla sakla; eski erişimi kaldır; ortak query key ve ilişkisel invalidasyon | Çok yüksek / orta-yüksek |
| Sonuç ve istatistik | Yalnız tamamlanan sonuçları puanla; yönetici seçicisinde tüm sınavlar; katılım oranını kişi sayısına ağırlıkla | Yüksek / orta |
| Arşiv | Tek transaction, UI ile eşleşen sunucu aday sayısı, geçmiş sayfalaması | Yüksek / orta |
| Yönetim/Ayarlar | Başarılı profil sonucunu AuthContext'e uygula; logları toplam sayıyla sunucu üzerinden sayfala | Yüksek / orta |
| Sunucu/Duyurular | Görünür hata/başarı toast'ı; yükleme-hata-boş ayrımı; kaydedilmemiş politika ile temizlemeyi engelle; silmede onay | Orta-yüksek / orta |
| Tüm sayfalar | Anlamlı kontrol adları, klavye odak/menü kapatma, mobil tabloda kaydırma ipucu ve hata yeniden deneme | Orta / orta |

Her kod değişikliğinin ilk kabul koşulu Q/PE/INV numaralı alt rapor maddesindedir. İkinci paket atomik kayıt, ilişkisel cache ve sonuç hesaplaması/seçicisini kapsar. PE-05 için eski genel öğretmen bağının kaldırılması politikası artık [onarım sözleşmesinde](./repair-contracts.md) belirlenmiştir; INV04 arşiv atomikliği de kalan onarım kapsamındadır. Uygulanan değişikliklerin güncel doğrulama sınırları [ayrı kayıtta](./remaining-repairs-verification.md) tutulur.

## Tekrar çalıştırma

Üretim veritabanına yöneltmeden önce [izole sunucuyu](../../server/tests/admin-audit-server.ts) (`pnpm --filter quiz-master-server exec tsx tests/admin-audit-server.ts`) ve [izole Vite yapılandırmasını](../../client/vite.admin-audit.config.ts) (`pnpm --filter quiz-master-client exec vite --config vite.admin-audit.config.ts`) ayrı terminallerde başlatın. Sunucu her başlangıçta `server/data/quizmaster-test-admin-audit-*` altında yeni SQLite oluşturur ve `runtime.json` yazar. Chromium için `PLAYWRIGHT_BROWSERS_PATH` kurulu tarayıcı dizinine ayarlanmalıdır. [Playwright yapılandırması](../../playwright.admin-audit.config.ts) ile `pnpm exec playwright test --config playwright.admin-audit.config.ts` tüm rota ve akış testlerini seçer; doğrulanmış kusurları beklenen doğru davranışla sınayan assertion’ların bir kısmı kalan açık bulgular nedeniyle başarısız kalabilir. API ve bileşen testlerinin komutları alt raporlarda verilmiştir.
