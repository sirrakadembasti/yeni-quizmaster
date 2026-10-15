# Öğretmen bulgularının kapanışı — 4 Ekim 2026

T-F01 ve T-F02 düzeltildi. Beş soru tipinin anket düzenleme/yeniden açma kabulü tamamlandı. Bu sonuç, öğretmen panelinin bütün işlem varyantlarının veya ayrı UX önerilerinin tamamlandığı anlamına gelmez.

| Bulgu/kontrol | Değişiklik ve kabul kanıtı | Sonuç |
|---|---|---|
| T-F01 doğru cevap sayısı | `results.tsx` rapor satırı tipli `StudentResult.correctAnswersCount` okur; null/undefined için eski alan desteği sıfırı korur, olmayan veri `—` olur. Gerçek API'den 14 satır, `0 / 1` ve `1 / 1`; sayfa yenileme, öğrenci filtresi ve gerçek XLSX doğrulandı. | KAPANDI |
| T-F02 bekleyen sıfırlama isteği | `reset-password.tsx` isteği başlatmadan yüklenme ve senkron ref korumasını kurar; `finally` ikisini kaldırır. Bekleyen gerçek istekte buton/yükleme göstergesi, iki ek form gönderiminin engellenmesi, gerçek geçersiz token400 ve veri korunarak ikinci deneme400 doğrulandı. | KAPANDI |
| Beş tip anket düzenleme | Tek seçim, çoklu seçim, açık uçlu, derecelendirme ve Likert gerçek GUI'de oluşturuldu/yayınlandı. Yeniden açıldı; beş metin, üç seçenek grubu ve derecelendirme8→9 değiştirildi. API aynı soru ID/tiplerini korudu. Kaydetme ve ikinci sayfa yenileme/yeniden açma sonrasında GUI değerleri doğrulandı; yalnız oluşturulan anket silindi. Anket ürün kodunda hata bulunmadı ve değişiklik gerekmedi. | GEÇTİ |

## Taze doğrulama

- [Son gerçek Chromium kohortu](results-fix-final-4.json): **4/4 geçti**, yeniden deneme0, gerçek API/oturum/CSRF ve izole SQLite kullanıldı.
- [Kalıcı Windows başlatıcı kaydı](runner-fix-final-4.json): yerel Node22.23.2, API5530/UI5531, yalnız sahipli canlı çocuk ağaçları kapatıldı; iki port portu bağlama+kapatma ile boş doğrulandı.
- Son başlatıcı log dizini/temizlik raporlaması düzeltmesinden sonra [gerçek sıfırlama tekrarında](results-fix-runner-final.json) **1/1** ve [süreç/port temizliği](runner-fix-runner-final.json) geçti. Dolu port koruması gerçek portu tutan süreç ile **RED0/1→GREEN1/1**: sunucu başlatmadan reddedildi, portu tutan süreç ve gerçek DB korunarak temizlik durumunun başarısız olduğu doğru raporlandı. [Beklenen bloklama kaydı](evidence/defect-repairs/windows-port-guard.json).
- [Birim RED→GREEN](evidence/defect-repairs/component-regression.json): ilk doğru fixture ile **7 geçti/2 başarısız**; iki küçük ürün düzeltmesinden sonra **9/9 geçti**, mevcut yedi yönetici rapor testi de korunuyor. İlk test hazırlığında öğretmen sahiplik alanının eksik olması ayrıca düzeltildi; o hazırlık hatası ürün RED kanıtı sayılmadı.
- Ön yüz `pnpm --filter quiz-master-client build` çıkış0. Mevcut büyük paket ve statik/dinamik içe aktarım uyarıları sürüyor; bu çalışmanın konusu değiller.
- `pnpm --filter quiz-master-client type-check` çıkış0. Testing Library testindeki desteklenmeyen `exact` seçeneği kaldırıldı; kullanıcı davranışı değişmedi. Son birim koşusu tek worker ve15 saniye bütçeyle **9/9** geçti. Eşzamanlı koşudaki5 saniye zaman aşımı8/1 sonucu da [son doğrulama kaydında](evidence/defect-repairs/final-verification.json) korunur; doğrulama/ürün hatası veya kaynak değişimi olarak sayılmaz.
- [Anket aşama kaydı](evidence/defect-repairs/survey-editor-phases.json), [bekleme/yeniden deneme](evidence/defect-repairs/reset-pending-retry.json), [XLSX/sayfa yenileme/filtreden çıktı](evidence/defect-repairs/report-outputs.json).
- [PDF bağımsız metin ve görüntüleme kontrolü](evidence/defect-repairs/pdf-verification.json): tam raporda **1 adet0/1 +13 adet1/1**, filtreli raporda **1 adet0/1 +0 adet1/1**; yabancı veri yok. İki PDF görüntüsü görsel olarak da incelendi: [tam](evidence/defect-repairs/report-all-page-1.png), [filtreli](evidence/defect-repairs/report-zero-page-1.png). Gerçek XLSX dosyaları [tam](evidence/defect-repairs/report-all.xlsx) ve [filtreli](evidence/defect-repairs/report-zero.xlsx).

## Ortam ve tekrar çalıştırma

WSL sandbox erişim engeli sonrasında yetkili salt okunur liste probu tekrar15 saniyede yanıt vermedi; yalnız başlatılan prob kapatıldı. WSL servisleri, dağıtımları ve ayarları değiştirilmedi. Bu öğretmen kabulü **yerel Windows Chromium** ile tamamlandı; önceki başarılı Linux taze kurulum kabulü ayrı kanıttır, WSL erişim sorununun giderildiği iddia edilmez.

İki Windows test başlangıcı 120 saniyede durdu: [ilk](runner-fix-browser-red.json), [çıktı başlangıcı](runner-fix-outputs.json). Her ikisinde süreç/port temizliği doğrulandı. Test başlatıcısında API başlangıç bütçesi300 saniyeye çıkarıldı ve yalnız test süreçlerinin Prisma güncelleme bildirimi kapatıldı. [Ara çıktı denemesi](results-fix-outputs-retry.json) testin Excel'i yanlış sekmede araması nedeniyle başarısız oldu; ürün akışı değiştirilmeden test düzeltildi. Son dört test ayrı taze fixture ile geçti. Önceki başarısız sonuçlar saklandı; sonuçlar bütün eski kohortların geçmesi şeklinde toplanmaz.

Windows'ta depoların mevcut yerel bağımlılıkları ve Playwright Chromium hazırken proje kökünden:

```powershell
$env:TEACHER_FIX_RUN='fix-final-4'
node scripts/teacher-audit-windows-runner.mjs teacher-dashboard-depth-audit.spec.ts teacher-edge-audit.spec.ts teacher-editor-depth-audit.spec.ts teacher-defect-output-audit.spec.ts --grep "correct-answer|pending request|survey GUI|repair persists"
pnpm --filter quiz-master-client exec vitest run src/test/admin-results.test.tsx src/test/reset-password-pending.test.tsx --maxWorkers=1 --testTimeout=15000
pnpm --filter quiz-master-client type-check
```

Linux için önceki `scripts/teacher-audit-runner.mjs` kullanılır. Başlatıcılar gerçek veriyi kullanmaz; fixture koruma'ı ayrı veritabanı, oturum, yükleme ve5530/5531 portlarını zorunlu kılar. Ham kayıt, token, çerez, depolama, ortam değişkenleri veya DB paylaşılmaz. Test dosyaları sonraki koşuda kanıtları üzerine yazabileceğinden sonuç JSON/aşama/PDF kopyaları ayrı saklanmalıdır.

Gerçek SMTP ile geçerli/süresi dolmuş sıfırlama bağlantısı teslimi, fiziksel yazıcı, canlı AI/Socket, tüm filtre/tip dönüşümü/derecelendirme sınırı varyantları ve T-U01–T-U04 UX önerileri bu kapanışta tamamlandı sayılmadı. Kullanıcının önceki `api.ts` ve `server-setup.tsx` değişiklikleri korundu ve commit kapsamı dışında tutuldu.
