# Graph Report - yeni-quizmaster-main  (2026-10-03)

## Corpus Check
- 469 files · ~664,326 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 3, .bat 2, .example 2)

## Summary
- 2206 nodes · 6030 edges · 114 communities (81 shown, 33 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 75 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5b83a116`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- setup-bootstrap.mjs
- express
- IStorage
- PrismaStorage
- dependencies
- sidebar.tsx
- index.ts
- cn
- ref_vitest
- client/package.json
- QuizMaster
- admin-hybrid-setup-closure.mjs
- package.json
- server/package.json
- compilerOptions
- student-quiz.tsx
- Button
- use-toast.ts
- QuizMaster Sunucu Kurulum Kılavuzu
- api-routes/auth.ts
- admin-export-print.spec.ts
- dependencies
- compilerOptions
- devDependencies
- deployment.ts
- export.ts
- Hibrit taze kurulum kapanış kontrolü
- QuizMaster Yönetici Kullanıcı Kılavuzu
- field.tsx
- quiz.ts
- devDependencies
- email.ts
- class-variance-authority
- carousel.tsx
- QuizMaster Gmail E-Posta ve Parola Sıfırlama Kılavuzu
- scripts
- server.ts
- form.tsx
- README.md
- SQLite'tan PostgreSQL'e Geçiş Rehberi
- QuizMaster Öğrenci Kullanıcı Kılavuzu
- QuizMaster Öğretmen Kullanıcı Kılavuzu
- graphify-admin-closure-visual.mjs
- queryClient.ts
- chart.tsx
- command.tsx
- external-request.ts
- pagination.tsx
- QuizMaster Graphify Mimari Haritası
- admin-audit-system-flows.spec.ts
- drawer.tsx
- input-group.tsx
- navigation-menu.tsx
- QuizMaster Veli Kullanıcı Kılavuzu
- writeTransaction
- config.ts
- compilerOptions
- utils.ts
- NotificationListener.tsx
- admin-management-pagination.test.tsx
- ref_node_fs
- Kalan yönetici onarımları — doğrulama
- @playwright/test
- @testing-library/react
- types.d.ts
- Bulgular
- ref_node_path
- sw.js
- Confirmed code defects and acceptance criteria
- Yönetici onarımlarının davranış sözleşmeleri
- admin-audit-people-flows.spec.ts
- 2026-09-30-security-reliability.md
- kurulum.sh
- backups/README.md
- data/README.md
- empty.tsx
- remaining-repairs-verification.md
- Doğrulanmış bulgular
- 2026-09-30-admin-remaining-repairs.md
- admin-audit-people-flows-p-4e8a0-n-selected-course-and-class/error-context.md
- admin-audit-system-flows-d-063f6-r-instead-of-silent-failure/error-context.md
- Global Constraints
- 2026-09-30-admin-data-integrity-design.md
- Admin sonuç, cache ve atomik kayıt düzeltmeleri
- 2026-09-30-admin-results-and-save-design.md
- Admin accessibility closure coverage
- admin-operations.test.tsx
- Admin export and print closure
- applySetup
- admin-audit.spec.ts
- Yönetici paneli denetimi — 30 Eylül 2026
- admin-student-report-request-race.test.tsx
- Admin kalan doğrulamalar ve düzeltmeler
- avatar.tsx
- admin-history-pagination.test.tsx
- admin-results.test.tsx
- admin-student-report-readiness.test.tsx
- admin-teacher-detail-export.test.tsx

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
- `Confirmed changes` --references--> `PrintMeta()`  [INFERRED]
  docs/admin-audit/export-print-closure.md → client/src/components/print/PrintTools.tsx
- `Task 2: Question editor data preservation` --references--> `QuestionItem()`  [INFERRED]
  docs/superpowers/plans/2026-09-30-admin-data-integrity.md → client/src/components/quiz/QuestionItem.tsx
- `Düzeltme durumu — ikinci paket` --references--> `invalidateAdminRelations()`  [INFERRED]
  docs/admin-audit/people.md → client/src/lib/admin-cache.ts
- `Yöntem ve kanıt sınırı` --references--> `secureJsonReplacer()`  [INFERRED]
  docs/admin-audit/people.md → server/utils/json-security.ts
- `Aktarım sonrası asgari doğrulama` --references--> `StudentResult`  [INFERRED]
  docs/postgresql-gecis-rehberi.md → client/src/lib/api.ts

## Import Cycles
- None detected.

## Communities (114 total, 33 thin omitted)

### Community 0 - "setup-bootstrap.mjs"
Cohesion: 0.08
Nodes (52): holder, appendLog(), authenticated(), authorizeMutation(), cookies(), csrfValue, getPnpmVersion(), handler() (+44 more)

### Community 1 - "express"
Cohesion: 0.09
Nodes (34): express, express-rate-limit, AIResponseSchema, aiTestLimiter, QuestionSchema, router, SurveyQuestionSchema, SurveyResponseSchema (+26 more)

### Community 4 - "dependencies"
Cohesion: 0.04
Nodes (55): dependencies, class-variance-authority, clsx, cmdk, date-fns, embla-carousel-react, framer-motion, @hookform/resolvers (+47 more)

### Community 5 - "sidebar.tsx"
Cohesion: 0.06
Nodes (39): SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay, SheetTitle, sheetVariants (+31 more)

### Community 6 - "index.ts"
Cohesion: 0.05
Nodes (42): origLookup, connect-sqlite3, cors, csrf-sync, helmet, multer, pino-http, sharp (+34 more)

### Community 7 - "cn"
Cohesion: 0.05
Nodes (56): Breadcrumb, BreadcrumbEllipsis(), BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator(), ContextMenuCheckboxItem (+48 more)

### Community 8 - "ref_vitest"
Cohesion: 0.05
Nodes (36): bcryptjs, express-session, @prisma/client, supertest, router, router, router, router (+28 more)

### Community 9 - "client/package.json"
Cohesion: 0.05
Nodes (37): description, @types/node, typescript, vitest, zod, zod-validation-error, name, packageManager (+29 more)

### Community 10 - "QuizMaster"
Cohesion: 0.06
Nodes (34): 1. Depoyu indirin, 1. Sunucuyu hazırlayın ve depoyu indirin, 2. Güvenli ön kontrolü ve bootstrap ekranını başlatın, 2. Kurulum başlatıcısını çalıştırın, 3. Grafik kurulum akışını tamamlayın, 3. Sihirbaz adımlarını tamamlayın, 4. Uygulamayı başlatın, 4. Uygulamayı servis olarak çalıştırın (+26 more)

### Community 11 - "admin-hybrid-setup-closure.mjs"
Cohesion: 0.08
Nodes (34): before, bounded(), captureOwnedProcesses(), children, cleanEnv, completedPhase(), creationTime(), digest() (+26 more)

### Community 12 - "package.json"
Cohesion: 0.09
Nodes (22): devDependencies, concurrently, playwright, @playwright/test, name, tar@<7.5.21, @tootallnate/once@<2.0.1, packageManager (+14 more)

### Community 13 - "server/package.json"
Cohesion: 0.06
Nodes (29): cross-env, dotenv, dotenv-cli, esbuild, nodemailer, pino, pino-pretty, prisma (+21 more)

### Community 15 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, allowJs, baseUrl, esModuleInterop, isolatedModules, jsx, lib (+14 more)

### Community 16 - "student-quiz.tsx"
Cohesion: 0.07
Nodes (45): AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay, AlertDialogTitle (+37 more)

### Community 17 - "Button"
Cohesion: 0.06
Nodes (188): ALL, HomeRoute(), Role, RouteConfig, ROUTES, AnnouncementAuthor(), AnnouncementAuthorProps, Props (+180 more)

### Community 18 - "use-toast.ts"
Cohesion: 0.12
Nodes (24): Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle, toastVariants (+16 more)

### Community 19 - "QuizMaster Sunucu Kurulum Kılavuzu"
Cohesion: 0.08
Nodes (24): 10. Nginx — subdomain, 11. Nginx — alt yol, 12. IIS reverse proxy özeti, 13. Bootstrap ve tek kullanımlık web kurulum sihirbazı, 14. Log saklama ve veritabanı büyümesi, 15. Yedekleme, 16. İlk canlı kontrol listesi, 17. Güncelleme ve geri dönüş (+16 more)

### Community 20 - "api-routes/auth.ts"
Cohesion: 0.19
Nodes (10): socket.io, changePasswordSchema, forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, disconnectSessionSockets(), disconnectUserSockets() (+2 more)

### Community 21 - "admin-export-print.spec.ts"
Cohesion: 0.17
Nodes (10): auditCookies, fixture, ids, isolatedRoot, prisma, { PrismaClient }, runtime, suffix (+2 more)

### Community 22 - "dependencies"
Cohesion: 0.10
Nodes (20): dependencies, bcryptjs, connect-sqlite3, cors, csrf-sync, express, express-rate-limit, express-session (+12 more)

### Community 23 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, lib, module (+10 more)

### Community 24 - "devDependencies"
Cohesion: 0.07
Nodes (26): devDependencies, autoprefixer, baseline-browser-mapping, jsdom, postcss, tailwindcss, @tailwindcss/postcss, @tailwindcss/vite (+18 more)

### Community 25 - "deployment.ts"
Cohesion: 0.16
Nodes (16): requireRuntimeChanges(), router, runtimeDeploymentChangesAllowed(), retentionCutoffs(), RetentionPolicy, runDataRetention(), startDataRetentionWorker(), defaultRetention (+8 more)

### Community 26 - "export.ts"
Cohesion: 0.21
Nodes (14): columnName(), crc32(), createCsvBytes(), createCsvContent(), createExcelBytes(), CsvColumn, CsvExportOptions, CsvValue (+6 more)

### Community 27 - "Hibrit taze kurulum kapanış kontrolü"
Cohesion: 0.17
Nodes (12): 3 Ekim 2026 güncel tekrar durumu, Düzeltmeler ve ayrı unit kanıtı, Gerçek kurulum zinciri, Güvenli gerçek koşu harness'i, Hibrit taze kurulum kapanış kontrolü, HY05 — gerçek migration hatasının nedeni ve hedefli düzeltme, İlk gerçek BAT full koşusu — 2 Ekim, İlk gerçek Git SH full koşusu — 2 Ekim (+4 more)

### Community 28 - "QuizMaster Yönetici Kullanıcı Kılavuzu"
Cohesion: 0.11
Nodes (18): 10. Duyurular ve bildirimler, 11. Loglar, e-posta ve şifre talepleri, 12. Excel ve yazdırma, 13. Çevrimdışı sınav, 14. Sorun giderme, 1. Giriş ve güvenlik, 2. Yönetici menüsü, 3. Öğrenci yönetimi (+10 more)

### Community 29 - "field.tsx"
Cohesion: 0.11
Nodes (20): ButtonGroup(), ButtonGroupSeparator(), ButtonGroupText(), buttonGroupVariants, Field(), FieldContent(), FieldDescription(), FieldError() (+12 more)

### Community 30 - "quiz.ts"
Cohesion: 0.12
Nodes (26): router, notify(), saveContentHandler(), schema, notifyAdminsAboutTeacherQuiz(), questionsArraySchema, questionSchema, quizSchema (+18 more)

### Community 31 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, cross-env, dotenv, dotenv-cli, esbuild, supertest, tsx, @types/connect-sqlite3 (+8 more)

### Community 32 - "email.ts"
Cohesion: 0.17
Nodes (17): router, hashResetToken(), issuePasswordReset(), originalEnv, original, fake, getEmailConfiguration(), getEmailStatus() (+9 more)

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
Cohesion: 0.10
Nodes (22): SetupPayload, APPLY_STEPS, ApplyJobState, ApplyStepState, artifactRoot, cookieValue(), createApplyState(), createSetupApp() (+14 more)

### Community 38 - "form.tsx"
Cohesion: 0.19
Nodes (12): FormControl, FormDescription, FormFieldContext, FormFieldContextValue, FormItem, FormItemContext, FormItemContextValue, FormLabel (+4 more)

### Community 39 - "README.md"
Cohesion: 0.19
Nodes (5): Doğrulama ve Graphify, Güvenlik ve veri bütünlüğü bakımı — 30 Eylül 2026, İşletim sınırları ve sonraki çalışmalar, Uygulanan düzeltmeler, Veritabanı ve mevcut kurulum

### Community 40 - "SQLite'tan PostgreSQL'e Geçiş Rehberi"
Cohesion: 0.10
Nodes (20): Category, Class, Quiz, QuizWithDetails, StudentResult, 10. Geçiş sonrası büyüme ve bakım, 11. Resmî başvuru kaynakları, 1. Mevcut uyumluluk durumu (+12 more)

### Community 41 - "QuizMaster Öğrenci Kullanıcı Kılavuzu"
Cohesion: 0.15
Nodes (13): 10. Hesap güvenliği, 11. Sorun giderme, 1. Kayıt ve giriş, 2. Öğrenci menüsü, 3. Sınavı başlatmadan önce, 4. Sınavı çözme ve teslim, 5. Anketlerim, 6. Sonuçlar ve istatistikler (+5 more)

### Community 42 - "QuizMaster Öğretmen Kullanıcı Kılavuzu"
Cohesion: 0.15
Nodes (13): 10. Çevrimdışı sınav, 11. Sorun giderme, 1. Giriş ve profil, 2. Öğretmen menüsü, 3. Sınav oluşturma, 4. Sınav yayını ve güvenlik, 5. Anket Yönetimi, 6. Sonuçlar ve sınıf istatistikleri (+5 more)

### Community 43 - "graphify-admin-closure-visual.mjs"
Cohesion: 0.22
Nodes (8): allowed, graphRoot, outputRoot, report, safeMessage(), safeUrl(), server, sourceRoot

### Community 44 - "queryClient.ts"
Cohesion: 0.47
Nodes (5): apiRequest(), getQueryFn(), queryClient, throwIfResNotOk(), UnauthorizedBehavior

### Community 45 - "chart.tsx"
Cohesion: 0.27
Nodes (10): ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartStyle(), ChartTooltipContent, getPayloadConfigFromPayload() (+2 more)

### Community 46 - "command.tsx"
Cohesion: 0.20
Nodes (10): Command, CommandDialog(), CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator (+2 more)

### Community 47 - "external-request.ts"
Cohesion: 0.36
Nodes (6): fake, blocked, globalV6, isPublicAddress(), isSafeUrl(), safeExternalFetch()

### Community 48 - "pagination.tsx"
Cohesion: 0.24
Nodes (9): ButtonProps, Pagination(), PaginationContent, PaginationEllipsis(), PaginationItem, PaginationLink(), PaginationLinkProps, PaginationNext() (+1 more)

### Community 49 - "QuizMaster Graphify Mimari Haritası"
Cohesion: 0.20
Nodes (9): Bakımda güncellik kontrolü, Commit öncesi kontrol, Grafiği güncelleme, Grafiği sorgulama, Graphify kurulumu, Güncellik kuralı, Neden diğer dosyalar paylaşılmıyor?, Paylaşılan çıktılar (+1 more)

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
Cohesion: 0.22
Nodes (8): 1. Veli hesabının oluşturulması, 2. Giriş ve şifre, 3. Veli paneli, 4. Erişim sınırları, 5. Ayarlar ve bildirimler, 6. Sorun giderme, Erişim sınırları, QuizMaster Veli Kullanıcı Kılavuzu

### Community 55 - "writeTransaction"
Cohesion: 0.14
Nodes (4): Graphify kanıtı, assertClassCapacity(), validateClassCapacity(), writeTransaction()

### Community 56 - "config.ts"
Cohesion: 0.20
Nodes (11): buildServerEnv(), envValue(), gmailAddress, publicAppUrl(), setupPayloadSchema, toDeploymentConfig(), payload, buildDeploymentArtifacts() (+3 more)

### Community 57 - "compilerOptions"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 58 - "utils.ts"
Cohesion: 0.06
Nodes (24): AccordionContent, AccordionItem, AccordionTrigger, HoverCardContent, InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot (+16 more)

### Community 59 - "NotificationListener.tsx"
Cohesion: 0.12
Nodes (13): App(), AppRouter(), RedirectToAuth(), RouteGuard(), UnauthorizedRedirect(), ErrorBoundary, NotificationListener(), notificationApi (+5 more)

### Community 61 - "ref_node_fs"
Cohesion: 0.07
Nodes (20): require, db, { PrismaClient }, root, runtime, isolatedRoot, runtime, prisma (+12 more)

### Community 62 - "Kalan yönetici onarımları — doğrulama"
Cohesion: 0.33
Nodes (6): Denenmeyen davranışlar, Güncel kesin kanıt, Kalan yönetici onarımları — doğrulama, Kapsam, Sayfa ve sekme bazında onarım kapsamı, Önceliklendirilmiş geliştirme planı

### Community 63 - "@playwright/test"
Cohesion: 0.09
Nodes (13): @playwright/test, auditCookies, diagnosticsByPage, open(), openManagementLogView(), PageDiagnostics, pathnameOnly(), redactDiagnosticMessage() (+5 more)

### Community 64 - "@testing-library/react"
Cohesion: 0.19
Nodes (4): mocks, renderEditor(), @testing-library/react, @testing-library/user-event

### Community 65 - "types.d.ts"
Cohesion: 0.50
Nodes (3): nanoid, vite, */vite.config

### Community 66 - "Bulgular"
Cohesion: 0.09
Nodes (22): Bulgular, Düzeltme durumu — ikinci paket, Düzeltme durumu — ilk paket, Ek araştırma / doğrulanmamış riskler, Nihai tarayıcı doğrulaması, Q01 — P1 — Anket soru türünü değiştiren ardışık güncellemeler birbirini eziyor, Q02 — P1 — Seçenek silince doğru cevap başka seçeneğe kayıyor, Q03 — P1 — Başarısız kayıt kısmi değişiklik/tekrar denemede mükerrer taslak bırakıyor (+14 more)

### Community 67 - "ref_node_path"
Cohesion: 0.06
Nodes (21): finder, scriptDir, repository, requireServer, cleanupStartupChild(), releaseOwnedChildHandles(), scriptRoot, actual() (+13 more)

### Community 69 - "Confirmed code defects and acceptance criteria"
Cohesion: 0.10
Nodes (20): Additional risks requiring targeted verification, Admin audit: route inventory, management, settings, server, archive, announcements, Browser verification addendum — 2026-09-30, Complete admin route inventory, Confirmed code defects and acceptance criteria, INV-01 — P2: successful profile save leaves admin identity stale, INV-02 — P2: management log history silently stops at the first page, INV-03 — P2: archive history hard-capped at 20 (+12 more)

### Community 70 - "Yönetici onarımlarının davranış sözleşmeleri"
Cohesion: 0.40
Nodes (5): Arşiv ve silme, Sunucu ayarları ve hibrit kurulum, Sınıf kapasitesi, Sınıf ve öğretmen erişimi, Yönetici onarımlarının davranış sözleşmeleri

### Community 72 - "admin-audit-people-flows.spec.ts"
Cohesion: 0.23
Nodes (8): api(), cleanup(), createClass(), createStudent(), Fixtures, isolatedRoot, runtime, withFixtures()

### Community 81 - "empty.tsx"
Cohesion: 0.29
Nodes (7): Empty(), EmptyContent(), EmptyDescription(), EmptyHeader(), EmptyMedia(), emptyMediaVariants, EmptyTitle()

### Community 83 - "Doğrulanmış bulgular"
Cohesion: 0.11
Nodes (18): Başarılı mevcut kontroller, Doğrulanmış bulgular, Düzeltme durumu — ikinci paket, Düzeltme durumu — ilk paket, Ek statik kusurlar ve ürün kararı gerektiren noktalar, Ekran ve eylem envanteri, Koordinatör tarayıcı doğrulaması — 30 Eylül 2026, PE-01 — P1: yeni öğretmenin seçtiği ders ve sınıflar sessizce kayboluyor (+10 more)

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

### Community 98 - "Admin accessibility closure coverage"
Cohesion: 0.25
Nodes (7): Admin accessibility closure coverage, Final full-run runtime evidence, Final initial-run defects and focused repair evidence, Initial full-run runtime evidence, Label repair and unit regression evidence, Reader availability and limits, Run scope

### Community 100 - "Admin export and print closure"
Cohesion: 0.29
Nodes (7): Admin export and print closure, Confirmed changes, Final PDF visual and text QA, PR04: teacher-detail print pagination, Scope, Scope notes, Survey landscape diagnosis and measured fix

### Community 101 - "applySetup"
Cohesion: 0.15
Nodes (12): Görsel haritayı açma, Accessibility verification, Admin verification closure implementation plan, Export and print verification, Fresh hybrid setup, Global constraints, Integration and report, deploySetupDatabase() (+4 more)

### Community 103 - "admin-audit.spec.ts"
Cohesion: 0.33
Nodes (5): cookies, isolatedRoot, login(), routes, runtime

### Community 104 - "Yönetici paneli denetimi — 30 Eylül 2026"
Cohesion: 0.40
Nodes (5): Ortam ve kanıt sınırı, Sayfa ve sekme kontrol listesi, Tekrar çalıştırma, Yönetici paneli denetimi — 30 Eylül 2026, Öncelik ve yapılacak değişiklikler

### Community 105 - "admin-student-report-request-race.test.tsx"
Cohesion: 0.33
Nodes (3): api, studentA, studentB

### Community 109 - "Admin kalan doğrulamalar ve düzeltmeler"
Cohesion: 0.33
Nodes (6): Admin kalan doğrulamalar ve düzeltmeler, Doğrulanmış hatalar ve kabul kriterleri, Güncel doğrulama durumu, HY06 / kritik — derlenen API açılmıyor, Ortam sınırları ve verilerin korunması, UX iyileştirmeleri ve yeni özellik önerileri

### Community 110 - "avatar.tsx"
Cohesion: 0.40
Nodes (4): Avatar, AvatarFallback, AvatarImage, @radix-ui/react-avatar

## Knowledge Gaps
- **779 isolated node(s):** `name`, `version`, `type`, `description`, `dev` (+774 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1122 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **33 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `class-variance-authority`, `carousel.tsx`, `sidebar.tsx`, `form.tsx`, `client/package.json`, `chart.tsx`, `avatar.tsx`, `command.tsx`, `student-quiz.tsx`, `Button`, `empty.tsx`, `drawer.tsx`, `input-group.tsx`, `navigation-menu.tsx`, `pagination.tsx`, `use-toast.ts`, `utils.ts`, `field.tsx`?**
  _High betweenness centrality (0.191) - this node is a cross-community bridge._
- **Why does `PrismaStorage` connect `PrismaStorage` to `IStorage`, `ref_vitest`, `.getGuardianStudents`, `.syncQuestions`, `writeTransaction`?**
  _High betweenness centrality (0.115) - this node is a cross-community bridge._
- **Why does `IStorage` connect `IStorage` to `ref_vitest`, `PrismaStorage`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **What connects `name`, `version`, `type` to the rest of the system?**
  _779 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `setup-bootstrap.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.07743496672716274 - nodes in this community are weakly interconnected._
- **Should `express` be split into smaller, more focused modules?**
  _Cohesion score 0.09155844155844156 - nodes in this community are weakly interconnected._
- **Should `IStorage` be split into smaller, more focused modules?**
  _Cohesion score 0.02 - nodes in this community are weakly interconnected._