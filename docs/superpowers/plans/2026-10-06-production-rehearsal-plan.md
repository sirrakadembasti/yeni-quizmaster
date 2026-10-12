# Üretime hazırlık provası

Durum: Kullanıcı 6 Ekim 2026'da uygulamayı ve bulunan hataların düzeltilmesini onayladı. Bu çalışma, akademik arşiv planının bütün görevleri, belge/Graphify güncellemeleri ve son commit'i tamamlandıktan sonra yürütülecek. Kullanıcının çevrimiçi olması beklenmeyecek.

7 Ekim ek talimatı: Arşiv görevleri kapandıktan sonra ilgili Markdown/README ve Graphify güncellenip commit edilecek ve GitHub'a push yapılacak. Sonraki üretim provasında doğrulanan değişiklikler de aynı güvenli yayın akışıyla kaydedilir; tamamlanmamış kontroller başarı olarak sunulmaz. Yerel ve README'de belirtilen uzak `main` geçmişlerinin ortak commit'i bulunmadığından uzak geçmişi değiştirmeden yeni bir `codex/` dalı kullanılır; force push yapılmaz.

## Ortak sınırlar

- Mevcut terminal, BAT/SH ve web üzerinden hibrit kurulum mimarisi korunur. Önce gerçek çalıştırma/yükseltme talimatları ve araçları incelenir.
- Üretim veritabanı, gerçek kullanıcı verileri, gizli ayarlar ve önceden mevcut kullanıcı değişiklikleri korunur. Provalar ayrı veri, port, süreç ve dizinlerle çalışır.
- Her görev için yeniden üretilebilir kanıt, hata durumları ve kabul sonuçları kaydedilir. Doğrulanmış görevler ayrı commit ile kapatılır.
- Çalıştırılamayan ortam veya test başarılı sayılmaz; uygun alternatif ortam araştırılır ve kalan sınır belgelenir.

## Görev 1 — Yedek alma ve geri yükleme

Mevcut tam uygulama yedeği ile akademik iş verisi export'u arasındaki sınırı doğrula. İzole kurulumda veritabanı, dosyalar ve gerekli yapılandırma kapsamını test et. Yedeği farklı bir temiz dizine geri yükle; kullanıcı girişi, ilişkiler, içerik/sonuçlar, dosyalar ve arşivler için önce/sonra karşılaştırması yap. Bozuk ve eksik yedeğin güvenli reddedilmesini sınayıp bulunan hataları düzelt.

## Görev 2 — Hibrit sürüm yükseltme

Önceki desteklenen sürümün izole kurulumunu hazırla. Terminal, Windows BAT ve Linux/SH giriş noktalarıyla ve sonraki web adımlarıyla gerçek yükseltme yap. Migration, veri/dosya/ayar korunumu, oturum davranışı, yeniden başlatma ve süreç temizliğini doğrula. Yükseltmenin tekrar çalıştırılması ve yarıda kesilmesi senaryolarını sınayıp hataları düzelt.

## Görev 3 — Hatalı yükseltmeden geri dönüş

Dosya, migration, bağımlılık veya açılış aşamalarında kontrollü hata üret. Son çalışan sürüme ve doğru veri yedeğine dön; veritabanı ile uygulama sürümünün birlikte tutarlı olduğunu doğrula. Canlı veriyi değiştirmeden başarısız geri dönüşün nasıl bildirildiğini ve tekrar kurtarmayı test et. Otomatik/manuel geri dönüş sözleşmesini belgelerle uyumlu hale getir.

## Görev 4 — Performans ve frontend paketi

Gerçekçi, sentetik kullanıcı/sınıf/ders/sınav/anket/sonuç hacimleriyle ölçüm yap. Ortamı, veri büyüklüğünü, gecikme dağılımını, hata oranını ve kaynak kullanımını raporla. Üretim derlemesindeki giriş ve büyük parçaları ölçerek en büyük yük kaynaklarını belirle. Uygun kod bölme ve yükleme değişikliklerini mevcut işlevleri koruyarak uygula; önce/sonra paket boyutu ve tarayıcı akışlarıyla kazanımı doğrula. Ölçülen darboğazları düzelt, yeniden ölç.

## Kapanış

İlgili README ve docs belgelerini, test kanıtlarını ve Graphify çıktısını güncelle. Son derleme, uygun regresyonlar, gerçek tarayıcı kontrolleri, süreç/dizin temizliği ve korunan dosya/veritabanı kontrollerinden sonra son commit'i at. Son raporda tamamlananlar, ölçümler ve doğrulanamamış sınırlar açıkça ayrılır.
