# SQLite'tan PostgreSQL'e Geçiş Rehberi

Bu belge QuizMaster'ın mevcut SQLite kurulumundan PostgreSQL'e güvenli biçimde geçirilmesi için hazırlanmıştır. Geçiş bugün zorunlu değildir; uygulama SQLite ile çalışmaya devam eder. Buradaki adımlar gerçek geçiş öncesinde ayrı bir geliştirme veya staging ortamında en az bir kez prova edilmelidir.

## 1. Mevcut uyumluluk durumu

### Doğrudan uyumlu olanlar

- Prisma modelleri, UUID tabanlı `String` kimlikler, ilişkiler, benzersiz alanlar ve çoğu indeks PostgreSQL tarafından desteklenir.
- Genel CRUD sorgularının çoğu Prisma Client üzerinden yürür; bu sorguların sağlayıcı davranışları geçiş provasına dahildir.
- `DateTime`, `Boolean`, `Int` ve isteğe bağlı alanlar PostgreSQL sağlayıcısında karşılık bulur.
- Anket soru ayarları ve cevaplarındaki JSON verileri şu anda `String` olarak saklandığından ilk geçişte veri türü dönüşümü gerektirmez.
- Anket tablolarında büyüme açısından önemli birleşik/bireysel indeksler vardır: `SurveySubmission(surveyId, submittedAt)`, `SurveySubmission(studentId)` ve `SurveyAnswer(questionId)`.

### Otomatik uyumlu olmayanlar

- Akademik arşiv, geçiş ve geçmiş projeksiyonu katmanları SQLite'a özel ham SQL, JSON fonksiyonları, tuple cursor ve transaction içi izin tabloları kullanır; bunlar doğrudan PostgreSQL uyumlu değildir.
- Snapshot değişmezliği, yıllık capture fence, finalization izinleri ve tek aktif yıl kuralı SQLite trigger/index SQL'iyle korunur. Yalnız Prisma şemasından üretilen migration bunları taşımaz; PostgreSQL karşılıkları ayrıca geliştirilip bypass/rollback/lease testleriyle doğrulanmalıdır.
- Arşiv worker, geçmiş projeksiyonu ve sorgu katmanındaki ham SQL ile tarih/boolean gösterimleri uyarlanmalıdır. Snapshot byte'ları, checksum ve arama eşitliği korunmalıdır.
- Bakım/yükseltme araçları standart yerel SQLite kurulumunu hedefler; PostgreSQL backup/restore ve hibrit kurulum desteği hazır değildir. Sağlayıcı adını değiştirmek çalışan bir PostgreSQL kurulumu oluşturmaz. `server/utils/sqlite-runtime-config.ts` içindeki `detectDatabaseProvider` ve `getDatabaseMigrationReadiness` yardımcıları, aktif `DATABASE_URL` sağlayıcısını (`sqlite` / `postgresql`) ve geçiş öncesinde tamamlanması gereken alt sistem uyarlamalarını (`prisma-schema-provider`, `archive-raw-sql`, `session-store`, `maintenance-backup`) programatik olarak doğrular.
- `server/prisma/migrations` içindeki SQL dosyaları ve `migration_lock.toml` SQLite'a özeldir. PostgreSQL üzerinde kullanılamaz.
- Prisma şema migration'ı mevcut kayıtları SQLite'tan PostgreSQL'e kopyalamaz.
- HTTP oturumları better-sqlite3 tabanlı depo ile ayrı bir `sessions.db` dosyasında tutulur. Ana veritabanını PostgreSQL yapmak oturum deposunu değiştirmez.
- Yüklenen soru görselleri dosya sistemindedir; veritabanı aktarımına dahil değildir.
- SQLite ve PostgreSQL'i kalıcı olarak farklı ortamlarda aynı migration geçmişiyle kullanmak güvenli değildir. PostgreSQL'e geçişten sonra geliştirme, test, staging ve üretimde aynı sağlayıcı tercih edilmelidir.

## 2. Geçişi başlatma ölçütleri

Aşağıdakilerden biri düzenli hale geldiğinde PostgreSQL geçişi planlanmalıdır:

- Eşzamanlı yazma işlemlerinde kilitlenme veya belirgin bekleme yaşanması,
- Anket cevapları, sınav sonuçları, bildirimler veya logların hızla büyümesi,
- Birden fazla backend örneğiyle yatay ölçekleme ihtiyacı,
- Merkezi yedekleme, replikasyon, yüksek erişilebilirlik veya gelişmiş gözlemleme gereksinimi,
- Rapor sorgularının SQLite sınırlarında yavaşlaması.

Karar yalnız dosya boyutuna göre verilmemelidir. P95 API süresi, eşzamanlı kullanıcı sayısı, yazma hataları, sorgu planları ve yedekleme/geri yükleme süreleri ölçülmelidir.

## 3. Geçiş öncesi hazırlık

1. Geçişi ayrı bir Git dalında ve üretim verisinin kopyası üzerinde prova edin.
2. Kullanılan commit'i, Node.js sürümünü, paket yöneticisi (npm/pnpm) sürümünü ve Prisma sürümünü kaydedin.
3. Uygulamayı bakım moduna alma veya kısa süreli yazma dondurma planı oluşturun.
4. Aşağıdaki varlıkları yedekleyin:
   - Ana SQLite veritabanı (`server/data/quiz.db` veya gerçek `DATABASE_URL` hedefi),
   - Oturum veritabanı (`sessions.db`; gerçek çalışma dizinini doğrulayın),
   - Yüklenen dosyalar/görseller,
   - Üretim `.env` değerlerinin güvenli secret-manager kopyası.
5. Yedeğin yalnız mevcut olduğunu değil, ayrı bir dizinde açılabildiğini ve kayıtların okunabildiğini doğrulayın.
6. UTF-8 kodlamalı, boş bir PostgreSQL geliştirme/staging veritabanı oluşturun. Uygulama kullanıcısına yalnız gereken şema yetkilerini verin.

Parola içeren bağlantı adreslerini komut geçmişine, README'ye veya Git'e yazmayın. Örnek biçim:

```env
DATABASE_URL="postgresql://quizmaster_user:GUCLU_PAROLA@db-host:5432/quizmaster?schema=public"
```

## 4. PostgreSQL migration geçmişini oluşturma

Bu bölüm gelecekteki geçiş geliştirmesi içindir; tamamlanmış geçiş komutu değildir. Ham SQL, trigger, bakım ve oturum bağımlılıkları uyarlanmadan canlıya uygulanmamalıdır. İzole prova önce sentetik veriyle yapılmalıdır; gerçek veri kopyası ancak kurumun veri erişimi/yedekleme süreci kapsamında kullanılır.

Prisma migration SQL'i sağlayıcıya özeldir. Bu nedenle mevcut SQLite migration klasörü düzenlenmemeli ve PostgreSQL'e uygulanmamalıdır.

1. Mevcut `server/prisma/migrations` klasörünü Git geçmişinde koruyun ve geçiş dalında `migrations-sqlite` gibi Prisma'nın aktif migration yolu dışında bir yere arşivleyin.
2. `server/prisma/schema.prisma` içindeki datasource değerini değiştirin:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

3. `DATABASE_URL` değerini boş PostgreSQL geliştirme veritabanına yönlendirin.
4. Şemayı doğrulayın ve yeni başlangıç migration'ını üretin:

```bash
npm run db:validate --workspace=server
npm run db:migrate --workspace=server -- --name init_postgresql
npm run db:generate --workspace=server
```

5. Üretilen PostgreSQL SQL'ini inceleyin. Tablo, yabancı anahtar, silme davranışı, benzersiz kısıt ve indekslerin Prisma şemasıyla aynı olduğunu doğrulayın.
6. Yeni migration geçmişini uygulama koduyla birlikte Git'e alın. Uygulanmış migration dosyalarını sonradan elle değiştirmeyin.

Üretim ve staging ortamlarında yalnız aşağıdaki komut kullanılmalıdır:

```bash
npm run db:deploy --workspace=server
```

`prisma migrate dev` geliştirme içindir; üretimde kullanılmamalıdır. `prisma db push`, izlenebilir production migration geçmişinin yerine kullanılmamalıdır.

## 5. Verileri taşıma

Veri aktarımı şema migration'ından ayrı bir iştir. Prisma komutları SQLite kayıtlarını PostgreSQL'e otomatik kopyalamaz.

Aktarım aracı veya tek kullanımlık ETL betiği şu kurallara uymalıdır:

- Var olan UUID kimliklerini değiştirmemeli,
- Kullanıcı-sınıf, öğretmen-ders-sınıf, sınav-sınıf ve veli-öğrenci bağlantılarını korumalı,
- Üst kayıtları alt kayıtlardan önce aktarmalı,
- Prisma'nın örtük çoktan-çoğa ilişki tablolarını doğrulanmış biçimde ele almalı,
- Tarihleri aynı zaman anlamıyla aktarmalı,
- `String` içindeki JSON alanlarını bozmadan ve yeniden kodlamadan taşımaya çalışmalı,
- Parola özetlerini aynen taşımalı; düz metne dönüştürmemeli,
- Hatalı satırları sessizce atlamamalı ve tekrar çalıştırılabilir/izlenebilir olmalı.

Önerilen yöntem, canlı kesintiden önce üretim verisinin kopyasıyla uygulamaya özel bir ETL provasını tamamlamak ve aktarım raporunu saklamaktır. Doğrulanmamış genel bir SQL dönüştürücü doğrudan canlı veride kullanılmamalıdır.

### Aktarım sonrası asgari doğrulama

Kaynak ve hedefte aşağıdaki model kayıt sayılarını karşılaştırın:

- `User`, `Class`, `Category`, `ClassTeacherCourse`, `GuardianStudent`,
- `Quiz`, `Question`, `QuestionBank`,
- `StudentResult`, `SurveySubmission`, `SurveyAnswer`,
- `Announcement`, `Notification`, `ActionLog`,
- `PasswordResetRequest`, `EmailQueue`.

Sayı eşitliği tek başına yeterli değildir. Ayrıca en az şunları kontrol edin:

- Her sınav ve anketin atandığı sınıflar,
- Her öğretmenin yetkili sınıf ve dersleri,
- Her velinin bağlı öğrencileri,
- Tamamlanmış sınavların puan ve cevapları,
- Anketlerde tekli, çoklu, Likert, derecelendirme ve açık uçlu cevap örnekleri,
- Yetim yabancı anahtar kaydı bulunmaması,
- Aynı öğrencinin aynı ankete ikinci kez katılmasının benzersiz kısıtla engellenmesi.

## 6. Oturum deposu

Mevcut backend better-sqlite3 tabanlı yerel oturum deposunu kullanır. Tek backend örneğinde ana veritabanı PostgreSQL olsa bile teknik olarak çalışabilir; fakat aşağıdaki durumlarda uygun değildir:

- Birden fazla backend örneği,
- Konteyner/instance yeniden oluşturma,
- Paylaşımsız yerel disk,
- Yüksek erişilebilirlik ve merkezi oturum iptali ihtiyacı.

Üretim geçişinden önce PostgreSQL uyumlu bir session store veya Redis gibi merkezi bir store seçin. Değişiklik yapılırken mevcut `express-session` cookie güvenliği, `SESSION_SECRET`, oturum yenileme ve CSRF davranışı korunmalıdır. Aşağıdaki senaryolar mutlaka test edilmelidir:

- Giriş/çıkış ve “beni hatırla” davranışı,
- Oturum kimliği yenileme,
- Rol değişikliğinin mevcut oturuma etkisi,
- Bir backend örneğinde açılan oturumun diğer örnekte kullanılabilmesi,
- Süresi dolmuş oturumların temizlenmesi.

Merkezi store geçişinde `server/utils/session-store.ts` ve oturum regresyonları birlikte uyarlanmalıdır. better-sqlite3 uygulama, arşiv ve bakım yollarında da kullanılır; yalnız oturum geçişi bu bağımlılığı kaldırmak için yeterli değildir.

## 7. JSON alanları için ikinci aşama

İlk PostgreSQL geçişinde aşağıdaki alanların `String` kalması bilinçli ve geriye uyumlu seçimdir:

- `QuestionBank.options`,
- `Question.options`,
- `Question.config`,
- `StudentResult.answers`,
- `SurveyAnswer.value`.

Bu alanlarda veritabanı taraflı JSON sorgusu veya indeksleme gerektiğinde ayrı bir expand-and-contract migration planlayın: önce yeni `Json` alanlarını ekleyin, mevcut değerleri doğrulayıp kopyalayın, uygulamayı bir süre çift okuyup/yazacak biçimde yayınlayın, doğrulama tamamlanınca eski metin alanlarını kaldırın. Tek adımda tür değişikliği yapmayın. PostgreSQL sağlayıcısında Prisma `Json` alanı varsayılan olarak `jsonb` ile eşlenir.

## 8. Uygulama ve regresyon testleri

Geçiş provasından sonra çalıştırın:

```bash
npm run db:status --workspace=server
npm run db:validate --workspace=server
npm run test --workspace=server
npm run test --workspace=client
npm run build
npm run test:e2e
```

Manuel olarak tüm rollerde şu akışları doğrulayın:

- Admin/öğretmen/öğrenci/veli giriş ve yetki sınırları,
- Öğretmen sınıf ve ders kapsamı,
- Sınav oluşturma, yayınlama, çözme, çevrimdışı teslim ve sonuçlandırma,
- Anket oluşturma, katılım ve sonuç grafikleri,
- Bildirim, duyuru, silme ve sessize alma,
- Veli-öğrenci bağlantıları,
- `User.isActive` / `deactivatedAt` ile öğrenci pasiflik durumu,
- sınıf içinde benzersiz otomatik öğrenci numarası için `User(classId, studentNo)` birleşik benzersizliği,
- Gmail parola sıfırlama Outbox akışı,
- Excel ve yazdırma çıktıları,
- Görsel yükleme ve mevcut görsellere erişim.

## 9. Canlıya geçiş ve geri dönüş

1. Yeni yazmaları bakım moduyla durdurun.
2. Son SQLite ve dosya yedeğini alın; geri yüklemeyi tekrar doğrulayın.
3. Son veri farkını PostgreSQL'e aktarın.
4. Sayım, ilişki ve örnek iş akışı kontrollerini çalıştırın.
5. Backend secret'ındaki `DATABASE_URL` değerini PostgreSQL'e çevirin ve migration için doğrudan bağlantı kullanın.
6. `prisma migrate deploy` çalıştırın, uygulamayı yayınlayın ve hata/latans metriklerini izleyin.
7. Önceden belirlenen kabul ölçütleri sağlanmazsa yazmaları tekrar açmadan eski sürüm ve SQLite yedeğine dönün.

Geri dönüş planı PostgreSQL'de oluşan yeni yazmaların nasıl ele alınacağını açıkça belirtmelidir. İki veritabanına aynı anda kontrolsüz yazma yapılmamalıdır.

## 10. Geçiş sonrası büyüme ve bakım

PostgreSQL'e geçiş tek başına sınırsız ölçek sağlamaz. Anket ve sınav verileri büyürken aşağıdaki işletim kuralları uygulanmalıdır:

- Otomatik yedek, saklama süresi ve mümkünse belirli bir zamana geri dönme (PITR) yapılandırın; geri yükleme provasını düzenli yapın.
- Backend bağlantı sayısını PostgreSQL sınırlarına göre ayarlayın. Birden fazla uygulama örneğinde uygun bir bağlantı havuzu kullanın; migration komutlarını doğrudan veritabanı bağlantısıyla çalıştırın.
- Yavaş sorguları ve P95/P99 API sürelerini izleyin. Yeni indeksleri tahminle değil gerçek sorgu planı ve kullanım ölçümüyle ekleyin.
- PostgreSQL autovacuum durumunu, tablo/indeks büyümesini ve disk doluluğunu izleyin.
- `ActionLog`, eski `Notification` ve tamamlanmış `EmailQueue` kayıtları için kurumun saklama politikasına uygun arşivleme/temizleme işi tanımlayın.
- Anket ve sınav sonuçlarında hukuki/kurumsal saklama süresi belirlenmeden toplu silme uygulamayın.
- Görsel dosyalar büyüdüğünde yerel disk yerine yetkilendirilmiş nesne depolama düşünün; veritabanında yalnız güvenli dosya anahtarı/URL tutun.
- Büyük listelerde API sayfalamasını koruyun; tüm anket cevaplarını tek istekte belleğe yükleyen raporlar oluşturmayın.

## 11. Resmî başvuru kaynakları

- [Prisma Migrate sınırlamaları ve sağlayıcı değiştirme](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/limitations-and-known-issues)
- [Prisma migration geçmişleri](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/migration-histories)
- [Prisma Migrate CLI komutları](https://www.prisma.io/docs/orm/reference/prisma-cli-reference#migrate)
- [Prisma veri migration'larında expand-and-contract yaklaşımı](https://www.prisma.io/docs/guides/data-migration)
- [Prisma PostgreSQL bağlantısı](https://www.prisma.io/docs/orm/overview/databases/postgresql)

> Not: Depodaki Prisma ana sürümü değiştirildiğinde komutlar ve migration davranışı yeniden resmî belgelerden doğrulanmalıdır. Bu rehber mevcut Prisma 5 tabanlı proje için hazırlanmıştır.
