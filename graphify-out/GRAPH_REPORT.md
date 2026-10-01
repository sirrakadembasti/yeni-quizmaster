# Graph Report - yeni-quizmaster-main  (2026-10-01)

## Corpus Check
- 359 files · ~443,410 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 3, .bat 2, .example 2)

## Summary
- 2027 nodes · 5705 edges · 109 communities (80 shown, 29 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 67 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e3fefd97`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- setup-bootstrap.mjs
- parent.ts
- IStorage
- PrismaStorage
- dependencies
- sidebar.tsx
- index.ts
- cn
- storage.ts
- client/package.json
- QuizMaster
- api.ts
- package.json
- server/package.json
- compilerOptions
- student-quiz.tsx
- Button
- use-toast.ts
- QuizMaster Sunucu Kurulum Kılavuzu
- api-routes/auth.ts
- admin-inventory.test.tsx
- dependencies
- compilerOptions
- devDependencies
- deployment.ts
- createExcelBytes
- offline-quiz.ts
- QuizMaster Yönetici Kullanıcı Kılavuzu
- item.tsx
- express
- devDependencies
- email.ts
- class-variance-authority
- carousel.tsx
- QuizMaster Gmail E-Posta ve Parola Sıfırlama Kılavuzu
- scripts
- server.ts
- form.tsx
- SQLite'tan PostgreSQL'e Geçiş Rehberi
- QuizMaster Öğrenci Kullanıcı Kılavuzu
- QuizMaster Öğretmen Kullanıcı Kılavuzu
- scripts
- queryClient.ts
- chart.tsx
- command.tsx
- ai.ts
- pagination.tsx
- QuizMaster Graphify Mimari Haritası
- admin-audit-system-flows.spec.ts
- drawer.tsx
- input-group.tsx
- navigation-menu.tsx
- QuizMaster Veli Kullanıcı Kılavuzu
- writeTransaction
- setup-bootstrap-lib.mjs
- compilerOptions
- utils.ts
- NotificationListener.tsx
- http-error.ts
- ref_node_fs
- Kalan yönetici onarımları — doğrulama
- @playwright/test
- admin-operations.test.tsx
- types.d.ts
- Bulgular
- setup-bootstrap.test.mjs
- sw.js
- Confirmed code defects and acceptance criteria
- Yönetici onarımlarının davranış sözleşmeleri
- admin-audit-people-flows.spec.ts
- 2026-09-30-security-reliability.md
- kurulum.sh
- backups/README.md
- data/README.md
- empty.tsx
- admin-audit/README.md
- Yönetici denetimi: öğrenci, öğretmen, sınıf ve veli yönetimi
- 2026-09-30-admin-remaining-repairs.md
- admin-audit-people-flows-p-4e8a0-n-selected-course-and-class/error-context.md
- admin-audit-system-flows-d-063f6-r-instead-of-silent-failure/error-context.md
- Global Constraints
- 2026-09-30-admin-data-integrity-design.md
- Admin sonuç, cache ve atomik kayıt düzeltmeleri
- 2026-09-30-admin-results-and-save-design.md
- refreshCsrfToken
- Admin audit: route inventory, management, settings, server, archive, announcements
- csrf.ts
- Doğrulanmış bulgular
- Testler ve güvenli tekrar kontrolü
- admin-audit.spec.ts
- Yönetici paneli denetimi — 30 Eylül 2026
- Güvenlik ve veri bütünlüğü bakımı — 30 Eylül 2026

## God Nodes (most connected - your core abstractions)
1. `cn()` - 285 edges
2. `Button` - 108 edges
3. `PrismaStorage` - 106 edges
4. `IStorage` - 101 edges
5. `react` - 91 edges
6. `DashboardLayout()` - 71 edges
7. `Card` - 70 edges
8. `lucide-react` - 69 edges
9. `CardContent` - 66 edges
10. `CardHeader` - 63 edges

## Surprising Connections (you probably didn't know these)
- `Task 2: Question editor data preservation` --references--> `QuestionItem()`  [INFERRED]
  docs/superpowers/plans/2026-09-30-admin-data-integrity.md → client/src/components/quiz/QuestionItem.tsx
- `Düzeltme durumu — ikinci paket` --references--> `invalidateAdminRelations()`  [INFERRED]
  docs/admin-audit/people.md → client/src/lib/admin-cache.ts
- `Yöntem ve kanıt sınırı` --references--> `secureJsonReplacer()`  [INFERRED]
  docs/admin-audit/people.md → server/utils/json-security.ts
- `Aktarım sonrası asgari doğrulama` --references--> `StudentResult`  [INFERRED]
  docs/postgresql-gecis-rehberi.md → client/src/lib/api.ts
- `Aktarım sonrası asgari doğrulama` --references--> `Class`  [INFERRED]
  docs/postgresql-gecis-rehberi.md → client/src/lib/api.ts

## Import Cycles
- None detected.

## Communities (109 total, 29 thin omitted)

### Community 0 - "setup-bootstrap.mjs"
Cohesion: 0.10
Nodes (30): appendLog(), authenticated(), authorizeMutation(), cookies(), csrfValue, getPnpmVersion(), handler(), job (+22 more)

### Community 1 - "parent.ts"
Cohesion: 0.17
Nodes (9): createParentSchema, guardianStudentsSchema, linkSchema, relationSchema, router, updateParentSchema, appFor(), secureJsonReplacer() (+1 more)

### Community 4 - "dependencies"
Cohesion: 0.04
Nodes (55): dependencies, class-variance-authority, clsx, cmdk, date-fns, embla-carousel-react, framer-motion, @hookform/resolvers (+47 more)

### Community 5 - "sidebar.tsx"
Cohesion: 0.06
Nodes (39): SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay, SheetTitle, sheetVariants (+31 more)

### Community 6 - "index.ts"
Cohesion: 0.07
Nodes (31): origLookup, connect-sqlite3, cors, helmet, pino-http, sharp, @tailwindcss/vite, vite (+23 more)

### Community 7 - "cn"
Cohesion: 0.05
Nodes (56): Avatar, AvatarFallback, AvatarImage, Breadcrumb, BreadcrumbEllipsis(), BreadcrumbItem, BreadcrumbLink, BreadcrumbList (+48 more)

### Community 8 - "storage.ts"
Cohesion: 0.06
Nodes (32): express-session, @prisma/client, supertest, router, router, router, router, router (+24 more)

### Community 9 - "client/package.json"
Cohesion: 0.05
Nodes (38): description, @types/node, typescript, vitest, zod, zod-validation-error, name, packageManager (+30 more)

### Community 10 - "QuizMaster"
Cohesion: 0.06
Nodes (34): 1. Depoyu indirin, 1. Sunucuyu hazırlayın ve depoyu indirin, 2. Güvenli ön kontrolü ve bootstrap ekranını başlatın, 2. Kurulum başlatıcısını çalıştırın, 3. Grafik kurulum akışını tamamlayın, 3. Sihirbaz adımlarını tamamlayın, 4. Uygulamayı başlatın, 4. Uygulamayı servis olarak çalıştırın (+26 more)

### Community 11 - "api.ts"
Cohesion: 0.08
Nodes (30): AuthContextType, aiApi, AIQuestion, analyticsApi, announcementApi, Category, Class, ClassAnalyticsItem (+22 more)

### Community 12 - "package.json"
Cohesion: 0.09
Nodes (22): devDependencies, concurrently, playwright, @playwright/test, name, tar@<7.5.21, @tootallnate/once@<2.0.1, packageManager (+14 more)

### Community 13 - "server/package.json"
Cohesion: 0.07
Nodes (29): cross-env, dotenv-cli, esbuild, multer, nodemailer, pino, pino-pretty, prisma (+21 more)

### Community 15 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, allowJs, baseUrl, esModuleInterop, isolatedModules, jsx, lib (+14 more)

### Community 16 - "student-quiz.tsx"
Cohesion: 0.23
Nodes (15): AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay, AlertDialogTitle (+7 more)

### Community 17 - "Button"
Cohesion: 0.06
Nodes (178): ALL, AppRouter(), HomeRoute(), RedirectToAuth(), Role, RouteConfig, RouteGuard(), ROUTES (+170 more)

### Community 18 - "use-toast.ts"
Cohesion: 0.12
Nodes (24): Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle, toastVariants (+16 more)

### Community 19 - "QuizMaster Sunucu Kurulum Kılavuzu"
Cohesion: 0.09
Nodes (23): 10. Nginx — subdomain, 11. Nginx — alt yol, 12. IIS reverse proxy özeti, 13. Bootstrap ve tek kullanımlık web kurulum sihirbazı, 14. Log saklama ve veritabanı büyümesi, 15. Yedekleme, 16. İlk canlı kontrol listesi, 17. Güncelleme ve geri dönüş (+15 more)

### Community 20 - "api-routes/auth.ts"
Cohesion: 0.07
Nodes (19): bcryptjs, dotenv, changePasswordSchema, forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, router (+11 more)

### Community 21 - "admin-inventory.test.tsx"
Cohesion: 0.22
Nodes (6): Toaster(), ToasterProps, AuthProvider(), fixture, mount(), next-themes

### Community 22 - "dependencies"
Cohesion: 0.10
Nodes (20): dependencies, bcryptjs, connect-sqlite3, cors, csrf-sync, express, express-rate-limit, express-session (+12 more)

### Community 23 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, lib, module (+10 more)

### Community 24 - "devDependencies"
Cohesion: 0.11
Nodes (18): devDependencies, autoprefixer, baseline-browser-mapping, jsdom, postcss, tailwindcss, @tailwindcss/postcss, @tailwindcss/vite (+10 more)

### Community 25 - "deployment.ts"
Cohesion: 0.15
Nodes (19): requireRuntimeChanges(), router, runtimeDeploymentChangesAllowed(), retentionCutoffs(), RetentionPolicy, runDataRetention(), startDataRetentionWorker(), buildDeploymentArtifacts() (+11 more)

### Community 26 - "createExcelBytes"
Cohesion: 0.24
Nodes (9): columnName(), crc32(), createCsvBytes(), createCsvContent(), createExcelBytes(), quote(), sanitizeCsvValue(), xml() (+1 more)

### Community 27 - "offline-quiz.ts"
Cohesion: 0.25
Nodes (16): clearOfflineUser(), getOfflineQuizList(), getOfflineRemainingSeconds(), getOfflineSession(), getOfflineUser(), markOfflineSubmit(), OfflineQuestion, OfflineQuizSession (+8 more)

### Community 28 - "QuizMaster Yönetici Kullanıcı Kılavuzu"
Cohesion: 0.11
Nodes (18): 10. Duyurular ve bildirimler, 11. Loglar, e-posta ve şifre talepleri, 12. Excel ve yazdırma, 13. Çevrimdışı sınav, 14. Sorun giderme, 1. Giriş ve güvenlik, 2. Yönetici menüsü, 3. Öğrenci yönetimi (+10 more)

### Community 29 - "item.tsx"
Cohesion: 0.11
Nodes (21): ButtonGroup(), ButtonGroupSeparator(), ButtonGroupText(), buttonGroupVariants, FieldSeparator(), Item(), ItemActions(), ItemContent() (+13 more)

### Community 30 - "express"
Cohesion: 0.08
Nodes (48): express, express-rate-limit, querySchema, router, categorySchema, router, classSchema, notify() (+40 more)

### Community 31 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, cross-env, dotenv, dotenv-cli, esbuild, supertest, tsx, @types/connect-sqlite3 (+8 more)

### Community 32 - "email.ts"
Cohesion: 0.24
Nodes (12): originalEnv, original, fake, getEmailConfiguration(), getEmailStatus(), getTransporter(), processEmailQueue(), queueEmail() (+4 more)

### Community 33 - "class-variance-authority"
Cohesion: 0.18
Nodes (12): Alert, AlertDescription, AlertTitle, alertVariants, ToggleGroup, ToggleGroupContext, ToggleGroupItem, Toggle (+4 more)

### Community 34 - "carousel.tsx"
Cohesion: 0.17
Nodes (14): Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext, CarouselOptions (+6 more)

### Community 35 - "QuizMaster Gmail E-Posta ve Parola Sıfırlama Kılavuzu"
Cohesion: 0.13
Nodes (15): 10. Sorun giderme tablosu, 11. Bakım notları, 1. Desteklenen servis, 2. Gmail hesabını hazırlama, 3. Ortam değişkenleri, 4. Parola sıfırlama işleyişi, 5. Outbox kuyruğu, 6. Yönetici işlemleri (+7 more)

### Community 36 - "scripts"
Cohesion: 0.13
Nodes (15): scripts, build, db:create-admin, db:deploy, db:generate, db:migrate, db:seed, db:status (+7 more)

### Community 37 - "server.ts"
Cohesion: 0.08
Nodes (33): buildServerEnv(), envValue(), gmailAddress, publicAppUrl(), SetupPayload, setupPayloadSchema, toDeploymentConfig(), APPLY_STEPS (+25 more)

### Community 38 - "form.tsx"
Cohesion: 0.19
Nodes (12): FormControl, FormDescription, FormFieldContext, FormFieldContextValue, FormItem, FormItemContext, FormItemContextValue, FormLabel (+4 more)

### Community 40 - "SQLite'tan PostgreSQL'e Geçiş Rehberi"
Cohesion: 0.15
Nodes (13): 10. Geçiş sonrası büyüme ve bakım, 11. Resmî başvuru kaynakları, 1. Mevcut uyumluluk durumu, 2. Geçişi başlatma ölçütleri, 3. Geçiş öncesi hazırlık, 4. PostgreSQL migration geçmişini oluşturma, 6. Oturum deposu, 7. JSON alanları için ikinci aşama (+5 more)

### Community 41 - "QuizMaster Öğrenci Kullanıcı Kılavuzu"
Cohesion: 0.15
Nodes (13): 10. Hesap güvenliği, 11. Sorun giderme, 1. Kayıt ve giriş, 2. Öğrenci menüsü, 3. Sınavı başlatmadan önce, 4. Sınavı çözme ve teslim, 5. Anketlerim, 6. Sonuçlar ve istatistikler (+5 more)

### Community 42 - "QuizMaster Öğretmen Kullanıcı Kılavuzu"
Cohesion: 0.15
Nodes (13): 10. Çevrimdışı sınav, 11. Sorun giderme, 1. Giriş ve profil, 2. Öğretmen menüsü, 3. Sınav oluşturma, 4. Sınav yayını ve güvenlik, 5. Anket Yönetimi, 6. Sonuçlar ve sınıf istatistikleri (+5 more)

### Community 43 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, preview, test, test:coverage, test:ui, type-check

### Community 44 - "queryClient.ts"
Cohesion: 0.60
Nodes (4): apiRequest(), getQueryFn(), throwIfResNotOk(), UnauthorizedBehavior

### Community 45 - "chart.tsx"
Cohesion: 0.27
Nodes (10): ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartStyle(), ChartTooltipContent, getPayloadConfigFromPayload() (+2 more)

### Community 46 - "command.tsx"
Cohesion: 0.20
Nodes (10): Command, CommandDialog(), CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator (+2 more)

### Community 47 - "ai.ts"
Cohesion: 0.15
Nodes (11): AIResponseSchema, aiTestLimiter, QuestionSchema, SurveyQuestionSchema, SurveyResponseSchema, fake, blocked, globalV6 (+3 more)

### Community 48 - "pagination.tsx"
Cohesion: 0.24
Nodes (9): ButtonProps, Pagination(), PaginationContent, PaginationEllipsis(), PaginationItem, PaginationLink(), PaginationLinkProps, PaginationNext() (+1 more)

### Community 49 - "QuizMaster Graphify Mimari Haritası"
Cohesion: 0.20
Nodes (10): Bakımda güncellik kontrolü, Commit öncesi kontrol, Grafiği güncelleme, Grafiği sorgulama, Graphify kurulumu, Görsel haritayı açma, Güncellik kuralı, Neden diğer dosyalar paylaşılmıyor? (+2 more)

### Community 50 - "admin-audit-system-flows.spec.ts"
Cohesion: 0.25
Nodes (3): expectedParent, isolatedRoot, runtime

### Community 51 - "drawer.tsx"
Cohesion: 0.25
Nodes (7): DrawerContent, DrawerDescription, DrawerFooter(), DrawerHeader(), DrawerOverlay, DrawerTitle, vaul

### Community 52 - "input-group.tsx"
Cohesion: 0.28
Nodes (8): InputGroup(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton(), inputGroupButtonVariants, InputGroupInput(), InputGroupText(), InputGroupTextarea()

### Community 53 - "navigation-menu.tsx"
Cohesion: 0.28
Nodes (8): NavigationMenu, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle, NavigationMenuViewport, @radix-ui/react-navigation-menu

### Community 54 - "QuizMaster Veli Kullanıcı Kılavuzu"
Cohesion: 0.25
Nodes (8): 1. Veli hesabının oluşturulması, 2. Giriş ve şifre, 3. Veli paneli, 4. Erişim sınırları, 5. Ayarlar ve bildirimler, 6. Sorun giderme, Erişim sınırları, QuizMaster Veli Kullanıcı Kılavuzu

### Community 55 - "writeTransaction"
Cohesion: 0.15
Nodes (3): assertClassCapacity(), validateClassCapacity(), writeTransaction()

### Community 56 - "setup-bootstrap-lib.mjs"
Cohesion: 0.18
Nodes (20): holder, anyExists(), assertInside(), backupItems(), checkDependencies(), clearUploads(), collectFiles(), createVerifiedBackup() (+12 more)

### Community 57 - "compilerOptions"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 58 - "utils.ts"
Cohesion: 0.06
Nodes (23): Calendar(), CalendarDayButton(), InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot, PopoverContent, RadioGroup (+15 more)

### Community 59 - "NotificationListener.tsx"
Cohesion: 0.16
Nodes (9): App(), ErrorBoundary, NotificationListener(), notificationApi, NotificationPage, prependNotification(), react-dom, socket.io-client (+1 more)

### Community 61 - "ref_node_fs"
Cohesion: 0.07
Nodes (25): db, p, repo, require, root, require, origLookup, testDirectory (+17 more)

### Community 62 - "Kalan yönetici onarımları — doğrulama"
Cohesion: 0.33
Nodes (6): Denenmeyen davranışlar, Güncel kesin kanıt, Kalan yönetici onarımları — doğrulama, Kapsam, Sayfa ve sekme bazında onarım kapsamı, Önceliklendirilmiş geliştirme planı

### Community 63 - "@playwright/test"
Cohesion: 0.17
Nodes (3): @playwright/test, isolatedRoot, runtime

### Community 64 - "admin-operations.test.tsx"
Cohesion: 0.08
Nodes (10): mocks, renderEditor(), fixture, api, cases, config, mocks, data (+2 more)

### Community 65 - "types.d.ts"
Cohesion: 0.50
Nodes (3): nanoid, vite, */vite.config

### Community 66 - "Bulgular"
Cohesion: 0.13
Nodes (15): Bulgular, Q01 — P1 — Anket soru türünü değiştiren ardışık güncellemeler birbirini eziyor, Q02 — P1 — Seçenek silince doğru cevap başka seçeneğe kayıyor, Q03 — P1 — Başarısız kayıt kısmi değişiklik/tekrar denemede mükerrer taslak bırakıyor, Q04 — P1 — Sonuç ekranı tamamlanmamış sınavları sıfır puan olarak başarıya katıyor, Q05 — P2 — Yönetici sonuç filtresi öğretmen sınavlarını listelemiyor, Q06 — P2 — Açıklamayı ve süre sınırını temizlemek kaydedilmiyor, Q07 — P2 — Silme nedeni kayboluyor, kalıcı sınav silmenin işlem kaydı yok (+7 more)

### Community 67 - "setup-bootstrap.test.mjs"
Cohesion: 0.21
Nodes (4): finder, scriptDir, CLEAN_INSTALL_CONFIRMATION, fixture()

### Community 69 - "Confirmed code defects and acceptance criteria"
Cohesion: 0.18
Nodes (11): Confirmed code defects and acceptance criteria, INV-01 — P2: successful profile save leaves admin identity stale, INV-02 — P2: management log history silently stops at the first page, INV-03 — P2: archive history hard-capped at 20, INV-04 — P1: archive batch can partially commit, INV-05 — P2: archive preview and mutation select different data, INV-06 — P2: announcement deletion is immediate and errors are silent, INV-07 — P2: request failures are presented as empty/default content (+3 more)

### Community 70 - "Yönetici onarımlarının davranış sözleşmeleri"
Cohesion: 0.40
Nodes (5): Arşiv ve silme, Sunucu ayarları ve hibrit kurulum, Sınıf kapasitesi, Sınıf ve öğretmen erişimi, Yönetici onarımlarının davranış sözleşmeleri

### Community 72 - "admin-audit-people-flows.spec.ts"
Cohesion: 0.23
Nodes (8): api(), cleanup(), createClass(), createStudent(), Fixtures, isolatedRoot, runtime, withFixtures()

### Community 81 - "empty.tsx"
Cohesion: 0.29
Nodes (7): Empty(), EmptyContent(), EmptyDescription(), EmptyHeader(), EmptyMedia(), emptyMediaVariants, EmptyTitle()

### Community 83 - "Yönetici denetimi: öğrenci, öğretmen, sınıf ve veli yönetimi"
Cohesion: 0.20
Nodes (10): Başarılı mevcut kontroller, Düzeltme durumu — ikinci paket, Düzeltme durumu — ilk paket, Ek statik kusurlar ve ürün kararı gerektiren noktalar, Ekran ve eylem envanteri, Koordinatör tarayıcı doğrulaması — 30 Eylül 2026, Sonraki gerçek arayüz test dosyası, Testler ve kapsam (+2 more)

### Community 86 - "admin-audit-people-flows-p-4e8a0-n-selected-course-and-class/error-context.md"
Cohesion: 0.33
Nodes (5): Error details, Instructions, Page snapshot, Test info, Test source

### Community 87 - "admin-audit-system-flows-d-063f6-r-instead-of-silent-failure/error-context.md"
Cohesion: 0.33
Nodes (5): Error details, Instructions, Page snapshot, Test info, Test source

### Community 88 - "Global Constraints"
Cohesion: 0.33
Nodes (5): Admin Data Integrity Implementation Plan, Global Constraints, Task 1: Teacher creation assignments, Task 2: Question editor data preservation, Task 3: Verification and reporting

### Community 90 - "Admin sonuç, cache ve atomik kayıt düzeltmeleri"
Cohesion: 0.29
Nodes (6): Admin sonuç, cache ve atomik kayıt düzeltmeleri, Kanıt ve teslim, PE02 — İlişkisel cache, Q03 — Atomik kayıt, Q04 — Sonuç hesaplama, Q05/Q06 ve inceleme

### Community 98 - "refreshCsrfToken"
Cohesion: 0.29
Nodes (6): apiFetch(), getCsrfToken(), handleResponse(), refreshCsrfToken(), contentSaveApi, deleteQuizWithReason()

### Community 99 - "Admin audit: route inventory, management, settings, server, archive, announcements"
Cohesion: 0.22
Nodes (9): Additional risks requiring targeted verification, Admin audit: route inventory, management, settings, server, archive, announcements, Browser verification addendum — 2026-09-30, Complete admin route inventory, INV-11 — P2: unknown settings tab leaves no active panel, INV-12 — P2: mobile navigation does not close on Escape, INV-13 — P2: malformed deployment URL returns HTTP 500, Read-only browser checklist (+1 more)

### Community 100 - "csrf.ts"
Cohesion: 0.22
Nodes (8): csrf-sync, csrfSynchronisedProtection, generateToken, getTokenFromRequest, getTokenFromState, revokeToken, storeTokenInState, sync

### Community 101 - "Doğrulanmış bulgular"
Cohesion: 0.25
Nodes (8): Doğrulanmış bulgular, PE-01 — P1: yeni öğretmenin seçtiği ders ve sınıflar sessizce kayboluyor, PE-02 — P1: atama değişiklikleri farklı query key'lerde eski yönetici verisini bırakıyor, PE-03 — P2: ders atama API'si öğrenci hesabını öğretmen olarak kabul ediyor, PE-04 — P2: maxStudents saklanıyor ancak kayıt/nakilde kapasiteyi sınırlamıyor, PE-05 — P1: sorumlu öğretmeni kaldırmak ilk oluşturmadaki legacy sınıf erişimini kaldırmıyor, PE-06 — P2: sınıf ve veli bağlantısı işlemlerinde hatalar kullanıcıya görünmüyor, PE-07 — P2: kritik ikon eylemleri klavye ve erişilebilir ad desteğinden yoksun

### Community 102 - "Testler ve güvenli tekrar kontrolü"
Cohesion: 0.29
Nodes (7): Düzeltme durumu — ikinci paket, Düzeltme durumu — ilk paket, Ek araştırma / doğrulanmamış riskler, Nihai tarayıcı doğrulaması, Sekme ve eylem envanteri, Testler ve güvenli tekrar kontrolü, Yönetici denetimi — sınav, anket ve raporlar

### Community 103 - "admin-audit.spec.ts"
Cohesion: 0.33
Nodes (5): cookies, isolatedRoot, login(), routes, runtime

### Community 104 - "Yönetici paneli denetimi — 30 Eylül 2026"
Cohesion: 0.40
Nodes (5): Ortam ve kanıt sınırı, Sayfa ve sekme kontrol listesi, Tekrar çalıştırma, Yönetici paneli denetimi — 30 Eylül 2026, Öncelik ve yapılacak değişiklikler

### Community 105 - "Güvenlik ve veri bütünlüğü bakımı — 30 Eylül 2026"
Cohesion: 0.40
Nodes (5): Doğrulama ve Graphify, Güvenlik ve veri bütünlüğü bakımı — 30 Eylül 2026, İşletim sınırları ve sonraki çalışmalar, Uygulanan düzeltmeler, Veritabanı ve mevcut kurulum

## Knowledge Gaps
- **702 isolated node(s):** `name`, `version`, `type`, `description`, `dev` (+697 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1019 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **29 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `class-variance-authority`, `carousel.tsx`, `sidebar.tsx`, `form.tsx`, `client/package.json`, `chart.tsx`, `command.tsx`, `student-quiz.tsx`, `Button`, `empty.tsx`, `drawer.tsx`, `input-group.tsx`, `navigation-menu.tsx`, `pagination.tsx`, `use-toast.ts`, `utils.ts`, `item.tsx`?**
  _High betweenness centrality (0.172) - this node is a cross-community bridge._
- **Why does `IStorage` connect `IStorage` to `storage.ts`, `PrismaStorage`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Why does `PrismaStorage` connect `PrismaStorage` to `IStorage`, `storage.ts`, `.getGuardianStudents`, `.syncQuestions`, `writeTransaction`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **What connects `name`, `version`, `type` to the rest of the system?**
  _702 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `setup-bootstrap.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.09848484848484848 - nodes in this community are weakly interconnected._
- **Should `IStorage` be split into smaller, more focused modules?**
  _Cohesion score 0.02 - nodes in this community are weakly interconnected._
- **Should `PrismaStorage` be split into smaller, more focused modules?**
  _Cohesion score 0.023809523809523808 - nodes in this community are weakly interconnected._