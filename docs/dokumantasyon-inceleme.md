# QuizMaster Dokümantasyon Düzeni, Güncellik ve Temizlik Kaydı

## 5 Kasım 2026 Kapsamlı Türkçeleştirme ve Yeniden Yapılandırma

1. **Tüm Dosya ve Klasör Adlarının Türkçeleştirilmesi:**
   - `docs/yonetici-kilavuzu.md` $\rightarrow$ [`docs/yonetici-kilavuzu.md`](yonetici-kilavuzu.md)
   - `docs/ogretmen-kilavuzu.md` $\rightarrow$ [`docs/ogretmen-kilavuzu.md`](ogretmen-kilavuzu.md)
   - `docs/ogrenci-kilavuzu.md` $\rightarrow$ [`docs/ogrenci-kilavuzu.md`](ogrenci-kilavuzu.md)
   - `docs/veli-kilavuzu.md` $\rightarrow$ [`docs/veli-kilavuzu.md`](veli-kilavuzu.md)
   - `docs/yapay-zeka-yonetimi.md` $\rightarrow$ [`docs/yapay-zeka-yonetimi.md`](yapay-zeka-yonetimi.md)
   - `docs/uretim-ve-bakim-kilavuzu.md` $\rightarrow$ [`docs/uretim-ve-bakim-kilavuzu.md`](uretim-ve-bakim-kilavuzu.md)
   - `docs/graphify-mimari-haritasi.md` $\rightarrow$ [`docs/graphify-mimari-haritasi.md`](graphify-mimari-haritasi.md)
2. **Parçalı Raporların Birleştirilmesi:**
   - Kök dizindeki 5 ayrı yapay zeka devreye alma/test dosyası [`docs/yapay-zeka-yonetimi.md`](yapay-zeka-yonetimi.md) içine birleştirildi.
   - Yükseltme ve geri dönüş prova sonuçları (`uretim-ve-bakim-kilavuzu.md`, `uretim-ve-bakim-kilavuzu.md`) [`docs/uretim-ve-bakim-kilavuzu.md`](uretim-ve-bakim-kilavuzu.md) içine birleştirildi.
   - Performans, başlangıç paketi ve 80 öğrencilik sınav kapasite dosyaları (`performans-ve-kapasite-raporu.md`, `performans-ve-kapasite-raporu.md`, `performans-ve-kapasite-raporu.md`, `performans-ve-kapasite-raporu.md`) [`docs/performans-ve-kapasite-raporu.md`](performans-ve-kapasite-raporu.md) altında birleştirildi.
3. **Denetim Raporlarının Birleştirilmesi (`docs/denetim-raporlari/`):**
   - `academic-archive-review`, `admin-audit`, `teacher-audit`, `student-audit`, `parent-audit` ve `integration-audit` altındaki 30+ parçalı İngilizce `.md` dosyası `docs/denetim-raporlari/` altında 6 tekil Türkçe raporda birleştirildi:
     - [`docs/denetim-raporlari/yonetici-denetim-raporu.md`](denetim-raporlari/yonetici-denetim-raporu.md)
     - [`docs/denetim-raporlari/ogretmen-denetim-raporu.md`](denetim-raporlari/ogretmen-denetim-raporu.md)
     - [`docs/denetim-raporlari/ogrenci-denetim-raporu.md`](denetim-raporlari/ogrenci-denetim-raporu.md)
     - [`docs/denetim-raporlari/veli-denetim-raporu.md`](denetim-raporlari/veli-denetim-raporu.md)
     - [`docs/denetim-raporlari/entegrasyon-denetim-raporu.md`](denetim-raporlari/entegrasyon-denetim-raporu.md)
     - [`docs/denetim-raporlari/akademik-arsiv-kabul-raporu.md`](denetim-raporlari/akademik-arsiv-kabul-raporu.md)
4. **İşlevini Yitirmiş Dosyaların Temizlenmesi ve Test Kanıtlarının Ayrılması:**
   - İşlevini tamamlamış 28 adet eski plan/tasarım taslağı (`docs/superpowers/`), refactor ön-inceleme dökümleri (`refactor-dosya-envanteri.json`, `refactor-ve-temizlik-yol-haritasi.md`), onarım öncesi başarısız test hata dökümleri (`flow-failures`, `test-results-*`, `before-repairs`, `historical-*`) ve üçüncü taraf Python çalışma zamanı kalıntıları (`test-results-pdf-runtime`) kaldırıldı.
   - Aktif test/doğrulama betiklerinin kullandığı JSON, görsel ve PDF kanıt çıktıları `docs/` dışındaki `tests/denetim-kanitlari/` (`yonetici`, `ogretmen`, `ogrenci`, `veli`, `entegrasyon`, `canli-soket`) dizinine taşındı.
5. **Yeni Özelliklerin Belgelenmesi (5 Kasım 2026):**
   - Kayıt başarı bilgilendirme e-postası (`registration_welcome`), yönetici panelinden SMTP'siz tek kullanımlık parola sıfırlama bağlantısı (**Bağlantı Üret (SMTP'siz)**) ve terminal üzerinden yerel yönetici kurtarma (`db:reset-admin`) akışları işlendi.
   - `domain/demo` adresinde bağımsız `server/data/demo.db` veritabanı ile çalışan salt-okunur ikinci kopya (`APP_DEMO_MODE=true`, `APP_BASE_PATH=/demo`, `pnpm run db:prepare-demo`, `pnpm run start:demo`), 4 hazır vitrin hesabı (`demo-admin`, `demo-ogretmen`, `demo-ogrenci`, `demo-veli`), `demoPassword` korunumu, `/demo` altında kayıt/şifre sıfırlama/demo dışı giriş engeli (`isRequestInDemoContext`) ve `/demo/...` URL önekinin korunması (`DemoAwareRouter`) tüm ilgili kılavuzlara ve [`demo/demo-vitrin-hesaplari.md`](../demo/demo-vitrin-hesaplari.md) belgesine işlendi.

---

## Güncel `docs/` Belge Envanteri

| Dosya | Kategori | Açıklama |
|---|---|---|
| [`yonetici-kilavuzu.md`](yonetici-kilavuzu.md) | Kullanıcı Kılavuzu | Yönetici (`admin`) rolü okul, sınıf, kullanıcı, sınav, anket, AI ve arşiv yönetimi |
| [`ogretmen-kilavuzu.md`](ogretmen-kilavuzu.md) | Kullanıcı Kılavuzu | Öğretmen (`teacher`) rolü yetkili sınıf, sınav, anket, istatistik ve duyuru yönetimi |
| [`ogrenci-kilavuzu.md`](ogrenci-kilavuzu.md) | Kullanıcı Kılavuzu | Öğrenci (`student`) rolü çevrimiçi/çevrimdışı sınav, anket, sonuç ve istatistik takibi |
| [`veli-kilavuzu.md`](veli-kilavuzu.md) | Kullanıcı Kılavuzu | Veli (`parent`) rolü bağlı öğrenci sınav takibi ve salt okunur sonuç incelemesi |
| [`yapay-zeka-yonetimi.md`](yapay-zeka-yonetimi.md) | Özellik ve İşletim Kılavuzu | AI profil yönetimi, şifreli anahtar saklama, sağlayıcı testleri ve öğretmen token takibi |
| [`yil-gecisi-ve-arsivleme.md`](yil-gecisi-ve-arsivleme.md) | Özellik ve İşletim Kılavuzu | Eğitim yılı kapanışı, değişmez arşiv paketleri, sınıf atlatma ve geçmiş yıl görünümü |
| [`sunucu-kurulum-kilavuzu.md`](sunucu-kurulum-kilavuzu.md) | Kurulum ve İşletim | Yerel, subdomain, alt yol ve `domain/demo` ikinci kopya kurulum/Nginx yapılandırması |
| [`uretim-ve-bakim-kilavuzu.md`](uretim-ve-bakim-kilavuzu.md) | Kurulum ve İşletim | Tam yedekleme (`backup`), geri yükleme (`restore`), sürüm yükseltme (`upgrade`) ve geri dönüş |
| [`e-posta-yapilandirma.md`](e-posta-yapilandirma.md) | Kurulum ve İşletim | Gmail SMTP, Outbox kuyruğu, kayıt bilgilendirme e-postası ve parola sıfırlama |
| [`guvenlik-ve-bakim.md`](guvenlik-ve-bakim.md) | Güvenlik ve Mimari | Yetki sınırları, oturum/CSRF, çevrimdışı sınav, arşiv ve `/demo` güvenlik kuralları |
| [`performans-ve-kapasite-raporu.md`](performans-ve-kapasite-raporu.md) | Performans ve Kapasite | Paket boyutu (`manualChunks`), SQLite WAL yalıtımı ve 80 öğrencilik sınav provası |
| [`postgresql-gecis-rehberi.md`](postgresql-gecis-rehberi.md) | Mimari ve Geçiş | SQLite'tan PostgreSQL'e geçiş hazırlığı ve uyarlama adımları |
| [`graphify-mimari-haritasi.md`](graphify-mimari-haritasi.md) | Geliştirici Kılavuzu | Graphify kod bilgi grafiği kullanımı, sorgulama ve güncellik kuralları |
| [`dokumantasyon-inceleme.md`](dokumantasyon-inceleme.md) | Belge Yönetimi | Dokümantasyon yapısı, birleştirme ve güncellik kaydı |
| [`denetim-raporlari/yonetici-denetim-raporu.md`](denetim-raporlari/yonetici-denetim-raporu.md) | Denetim ve Kabul Raporu | Yönetici paneli veri bütünlüğü sözleşmeleri, Excel/baskı/erişilebilirlik ve hibrit kurulum kabulü |
| [`denetim-raporlari/ogretmen-denetim-raporu.md`](denetim-raporlari/ogretmen-denetim-raporu.md) | Denetim ve Kabul Raporu | Öğretmen paneli yetki, anket düzenleme ve raporlama onarım kabulü |
| [`denetim-raporlari/ogrenci-denetim-raporu.md`](denetim-raporlari/ogrenci-denetim-raporu.md) | Denetim ve Kabul Raporu | Öğrenci paneli çevrimdışı sınav uzlaştırma, yönlendirme ve filtre onarım kabulü |
| [`denetim-raporlari/veli-denetim-raporu.md`](denetim-raporlari/veli-denetim-raporu.md) | Denetim ve Kabul Raporu | Veli paneli bağlı öğrenci erişim sınırları, duyuru ve baskı onarım kabulü |
| [`denetim-raporlari/entegrasyon-denetim-raporu.md`](denetim-raporlari/entegrasyon-denetim-raporu.md) | Denetim ve Kabul Raporu | E-posta, AI, Socket.IO, oturum yükü ve ortak UX onarım kabulü |
| [`denetim-raporlari/akademik-arsiv-kabul-raporu.md`](denetim-raporlari/akademik-arsiv-kabul-raporu.md) | Denetim ve Kabul Raporu | Akademik arşiv paketi sözleşmesi (`Format 2`) ve 50k hacim/tarayıcı kabul sonuçları |
