# Linux kurulumu ve öğretmen denetimi planı

> **Tarihsel plan/tasarım kaydı.** 14 Ekim 2026 belge kontrolü: gelecek zaman, açık kutular ve ara sonuçlar özgün çalışma sırasını korur; güncel yapılacaklar olarak okunmamalıdır. [Sonuç ve kapsam kaydı](../../teacher-audit/defect-repairs.md) esas alınır.

> Ajan olarak çalışanlar için: Gözetim altındaki alt ajanlar ve kanıt kontrol noktalarıyla uygula.

**Amaç:** Gerçek Linux/WSL SH hibrit kurulumunu doğrulamak, ardından izole verilerle bütün öğretmen sayfalarını ve sekmelerini denetlemek.

**Mimari:** Ubuntu 22.04 WSL2, yerel Node 22 ve pnpm 9.15.1 çalıştırır. Yalnız kaynak içeren bir Linux hazırlık kopyası mevcut gerçek sihirbaz/tarayıcı test düzeneğini sağlar; taze test ortamları bağımsız bağımlılıklara, SQLite verilerine ve portlara sahiptir. Linux temizliği yalnız üst PID'yi değil, gözlemlenen süreç kimliklerini ve alt süreçleri gerektirir. Öğretmen denetimi Linux kabul sonucu kaydedildikten sonra başlar.

**Kısıtlar:** Üretim verilerini ve özgün api.ts/server-setup.tsx düzenlemelerini koru. Windows yerel bağımlılıklarını yeniden kullanma. Çalıştırılmayan kontrolleri geçti sayma. Toplu süreç sonlandırması veya sistem WSL yapılandırması değişikliği yapma.

- [x] WSL ve kaynak/test önkoşullarını belirle: Ubuntu 22.04 mevcut; Linux Node eksik ve devralınan pnpm yalnız Windows'a ait.
- [x] İzole Linux Node/pnpm ve Chromium araçlarını hazırla; Node 22.23.2 sağlama toplamı, yerel linux/x64, pnpm 9.15.1 ve Linux Chromium indirmesi doğrulandı.
- [x] Gerçek Linux alt süreç temizliği regresyonunu ekle ve çalıştır: yerel RED 0/9 → GREEN 9/9; genişletilmiş süreç/port paketi, atlanan test olmadan 13/13. Windows üstveri/tanıtıcı regresyonları 10/10.
- [x] Gerçek kurulum.sh kurulumu → web sihirbazı → migration/yönetici/kalıcılık/yeniden giriş → üretim API'si ve tarayıcı girişi akışını çalıştır: yerel tam kabul 1/1.
- [x] Taze kuruluma ait süreçlerin ve test ortamı portlarının kapandığını, korunan kaynak özetlerinin değişmediğini doğrula; hassas verilerden arındırılmış sonuçları/ekran görüntülerini sakla.
- [x] Kurulum/denetim belgelerini ve Graphify'ı güncelle: 2317 düğüm/6260 kenar/122 topluluk; tanılama ve gerçek Chromium görsel kontrolü geçti.
- [x] Öğretmen rotalarını, sekmelerini ve işlemlerini belirle; sayfa bazlı 29 satırlık takip listesi oluştur.
- [x] İzole öğretmen işlev/API/E2E ve masaüstü/mobil/klavye kontrollerini çalıştır; konsol/ağ ve boş/hata/yükleniyor durumlarını kaydet. Senaryo bazlı kanıtlar ve başarısız gruplar korundu; bu, her çeşidin geçtiği anlamına gelmez.
- [x] Doğrulanan hataları kullanıcı deneyimi/yeni özellik önerilerinden ayrı; yeniden üretim, kanıt, öncelik ve kabul ölçütleriyle raporla.
- [x] Beş tür anketin düzenleme/yeniden açma kabulü, 4 Ekim'de yerel Windows Chromium ile kapandı: beş içeriğin tamamı düzenlendi, API kimlikleri/türleri korundu ve ikinci yenileme/yeniden açma doğrulandı. Önceki WSL kullanılamazlığı tarihsel kanıt olarak korundu; bkz. teacher-audit/defect-repairs.md.
- [x] Gizlilik/fark/kaynak korunmasını doğrula ve denetim commit'i için yalnız bu çalışmaya ait dosyaları hazırla; kullanıcının istemci değişiklikleri hazırlama alanına alınmadı.
