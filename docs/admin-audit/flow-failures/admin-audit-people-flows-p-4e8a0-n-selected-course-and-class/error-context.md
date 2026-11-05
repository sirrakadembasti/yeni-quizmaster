# Talimatlar

- Aşağıdaki Playwright testi başarısız oldu.
- Nedenini kısa ve öz açıklayın; Playwright en iyi uygulamalarına uyun.
- Mümkünse düzeltmeyi içeren bir kod örneği verin.

# Test bilgileri

- Ad: admin-audit-people-flows.spec.ts >> people: teacher creation must retain selected course and class
- Konum: tests-e2e\admin-audit-people-flows.spec.ts:80:5

# Hata ayrıntıları

```
Error: expect(received).toContain(expected) // indexOf

Expected value: "8a32b981-5e3b-449d-80d6-c3eed5b91d85"
Received array: []
```

```
Error: expect(received).toContain(expected) // indexOf

Expected value: "763f8d6f-4eab-40fe-8df6-97db38ca3aa7"
Received array: []
```

# Sayfa anlık görüntüsü

```yaml
- generic [ref=f2e2]:
  - region "Notifications (F8)":
    - list
  - generic [ref=f2e3]:
    - complementary [ref=f2e4]:
      - generic [ref=f2e5]: QuizMaster
      - navigation [ref=f2e13]:
        - link "Dashboard" [ref=f2e14] [cursor=pointer]:
          - /url: /
        - link "Sınav Yönetimi" [ref=f2e20] [cursor=pointer]:
          - /url: /admin-quizzes
        - link "Sınavlar" [ref=f2e24] [cursor=pointer]:
          - /url: /quizzes
        - link "Sınıf İstatistikleri" [ref=f2e28] [cursor=pointer]:
          - /url: /statistics
        - link "Sınav Sonuçları" [ref=f2e31] [cursor=pointer]:
          - /url: /results
        - link "Anket Yönetimi" [ref=f2e35] [cursor=pointer]:
          - /url: /survey-results
        - link "Öğrenciler" [ref=f2e39] [cursor=pointer]:
          - /url: /students
        - link "Öğretmenler" [ref=f2e45] [cursor=pointer]:
          - /url: /teachers
        - link "Veli Eşleştirme" [ref=f2e49] [cursor=pointer]:
          - /url: /guardian-management
        - link "Sınıflar" [ref=f2e54] [cursor=pointer]:
          - /url: /classlist
        - link "Yönetim" [ref=f2e58] [cursor=pointer]:
          - /url: /management
        - link "Arşiv" [ref=f2e62] [cursor=pointer]:
          - /url: /archive
        - link "Sunucu Durumu" [ref=f2e66] [cursor=pointer]:
          - /url: /server-setup
        - link "Duyurular" [ref=f2e78] [cursor=pointer]:
          - /url: /announcements
        - link "Ayarlar" [ref=f2e82] [cursor=pointer]:
          - /url: /settings
    - main [ref=f2e86]:
      - generic [ref=f2e88]:
        - button "Bildirimleri aç" [ref=f2e89]
        - button "Karanlık Moda Geç" [ref=f2e90]
        - button "A Audit Admin Updated Yönetici" [ref=f2e92]:
          - generic [ref=f2e93]: A
          - generic [ref=f2e94]:
            - generic [ref=f2e95]: Audit Admin Updated
            - generic [ref=f2e96]: Yönetici
      - generic [ref=f2e99]:
        - generic [ref=f2e100]:
          - generic [ref=f2e101]:
            - heading "Öğretmen Yönetimi" [level=1] [ref=f2e102]
            - paragraph [ref=f2e103]: Öğretmen hesaplarını oluşturun, düzenleyin ve silin.
          - generic [ref=f2e104]:
            - button "Excel" [ref=f2e105]
            - button "Yazdır" [ref=f2e106]
            - button "Yeni Öğretmen" [ref=f2e107]
        - textbox "Öğretmen adı veya e-posta ile ara..." [ref=f2e113]
        - table [ref=f2e116]:
          - rowgroup [ref=f2e117]:
            - row [ref=f2e118]:
              - columnheader "İsim" [ref=f2e119]
              - columnheader "Sınıf Öğretmenliği" [ref=f2e120]
              - columnheader "Atanan Branşlar" [ref=f2e121]
              - columnheader "Dersine Girdiği Sınıflar" [ref=f2e122]
              - columnheader "Rol" [ref=f2e123]
              - columnheader "İşlemler" [ref=f2e124]
          - rowgroup [ref=f2e125]:
            - row [ref=f2e126]:
              - cell "Audit Teacher" [ref=f2e127]
              - cell "Audit 7A" [ref=f2e128]
              - cell "Yok" [ref=f2e131]
              - cell "Yok" [ref=f2e134]
              - cell "Öğretmen" [ref=f2e137]
              - cell [ref=f2e139]:
                - generic [ref=f2e140]:
                  - button "Detaylar" [ref=f2e141]
                  - button [ref=f2e142]
            - row [ref=f2e143]:
              - cell "People Teacher 1790776879996-867bd" [ref=f2e144]
              - cell "Yok" [ref=f2e145]
              - cell "Yok" [ref=f2e146]
              - cell "Yok" [ref=f2e149]
              - cell "Öğretmen" [ref=f2e152]
              - cell [ref=f2e154]:
                - generic [ref=f2e155]:
                  - button "Detaylar" [ref=f2e156]
                  - button [ref=f2e157]
```

# Test kaynağı

```ts
  6   | let cookies: Awaited<ReturnType<BrowserContext['cookies']>> = [];
  7   | test.beforeEach(async ({ baseURL }) => {
  8   |   expect(baseURL, 'People audit mutations require the disposable 5511 audit frontend').toBe('http://127.0.0.1:5511');
  9   | });
  10  | async function login(page: Page) {
  11  |   if (cookies?.length) {
  12  |     await page.context().addCookies(cookies);
  13  |     await page.goto('/', { waitUntil: 'domcontentloaded' });
  14  |   } else {
  15  |     await page.goto('/auth', { waitUntil: 'domcontentloaded' });
  16  |     await page.getByLabel('E-posta', { exact: true }).fill('audit-admin@example.test');
  17  |     await page.getByLabel('Şifre', { exact: true }).fill('AuditOnly2026!');
  18  |     await page.getByRole('button', { name: /Giriş Yap/ }).last().click();
  19  |     await expect(page.locator('[data-dashboard-shell]')).toBeVisible({ timeout: 30000 });
  20  |     cookies = await page.context().cookies();
  21  |   }
  22  |   await expect(page.locator('[data-dashboard-shell]')).toBeVisible();
  23  | }
  24  | async function api(page: Page, path: string, method = 'GET', data?: unknown) {
  25  |   return page.evaluate(async ({ path, method, data }) => {
  26  |     const token = await fetch('/api/csrf-token').then(response => response.json());
  27  |     const response = await fetch(`/api${path}`, {
  28  |       method,
  29  |       headers: { 'Content-Type': 'application/json', 'x-csrf-token': token.csrfToken },
  30  |       ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  31  |     });
  32  |     return { status: response.status, body: await response.json() };
  33  |   }, { path, method, data });
  34  | }
  35  | const unique = () => `${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
  36  | async function createClass(page: Page, name: string) {
  37  |   const response = await api(page, '/classes', 'POST', { name });
  38  |   expect(response.status, JSON.stringify(response.body)).toBe(201);
  39  |   return response.body;
  40  | }
  41  | async function createStudent(page: Page, name: string, suffix: string, classId?: string) {
  42  |   const response = await api(page, '/users', 'POST', {
  43  |     name, email: `people-student-${suffix}@example.test`, password: 'AuditOnly2026!', role: 'student',
  44  |     ...(classId ? { classId } : {}),
  45  |   });
  46  |   expect(response.status, JSON.stringify(response.body)).toBe(201);
  47  |   return response.body.user;
  48  | }
  49  | async function evidence(page: Page, info: TestInfo, label: string, data: unknown) {
  50  |   await info.attach(label, { body: JSON.stringify(data, null, 2), contentType: 'application/json' });
  51  |   await page.screenshot({ path: info.outputPath(`${label}.png`), fullPage: true, timeout: 10000 });
  52  | }
  53  |
  54  | test('people: student creation in real modal persists enrollment and automatic number', async ({ page }, info) => {
  55  |   await login(page);
  56  |   const suffix = unique();
  57  |   const classroom = await createClass(page, `89-A-${suffix}`);
  58  |   const name = `People Student ${suffix}`;
  59  |   const email = `people-ui-student-${suffix}@example.test`;
  60  |   await page.goto('/students', { waitUntil: 'domcontentloaded' });
  61  |   await page.getByRole('button', { name: 'Yeni Öğrenci', exact: true }).click();
  62  |   const dialog = page.getByRole('dialog');
  63  |   await dialog.getByPlaceholder('Örn: Ahmet Yılmaz').fill(name);
  64  |   await dialog.getByPlaceholder('ornek@okul.com').fill(email);
  65  |   await dialog.getByPlaceholder('En az 6 karakter').fill('AuditOnly2026!');
  66  |   await dialog.getByRole('combobox').first().click();
  67  |   await page.getByRole('option', { name: classroom.name, exact: true }).click();
  68  |   await dialog.getByRole('button', { name: 'Hesabı Oluştur', exact: true }).click();
  69  |   await expect(dialog).toHaveCount(0);
  70  |   await page.reload({ waitUntil: 'domcontentloaded' });
  71  |   await expect(page.getByRole('row').filter({ hasText: email })).toBeVisible();
  72  |   const users = await api(page, '/users');
  73  |   const persisted = users.body.users.find((user: any) => user.email === email);
  74  |   await evidence(page, info, 'student-created', persisted);
  75  |   expect(persisted.classId).toBe(classroom.id);
  76  |   expect(persisted.studentNo).toBe(1);
  77  |   expect(persisted.isActive).toBe(true);
  78  | });
  79  |
  80  | test('people: teacher creation must retain selected course and class', async ({ page }, info) => {
  81  |   await login(page);
  82  |   const suffix = unique();
  83  |   const classroom = await createClass(page, `90-A-${suffix}`);
  84  |   const category = await api(page, '/categories', 'POST', { name: `People Course ${suffix}` });
  85  |   expect(category.status, JSON.stringify(category.body)).toBe(201);
  86  |   const categoryId = category.body.id ?? category.body.category?.id;
  87  |   const categoryName = category.body.name ?? category.body.category?.name;
  88  |   expect(categoryId).toBeTruthy();
  89  |   const email = `people-ui-teacher-${suffix}@example.test`;
  90  |   await page.goto('/teachers', { waitUntil: 'domcontentloaded' });
  91  |   await page.getByRole('button', { name: 'Yeni Öğretmen', exact: true }).click();
  92  |   const dialog = page.getByRole('dialog');
  93  |   await dialog.getByPlaceholder('Örn: Ahmet Yılmaz').fill(`People Teacher ${suffix}`);
  94  |   await dialog.getByPlaceholder('ornek@okul.com').fill(email);
  95  |   await dialog.getByPlaceholder('En az 6 karakter').fill('AuditOnly2026!');
  96  |   await dialog.getByRole('checkbox', { name: categoryName, exact: true }).check();
  97  |   await dialog.getByRole('checkbox', { name: classroom.name, exact: true }).check();
  98  |   await dialog.getByRole('button', { name: 'Hesabı Oluştur', exact: true }).click();
  99  |   await expect(dialog).toHaveCount(0);
  100 |   await page.reload({ waitUntil: 'domcontentloaded' });
  101 |   await expect(page.getByRole('row').filter({ hasText: `People Teacher ${suffix}` })).toBeVisible();
  102 |   const users = await api(page, '/users');
  103 |   const persisted = users.body.users.find((user: any) => user.email === email);
  104 |   await evidence(page, info, 'teacher-selected-assignments', { persisted, expectedClassId: classroom.id, expectedCategoryId: categoryId });
  105 |   expect.soft(persisted.assignedCategories.map((course: any) => course.id)).toContain(categoryId);
> 106 |   expect.soft(persisted.classes.map((item: any) => item.id)).toContain(classroom.id);
      |                                                              ^ Error: expect(received).toContain(expected) // indexOf
  107 | });
  108 |
  109 | test('people: guardian link and unlink persist after reload', async ({ page }, info) => {
  110 |   await login(page);
  111 |   const suffix = unique();
  112 |   const student = await createStudent(page, `People Linked Student ${suffix}`, suffix);
  113 |   const parent = await api(page, '/users', 'POST', {
  114 |     name: `People Guardian ${suffix}`, email: `people-guardian-${suffix}@example.test`,
  115 |     password: 'AuditOnly2026!', role: 'parent', phoneNumber: '05551112233', address: 'People isolated audit address',
  116 |   });
  117 |   expect(parent.status, JSON.stringify(parent.body)).toBe(201);
  118 |   const guardian = parent.body.user;
  119 |   await page.goto('/guardian-management', { waitUntil: 'domcontentloaded' });
  120 |   await page.getByRole('combobox').nth(0).click();
  121 |   await page.getByRole('option', { name: `${guardian.name} · ${guardian.email}`, exact: true }).click();
  122 |   await page.getByPlaceholder('Öğrenci adı, e-posta, sınıf veya no ara').fill(student.name);
  123 |   await page.getByRole('combobox').nth(1).click();
  124 |   await page.getByRole('option').filter({ hasText: student.name }).click();
  125 |   await page.getByRole('combobox').nth(2).click();
  126 |   await page.getByRole('option', { name: 'Baba', exact: true }).click();
  127 |   await page.getByRole('button', { name: 'Öğrenciyi Veliye Bağla', exact: true }).click();
  128 |   await expect(page.getByRole('button', { name: 'Bağlantıyı Kaldır', exact: true })).toBeVisible();
  129 |   let links = await api(page, `/parents/guardian/${guardian.id}/students`);
  130 |   expect(links.body.students.find((link: any) => link.studentId === student.id)?.relation).toBe('Baba');
  131 |   await page.reload({ waitUntil: 'domcontentloaded' });
  132 |   await page.getByRole('combobox').nth(0).click();
  133 |   await page.getByRole('option', { name: `${guardian.name} · ${guardian.email}`, exact: true }).click();
  134 |   await expect(page.getByRole('button', { name: 'Bağlantıyı Kaldır', exact: true })).toBeVisible();
  135 |   await page.getByRole('button', { name: 'Bağlantıyı Kaldır', exact: true }).click();
  136 |   await expect(page.getByRole('button', { name: 'Bağlantıyı Kaldır', exact: true })).toHaveCount(0);
  137 |   await page.reload({ waitUntil: 'domcontentloaded' });
  138 |   links = await api(page, `/parents/guardian/${guardian.id}/students`);
  139 |   await evidence(page, info, 'guardian-unlinked', links);
  140 |   expect(links.body.students).toHaveLength(0);
  141 | });
  142 |
  143 | test('people: same-level student transfer persists target and removes old enrollment', async ({ page }, info) => {
  144 |   await login(page);
  145 |   const suffix = unique();
  146 |   const source = await createClass(page, `91-A-${suffix}`);
  147 |   const target = await createClass(page, `91-B-${suffix}`);
  148 |   const student = await createStudent(page, `People Transfer ${suffix}`, suffix, source.id);
  149 |   await page.goto(`/admin/classes/${target.id}`, { waitUntil: 'domcontentloaded' });
  150 |   await expect(page.getByRole('heading', { name: `Sınıf Yönetimi: ${target.name}`, exact: true })).toBeVisible();
  151 |   await page.getByRole('combobox').nth(1).click();
  152 |   await page.getByRole('option').filter({ hasText: student.name }).click();
  153 |   await page.getByRole('button', { name: 'Sınıfa Dahil Et', exact: true }).click();
  154 |   await expect(page.getByRole('row').filter({ hasText: student.email })).toBeVisible();
  155 |   await page.reload({ waitUntil: 'domcontentloaded' });
  156 |   await expect(page.getByRole('row').filter({ hasText: student.email })).toBeVisible();
  157 |   const [oldClass, newClass] = await Promise.all([api(page, `/classes/${source.id}`), api(page, `/classes/${target.id}`)]);
  158 |   await evidence(page, info, 'student-transfer', { oldClass, newClass });
  159 |   expect(oldClass.body.students.some((user: any) => user.id === student.id)).toBe(false);
  160 |   const enrolled = newClass.body.students.find((user: any) => user.id === student.id);
  161 |   expect(enrolled.classId).toBe(target.id);
  162 |   expect(enrolled.studentNo).toBe(1);
  163 | });
  164 |
```
