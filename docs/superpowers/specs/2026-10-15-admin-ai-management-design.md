# Admin AI yönetimi ve öğretmen model seçimi

Durum: Kullanıcı onayladı; uygulandı ve izole kabul kontrolleri tamamlandı. 15 Ekim 2026. [Sonuçlar ve sınırlar](../../2026-10-15-ai-management-results.md).

## Amaç ve mevcut durum

QuizMaster'ın sınav/anket için AI soru üretimini koruyarak sağlayıcı, API adresi,
model, API anahtarı ve çalışma sınırlarını yalnız admin yönetir. Öğretmen yalnız
admin'in açtığı modellerden birini seçerek mevcut üretim formunu kullanır.

Kaynak: `F:/projeler/llm-yonetimi`. Kaynak paket değiştirilmez; belgelerindeki
örnek Basic auth, ayrı sunucu ve otel/Manager sohbeti QuizMaster'a taşınmaz.
Paketin beş bağımsız testi izole geçici dizin ve yerel HTTP ile 5/5 geçti.
Sandbox içindeki ilk geçici dosya/loopback denemeleri başarısızdı; başarılı koşu
sandbox dışında aynı testlerle alındı. Gerçek sağlayıcı çağrısı yapılmadı.

Mevcut `AIQuestionGenerator` öğretmene URL ve anahtar girişi sunuyor. Mevcut AI
rotası bu alanları kabul ediyor. Paket tek `activeId` ve eşzamanlı dosya deposu
kullanıyor; doğrudan bağlamak çoklu seçilebilir model gereksinimini karşılamıyor.

## Yaklaşım seçimi

1. Önerilen: Paket sağlayıcı kataloğu, transport ve runtime kodunu kaynak olarak
   uygulamaya dahil et; QuizMaster React arayüzünü ve Prisma deposunu kullan.
   Dış klasöre bağımlı olmayan dağıtım, mevcut session/CSRF ve atomik revizyon
   kontrolü sağlar. Paket güncellemeleri bilinçli kaynak uyarlaması gerektirir.
2. Paketin bağımsız HTML yönetimini ve JSON deposunu mount et. Daha az ilk UI
   çalışması gerektirir; farklı görünüm, tek yazıcı ve çoklu etkinlik uyarlaması
   gerektirir. Önerilmez.
3. Sağlayıcı runtime'ını tamamen yeniden yaz. Mevcut güvenli transport ve çoklu
   protokol desteğini tekrar üretir; gereksiz kapsam oluşturur. Önerilmez.

## Admin sayfası

Admin menüsüne **AI Yönetimi**, yalnız admin erişimli `/ai-management` rotası
eklenir. Sayfa mevcut panel, form, tablo, toast ve dialog bileşenlerini kullanır.

Her profil bir sağlayıcı + model birleşimidir. Admin aynı sağlayıcıdan birden
fazla model veya farklı sağlayıcılardan modeller ekleyebilir. Alanlar: görünen
ad, sağlayıcı, HTTPS API adresi, model kimliği, parola tipinde API anahtarı,
yanıt süresi, çıktı token sınırı ve desteklenen düşünme ayarı. Model kimliği
elle girilebilir; sağlayıcıdan model listesi alma da sunulur.

Tabloda ad/sağlayıcı/model, öğretmenlere açık-kapalı durumu, varsayılan seçimi,
anahtar var/yok ve son test özeti gösterilir. Düzenleme, anahtar değiştirme,
kısa bağlantı testi, ayrı bir örnek soru üretim testi ve silme vardır. Kayıtlı
anahtar tekrar okunmaz; boş anahtar alanı mevcut anahtarı korur. Sağlayıcı veya
API adresi değişirse yeni anahtar zorunludur. Eşzamanlı düzenlemeler 409 ile
korunur; kullanıcı formu sessizce ezilmez.

Birden çok profil aynı anda öğretmene açılabilir. Varsayılan profil yalnız açık
profillerden seçilir ve isteğe bağlıdır. Varsayılan kapatılır/silinirse seçim
temizlenir; başka ücretli modele sessiz geçiş yapılmaz. Son başarılı kısa test
mevcut profil revizyonuna ait olmadan profil kullanıma açılamaz. Bağlantı testi
soru kalitesini garanti etmez; örnek soru testi ayrı gösterilir.

## Öğretmen akışı

Mevcut AI soru üretme dialogunda konu, adet, zorluk ve sınav/anket akışı korunur.
URL, sağlayıcı ayarı, anahtar ve bağlantı testi alanları kaldırılır. Tek bir
**AI modeli** seçimi açık profillerin görünen adını, sağlayıcısını ve modelini
gösterir. Varsayılan varsa seçilir; tek model varsa otomatik seçilebilir;
birden çok model ve varsayılan yoksa öğretmen açıkça seçim yapar.

Liste boşsa üretim devre dışıdır ve admin'e başvurma mesajı gösterilir. Liste
hatası yeniden denemeyle ayrılır. Seçilen profil sonradan kapanır/silinirse
backend üretimi reddeder ve UI listeyi yeniler. Öğretmen farklı profile sessizce
yönlendirilmez. Devam eden çağrı başlangıçta çözülen profil revizyonunu kullanır;
kapatma sonraki çağrıları engeller, mevcut harici çağrıyı geri alamaz.

Öğretmen isteği yalnız profil kimliği ve soru parametrelerini gönderir. Backend
her çağrıda rolü, profilin açıklığını ve girdileri doğrular. Eski özel URL/API
anahtarı/model override parametreleri açıkça reddedilir; UI kaldırmak tek başına
yetki kontrolü sayılmaz. Öğrenci ve veli hem listeye hem üretime erişemez.

## Backend ve veri

Yeni odaklı servisler: profil deposu/şifreleme, sağlayıcı runtime adaptörü ve
admin API rotaları. Eklentinin senkron store/`req.user.isAdmin` sözleşmesini
zorlamak yerine mevcut `requireAuth` ve `requireRole(['admin'])` kullanılır.
Yönetim API'si `/api/admin/ai`; öğretmene temizlenmiş liste `/api/ai/models`;
mevcut `/api/ai/generate-questions` profil seçimine uyarlanır.

Prisma migration ile profil tablosu ve varsayılan profil ayarı eklenir. Profil
anahtarı AES-256-GCM ile rastgele IV ve doğrulama etiketiyle şifrelenir. Kayıt
revizyonu tüm düzenleme, açık/kapalı, varsayılan ve silme işlemlerinde zorunludur.
Test sonucu yalnız test edilen revizyon hâlâ geçerliyse yazılır. Admin bir
profilin anahtarını okuyamaz; yalnız varlığını görür. Öğretmen listesinde API
adresi, gizli anahtar ve iç tanı bilgileri bulunmaz.

Şifreleme anahtarı kurulumun özel veri dizininde ayrı dosyada, güvenli ilk
oluşturmayla tutulur; mevcut şifreli kayıt varken eksik/yanlış anahtar sessizce
yenilenmez. Başlatma mevcut `.env` dosyasını değiştirmez. AI yapılandırma hatası
sınav hizmetini düşürmeden AI işlemlerinde görünür ve güvenli hata verir.

AI yapılandırması eğitim yılından bağımsız kurulum ayarıdır. Tarihsel arşiv
görünümü yeni yönetim sayfasını yanlışlıkla arşiv içeriğine dönüştürmez; mevcut
akademik yıl yazma korumaları diğer sayfalarda korunur.

## Güvenlik ve sağlayıcı davranışı

Mevcut session, rol ve CSRF mekanizmaları kullanılır. HTTPS ve gerçek socket DNS
denetimi, özel/yerel ağ engeli ve redirect reddi korunur; üretimde yerel HTTP
kaçış ayarı açılmaz. Sağlayıcı hata gövdeleri ve anahtarlar log/UI'ya taşınmaz.
Admin testleri ve üretim için kullanıcıya göre hız ve eşzamanlılık sınırı
uygulanır; yinelenen tıklamalar ve ayrılınca eski sonuçların forma uygulanması
engellenir. Ağ isteği boyunca SQLite transaction açık tutulmaz.

OpenAI uyumlu, Google ve Anthropic protokolleri paketin runtime'ından uyarlanır.
Model adları sabit/hayali seçenek olarak sunulmaz. Timeout, kota, erişim,
kesilmiş/boş yanıt, ağ ve geçersiz soru JSON'u ayrı temiz hatalar üretir. Mevcut
soru sayısı, tür, seçenek/cevap eşleştirme ve anket doğrulaması korunur. Üretilen
sorular mevcut öğretmen önizleme/ekleme akışından geçer; otomatik yayınlanmaz.

## Eski kurulum ve bakım

Mevcut GEMINI_API_KEY sessizce birden fazla sağlayıcıya aktarılmaz. Yeni liste
boşsa admin mevcut sunucu anahtarını resmî Google adresine bağlı bir profile
sunucu tarafında açık bir **Mevcut Gemini ayarını aktar** işlemiyle alabilir;
model kimliği admin tarafından girilir/doğrulanır. Anahtar tarayıcıya verilmez,
`.env` değişmez ve profil başarılı testten önce öğretmene açılmaz.

Profil tablosu standart DB yedeğine dahildir. Ayrı şifreleme anahtarı mevcut
bakım backup/restore manifestine özel dosya olarak eklenir ve bütünlüğü sınanır.
Tam geri yükleme ikisini birlikte korumalıdır. Anahtar ve fixture sırları Git'e
eklenmez. Canlı DB'ye migration, uygulama başlatma veya veri kopyası yapılmaz;
migration ve yükseltme bağımsız sentetik kurulumda doğrulanır.

Kullanıcının `client/src/lib/api.ts` ve `client/src/pages/server-setup.tsx`
değişiklikleri korunur. Yeni AI API istemcisi ayrı modülde tutularak mevcut
`api.ts` hunk'larına müdahale ihtiyacı azaltılır.

## Kabul

- Admin CRUD, çoklu açıklık, varsayılan ve stale revision testleri.
- Öğretmen/öğrenci/veli yönetim yasağı, override reddi ve anahtar sızıntısı testi.
- Şifreleme, eksik/yanlış anahtar, atomik kayıt ve yedek/restore testi.
- Üç protokol için sahte upstream ile gerçek adaptör isteği/yanıt doğrulaması;
  gerçek API anahtarı veya ücretli sağlayıcı çağrısı gerektirmez.
- Sınav ve anket üretimi, cevap doğruluğu, timeout/kota/bozuk yanıt regresyonu.
- Gerçek tarayıcıda admin sayfası ve öğretmen model seçimi; boş/hata/yüklenme
  durumları, mobil ve klavye erişimi.
- İlgili tip kontrolleri, testler ve standart üretim derlemesi. Sonuçlar README
  ve ilgili admin/öğretmen bakım belgelerine işlenir.

## Kapsam dışında

Öğrencilere AI sohbeti, otomatik model failover, kota/faturalama paneli, içerik
üretimini otomatik yayınlama ve mevcut sınav/puanlama işleyişini değiştirme.
