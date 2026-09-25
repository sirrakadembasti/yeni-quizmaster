# QuizMaster Sunucu Kurulum Kılavuzu

Bu kılavuz QuizMaster'ın başka bir kurumun domain altyapısında subdomain veya alt yol altında üretime alınmasını kapsar. Önerilen model ayrı bir subdomain ve HTTPS reverse proxy'dir.

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
        ├── SQLite/PostgreSQL
        ├── sessions.db veya merkezi session store
        └── uploads
```

### Seçenek A — subdomain (önerilen)

Örnek: `https://sinav.kurum.gov.tr`

- Uygulama, API, yüklemeler ve Socket.IO aynı origin altında kalır.
- CORS, cookie, TLS ve reverse proxy ayarları daha basittir.
- Kurumun ana sitesindeki `/api` veya `/socket.io` yollarıyla çakışmaz.
- `APP_BASE_PATH=/` ve standart `pnpm build` kullanılır.

### Seçenek B — kurum sitesi altında alt yol

Örnek: `https://www.kurum.gov.tr/quizmaster/`

- `APP_BASE_PATH=/quizmaster` ayarlanır.
- Frontend `VITE_BASE_PATH=/quizmaster/` ile yeniden derlenir.
- Reverse proxy `/quizmaster/` yanında istemcinin kullandığı `/api/`, `/uploads/` ve `/socket.io/` kök yollarını da QuizMaster'a yönlendirmelidir.
- Kurumun ana uygulaması bu kök yolları zaten kullanıyorsa çakışma olur. Bu durumda subdomain kullanılmalı veya API prefix'i için ayrıca kapsamlı uygulama değişikliği planlanmalıdır.

## 2. Üretim ön koşulları

- Kurum DNS yöneticisi tarafından açılmış A/AAAA kaydı,
- Kuruma ait geçerli TLS sertifikası ve yenileme süreci,
- Node.js 22 veya 24 LTS,
- Projenin sabitlediği pnpm `9.15.1`,
- Nginx, Apache veya IIS reverse proxy,
- Yalnız sunucu yönetici hesabının erişebildiği uygulama kullanıcısı/dizini,
- SMTP için Gmail uygulama parolası kullanılacaksa dışarı doğru TCP 587 veya 465 izni,
- Düzenli ve sunucu dışına alınan veritabanı/yükleme yedeği.

Node.js ve pnpm'i yalnız resmî dağıtımlardan kurun. Proje `packageManager` alanında pnpm sürümünü sabitler; üretimde rastgele `latest` sürüme geçmeyin.

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
corepack enable
corepack prepare pnpm@9.15.1 --activate
pnpm install --frozen-lockfile
```

Kurumsal ağ internete çıkmıyorsa bağımlılıkları onaylı bir build sunucusunda kurup artefact üretin. `node_modules` klasörünü farklı işletim sistemi veya CPU mimarisinden kopyalamayın; Prisma, Sharp ve SQLite native bileşenleri hedef ortamla aynı olmalıdır.

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
pnpm --filter quiz-master-server db:validate
pnpm --filter quiz-master-server db:status
pnpm --filter quiz-master-server db:deploy
pnpm --filter quiz-master-server db:generate
```

`db:seed` mevcut kayıtları temizleyen demo seed akışıdır ve üretimde kullanılmamalıdır.

İlk yönetici hesabını demo veri oluşturmadan açın:

```bash
export BOOTSTRAP_ADMIN_NAME="Kurum Sistem Yöneticisi"
export BOOTSTRAP_ADMIN_EMAIL="yonetici@kurum.gov.tr"
export BOOTSTRAP_ADMIN_PASSWORD="UZUN_RASTGELE_GECICI_PAROLA"
pnpm --filter quiz-master-server db:create-admin
unset BOOTSTRAP_ADMIN_PASSWORD
```

Komut yalnız hiç yönetici yoksa çalışır, zayıf/bilinen parola kalıplarını reddeder ve mevcut kullanıcıya sessizce admin rolü vermez. İlk girişten sonra parola değiştirilmelidir.

## 8. Frontend ve backend derleme

Subdomain/kök kurulum:

```bash
pnpm build
```

Linux alt yol kurulumu:

```bash
VITE_BASE_PATH=/quizmaster/ pnpm build
```

PowerShell alt yol kurulumu:

```powershell
$env:VITE_BASE_PATH="/quizmaster/"
pnpm build
```

Derleme sonunda `client/dist` ve kökte `dist/index.cjs` bulunmalıdır. Derleme yapılan Node ana sürümü ile üretimdeki Node ana sürümü aynı tutulmalıdır.

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
ExecStart=/usr/bin/pnpm --filter quiz-master-server start
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

Gerçek `node`/`pnpm` yolu `command -v pnpm` ile doğrulanmalıdır. NVM gibi yalnız interaktif shell'de çalışan PATH ayarlarına servis içinde güvenmeyin.

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

Kurulumdan sonra **Sunucu Kurulumu** ekranında HTTPS, forwarded header ve algılanan origin doğrulanmalıdır.

## 13. Web tabanlı Sunucu Kurulumu ekranı

İlk yöneticiyle giriş yaptıktan sonra `/server-setup` adresini açın.

Ekran şunları yapar:

- İstekten origin, HTTPS ve reverse proxy başlıklarını algılar,
- Node/platform/çalışma modu, veritabanı erişimi ve uploads yazma iznini gösterir,
- Subdomain veya alt yol profilini kaydeder,
- `ALLOWED_ORIGINS`, proxy sayısı ve herkese açık URL'yi yönetir,
- `.env.production`, Nginx ve derleme komutu örneği üretir,
- Kontrollü log saklama politikasını etkinleştirir.

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
12. `/server-setup` tüm kritik kontrolleri yeşil gösteriyor.

## 17. Güncelleme ve geri dönüş

```bash
git fetch origin
git checkout <onayli-surum>
pnpm install --frozen-lockfile
pnpm --filter quiz-master-server db:status
pnpm --filter quiz-master-server db:deploy
pnpm build
sudo systemctl restart quizmaster
```

Güncellemeden önce veritabanı ve uploads yedeği alın. Migration uygulanmışsa yalnız eski kodu checkout etmek şemayı geri almaz; her sürüm için veri tabanı geri dönüş planı bulunmalıdır. Sağlık kontrolü başarısızsa proxy trafiğini açmayın.

## 18. Resmî başvuru kaynakları

- [Node.js indirme ve LTS sürümleri](https://nodejs.org/en/download)
- [pnpm kurulumu ve Node uyumluluk tablosu](https://pnpm.io/installation)
- [Nginx HTTP proxy modülü](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
- [Nginx WebSocket proxy](https://nginx.org/en/docs/http/websocket.html)
- [Prisma geliştirme ve üretim migration akışı](https://www.prisma.io/docs/orm/v6/prisma-migrate/workflows/development-and-production)
