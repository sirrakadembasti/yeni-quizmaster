# Graph Report - yeni-quizmaster-main  (2026-10-04)

## Corpus Check
- 809 files · ~1,724,070 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 3, .bat 2, .example 2)

## Summary
- 2770 nodes · 7126 edges · 159 communities (115 shown, 44 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 91 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5d8a4d8e`
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
- teacher-audit-helpers.ts
- admin-export-print.spec.ts
- dependencies
- compilerOptions
- devDependencies
- parent-audit-helpers.ts
- export.ts
- Hibrit taze kurulum kapanış kontrolü
- QuizMaster Yönetici Kullanıcı Kılavuzu
- item.tsx
- quiz.ts
- parent.ts
- utils.ts
- class-variance-authority
- carousel.tsx
- QuizMaster Gmail E-Posta ve Parola Sıfırlama Kılavuzu
- offline-quiz.ts
- server.ts
- form.tsx
- integration-load-ux.mjs
- SQLite'tan PostgreSQL'e Geçiş Rehberi
- QuizMaster Öğrenci Kullanıcı Kılavuzu
- QuizMaster Öğretmen Kullanıcı Kılavuzu
- api-routes/auth.ts
- deployment.ts
- chart.tsx
- command.tsx
- ai-live.test.ts
- ai.ts
- QuizMaster Graphify Mimari Haritası
- student-audit-summary.mjs
- drawer.tsx
- pagination.tsx
- ref_vitest
- QuizMaster Veli Kullanıcı Kılavuzu
- writeTransaction
- Öğrenci paneli envanteri ve denetim kapsamı
- compilerOptions
- applySetup
- Öğrenci paneli doğrulama kaydı
- admin-management-pagination.test.tsx
- ref_node_module
- Kalan yönetici onarımları — doğrulama
- admin-accessibility-closure.spec.ts
- @testing-library/react
- types.d.ts
- Bulgular
- ref_node_fs
- live-socket-audit.ts
- Confirmed code defects and acceptance criteria
- @playwright/test
- admin-audit-people-flows.spec.ts
- 2026-09-30-security-reliability.md
- kurulum.sh
- backups/README.md
- data/README.md
- graphify-student-audit-visual.mjs
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
- empty.tsx
- Doğrulanmış hatalar
- admin-audit.spec.ts
- integration-ux-print-extra.mjs
- admin-student-report-request-race.test.tsx
- Admin kalan doğrulamalar ve düzeltmeler
- integration-audit/defect-repairs.md
- teacher-audit-runner.mjs
- Güvenlik ve veri bütünlüğü bakımı — 30 Eylül 2026
- admin-student-report-readiness.test.tsx
- 2026-10-04-student-defect-repairs.md
- Öğretmen paneli kaynak envanteri — 3 Ekim 2026
- Öğretmen paneli doğrulama raporu — 3 Ekim 2026
- admin-inventory.test.tsx
- integration-smtp-probe.mjs
- integration-load-diagnostic.mjs
- 2026-10-03-linux-setup-teacher-audit.md
- prepare-linux-closure.sh
- Gerçek etkileşimle doğrulanan kusurlar
- config.ts
- remaining-repairs-verification.md
- parent-audit-summary.mjs
- 2026-10-03-teacher-defect-repairs.md
- 2026-10-04-student-panel-audit.md
- student-ux-repairs.test.tsx
- navigation-menu.tsx
- admin-critical-repairs.spec.ts
- Admin verification closure implementation plan
- graphify-parent-audit-visual.mjs
- queryClient.ts
- admin-audit-system-flows.spec.ts
- main.tsx
- student-audit-server.ts
- teacher-audit-windows-runner.mjs
- Veli paneli sayfa/sekme doğrulaması
- scripts
- integration-evidence-check.mjs
- 2026-10-04-parent-panel-audit.md
- Oturum yükü kök neden analizi
- Öğretmen bulgularının kapanışı — 4 Ekim 2026
- admin-results.test.tsx
- Veli paneli hata onarımları
- input-group.tsx
- Veli paneli kapsam ve kontrol listesi
- admin-history-pagination.test.tsx
- announcement.ts
- scripts
- teacher-audit-server.ts
- Öğretmen paneli — kaynak ve rota kanıtına dayalı UX notları
- Yönetici paneli denetimi — 30 Eylül 2026
- integration-notifications-print-repairs.test.tsx
- admin-teacher-detail-export.test.tsx
- before-repairs/README.md

## God Nodes (most connected - your core abstractions)
1. `cn()` - 285 edges
2. `Button` - 108 edges
3. `PrismaStorage` - 106 edges
4. `IStorage` - 101 edges
5. `react` - 91 edges
6. `DashboardLayout()` - 72 edges
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
- `S-B01 — Çevrimdışı cevap, bağlantı geri gelip sayfa yenilendiğinde kayboluyor — P1` --references--> `saveOfflineSession()`  [INFERRED]
  docs/student-audit/findings.md → client/src/lib/offline-quiz.ts
- `Graphify` --references--> `ParentResultsPage()`  [INFERRED]
  docs/parent-audit/defect-repairs.md → client/src/pages/parent-results.tsx

## Import Cycles
- None detected.

## Communities (159 total, 44 thin omitted)

### Community 0 - "setup-bootstrap.mjs"
Cohesion: 0.07
Nodes (52): holder, appendLog(), authenticated(), authorizeMutation(), cookies(), csrfValue, getPnpmVersion(), handler() (+44 more)

### Community 1 - "express"
Cohesion: 0.11
Nodes (27): express, querySchema, router, categorySchema, router, classSchema, router, router (+19 more)

### Community 4 - "dependencies"
Cohesion: 0.04
Nodes (55): dependencies, class-variance-authority, clsx, cmdk, date-fns, embla-carousel-react, framer-motion, @hookform/resolvers (+47 more)

### Community 5 - "sidebar.tsx"
Cohesion: 0.06
Nodes (39): SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay, SheetTitle, sheetVariants (+31 more)

### Community 6 - "index.ts"
Cohesion: 0.07
Nodes (32): cors, csrf-sync, helmet, multer, pino-http, sharp, router, upload (+24 more)

### Community 7 - "cn"
Cohesion: 0.05
Nodes (56): Avatar, AvatarFallback, AvatarImage, Breadcrumb, BreadcrumbEllipsis(), BreadcrumbItem, BreadcrumbLink, BreadcrumbList (+48 more)

### Community 8 - "student-audit-helpers.ts"
Cohesion: 0.12
Nodes (19): api(), assertIsolatedRuntime(), cached, forgetCachedLogin(), login(), prisma(), assertNoAnswerKey(), resetAttempt() (+11 more)

### Community 9 - "client/package.json"
Cohesion: 0.05
Nodes (38): description, @types/node, typescript, vitest, zod, zod-validation-error, name, packageManager (+30 more)

### Community 10 - "QuizMaster"
Cohesion: 0.06
Nodes (34): 1. Depoyu indirin, 1. Sunucuyu hazırlayın ve depoyu indirin, 2. Güvenli ön kontrolü ve bootstrap ekranını başlatın, 2. Kurulum başlatıcısını çalıştırın, 3. Grafik kurulum akışını tamamlayın, 3. Sihirbaz adımlarını tamamlayın, 4. Uygulamayı başlatın, 4. Uygulamayı servis olarak çalıştırın (+26 more)

### Community 11 - "admin-hybrid-setup-closure.mjs"
Cohesion: 0.08
Nodes (34): before, bounded(), captureOwnedProcesses(), children, cleanEnv, completedPhase(), creationTime(), digest() (+26 more)

### Community 12 - "graphify-admin-closure-visual.mjs"
Cohesion: 0.09
Nodes (17): allowed, graphRoot, outputRoot, report, safeMessage(), safeUrl(), server, sourceRoot (+9 more)

### Community 13 - "server/package.json"
Cohesion: 0.07
Nodes (26): cross-env, dotenv, dotenv-cli, esbuild, prisma, tsx, @types/connect-sqlite3, @types/cors (+18 more)

### Community 15 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, allowJs, baseUrl, esModuleInterop, isolatedModules, jsx, lib (+14 more)

### Community 16 - "student-quiz.tsx"
Cohesion: 0.22
Nodes (16): AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay, AlertDialogTitle (+8 more)

### Community 17 - "Button"
Cohesion: 0.05
Nodes (209): ALL, AppRouter(), HomeRoute(), RedirectToAuth(), Role, RouteConfig, RouteGuard(), ROUTES (+201 more)

### Community 18 - "use-toast.ts"
Cohesion: 0.12
Nodes (24): Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle, toastVariants (+16 more)

### Community 19 - "QuizMaster Sunucu Kurulum Kılavuzu"
Cohesion: 0.04
Nodes (46): 10. Nginx — subdomain, 11. Nginx — alt yol, 12. IIS reverse proxy özeti, 13. Bootstrap ve tek kullanımlık web kurulum sihirbazı, 14. Log saklama ve veritabanı büyümesi, 15. Yedekleme, 16. İlk canlı kontrol listesi, 17. Güncelleme ve geri dönüş (+38 more)

### Community 20 - "teacher-audit-helpers.ts"
Cohesion: 0.16
Nodes (10): api(), assertIsolatedRuntime(), cached, forgetCachedLogin(), login(), teacherAuditIds, pdf(), ownedNames (+2 more)

### Community 21 - "admin-export-print.spec.ts"
Cohesion: 0.18
Nodes (10): auditCookies, fixture, ids, isolatedRoot, prisma, { PrismaClient }, runtime, suffix (+2 more)

### Community 22 - "dependencies"
Cohesion: 0.05
Nodes (36): dependencies, bcryptjs, connect-sqlite3, cors, csrf-sync, express, express-rate-limit, express-session (+28 more)

### Community 23 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, lib, module (+10 more)

### Community 24 - "devDependencies"
Cohesion: 0.11
Nodes (18): devDependencies, autoprefixer, baseline-browser-mapping, jsdom, postcss, tailwindcss, @tailwindcss/postcss, @tailwindcss/vite (+10 more)

### Community 25 - "parent-audit-helpers.ts"
Cohesion: 0.15
Nodes (12): api(), assertIsolatedRuntime(), cached, login(), prisma(), publish(), guiLogin(), identity() (+4 more)

### Community 26 - "export.ts"
Cohesion: 0.21
Nodes (14): columnName(), crc32(), createCsvBytes(), createCsvContent(), createExcelBytes(), CsvColumn, CsvExportOptions, CsvValue (+6 more)

### Community 27 - "Hibrit taze kurulum kapanış kontrolü"
Cohesion: 0.14
Nodes (14): 3 Ekim 2026 güncel tekrar durumu, Düzeltmeler ve ayrı unit kanıtı, Gerçek kurulum zinciri, Güvenli gerçek koşu harness'i, Hibrit taze kurulum kapanış kontrolü, HY05 — gerçek migration hatasının nedeni ve hedefli düzeltme, İlk gerçek BAT full koşusu — 2 Ekim, İlk gerçek Git SH full koşusu — 2 Ekim (+6 more)

### Community 28 - "QuizMaster Yönetici Kullanıcı Kılavuzu"
Cohesion: 0.11
Nodes (18): 10. Duyurular ve bildirimler, 11. Loglar, e-posta ve şifre talepleri, 12. Excel ve yazdırma, 13. Çevrimdışı sınav, 14. Sorun giderme, 1. Giriş ve güvenlik, 2. Yönetici menüsü, 3. Öğrenci yönetimi (+10 more)

### Community 29 - "item.tsx"
Cohesion: 0.11
Nodes (21): ButtonGroup(), ButtonGroupSeparator(), ButtonGroupText(), buttonGroupVariants, FieldSeparator(), Item(), ItemActions(), ItemContent() (+13 more)

### Community 30 - "quiz.ts"
Cohesion: 0.09
Nodes (30): supertest, notify(), saveContentHandler(), schema, notifyAdminsAboutTeacherQuiz(), questionsArraySchema, questionSchema, quizSchema (+22 more)

### Community 31 - "parent.ts"
Cohesion: 0.13
Nodes (12): quiz(), createParentSchema, guardianStudentsSchema, linkSchema, relationSchema, router, updateParentSchema, appFor() (+4 more)

### Community 32 - "utils.ts"
Cohesion: 0.06
Nodes (23): Calendar(), CalendarDayButton(), InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot, PopoverContent, RadioGroup (+15 more)

### Community 33 - "class-variance-authority"
Cohesion: 0.18
Nodes (12): Alert, AlertDescription, AlertTitle, alertVariants, ToggleGroup, ToggleGroupContext, ToggleGroupItem, Toggle (+4 more)

### Community 34 - "carousel.tsx"
Cohesion: 0.17
Nodes (14): Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext, CarouselOptions (+6 more)

### Community 35 - "QuizMaster Gmail E-Posta ve Parola Sıfırlama Kılavuzu"
Cohesion: 0.13
Nodes (15): 10. Sorun giderme tablosu, 11. Bakım notları, 1. Desteklenen servis, 2. Gmail hesabını hazırlama, 3. Ortam değişkenleri, 4. Parola sıfırlama işleyişi, 5. Outbox kuyruğu, 6. Yönetici işlemleri (+7 more)

### Community 36 - "offline-quiz.ts"
Cohesion: 0.25
Nodes (18): acknowledgeOfflineAnswer(), cacheOfflineCompletion(), displayResults(), getOfflineQuizList(), getOfflineQuizResults(), getOfflineSession(), getOfflineUser(), markOfflineSubmit() (+10 more)

### Community 37 - "server.ts"
Cohesion: 0.11
Nodes (21): APPLY_STEPS, ApplyJobState, ApplyStepState, artifactRoot, cookieValue(), createApplyState(), createSetupApp(), dataRoot (+13 more)

### Community 38 - "form.tsx"
Cohesion: 0.19
Nodes (12): FormControl, FormDescription, FormFieldContext, FormFieldContextValue, FormItem, FormItemContext, FormItemContextValue, FormLabel (+4 more)

### Community 39 - "integration-load-ux.mjs"
Cohesion: 0.06
Nodes (29): waitForAuditServer(), { chromium, request }, cli, contexts, out, report, req, root (+21 more)

### Community 40 - "SQLite'tan PostgreSQL'e Geçiş Rehberi"
Cohesion: 0.10
Nodes (20): Category, Class, Quiz, QuizWithDetails, StudentResult, 10. Geçiş sonrası büyüme ve bakım, 11. Resmî başvuru kaynakları, 1. Mevcut uyumluluk durumu (+12 more)

### Community 41 - "QuizMaster Öğrenci Kullanıcı Kılavuzu"
Cohesion: 0.15
Nodes (13): 10. Hesap güvenliği, 11. Sorun giderme, 1. Kayıt ve giriş, 2. Öğrenci menüsü, 3. Sınavı başlatmadan önce, 4. Sınavı çözme ve teslim, 5. Anketlerim, 6. Sonuçlar ve istatistikler (+5 more)

### Community 42 - "QuizMaster Öğretmen Kullanıcı Kılavuzu"
Cohesion: 0.15
Nodes (13): 10. Çevrimdışı sınav, 11. Sorun giderme, 1. Giriş ve profil, 2. Öğretmen menüsü, 3. Sınav oluşturma, 4. Sınav yayını ve güvenlik, 5. Anket Yönetimi, 6. Sonuçlar ve sınıf istatistikleri (+5 more)

### Community 43 - "api-routes/auth.ts"
Cohesion: 0.11
Nodes (16): bcryptjs, socket.io, changePasswordSchema, forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, router (+8 more)

### Community 44 - "deployment.ts"
Cohesion: 0.16
Nodes (16): requireRuntimeChanges(), router, runtimeDeploymentChangesAllowed(), retentionCutoffs(), RetentionPolicy, runDataRetention(), startDataRetentionWorker(), defaultRetention (+8 more)

### Community 45 - "chart.tsx"
Cohesion: 0.27
Nodes (10): ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartStyle(), ChartTooltipContent, getPayloadConfigFromPayload() (+2 more)

### Community 46 - "command.tsx"
Cohesion: 0.20
Nodes (10): Command, CommandDialog(), CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator (+2 more)

### Community 47 - "ai-live.test.ts"
Cohesion: 0.06
Nodes (23): origLookup, AI integration audit, Cases, Evidence and scope, Findings, Re-run, evidence, root (+15 more)

### Community 48 - "ai.ts"
Cohesion: 0.15
Nodes (9): express-rate-limit, AIResponseSchema, aiTestLimiter, GenerateRequestSchema, QuestionSchema, router, SurveyQuestionSchema, SurveyResponseSchema (+1 more)

### Community 49 - "QuizMaster Graphify Mimari Haritası"
Cohesion: 0.20
Nodes (10): reconcileOfflineSession(), Bakımda güncellik kontrolü, Commit öncesi kontrol, Grafiği güncelleme, Grafiği sorgulama, Graphify kurulumu, Güncellik kuralı, Neden diğer dosyalar paylaşılmıyor? (+2 more)

### Community 50 - "student-audit-summary.mjs"
Cohesion: 0.15
Nodes (12): cases, cli, cohorts, flatten(), latest, manifest, out, repairs (+4 more)

### Community 51 - "drawer.tsx"
Cohesion: 0.25
Nodes (7): DrawerContent, DrawerDescription, DrawerFooter(), DrawerHeader(), DrawerOverlay, DrawerTitle, vaul

### Community 52 - "pagination.tsx"
Cohesion: 0.24
Nodes (9): ButtonProps, Pagination(), PaginationContent, PaginationEllipsis(), PaginationItem, PaginationLink(), PaginationLinkProps, PaginationNext() (+1 more)

### Community 53 - "ref_vitest"
Cohesion: 0.08
Nodes (26): @prisma/client, router, prisma, hashResetToken(), issuePasswordReset(), closeStorage(), ContentQuestionInput, ContentSettingsInput (+18 more)

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

### Community 58 - "applySetup"
Cohesion: 0.28
Nodes (8): 3 Ekim 2026 native Linux ve öğretmen denetimi sonrası güncel harita, Görsel haritayı açma, toDeploymentConfig(), deploySetupDatabase(), SetupCommand, applySetup(), createFirstAdmin(), markStep()

### Community 59 - "Öğrenci paneli doğrulama kaydı"
Cohesion: 0.15
Nodes (12): Değişiklikler, Kanıt ve koşu geçmişi, Son doğrulama, Uyumluluk sınırları, Öğrenci paneli hata onarımları, Dosya çıktısı ve soru türleri, Koşu geçmişi ve hatalı varsayımların düzeltilmesi, Ortam ve veri güvenliği (+4 more)

### Community 61 - "ref_node_module"
Cohesion: 0.05
Nodes (25): {chromium,request}, contexts, out, report, root, runtime, db, p (+17 more)

### Community 62 - "Kalan yönetici onarımları — doğrulama"
Cohesion: 0.25
Nodes (7): Denenmeyen davranışlar, Graphify kanıtı, Güncel kesin kanıt, Kalan yönetici onarımları — doğrulama, Kapsam, Sayfa ve sekme bazında onarım kapsamı, Önceliklendirilmiş geliştirme planı

### Community 63 - "admin-accessibility-closure.spec.ts"
Cohesion: 0.12
Nodes (12): auditCookies, diagnosticsByPage, open(), openManagementLogView(), PageDiagnostics, pathnameOnly(), redactDiagnosticMessage(), RequestDiagnostic (+4 more)

### Community 64 - "@testing-library/react"
Cohesion: 0.13
Nodes (8): mocks, renderEditor(), api, openConfig(), fixture, boundary, @testing-library/react, @testing-library/user-event

### Community 65 - "types.d.ts"
Cohesion: 0.50
Nodes (3): nanoid, vite, */vite.config

### Community 66 - "Bulgular"
Cohesion: 0.09
Nodes (22): Bulgular, Düzeltme durumu — ikinci paket, Düzeltme durumu — ilk paket, Ek araştırma / doğrulanmamış riskler, Nihai tarayıcı doğrulaması, Q01 — P1 — Anket soru türünü değiştiren ardışık güncellemeler birbirini eziyor, Q02 — P1 — Seçenek silince doğru cevap başka seçeneğe kayıyor, Q03 — P1 — Başarısız kayıt kısmi değişiklik/tekrar denemede mükerrer taslak bırakıyor (+14 more)

### Community 67 - "ref_node_fs"
Cohesion: 0.07
Nodes (20): finder, scriptDir, repository, requireServer, scriptRoot, actual(), helper(), source (+12 more)

### Community 68 - "live-socket-audit.ts"
Cohesion: 0.07
Nodes (28): APP_SHELL, connect-sqlite3, express-session, router, app, clientRequire, clients, database (+20 more)

### Community 69 - "Confirmed code defects and acceptance criteria"
Cohesion: 0.10
Nodes (20): Additional risks requiring targeted verification, Admin audit: route inventory, management, settings, server, archive, announcements, Browser verification addendum — 2026-09-30, Complete admin route inventory, Confirmed code defects and acceptance criteria, INV-01 — P2: successful profile save leaves admin identity stale, INV-02 — P2: management log history silently stops at the first page, INV-03 — P2: archive history hard-capped at 20 (+12 more)

### Community 72 - "admin-audit-people-flows.spec.ts"
Cohesion: 0.23
Nodes (8): api(), cleanup(), createClass(), createStudent(), Fixtures, isolatedRoot, runtime, withFixtures()

### Community 81 - "graphify-student-audit-visual.mjs"
Cohesion: 0.25
Nodes (8): allowed, graphRoot, outputRoot, report, safeMessage(), safeUrl(), server, sourceRoot

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

### Community 101 - "empty.tsx"
Cohesion: 0.29
Nodes (7): Empty(), EmptyContent(), EmptyDescription(), EmptyHeader(), EmptyMedia(), emptyMediaVariants, EmptyTitle()

### Community 102 - "Doğrulanmış hatalar"
Cohesion: 0.13
Nodes (15): Doğrulanmış hatalar, Kullanıcı deneyimi iyileştirmeleri, P-B01 — Veli kendi eski açık sınavına cevap yazabiliyor — yüksek, P-B02 — Sınıfa hedefli veli duyurusu bildirim üretmiyor — yüksek, P-B03 — Sınıfsız çocuğun kullanılabilir sınavı veliye görünmüyor — orta, P-B04 — Öğrenci listesi hatası başarılı boş veri gibi gösteriliyor — orta, P-B05 — Öğrenci özeti hatası ve yüklenmesi açıklanmıyor — orta, P-B06 — Sonuç Detay hatası sessiz kalıyor — orta (+7 more)

### Community 103 - "admin-audit.spec.ts"
Cohesion: 0.33
Nodes (5): cookies, isolatedRoot, login(), routes, runtime

### Community 104 - "integration-ux-print-extra.mjs"
Cohesion: 0.25
Nodes (6): { chromium, request }, contexts, out, report, root, runtime

### Community 105 - "admin-student-report-request-race.test.tsx"
Cohesion: 0.33
Nodes (3): api, studentA, studentB

### Community 109 - "Admin kalan doğrulamalar ve düzeltmeler"
Cohesion: 0.33
Nodes (6): Admin kalan doğrulamalar ve düzeltmeler, Doğrulanmış hatalar ve kabul kriterleri, Güncel doğrulama durumu, HY06 / kritik — derlenen API açılmıyor, Ortam sınırları ve verilerin korunması, UX iyileştirmeleri ve yeni özellik önerileri

### Community 110 - "integration-audit/defect-repairs.md"
Cohesion: 0.08
Nodes (19): Entegrasyon ve UX onarımları — 4 Ekim 2026, Tamamlanan gerçek kontroller, Test ve ortam notları, Uygulanan düzeltmeler, Bu alt görevin doğrulama sınırı, Kalan UX kapsamı — 4 Ekim 2026, Kusur sayılmayan yeni özellikler, Somut kalan UX kontrol listesi (+11 more)

### Community 111 - "teacher-audit-runner.mjs"
Cohesion: 0.19
Nodes (19): captureOwnedLinuxProcesses(), cleanupOwnedLinuxProcesses(), exited(), linuxProcessSnapshot(), nonnegative(), parseLinuxProcessStat(), positive(), sameIdentity() (+11 more)

### Community 112 - "Güvenlik ve veri bütünlüğü bakımı — 30 Eylül 2026"
Cohesion: 0.33
Nodes (5): Doğrulama ve Graphify, Güvenlik ve veri bütünlüğü bakımı — 30 Eylül 2026, İşletim sınırları ve sonraki çalışmalar, Uygulanan düzeltmeler, Veritabanı ve mevcut kurulum

### Community 115 - "Öğretmen paneli kaynak envanteri — 3 Ekim 2026"
Cohesion: 0.33
Nodes (6): API ve authorization envanteri, Bağımsız çalışma alanları, Fixture ve mevcut testlerin sınırı, Kapsam ve kanıt kaydı, Sayfa, sekme ve işlem kontrol listesi, Öğretmen paneli kaynak envanteri — 3 Ekim 2026

### Community 116 - "Öğretmen paneli doğrulama raporu — 3 Ekim 2026"
Cohesion: 0.17
Nodes (12): Doğrulanmış işlevsel hatalar, Kurulum ön koşulu ve izolasyon, Sayfa ve sekme bazında kapsam, Son ortam sınırı, T-F01 — Öğrenci raporunda doğru cevap sayısı boş (orta; 4 Ekim KAPANDI), T-F02 — Parola sıfırlama isteği beklerken düğme kilitlenmiyor (orta; 4 Ekim KAPANDI), Test kayıtları nasıl okunmalı?, UX iyileştirmeleri (+4 more)

### Community 117 - "admin-inventory.test.tsx"
Cohesion: 0.16
Nodes (9): App(), Toaster(), ToasterProps, AuthProvider(), clearOfflineUser(), fixture, mount(), next-themes (+1 more)

### Community 118 - "integration-smtp-probe.mjs"
Cohesion: 0.20
Nodes (9): nodemailer, configured, dotenv, env, nodemailer, report, require, root (+1 more)

### Community 119 - "integration-load-diagnostic.mjs"
Cohesion: 0.33
Nodes (4): cookie, report, root, runtime

### Community 122 - "Gerçek etkileşimle doğrulanan kusurlar"
Cohesion: 0.17
Nodes (12): Doğrulanan olumlu davranışlar ve geri çekilen şüpheler, Gerçek etkileşimle doğrulanan kusurlar, Kaynak UX bulguları ve henüz doğrulanmayan adaylar, S-B01 — Çevrimdışı cevap, bağlantı geri gelip sayfa yenilendiğinde kayboluyor — P1, S-B02 — Sınav hata ekranından dönüş öğrenciyi yetkisiz rotaya gönderiyor — P1, S-B03 — Dashboard “Tüm Sonuçları Gör” bağlantısı 404'e gidiyor — P1, S-B04 — Dashboard veri hatası sırasında “Tüm Sınavları Tamamladın” diyor — P2, S-B05 — Anket API hatası “Anket bulunmuyor” olarak gösteriliyor — P2 (+4 more)

### Community 123 - "config.ts"
Cohesion: 0.19
Nodes (11): buildServerEnv(), envValue(), gmailAddress, publicAppUrl(), SetupPayload, setupPayloadSchema, payload, buildDeploymentArtifacts() (+3 more)

### Community 124 - "remaining-repairs-verification.md"
Cohesion: 0.25
Nodes (6): Arşiv ve silme, Sunucu ayarları ve hibrit kurulum, Sınıf kapasitesi, Sınıf ve öğretmen erişimi, Yönetici onarımlarının davranış sözleşmeleri, İkinci admin onarım paketi — doğrulama

### Community 125 - "parent-audit-summary.mjs"
Cohesion: 0.15
Nodes (12): cases, cli, cohorts, flatten(), latest, manifest, out, repairs (+4 more)

### Community 128 - "student-ux-repairs.test.tsx"
Cohesion: 0.21
Nodes (4): ApiError, isRetryableError(), fixture, identity

### Community 129 - "navigation-menu.tsx"
Cohesion: 0.28
Nodes (8): NavigationMenu, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle, NavigationMenuViewport, @radix-ui/react-navigation-menu

### Community 130 - "admin-critical-repairs.spec.ts"
Cohesion: 0.33
Nodes (4): db, { PrismaClient }, root, runtime

### Community 131 - "Admin verification closure implementation plan"
Cohesion: 0.29
Nodes (6): Accessibility verification, Admin verification closure implementation plan, Export and print verification, Fresh hybrid setup, Global constraints, Integration and report

### Community 132 - "graphify-parent-audit-visual.mjs"
Cohesion: 0.25
Nodes (8): allowed, graphRoot, outputRoot, report, safeMessage(), safeUrl(), server, sourceRoot

### Community 133 - "queryClient.ts"
Cohesion: 0.47
Nodes (5): apiRequest(), getQueryFn(), queryClient, throwIfResNotOk(), UnauthorizedBehavior

### Community 134 - "admin-audit-system-flows.spec.ts"
Cohesion: 0.25
Nodes (3): expectedParent, isolatedRoot, runtime

### Community 136 - "student-audit-server.ts"
Cohesion: 0.33
Nodes (5): database, p, repo, require, root

### Community 137 - "teacher-audit-windows-runner.mjs"
Cohesion: 0.16
Nodes (13): allowedFile(), defaultDirectory, fixtureSecrets, samePath(), sanitizeTeacherAuditReport(), sanitizeTeacherAuditReportFile(), clientReq, out (+5 more)

### Community 138 - "Veli paneli sayfa/sekme doğrulaması"
Cohesion: 0.40
Nodes (5): Kanıtlar, Koşular ve test aracı düzeltmeleri, Son kapsam, Sınırlar ve veri bütünlüğü, Veli paneli sayfa/sekme doğrulaması

### Community 139 - "scripts"
Cohesion: 0.13
Nodes (15): scripts, build, db:create-admin, db:deploy, db:generate, db:migrate, db:seed, db:status (+7 more)

### Community 140 - "integration-evidence-check.mjs"
Cohesion: 0.10
Nodes (20): aiRoutePassed, backendPassed, commands, dotenv, env, files, frontendPassed, hash (+12 more)

### Community 142 - "Oturum yükü kök neden analizi"
Cohesion: 0.40
Nodes (4): En küçük düzeltme, İşletim sınırı, Karşılaştırma, Oturum yükü kök neden analizi

### Community 143 - "Öğretmen bulgularının kapanışı — 4 Ekim 2026"
Cohesion: 0.67
Nodes (3): Ortam ve tekrar çalıştırma, Taze doğrulama, Öğretmen bulgularının kapanışı — 4 Ekim 2026

### Community 146 - "Veli paneli hata onarımları"
Cohesion: 0.40
Nodes (5): Değişiklik ve kabul sözleşmeleri, Doğrulama, Graphify, Veli paneli hata onarımları, Veri, kurulum ve kapsam sınırları

### Community 147 - "input-group.tsx"
Cohesion: 0.28
Nodes (8): InputGroup(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton(), inputGroupButtonVariants, InputGroupInput(), InputGroupText(), InputGroupTextarea()

### Community 148 - "Veli paneli kapsam ve kontrol listesi"
Cohesion: 0.50
Nodes (4): Altyapı ve izolasyon, Sayfa ve sekmeler, Veli paneli kapsam ve kontrol listesi, Yetki ve veri akışı kontrol listesi

### Community 155 - "announcement.ts"
Cohesion: 0.21
Nodes (9): pino, pino-pretty, logger, AnnouncementAudience, isValidTeacherAnnouncementTarget(), matchesAnnouncementAudience(), matchesAnnouncementRecipient(), shouldNotifyQuizOwnerOfSubmission() (+1 more)

### Community 156 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, preview, test, test:coverage, test:ui, type-check

### Community 157 - "teacher-audit-server.ts"
Cohesion: 0.29
Nodes (6): content, database, p, repo, require, root

### Community 158 - "Öğretmen paneli — kaynak ve rota kanıtına dayalı UX notları"
Cohesion: 0.33
Nodes (5): Doğrulanmış iyileştirme, İsteğe bağlı özellik önerileri, Kusur olarak sınıflandırılmayan rota sayacı, TU-01 — Sonuç tablosu aramasında kalıcı ve açık alan etiketi eksik (P2), Öğretmen paneli — kaynak ve rota kanıtına dayalı UX notları

### Community 161 - "Yönetici paneli denetimi — 30 Eylül 2026"
Cohesion: 0.40
Nodes (5): Ortam ve kanıt sınırı, Sayfa ve sekme kontrol listesi, Tekrar çalıştırma, Yönetici paneli denetimi — 30 Eylül 2026, Öncelik ve yapılacak değişiklikler

## Knowledge Gaps
- **1043 isolated node(s):** `name`, `version`, `type`, `description`, `dev` (+1038 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1463 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **44 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `QuizMaster Graphify Mimari Haritası` connect `QuizMaster Graphify Mimari Haritası` to `offline-quiz.ts`, `live-socket-audit.ts`, `student-quiz.tsx`, `Button`, `README.md`, `applySetup`?**
  _High betweenness centrality (0.165) - this node is a cross-community bridge._
- **Why does `cn()` connect `cn` to `utils.ts`, `class-variance-authority`, `carousel.tsx`, `navigation-menu.tsx`, `empty.tsx`, `form.tsx`, `sidebar.tsx`, `client/package.json`, `chart.tsx`, `command.tsx`, `student-quiz.tsx`, `Button`, `use-toast.ts`, `drawer.tsx`, `input-group.tsx`, `pagination.tsx`, `item.tsx`?**
  _High betweenness centrality (0.151) - this node is a cross-community bridge._
- **Why does `createSessionStore()` connect `live-socket-audit.ts` to `QuizMaster Graphify Mimari Haritası`, `index.ts`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **What connects `name`, `version`, `type` to the rest of the system?**
  _1043 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `setup-bootstrap.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.07330827067669173 - nodes in this community are weakly interconnected._
- **Should `express` be split into smaller, more focused modules?**
  _Cohesion score 0.11175616835994194 - nodes in this community are weakly interconnected._
- **Should `IStorage` be split into smaller, more focused modules?**
  _Cohesion score 0.02 - nodes in this community are weakly interconnected._