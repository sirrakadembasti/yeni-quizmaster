# Öğrenci paneli altı hata onarımı

Onay: Kullanıcı öğrenci audit raporundaki hataları düzeltmeyi istedi. Kapsam S-B01..S-B06; yeni özellikler ve UX adayları dahil değil. api.ts ve server-setup.tsx kullanıcı düzenlemeleri korunur.

1. Mevcut altı kırmızı E2E'yi izole Windows fixture'da yeniden çalıştır. Test başarı kriterleri audit findings.md'de yazılıdır.
2. S-B01: Yerel cevabın sunucu başlangıcında ezilme nedenini gider. Değişmiş/gönderilmemiş cevapları ayrı izle; aynı userId/quizId/resultId ve mevcut soru kümesinde server cevaplarıyla uzlaştır. Başarılı tek cevap kaydı yalnız gönderilen değer hâlâ aynıysa pending işaretini temizlesin. Eski/farklı oturum ve sunucuya zaten kaydedilmiş eski cevapları yeniden aktarma. Teslim kuyruğunu koru. Birim testleri ve DB'ye gerçek teslim/yenileme doğrulaması.
3. S-B02/S-B03: Öğrenci geri hedeflerini kayıtlı /student/quizzes ve /student/results yap; öğretmen/admin önizleme hedefi /quizzes kalsın.
4. S-B06: Kategori Select değerini filtre/export lookup kimliğiyle tutarlı yap. Diğer filtre/reset davranışları korunsun.
5. S-B04/S-B05: Loading/error/empty/data ayrımı; hata mesajı ve retry. Hata kaldırıldığında gerçek API verisinin yeniden görünmesini test et.
6. Tam öğrenci E2E ve ilgili birim testleri, type-check/build, bağımsız diff review. Her failure kök nedenine göre incelensin; başarı varsayılmasın.
7. Audit tarihsel kırmızı sonuçlarını koru; onarım doğrulamasını ayrı yaz. README/student-guide/Graphify belgelerini ve haritayı güncelle, yalnız ilgili dosyaları commit et; push yok.

Tercih edilen yaklaşım mevcut bileşenlerde dar düzeltme ve yerel cache'e geriye uyumlu pending metadata'dır. Bütün cache cevaplarını her açılışta birleştirmek başka cihazın güncel cevabını eski kayıtla ezebilir; büyük bir senkronizasyon servisi/migration bu hata onarımı için gereksizdir. Metadata olmayan eski cache'in sunucuda hiç bulunmayan cevapları aynı oturumda korunabilir; sunucuda bulunan çelişkili eski cevabın hangisinin yeni olduğu kanıtlanamaz, sunucu cevabı tercih edilir.
