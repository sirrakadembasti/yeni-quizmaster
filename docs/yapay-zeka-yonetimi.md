# QuizMaster Yapay Zeka (AI) Yönetimi ve Öğretmen Kullanım Takibi

Yönetici menüsündeki **AI Yönetimi** (`/ai-management`) kurulumun ortak yapay zeka sağlayıcı ve model ayarlarını yönetir. Öğretmen, öğrenci ve veli bu sayfaya veya yönetim API'sine erişemez.

Sayfa iki sekmeden oluşur: **AI Profil Yönetimi** ve **Öğretmen AI Kullanımı**. Profil formundaki kaydedilmemiş alanlar sekme geçişinde korunur.

## 1. AI Profil Yönetimi

1. **Profil Ekle** ile görünen ad, sağlayıcı, HTTPS API adresi, model kimliği ve API anahtarını girin. Aynı sağlayıcı için birden fazla model profili eklenebilir.
2. Yanıt süresini 5–300 saniye, çıktı bütçesini 256–32768 token arasında seçin. Düşünme (reasoning) seçimi destekleyen modellerde uygulanır. Model listesini kayıtlı profilden alabilir veya kimliğini elle girebilirsiniz.
3. Kaydedilen profil başlangıçta kapalıdır. **Bağlantı testi** başarılı olduktan sonra **Öğretmenlere aç** seçilebilir. **Örnek soru testi** ayrıca soru biçimi ve cevap tutarlılığını doğrular; öğretmenin içerik incelemesinin yerine geçmez.
4. Birden fazla modeli açık tutabilirsiniz. İsteğe bağlı varsayılan seçim öğretmene başlangıç seçimi sağlar. Varsayılanı kapatmak veya silmek başka modele otomatik geçiş yapmaz.

Öğretmen sınav/anket oluştururken mevcut **AI ile Soruları Üret** alanında yalnız açık modellerden birini seçer. URL, anahtar veya özel model ayarlarını değiştiremez. Konu, soru sayısı, zorluk, üretilen soruların düzenlenmesi ve sınava eklenmesi mevcut akışta kalır. Öğrenci ve veli üretim API'sine erişemez.

Profil düzenlenince erişimi kapanır, eski testleri ve varsayılan seçimi temizlenir. **Kayıtlı anahtar korunacak** durumu ve maskeli alan mevcut anahtarı açıkça belirtir. **Anahtarı değiştir** seçilmeden anahtar alanı düzenlenmez; kayıtlı değer tarayıcıya gönderilmez; sağlayıcı veya adres değişince yeni anahtar zorunludur. Çakışan düzenleme reddedilir; formdaki girdiler korunur. Sunucuda eski `GEMINI_API_KEY` varsa yönetici açık aktarım işlemiyle resmî Google profiline alabilir; model kimliğini belirtip test etmelidir. Otomatik aktarım yapılmaz.

## 2. Sağlayıcı, Model ve Test Ayarları

Xiaomi MiMo için **Hizmet / bölge** alanından kullandıkça öde (PAYG) veya Token Plan (CN/SGP/AMS) seçilir. Token Plan adresini Xiaomi konsolundaki adresle eşleştirin. PAYG anahtarı ile Token Plan adresi veya tersi kaydedilirken/çağrılırken açık hata verilir; anahtar başka hizmete otomatik taşınmaz. Özel adreslerde bu anahtar türü tahmini uygulanmaz.

Model listesini **kayıtlı** adres ve anahtarla alın. Adres veya anahtarı değiştirdiyseniz önce kaydedip düzenlemeyi yeniden açın. Listeden seçim ve elle model kimliği girişi birlikte desteklenir. Google listesi `generateContent` destekleyen modellerle sınırlanır; Google ve Anthropic sayfaları toplam süre ve 500 model üst sınırıyla alınır. Modelin listelenmesi hesap erişimi veya soru uyumluluğu garantisi değildir; profil testini çalıştırın. Liste API'si sunmayan sağlayıcılarda kimlik elle girilebilir. Özel sağlayıcı seçeneği OpenAI uyumlu uçlar içindir.

**Bağlantı testi** kayıtlı üretim bütçesinden bağımsız olarak en çok 20 saniye ve 512 token kullanır; MiMo düşünmesi bu kısa testte kapatılır. **Örnek soru** ve öğretmen üretimi kayıtlı süre/token/düşünme ayarlarını kullanır. Belgelenmiş MiMo modellerinin soru üretiminde JSON modu kullanılır; soru sayısı, tip ve cevap doğrulaması yine zorunludur. Hatalı yanıt sınava eklenmez; otomatik tekrar ücretli çağrı yapılmaz.

**Yanıt bekleme sınırı** saniyedir (5–300); karttaki milisaniye (ms) değeri son testin tamamlanma süresidir. **Gelişmiş yanıt ayarları** içindeki token değeri yanıtın üst sınırıdır; soru sayısı veya gerçek token tüketimi değildir. MiMo'da düşünme de bu bütçeye dahildir. Yeni profilde 120 saniye / 8192 token başlangıç değeridir.

Hatalar: `LLM_AUTH` (401, anahtar/hizmet), `LLM_FORBIDDEN` (403, erişim izni), `LLM_BILLING` (402, ödeme/bakiye), `LLM_RATE_LIMIT` (429), ağ, süre aşımı, boş veya kesilmiş yanıt ayrı gösterilir. Test tarihi, revizyon, süre ve güvenli açıklama saklanır; ham sağlayıcı hata gövdesi saklanmaz.

## 3. Öğretmen AI Kullanımı ve Token Takibi

İkinci sekmede her öğretmen üretim isteği ayrı satırdır: üretim anındaki öğretmen, ders, sınav/anket başlığı, profil/model, soru sayısı, gerçek girdi/çıktı tokenları, varsa düşünme tokenı, süre ve sonuç. Tarih, öğretmen, ders, sınav, model ve sonuç filtreleri ile 25/50/100 satırlık sunucu sayfalaması bulunur. Yönetici bağlantı ve örnek soru testleri bu tabloya eklenmez.

Sınav henüz kaydedilmemişse **Taslak**, ders seçilmemişse **Ders seçilmedi** görünür. İçerik kaydedilince aynı öğretmenin ilgili taslak kullanımları sınava bağlanır; yeniden kullanım satırı oluşturulmaz. Sonradan başlık veya model değişmesi eski satırın üretim anındaki bilgilerini değiştirmez. Geçersiz soru yanıtının token tüketimi de raporlanır; hata, iptal veya süre aşımı tüketimsizlik demek değildir. Sağlayıcı bildirmediyse sayı yerine **Bilinmiyor** yazılır.

Toplamlar bilinen sayılardır; eksik token bilgili istek adedi ayrıca gösterilir. Düşünme çıktının alt kalemidir; tekrar toplanmaz. Sağlayıcıya göre önbellek ve düşünme kalemleri normalleştirilir. Token sayıları fiyat veya kalan kota değildir.

**Bir üretim için yanıt üst sınırı (token)** alanının altında örnek hesap vardır: kısa/orta, beş seçenekli soruda varsayımsal 300 token/soru + 200 yapı payı. 10 soru için orta örnek 3200; iki ayrı 10 üretimiyle 20 soru için toplam 6400'dür. Varsayılan üst sınır 8192 **her çağrı** içindir; toplam izin miktarı gerçek tüketim değildir. Aynı sağlayıcı/model, düşünme modu ve 10 soru için en az beş başarılı örnek varsa kullanım sekmesindeki filtrelere göre gözlenen ortalama, örnek sayısı ve gerçek örnek tarih aralığı gösterilir. Tek istekte 10 soru sınırı korunur.

Raporlar mevcut salt okunur bağlantıyı, kısa kullanım kayıtları mevcut yazıcıyı kullanır. Sağlayıcı beklenirken veritabanı işlemi (transaction) açık tutulmaz. Kullanım kayıt hatasında sağlayıcı yeniden çağrılmaz; başarılı sorular korunur ve sunucu uyarı üretir.

## 4. Güvenlik, Şifreleme ve Kurulum

API anahtarları AES-256-GCM ile veritabanında şifreli saklanır; tarayıcıya geri gönderilmez. Şifreleme anahtarı `server/data/ai-encryption.key` dosyasıdır. Dosyayı Git'e eklemeyin veya elle değiştirmeyin. Kaybolursa veya uyumsuzsa AI çağrıları güvenli biçimde reddedilir. Veritabanı ile bu dosyayı birlikte yedekleyin; yeni anahtar üretip eski şifreli kayıtları bozmayın.

Bakım ve yükseltme yedeği anahtar dosyasını içerir. Yerel bakım yedekleme/geri yükleme (`backup`/`restore`) işlemi ayrıca anahtarın profil kayıtlarını çözebildiğini doğrular. `20261015000100_ai_management` ve `20261015000200_ai_usage` migration'ları mevcut tablolara dokunmadan profil, yapılandırma ve kullanım tablolarını ekler. Bakım ve geri dönüş adımları için [Üretim ve Bakım Kılavuzuna](uretim-ve-bakim-kilavuzu.md) bakın.

Sağlayıcı bağlantıları genel internet üzerinde HTTPS gerektirir. Özel ağ, localhost ve kimlik bilgilerini başka adrese taşıyan yönlendirmeler engellenir. Üretim kullanıcı başına 15 dakikada 30, yönetim test/model keşfi 20 istekle ve aynı kullanıcı için tek devam eden AI çağrısıyla sınırlıdır.

## 5. Devreye Alma, Sağlayıcı Testleri ve Doğrulama Özeti (15–16 Ekim 2026)

- **Yükseltme ve Devreye Alma:** Mevcut yerel kurulum doğrulanmış yedekler (`before-ai-management-20261015`, `before-ai-usage-20261016`) alınarak 14 $\rightarrow$ 24 $\rightarrow$ 25 migration'a yükseltildi. Eski tabloların bütünlüğü (`integrity_check=ok`, `foreign_key_check=0`) ve kayıt sayıları korundu.
- **Sağlayıcı ve MiMo Doğrulaması:** Xiaomi MiMo Token Plan Singapur (`https://token-plan-sgp.xiaomimimo.com/v1`, `mimo-v2.6-flash`) ile kısa bağlantı testi (2194 ms) ve JSON modunda 1, 3 ve 10 soruluk üretim testleri başarıyla geçti. 20 soruluk iki aşamalı örnek sınav üretiminde toplam 304 girdi / 1710 çıktı tokenı tüketimi kullanım defterinde (`AIUsage`) doğrulandı. Google model keşfinde 46, MiMo'da 8 üretim destekleyen model listelendi.
- **Hedefli Regresyon Paketi (154 Test):**
  - Çalışma zamanı, metadata, profil şifreleme, yerel veritabanı, kullanım defteri ve DNS pinleme: **83/83**
  - AI API, yetki, CSRF, soru biçimi ve iptal/arıza senaryoları: **38/38**
  - Yönetici sekmeleri ve öğretmen üretim arayüzü: **14/14**
  - İçerik kaydetme ve AI güvenlik regresyonları: **19/19**
  - Gerçek Chromium üretim arayüzü (iki sekme, taslak formunun korunması, filtreler, anahtar koruma ve öğretmen üretim bağlamı): **0 sayfa hatası ile geçti**.
