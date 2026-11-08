# Kurulum Akışı Yenileme Tasarımı (Taslak)

Durum: **taslak, onay bekliyor**. Kod değişikliği yok. Bu belge, `kurulum.bat` / `kurulum.sh` → `setup-bootstrap` → kurulum sihirbazı zincirinin yeniden tasarımını önerir.

## 1. Sorun özeti (bugünkü durum)

| # | Sorun | Etki |
|---|-------|------|
| 1 | İki ayrı süreç, iki port, iki arayüz (bootstrap 5049, sihirbaz 5050) | Kullanıcı hangi ekranda olduğunu bilmiyor; port çakışması, ek token/cookie karmaşası |
| 2 | Kurulum durumu `installation.lock` + `pending` dosyalarına dağılmış | Yarıda kesilen kurulum kaldığı yerden devam etmiyor; "onar" mantığı tahmine dayalı |
| 3 | `.env` ve veritabanı doğrudan yerinde yazılıyor | Yarıda kesilirse yarım yapılandırma kalıyor |
| 4 | Yerel geliştirme ve sunucu kurulumu aynı akışta | Yerel kullanıcı gereksiz derleme/ayar soruları görüyor |
| 5 | Yalnızca tarayıcı arayüzüyle kurulabiliyor | Uzak sunucuda (SSH) ve CI'da otomatik kurulum yok, test edilemiyor |
| 6 | pnpm sürümü tam eşleşmeli (9.15.1) ama kullanıcıya kurdurtuluyor | İlk deneyimde sürtünme; Corepack kullanılmıyor |
| 7 | Bun yolu `setup-bootstrap.mjs` içinde var, başlatıcılarda ve CI'da yok | Test edilmeyen, muhtemelen bozuk yedek yol |
| 8 | Uygulama başlatma/durdurma standardı yok | PID/log yeni eklendi ama durdurma komutu yok |
| 9 | UTC zaman damgalı yedek klasörleri, sahte "sonraki adım" düğmeleri, yanıltıcı yönlendirme metni | Küçük ama güveni zedeleyen kusurlar |

## 2. Hedefler ve hedef-dışı

**Hedefler**
- Tek komutla, anlaşılır, **yeniden çalıştırılabilir (idempotent)** kurulum.
- Yarıda kesilince kaldığı adımdan devam.
- Arayüzsüz (CLI) mod: SSH, CI ve otomatik testler için.
- Yerel ve sunucu kurulumunun net ayrımı.
- Mevcut güvenlik özelliklerini (doğrulanmış yedek, onay metni, HMAC cookie/CSRF) korumak.

**Hedef-dışı**: Veritabanı şeması, uygulama özellikleri, PostgreSQL geçişi.

## 3. Önerilen mimari

### 3.1 Tek giriş: `node scripts/setup.mjs`

`kurulum.bat` / `kurulum.sh` ince kalır: yalnızca Node ve pnpm denetler (Corepack ile sabitler), sonra bunu çağırır.

```
kurulum.bat|sh  →  scripts/setup.mjs [--mode local|server] [--yes] [--ui] [--resume] [--reset]
```

- Varsayılan: etkileşimli CLI (soru-cevap, Türkçe, renk yok/var otomatik).
- `--ui`: aynı adım motorunu kullanan tarayıcı arayüzü (bugünkü sihirbazın evrimi).
- `--yes` + bayraklar/ortam değişkenleri: sorusuz kurulum (CI duman testi).

### 3.2 Tek adım motoru + durum dosyası

Adımlar tek bir modülde, **sıralı ve her biri idempotent**:

```
1 preflight → 2 deps → 3 config → 4 db → 5 admin → 6 build(yalnızca server) → 7 finalize
```

Durum: `server/data/installation.state.json`

```json
{ "version": 1, "mode": "server", "steps": { "deps": "done", "config": "done", "db": "failed" }, "lastError": "..." }
```

- `lock`/`pending` dosyaları kaldırılır; geçiş için okuma uyumluluğu bir sürüm tutulur.
- Her adım başlamadan önce "zaten tamam mı?" kontrolü yapar (örn. `prisma migrate status`).
- `--resume` en son başarısız adımdan sürdürür; `--reset` bugünkü doğrulanmış yedekli sıfırlamayı çalıştırır (davranış aynı kalır).

### 3.3 İşlemsel (transactional) yazım

- `.env` → `.env.tmp` olarak yazılır, doğrulanır, sonra `rename` ile yerine konur.
- Veritabanı → geçici dosyada migrate edilir; başarılıysa hedefe taşınır (yalnızca ilk kurulumda; mevcut veritabanında doğrudan `migrate deploy`, öncesinde yedek).
- Başarısızlıkta temizlik: yalnızca bu çalıştırmanın oluşturduğu geçici dosyalar silinir; kullanıcı verisine dokunulmaz.

### 3.4 Yerel vs sunucu

| | Yerel (`--mode local`) | Sunucu (`--mode server`) |
|---|---|---|
| İstemci derleme | Yok (Vite dev) | Var |
| Başlatma | `pnpm dev` | `pnpm start` (+ süreç yöneticisi önerisi) |
| Sorular | Yönetici hesabı | Alan adı, port, SMTP, oturum gizli anahtarı, yedek yolu |
| Chromium | İstek üzerine | İstek üzerine |

### 3.5 Yaşam döngüsü komutları

`scripts/app.mjs start|stop|status|logs` — `server/data/app.pid` ve log dosyalarını kullanır (bugün sadece yazılıyor). Başlatıcılar ve arayüz aynı komutu çağırır.

### 3.6 Bağımlılıklar

- **pnpm**: `corepack enable && corepack prepare pnpm@9.15.1 --activate` otomatik; Corepack yoksa mevcut net hata mesajı.
- **Bun**: önerim **kaldırmak** (desteklenmeyen, test edilmeyen). Alternatif: CI'ya Bun duman testi eklemek — maliyeti yüksek, kazancı belirsiz.
- **Chromium**: yalnızca arşiv PDF'i için, ilk kullanımda isteğe bağlı kurulum (bugünkü `archive:prepare` ile uyumlu).

## 4. Test stratejisi

- **Birim**: adım motoru (durum geçişleri, resume, idempotency) — `node:test`.
- **Entegrasyon (CI)**: `setup.mjs --mode server --yes` ile boş dizinde Ubuntu + Windows'ta uçtan uca kurulum, ardından `status` ve sağlık uç noktası kontrolü; yarıda kesme simülasyonu (adım 4'te hata enjekte edip `--resume`).
- **Mevcut testler**: `test:setup` / `test:upgrade` yeni motorla uyumlu hâle getirilir; başlatıcı ön kontrol testleri aynen kalır.
- **Arayüz**: Playwright ile yalnızca `--ui` mutlu yol (isteğe bağlı, ikinci faz).

## 5. Aşamalı geçiş (PR planı)

| PR | İçerik | Risk |
|----|--------|------|
| 1 | Adım motoru + `installation.state.json` (mevcut akışın içinden çağrılır, davranış aynı) | Düşük |
| 2 | `scripts/setup.mjs` CLI + `--yes` + CI duman testi | Orta |
| 3 | `.env`/DB işlemsel yazım | Orta |
| 4 | `app.mjs` yaşam döngüsü; başlatıcılar yeni giriş noktasına yönlenir | Düşük |
| 5 | Tek süreç/tek port arayüz (`--ui`); eski bootstrap + sihirbazın emekliye ayrılması | Yüksek |
| 6 | Bun kararı, küçük kusurların (UTC adı, sahte düğmeler, Prisma uyarısı) temizliği, belgeler | Düşük |

Her PR kendi başına birleştirilebilir ve geri alınabilir; 5. PR'a kadar bugünkü kurulum çalışmaya devam eder.

## 6. Açık sorular (karar gerekiyor)

1. **Bun**: kaldırılsın mı, korunup test mi edilsin? (Öneri: kaldır.)
2. **Arayüz**: tarayıcı arayüzü kalıcı olarak korunsun mu, yoksa yalnızca CLI mi? (Öneri: kalsın ama CLI ile aynı motoru kullansın.)
3. **Sunucu süreç yönetimi**: yalnızca PID/log mu, yoksa systemd/pm2 birim dosyası üretimi de kapsamda mı?
4. **Geriye dönük uyumluluk**: mevcut kurulu sistemler `lock` dosyasından durum dosyasına otomatik taşınsın mı? (Öneri: evet.)
5. Başlatma noktası: önce hangi PR (öneri: 1 → 2).

## Ek A. Tek port arayüz — ayrıntılı tasarım (8 Kasım 2026)

Karar: bu iş npm geçişinden **önce** yapılır ([npm tasarımı, bölüm 0](npm-gecis-tasarimi.md)).

### A.1 Koddan çıkan kısıt
`setup-bootstrap.mjs` bağımlılıksızdır, çünkü paketler (express, zod, tsx …) henüz kurulu değildir; paketleri o kurar. Sihirbaz (`server/setup-wizard`) ise bu paketlere bağlıdır. Bu yüzden **tek süreç mümkün değildir**: bootstrap her zaman önce çalışır, sihirbaz paketler kurulduktan sonra ayrı süreç olarak başlar. Hedef bu nedenle **tek port, tek URL, tek oturum**dur.

Bugünkü sürtünme: sihirbaz 5050'ye bağlanır, tarayıcı `location.href` ile başka porta atlar; ikinci token/cookie; 5050 doluysa `WIZARD_PORT_BUSY` ve "süreci sonlandır" akışı; güvenlik duvarı/dokümantasyonda iki port.

### A.2 Seçenekler

| Seçenek | Anlatım | Artı | Eksi |
|---------|---------|------|------|
| **1. Port devri** | Bootstrap dinlemeyi bırakır, sihirbaz aynı portu (5049) alır | Araya katman girmez | Bırak–al arasında yarış; sihirbaz bağlanamazsa bootstrap geri dönmeli; Windows'ta port serbest kalma süresi |
| **2. Ters vekil (öneri)** | Bootstrap 5049'da kalır, sihirbazı **rastgele boş loopback portta** (`port 0`) başlatır ve `/setup` ile `/api/*` isteklerini ona aktarır | Port yarışı yok; 5050 ve "süreci sonlandır" akışı tamamen kalkar; sihirbaz çökerse bootstrap ayakta; tek token | Küçük bir HTTP aktarıcı (yalnız düz HTTP, WebSocket yok) |

**Öneri: 2.** Sihirbaz yalnızca düz HTTP kullandığı için aktarıcı basittir ve en az hareketli parçayı bırakır.

### A.3 Tasarım (seçenek 2)
- Bootstrap, sihirbazı `SETUP_PORT=0` ve kendi ürettiği `SETUP_TOKEN` ile başlatır; sihirbazın yazdığı gerçek porttan hedefi öğrenir (bugünkü `/setup?token=` ayrıştırması zaten var).
- `/setup`, `/api/apply`, `/api/start-app` vb. sihirbaz yolları bootstrap'ta **kimlik doğrulandıktan sonra** (`quizmaster.bootstrap` cookie) sihirbaza aktarılır. Sihirbaz kimliği, bootstrap tarafından sunucu tarafında eklenir (`quizmaster.setup` cookie değeri aynı HMAC ile hesaplanır); tarayıcı yalnız tek cookie görür.
- `Host`/`Origin` başlıkları **değiştirilmeden** iletilir; sihirbazın `sameOrigin` ve CSRF denetimi 5049 üzerinden aynen geçer.
- Aktarıcı yalnız `127.0.0.1` hedefine, yalnız beyaz listedeki yollara, sınırlı gövde boyutuyla (16 KB) çalışır; yönlendirme (redirect) izlemez.
- Tarayıcı artık port değiştirmez: bootstrap sayfası sihirbaz hazır olunca aynı origin'de `/setup`'a geçer.
- Kalkanlar: `SETUP_WIZARD_PORT`, `WIZARD_PORT_BUSY`, "sihirbaz portunu boşalt" iki tıklı akışı, 5050 ile ilgili belge/uyarı metinleri. Yalnız **5049** (veya `SETUP_BOOTSTRAP_PORT`) kalır.
- `server/setup-wizard/server.ts` bağımsız çalışmaya devam eder (`pnpm run setup:wizard`, `setup:cli` etkilenmez).

### A.4 Test
- Aktarıcı birim testi: kimliksiz istek 401, beyaz liste dışı yol 404, gövde sınırı, Host/Origin korunması.
- Sahte sihirbaz betiğiyle bootstrap entegrasyon testi (gerçek paket kurulumu olmadan): başlat → aktar → sihirbaz kapanınca bootstrap ayakta.
- Mevcut `setup-bootstrap*.test.mjs` ve `setup-launcher-*.test.mjs` güncellenir (5050 beklentileri kalkar).
- Elle doğrulama: tarayıcıda uçtan uca kurulum (yalıtılmış kopyada).

### A.5 Riskler
- Aktarıcı yeni saldırı yüzeyidir → beyaz liste + kimlik doğrulama sonrası + yalnız loopback + boyut sınırı; güvenlik testleri zorunlu.
- `setup-bootstrap.mjs` 507 satır ve istemci kodu `String.raw` içinde (yedek tırnak/`${` yasağı) → değişiklikler dikkatli ve tarayıcıda doğrulanarak yapılır.
