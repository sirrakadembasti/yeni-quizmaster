# Öğretmen hatalarını onarma planı

> **Tarihsel plan/tasarım kaydı.** 14 Ekim 2026 belge kontrolü: gelecek zaman, açık kutular ve ara sonuçlar özgün çalışma sırasını korur; güncel yapılacaklar olarak okunmamalıdır. [Sonuç ve kapsam kaydı](../../teacher-audit/defect-repairs.md) esas alınır.

**Amaç:** Onaylanan iki işlevsel bulguyu kapatmak ve izole verilerle beş tür anketin düzenleme/yeniden açma kabulünü tamamlamak.

**Tasarım:** Mevcut API ve hibrit kurulumu koru. Raporu API'nin `correctAnswersCount` alanına bağla; sıfır değerini koru. İstekten önce sıfırlama yükleniyor durumunu ayarla ve yinelenen form gönderimlerinin yarışmaması için eşzamanlı bir bekleyen işlem koruması kullan; korumayı `finally` içinde kaldır ve tekrar denemeyi koru. Öğretmen test ortamını ve gerçek Chromium/API akışlarını yeniden kullan. WSL, 15 saniyelik sınırla yoklanır; kullanılamıyorsa WSL'yi yeniden başlatmadan veya işletim sistemi yapılandırmasını değiştirmeden yerel Windows araçlarını kullan.

**Kısıtlar:** Üretim verilerini, mevcut api.ts/server-setup.tsx düzenlemelerini, ilgisiz kullanıcı deneyimi bulgularını, sıfırlama API'sini/parola kurallarını veya anket türü sözleşmelerini değiştirme. Önceki rapor kabul ölçütleri ve kullanıcının bu bulguları çözme talimatı bu uygulamayı yetkilendirir.

- [x] Doğru cevap sıfır/pozitif değerleri ve bekleyen sıfırlama/tekrar deneme için bileşen regresyonlarını genişlet; RED sonucunu gözlemle.
- [x] En küçük rapor/sıfırlama değişikliklerini uygula ve GREEN sonucunu gözlemle.
- [x] Geçici sunucularda gerçek tarayıcı rapor/API/dışa aktarım/yazdırma ve bekleyen sıfırlama/tekrar deneme akışlarını çalıştır.
- [x] Adlandırılmış beş tür anketin arayüzde oluşturma/yayımlama/yeniden açma/düzenleme/yenileme testini çalıştır; ürün hatasını yalnız yeniden üretildiyse teşhis edip düzelt.
- [x] Sahip olunan süreçlerin kapanmasını, test ortamı portlarını ve korunan veritabanı özetini doğrula.
- [x] Bulguları/kontrol listesini/README'yi ve Graphify'ı güncelle; hazırlama alanı ve commit için yalnız bu çalışmanın dosyalarını incele.
