# Graph Report - yeni-quizmaster-main  (2026-09-30)

## Corpus Check
- 310 files · ~289,847 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 3, .bat 2, .example 2)

## Summary
- 1906 nodes · 5393 edges · 94 communities (77 shown, 17 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a22548b0`
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
- storage.ts
- client/package.json
- QuizMaster
- api.ts
- package.json
- server/package.json
- utils.ts
- compilerOptions
- student-quiz.tsx
- Button
- use-toast.ts
- QuizMaster Sunucu Kurulum Kılavuzu
- api-routes/auth.ts
- upload.ts
- dependencies
- compilerOptions
- devDependencies
- deployment-config.ts
- export.ts
- offline-quiz.ts
- QuizMaster Yönetici Kullanıcı Kılavuzu
- field.tsx
- quiz.ts
- devDependencies
- middleware/auth.ts
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
- parent.ts
- auth-context.tsx
- chart.tsx
- command.tsx
- external-request.ts
- pagination.tsx
- QuizMaster Graphify Mimari Haritası
- admin-audit-server.ts
- drawer.tsx
- input-group.tsx
- navigation-menu.tsx
- QuizMaster Veli Kullanıcı Kılavuzu
- writeTransaction
- setup-bootstrap-lib.mjs
- compilerOptions
- App
- NotificationListener.tsx
- http-error.ts
- @playwright/test
- ref_path
- student.ts
- admin-audit-question-editor.test.tsx
- types.d.ts
- Bulgular
- ai.ts
- sw.js
- Confirmed code defects and acceptance criteria
- Admin audit: route inventory, management, settings, server, archive, announcements
- admin-audit-people-flows.spec.ts
- 2026-09-30-security-reliability.md
- kurulum.sh
- backups/README.md
- data/README.md
- empty.tsx
- Yönetici paneli denetimi — 30 Eylül 2026
- Yönetici denetimi: öğrenci, öğretmen, sınıf ve veli yönetimi
- Doğrulanmış bulgular
- Testler ve güvenli tekrar kontrolü
- admin-audit-people-flows-p-4e8a0-n-selected-course-and-class/error-context.md
- admin-audit-system-flows-d-063f6-r-instead-of-silent-failure/error-context.md
- Global Constraints
- 2026-09-30-admin-data-integrity-design.md
- Admin sonuç, cache ve atomik kayıt düzeltmeleri
- data-retention.ts
- 2026-09-30-admin-results-and-save-design.md

## God Nodes (most connected - your core abstractions)
1. `cn()` - 285 edges
2. `Button` - 106 edges
3. `PrismaStorage` - 104 edges
4. `IStorage` - 100 edges
5. `react` - 91 edges
6. `DashboardLayout()` - 70 edges
7. `Card` - 70 edges
8. `lucide-react` - 69 edges
9. `CardContent` - 66 edges
10. `CardHeader` - 63 edges

## Surprising Connections (you probably didn't know these)
- `Task 2: Question editor data preservation` --references--> `QuestionItem()`  [INFERRED]
  docs/superpowers/plans/2026-09-30-admin-data-integrity.md → client/src/components/quiz/QuestionItem.tsx
- `Düzeltme durumu — ikinci paket` --references--> `invalidateAdminRelations()`  [INFERRED]
  docs/admin-audit/people.md → client/src/lib/admin-cache.ts
- `Aktarım sonrası asgari doğrulama` --references--> `StudentResult`  [INFERRED]
  docs/postgresql-gecis-rehberi.md → client/src/lib/api.ts
- `Aktarım sonrası asgari doğrulama` --references--> `Class`  [INFERRED]
  docs/postgresql-gecis-rehberi.md → client/src/lib/api.ts
- `Yöntem ve kanıt sınırı` --references--> `secureJsonReplacer()`  [INFERRED]
  docs/admin-audit/people.md → server/utils/json-security.ts

## Import Cycles
- None detected.

## Communities (94 total, 17 thin omitted)

### Community 0 - "setup-bootstrap.mjs"
Cohesion: 0.09
Nodes (31): appendLog(), authenticated(), authorizeMutation(), cookies(), csrfValue, getPnpmVersion(), handler(), job (+23 more)

### Community 1 - "express"
Cohesion: 0.13
Nodes (16): express, router, querySchema, router, categorySchema, router, classSchema, router (+8 more)

### Community 4 - "dependencies"
Cohesion: 0.04
Nodes (55): dependencies, class-variance-authority, clsx, cmdk, date-fns, embla-carousel-react, framer-motion, @hookform/resolvers (+47 more)

### Community 5 - "sidebar.tsx"
Cohesion: 0.06
Nodes (39): SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay, SheetTitle, sheetVariants (+31 more)

### Community 6 - "index.ts"
Cohesion: 0.08
Nodes (26): connect-sqlite3, cors, csrf-sync, helmet, pino-http, registerRoutes(), app, authLimiter (+18 more)

### Community 7 - "cn"
Cohesion: 0.05
Nodes (53): AccordionContent, AccordionItem, AccordionTrigger, Avatar, AvatarFallback, AvatarImage, Breadcrumb, BreadcrumbEllipsis() (+45 more)

### Community 8 - "storage.ts"
Cohesion: 0.08
Nodes (26): express-session, @prisma/client, supertest, router, router, router, router, router (+18 more)

### Community 9 - "client/package.json"
Cohesion: 0.05
Nodes (36): description, @types/node, typescript, vitest, zod, zod-validation-error, name, packageManager (+28 more)

### Community 10 - "QuizMaster"
Cohesion: 0.06
Nodes (34): 1. Depoyu indirin, 1. Sunucuyu hazırlayın ve depoyu indirin, 2. Güvenli ön kontrolü ve bootstrap ekranını başlatın, 2. Kurulum başlatıcısını çalıştırın, 3. Grafik kurulum akışını tamamlayın, 3. Sihirbaz adımlarını tamamlayın, 4. Uygulamayı başlatın, 4. Uygulamayı servis olarak çalıştırın (+26 more)

### Community 11 - "api.ts"
Cohesion: 0.07
Nodes (32): aiApi, AIQuestion, analyticsApi, announcementApi, apiFetch(), Category, Class, ClassAnalyticsItem (+24 more)

### Community 12 - "package.json"
Cohesion: 0.09
Nodes (22): devDependencies, concurrently, playwright, @playwright/test, name, tar@<7.5.21, @tootallnate/once@<2.0.1, packageManager (+14 more)

### Community 13 - "server/package.json"
Cohesion: 0.06
Nodes (29): cross-env, dotenv, dotenv-cli, esbuild, pino, pino-pretty, prisma, socket.io (+21 more)

### Community 14 - "utils.ts"
Cohesion: 0.07
Nodes (21): Calendar(), CalendarDayButton(), InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot, RadioGroup, RadioGroupItem (+13 more)

### Community 15 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, allowJs, baseUrl, esModuleInterop, isolatedModules, jsx, lib (+14 more)

### Community 16 - "student-quiz.tsx"
Cohesion: 0.22
Nodes (16): AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay, AlertDialogTitle (+8 more)

### Community 17 - "Button"
Cohesion: 0.08
Nodes (159): ALL, AppRouter(), HomeRoute(), RedirectToAuth(), Role, RouteConfig, RouteGuard(), ROUTES (+151 more)

### Community 18 - "use-toast.ts"
Cohesion: 0.12
Nodes (24): Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle, toastVariants (+16 more)

### Community 19 - "QuizMaster Sunucu Kurulum Kılavuzu"
Cohesion: 0.09
Nodes (23): 10. Nginx — subdomain, 11. Nginx — alt yol, 12. IIS reverse proxy özeti, 13. Bootstrap ve tek kullanımlık web kurulum sihirbazı, 14. Log saklama ve veritabanı büyümesi, 15. Yedekleme, 16. İlk canlı kontrol listesi, 17. Güncelleme ve geri dönüş (+15 more)

### Community 20 - "api-routes/auth.ts"
Cohesion: 0.11
Nodes (13): bcryptjs, changePasswordSchema, forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, PARENT_RELATIONS, router (+5 more)

### Community 21 - "upload.ts"
Cohesion: 0.16
Nodes (8): multer, sharp, router, upload, uploadStorage, uploadsDirectory, viteConfig, viteLogger

### Community 22 - "dependencies"
Cohesion: 0.10
Nodes (20): dependencies, bcryptjs, connect-sqlite3, cors, csrf-sync, express, express-rate-limit, express-session (+12 more)

### Community 23 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, lib, module (+10 more)

### Community 24 - "devDependencies"
Cohesion: 0.07
Nodes (26): devDependencies, autoprefixer, baseline-browser-mapping, jsdom, postcss, tailwindcss, @tailwindcss/postcss, @tailwindcss/vite (+18 more)

### Community 25 - "deployment-config.ts"
Cohesion: 0.14
Nodes (19): buildServerEnv(), envValue(), gmailAddress, SetupPayload, setupPayloadSchema, payload, buildDeploymentArtifacts(), defaultRetention (+11 more)

### Community 26 - "export.ts"
Cohesion: 0.21
Nodes (14): columnName(), crc32(), createCsvBytes(), createCsvContent(), createExcelBytes(), CsvColumn, CsvExportOptions, CsvValue (+6 more)

### Community 27 - "offline-quiz.ts"
Cohesion: 0.26
Nodes (16): AuthProvider(), clearOfflineUser(), getOfflineQuizList(), getOfflineSession(), getOfflineUser(), markOfflineSubmit(), OfflineQuestion, OfflineQuizSession (+8 more)

### Community 28 - "QuizMaster Yönetici Kullanıcı Kılavuzu"
Cohesion: 0.12
Nodes (17): 10. Duyurular ve bildirimler, 11. Loglar, e-posta ve şifre talepleri, 12. Excel ve yazdırma, 13. Çevrimdışı sınav, 14. Sorun giderme, 1. Giriş ve güvenlik, 2. Yönetici menüsü, 3. Öğrenci yönetimi (+9 more)

### Community 29 - "field.tsx"
Cohesion: 0.08
Nodes (31): ButtonGroup(), ButtonGroupSeparator(), ButtonGroupText(), buttonGroupVariants, Field(), FieldContent(), FieldDescription(), FieldError() (+23 more)

### Community 30 - "quiz.ts"
Cohesion: 0.14
Nodes (20): notify(), saveContentHandler(), schema, notifyAdminsAboutTeacherQuiz(), questionsArraySchema, questionSchema, quizSchema, canAccessSurvey() (+12 more)

### Community 31 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, cross-env, dotenv, dotenv-cli, esbuild, supertest, tsx, @types/connect-sqlite3 (+8 more)

### Community 32 - "middleware/auth.ts"
Cohesion: 0.13
Nodes (21): nodemailer, requireRuntimeChanges(), runtimeDeploymentChangesAllowed(), AuthRequest, express-session, requireAuth(), requireRole(), SessionData (+13 more)

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
Cohesion: 0.09
Nodes (27): publicAppUrl(), toDeploymentConfig(), APPLY_STEPS, ApplyJobState, applySetup(), ApplyStepState, artifactRoot, cookieValue() (+19 more)

### Community 38 - "form.tsx"
Cohesion: 0.19
Nodes (12): FormControl, FormDescription, FormFieldContext, FormFieldContextValue, FormItem, FormItemContext, FormItemContextValue, FormLabel (+4 more)

### Community 39 - "README.md"
Cohesion: 0.19
Nodes (5): Doğrulama ve Graphify, Güvenlik ve veri bütünlüğü bakımı — 30 Eylül 2026, İşletim sınırları ve sonraki çalışmalar, Uygulanan düzeltmeler, Veritabanı ve mevcut kurulum

### Community 40 - "SQLite'tan PostgreSQL'e Geçiş Rehberi"
Cohesion: 0.15
Nodes (13): 10. Geçiş sonrası büyüme ve bakım, 11. Resmî başvuru kaynakları, 1. Mevcut uyumluluk durumu, 2. Geçişi başlatma ölçütleri, 3. Geçiş öncesi hazırlık, 4. PostgreSQL migration geçmişini oluşturma, 6. Oturum deposu, 7. JSON alanları için ikinci aşama (+5 more)

### Community 41 - "QuizMaster Öğrenci Kullanıcı Kılavuzu"
Cohesion: 0.15
Nodes (13): 10. Hesap güvenliği, 11. Sorun giderme, 1. Kayıt ve giriş, 2. Öğrenci menüsü, 3. Sınavı başlatmadan önce, 4. Sınavı çözme ve teslim, 5. Anketlerim, 6. Sonuçlar ve istatistikler (+5 more)

### Community 42 - "QuizMaster Öğretmen Kullanıcı Kılavuzu"
Cohesion: 0.15
Nodes (13): 10. Çevrimdışı sınav, 11. Sorun giderme, 1. Giriş ve profil, 2. Öğretmen menüsü, 3. Sınav oluşturma, 4. Sınav yayını ve güvenlik, 5. Anket Yönetimi, 6. Sonuçlar ve sınıf istatistikleri (+5 more)

### Community 43 - "parent.ts"
Cohesion: 0.17
Nodes (10): Yöntem ve kanıt sınırı, createParentSchema, guardianStudentsSchema, linkSchema, relationSchema, router, updateParentSchema, appFor() (+2 more)

### Community 44 - "auth-context.tsx"
Cohesion: 0.20
Nodes (11): AuthContext, AuthContextType, UserRole, authApi, ParentStudent, User, apiRequest(), getQueryFn() (+3 more)

### Community 45 - "chart.tsx"
Cohesion: 0.27
Nodes (10): ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartStyle(), ChartTooltipContent, getPayloadConfigFromPayload() (+2 more)

### Community 46 - "command.tsx"
Cohesion: 0.20
Nodes (10): Command, CommandDialog(), CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator (+2 more)

### Community 47 - "external-request.ts"
Cohesion: 0.24
Nodes (6): fake, blocked, globalV6, isPublicAddress(), isSafeUrl(), safeExternalFetch()

### Community 48 - "pagination.tsx"
Cohesion: 0.24
Nodes (9): ButtonProps, Pagination(), PaginationContent, PaginationEllipsis(), PaginationItem, PaginationLink(), PaginationLinkProps, PaginationNext() (+1 more)

### Community 49 - "QuizMaster Graphify Mimari Haritası"
Cohesion: 0.20
Nodes (10): Bakımda güncellik kontrolü, Commit öncesi kontrol, Grafiği güncelleme, Grafiği sorgulama, Graphify kurulumu, Görsel haritayı açma, Güncellik kuralı, Neden diğer dosyalar paylaşılmıyor? (+2 more)

### Community 50 - "admin-audit-server.ts"
Cohesion: 0.13
Nodes (8): finder, scriptDir, db, p, repo, require, root, require

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

### Community 56 - "setup-bootstrap-lib.mjs"
Cohesion: 0.17
Nodes (21): holder, anyExists(), assertInside(), backupItems(), checkDependencies(), clearUploads(), collectFiles(), createVerifiedBackup() (+13 more)

### Community 57 - "compilerOptions"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 58 - "App"
Cohesion: 0.29
Nodes (3): App(), ErrorBoundary, react-dom

### Community 59 - "NotificationListener.tsx"
Cohesion: 0.21
Nodes (8): NotificationListener(), ToasterProps, notificationApi, NotificationPage, prependNotification(), next-themes, socket.io-client, sonner

### Community 61 - "@playwright/test"
Cohesion: 0.08
Nodes (11): @playwright/test, cookies, login(), routes, expectedParent, isolatedRoot, runtime, prisma (+3 more)

### Community 62 - "ref_path"
Cohesion: 0.17
Nodes (9): origLookup, @tailwindcss/vite, vite, @vitejs/plugin-react, serveStatic(), getProjectRoot(), isProjectRoot(), origLookup (+1 more)

### Community 63 - "student.ts"
Cohesion: 0.25
Nodes (8): express-rate-limit, answerSchema, quizActionLimiter, submitSchema, isValidTeacherAnnouncementTarget(), matchesAnnouncementRecipient(), shouldNotifyQuizOwnerOfSubmission(), UserRole

### Community 64 - "admin-audit-question-editor.test.tsx"
Cohesion: 0.24
Nodes (5): mocks, renderEditor(), data, @testing-library/react, @testing-library/user-event

### Community 65 - "types.d.ts"
Cohesion: 0.50
Nodes (3): nanoid, vite, */vite.config

### Community 66 - "Bulgular"
Cohesion: 0.13
Nodes (15): Bulgular, Q01 — P1 — Anket soru türünü değiştiren ardışık güncellemeler birbirini eziyor, Q02 — P1 — Seçenek silince doğru cevap başka seçeneğe kayıyor, Q03 — P1 — Başarısız kayıt kısmi değişiklik/tekrar denemede mükerrer taslak bırakıyor, Q04 — P1 — Sonuç ekranı tamamlanmamış sınavları sıfır puan olarak başarıya katıyor, Q05 — P2 — Yönetici sonuç filtresi öğretmen sınavlarını listelemiyor, Q06 — P2 — Açıklamayı ve süre sınırını temizlemek kaydedilmiyor, Q07 — P2 — Silme nedeni kayboluyor, kalıcı sınav silmenin işlem kaydı yok (+7 more)

### Community 67 - "ai.ts"
Cohesion: 0.20
Nodes (7): AIResponseSchema, aiTestLimiter, QuestionSchema, router, SurveyQuestionSchema, SurveyResponseSchema, app

### Community 69 - "Confirmed code defects and acceptance criteria"
Cohesion: 0.18
Nodes (11): Confirmed code defects and acceptance criteria, INV-01 — P2: successful profile save leaves admin identity stale, INV-02 — P2: management log history silently stops at the first page, INV-03 — P2: archive history hard-capped at 20, INV-04 — P1: archive batch can partially commit, INV-05 — P2: archive preview and mutation select different data, INV-06 — P2: announcement deletion is immediate and errors are silent, INV-07 — P2: request failures are presented as empty/default content (+3 more)

### Community 70 - "Admin audit: route inventory, management, settings, server, archive, announcements"
Cohesion: 0.22
Nodes (9): Additional risks requiring targeted verification, Admin audit: route inventory, management, settings, server, archive, announcements, Browser verification addendum — 2026-09-30, Complete admin route inventory, INV-11 — P2: unknown settings tab leaves no active panel, INV-12 — P2: mobile navigation does not close on Escape, INV-13 — P2: malformed deployment URL returns HTTP 500, Read-only browser checklist (+1 more)

### Community 72 - "admin-audit-people-flows.spec.ts"
Cohesion: 0.36
Nodes (5): api(), cookies, createClass(), createStudent(), login()

### Community 81 - "empty.tsx"
Cohesion: 0.29
Nodes (7): Empty(), EmptyContent(), EmptyDescription(), EmptyHeader(), EmptyMedia(), emptyMediaVariants, EmptyTitle()

### Community 82 - "Yönetici paneli denetimi — 30 Eylül 2026"
Cohesion: 0.25
Nodes (5): Ortam ve kanıt sınırı, Sayfa ve sekme kontrol listesi, Tekrar çalıştırma, Yönetici paneli denetimi — 30 Eylül 2026, Öncelik ve yapılacak değişiklikler

### Community 83 - "Yönetici denetimi: öğrenci, öğretmen, sınıf ve veli yönetimi"
Cohesion: 0.22
Nodes (9): Başarılı mevcut kontroller, Düzeltme durumu — ikinci paket, Düzeltme durumu — ilk paket, Ek statik kusurlar ve ürün kararı gerektiren noktalar, Ekran ve eylem envanteri, Koordinatör tarayıcı doğrulaması — 30 Eylül 2026, Sonraki gerçek arayüz test dosyası, Testler ve kapsam (+1 more)

### Community 84 - "Doğrulanmış bulgular"
Cohesion: 0.25
Nodes (8): Doğrulanmış bulgular, PE-01 — P1: yeni öğretmenin seçtiği ders ve sınıflar sessizce kayboluyor, PE-02 — P1: atama değişiklikleri farklı query key'lerde eski yönetici verisini bırakıyor, PE-03 — P2: ders atama API'si öğrenci hesabını öğretmen olarak kabul ediyor, PE-04 — P2: maxStudents saklanıyor ancak kayıt/nakilde kapasiteyi sınırlamıyor, PE-05 — P1: sorumlu öğretmeni kaldırmak ilk oluşturmadaki legacy sınıf erişimini kaldırmıyor, PE-06 — P2: sınıf ve veli bağlantısı işlemlerinde hatalar kullanıcıya görünmüyor, PE-07 — P2: kritik ikon eylemleri klavye ve erişilebilir ad desteğinden yoksun

### Community 85 - "Testler ve güvenli tekrar kontrolü"
Cohesion: 0.25
Nodes (7): Düzeltme durumu — ikinci paket, Düzeltme durumu — ilk paket, Ek araştırma / doğrulanmamış riskler, Nihai tarayıcı doğrulaması, Sekme ve eylem envanteri, Testler ve güvenli tekrar kontrolü, Yönetici denetimi — sınav, anket ve raporlar

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

### Community 91 - "data-retention.ts"
Cohesion: 0.53
Nodes (4): retentionCutoffs(), RetentionPolicy, runDataRetention(), startDataRetentionWorker()

## Knowledge Gaps
- **656 isolated node(s):** `name`, `version`, `type`, `description`, `dev` (+651 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 936 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `class-variance-authority`, `carousel.tsx`, `sidebar.tsx`, `form.tsx`, `client/package.json`, `chart.tsx`, `utils.ts`, `command.tsx`, `student-quiz.tsx`, `Button`, `empty.tsx`, `drawer.tsx`, `input-group.tsx`, `navigation-menu.tsx`, `pagination.tsx`, `use-toast.ts`, `field.tsx`?**
  _High betweenness centrality (0.212) - this node is a cross-community bridge._
- **Why does `PrismaStorage` connect `PrismaStorage` to `IStorage`, `storage.ts`, `.getGuardianStudents`, `writeTransaction`, `.updateUser`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Why does `IStorage` connect `IStorage` to `storage.ts`, `PrismaStorage`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **What connects `name`, `version`, `type` to the rest of the system?**
  _656 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `setup-bootstrap.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.0944741532976827 - nodes in this community are weakly interconnected._
- **Should `express` be split into smaller, more focused modules?**
  _Cohesion score 0.13405797101449277 - nodes in this community are weakly interconnected._
- **Should `IStorage` be split into smaller, more focused modules?**
  _Cohesion score 0.020202020202020204 - nodes in this community are weakly interconnected._