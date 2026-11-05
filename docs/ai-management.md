# AI yönetimi

15 Ekim 2026 kullanıcı onayıyla mevcut yerel kurulum yükseltildi ve uygulama başlatıldı. [Prova, yedek ve veri koruma kanıtları](2026-10-15-ai-management-deployment.md). Diğer kurulumlarda aşağıdaki yedek/yükseltme sırasını uygulayın.

Admin menüsündeki **AI Yönetimi** (`/ai-management`) kurulumun ortak AI ayarlarını yönetir. Öğretmen, öğrenci ve veli bu sayfaya veya yönetim API'sine erişemez.

Sayfa iki sekmeden oluşur: **ai profil yönetimi** ve **öğretmen ai kullanımı**. Profil formundaki kaydedilmemiş alanlar sekme geçişinde korunur.

1. **Profil ekle** ile görünen ad, sağlayıcı, HTTPS API adresi, model kimliği ve API anahtarını girin. Aynı sağlayıcı için birden fazla model profili eklenebilir.
2. Yanıt süresini 5–300 saniye, çıktı bütçesini 256–32768 token arasında seçin. Düşünme seçimi destekleyen modellerde uygulanır. Model listesini kayıtlı profilden alabilir veya kimliğini elle girebilirsiniz.
3. Kaydedilen profil başlangıçta kapalıdır. **Bağlantı testi** başarılı olduktan sonra **Öğretmenlere aç** seçilebilir. **Örnek soru testi** ayrıca soru biçimi ve cevap tutarlılığını doğrular; öğretmenin içerik incelemesinin yerine geçmez.
4. Birden fazla modeli açık tutabilirsiniz. İsteğe bağlı varsayılan seçim öğretmene başlangıç seçimi sağlar. Varsayılanı kapatmak/silmek başka modele otomatik geçiş yapmaz.

Öğretmen sınav/anket oluştururken mevcut **AI ile Soruları Üret** alanında yalnız açık modellerden birini seçer. URL, anahtar veya özel model ayarlarını değiştiremez. Konu, soru sayısı, zorluk, üretilen soruların düzenlenmesi ve sınava eklenmesi mevcut akışta kalır. Öğrenci ve veli üretim API'sine erişemez.

Profil düzenlenince erişimi kapanır, eski testleri ve varsayılan seçimi temizlenir. **Kayıtlı anahtar korunacak** durumu ve maskeli alan mevcut anahtarı açıkça belirtir. **Anahtarı değiştir** seçilmeden anahtar alanı düzenlenmez; kayıtlı değer tarayıcıya gönderilmez; sağlayıcı veya adres değişince yeni anahtar zorunludur. Çakışan düzenleme reddedilir; formdaki girdiler korunur. Sunucuda eski `GEMINI_API_KEY` varsa admin açık aktarım işlemiyle resmî Google profiline alabilir; model kimliğini belirtip test etmelidir. Otomatik aktarım yapılmaz.

## Sağlayıcı, model ve test ayarları

Xiaomi MiMo için **Hizmet / bölge** alanından PAYG veya Token Plan CN/SGP/AMS seçilir. Token Plan adresini Xiaomi konsolundaki adresle eşleştirin. PAYG anahtarı ile Token Plan adresi veya tersi kaydedilirken/çağrılırken açık hata verilir; anahtar başka hizmete otomatik taşınmaz. Özel adreslerde bu anahtar türü tahmini uygulanmaz.

Model listesini **kayıtlı** adres/anahtarla alın. Adres veya anahtarı değiştirdiyseniz önce kaydedip düzenlemeyi yeniden açın. Listeden seçim ve elle model kimliği girişi birlikte desteklenir. Google listesi `generateContent` destekleyen modellerle sınırlanır; Google/Anthropic sayfaları toplam süre ve 500 model üst sınırıyla alınır. Modelin listelenmesi hesap erişimi veya soru uyumluluğu garantisi değildir; profil testini çalıştırın. Liste API'si sunmayan sağlayıcılarda kimlik elle girilebilir. Özel sağlayıcı seçeneği OpenAI uyumlu Chat Completions uçları içindir.

**Bağlantı testi** kayıtlı üretim bütçesinden bağımsız olarak en çok 20 saniye ve 512 token kullanır; MiMo düşünmesi bu kısa testte kapatılır. **Örnek soru** ve öğretmen üretimi kayıtlı süre/token/düşünme ayarlarını kullanır. Belgelenmiş MiMo modellerinin soru üretiminde JSON modu kullanılır; soru sayısı, tip ve cevap doğrulaması yine zorunludur. Hatalı yanıt sınava eklenmez; otomatik tekrar ücretli çağrı yapılmaz.

**Yanıt bekleme sınırı** saniyedir (5–300); karttaki ms değeri son testin tamamlanma süresidir. 995 ms'lik başarısız cevap tek başına timeout değildir. **Gelişmiş yanıt ayarları** içindeki token değeri yanıtın üst sınırıdır; soru sayısı veya gerçek token tüketimi değildir. MiMo'da düşünme de bu bütçeye dahildir. Yeni profilde 120 saniye/8192 token başlangıç değeridir; her model ve konu için yeterlilik garantisi yoktur. Mevcut tercihler otomatik değiştirilmez.

Hatalar: `LLM_AUTH` (401, anahtar/hizmet), `LLM_FORBIDDEN` (403, erişim izni), `LLM_BILLING` (402, ödeme/bakiye), `LLM_RATE_LIMIT` (429), ağ, süre aşımı, boş veya kesilmiş yanıt ayrı gösterilir. Test tarihi, revizyon, süre ve güvenli açıklama saklanır; ham sağlayıcı hata gövdesi saklanmaz. Eski genel hata kayıtları yeni ayrıntı içermez; yeniden test edin.

[Güncel düzeltmeler ve gerçek sağlayıcı sonuçları](2026-10-15-ai-management-hardening-results.md).

## Öğretmen AI kullanımı

İkinci sekmede her öğretmen üretim isteği ayrı satırdır: üretim anındaki öğretmen, ders, sınav/anket başlığı, profil/model, soru sayısı, gerçek girdi/çıktı tokenları, varsa düşünme tokenı, süre ve sonuç. Tarih/öğretmen/ders/sınav/model/sonuç filtreleri ve 25/50/100 satırlık sunucu sayfalaması bulunur. Yönetici bağlantı/örnek soru testleri bu tabloya eklenmez.

Sınav henüz kaydedilmemişse **Taslak**, ders seçilmemişse **Ders seçilmedi** görünür. İçerik kaydedilince aynı öğretmenin ilgili taslak kullanımları sınava bağlanır; yeniden kullanım satırı oluşturulmaz. Sonradan başlık veya model değişmesi eski satırın üretim anındaki bilgilerini değiştirmez. Geçersiz soru yanıtının token tüketimi de raporlanır; hata/iptal/timeout tüketimsizlik demek değildir. Sağlayıcı bildirmediyse sayı yerine **Bilinmiyor** yazılır.

Toplamlar bilinen sayılardır; eksik token bilgili istek adedi ayrıca gösterilir. Düşünme çıktının alt kalemidir; tekrar toplanmaz. Sağlayıcıya göre cache ve düşünme kalemleri normalleştirilir. Token sayıları fiyat veya kalan kota değildir. Geçmişte usage kaydedilmediğinden bu özelliğin devreye alındığı tarihten önceki tüketim geriye dönük çıkarılamaz.

Varsayılan model listesinde tüm profiller görünür. Kapalı profiller seçilemez; önce başarılı bağlantı testinden sonra öğretmenlere açın. Birden fazla açık profil arasından varsayılan açıkça seçilir; kendiliğinden başka modele geçilmez.

**Bir üretim için yanıt üst sınırı (token)** alanının altında örnek hesap vardır: kısa/orta, beş seçenekli soruda varsayımsal 300 token/soru + 200 yapı payı. 10 soru için orta örnek 3200; iki ayrı 10 üretimiyle 20 soru için toplam 6400'dür. Bunlar ölçülmüş ortalama değildir. Varsayılan üst sınır 8192 **her çağrı** içindir; toplam izin miktarı gerçek tüketim değildir. Aynı sağlayıcı/model, düşünme modu ve 10 soru için en az beş başarılı örnek varsa kullanım sekmesindeki filtrelere göre gözlenen ortalama, örnek sayısı ve gerçek örnek tarih aralığı gösterilir. Girdi ve düşünme örnek hesaba dahil değildir; uzun sorular daha fazla tüketebilir. Tek istekte 10 soru sınırı korunur.

Raporlar mevcut salt okunur bağlantıyı, kısa kullanım kayıtları mevcut yazıcıyı kullanır. Sağlayıcı beklenirken transaction tutulmaz. Kullanım kayıt hatasında sağlayıcı yeniden çağrılmaz; başarılı sorular korunur ve sunucu uyarı üretir. Süreç kesintisinden kalan eski bekleyen kayıtlar **Sonucu bilinmiyor** görünür. Sürekli kayıt arızasında raporun eksiksizliği garanti edilemez.

Yeni `20261015000200_ai_usage` migration'ı yalnız kullanım tablosu/indekslerini ekler. Sırların tutulduğu mevcut profil tabloları değiştirilmez. Devreye alma öncesi ayrı kopyada prova ve tam yedek alınır. [Bu sürümün doğrulama kaydı](2026-10-15-ai-usage-results.md).

## Güvenlik ve kurulum

API anahtarları AES-256-GCM ile DB'de şifreli saklanır; tarayıcıya geri gönderilmez. Şifreleme anahtarı `server/data/ai-encryption.key` dosyasıdır. Dosyayı Git'e eklemeyin veya elle değiştirmeyin. Kaybolursa/uyumsuzsa AI çağrıları güvenli biçimde reddedilir. DB ile bu dosyayı birlikte kurtarın; yeni anahtar üretip eski şifreli kayıtları bozmayın.

Bakım ve yükseltme yedeği anahtar dosyasını içerir. Native bakım backup/restore ayrıca anahtarın profil kayıtlarını çözebildiğini doğrular. Yedekleri gizli veri olarak koruyun. Yeni `20261015000100_ai_management` migration'ı mevcut tablolara dokunmadan profil ve yapılandırma tablolarını ekler. Önce süreçleri durdurup doğrulanmış yedek alın, ayrı kurulumda migration/generate/build adımlarını prova edin. Mevcut yerel kurulumda bu adımlar kullanıcı onayıyla tamamlandı; [devreye alma kaydı](2026-10-15-ai-management-deployment.md).

Sağlayıcı bağlantıları genel internet üzerinde HTTPS gerektirir. Özel ağ, localhost ve kimlik bilgilerini başka adrese taşıyan redirect'ler engellenir. Üretim kullanıcı başına 15 dakikada 30, yönetim test/model keşfi 20 istekle ve aynı kullanıcı için tek devam eden AI çağrısıyla sınırlıdır. Sağlayıcı kota, erişim, ağ, timeout, boş/kesilmiş veya geçersiz soru yanıtı temiz hata olarak gösterilir. Harici sağlayıcının erişimi ve içerik kalitesi ayrıca değerlendirilmelidir.

Uyarlama kaynağı: `F:/projeler/llm-yonetimi`. Katalog/protokol davranışı QuizMaster servislerine dahil edilmiştir; dağıtım bu dış klasöre, bağımsız HTML sayfasına veya örnek Basic auth sunucusuna bağlı değildir.
