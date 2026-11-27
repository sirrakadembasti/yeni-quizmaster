# QuizMaster — Devir Notu (21 Kasım 2026)

Bu not, yol haritası görevlerini (`docs/yol-haritasi.md`) uygulayan oturumdan sonra çalışacak kişi ya da yapay zekâ ajanı içindir. Önce bunu, sonra `docs/guvenlik-ve-bakim.md` içindeki "Yol haritası düzeltmeleri" tablosunu okuyun. `docs/yol-haritasi.md` depoya eklenmemiş **yerel** bir belgedir (commit edilmez).

> Doğrulama notu: Aşağıdaki bilgiler oturum içinde kod okunarak ve testlerle doğrulanmıştır. Uygulamanın tamamı (arşiv/akademik yıl, AI yönetimi, istemci sayfalarının çoğu) bu oturumda **ayrıntılı incelenmedi**; oralar için kodu ve ilgili kılavuzu kendiniz okuyun.

## 1. Durum

Yol haritasındaki bütün görevler `main`'de birleşik (G-01…G-07, S-01…S-09, P-01…P-04, T-01…T-03, T-05; T-04 işlem gerektirmiyordu). Açık PR yok. Görev başına PR numaraları `docs/guvenlik-ve-bakim.md` tablosundadır.

Kullanıcının verdiği kararlar:

| Konu | Karar |
|---|---|
| S-03 açık kayıt | `ALLOW_SELF_REGISTRATION`, varsayılan **açık**; kurulum sihirbazı ve CLI de sorar |
| S-04 parola | Herkes için en az **8** karakter |
| S-09 yedek | Varsayılan **açık**, günlük, son **7**, `uploads` dahil (artımlı yansı), hedef `server/backups/auto/`; dış kopya: ağ paylaşımı, günlük, son **14** (`BACKUP_OFFSITE_DIR`, #71) |
| P-01 adım 1 | Doğru sayısı cevap kaydında hesaplanmaz; devam eden sınavda CSV'de `-`, listede `—` |
| P-04 | Görseller IndexedDB'ye **taşınmaz**, yalnız belgelenir |
| T-01 | CSV dışa aktarma ve canlı sonuç rotaları silindi; soru havuzu ve `POST/PATCH /api/quizzes` rotaları **silinmedi** (ayrı karar) |
| T-02 | Yalnız ESLint (uyarı düzeyi); E2E CI'a **eklenmedi** |

## 2. Açık işler (önem 1–10)

| # | İş | Önem | Not |
|---|---|---|---|
| 1 | ~~Yedeği sunucu dışına kopyalama~~ | — | **Kod yapıldı (#71), canlıda açılması kullanıcıya kalır:** karar ağ paylaşımı (SMB/NAS), günlük, hedefte son 14. `server/.env` içinde `BACKUP_OFFSITE_DIR` (ve isteğe bağlı `BACKUP_OFFSITE_KEEP`) yazılıp sunucu yeniden başlatılınca devreye girer; yazılmadıkça kapalıdır. Gerçek bir SMB paylaşımında denenmedi: ilk kopyadan sonra günlükte `Dış kopya alındı` satırını doğrulayın. Geri yükleme araçları hazır: `maintenance restore` ve `restore-auto` (#63, #64). |
| 2 | Açık kayıt koruması | **8** internete açıksa, **2** yalnız okul ağında | Bayrak `.env`'e `ALLOW_SELF_REGISTRATION=false` yazılarak kapanır (kullanıcının işi; `server/.env` ajan tarafından değiştirilmez). **Kısmen yapıldı (#67):** herkese açık adreste açık kayıt ve `TRUST_PROXY_HOPS=0` için başlangıç günlüğü ve "Sunucu Durumu" ekranı uyarısı; kayıt sınırlayıcısı için proxy/`X-Forwarded-For` testleri. Kalan: e-posta doğrulama, CAPTCHA, alan adı kısıtı, yönetici onayı yok (kullanıcı kararı gerektirir). |
| 3 | Yük provasını makine boşken yeniden ölç | **6** | Rapor `docs/performans-ve-kapasite-raporu.md` bölüm 3.2: 80 öğrenci, 4.334 istek, 0 hata; cevap kaydı p95 11,04 sn, teslim p95 16,26 sn. Eski değerlerden yüksek ama ölçüm yoğun kullanılan 4 çekirdekli dizüstünde ve aynı anda başka işler koşarken alındı, **yorumlanamaz**. Hedef donanımda tekrarlayıp raporu güncelleyin. |
| 4 | Otomatik yedeğin canlıda yeni gün ve temizlik davranışı | **4** | İlk yedek canlıda doğrulandı (21 Kasım 11:41, `quiz-20261121.db`, bütünlük `ok`). Birkaç gün sonra klasörde günlük dosya birikmesini ve 7'den fazlasının silinmesini kontrol edin. |
| 5 | ~~`server/prisma/reset-admin.ts` en az 6 karakter kabul ediyor~~ | — | **Yapıldı (#68):** artık ortak `PASSWORD_MIN_LENGTH` (8). Test betiği çalıştırmaz, kaynağı denetler. |
| 6 | ~~İstemcide öğretmenin kendi duyurusunu silme düğmesi~~ | — | **Yapıldı (#70):** öğretmen yalnız `createdBy` kendisi olan duyurularda düğmeyi görür. |
| 7 | ESLint'in 312 uyarısı (`no-misused-promises` 258, `no-floating-promises` 54) | **3** | Çoğu `async` Express işleyicisi. Yer tutucu `react-hooks` eklentisi `eslint.config.mjs` içinde; gerçek `eslint-plugin-react-hooks` kurulursa kaldırılabilir. |
| 8 | E2E testlerinin CI'a eklenmesi | **3** | Karar: eklenmedi. CI'daki Playwright satırları yalnız PDF testleri için Chromium kurulumudur. |
| 9 | G-06 öncesi gönderilmiş sıfırlama e-postalarının eski gövdeleri | **4** | Veritabanında/yedeklerde kalabilir; toplu temizleyen göç yazılmadı. |
| 10 | Küçük temizlikler | **2** | **Yapıldı:** `student-deadline` dışlaması kalktı, bayat bir doğrulama düzeltildi (#73); `class.ts` hata kodu okuması `respondToClassError`'da birleşti (#74); P-02'nin eski vitrin oturumu notu geçersiz (oturum ömrü 24 saat, #55 20 Kasım'da birleşti). **Kalan:** T-01'in soru havuzu ve `POST/PATCH /api/quizzes` rotalarının silinmesi (kullanıcı kararı; önce bu rotaları kullanan istemci olup olmadığı taranmalı). P-04 IndexedDB: karar hayır. |

## 3. Bu oturumda öğrenilen, kodda görünmeyen şeyler

- **`getUser(id, { relations: false })`:** `requireAuth` ilişkisiz sorgu kullanır. `req.user` ilişki alanlarını (`class`, `assignedCategories`, `classes`…) **taşımaz**; gerekiyorsa `storage.getUser(id)` ile ayrıca okuyun (`/api/auth/me` böyle yapar).
- **Soru kimliği önbelleği (`questionIdCache`, `server/storage.ts`):** `saveResultAnswer` sınavın soru kimliklerini bellekte tutar (en çok 200 sınav). Soru yazan her yol önbelleği geçersiz kılar; yeni bir soru yazma yolu eklerseniz `invalidateAnswerKey` çağırın.
- **Doğru sayısı:** `StudentResult.correctAnswersCount` yalnız `completeResult`'ta (teslimde) hesaplanır; devam eden sınavda 0'dır.
- **CSV hücreleri:** `-`, `=`, `+`, `@` ile başlayan hücrelere formül enjeksiyonuna karşı `'` eklenir (`'-` görünür). İstemci CSV'yi kendisi üretir (`downloadCsv`); sunucuda CSV rotası kalmadı.
- **Otomatik yedek (`server/services/auto-backup.ts`):** better-sqlite3 çevrimiçi `backup()`; `*.tmp` + `rename` ile atomik; `uploads` yansısı artımlıdır ve kaynakta silinen dosyaları **silmez**; zaman damgası karşılaştırmasında 2 sn tolerans vardır (Linux yuvarlaması ve FAT/exFAT için). Ayar: `deployment-config.json` içindeki `backup` bölümü.
- **Parola kuralı:** tek kaynak `server/utils/password-policy.ts`.
- **Hata iletileri:** istemciye ham `error.message` dönmez; ayrıntı `logger.error` ile yazılır. Rotalarda `console.*` yasak (bekçi testi: `server/tests/api/no-console-in-routes.test.ts`).
- **Prova betikleri:** `scripts/school-exam-rehearsal.mjs` ve `scripts/production-performance-rehearsal.mjs` artık sabit SHA-256 yerine koşu öncesi/sonrası özet karşılaştırması kullanır. Silinen rotalara (`/live`, CSV) ve artık yazılmayan `correctAnswersCount`'a bağlı olmamalıdır.
- **Windows:** Sinyal işleyicileri (SIGTERM/SIGINT) Windows'ta çalışmaz; düzgün kapanış testi yalnız Linux CI'da koşar.

## 4. Çalışma biçimi (önceki oturumda geçerli olanlar; yeni oturumda kullanıcıyla teyit edin)

- Her görev ayrı dal ve ayrı PR; önce başarısız test, sonra düzeltme; Türkçe commit/PR (`fix(server): …`); commit sonuna `Co-Authored-By`, PR gövdesine `🤖 Generated with [Claude Code]`.
- Birleştirme **yalnız kullanıcı onayıyla**, `--squash`; "kontrol et" denince PR durumuna bakılır; Auto-fix açıktı.
- `main`'e doğrudan itme, `--force`, `git reset --hard`, `git clean -fdx` yok. Çakışmada `main` dala **merge** edilir.
- Dokunulmayanlar: `server/data/*`, `server/.env`, `server/uploads/`, `server/backups/`; çalıştırılmayanlar: `db:seed`, `db:migrate`, `prisma migrate dev/reset`, `db push`, `db:reset-admin`, `db:create-admin`, `setup*`, `app:start`/`app:stop`, `maintenance`, `upgrade` (kullanıcı özel olarak izin vermedikçe). Yalnız npm; `package-lock.json` elle düzenlenmez.
- `docs/yol-haritasi.md` commit edilmez, görev dallarına kopyalanmaz.

## 5. Pratik notlar

- Makine yavaş: tek vitest dosyası 2–5 dk sürer. Uzun komutları arka planda çalıştırın; vitest çıktısını `head` ile kesmeyin (süreç öldürülür, özet satırı kaybolur).
- Kırık koşulardan `server/data/quizmaster-test-*` dizinleri kalabilir; testlerin kendi geçici dizinleridir, elle silinebilir. `server/data` içindeki başka dosyaya dokunmayın.
- `client/src/test/academic-archive-remount.test.tsx` aralıklı kırılır; yalnız o düşerse CI `gh run rerun <id> --failed` ile yeniden koşturulur.
- Windows'ta `git add` silinmiş dosyanın yolunu verirseniz tüm ekleme iptal olur; silme zaten `git rm` ile hazırdır.
- Geliştirme sunucusu kullanıcının terminalinde 5000 (API) ve 5173 (arayüz) portlarında çalışıyor olabilir; durdurmayın, bu portları testlerde kullanmayın.
