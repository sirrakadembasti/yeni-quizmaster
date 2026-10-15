# Talimatlar

- Aşağıdaki Playwright testi başarısız oldu.
- Nedenini kısa ve öz açıklayın; Playwright en iyi uygulamalarına uyun.
- Mümkünse düzeltmeyi içeren bir kod örneği verin.

# Test bilgileri

- Ad: admin-audit-system-flows.spec.ts >> deployment invalid origin receives API 400 and visible error instead of silent failure
- Konum: tests-e2e\admin-audit-system-flows.spec.ts:183:5

# Hata ayrıntıları

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 400
Received: 500
```

# Sayfa anlık görüntüsü

```yaml
- generic [ref=f1e2]:
  - region "Notifications (F8)":
    - list
  - generic [ref=f1e3]:
    - complementary [ref=f1e4]:
      - generic [ref=f1e5]: QuizMaster
      - navigation [ref=f1e13]:
        - link "Dashboard" [ref=f1e14] [cursor=pointer]:
          - /url: /
        - link "Sınav Yönetimi" [ref=f1e20] [cursor=pointer]:
          - /url: /admin-quizzes
        - link "Sınavlar" [ref=f1e24] [cursor=pointer]:
          - /url: /quizzes
        - link "Sınıf İstatistikleri" [ref=f1e28] [cursor=pointer]:
          - /url: /statistics
        - link "Sınav Sonuçları" [ref=f1e31] [cursor=pointer]:
          - /url: /results
        - link "Anket Yönetimi" [ref=f1e35] [cursor=pointer]:
          - /url: /survey-results
        - link "Öğrenciler" [ref=f1e39] [cursor=pointer]:
          - /url: /students
        - link "Öğretmenler" [ref=f1e45] [cursor=pointer]:
          - /url: /teachers
        - link "Veli Eşleştirme" [ref=f1e49] [cursor=pointer]:
          - /url: /guardian-management
        - link "Sınıflar" [ref=f1e54] [cursor=pointer]:
          - /url: /classlist
        - link "Yönetim" [ref=f1e58] [cursor=pointer]:
          - /url: /management
        - link "Arşiv" [ref=f1e62] [cursor=pointer]:
          - /url: /archive
        - link "Sunucu Durumu" [ref=f1e66] [cursor=pointer]:
          - /url: /server-setup
        - link "Duyurular" [ref=f1e78] [cursor=pointer]:
          - /url: /announcements
        - link "Ayarlar" [ref=f1e82] [cursor=pointer]:
          - /url: /settings
    - main [ref=f1e86]:
      - generic [ref=f1e88]:
        - button "Bildirimleri aç" [ref=f1e89]
        - button "Karanlık Moda Geç" [ref=f1e90]
        - button "A Audit Admin Updated Yönetici" [ref=f1e92]:
          - generic [ref=f1e93]: A
          - generic [ref=f1e94]:
            - generic [ref=f1e95]: Audit Admin Updated
            - generic [ref=f1e96]: Yönetici
      - generic [ref=f1e99]:
        - generic [ref=f1e100]:
          - generic [ref=f1e101]:
            - heading "Sunucu Durumu" [level=1] [ref=f1e102]
            - paragraph [ref=f1e114]: Yerel/kurum dağıtım profilini, reverse proxy, alt yol ve veri saklamayı denetleyin.
          - button "Sunucuyu Yeniden Algıla" [ref=f1e115]
        - paragraph [ref=f1e120]:
          - text: Bu ekran gizli anahtarları göstermez veya değiştirmez.
          - code [ref=f1e121]: DATABASE_URL
          - text: ","
          - code [ref=f1e122]: SESSION_SECRET
          - text: ve Gmail uygulama parolası sunucunun
          - code [ref=f1e123]: .env
          - text: /secret yöneticisinde tutulmalıdır. Kaydedilen ağ ayarları yeniden başlatmada; alt yol ise ayrıca frontend yeniden derlendiğinde etkinleşir. Yerel (
          - code [ref=f1e124]: localhost
          - text: ) kurulumda HTTP normaldir; üretimde HTTPS kullanın.
        - generic [ref=f1e125]:
          - generic [ref=f1e126]: Veritabanı erişilebilir
          - generic [ref=f1e131]: Yükleme alanı yazılabilir
          - generic [ref=f1e136]: Oturum anahtarı tanımlı
          - generic [ref=f1e141]: Yerel HTTP (beklenen)
        - generic [ref=f1e146]:
          - generic [ref=f1e147]:
            - generic [ref=f1e148]:
              - generic [ref=f1e149]: Dağıtım Profili
              - generic [ref=f1e150]:
                - text: Yerel deneme için
                - strong [ref=f1e151]: localhost
                - text: ", üretim için"
                - strong [ref=f1e152]: subdomain
                - text: önerilir. Alt yol, mevcut kurum sitesiyle servis yollarını paylaşır.
            - generic [ref=f1e153]:
              - generic [ref=f1e154]:
                - generic [ref=f1e155]:
                  - text: Kurulum biçimi
                  - combobox [ref=f1e156]:
                    - generic: Yerel / localhost (deneme)
                  - paragraph [ref=f1e159]: "Yerel deneme: arayüz http://127.0.0.1:5173 (pnpm dev), API :5000. Reverse proxy/TLS gerekmez."
                - generic [ref=f1e160]:
                  - text: Güvenilir proxy sayısı
                  - spinbutton [ref=f1e161]: "0"
                  - paragraph [ref=f1e162]: Yerelde 0; tek Nginx önünde 1.
              - generic [ref=f1e163]:
                - text: Herkese açık adres
                - textbox "http://127.0.0.1:5173" [ref=f1e164]: not-an-origin
                - paragraph [ref=f1e165]:
                  - text: Yerelde tarayıcı adresi
                  - code [ref=f1e166]: http://127.0.0.1:5173
                  - text: (pnpm dev). API portu 5000’dir.
              - generic [ref=f1e167]:
                - text: Uygulama alt yolu
                - textbox "/quizmaster" [disabled] [ref=f1e168]: /
              - generic [ref=f1e169]:
                - text: İzinli origin adresleri
                - textbox "http://127.0.0.1:5173 http://localhost:5173 http://127.0.0.1:5000" [ref=f1e170]:
                  - /placeholder: "http://127.0.0.1:5173\nhttp://localhost:5173\nhttp://127.0.0.1:5000"
                  - text: http://127.0.0.1:5511
                - paragraph [ref=f1e171]: CORS/CSRF için tam adresler. Yerelde 5173 (arayüz) ve 5000 (API) birlikte yazın.
              - button "Profili Kaydet" [ref=f1e172]
          - generic [ref=f1e173]:
            - generic [ref=f1e174]:
              - generic [ref=f1e175]: Algılanan Sunucu
              - generic [ref=f1e176]: Reverse proxy tarafından uygulamaya iletilen güvenli özet.
            - generic [ref=f1e177]:
              - generic [ref=f1e178]:
                - generic [ref=f1e179]: origin
                - generic [ref=f1e180]: http://127.0.0.1:5510
              - generic [ref=f1e181]:
                - generic [ref=f1e182]: forwardedProto
                - generic [ref=f1e183]: —
              - generic [ref=f1e184]:
                - generic [ref=f1e185]: forwardedHost
                - generic [ref=f1e186]: —
              - generic [ref=f1e187]:
                - generic [ref=f1e188]: forwardedForPresent
                - generic [ref=f1e189]: "false"
              - generic [ref=f1e190]:
                - generic [ref=f1e191]: hostname
                - generic [ref=f1e192]: acer
              - generic [ref=f1e193]:
                - generic [ref=f1e194]: platform
                - generic [ref=f1e195]: win32/x64
              - generic [ref=f1e196]:
                - generic [ref=f1e197]: nodeVersion
                - generic [ref=f1e198]: v22.23.2
              - generic [ref=f1e199]:
                - generic [ref=f1e200]: nodeEnvironment
                - generic [ref=f1e201]: development
              - generic [ref=f1e202]:
                - generic [ref=f1e203]: databaseProvider
                - generic [ref=f1e204]: sqlite
              - generic [ref=f1e205]:
                - generic [ref=f1e206]:
                  - generic [ref=f1e211]: Yapılandırma kaynağı
                  - generic [ref=f1e212]: environment
                - generic [ref=f1e213]:
                  - generic [ref=f1e216]: Gmail
                  - generic [ref=f1e217]: Eksik
        - generic [ref=f1e218]:
          - generic [ref=f1e219]:
            - generic [ref=f1e220]: Veri Saklama Politikası
            - generic [ref=f1e221]: Varsayılan olarak kapalıdır. Yalnız süresi dolmuş operasyon kayıtlarını temizler; sınav ve anket sonuçlarına dokunmaz.
          - generic [ref=f1e222]:
            - generic [ref=f1e223]:
              - generic [ref=f1e224]:
                - generic [ref=f1e225]: Otomatik günlük bakım
                - generic [ref=f1e226]: Okunmuş bildirim, tamamlanmış e-posta/parola talepleri ve işlem logları
              - switch [ref=f1e227] [cursor=pointer]
            - generic [ref=f1e228]:
              - generic [ref=f1e229]:
                - text: İşlem logu (gün)
                - spinbutton [ref=f1e230]: "365"
              - generic [ref=f1e231]:
                - text: Okunmuş bildirim (gün)
                - spinbutton [ref=f1e232]: "180"
              - generic [ref=f1e233]:
                - text: E-posta logu (gün)
                - spinbutton [ref=f1e234]: "90"
              - generic [ref=f1e235]:
                - text: Parola talebi (gün)
                - spinbutton [ref=f1e236]: "90"
            - generic [ref=f1e237]:
              - button "Politikayı Kaydet" [ref=f1e238]
              - button "Şimdi Temizle" [disabled]
        - generic [ref=f1e239]:
          - generic [ref=f1e240]:
            - generic [ref=f1e241]: Ortam Değişkeni Şablonu
            - generic [ref=f1e244]:
              - generic [ref=f1e245]:
                - generic [ref=f1e246]: .env.production
                - button "Kopyala" [ref=f1e247]
              - generic [ref=f1e248]: NODE_ENV=production PORT=5000 FRONTEND_URL=http://127.0.0.1:5511 APP_BASE_PATH=/ ALLOWED_ORIGINS=http://127.0.0.1:5511 TRUST_PROXY_HOPS=0 DATABASE_URL=file:../data/quiz.db SESSION_SECRET=<SECRET_MANAGER_ILE_GUCLU_DEGER> EMAIL_USER=<GMAIL_ADRESI> EMAIL_PASS=<GOOGLE_UYGULAMA_PAROLASI> EMAIL_FROM=<GMAIL_ADRESI> EMAIL_FROM_NAME=QuizMaster
          - generic [ref=f1e249]:
            - generic [ref=f1e250]: Nginx Reverse Proxy Şablonu
            - generic [ref=f1e253]:
              - generic [ref=f1e254]:
                - generic [ref=f1e255]: Nginx yapılandırması
                - button "Kopyala" [ref=f1e256]
              - generic [ref=f1e257]: "# Yerel (localhost) kurulum: reverse proxy gerekmez. # Uygulama doğrudan http://127.0.0.1:5510 üzerinden açılır. # Üretime çıkarken subdomain veya subpath profilini kullanın."
          - generic [ref=f1e258]:
            - generic [ref=f1e259]:
              - generic [ref=f1e260]: Derleme Komutu
              - generic [ref=f1e261]: Alt yol değiştiğinde bu komutla yeniden derleyin.
            - generic [ref=f1e263]:
              - generic [ref=f1e264]:
                - generic [ref=f1e265]: PowerShell
                - button "Kopyala" [ref=f1e266]
              - generic [ref=f1e267]: pnpm build
```

# Test kaynağı

```ts
  91  | test('management user invalid input visible validation, create, edit, cancel and delete persist', async ({ page }) => {
  92  |   await login(page);
  93  |   const email = `system-flow-${Date.now()}@example.test`;
  94  |   await page.goto('/management',{waitUntil:'domcontentloaded'});
  95  |   await page.getByRole('tab', { name: 'Kullanıcılar', exact: true }).click();
  96  |   await page.getByRole('button', { name: /Yeni Kullanıcı/ }).click();
  97  |   const dialog = page.getByRole('dialog');
  98  |   await dialog.getByPlaceholder('Örn: Mehmet Can').fill('System Flow Student');
  99  |   await dialog.getByPlaceholder('mehmet@okul.com').fill('invalid-address');
  100 |   const badResponse = page.waitForResponse(r => r.url().endsWith('/api/users') && r.request().method() === 'POST');
  101 |   await dialog.getByRole('button', { name: 'Kullanıcıyı Kaydet' }).click();
  102 |   expect((await badResponse).status()).toBe(400);
  103 |   await expect(page.getByText('Ad, geçerli e-posta ve en az 6 karakterli parola gereklidir.', { exact: true })).toBeVisible();
  104 |   await expect(dialog).toBeVisible();
  105 |   await dialog.getByPlaceholder('mehmet@okul.com').fill(email);
  106 |   await dialog.locator('input[type=password]').fill('AuditOnly2026!');
  107 |   await dialog.getByRole('button', { name: 'Kullanıcıyı Kaydet' }).click();
  108 |   await expect(dialog).toHaveCount(0);
  109 |   let row = page.getByRole('row').filter({ hasText: email });
  110 |   await expect(row).toBeVisible();
  111 |   const created = (await api(page, '/users')).body.users.find((u: any) => u.email === email);
  112 |   expect(created.role).toBe('student');
  113 |   await page.reload({waitUntil:'domcontentloaded'});
  114 |   await page.getByRole('tab', { name: 'Kullanıcılar', exact: true }).click();
  115 |   await row.getByRole('button').nth(0).click();
  116 |   await dialog.getByPlaceholder('Örn: Mehmet Can').fill('System Flow Student Updated');
  117 |   await dialog.getByRole('button', { name: 'Değişiklikleri Kaydet', exact: true }).click();
  118 |   await expect(row).toContainText('System Flow Student Updated');
  119 |   expect((await api(page, '/users/' + created.id)).body.user.name).toBe('System Flow Student Updated');
  120 |   await row.getByRole('button').nth(1).click();
  121 |   await dialog.getByRole('button', { name: 'Vazgeç', exact: true }).click();
  122 |   await expect(row).toBeVisible();
  123 |   await row.getByRole('button').nth(1).click();
  124 |   await dialog.getByRole('button', { name: 'Evet, Sil', exact: true }).click();
  125 |   await expect(row).toHaveCount(0);
  126 |   await page.reload({waitUntil:'domcontentloaded'});
  127 |   expect((await api(page, '/users/' + created.id)).status).toBe(404);
  128 | });
  129 |
  130 | test('parent creation requires contact information before submit', async ({ page }) => {
  131 |   await login(page);
  132 |   await page.goto('/management',{waitUntil:'domcontentloaded'});
  133 |   await page.getByRole('tab', { name: 'Kullanıcılar', exact: true }).click();
  134 |   await page.getByRole('button', { name: /Yeni Kullanıcı/ }).click();
  135 |   const dialog = page.getByRole('dialog');
  136 |   await option(page, dialog.getByRole('combobox'), 'Veli (Bağlı Öğrencileri İzleyebilir)');
  137 |   await expect(dialog.getByRole('button', { name: 'Kullanıcıyı Kaydet' })).toBeDisabled();
  138 |   await expect(dialog.getByRole('button', { name: 'Veli-Öğrenci Eşleştirme Sayfasını Aç' })).toBeVisible();
  139 |   await page.keyboard.press('Escape');
  140 |   await expect(dialog).toHaveCount(0);
  141 | });
  142 |
  143 | test('archive promotion moves only isolated new students, updates counts and graduation persists', async ({ page }) => {
  144 |   await login(page);
  145 |   const tag = Date.now();
  146 |   const from = await api(page, '/classes', 'POST', { name: `6-Audit-${tag}` });
  147 |   const to = await api(page, '/classes', 'POST', { name: `7-Audit-${tag}` });
  148 |   expect(from.status).toBe(201); expect(to.status).toBe(201);
  149 |   const added = await api(page, '/users', 'POST', { name: 'Promotion isolated student', email: `promotion-${tag}@example.test`, password: 'AuditOnly2026!', role: 'student', classId: from.body.id });
  150 |   expect(added.status).toBe(201);
  151 |   const student = added.body.user;
  152 |   try {
  153 |     await page.goto('/archive');
  154 |     await page.getByRole('tab', { name: 'Sınıf Atlatma', exact: true }).click();
  155 |     await option(page, page.getByRole('combobox').nth(0), new RegExp(`6-Audit-${tag}`));
  156 |     await option(page, page.getByRole('combobox').nth(1), `7-Audit-${tag}`);
  157 |     await page.getByRole('button', { name: 'İşlemi Başlat', exact: true }).click();
  158 |     await expect(page.getByRole('dialog')).toContainText('farklı bir seviyeye');
  159 |     await page.getByRole('button', { name: 'Vazgeç', exact: true }).click();
  160 |     expect((await api(page, '/users/' + student.id)).body.user.classId).toBe(from.body.id);
  161 |     await page.getByRole('button', { name: 'İşlemi Başlat', exact: true }).click();
  162 |     await page.getByRole('button', { name: 'Evet, İşlemi Yap', exact: true }).click();
  163 |     await expect(page.getByRole('dialog')).toHaveCount(0);
  164 |     expect((await api(page, '/users/' + student.id)).body.user.classId).toBe(to.body.id);
  165 |     await page.reload({waitUntil:'domcontentloaded'});
  166 |     await page.getByRole('tab', { name: 'Sınıf Atlatma', exact: true }).click();
  167 |     await option(page, page.getByRole('combobox').nth(0), new RegExp(`7-Audit-${tag}`));
  168 |     await expect(page.getByRole('combobox').nth(0)).toContainText('1 Öğrenci');
  169 |     await page.getByRole('button', { name: 'İşlemi Başlat', exact: true }).click();
  170 |     await page.getByRole('button', { name: 'Evet, İşlemi Yap', exact: true }).click();
  171 |     await expect(page.getByRole('dialog')).toHaveCount(0);
  172 |     await page.reload({waitUntil:'domcontentloaded'});
  173 |     const graduate = (await api(page, '/users/' + student.id)).body.user;
  174 |     expect(graduate.classId).toBeNull(); expect(graduate.studentNo).toBeNull();
  175 |     expect((await api(page, '/users/audit-student')).body.user.classId).toBe('audit-class');
  176 |   } finally {
  177 |     await api(page, '/users/' + student.id, 'DELETE');
  178 |     await api(page, '/classes/' + from.body.id, 'DELETE');
  179 |     await api(page, '/classes/' + to.body.id, 'DELETE');
  180 |   }
  181 | });
  182 |
  183 | test('deployment invalid origin receives API 400 and visible error instead of silent failure', async ({ page }, info) => {
  184 |   await login(page);
  185 |   await page.goto('/server-setup');
  186 |   await expect(page.getByRole('button', { name: 'Profili Kaydet' })).toBeEnabled();
  187 |   await page.getByText('Herkese açık adres', { exact: true }).locator('..').locator('input').fill('not-an-origin');
  188 |   const failed = page.waitForResponse(r => r.url().endsWith('/api/admin/deployment/configuration') && r.request().method() === 'PUT');
  189 |   await page.getByRole('button', { name: 'Profili Kaydet' }).click();
  190 |   const response = await failed;
> 191 |   expect(response.status()).toBe(400);
      |                             ^ Error: expect(received).toBe(expected) // Object.is equality
  192 |   await info.attach('invalid-deployment-response', { body: await response.text(), contentType: 'application/json' });
  193 |   await page.screenshot({ path: 'docs/admin-audit/evidence/deployment-invalid-profile.png', fullPage: true });
  194 |   // Desired UX assertion intentionally exposes the absent Sonner renderer.
  195 |   await expect(page.getByText('Yapılandırma geçersiz.', { exact: true })).toBeVisible();
  196 | });
  197 |
  198 | test('deployment profile saves only under isolated root and survives HTTP reload', async ({ page }) => {
  199 |   await login(page);
  200 |   const before = await api(page, '/admin/deployment/status');
  201 |   expect(before.status).toBe(200); expect(before.body.runtimeChangesAllowed).toBe(true);
  202 |   const savedPath = join(isolatedRoot, 'server', 'data', 'deployment-config.json');
  203 |   const updated = { ...before.body.config, publicUrl: 'http://127.0.0.1:5511', mode: 'localhost', basePath: '/', allowedOrigins: ['http://127.0.0.1:5511', 'http://127.0.0.1:5510'], trustProxyHops: 0 };
  204 |   try {
  205 |     await page.goto('/server-setup');
  206 |     await expect(page.getByRole('button', { name: 'Profili Kaydet' })).toBeEnabled();
  207 |     await option(page, page.getByRole('combobox'), 'Yerel / localhost (deneme)');
  208 |     await page.getByPlaceholder('http://127.0.0.1:5173').fill(updated.publicUrl);
  209 |     await page.locator('textarea').first().fill(updated.allowedOrigins.join('\n'));
  210 |     await page.locator('input[type=number]').first().fill('0');
  211 |     const saved = page.waitForResponse(r => r.url().endsWith('/api/admin/deployment/configuration') && r.request().method() === 'PUT');
  212 |     await page.getByRole('button', { name: 'Profili Kaydet' }).click();
  213 |     expect((await saved).status()).toBe(200);
  214 |     await expect.poll(() => existsSync(savedPath)).toBe(true);
  215 |     const disk = JSON.parse(readFileSync(savedPath, 'utf8'));
  216 |     expect(disk.publicUrl).toBe(updated.publicUrl); expect(disk.trustProxyHops).toBe(0);
  217 |     await page.reload({waitUntil:'domcontentloaded'});
  218 |     await expect(page.getByPlaceholder('http://127.0.0.1:5173')).toHaveValue(updated.publicUrl);
  219 |     expect((await api(page, '/admin/deployment/status')).body.config.allowedOrigins).toEqual(updated.allowedOrigins);
  220 |   } finally {
  221 |     const restored = await api(page, '/admin/deployment/configuration', 'PUT', before.body.config);
  222 |     expect(restored.status).toBe(200);
  223 |   }
  224 | });
  225 |
```
