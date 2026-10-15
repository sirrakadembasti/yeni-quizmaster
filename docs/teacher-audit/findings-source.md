# Öğretmen paneli — kaynak ve rota kanıtına dayalı UX notları

3 Ekim 2026. Bu belge kaynak kodunu ve mevcut rota JSON'larını yorumlar; yeni tarayıcı/API/test koşusu içermez. Ana doğrulama raporunun başarı, hata veya tamamlanma durumunu belirlemez. Ürün kodu değiştirilmedi.

## Doğrulanmış iyileştirme

### TU-01 — Sonuç tablosu aramasında kalıcı ve açık alan etiketi eksik (P2)

**Rota:** `/results` → Genel Bakış → Sınav Detayları araması.

**Gerçek durum:** [results.tsx:491](../../client/src/pages/results.tsx#L491) arama alanında `placeholder="Sınav veya ders ara..."` kullanır; yanında bağlı `<label>`, `id`/`htmlFor`, `aria-label` veya `aria-labelledby` bulunmaz. [Input bileşeni](../../client/src/components/ui/input.tsx) etiketi kendiliğinden eklemez; yalnız gelen girdi özelliklerinı iletir. Arama ikonu da alanın işlevini kalıcı metinle anlatmaz.

**Rota kanıtı:** [masaüstü JSON](./evidence/routes/4-desktop.json) ve [mobil JSON](./evidence/routes/4-mobile.json) `inputsWithoutLabel` altında yalnız bu yer tutucu'ı kaydeder. Bu rota kayıtlarında sayfa/konsol/API hatası veya belge genişliğinde taşma görülmemiştir; dolayısıyla buradan çalışma zamanı arama hatası çıkarılamaz.

**Etki:** Kullanıcı yazmaya başlayınca yer tutucu kaybolur; alanın sınav mı ders mi aradığını kalıcı bir etiket üzerinden tekrar okuyamaz. Açık etiketle hedefleme ve sesli kontrol kullanımını da iyileştirmek mümkündür.

**Kesin sınır:** Bu kayıt bir DOM etiket taramasıdır, erişilebilirlik ağacı dökümü değildir. Bazı tarayıcılar yer tutucu metnini erişilebilir ad için yedek davranış olarak kullanır. **“Erişilebilir adı boş” veya “ekran okuyucu alanı hiç okuyamaz” iddiası doğrulanmamıştır.** Gerçek erişilebilir ad ayrıca tarayıcı `ariaSnapshot()`/erişilebilirlik ağacından kontrol edilmelidir. Burada doğrulanan eksiklik kalıcı, açık alan etiketidir.

**Öneri:** Görünür `Sınav veya ders ara` etiketi ve eşleşen `id`/`htmlFor` ekleyin. Yalnız görsel alan kısıtı varsa `sr-only` etiket erişilebilir adı sağlar; kalıcı görsel bağlamı aynı ölçüde çözmez.

**Kabul ölçütü:** Alan yazıldıktan sonra amaç görünür kalır; `getByRole('textbox', { name: 'Sınav veya ders ara' })` tek alan bulur; mevcut arama ve sıfırlama davranışı korunur; masaüstü ve 390 px düzeninde etiket taşmaz.

## Kusur olarak sınıflandırılmayan rota sayacı

`/create-quiz` için [masaüstü](./evidence/routes/2-desktop.json)/[mobil](./evidence/routes/2-mobile.json), `/quizzes/teacher-audit-draft` için [masaüstü](./evidence/routes/3-desktop.json)/[mobil](./evidence/routes/3-mobile.json) `unnamedButtons: 1` bildirir. Bu değer tek başına adsız etkileşim kanıtı değildir.

[teacher-routes-audit.spec.ts](../../tests-e2e/teacher-routes-audit.spec.ts) sayacı `button.textContent`, `aria-label`, `aria-labelledby`, `title` alanlarına bakar; yerel `<label for>` ilişkisini, rolü ve görünürlüğü değerlendirmez. [QuizSettings.tsx](../../client/src/components/quiz/QuizSettings.tsx) sınıf ataması için boş metinli Radix checkbox'a `id="class-…"` ve aynı ID'ye bağlı sınıf adı etiketi verir. [checkbox.tsx](../../client/src/components/ui/checkbox.tsx) bu özellikleri CheckboxPrimitive.Root'a iletir. [teacher-quizzes-audit.spec.ts](../../tests-e2e/teacher-quizzes-audit.spec.ts) aynı kontrolü erişilebilir checkbox adı `Teacher Audit 7A` ile hedefler.

**Karar:** Sayacın sınıf checkbox'ını yanlış pozitif sayması kaynakla tutarlı bir açıklamadır; JSON hangi elementi saydığını saklamadığından element kimliği kesinleştirilmemiştir. Checkbox için ürün kusuru açılmadı. Sonraki incelemede boş adlı gerçek `button` rol'leri erişilebilirlik ağacı üzerinden sayılmalı; checkbox/switch gibi farklı roller ve HTML etiket ilişkileri değerlendirilmelidir. Kaynakta etiket bulunması, tam ekran okuyucu oturumu testi yerine geçmez.

## İsteğe bağlı özellik önerileri

Aşağıdakiler hata değildir; işlevsel denetimin kabul ölçütü olarak kullanılmamalı ve bu incelemede uygulanmamıştır. Öncelik öğretmen rolüyle gerçek iş akışlarını iyileştirmeye göredir. Efor: **Küçük** bir sayfa/yerel durum; **Orta** birkaç bileşen ve kalıcılık; **Büyük** yeni arka uç modeli/iş akışı. Bunlar göreli tahminlerdir.

| Menü sayfası | İsteğe bağlı özellik | Öğretmene faydası | Efor |
|---|---|---|---|
| Gösterge Paneli `/` | Yaklaşan sınavlar ve tamamlanmayı bekleyen işler için sınıf bazlı kısa liste | KPI'dan günlük yapılacak işe daha hızlı geçiş | Orta; yayın takvimi yoksa yeni veri modeliyle Büyük |
| Sınavlarım `/quizzes` | Kendi sınavını soru ve ayarlarıyla yeni taslak olarak çoğaltma | Tekrarlayan değerlendirmelerde yeniden veri girişini azaltır | Orta; sahiplik, soru ID ve sınıf atama doğrulaması gerekir |
| Sınıf İstatistikleri `/statistics` | Aynı sınıfın önceki eş uzunlukta dönemle karşılaştırması | Değişimin yönünü yalnız güncel ortalamadan daha anlaşılır gösterir | Orta; API dönem hesapları ve tarih sınırları |
| Sınav Sonuçları `/results` | Kullanıcıya ait kaydedilebilir filtreler | Sık kullanılan sınıf/ders/öğrenci raporuna tekrar ulaşmayı kolaylaştırır | Orta; kullanıcıya bağlı tercih kalıcılığı |
| Anket Yönetimi `/survey-results` | Önizlemeli öğretmen anket şablonları ve taslak kopyalama | Soru türleri ve ölçekleri tekrar kurmayı azaltır | Orta; yeni ID, soru yapılandırması ve hedef sınıf kontrolü |
| Öğrenciler `/students` | Liste içinde öğrenci başına son tamamlanan sınav ve rapor bağlantısı | Öğrenci analizine girilecek kişiyi seçmeyi kolaylaştırır | Orta; yetkili sonuçlar için toplu sorgu, N+1 sorgudan kaçınma |
| Sınıflarım `/classlist` | Sorumlu olduğu sınıflar ile dersine girdiği sınıfları görünür filtreyle ayırma | Öğretmenin farklı sorumluluklarını listede daha hızlı ayırt etmesini sağlar | Küçük; mevcut atama verisi kullanılır |
| Duyurular `/announcements` | Göndermeden önce hedef sınıf ve alıcı sayısını gösteren önizleme | Yanlış sınıfa gönderimi önlemeye yardım eder | Orta; sunucu tarafındaki yetkili hedef hesabı |
| Ayarlar `/settings` | İşlem geçmişinde işlem türü ve tarih aralığı filtresi | Öğretmenin yaptığı değişikliği bulmasını kolaylaştırır | Orta; kullanıcı kapsamı korunarak API filtreleri ve sayfalama |

Önce TU-01 gibi küçük erişilebilirlik/bağlam iyileştirmeleri değerlendirilebilir. Özellikler için mevcut öğretmen kapsamı korunmalı; yeni kullanıcı/sınıf/rol yönetim yetkisi bu önerilerden çıkarılmamalıdır.
