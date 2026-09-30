# Admin ikinci onarım paketi

Onaylanan admin denetim planı kapsamında Q03/Q04/Q05/Q06 ve PE02 ele alınır. Kurulum terminal, bat/sh ve web arasında hibrit kalır; gerçek kullanıcı verisi testlerde kullanılmaz.

Yeni içerik kaydı sabit bir UUID ile yapılır. Ayarlar, atamalar, sorular ve yayın durumu aynı Prisma transaction'ında yazılır. Soru kimlikleri içerikle eşleşmek zorundadır; katılım sonrası sorular korunur. Tekrar gönderilen değişmeyen yeni sorular mevcut kimliklerle eşleştirilir. Bildirim teslim hatası commit edilmiş kaydı başarısız göstermemelidir. Eski API uçları uyumluluk için korunur; genel API doğrulama bulguları ayrı iş olarak açıktır.

Sonuç başarı dağılımı/ortalaması yalnız tamamlanan ve puanı bulunan kayıtları kullanır. Tamamlanmış sıfır dahil kalır; katılım kayıtları ve notlandırılanlar ayrı gösterilir. Yönetici tüm öğretmenlerin sınavlarını mevcut global API üzerinden seçebilir. Boş açıklama ve kapatılan süre null ile temizlenir.

Adlandırılmış ve URL tabanlı query key'ler birlikte var olduğu için ilişkisel invalidasyon iki biçimi de kapsar. Aktif sorgular yeniden alınır, pasif sorgular eski işaretlenir; ilgisiz cache korunur. Başka panel akışları bu paketin denetim kapsamına genişletilmez.

Kabul: gerçek Prisma rollback/hata enjeksiyonu, CSRF taşıması, gerçek React düzenleyici ve sonuç sayfası, aynı SPA oturumunda cache yenilenmesi ve kayıp HTTP yanıtı sonrası gerçek tarayıcı tekrar denemesi. PE05 eski ikinci öğretmen bağının kaynağı veride bulunmadığından ürün tercihi bekler; bu paket o bağı silmez.
