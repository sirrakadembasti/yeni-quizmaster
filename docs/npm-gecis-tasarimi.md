# npm'i Gerçek Paket Yöneticisi Yapma Tasarımı

Durum: **uygulandı (8 Kasım 2026)**; aşağıdaki "Uygulama durumu" bölümüne bakın. 1–8. bölümler özgün tasarım metnidir (tarihsel). [Kurulum yenileme tasarımı](kurulum-yenileme-tasarimi.md) belgesinin devamıdır.

## Uygulama durumu

| Aşama | Sonuç | PR |
|---|---|---|
| 0 Güvenlik PR'ı | **Yapılmadı** (karar: ayrı PR açılmayacak). Bunun yerine `overrides` ile kritik `tar` açığı kapandı | — |
| 1 Paket yöneticisi katmanı (`package-manager.mjs`, `pm.mjs`) | Uygulandı: katman, başlatıcı/sihirbaz/yükseltme/CLI bağlantısı, kök betikler | #12, #13, #14 |
| 2 npm desteği | Uygulandı: `package-lock.json`, `overrides`, `engines`, arayüzde npm, CI'da npm işi | #15, #16 |
| 3 Tüm testler npm ağacında | Uygulandı: backend **655/655**, frontend **334/334**, `npm audit` kritik kapısı; CI'a ilk kez backend/frontend testleri girdi | #17 |
| 4 Varsayılanı npm yap | Uygulandı: varsayılan npm, var olan kurulumlar kendi yöneticisini korurdu (pnpm kalkana kadar), `kurulum.bat/sh` npm 11+ ister, belgeler ve üretilen metinler | #18, #19, #20 |
| 5 pnpm'i bırak, Bun'u düzelt | **pnpm kaldırıldı** (#21). Bun **doğrulandı** (#24–#26): bağımlılık algısı, yükseltme `cwd`'si ve CI'da Bun işi; etiketler güncellendi | #21, #24–#26 |
| 6 Sonradan çıkan düzeltmeler ve yükseltmeler | Kapanış provası düzeltmeleri (#27, #29), kararsız frontend testi (#30), **Zod 4** (#31), **Prisma 7** (#32), provalama betiklerinin Prisma 7'ye uyarlanması ve gerçek koşuları (#33, #34) | #27–#34 |

Ölçümler: npm ağacı sıfırdan çözümlemede 12 açık (1 kritik) veriyordu; `overrides` ile **5 yüksek, 0 kritik**; Zod 4 (#31) ve Prisma 7 (#32) sonrası **0 açık**. Eski pnpm kilidi 18 açık (1 kritik, 6 yüksek) gösteriyordu. `npm ci` CI'da ≈ 30 sn (bir geliştirici makinesinde 12–14 dk).

Tasarımdan sapmalar ve çıkan bulgular:
- `npm exec` **desteklenmez**: yerel bin yoksa kayıt defterinden aynı adlı alakasız bir paketi (`tsc`) indirip çalıştırabildiği ölçüldü. Yerine `resolveLocalBin` (bin dosyasını bulup Node ile çalıştırır) ve `package.json` betikleri kullanılır.
- Çift kilit dönemi yaşanmadı: `package-lock.json` eklendikten sonra pnpm yalnızca varsayılan olmaktan çıktı, sonra kaldırıldı.
- Eski pnpm kurulumları: `node_modules/.pnpm` "legacy" sayılır, npm'e geçilir (`npm ci` node_modules'ü yeniden kurar); README'de geçiş notu var.
- CI'da koşmayan kabul/prova betikleri npm'e ve Prisma 7'ye uyarlandı; çoğu gerçekten çalıştırıldı (`school-exam-rehearsal`, `academic-archive-runner` `--smoke`/`--restore-smoke`/`--startup-failure-smoke`, `ai-upgrade-rehearsal`, Prisma ortam testi). Ekim 2026'daki tek seferlik ortama bağlı iki prova (`production-performance-rehearsal`, `production-rollback-rehearsal`) önkoşulları depoda olmadığından uçtan uca çalıştırılamadı.

Açık kalanlar: yalnız ortama bağlı iki tek seferlik prova betiğinin uçtan uca çalıştırılması. Bun kararı verildi ve doğrulandı; Prisma `package.json#prisma` uyarısı `prisma.config.ts` ile giderildi; güvenlik bulguları kapandı.

### Doğrulama istisnası: GitHub Actions kotası (9 Kasım 2026): sona erdi

Depo özel olduğu sırada ücretsiz Actions kotası tükenmiş ve birleştirmeler (ilk örnek PR #27) CI'sız, yerelde doğrulanarak ve `[skip ci]` ile yapılmıştı. Depo herkese açık yapılınca Actions yeniden çalıştı: `main` üzerinde CI elle koşturuldu ve altı kontrol geçti; sonraki PR'lar (#29 ve sonrası) CI'dan geçerek birleştirildi (#28'in kendisinin CI'ı, commit gövdesindeki `[skip ci]` metni yüzünden başlamadı ve yeni bir commit ile yeniden tetiklendi). Geçici istisna kalktı; birleştirme commit'lerine `[skip ci]` yazılmaz (bu ifade squash gövdesinde bile CI'yı atlatır, PR #28'de yaşandı). Kota döneminde birleştirilen PR #27'nin `/wizard/api/status` düzeltmesi sonradan gerçek provada doğrulandı.

### Güvenlik değerlendirmesi: açık kalan yüksek bulgu yok

Zod bulgusu `zod` 4.6.7 / `zod-validation-error` 5.0.0 ile, Prisma zincirindeki bulgu (GHSA-ggr8-5vv4-36mx, `deepmerge-ts` → `@prisma/config` → `prisma`) Prisma 7.10.1 ile kapatıldı (16 Kasım 2026). `npm audit --omit=dev`: 0 açık. CI kapısı kritik seviyede kırmaya devam eder.

**Prisma 7 geçişinde bilinmesi gerekenler:**
- `schema.prisma` içindeki `datasource.url` kalktı; bağlantı adresi `server/prisma.config.ts` içindedir. İstemci çalışma zamanında zaten `utils/sqlite-runtime.ts` içindeki bağdaştırıcıyla bağlanır.
- **Göreli SQLite yolu:** Prisma 6, `file:../data/quiz.db` gibi yolları `schema.prisma` dizinine (`server/prisma`) göreli çözerdi; Prisma 7 yapılandırma dosyasının dizinine (`server`) göreli çözer. Düzeltilmeseydi `db:deploy`, mevcut kurulumlarda yanlış bir dosyayı (`<kök>/data/quiz.db`) migrate ederdi. `prisma.config.ts` yolu eski kurala göre mutlak hâle getirir; çalışma zamanı çözümleyicisi (`utils/sqlite-runtime-config.ts`) ile aynı kuraldır.
- `DATABASE_URL` yoksa `generate` (temiz kurulumdaki postinstall) çalışır; `migrate`/`db` komutları açık bir hatayla durur (sessizce varsayılan dosya yaratmaz).
- İstemci artık yerel sorgu motoru indirmez (WASM sorgu derleyicisi); `@prisma/engines` postinstall indirmesi ve `PRISMA_QUERY_ENGINE_LIBRARY` gerekmez.
- İstemci `$transaction` için `maxWait` değerini kendisi uygular (varsayılan 2 sn, aşılırsa P2028). Tek yazıcılı SQLite bağlantısında uzun arşiv işlemleri bunu aşabileceğinden varsayılan `maxWait` 130 sn'ye çıkarıldı (önceki "sırada bekle" davranışı); çağrı başına verilen `maxWait` geçerlidir ve süresi dolan başlangıç güvenle düşer (callback çalışmaz, bağlantı kullanılabilir kalır).
- **Provalama betikleri Prisma 7'ye uyarlandı:** betiklerin kendi istemcisi `scripts/prisma-script-client.mjs` (`createScriptPrismaClient`, sürücü bağdaştırıcılı) ile açılır; `prisma migrate deploy` yalıtılmış kökte `--schema` (yalıtılmış şema ve migration'lar) ile birlikte depodaki `server/prisma.config.ts` için `--config` alır. `production-rollback-rehearsal` doğrulayıcısı kökün Prisma sürümüne göre (6 veya 7) istemci kurar. `production-performance-prisma-env.test`, Prisma 7 istemcisi `.env` aramadığı için "hiçbir ortam dosyası okunmaz" değişmezini sınar. Prisma 6 iç davranışını inceleyen dört tarihsel araştırma betiği (`sqlite-adapter-bind-probe`, `sqlite-adapter-transaction-probe`, `sqlite-configuration-investigation`, `production-capacity-investigation`) güncellenmedi; açık bir hatayla durur.

**Zod 4 geçişinde bilinmesi gereken davranış değişikliği:** Zod 4, `.partial()` ile isteğe bağlı yapılan alanlarda da `.default()` değerlerini uygular (Zod 3'te uygulamazdı). PATCH işleyicileri (`quiz.ts`, `survey.ts`) bu yüzden doğrulanmış veriyi `onlySentKeys` (`server/utils/patch-body.ts`) ile süzer; aksi hâlde gönderilmeyen alanlar (durum, zorluk, sınıf atamaları, tür) sessizce varsayılana sıfırlanırdı. Yeni bir `.partial()` + `.default()` birleşimi eklenirse aynı süzgeç kullanılmalıdır.

## 0. Verilen kararlar (8 Kasım 2026)

| # | Soru | Karar |
|---|------|-------|
| 1 | Kilit stratejisi | **Tek kilit: `package-lock.json` (npm).** |
| 2 | pnpm | **Kaldırılacak.** Çift kilit yalnızca geçiş süresince; sonunda `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `packageManager` alanı ve `pnpm.overrides` silinir. |
| 3 | En düşük npm | **11** (Node 22 ile gelen npm 10 desteklenmez; `engines` ve başlatıcı denetimi buna göre). |
| 4 | Ayrı güvenlik PR'ı | **Açılmayacak.** Desteklenen yöneticiler **npm ve Bun**. Mevcut `pnpm audit` bulguları pnpm ile birlikte kalkar; npm ağacının `npm audit` sonucu geçiş kapısında denetlenir. |
| 5 | Sıra | **Önce** tek süreç / tek port arayüz işi, **sonra** npm aşamaları. |

Plana etkisi: pnpm bırakıldığı için aşama 3'teki "iki ağaçta tüm testler" kapısı yalnızca geçiş süresince pnpm ile karşılaştırma yapar; aşama 5'teki "pnpm'i sürdür/bırak" kararı **bırak** olarak kapanmıştır. Bun, paket yöneticisi katmanında npm ile birlikte birinci sınıf seçenek olarak düzeltilecektir (bkz. bölüm 4).

## 1. İstek ve bugünkü durum

İstek: kurulum arayüzünde ve başlatıcılarda **npm seçilebilir ve varsayılan** olsun; pnpm ve Bun seçenek olarak kalsın.

Bugün proje fiilen yalnız pnpm 9.15.1'e bağlıdır:

| Ölçü | Değer |
|------|-------|
| Kod/betik satırı `pnpm` geçen (md ve kilit dosyası hariç) | **188** satır, ~40 dosya |
| En yoğun dosyalar | `setup-bootstrap.mjs` 15, `kurulum.sh` 14, `ci.yml` 14, `kurulum.bat` 13, `server-build-startup.test.mjs` 11, `ui.ts` 10, kök `package.json` 10 |
| Kilit dosyası | `pnpm-lock.yaml` (7.688 satır) |
| Sabitleme | `packageManager: pnpm@9.15.1`, başlatıcılar tam sürüm ister |
| pnpm'e özgü ayar | `pnpm.overrides` (3 kural) |
| Zaten uyumlu olan | Kök `package.json`'da `workspaces: [client, server]` alanı var; npm workspaces bunu okur |

## 2. Ölçüm: npm ile sıfırdan çözümleme

Temiz bir kopyada `npm install --package-lock-only` çalıştırıldı (npm 11.11.1, Node 22):

- Başarılı; **683 paket**, `package-lock.json` ≈ **390 bin satır**, ≈ 3,5 dk.
- `npm audit`: **12 açık (1 kritik, 9 yüksek, 2 düşük)**. Kritik: `tar` (hardlink path traversal). `pnpm.overrides` içindeki `tar@<7.5.21 → ^7.5.21` kuralı npm'de **uygulanmadığı** için ortaya çıktı. Yüksekler: `zod`, `deepmerge-ts` (Prisma üzerinden), `node-gyp` zinciri.
- Karşılaştırma için mevcut `pnpm audit` da çalıştırıldı: **18 açık (1 kritik, 6 yüksek, 10 orta, 1 düşük)**. Yani bugünkü `main` de temiz değil; ayrıntıları (üretim mi geliştirme bağımlılığı mı) bu belgenin kapsamı dışında incelenmedi ve **ayrı bir güvenlik PR'ı** gerektirir.

Sonuç: npm geçişi **bağımlılık ağacını değiştirir**. Aynı `package.json` iki yöneticide farklı geçişli sürümlere çözülür. Bu bir komut değiştirme işi değil, bir **doğrulama** işidir.

## 3. Ana karar: kaç kilit dosyası?

| Seçenek | Anlatım | Artı | Eksi |
|---------|---------|------|------|
| **A. Çift kilit** | `pnpm-lock.yaml` ve `package-lock.json` ikisi de depoda | Her kullanıcı sevdiği yöneticiyle kurar | İki ağaç sapar; her bağımlılık güncellemesi iki kez; CI süresi ve bakım iki katı; "hangisi test edildi" belirsiz |
| **B. Tek kilit: npm** | pnpm bırakılır, `package-lock.json` tek kaynak | Tek ağaç, tek doğrulama, `npm ci` her yerde var (Node ile gelir, kurulum sürtünmesi biter) | 188 satır + belgeler yeniden yazılır; tüm bağımlılıklar yeniden doğrulanır; geri dönüş zor |
| **C. Tek kilit: pnpm, npm yalnız kolaylaştırıcı** | npm yalnızca pnpm'i kurmak için | En küçük değişiklik | İsteğinizi karşılamaz |

**Öneri: A'yı geçici, B'yi hedef olarak ele alın** (aşamalı). Önce yöneticiye bağlı kodu bir katmana taşıyıp npm'i *eşit* destekleyin ve tüm testleri iki ağaçta koşturun; kanıt toplandıktan sonra varsayılanı npm yapın; pnpm'i sürdürme/bırakma kararını en sonda verin. Böylece "varsayılan npm" isteği doğrulanmış bir zemine oturur.

## 4. Mimari: paket yöneticisi katmanı

`scripts/package-manager.mjs` — tüm projenin tek dayanağı:

```
detect()                 → { npm, pnpm, bun } sürüm ve kullanılabilirlik
install(manager, {frozen})   npm ci | pnpm install --frozen-lockfile | bun install --frozen-lockfile
run(manager, workspace, script, args, env)
                          npm run <script> -w <ws> -- args
                          pnpm --filter <ws> run <script> args
                          bun run --cwd <ws> <script> args
exec(manager, workspace, bin, args)   npm exec -w … | pnpm --filter … exec | bunx
```

- Çağıranlar (`setup-bootstrap`, `setup-wizard/server.ts` içindeki `fixedPnpm`, `cli.ts`, `migration.ts`, `upgrade*.mjs`, kök betikler) yalnızca bu katmanı kullanır.
- **Bun sorunu burada çözülür:** bugünkü hata `npm_execpath`'in Bun'u göstermesinden gelir. Katman, yöneticiyi `npm_execpath` tahmininden değil **açık seçimden** (`QUIZMASTER_PM` / arayüz seçimi) alır; seçim alt süreçlere aktarılır.
- Kök `package.json` betikleri (`dev`, `build`, `setup:cli` …) yöneticiden bağımsız yazılır: `npm run -w server …` yerine `node scripts/pm.mjs run server build`.
- `installation.state.json` içine seçilen yönetici yazılır; `app.mjs` aynı seçimi kullanır.

## 5. npm'e özgü işler

1. **`overrides` taşıma** (kök `package.json`):
   ```json
   "overrides": { "tar": "^7.5.21", "@tootallnate/once": "^2.0.1", "better-sqlite3": "12.8.0" }
   ```
   `pnpm.overrides` içindeki *sürüm seçicili* kurallar (`tar@<7.5.21`) npm'de bu biçimde yazılamaz; kapsamlı override gerekir ve yan etkileri testle doğrulanmalı.
2. **`engines`:** `{ "node": ">=22 <25", "npm": ">=10" }` ve `.npmrc` (`engine-strict=true`). Node 22 ile gelen npm 10 desteklenen en düşük sürüm olmalı (şu an ölçüm npm 11'de yapıldı; **npm 10 ile ayrıca denenmeli**).
3. **Yerel derleme:** `better-sqlite3` ve `sharp` `postinstall` ile derlenir/indirilir. `npm ci --ignore-scripts` kullanılmaz; `prisma generate` zinciri npm'de de çalışmalı.
4. **Çalışma alanı betikleri:** `playwright`, `tsx`, `vitest` ikilileri hoisting nedeniyle npm'de farklı yollardadır; `npm exec -w` ile çağrılmalı.
5. **Başlatıcılar:** `kurulum.bat/sh` Node + **npm** denetler (pnpm artık zorunlu değil). Corepack/pnpm kurulum önerileri yalnız pnpm seçilirse gösterilir. `kurulum.bat` CP1254 olduğu için düzenleme dikkat ister.
6. **Güvenlik kapısı:** npm ağacı için `npm audit --omit=dev` sonucu pnpm ağacından **kötü olmamalı**; kritik/yüksek açık varsa varsayılan çevrilmez.
7. **Bağımlılık güncelleme otomasyonu** (Dependabot/Renovate) varsa iki ekosistem için ayarlanmalı.

## 6. Aşamalar ve PR planı

| Aşama | İçerik | Varsayılan | Kapı (geçmeden ilerlenmez) |
|-------|--------|-----------|----------------------------|
| **0** | Güvenlik PR'ı: mevcut `pnpm audit` bulgularının incelenmesi (bağımsız) | pnpm | — |
| **1** | `package-manager.mjs` katmanı; setup/upgrade/CLI/sihirbaz bu katmana taşınır; davranış aynı; testler | pnpm | Mevcut tüm testler yeşil |
| **2** | npm desteği: `overrides`, `engines`, `package-lock.json`, arayüzde npm seçeneği; CI'da `npm ci` + kurulum duman testi | pnpm | npm ile CLI duman testi (Ubuntu+Windows) yeşil |
| **3** | CI'da **tüm testler npm ağacında** (backend, frontend, setup, upgrade); `npm audit` karşılaştırması; npm 10 denemesi | pnpm | Tüm paketler yeşil, audit ≤ pnpm |
| **4** | Varsayılanı npm yap: arayüz, başlatıcılar, README, kılavuz | **npm** | 3. aşama kapısı + elle Windows/Ubuntu temiz kurulum |
| **5** | Bun'u katmana uygun düzelt (`bun run --cwd`), "Deneysel" etiketini kaldır veya Bun'u kaldır; pnpm'i sürdür/bırak kararı | npm | Karar |

Her aşama ayrı PR'dır ve tek başına geri alınabilir. 4. aşamaya kadar bugünkü kurulum aynen çalışır.

## 7. Riskler

- **Sessiz sürüm kayması:** npm ağacı farklı geçişli sürümler getirir; prod yalnızca pnpm ağacıyla denendi. → 3. aşama kapısı (tüm testler + audit).
- **Çift bakım yükü** A seçeneğinde (aşama 2–4 arası): iki kilit senkron tutulmalı. → süreyi kısa tutun, CI'da "kilit tazeliği" denetimi.
- **Windows yolu/kabuk farkları:** `npm.cmd` çağrısı `cmd.exe` gerektirir; bugünkü `pnpmInvocation` bunu bilerek önlüyor (yol verisi güvenliği). Katman aynı disiplini koruyacak (kabuksuz, doğrudan Node girişi).
- **`kurulum.bat` kodlaması (CP1254)** ve mevcut başlatıcı testleri yeniden yazılacak.

## 8. Açık sorular (bölüm 0'da yanıtlandı)

1. **Kilit stratejisi:** önerilen "geçici çift kilit → hedef tek kilit (npm)" kabul mü? Yoksa kalıcı çift kilit mi?
2. **pnpm'in sonu:** 5. aşamada pnpm tamamen bırakılsın mı, yoksa desteklenen seçenek mi kalsın?
3. **Desteklenen en düşük npm:** 10 (Node 22 ile gelen) mu, 11 mi?
4. **Aşama 0:** mevcut 18 açık için ayrı güvenlik PR'ı şimdi mi açılsın? (Bu, npm kararından bağımsız ve öncelikli olabilir.)
5. **Sıra:** tek süreç/tek port arayüz işi (önceki tasarımın 5. PR'ı) npm aşama 1'den önce mi, sonra mı yapılsın? İkisi de `setup-bootstrap.mjs`'e dokunur.
