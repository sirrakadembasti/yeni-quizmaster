# Akademik Arşiv Paketi ve Yıl Kapanışı Kabul Raporu

Bu belge, dönem iş verilerinin değişmez dışa aktarım sözleşmesini (`Format 2` ZIP/PDF/CSV arşivi), geçmiş eğitim yılı arama projeksiyonunu ve 12 Ekim 2026 tarihli nihai kabul doğrulama sonuçlarını birleştirir. Günlük yönetici işlemleri için [Eğitim Yılı Geçişi ve Arşivleme Kılavuzuna](../yil-gecisi-ve-arsivleme.md) bakın.

## 1. Akademik Arşiv Paketi Sözleşmesi

Akademik arşiv paketi dönem iş verilerinin değişmez dışa aktarımıdır. Tam sunucu yedeği değildir: oturumlar, parolalar, SMTP/AI anahtarları ve çalışma yapılandırması dışarı verilmez. Tam sunucu yedeği için [Üretim ve Bakım Kılavuzu](../uretim-ve-bakim-kilavuzu.md) kullanılır.

### Dizin Yapısı ve Bütünlük
Her dönem görüntüsü (snapshot) `backup_root/{academicYear}/{snapshotId}/` altında yayımlanır ve şu dosyaları içerir:

- `csv/people-classes.csv`: kişiler, sınıflar, veli bağlantıları ve duyurular.
- `csv/courses-assignments.csv`: dersler ve öğretmen atamaları.
- `csv/quizzes-questions.csv`: sınavlar, anketler, sorular ve soru bankası.
- `csv/results-surveys.csv`: sonuçlar, anket gönderimleri ve cevapları.
- `records.json`: dondurulmuş iş verileri.
- `meta.json`: dönem, snapshot kimliği, başlatan kullanıcı, oluşturma ve yakalama (capture) zamanı, satır sayısı ve kaynak özeti.
- `index.json`: sınıf/şube $\rightarrow$ ders $\rightarrow$ içerik ve PDF dosyası eşlemesi.
- `pdfs/report.pdf` ve bölünmüş raporlarda `pdfs/report-NNNN.pdf`.
- `images/`: izinli yerel soru görsellerinin dondurulmuş kopyaları.
- `manifest.json`, `checksums.json`, `README.txt`.

`Format 2` manifesti dosya başına bayt sayısını ve SHA-256 özetini içerir. ZIP dosyasının SHA-256 özeti ve boyutu veritabanında tutulur; dosya üretimi, doğrulama ve yetkili indirme sırasında karşılaştırılır. Eksik, fazladan, güvensiz yollu, yinelenmiş veya değiştirilmiş dosya reddedilir.

### PDF ve Görsel Kuralları
- Rapor dondurulmuş sınıf, ders, sınav başlığı, yayın/oluşturma tarihi, soru/cevap, katılımcı ve puanlardan üretilir.
- PDF parçaları en fazla 100 içerik bölümü ve 2 MiB HTML ile oluşturulur; her PDF için 30 saniyelik üretim sınırı vardır.
- Yerel PNG/JPEG/WebP dosyaları güvenli `uploads` yolu, gerçek dosya türü ve boyut kontrollerinden sonra pakete kopyalanır. Dizin aşımı (traversal), sembolik bağlantı (symlink) ve SVG reddedilir.

### Kaynak Sınırları ve Geçmiş Yıl Arama Projeksiyonu
- Ham snapshot JSON girdisi 64 MiB, paket 256 MiB ile sınırlıdır.
- Geçmiş yıl sayfalama, filtre ve istatistik sorguları bütün JSON'u her istekte taşımak yerine SQLite içindeki sürümlü arama projeksiyonunda (`20261009_archive_history_projection` ve `20261010_archive_entity_lookup`) çalışır. Eski arşivde projeksiyon yoksa arka planda en fazla 4.096 satırlık partilerle hazırlanır.

## 2. Nihai Kabul ve Doğrulama Sonuçları (12 Ekim 2026)

| Doğrulama Alanı | Kapsam ve Sonuç |
|---|---|
| Gerçek Veritabanı ve Hacim Kabulü | **74/74 kontrol (9/9 dosya)** geçti. 1k / 10k / 50k ölçeklerinde tam yakalama (capture), gerçek Chromium PDF/ZIP üretimi, sonlandırma işlemi (finalization) ve 50.001 satırlık geçmiş arama projeksiyonu hazırlığı (154,3 sn, 13 parça) doğrulandı. |
| Odaklı Dosya, Sorgu ve İşçi (Worker) Testleri | Dosya/PDF/görsel sözleşmesi **27/27**, geçmiş yıl sorguları **18/18**, arşiv işçisi **30/30**, hata/yeniden deneme **2/2** geçti. |
| Gerçek Chromium Uçtan Uca (E2E) Senaryoları | İzole ortamda (`node scripts/academic-archive-runner.mjs`) 5 ayrı senaryo geçti: **Manuel Arşiv** (`academic-archive-manual.spec.ts`), **Geçmiş Yıl Görünümü** (`academic-history.spec.ts`), **Yıllık Yazma Sınırı** (`academic-archive-boundary.spec.ts`), **Hata Kurtarma** (`academic-archive-recovery.spec.ts`) ve **Yıl Geçişi / Terfi** (`academic-archive-transition.spec.ts`). |
| Genel Regresyon Paketi | Sunucu genel regresyonu **412/412 (51/51 dosya)**, istemci genel regresyonu **272/272 (36/36 dosya)**, kurulum regresyonu **14/14**, TypeScript ve üretim derlemesi çıkış `0` ile tamamlandı. |
| Eşzamanlı Yazıcı Provası (14 Ekim 2026) | 17.667 satırlık yıllık kapanış ve ilk geçmiş projeksiyonu hazırlığı sırasında bağımsız HTTP yazıcısı **50/50** hatasız geçti ([Performans ve Kapasite Raporu](../performans-ve-kapasite-raporu.md)). |
