# QuizMaster Sunucu Kurulum Kılavuzu

15 Ekim kapasite sürümü Prisma 6.19.3 ve native better-sqlite3 12.8.0 / SQLite 3.51.3 gerektirir. Mevcut kurulumda önce uygulama/worker süreçlerini durdurup doğrulanmış yedek alın; frozen install, Prisma generate ve `20261014090000_notification_revision` dahil production migration'larını ayrı kurulumda prova edin. [Bakım adımları](uretim-ve-bakim-kilavuzu.md) ve [80 öğrencilik ölçüm/saha sınırları](performans-ve-kapasite-raporu.md). Bu geliştirme sırasında canlı kurulum yükseltilmedi.

Bu kılavuz QuizMaster'ın başka bir kurumun domain altyapısında subdomain veya alt yol altında üretime alınmasını kapsar. Önerilen model ayrı bir subdomain ve HTTPS reverse proxy'dir.

Yerel geliştirmede sihirbazın kaydettiği API portu `server/.env` içindeki `PORT` değeridir. Vite'ın API, `/uploads` ve Socket.IO proxy'leri aynı portu kullanır: süreç ortamı, `server/.env`, ardından kök `.env`; değer yoksa 5000. Backend'in okumadığı `.env.local` ve Vite mode dosyaları bu seçime dahil edilmez. Sunucu gizli değerleri istemciye enjekte edilmez. API portunu değiştirince backend ve Vite'ı yeniden başlatın; arayüzün 5173 portu ayrı bir ayardır.

Başlatıcı çalışma zamanı sürümlerini süreç başında doğrular ve status polling sırasında aynı snapshot'ı kullanır; paket işi ve kurulum durumu canlı kontrol edilir. Terminal/BAT/SH → paket kurulumu → web sihirbazı için gerçek izole denemeler ve kapsam sınırları [hibrit kurulum doğrulama kaydındadır](denetim-raporlari/yonetici-denetim-raporu.md). Unit/config testinin geçmesi taze kurulumun tamamlandığı anlamına gelmez.

3 Ekim 2026'da Windows terminali, BAT ve Git SH için ayrı temiz kurulumların üçü de geçti: gerçek paket kurulumu, sihirbaz, migration/ilk admin, ayarların kalıcılığı, API ve tarayıcı girişi ile test süreçlerinin temizliği doğrulandı. Daha sonra Ubuntu 22.04.5 LTS / WSL2 üzerinde native Linux Node.js 22.23.2, pnpm 9.15.1 ve Chromium ile gerçek SH temiz kurulumu **1/1 geçti**; iki build, 14 migration, ilk admin, kalıcı ayarlar, üretim API/Vite girişi ve dört fixture portunun bırakılması ayrıca doğrulandı. [Native Linux/WSL sonucu](../tests/denetim-kanitlari/yonetici/evidence/closure/hybrid/linux-wsl-first-passed/result.json). Windows 3/3 tarihsel kanıttır; yeni Linux cleanup desteğiyle Windows tekrar edilmediğinden aynı kodla 4/4 kabul iddiası yoktur. WSL dışı Linux, başlatıcının otomatik işletim sistemi tarayıcı açması, sihirbazın geliştirme başlatma düğmesi ve gerçek SMTP/DNS/Nginx/TLS bu izole kabulün dışındadır.

Başlatıcı aynı anda yalnız bir durum sorgusu gönderir; 30 saniyede yanıt gelmeyen durum okuması sonlandırılır ve sonraki yenilemeye izin verilir. Paket kurulumu ve sihirbazı uygulama işlemleri bu timeout ile kesilmez. Otomatik tarayıcı açılışını istemiyorsanız `npm run setup --no-open`, `kurulum.bat --no-open` veya `sh kurulum.sh --no-open` kullanın ve terminaldeki yerel adresi açın; seçenek verilmezse mevcut otomatik açılış davranışı sürer.

Sihirbaz yalnız migration alt sürecinde `RUST_LOG=info` kullanır. Prisma 5.22'nin eksik SQLite dosyasını otomatik oluşturması, dış ortamdan gelen `warn/error` seviyesinde bozulabildiği için bu işlem ayrıştırıcının beklediği başlangıç logunu korur. Uygulamanın genel log tercihi değiştirilmez. Paket indirme veya Prisma postinstall ağ hatası migration başarısı sayılmaz; hata giderilince paket kurulumunu yeniden deneyin.

## 1. Mimari ve karar

```text
Kullanıcı tarayıcısı
        │ HTTPS :443
        ▼
Kurum DNS + Nginx/IIS reverse proxy
        │ HTTP 127.0.0.1:5000
        ▼
QuizMaster Node.js (Express + Socket.IO)
        ├── client/dist
        ├── SQLite (PostgreSQL geçişi ayrı geliştirme)
        ├── sessions.db veya merkezi session store
        └── uploads
```

### Seçenek A — subdomain (önerilen)

Örnek: `https://sinav.kurum.gov.tr`

- Uygulama, API, yüklemeler ve Socket.IO aynı origin altında kalır.
- CORS, cookie, TLS ve reverse proxy ayarları daha basittir.
- Kurumun ana sitesindeki `/api` veya `/socket.io` yollarıyla çakışmaz.
- `APP_BASE_PATH=/` ve standart `npm run build` kullanılır.

### Seçenek B — kurum sitesi altında alt yol

Örnek: `https://www.kurum.gov.tr/quizmaster/`

- `APP_BASE_PATH=/quizmaster` ayarlanır.
- Frontend `VITE_BASE_PATH=/quizmaster/` ile yeniden derlenir (veya `serveStatic` çalışma zamanı alt yol enjeksiyonu kullanılır).
- Reverse proxy `/quizmaster/` yanında istemcinin kullandığı `/api/`, `/uploads/` ve `/socket.io/` kök yollarını da QuizMaster'a yönlendirmelidir.
- Kurumun ana uygulaması bu kök yolları zaten kullanıyorsa çakışma olur. Bu durumda subdomain kullanılmalı veya alt yol önekli ikinci kopya modeli tercih edilmelidir.

### Seçenek C — `domain/demo` altında bağımsız salt-okunur demo ikinci kopyası

Örnek: `https://sinav.kurum.gov.tr/demo/`

- Ana üretim uygulaması `127.0.0.1:5000` (`server/data/quiz.db`) üzerinde çalışırken, salt-okunur vitrin kopyası `127.0.0.1:5001` (`server/data/demo.db`, `APP_DEMO_MODE=true`, `APP_BASE_PATH=/demo`) üzerinde ikinci bir süreç olarak çalıştırılır (`npm run db:prepare-demo` ve `npm run start:demo`).
- Bu modda istemci tüm API (`/demo/api/...`), görsel (`/demo/uploads/...`), Socket.IO (`/demo/socket.io/...`) ve oturum çerezi (`quizmaster.demo.sid`) isteklerini `/demo` önekiyle gönderir; ana uygulamanın veritabanı veya oturumlarıyla çakışmaz.
- Ziyaretçiler `demo-admin`, `demo-ogretmen`, `demo-ogrenci` ve `demo-veli` hesaplarıyla tek tıkla giriş yapıp tüm ekranları inceleyebilir; veri değiştiren istekler `DEMO_MODE_READ_ONLY` ile engellenir. Ayrıntılar [`demo/demo-vitrin-hesaplari.md`](../demo/demo-vitrin-hesaplari.md) belgesindedir.

## 2. Üretim ön koşulları

- Kurum DNS yöneticisi tarafından açılmış A/AAAA kaydı,
- Kuruma ait geçerli TLS sertifikası ve yenileme süreci,
- Node.js 22 veya 24 LTS,
- npm 11 veya üstü (deneysel Bun alternatiftir; pnpm artık desteklenmez),
- Nginx, Apache veya IIS reverse proxy,
- Yalnız sunucu yönetici hesabının erişebildiği uygulama kullanıcısı/dizini,
- SMTP için Gmail uygulama parolası kullanılacaksa dışarı doğru TCP 587 veya 465 izni,
- Düzenli ve sunucu dışına alınan veritabanı/yükleme yedeği.

Node.js ve paket yöneticisini yalnız resmî dağıtımlardan kurun. Üretimde bağımlılık sürümleri `package-lock.json` ile sabittir (`npm ci`); rastgele `latest` sürüme geçmeyin. Node.js 22 ile gelen npm 10 desteklenmez: `npm install -g npm@11`.

## 3. DNS ve güvenlik duvarı

Subdomain için kurum DNS ekibi aşağıdaki kaydı oluşturur:

```text
sinav.kurum.gov.tr  A  SUNUCU_IP
```

Güvenlik duvarında:

- Dışarıdan yalnız 80 (sertifika yönlendirmesi için gerekliyse) ve 443 açılır.
- Node.js `5000` portu internete açılmaz; reverse proxy ile aynı sunucuda `HOST=127.0.0.1` kullanılır.
- PostgreSQL kullanılıyorsa `5432` yalnız uygulama sunucusu/veritabanı ağına izinli olmalıdır.
- Gmail için yalnız gerekiyorsa dışarı doğru `smtp.gmail.com:587` veya `:465` açılır.

## 4. Linux üzerinde uygulama kullanıcısı ve dizinler

Örnek hedef:

```text
/opt/quizmaster/app       uygulama kaynakları
/opt/quizmaster/data      kalıcı veri/yedek bağlantısı
/var/log/quizmaster       process manager logları (isteğe bağlı)
```

Uygulamayı root ile çalıştırmayın. `quizmaster` adlı servis hesabı kullanın; kaynak kodu, `server/data`, `server/uploads` ve geçici deployment config dosyası yalnız bu hesap tarafından yazılabilir olmalıdır. `.env` dosyasına web sunucusu veya diğer kullanıcılar için yazma izni vermeyin.

Windows Server'da aynı ayrımı ayrı servis hesabı ve NTFS ACL ile uygulayın. IIS Application Request Routing kullanılıyorsa Node.js yine ayrı bir servis olarak çalışmalıdır.

## 5. Kaynak kod ve bağımlılıklar

```bash
git clone https://github.com/sirrakadembasti/yeni-quizmaster.git /opt/quizmaster/app
cd /opt/quizmaster/app
chmod +x kurulum.sh
./kurulum.sh
```

`kurulum.sh` Node.js 22/24 LTS ile desteklenen bir paket yöneticisini (npm 11+ veya Bun) doğrular. Ayrıca Linux/macOS ortamını teyit eder, root yetkisiyle çalıştırmada uyarır, proje ve `server/data` dizinlerinin yazma izinlerini, en az 3 GB boş disk alanını ve `better-sqlite3` yerel derlemesi için `python3`, `make`, `g++/c++` varlığını denetler. Eksik veya uyumsuz bileşen varsa resmî bağlantıları ve kurumsal ağ kısıtlarına uygun komut seçeneklerini (npm 11 yükseltmesi, Node.js 24) gösterip hiçbir dosyayı değiştirmeden durur. Gereksinimler tamamsa bağımlılıksız bootstrap arayüzünü açar; paket kurulumu kullanıcı onayından sonra bu arayüzden yürütülür. Kurulum panelinde npm (11+) varsayılan paket yöneticisidir; sistemde Bun kuruluysa **Bun (Deneysel)** seçeneği de seçilebilir; bu yolda paket kurulumu ve migration CLI ile (`QUIZMASTER_PM=bun`) doğrulanmıştır; tarayıcı arayüzü, derleme ve yükseltme npm kadar sınanmamıştır. Üretim için npm kullanın.

Kurumsal ağ internete çıkmıyorsa bağımlılıkları onaylı bir build sunucusunda hedef işletim sistemi ve CPU mimarisiyle kurup artefact üretin. `node_modules` klasörünü farklı işletim sistemi veya CPU mimarisinden kopyalamayın; Prisma, Sharp ve SQLite native bileşenleri hedef ortamla aynı olmalıdır.

## 6. Üretim ortam değişkenleri

`server/.env` dosyası oluşturun ve Git'e eklemeyin:

```env
NODE_ENV=production
HOST=127.0.0.1
PORT=5000

DATABASE_URL="file:../data/quiz.db"
SESSION_SECRET="EN_AZ_64_BYTE_RASTGELE_GIZLI_DEGER"

FRONTEND_URL=https://sinav.kurum.gov.tr
APP_BASE_PATH=/
ALLOWED_ORIGINS=https://sinav.kurum.gov.tr
TRUST_PROXY_HOPS=1

EMAIL_PORT=587
EMAIL_USER=kurum.quizmaster@gmail.com
EMAIL_PASS=GOOGLE_UYGULAMA_PAROLASI
EMAIL_FROM=kurum.quizmaster@gmail.com
EMAIL_FROM_NAME=QuizMaster
```

Kurallar:

- `SESSION_SECRET` her kurum için farklı, uzun ve rastgele olmalıdır.
- `.env` yedekleri şifrelenmeli; e-posta/parola ile gönderilmemelidir.
- `ALLOWED_ORIGINS` virgülle ayrılmış tam origin değerleridir; `*` kullanmayın.
- Reverse proxy sayısı bir ise `TRUST_PROXY_HOPS=1`; doğrudan internete güvenilmeyen proxy başlığı kabul etmeyin.
- `FRONTEND_URL` yalnız origin'dir. Alt yol ayrıca `APP_BASE_PATH` ile yazılır.
- PostgreSQL'e geçiş için [PostgreSQL geçiş rehberini](postgresql-gecis-rehberi.md) uygulayın; yalnız URL değiştirmeyin.

## 7. Veritabanı hazırlığı

Üretimde `migrate dev` veya `migrate reset` çalıştırmayın:

```bash
npm run db:validate --workspace=server
npm run db:status --workspace=server
npm run db:deploy --workspace=server
npm run db:generate --workspace=server
```

`db:seed` mevcut kayıtları temizleyen demo seed akışıdır ve üretimde kullanılmamalıdır.

İlk yönetici hesabını demo veri oluşturmadan açın:

```bash
export BOOTSTRAP_ADMIN_NAME="Kurum Sistem Yöneticisi"
export BOOTSTRAP_ADMIN_EMAIL="yonetici@kurum.gov.tr"
export BOOTSTRAP_ADMIN_PASSWORD="UZUN_RASTGELE_GECICI_PAROLA"
npm run db:create-admin --workspace=server
unset BOOTSTRAP_ADMIN_PASSWORD
```

Komut yalnız hiç yönetici yoksa çalışır, zayıf/bilinen parola kalıplarını reddeder ve mevcut kullanıcıya sessizce admin rolü vermez. İlk girişten sonra parola değiştirilmelidir.

## 8. Frontend ve backend derleme

Subdomain/kök kurulum:

```bash
npm run build
```

Linux alt yol kurulumu:

```bash
VITE_BASE_PATH=/quizmaster/ npm run build
```

PowerShell alt yol kurulumu:

```powershell
$env:VITE_BASE_PATH="/quizmaster/"
npm run build
```

Derleme sonunda `client/dist` ve kökte `dist/index.cjs` bulunmalıdır. Derleme yapılan Node ana sürümü ile üretimdeki Node ana sürümü aynı tutulmalıdır. Sunucuyu workspace kökünden `npm run start --workspace=server` ile çalıştırın; paket betiği `cross-env` ile `NODE_ENV=production` ayarlar ve kurulu `node_modules` içindeki native bağımlılıkları kullanır. SQLite3 ve Sharp build dışında bırakılır, kurulu `node_modules` gerektirir; yalnız `dist/index.cjs` dosyasını başka bir yere taşımak bağımsız dağıtım oluşturmaz.

Kurulu sürüm yükseltmesinde app/worker süreçlerini durdurup onaylı kaynakları veri/ayar dizinlerini ezmeden yerleştirin. `npm run upgrade -- --project <kurulum>` veya terminal/BAT/SH başlangıç ekranındaki **Mevcut Kurulumu Güncelle**, doğrulanmış private yedek ardından frozen install/build/migration/status çalıştırır. İlk kurulum sihirbazını tekrar çalıştırmayın. Sonuç sonrası yukarıdaki resmi start komutuyla giriş ve Sunucu Durumu doğrulanmalıdır. [Bakım/yükseltme belgesi](uretim-ve-bakim-kilavuzu.md#veri-koruyan-sürüm-yükseltme) kesilme, kilit ve sürüm+veri geri dönüş sınırlarını açıklar; 13 Ekim terminal/BAT/web ve native SH/web kabulü [yükseltme raporunda](uretim-ve-bakim-kilavuzu.md) tamamlandı; ortam ve cache sınırları korundu.

## 9. systemd servisi

`/etc/systemd/system/quizmaster.service` örneği:

```ini
[Unit]
Description=QuizMaster
After=network.target

[Service]
Type=simple
User=quizmaster
Group=quizmaster
WorkingDirectory=/opt/quizmaster/app
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run start --workspace=server
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=/opt/quizmaster/app/server/data /opt/quizmaster/app/server/uploads

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now quizmaster
sudo systemctl status quizmaster
journalctl -u quizmaster -n 100 --no-pager
```

Gerçek `node`/`npm` yolu `command -v npm` ile doğrulanmalıdır. NVM gibi yalnız interaktif shell'de çalışan PATH ayarlarına servis içinde güvenmeyin.

Windows Server'da NSSM veya kurumun onaylı servis yöneticisiyle aynı çalışma dizini, `.env` ve servis hesabı kullanılabilir. Uygulamayı açık PowerShell penceresine bağlı bırakmayın.

## 10. Nginx — subdomain

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 80;
    server_name sinav.kurum.gov.tr;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name sinav.kurum.gov.tr;

    ssl_certificate     /etc/ssl/kurum/fullchain.pem;
    ssl_certificate_key /etc/ssl/kurum/private.key;

    client_max_body_size 8m;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 120s;
    }
}
```

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 11. Nginx — alt yol

Ana kurum sitesinin mevcut HTTPS `server` bloğuna ekleyin:

```nginx
location = /quizmaster { return 301 /quizmaster/; }

location /quizmaster/ {
    proxy_pass http://127.0.0.1:5000/quizmaster/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /api/ {
    proxy_pass http://127.0.0.1:5000/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /uploads/ {
    proxy_pass http://127.0.0.1:5000/uploads/;
}

location /socket.io/ {
    proxy_pass http://127.0.0.1:5000/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

`/api`, `/uploads` veya `/socket.io` kurum sitesinde kullanılıyorsa bu düzeni uygulamayın; subdomain seçin.

## 12. IIS reverse proxy özeti

1. IIS URL Rewrite ve Application Request Routing kurum politikasıyla kurulup proxy etkinleştirilir.
2. Subdomain binding'i ve kurum TLS sertifikası tanımlanır.
3. İstekler `http://127.0.0.1:5000/{R:0}` adresine yönlendirilir.
4. `X-Forwarded-Proto=https`, gerçek `Host` ve istemci IP zinciri korunur.
5. WebSocket Protocol özelliği etkinleştirilir ve `/socket.io/` upgrade başlıkları geçirilir.
6. İstek gövdesi limiti soru görseli üst sınırından büyük fakat gereksiz derecede yüksek olmayacak şekilde ayarlanır.

Kurulumdan sonra **Sunucu Durumu** ekranında HTTPS, forwarded header ve algılanan origin doğrulanmalıdır.

## 13. Bootstrap ve tek kullanımlık web kurulum sihirbazı

Windows'ta `kurulum.bat`, Linux/macOS'ta `./kurulum.sh` önerilir. Node.js ve paket yöneticiniz zaten doğru sürümdeyse eşdeğer doğrudan komut:

```bash
npm run setup
```

İlk aşama yalnız Node.js yerleşik modüllerini kullanır ve `127.0.0.1:5049` adresine bağlanır. Kurulum durumunu gösterir, varsayılan olarak `npm ci` (veya panelden deneysel Bun seçildiyse `bun install`) işlemini başlatır ve gerçek işlem çıktısını ekranda sunar. Paketler hazır olduğunda mevcut ana sihirbaz arka planda boş bir yerel portta başlatılır ve aynı adrestan (`127.0.0.1:5049/wizard`) sunulur; başlatıcı yalnız kimliği doğrulanmış, beyaz listedeki sihirbaz isteklerini aktarır. Başlatıcı portu (5049) doluysa başlatıcı PID ile uyarır ve süreci durdurmayı teklif eder. Terminal sihirbaz bitene kadar kapatılmamalıdır. Doğrudan konsoldan manuel kurulum tercih edilirse `npm ci && npm run db:deploy --workspace=server && npm run build` akışı aynen korunmaktadır.

Sihirbazda **kurulum biçimi** seçenekleri:

- **Yerel / localhost** — deneme (`npm run dev`: arayüz `http://127.0.0.1:5173`, API `:5000`); reverse proxy/TLS gerekmez
- **Subdomain** — üretim önerilen (bu kılavuzun ana senaryosu)
- **Subpath** — kurum sitesi alt yol

Kurulum uygulandıktan sonra sihirbaz **kör yönlendirme yapmaz**. Bitişteki **Uygulamayı başlat** düğmesi yerelde `npm run dev` (arka plan, terminal penceresiz), kurum kurulumunda üretim servisini başlatır. Yerel giriş: `http://127.0.0.1:5173/auth`. Kurum (subdomain/alt yol) adresi ancak Nginx + DNS + TLS hazır ve uygulama ayaktaysa açılır. Aksi halde “sayfaya ulaşılamıyor” görünür; bu bir kurulum hatası değildir.

VPS üzerinde bu portu internete veya yerel ağa açmayın. Yönetici bilgisayarından SSH tüneli kurun:

```bash
ssh -L 5049:127.0.0.1:5049 kullanici@sunucu
```

Önce terminalde gösterilen `http://127.0.0.1:5049/setup?token=...` adresini açın. Bootstrap tamamlanınca aynı sekmede ve aynı portta `/wizard` sayfasına geçilir. URL anahtarı HttpOnly/SameSite oturum çerezine çevrilir ve paylaşılmamalıdır.

Sihirbazın beş adımı:

1. İşletim sistemi, Node.js, CPU/bellek, ağ adresleri ve yazma izinleri ön kontrolü.
2. Subdomain/alt yol, herkese açık URL, origin, uygulama portu ve proxy sayısı.
3. SQLite ve operasyon kaydı saklama politikası. Bu sürüm PostgreSQL'i varmış gibi göstermez; geçiş için ayrı PostgreSQL rehberi kullanılır.
4. İlk yönetici ve isteğe bağlı Gmail uygulama parolası.
5. Doğrulama; `.env` yazımı, migration, ilk yönetici ve üretim derlemesi.

Kurulum tamamlanınca `server/data/installation.lock` yazılır ve sihirbaz otomatik kapanır. Var olan yönetici hesabı bulunan veritabanı devralınmaz. Var olan `.env` ancak kullanıcı açıkça onaylarsa önce `server/backups` altına yedeklenerek değiştirilir. Yönetici parolası kurulum kilidine, profile veya üretilen örneklere yazılmaz.

Bootstrap yeniden çalıştırıldığında tamamlanmış ve yarım kurulumları ayırır. Temiz kurulum yalnız servis duruyorsa ve standart SQLite kullanılıyorsa açılır. Kullanıcı açık veri kaybı uyarısını kabul edip `QUIZMASTER VERİLERİNİ SİL` yazmadan işlem başlamaz. `.env`, veritabanı/oturum dosyaları ve SQLite yan dosyaları, dağıtım profili, kurulum çıktıları ve yüklemeler önce `server/backups/reinstall-...` altına kopyalanır; SHA-256 özetleri `manifest.json` içinde doğrulanır. Bu yerel yedeği üretimde sunucu dışına taşıyın.

Sihirbazın bilinçli sınırları:

- VPS/cloud sağlayıcısını kesin olarak tespit etmez; çalışma ortamını ve ağ arayüzlerini raporlar.
- Serbest kabuk komutu çalıştırmaz; yalnız sabit migration ve build komutlarını kullanır.
- DNS, TLS sertifikası, Nginx/IIS, systemd/Windows Service ve güvenlik duvarını değiştirmez.
- Sihirbaz ana uygulamanın içine gömülü veya internetten sürekli erişilebilir değildir.

### Kurulum sonrası `/server-setup` Sunucu Durumu ekranı

İlk yöneticiyle giriş yaptıktan sonra `/server-setup` adresini açın.

Ekran şunları yapar:

- İstekten origin, HTTPS ve reverse proxy başlıklarını algılar,
- Node/platform/çalışma modu, veritabanı erişimi ve uploads yazma iznini gösterir,
- Subdomain/alt yol profili ile `ALLOWED_ORIGINS`, proxy sayısı ve herkese açık URL'yi gösterir,
- `.env.production`, Nginx ve derleme komutu örneği üretir,
- Kontrollü log saklama politikasını gösterir.

Bu ekran yalnız bilgi sayfası değildir: profil yazma ve kalıcı veri saklama temizliğini tetikleme yeteneği vardır. Risk nedeniyle iki işlem de varsayılan olarak kapalıdır. Sunucu yöneticisi bakım penceresinde bilinçli olarak aşağıdaki değeri ayarlayıp uygulamayı yeniden başlatırsa düğmeler açılır:

```env
ALLOW_RUNTIME_DEPLOYMENT_CHANGES=true
```

Bakım bittiğinde değer yeniden `false` yapılmalıdır. Sayfa her durumda admin oturumu, rol kontrolü ve CSRF koruması altındadır; bu korumalar varsayılan kapalı olma ilkesinin yerine geçmez.

Kaydedilen gizli olmayan profil `server/data/deployment-config.json` dosyasındadır ve Git tarafından yok sayılır. Ağ ayarlarının etkinleşmesi için uygulamayı yeniden başlatın. Alt yol değiştiyse frontend'i yeni `VITE_BASE_PATH` ile yeniden derleyin.

Ekran güvenlik nedeniyle şu değerleri kabul etmez veya geri göstermez:

- `DATABASE_URL` parolası,
- `SESSION_SECRET`,
- Gmail uygulama parolası,
- TLS private key.

Bu gizli değerler yalnız `.env` veya kurum secret manager'ında tutulur.

## 14. Log saklama ve veritabanı büyümesi

Mevcut log sınıfları:

- Pino HTTP/uygulama logları stdout/stderr'e gider; saklama süresini systemd journal, Docker veya Windows servis log politikası belirler.
- `ActionLog`, `Notification`, `EmailQueue` ve `PasswordResetRequest` veritabanındadır.
- Sınav sonuçları ve anket cevapları operasyon logu değildir; otomatik bakım bunları silmez.

Web saklama politikası varsayılan olarak kapalıdır. Önerilen başlangıç değerleri:

| Kayıt | Başlangıç önerisi | Silme koşulu |
|---|---:|---|
| ActionLog | 365 gün | Süreden eski |
| Okunmuş bildirim | 180 gün | Okunmuş ve süreden eski |
| E-posta teslimat logu | 90 gün | `sent`/`failed`, ilişkisiz ve süreden eski |
| Parola sıfırlama talebi | 90 gün | Tamamlanmış/iptal/süresi dolmuş/başarısız |

Bekleyen e-postalar, okunmamış bildirimler, aktif parola talepleri, sınavlar, anketler ve sonuçlar korunur. Kurumun denetim/saklama mevzuatı bu değerlerden uzunsa kurum politikası uygulanmalıdır.

SQLite satır silindikten sonra boş alanı yeniden kullanır fakat dosya hemen küçülmeyebilir. Doğrulanmış yedek ve bakım kesintisi sonrası `VACUUM` planlanabilir. Canlı ve yoğun kullanılan SQLite dosyasında otomatik `VACUUM` çalıştırılmaz.

## 15. Yedekleme

Her gün en az şunları yedekleyin:

- `server/data/quiz.db`,
- `server/uploads`,
- gizli değerleri güvenli kasadan yeniden oluşturma prosedürü,
- deployment profile ve uygulama commit kimliği.

`sessions.db` geri yüklenmek zorunda değildir; kaybı kullanıcıları oturumdan çıkarır. SQLite yedeği uygulama yazmaları durdurularak veya SQLite'ın güvenli online backup yöntemiyle alınmalıdır; çalışan dosyayı körlemesine kopyalamayın. Yedekler sunucu dışında, şifreli ve erişim kayıtlı tutulmalıdır.

## 16. İlk canlı kontrol listesi

1. `https://...` sertifika zinciri geçerli.
2. HTTP, HTTPS'e yönleniyor.
3. `/api/csrf-token` 200 dönüyor ve oturum cookie'si `Secure`/`HttpOnly`.
4. Admin, öğretmen, öğrenci ve veli girişleri çalışıyor.
5. Yetkisiz rol başka sınıf/sonuç API'sine erişemiyor.
6. Soru görseli yükleme ve `/uploads` görüntüleme çalışıyor.
7. Socket.IO bildirimi sayfa yenilemeden geliyor.
8. Gmail test e-postası ulaşıyor; parola sıfırlama linki doğru domain/alt yolu içeriyor.
9. Sınav oluşturma, çözme ve sonuç; anket oluşturma, katılım ve rapor akışları tamamlanıyor.
10. Yazdırma ve Excel çıktıları deneniyor.
11. Yedek alınıp ayrı konuma geri yükleme provası yapılıyor.
12. `/server-setup` Sunucu Durumu ekranı tüm kritik kontrolleri yeşil gösteriyor.

## 17. Güncelleme ve geri dönüş

```bash
git fetch origin
git checkout <onayli-surum>
npm ci
npm run db:status --workspace=server
npm run db:deploy --workspace=server
npm run build
sudo systemctl restart quizmaster
```

Güncellemeden önce veritabanı ve uploads yedeği alın. Migration uygulanmışsa yalnız eski kodu checkout etmek şemayı geri almaz; her sürüm için veri tabanı geri dönüş planı bulunmalıdır. Sağlık kontrolü başarısızsa proxy trafiğini açmayın.

## 18. Resmî başvuru kaynakları

- [Node.js indirme ve LTS sürümleri](https://nodejs.org/en/download)
- [npm kurulumu](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
- [Nginx HTTP proxy modülü](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
- [Nginx WebSocket proxy](https://nginx.org/en/docs/http/websocket.html)
- [Prisma geliştirme ve üretim migration akışı](https://www.prisma.io/docs/orm/v6/prisma-migrate/workflows/development-and-production)

## Mevcut kurulumda güvenlik bakımı

1. Bakım penceresinde sunucuyu durdurun. SQLite backup API/tutarlı snapshot ile veritabanını ve session verisini yedekleyin; WAL açıkken yalnız ana db dosyasını kopyalamayın.
2. `npm ci` ve `npm run db:deploy --workspace=server` çalıştırın. Migration `sessionVersion`, `processingUntil` ve sonuç indeksleri ekler; kayıtları silmez.
3. `npm run build` ardından sunucuyu yeniden başlatın. Session store çalışma dizininden bağımsız olarak `server/data` altındadır. Eski kök `data/sessions.db` varsa bakım sırasında taşıyın veya yeniden giriş sağlayın.
4. HTTP/Socket.IO gerçek arayüz origin'lerini izin listesine ekleyin. Üretimde localhost istisnası yoktur.
5. Giriş, rol ekranları, görsel, teslim ve parola sıfırlamayı kontrol edin.

Kimliği doğrulanmış genel API/sınav limitleri kullanıcı bazındadır. Dar auth limiti IP+hedef hesap/token kullanır; `/me` ve çıkış buna dahil değildir. Çok sunuculu dağıtım merkezi session/rate-limit store ve Socket.IO adaptörü gerektirir.

Anket şeması uyumu: 20260930120000_nullable_survey_answers migration'ı Question.correctAnswer alanını nullable yapar. SQLite tablo yeniden oluşturması bütün soru sütunlarını ve UUID'leri kopyalar; SurveyAnswer bağlantıları korunur. Yedek ve bakım penceresiyle birlikte db:deploy çalıştırın.

## Akademik arşiv işletimi — 7 Ekim 2026

12 Ekim güncel kaynak kabulü tamamlandı: backend 412/412, frontend 272/272, ayrı gerçek DB/hacim 74/74, setup 14/14, tip kontrolleri ve üretim build geçti. Beş tarayıcı senaryosu doğrulanmış boş migration şablonu ve izole kaynak bundle'ı kullandı. Bu opt-in, varsayılan geliştirme açılışını veya taze hibrit kurulumu doğrulamaz; önceki 3 Ekim kurulum sonuçları yeni 22-migration sürümü için başarı diye kullanılmaz. Yeni sürüm yedek/geri yükleme ve terminal/BAT/SH yükseltme/geri dönüşü ayrı üretim provasında doğrulanacaktır.

Terminal, BAT/SH ve web yapılandırma adımları birlikte kullanılan hibrit kurulum akışı korunur. Akademik arşiv için Chromium'un sunucu hesabında çalışabildiğini ayrıca doğrulayın; Chromium artık `npm ci` sırasında otomatik indirilmez; akademik arşiv PDF'i kullanılacaksa aynı hesapla `npm run archive:prepare --workspace=server` komutunu çalıştırın (Playwright e2e testleri için de aynı komut gerekir). Bağımlılık kurmak veya derlemeyi geçirmek PDF üretimini tek başına doğrulamaz.

`ARCHIVE_BACKUP_ROOT`, kalıcı akademik paket dizinini belirler. Varsayılan dizin `server/data/backups` altındadır. Bu dizinin (özellikle dışarıda yapılandırılmışsa) veritabanıyla birlikte tam uygulama yedeğine dahil edildiğini ayrıca kontrol edin. Akademik ZIP parolaları/oturumları/SMTP ayarlarını içermez ve sunucu geri yükleme yedeği yerine kullanılamaz. Yedekleme ve yükseltme provası [ayrı planda](uretim-ve-bakim-kilavuzu.md) yer alır; henüz doğrulanmamış prova tamamlanmış sayılmaz.

Yeni sürüm additive migration'larla capture sınırlarını, değişmez geçiş özetini, geçmiş arama projeksiyonunu ve lookup indeksini ekler. Önce mevcut DB, uploads, session/config ve paket dizinlerinin tutarlı yedeğini alın; sonra `db:deploy` ve build/restart adımlarını uygulayın. Uygulanmış migration dosyalarını değiştirmeyin. Salt eski kodu checkout etmek veritabanını önceki şemaya döndürmez.

Sunucu açılışı, kaçırılmış yıllık işleri ve tamamlanmış eski arşivlerin arama hazırlığını ele alır. Eski arşivde hazırlık sürerken geçmiş sorgusu açık hazırlık/tekrar deneme yanıtı verebilir; canlı veriye geçmez. Otomatik kapanış İstanbul saatiyle 15 Temmuz 00:05'tedir; başarısız işin nedeni ve kurtarma işlemi admin Arşiv ekranında takip edilir. Dosya ve geçiş kabul sınırları [arşiv paketi](denetim-raporlari/akademik-arsiv-kabul-raporu.md) ve [doğrulama](denetim-raporlari/akademik-arsiv-kabul-raporu.md) belgelerindedir.
