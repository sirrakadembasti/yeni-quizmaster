# Yönetici denetimi: öğrenci, öğretmen, sınıf ve veli yönetimi

Tarih: 30 Eylül 2026. Kapsam yalnız yönetici ekranları ve bunların API/storage eşleşmeleri. Üretim kodu veya gerçek veritabanı değiştirilmedi. `api.ts` ve `server-setup.tsx` üzerindeki mevcut değişikliklere dokunulmadı.

## Yöntem ve kanıt sınırı

Kod incelemesi, gerçek storage/Prisma ve gerçek auth middleware ile Express API entegrasyon testleri yapıldı. Fixture, üretimde `server/index.ts:81` üzerinden kurulan `secureJsonReplacer` filtresini de kullanır. Gerçek giriş, CSRF/rate-limit, tarayıcı etkileşimi, ekran okuyucu, mobil yerleşim, yazdırılan sayfa ve indirilen CSV görsel olarak denenmedi. Bunlar geçti sayılmaz. Testler mevcut `server/vitest.config.ts` ve `server/tests/global-setup.ts` aracılığıyla `server/data/quizmaster-test-*` altında ayrı SQLite veritabanına migrate deploy eder ve sonunda bu geçici dizini temizler.

## Ekran ve eylem envanteri

| Ekran/bölüm | Eylem ve API | İnceleme kontrolü |
|---|---|---|
| `/students` öğrenci tablosu | Ad/e-posta arama, sınıf filtresi, CSV (Excel etiketli), yazdır; `GET /api/users`, `GET /api/classes` | Yönetici tüm aktif öğrencileri görür; boş/yükleme/hata, arama normalizasyonu, sınıf adları, no ve veli alanlarının export'u |
| Yeni öğrenci modalı | Ad, e-posta, parola, sınıf; otomatik sınıf no; telefon/adres, opsiyonel bütün veli iletişim alanları; `POST /api/users` | Zorunlu alanlar, e-posta eşsizliği, boş sınıf, parola >=6, eksik veli bilgisi reddi, hata/pending |
| Öğrenci satırı | Detay: `/student/results?studentId=...`; Pasife Al onayı: `DELETE /api/users/:id` | Öğrenci sonuçları kapsamı başka denetim parçasında; pasife alma sınıf ve sonuç geçmişini korur, aktif listeden kaybolur |
| `/teachers` | Ad/e-posta arama, CSV, yazdır; Yeni Öğretmen; Detay; Düzenle atama modalı; Sil onayı | Sorumlu sınıflar, dersler ve dersine girilen sınıflar; `GET/POST/PATCH/DELETE /api/users` |
| Öğretmen yeni modalı | Profil/parola + ders ve sınıf checkbox'ları, seçili badge/X kaldırma | POST atama verisini gerçekten kaydediyor mu; checkbox ile badge erişilebilirliği |
| Öğretmen düzenleme modalı | Yalnız `assignedCategoryIds`, `classIds` gönderimi | Görünen birleşik atamalar ile düzenlenebilir legacy ilişkilerin tutarlılığı |
| `/teachers/:id` | Profil, branşlar, sorumlu sınıflar, ders sınıfları, ilk 10 oluşturduğu sınav; geri, CSV, yazdır, profil düzenle, sil | Users/quizzes/classes yükleme ve hata, doğru rol/ID, sınıf linkleri, güncel atama |
| `/classlist` | Sınıf arama, mevcut/öğretmen tablosu, CSV, yazdır, `/classes/:id` detay | Sayıların users ile hesaplanması, bağımsız sorgu yükleme/hata, yönetici route'u |
| `/classes/:id` | Salt okunur sorumlu öğretmen/branş atamaları, öğrenci listesi, isim filtresi, CSV/yazdır/geri | Boş/hata, filtrelenmiş export, yönetim ekranına ulaşım; burada atama eylemi yok |
| `/admin/classes/:id` | Sorumlu öğretmen seç/kaydet/kaldır; öğrenci nakil/atama; seviye onayı; branş öğretmen+ders ata; öğrenci çıkar; branş atamasını kaldır; isim arama, CSV/yazdır/geri | `GET /api/classes/:id`, users/categories/classes; `PATCH /api/classes/:id`, `POST/DELETE /api/classes/:id/students`, `POST /api/classes/:id/teachers-with-course`, `DELETE /api/classes/teacher-course/:assignmentId` |
| `pages/admin/class-detail.tsx` | `admin-class-detail` re-export | Ayrı davranış yok; aynı bileşen incelendi |
| `/guardian-management` | Veli seçimi, öğrenci adı/e-posta/sınıf/no arama, öğrenci seçimi, Anne/Baba/Diğer, bağla, bağlı öğrenciler, kaldır | `GET /api/users`, `GET /api/parents`, `GET /api/parents/guardian/:id/students`, `POST /api/parents/link`, `DELETE /api/parents/link/:guardianId/:studentId`; query studentId başlangıcı |
| İlgili veli API'leri | Veli oluştur/güncelle, öğrenci velileri, toplu bağlantı güncelle, yakınlık değiştir | Admin rolü, UUID ve relation enum, pasif öğrenci kontrolü, atomiklik; bu işlemlerin öğrenci sonuç ekranındaki UI'si bu dosya kapsamı dışında |
| Ek sınıf API'leri | Sınıf oluştur/güncelle/sil, legacy öğretmen bağla/çıkar, sınıfa ders bağla/çıkar, öğretmene ders bağla/çıkar | Admin guard, rol/FK/doğrulama, ilişkilerin tutarlılığı; yönetim ana ekranı başka denetim parçasında |

Bu ekranlarda Tabs bileşeni ile ayrı sekme yok; modal, kart ve liste bölümleri yukarıda ayrı envanter maddeleridir. UI rol sınırları `client/src/App.tsx:115–127` içindedir: students/classlist/detail teacher+admin, admin sınıf detay/teachers/guardian-management admin.

## Doğrulanmış bulgular

### PE-01 — P1: yeni öğretmenin seçtiği ders ve sınıflar sessizce kayboluyor

Kanıt: `UserFormModal.tsx:56–57, 160–177, 305–369` seçimleri toplar ve oluşturma halinde gönderir. `server/api-routes/user.ts:120–122, 166–183` POST payload'ına `assignedCategoryIds/classIds` eklemez. `storage.ts:278–311` createUser da öğretmen ilişkilerini oluşturmaz.

Adımlar: Yeni Öğretmen > geçerli profil/parola > bir ders ve sınıf seç > Hesabı Oluştur > kaydı tekrar aç. Beklenen: seçilen ders/sınıf kayıtlı olur. Gerçek: HTTP 201 ve başarı bildirimiyle hesap oluşur; her iki ilişki boş kalır. Etki: yeni öğretmen seçilen sınıf/ders yetkisini alamaz, yöneticinin başarılı sandığı işlem eksiktir. API testi gerçek DB'de bu sonucu kanıtlar.

Düzeltme: atama kimliklerini rol/varlık doğrulamasıyla oluşturma transaction'ına dahil edin. Kabul: geçerli seçimler reload sonrası aynen korunur; geçersiz ID/rol 400 üretir ve yarım hesap oluşmaz; boş atama da desteklenir.

### PE-02 — P1: atama değişiklikleri farklı query key'lerde eski yönetici verisini bırakıyor

Kanıt: `classlist.tsx:34,39` `/api/classes` ve `/api/users`; `teacher-detail.tsx:53` `/api/classes`; `UserFormModal.tsx:66–77` `/api/classes` ve `/api/categories`; yönetim detayı `admin-class-detail.tsx:59,65,70,75` classes/users/categories kullanır. Mutasyonlar `admin-class-detail.tsx:107–169` yalnız classes/users; kullanıcı hook'u `use-user-management.ts:19,31,44` yalnız users invalidasyonu yapar. `queryClient.ts:49–50` focus refetch kapalı ve staleTime Infinity.

Adımlar: önce classlist/öğretmen detayı/formu açarak ilgili key'i cache'e al; admin sınıf detayında öğrenci taşı veya sorumlu/branş öğretmeni değiştir; önceki ekrana dön. Beklenen: güncel mevcut ve atamalar. Kodun kesin sonucu: ilgili `/api/...` cache anahtarı invalidate edilmez, Infinity nedeniyle tekrar mount'ta fresh kalır. Tarayıcıda fiilen tıklama testi yapılmadı. Etki: yönetici yanlış mevcut/öğretmen ataması görür, export da eski veriyi kullanır.

Düzeltme: merkezi query key factory ve ilişki değişikliği invalidasyon haritası. Kabul: öğrenciyi taşıma/pasife alma, öğretmen ders/sınıf düzenleme ve sorumlu öğretmen değiştirme sonrası ilgili tüm ekranlar manuel yenilemeden güncellenir; export da aynı sonucu içerir.

### PE-03 — P2: ders atama API'si öğrenci hesabını öğretmen olarak kabul ediyor

Kanıt: `class.ts:256–262` yalnız admin guard sonrası body'yi doğrudan storage'a iletir; `storage.ts:559–575` rol kontrolü olmadan upsert yapar. Şema `schema.prisma:150–157` User FK'sıdır, teacher rolünü şart koşmaz. Legacy endpoint `class.ts:140–146` rol kontrolü yaparken yeni üçlü endpoint yapmaz.

Adımlar: admin olarak teachers-with-course isteğinde geçerli student ID ve category ID gönder. Beklenen: 400, ilişki yok. Gerçek: 200; teacherAssignments.teacher.role='student' DB'de oluşur. UI mevcut dropdown teacher filtresiyle normal tıklamayı sınırlar, API doğrudan/replay/import hatasına açıktır. Etki: sınıf öğretmen listesi ve öğretmen ilişkileri semantik olarak bozulur.

Düzeltme: UUID schema, sınıf/kategori/öğretmen varlığı ve teacher rolü; uygun 400/404. Kabul: öğrenci/admin/parent kimliği reddedilir ve DB değişmez; geçerli/tekrarlı atama tutarlı sonuç verir.

### PE-04 — P2: maxStudents saklanıyor ancak kayıt/nakilde kapasiteyi sınırlamıyor

Kanıt: `class.ts:15`, `storage.ts:593,629` kapasite alanını kabul/saklar; `class.ts:163–183`, `storage.ts:278–297,396–406,685–687` yeni kayıt ve nakilde sayı/kapasite kontrolü yapmaz.

Adımlar: maxStudents=1 sınıfında bir öğrenci varken ikinci öğrenciyi atayın. Beklenen (kapasite alanı kural ise): 409/400, eski sınıfı/no korunur. Gerçek: 200 ve iki aktif öğrenci. API testi kanıtlar. Etki: kapasite raporu/kullanıcı beklentisiyle DB uyuşmaz. Öncelik P2; ürünün kapasiteyi yalnız bilgi kabul etmesi halinde davranış açıkça belgelenmeli.

Düzeltme: tüm öğrenci kayıt/nakil yollarında transaction içinde kapasite kontrolü. Kabul: create/patch/assignment yolları aynı kuralı uygular; eşzamanlı son kontenjan taleplerinden yalnız biri başarılı olur; kapasitesi boş sınıf sınırsızdır.

### PE-05 — P1: sorumlu öğretmeni kaldırmak ilk oluşturmadaki legacy sınıf erişimini kaldırmıyor

Kanıt: `storage.ts:594–599` createClass sorumlu öğretmeni teachers ilişkisine de ekler. `storage.ts:624–630` updateClass yalnız classTeacherId değiştirir. `storage.ts:662–669` getClassesByTeacher eski teachers ilişkisini yetki olarak kabul eder. UI `admin-class-detail.tsx:240,251–253` “Atamayı Kaldır” seçeneğini null gönderir.

Adımlar: sorumlu öğretmen ile sınıf oluştur > admin sınıf detayında Atamayı Kaldır > Kaydet > eski öğretmenin sınıf erişimini kontrol et. Beklenen: ayrı gerçek branş/yardımcı ataması yoksa erişim kaldırılır. Gerçek: classTeacherId null olur, ilk oluşturma kaynaklı teachers ilişkisi kalır; eski öğretmen getClassesByTeacher ile sınıfı görür. Ek API testi bu ilişki ve erişim kalıntısını doğrular. Etki: yönetici kaldırdığını sandığı öğretmen öğrencileri görüntüleme/değiştirme yetkisini koruyabilir. Mevcut tasarımda legacy üyelik ayrıca amaçlanmışsa UI bunun devam ettiğini açıkça göstermelidir.

Düzeltme: ilişki kaynağını modelleyin; sorumlu atamasıyla otomatik yaratılan legacy üyeliği kaldırın, bağımsız ders ilişkisini koruyun. Kabul: bağımsız ataması olmayan eski sorumlu erişemez; bağımsız ataması olan öğretmen ilgili rolüyle kalır; UI kalan yetkiyi açıkça gösterir.

### PE-06 — P2: sınıf ve veli bağlantısı işlemlerinde hatalar kullanıcıya görünmüyor

Kanıt: `admin-class-detail.tsx:104–162` öğrenci ekle/çıkar ve branş ata/kaldır mutasyonlarında onError yok; yalnız sorumlu öğretmende `:173` var. `guardian-management.tsx:30` unlink onError ve pending disable yok. `guardian-management.tsx:23–25,41` query yükleme/hata durumları yok; data yokluğu “bağlı öğrenci yok” gibi sunulur. Students/teachers/classlist sorguları da isError durumunu ayrı göstermiyor.

Adımlar: bu isteklere 403/404/500 veya ağ kesintisi simüle et. Beklenen: açıklayıcı hata, tekrar deneme, pending sırasında çift istek engeli, mevcut liste korunur. Kod sonucu: hata toast'ı tanımlı değil; boş veya eski liste kalır, kaldırma düğmesi tekrar tıklanabilir. Çalışan tarayıcı hata enjeksiyonu yapılmadı; handler eksikliği statik olarak doğrulanmıştır. Etki: kullanıcı işlemin sonucunu ayırt edemez.

Düzeltme/kabul: her sorguya yükleme/hata/retry; tüm mutasyonlara Türkçe hata ve pending; başarılı refresh doğru entity anahtarını hedefler. Ağ/4xx/5xx senaryoları test edilmelidir.

### PE-07 — P2: kritik ikon eylemleri klavye ve erişilebilir ad desteğinden yoksun

Kanıt: `UserFormModal.tsx:314,350` seçili atamayı silen X doğrudan SVG onClick, button/tabIndex yok; `UserManagementTable.tsx:184–186` yalnız MoreHorizontal içeren düğmede aria-label yok; `admin-class-detail.tsx:368,391` öğrenci/branş silme ikonlarında aria-label yok ve görünürlük hover'a bağlı. Form label'ları `UserFormModal.tsx:181–208,218–290` Input id/htmlFor eşleştirmesi içermez; veli Select/Input'ları `guardian-management.tsx:35–38` programatik label almaz.

Adımlar: yalnız Tab/Enter ile seçili badge kaldırmayı ve ekran okuyucuda eylem adlarını dene. Beklenen: her eylem odaklanır, öğrenci/atama adıyla okunur. Kod sonucu: SVG kaldırma kontrolü doğal odaklanabilir değil; ikon düğmelerinin erişilebilir adı yok. Ekran okuyucu çalıştırılmadı. Düzeltme/kabul: button + aria-label, focus-visible görünürlük, id/htmlFor veya aria-labelledby; bütün kontroller klavyeyle çalışır.

## Ek statik kusurlar ve ürün kararı gerektiren noktalar

- `admin-class-detail.tsx:91–95` farklı seviyedeki öğrencileri seçimden tamamen filtreler; `:125–130` farklı seviyeye nakil onayı normal tutarlı veriyle ulaşılamaz. Seviye geçişi amaçlanıyorsa “tüm öğrenciler/seviye dışı” yolu eklenmeli. Kod doğrulaması var, ürün kuralı belirsiz; P3.
- `teacher-detail.tsx:327` sınavları slice(0,10) gösterir; toplam rozet tüm kayıtları sayar ve devamını açma yok. 11+ sınavda geçmiş eksik görünür; pagination veya tümünü gör bağlantısı kabul ölçütü; P3.
- `storage.ts:641–660` sınıf silme teacherAssignments sayısını okur ama yalnız öğrenci sayısını engeller; schema.prisma:153 öğretmen atamalarını cascade siler. Hata metni öğretmenlerin boşaltılmasını da söyler fakat uygulanmaz. Doğrudan API için P2 veri kaybı riski; silme kapsamı ana yönetim denetimiyle birlikte değerlendirilmelidir, burada runtime testi yok.
- `parent.ts:109–122` toplu guardian öğrencileri güncelleme aktiflik kontrolü yapmaz; `storage.ts:490–500` her bağı 'Diğer' olarak yeniden oluşturur. Mevcut Anne/Baba yakınlığını koruyan tasarım gerekli; kullanıcı formundan tekrar kaydetmeyle sıfırlanma akışı diğer ekranın denetiminde doğrulanmalıdır. Bu raporda statik kanıt, runtime testi yok.
- `UserFormModal.tsx:86–87` classIds yalnız managedClasses'tan, assignedCategoryIds birleşik assignedCategories'ten hazırlanır. Üçlü ders atamasıyla görünen sınıflar boş seçili görünebilir; kategori işaretini kaldırmak üçlü atamayı kaldırmaz (`storage.ts:357–366`). Atama listesi/üçlü ilişki için tek açık düzenleme modeli önerilir; runtime UI testi yok.
- `storage.ts:634–638` updateClass DB/FK hatalarını undefined'a çevirir; `class.ts:122` var olan sınıf için geçersiz FK'yi 404 “Sınıf bulunamadı” diye sunabilir. Error ayrımı ve geçersiz teacher rolü/ID doğrulaması gerekir; runtime testi yok.

## Başarılı mevcut kontroller

- Yönetici route guard'ları ve backend requireRole bağımsız mevcut; non-admin mutasyonları için API testi 403 beklentisini doğrular.
- `user.ts:124–145, 204–211, 311–334` isim/e-posta/parola/veli iletişimi, e-posta normalize/eşsizliği ve ebeveyn zorunlu iletişimi kontrol edilir.
- `parent.ts:8–38,146–165` UUID ve relation enum; doğrudan link/create pasif öğrenci reddi mevcut.
- Öğrenci pasife alma `user.ts:363–367`, `storage.ts:467–477`: geçmiş korunur, aktif kullanıcı/sınıf/veli listelerinde aktiflik filtrelenir; auth middleware pasif oturumu reddeder.
- Sınıf öğrenci ekleme/çıkarma öğretmen ownership ve öğrenci rolünü kontrol eder (`class.ts:169–181,195–205`).
- `storage.ts:396–414` nakil öğrenci no'sunu hedef sınıfın max+1 değeriyle transaction içinde üretir; şema sınıf/no eşsizliğini zorlar.
- Parola/hash/reset token alanlarının relation include'dan HTTP'ye sızdığı ilk hipotez geri çekildi: `index.ts:81` ve `utils/json-security.ts:1–19` tüm derinlikte güvenli serializer kurar. Fixture bunu kullanır; regresyon testleri sınıf, öğretmen ve guardian iç içe yanıtlarının güvenli olduğunu kontrol eder.

## Testler ve kapsam

Yeni dosya: `server/tests/api/admin-audit-people.test.ts`. Komut: `pnpm --dir server test tests/api/admin-audit-people.test.ts`. Gerçek storage, gerçek requireAuth/requireRole, üretim JSON replacer; socket disconnect stub. Örnek kullanıcılar ve ilişkiler yalnız izole DB'de oluşturulur. Test assertion'larının bazıları mevcut hatalı davranışı ispatlayan characterization testidir; yeşil sonuç kusurun düzeldiği anlamına gelmez.

Kapsam: class detail ve assigned teacher student read secret filtering; guardian link nested secret filtering; teacher create atama kaybı; student teacher assignment; kapasite aşımı; admin yetki sınırı; responsible teacher kaldırmada legacy yetki kalıntısı. Son üretim serializer'lı çalışma: **1 dosya, 8/8 test geçti**, 30 Eylül 2026 15:47:36 başlangıç, 136.16 saniye toplam (testler 35.05 saniye). Önceki doğrulama da 8/8 geçti. `git diff --check` çıkış kodu 0; mevcut api.ts/server-setup.tsx CRLF uyarıları dışında whitespace hatası yok.

Sayısal statement/branch coverage ölçülmedi. UI/CSV/print/eşzamanlı transaction/gerçek session lifecycle kapsam dışı ve denenmemiştir. Bunlar manuel kabul kontrolü olarak açık kalır.

## Sonraki gerçek arayüz test dosyası

`tests-e2e/admin-audit-people-flows.spec.ts` dört tarayıcı senaryosu ekler: öğrenci modalından kayıt ve otomatik no; öğretmen modalından seçilen ders/sınıfın kalıcı olması; veli bağlantısı ekle/kaldır ve reload; aynı seviyede sınıflar arası öğrenci nakli. Her senaryo bağımsız UUID kayıtlarını CSRF korumalı gerçek API ile yalnız geçici denetim sunucusunda üretir; `audit-*` başlangıç fixture'larına yazmaz. Öğretmen senaryosu düzeltilmesi gereken davranışı bekler ve mevcut atama kaybında başarısız olmalıdır. Dosya burada tarayıcıda çalıştırılmadı; ana denetim route suite'i bittikten sonra koordinatör çalıştıracaktır. Mevcut admin-audit Playwright config testMatch yalnız ilk route suite'ini seçtiğinden yeni dosya çalıştırma yapılandırmasına ayrıca dahil edilmelidir. Production/config dosyası değiştirilmedi.

### Koordinatör tarayıcı doğrulaması — 30 Eylül 2026

Dört gerçek Chromium senaryosu izole 5510/5511 sunucusunda çalıştırıldı. Öğrenci oluşturma/otomatik numara, veli bağlama-kaldırma/yenileme ve aynı seviyede nakil geçti. Öğretmen oluşturma senaryosu beklenen kalıcı ders/sınıf atamasında başarısız oldu: arayüz seçimleri kabul edip başarı gösterirken API/DB ilişki dizileri boş kaldı (PE-01). Kanıt: [ilk akış sonucu](./results-flows-initial.json) ve [öğretmen hata izi](./flow-failures/). Yukarıdaki “çalıştırılmadı” ifadesi alt görev teslimindeki durumdur; nihai durum bu ektir.

### Düzeltme durumu — ilk paket

PE-01 için yönetici öğretmen oluşturma isteğindeki ders/sınıf kimlikleri doğrulanıp mevcut `createUser` transaction'ı içinde bağlandı. İki kabul testi önce mevcut kodda başarısız oldu: seçimler kayboldu ve geçersiz sınıf kimliği 201 üretti. Düzeltmeden sonra izole gerçek Prisma/API dosyası **9/9 geçti**; geçerli ilişkiler yeniden okumada mevcut, geçersiz kimlik 400 ve hesap oluşturulmuyor. [Hedefli gerçek Chromium akışı](./results-teacher-fix.json) da **1/1 geçti**; seçilen ders ve sınıf yeniden yüklemede korundu. İlk tarayıcı tekrarı ürün assertion'ına ulaşmadan Vite gezinmesinde zaman aşımı aldı; test süresi artırıldıktan sonra aynı izole senaryo geçti. PE-02–PE-07 bu pakette değiştirilmedi.

### Düzeltme durumu — ikinci paket

PE-02: kullanıcı/sınıf/atama mutasyonları ortak `invalidateAdminRelations` kullanır. Hem adlandırılmış hem `/api/...` kullanıcı, sınıf ve kategori anahtarları; öğretmen sınıfları ve sınıf istatistikleri yenilenir. Aktif sorgular yeniden yüklenir, pasif cache eskimiş işaretlenir. [Gerçek QueryClient/QueryObserver regresyonu](../../client/src/test/admin-cache.test.tsx) önce eski sınıf değerini yeniden üretti, düzeltme sonrası **1/1 geçti**; ilgisiz cache korunur. [Chromium kontrolü](./results-cache-fix.json) **1/1 geçti**: sınıf listesi önce açıldı, aynı SPA oturumunda admin sınıf detayından öğrenci çıkarıldı, listeye sayfa yenilemeden dönüldüğünde mevcut1'den0'a düştü. API/DB'de sınıf bağı da kaldırılmıştı. Diğer PE bulguları açık; özellikle eski ikinci öğretmen bağının kökeni veride bulunmadığı için PE-05 ürün tercihi yanıtını bekler.
