# Graph Report - yeni-quizmaster-main  (2026-10-04)

## Corpus Check
- 661 files · ~1,165,230 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 3, .bat 2, .example 2)

## Summary
- 2465 nodes · 6556 edges · 130 communities (92 shown, 38 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 80 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `053138e7`
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
- student-audit-helpers.ts
- client/package.json
- QuizMaster
- admin-hybrid-setup-closure.mjs
- graphify-admin-closure-visual.mjs
- server/package.json
- compilerOptions
- student-quiz.tsx
- Button
- use-toast.ts
- QuizMaster Sunucu Kurulum Kılavuzu
- ref_node_fs
- admin-export-print.spec.ts
- dependencies
- compilerOptions
- devDependencies
- menubar.tsx
- export.ts
- Hibrit taze kurulum kapanış kontrolü
- QuizMaster Yönetici Kullanıcı Kılavuzu
- breadcrumb.tsx
- survey.ts
- scripts
- email.ts
- class-variance-authority
- carousel.tsx
- QuizMaster Gmail E-Posta ve Parola Sıfırlama Kılavuzu
- deployment-config.ts
- server.ts
- form.tsx
- teacher-audit-runner.mjs
- SQLite'tan PostgreSQL'e Geçiş Rehberi
- QuizMaster Öğrenci Kullanıcı Kılavuzu
- QuizMaster Öğretmen Kullanıcı Kılavuzu
- api-routes/auth.ts
- deployment.ts
- chart.tsx
- command.tsx
- ai.ts
- pagination.tsx
- QuizMaster Graphify Mimari Haritası
- teacher-audit-server.ts
- drawer.tsx
- devDependencies
- ref_vitest
- QuizMaster Veli Kullanıcı Kılavuzu
- writeTransaction
- Öğrenci paneli envanteri ve denetim kapsamı
- compilerOptions
- utils.ts
- Öğrenci paneli doğrulama kaydı
- admin-management-pagination.test.tsx
- ref_node_module
- Kalan yönetici onarımları — doğrulama
- admin-accessibility-closure.spec.ts
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
- README.md
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
- student-audit-summary.mjs
- admin-quiz-repairs.spec.ts
- admin-audit.spec.ts
- input-group.tsx
- admin-student-report-request-race.test.tsx
- Admin kalan doğrulamalar ve düzeltmeler
- admin-history-pagination.test.tsx
- Öğrenci paneli hata onarımları
- admin-student-report-readiness.test.tsx
- 2026-10-04-student-defect-repairs.md
- Öğretmen paneli kaynak envanteri — 3 Ekim 2026
- Öğretmen paneli doğrulama raporu — 3 Ekim 2026
- Öğretmen paneli — kaynak ve rota kanıtına dayalı UX notları
- Yönetici paneli denetimi — 30 Eylül 2026
- 2026-10-03-linux-setup-teacher-audit.md
- prepare-linux-closure.sh
- scripts
- config.ts
- remaining-repairs-verification.md
- admin-results.test.tsx
- 2026-10-03-teacher-defect-repairs.md
- 2026-10-04-student-panel-audit.md
- navigation-menu.tsx
- setup-migration.test.ts
- queryClient.ts

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
- `Aktarım sonrası asgari doğrulama` --references--> `Class`  [INFERRED]
  docs/postgresql-gecis-rehberi.md → client/src/lib/api.ts

## Import Cycles
- None detected.

## Communities (130 total, 38 thin omitted)

### Community 0 - "setup-bootstrap.mjs"
Cohesion: 0.08
Nodes (52): holder, appendLog(), authenticated(), authorizeMutation(), cookies(), csrfValue, getPnpmVersion(), handler() (+44 more)

### Community 1 - "express"
Cohesion: 0.11
Nodes (32): express, express-rate-limit, querySchema, router, categorySchema, router, classSchema, router (+24 more)

### Community 4 - "dependencies"
Cohesion: 0.04
Nodes (55): dependencies, class-variance-authority, clsx, cmdk, date-fns, embla-carousel-react, framer-motion, @hookform/resolvers (+47 more)

### Community 5 - "sidebar.tsx"
Cohesion: 0.06
Nodes (39): SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay, SheetTitle, sheetVariants (+31 more)

### Community 6 - "index.ts"
Cohesion: 0.05
Nodes (40): origLookup, connect-sqlite3, cors, csrf-sync, helmet, multer, pino-http, sharp (+32 more)

### Community 7 - "cn"
Cohesion: 0.06
Nodes (57): AccordionContent, AccordionItem, AccordionTrigger, ButtonGroupSeparator(), ContextMenuCheckboxItem, ContextMenuContent, ContextMenuItem, ContextMenuLabel (+49 more)

### Community 8 - "student-audit-helpers.ts"
Cohesion: 0.12
Nodes (19): api(), assertIsolatedRuntime(), cached, forgetCachedLogin(), login(), prisma(), assertNoAnswerKey(), resetAttempt() (+11 more)

### Community 9 - "client/package.json"
Cohesion: 0.04
Nodes (41): description, @types/node, typescript, vitest, zod, zod-validation-error, name, packageManager (+33 more)

### Community 10 - "QuizMaster"
Cohesion: 0.06
Nodes (34): 1. Depoyu indirin, 1. Sunucuyu hazırlayın ve depoyu indirin, 2. Güvenli ön kontrolü ve bootstrap ekranını başlatın, 2. Kurulum başlatıcısını çalıştırın, 3. Grafik kurulum akışını tamamlayın, 3. Sihirbaz adımlarını tamamlayın, 4. Uygulamayı başlatın, 4. Uygulamayı servis olarak çalıştırın (+26 more)

### Community 11 - "admin-hybrid-setup-closure.mjs"
Cohesion: 0.07
Nodes (38): Düzeltmeler ve ayrı unit kanıtı, İlk gerçek BAT full koşusu — 2 Ekim, İlk gerçek Git SH full koşusu — 2 Ekim, before, bounded(), captureOwnedProcesses(), children, cleanEnv (+30 more)

### Community 12 - "graphify-admin-closure-visual.mjs"
Cohesion: 0.05
Nodes (38): devDependencies, concurrently, playwright, @playwright/test, name, tar@<7.5.21, @tootallnate/once@<2.0.1, packageManager (+30 more)

### Community 13 - "server/package.json"
Cohesion: 0.06
Nodes (29): cross-env, dotenv, dotenv-cli, esbuild, nodemailer, pino, pino-pretty, prisma (+21 more)

### Community 15 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, allowJs, baseUrl, esModuleInterop, isolatedModules, jsx, lib (+14 more)

### Community 16 - "student-quiz.tsx"
Cohesion: 0.05
Nodes (59): AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay, AlertDialogTitle (+51 more)

### Community 17 - "Button"
Cohesion: 0.06
Nodes (197): ALL, App(), AppRouter(), HomeRoute(), RedirectToAuth(), Role, RouteConfig, RouteGuard() (+189 more)

### Community 18 - "use-toast.ts"
Cohesion: 0.12
Nodes (24): Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle, toastVariants (+16 more)

### Community 19 - "QuizMaster Sunucu Kurulum Kılavuzu"
Cohesion: 0.08
Nodes (24): 10. Nginx — subdomain, 11. Nginx — alt yol, 12. IIS reverse proxy özeti, 13. Bootstrap ve tek kullanımlık web kurulum sihirbazı, 14. Log saklama ve veritabanı büyümesi, 15. Yedekleme, 16. İlk canlı kontrol listesi, 17. Güncelleme ve geri dönüş (+16 more)

### Community 20 - "ref_node_fs"
Cohesion: 0.11
Nodes (13): @playwright/test, isolatedRoot, runtime, api(), assertIsolatedRuntime(), cached, forgetCachedLogin(), login() (+5 more)

### Community 21 - "admin-export-print.spec.ts"
Cohesion: 0.18
Nodes (10): auditCookies, fixture, ids, isolatedRoot, prisma, { PrismaClient }, runtime, suffix (+2 more)

### Community 22 - "dependencies"
Cohesion: 0.10
Nodes (20): dependencies, bcryptjs, connect-sqlite3, cors, csrf-sync, express, express-rate-limit, express-session (+12 more)

### Community 23 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, lib, module (+10 more)

### Community 24 - "devDependencies"
Cohesion: 0.11
Nodes (18): devDependencies, autoprefixer, baseline-browser-mapping, jsdom, postcss, tailwindcss, @tailwindcss/postcss, @tailwindcss/vite (+10 more)

### Community 25 - "menubar.tsx"
Cohesion: 0.11
Nodes (12): Menubar, MenubarCheckboxItem, MenubarContent, MenubarItem, MenubarLabel, MenubarRadioItem, MenubarSeparator, MenubarShortcut() (+4 more)

### Community 26 - "export.ts"
Cohesion: 0.21
Nodes (14): columnName(), crc32(), createCsvBytes(), createCsvContent(), createExcelBytes(), CsvColumn, CsvExportOptions, CsvValue (+6 more)

### Community 27 - "Hibrit taze kurulum kapanış kontrolü"
Cohesion: 0.20
Nodes (10): 3 Ekim 2026 güncel tekrar durumu, Gerçek kurulum zinciri, Güvenli gerçek koşu harness'i, Hibrit taze kurulum kapanış kontrolü, HY05 — gerçek migration hatasının nedeni ve hedefli düzeltme, Native Ubuntu/WSL2 SH kabulü — 3 Ekim, Ortam ve erişim, Sınırlar ve sonuç kaydı (+2 more)

### Community 28 - "QuizMaster Yönetici Kullanıcı Kılavuzu"
Cohesion: 0.11
Nodes (18): 10. Duyurular ve bildirimler, 11. Loglar, e-posta ve şifre talepleri, 12. Excel ve yazdırma, 13. Çevrimdışı sınav, 14. Sorun giderme, 1. Giriş ve güvenlik, 2. Yönetici menüsü, 3. Öğrenci yönetimi (+10 more)

### Community 29 - "breadcrumb.tsx"
Cohesion: 0.17
Nodes (11): Breadcrumb, BreadcrumbEllipsis(), BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator(), ButtonGroup() (+3 more)

### Community 30 - "survey.ts"
Cohesion: 0.12
Nodes (22): notify(), saveContentHandler(), schema, notifyAdminsAboutTeacherQuiz(), canAccessSurvey(), getAccessibleSurveys(), isAssignedToStudent(), resultQuerySchema (+14 more)

### Community 31 - "scripts"
Cohesion: 0.13
Nodes (15): scripts, build, db:create-admin, db:deploy, db:generate, db:migrate, db:seed, db:status (+7 more)

### Community 32 - "email.ts"
Cohesion: 0.19
Nodes (15): hashResetToken(), issuePasswordReset(), originalEnv, original, fake, getEmailConfiguration(), getEmailStatus(), getTransporter() (+7 more)

### Community 33 - "class-variance-authority"
Cohesion: 0.18
Nodes (12): Alert, AlertDescription, AlertTitle, alertVariants, ToggleGroup, ToggleGroupContext, ToggleGroupItem, Toggle (+4 more)

### Community 34 - "carousel.tsx"
Cohesion: 0.17
Nodes (14): Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext, CarouselOptions (+6 more)

### Community 35 - "QuizMaster Gmail E-Posta ve Parola Sıfırlama Kılavuzu"
Cohesion: 0.13
Nodes (15): 10. Sorun giderme tablosu, 11. Bakım notları, 1. Desteklenen servis, 2. Gmail hesabını hazırlama, 3. Ortam değişkenleri, 4. Parola sıfırlama işleyişi, 5. Outbox kuyruğu, 6. Yönetici işlemleri (+7 more)

### Community 36 - "deployment-config.ts"
Cohesion: 0.25
Nodes (12): buildDeploymentArtifacts(), defaultRetention, DeploymentConfig, deploymentConfigPath, deploymentConfigSchema, envOrigins(), getEffectiveDeploymentConfig(), getPublicAppUrl() (+4 more)

### Community 37 - "server.ts"
Cohesion: 0.11
Nodes (21): APPLY_STEPS, ApplyJobState, ApplyStepState, artifactRoot, cookieValue(), createApplyState(), createSetupApp(), dataRoot (+13 more)

### Community 38 - "form.tsx"
Cohesion: 0.19
Nodes (12): FormControl, FormDescription, FormFieldContext, FormFieldContextValue, FormItem, FormItemContext, FormItemContextValue, FormLabel (+4 more)

### Community 39 - "teacher-audit-runner.mjs"
Cohesion: 0.08
Nodes (37): waitForAuditServer(), captureOwnedLinuxProcesses(), cleanupOwnedLinuxProcesses(), exited(), linuxProcessSnapshot(), nonnegative(), parseLinuxProcessStat(), positive() (+29 more)

### Community 40 - "SQLite'tan PostgreSQL'e Geçiş Rehberi"
Cohesion: 0.10
Nodes (20): Category, Class, Quiz, QuizWithDetails, StudentResult, 10. Geçiş sonrası büyüme ve bakım, 11. Resmî başvuru kaynakları, 1. Mevcut uyumluluk durumu (+12 more)

### Community 41 - "QuizMaster Öğrenci Kullanıcı Kılavuzu"
Cohesion: 0.15
Nodes (13): 10. Hesap güvenliği, 11. Sorun giderme, 1. Kayıt ve giriş, 2. Öğrenci menüsü, 3. Sınavı başlatmadan önce, 4. Sınavı çözme ve teslim, 5. Anketlerim, 6. Sonuçlar ve istatistikler (+5 more)

### Community 42 - "QuizMaster Öğretmen Kullanıcı Kılavuzu"
Cohesion: 0.14
Nodes (13): 10. Çevrimdışı sınav, 11. Sorun giderme, 1. Giriş ve profil, 2. Öğretmen menüsü, 3. Sınav oluşturma, 4. Sınav yayını ve güvenlik, 5. Anket Yönetimi, 6. Sonuçlar ve sınıf istatistikleri (+5 more)

### Community 43 - "api-routes/auth.ts"
Cohesion: 0.11
Nodes (16): bcryptjs, socket.io, changePasswordSchema, forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, router (+8 more)

### Community 44 - "deployment.ts"
Cohesion: 0.26
Nodes (7): requireRuntimeChanges(), router, runtimeDeploymentChangesAllowed(), retentionCutoffs(), RetentionPolicy, runDataRetention(), startDataRetentionWorker()

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
Cohesion: 0.22
Nodes (9): Bakımda güncellik kontrolü, Commit öncesi kontrol, Grafiği güncelleme, Grafiği sorgulama, Graphify kurulumu, Güncellik kuralı, Neden diğer dosyalar paylaşılmıyor?, Paylaşılan çıktılar (+1 more)

### Community 50 - "teacher-audit-server.ts"
Cohesion: 0.29
Nodes (6): content, database, p, repo, require, root

### Community 51 - "drawer.tsx"
Cohesion: 0.25
Nodes (7): DrawerContent, DrawerDescription, DrawerFooter(), DrawerHeader(), DrawerOverlay, DrawerTitle, vaul

### Community 52 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, cross-env, dotenv, dotenv-cli, esbuild, supertest, tsx, @types/connect-sqlite3 (+8 more)

### Community 53 - "ref_vitest"
Cohesion: 0.06
Nodes (33): express-session, @prisma/client, supertest, router, router, router, router, router (+25 more)

### Community 54 - "QuizMaster Veli Kullanıcı Kılavuzu"
Cohesion: 0.22
Nodes (8): 1. Veli hesabının oluşturulması, 2. Giriş ve şifre, 3. Veli paneli, 4. Erişim sınırları, 5. Ayarlar ve bildirimler, 6. Sorun giderme, Erişim sınırları, QuizMaster Veli Kullanıcı Kılavuzu

### Community 55 - "writeTransaction"
Cohesion: 0.16
Nodes (3): assertClassCapacity(), validateClassCapacity(), writeTransaction()

### Community 56 - "Öğrenci paneli envanteri ve denetim kapsamı"
Cohesion: 0.33
Nodes (5): Kaynak bulguları ve doğrulanacak riskler, Sayfalar, sekmeler ve işlemler, Sınırlar ve kayıt ilkesi, Tam denetim kontrol listesi, Öğrenci paneli envanteri ve denetim kapsamı

### Community 57 - "compilerOptions"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 58 - "utils.ts"
Cohesion: 0.07
Nodes (22): Calendar(), CalendarDayButton(), HoverCardContent, InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot, ResizableHandle() (+14 more)

### Community 59 - "Öğrenci paneli doğrulama kaydı"
Cohesion: 0.29
Nodes (7): Dosya çıktısı ve soru türleri, Koşu geçmişi ve hatalı varsayımların düzeltilmesi, Ortam ve veri güvenliği, Sayfa ve sekme kapsamı, Yeniden çalıştırma, Öncelikli sonraki plan, Öğrenci paneli doğrulama kaydı

### Community 61 - "ref_node_module"
Cohesion: 0.06
Nodes (26): @tailwindcss/vite, vite, db, p, repo, require, root, require (+18 more)

### Community 62 - "Kalan yönetici onarımları — doğrulama"
Cohesion: 0.25
Nodes (7): Denenmeyen davranışlar, Graphify kanıtı, Güncel kesin kanıt, Kalan yönetici onarımları — doğrulama, Kapsam, Sayfa ve sekme bazında onarım kapsamı, Önceliklendirilmiş geliştirme planı

### Community 63 - "admin-accessibility-closure.spec.ts"
Cohesion: 0.08
Nodes (15): auditCookies, diagnosticsByPage, open(), openManagementLogView(), PageDiagnostics, pathnameOnly(), redactDiagnosticMessage(), RequestDiagnostic (+7 more)

### Community 64 - "@testing-library/react"
Cohesion: 0.14
Nodes (8): mocks, renderEditor(), state, fixture, boundary, sonner, @testing-library/react, @testing-library/user-event

### Community 65 - "types.d.ts"
Cohesion: 0.50
Nodes (3): nanoid, vite, */vite.config

### Community 66 - "Bulgular"
Cohesion: 0.09
Nodes (22): Bulgular, Düzeltme durumu — ikinci paket, Düzeltme durumu — ilk paket, Ek araştırma / doğrulanmamış riskler, Nihai tarayıcı doğrulaması, Q01 — P1 — Anket soru türünü değiştiren ardışık güncellemeler birbirini eziyor, Q02 — P1 — Seçenek silince doğru cevap başka seçeneğe kayıyor, Q03 — P1 — Başarısız kayıt kısmi değişiklik/tekrar denemede mükerrer taslak bırakıyor (+14 more)

### Community 67 - "ref_node_path"
Cohesion: 0.06
Nodes (26): finder, scriptDir, repository, requireServer, scriptRoot, actual(), helper(), source (+18 more)

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

### Community 82 - "README.md"
Cohesion: 0.24
Nodes (3): Ortam ve tekrar çalıştırma, Taze doğrulama, Öğretmen bulgularının kapanışı — 4 Ekim 2026

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
Cohesion: 0.12
Nodes (12): Admin export and print closure, Confirmed changes, Final PDF visual and text QA, PR04: teacher-detail print pagination, Scope, Scope notes, Survey landscape diagnosis and measured fix, Doğrulama ve Graphify (+4 more)

### Community 101 - "student-audit-summary.mjs"
Cohesion: 0.15
Nodes (12): cases, cli, cohorts, flatten(), latest, manifest, out, repairs (+4 more)

### Community 102 - "admin-quiz-repairs.spec.ts"
Cohesion: 0.33
Nodes (4): prisma, { PrismaClient }, root, runtime

### Community 103 - "admin-audit.spec.ts"
Cohesion: 0.33
Nodes (5): cookies, isolatedRoot, login(), routes, runtime

### Community 104 - "input-group.tsx"
Cohesion: 0.28
Nodes (8): InputGroup(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton(), inputGroupButtonVariants, InputGroupInput(), InputGroupText(), InputGroupTextarea()

### Community 105 - "admin-student-report-request-race.test.tsx"
Cohesion: 0.33
Nodes (3): api, studentA, studentB

### Community 109 - "Admin kalan doğrulamalar ve düzeltmeler"
Cohesion: 0.33
Nodes (6): Admin kalan doğrulamalar ve düzeltmeler, Doğrulanmış hatalar ve kabul kriterleri, Güncel doğrulama durumu, HY06 / kritik — derlenen API açılmıyor, Ortam sınırları ve verilerin korunması, UX iyileştirmeleri ve yeni özellik önerileri

### Community 112 - "Öğrenci paneli hata onarımları"
Cohesion: 0.40
Nodes (5): Değişiklikler, Kanıt ve koşu geçmişi, Son doğrulama, Uyumluluk sınırları, Öğrenci paneli hata onarımları

### Community 115 - "Öğretmen paneli kaynak envanteri — 3 Ekim 2026"
Cohesion: 0.33
Nodes (6): API ve authorization envanteri, Bağımsız çalışma alanları, Fixture ve mevcut testlerin sınırı, Kapsam ve kanıt kaydı, Sayfa, sekme ve işlem kontrol listesi, Öğretmen paneli kaynak envanteri — 3 Ekim 2026

### Community 116 - "Öğretmen paneli doğrulama raporu — 3 Ekim 2026"
Cohesion: 0.17
Nodes (12): Doğrulanmış işlevsel hatalar, Kurulum ön koşulu ve izolasyon, Sayfa ve sekme bazında kapsam, Son ortam sınırı, T-F01 — Öğrenci raporunda doğru cevap sayısı boş (orta; 4 Ekim KAPANDI), T-F02 — Parola sıfırlama isteği beklerken düğme kilitlenmiyor (orta; 4 Ekim KAPANDI), Test kayıtları nasıl okunmalı?, UX iyileştirmeleri (+4 more)

### Community 118 - "Öğretmen paneli — kaynak ve rota kanıtına dayalı UX notları"
Cohesion: 0.33
Nodes (5): Doğrulanmış iyileştirme, İsteğe bağlı özellik önerileri, Kusur olarak sınıflandırılmayan rota sayacı, TU-01 — Sonuç tablosu aramasında kalıcı ve açık alan etiketi eksik (P2), Öğretmen paneli — kaynak ve rota kanıtına dayalı UX notları

### Community 119 - "Yönetici paneli denetimi — 30 Eylül 2026"
Cohesion: 0.40
Nodes (5): Ortam ve kanıt sınırı, Sayfa ve sekme kontrol listesi, Tekrar çalıştırma, Yönetici paneli denetimi — 30 Eylül 2026, Öncelik ve yapılacak değişiklikler

### Community 122 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, preview, test, test:coverage, test:ui, type-check

### Community 123 - "config.ts"
Cohesion: 0.17
Nodes (12): buildServerEnv(), envValue(), gmailAddress, publicAppUrl(), SetupPayload, setupPayloadSchema, toDeploymentConfig(), applySetup() (+4 more)

### Community 129 - "navigation-menu.tsx"
Cohesion: 0.28
Nodes (8): NavigationMenu, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle, NavigationMenuViewport, @radix-ui/react-navigation-menu

### Community 131 - "setup-migration.test.ts"
Cohesion: 0.19
Nodes (10): 3 Ekim 2026 native Linux ve öğretmen denetimi sonrası güncel harita, Görsel haritayı açma, Accessibility verification, Admin verification closure implementation plan, Export and print verification, Fresh hybrid setup, Global constraints, Integration and report (+2 more)

### Community 133 - "queryClient.ts"
Cohesion: 0.47
Nodes (5): apiRequest(), getQueryFn(), queryClient, throwIfResNotOk(), UnauthorizedBehavior

## Knowledge Gaps
- **886 isolated node(s):** `name`, `version`, `type`, `description`, `dev` (+881 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1265 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **38 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `class-variance-authority`, `carousel.tsx`, `navigation-menu.tsx`, `sidebar.tsx`, `form.tsx`, `input-group.tsx`, `client/package.json`, `chart.tsx`, `command.tsx`, `student-quiz.tsx`, `Button`, `empty.tsx`, `drawer.tsx`, `pagination.tsx`, `use-toast.ts`, `menubar.tsx`, `utils.ts`, `breadcrumb.tsx`?**
  _High betweenness centrality (0.159) - this node is a cross-community bridge._
- **Why does `IStorage` connect `IStorage` to `PrismaStorage`, `ref_vitest`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Why does `QuizMaster Graphify Mimari Haritası` connect `QuizMaster Graphify Mimari Haritası` to `student-quiz.tsx`, `README.md`, `setup-migration.test.ts`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **What connects `name`, `version`, `type` to the rest of the system?**
  _886 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `setup-bootstrap.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.07743496672716274 - nodes in this community are weakly interconnected._
- **Should `express` be split into smaller, more focused modules?**
  _Cohesion score 0.10714285714285714 - nodes in this community are weakly interconnected._
- **Should `IStorage` be split into smaller, more focused modules?**
  _Cohesion score 0.02 - nodes in this community are weakly interconnected._