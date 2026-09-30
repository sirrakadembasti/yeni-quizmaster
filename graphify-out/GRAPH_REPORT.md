# Graph Report - yeni-quizmaster-main  (2026-09-30)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1741 nodes · 5116 edges · 81 communities (62 shown, 19 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 57 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7b30d0d2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- setup-bootstrap.mjs
- routes.ts
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
- quiz.ts
- deployment.ts
- dependencies
- compilerOptions
- devDependencies
- menubar.tsx
- export.ts
- offline-quiz.ts
- QuizMaster Yönetici Kullanıcı Kılavuzu
- field.tsx
- survey.ts
- devDependencies
- ref_vitest
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
- item.tsx
- auth-context.tsx
- chart.tsx
- command.tsx
- external-request.ts
- pagination.tsx
- QuizMaster Graphify Mimari Haritası
- breadcrumb.tsx
- drawer.tsx
- input-group.tsx
- navigation-menu.tsx
- QuizMaster Veli Kullanıcı Kılavuzu
- writeTransaction
- scripts
- compilerOptions
- App
- NotificationListener.tsx
- http-error.ts
- queryClient.ts
- client/vitest.config.ts
- sonner
- button.test.tsx
- types.d.ts
- scroll-area.tsx
- sw.js
- @radix-ui/react-aspect-ratio
- collapsible.tsx
- @testing-library/jest-dom
- 2026-09-30-security-reliability.md
- kurulum.sh
- backups/README.md
- data/README.md

## God Nodes (most connected - your core abstractions)
1. `cn()` - 285 edges
2. `Button` - 106 edges
3. `PrismaStorage` - 102 edges
4. `IStorage` - 99 edges
5. `react` - 91 edges
6. `DashboardLayout()` - 70 edges
7. `Card` - 70 edges
8. `lucide-react` - 69 edges
9. `CardContent` - 66 edges
10. `CardHeader` - 63 edges

## Surprising Connections (you probably didn't know these)
- `Aktarım sonrası asgari doğrulama` --references--> `StudentResult`  [INFERRED]
  docs/postgresql-gecis-rehberi.md → client/src/lib/api.ts
- `Aktarım sonrası asgari doğrulama` --references--> `Class`  [INFERRED]
  docs/postgresql-gecis-rehberi.md → client/src/lib/api.ts
- `Aktarım sonrası asgari doğrulama` --references--> `Quiz`  [INFERRED]
  docs/postgresql-gecis-rehberi.md → client/src/lib/api.ts
- `Aktarım sonrası asgari doğrulama` --references--> `Category`  [INFERRED]
  docs/postgresql-gecis-rehberi.md → client/src/lib/api.ts
- `AlertTitle` --calls--> `cn()`  [EXTRACTED]
  client/src/components/ui/alert.tsx → client/src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (81 total, 19 thin omitted)

### Community 0 - "setup-bootstrap.mjs"
Cohesion: 0.06
Nodes (55): holder, finder, scriptDir, appendLog(), authenticated(), authorizeMutation(), cookies(), csrfValue (+47 more)

### Community 1 - "routes.ts"
Cohesion: 0.09
Nodes (35): express, express-rate-limit, AIResponseSchema, aiTestLimiter, QuestionSchema, router, SurveyQuestionSchema, SurveyResponseSchema (+27 more)

### Community 4 - "dependencies"
Cohesion: 0.04
Nodes (55): dependencies, class-variance-authority, clsx, cmdk, date-fns, embla-carousel-react, framer-motion, @hookform/resolvers (+47 more)

### Community 5 - "sidebar.tsx"
Cohesion: 0.06
Nodes (38): SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay, SheetTitle, sheetVariants (+30 more)

### Community 6 - "index.ts"
Cohesion: 0.05
Nodes (39): connect-sqlite3, cors, csrf-sync, multer, pino-http, sharp, router, upload (+31 more)

### Community 7 - "cn"
Cohesion: 0.06
Nodes (47): AccordionContent, AccordionItem, AccordionTrigger, Avatar, AvatarFallback, AvatarImage, ContextMenuCheckboxItem, ContextMenuContent (+39 more)

### Community 8 - "storage.ts"
Cohesion: 0.07
Nodes (20): bcryptjs, dotenv, express-session, @prisma/client, supertest, router, router, router (+12 more)

### Community 9 - "client/package.json"
Cohesion: 0.05
Nodes (36): description, @types/node, typescript, vitest, zod, zod-validation-error, name, packageManager (+28 more)

### Community 10 - "QuizMaster"
Cohesion: 0.06
Nodes (34): 1. Depoyu indirin, 1. Sunucuyu hazırlayın ve depoyu indirin, 2. Güvenli ön kontrolü ve bootstrap ekranını başlatın, 2. Kurulum başlatıcısını çalıştırın, 3. Grafik kurulum akışını tamamlayın, 3. Sihirbaz adımlarını tamamlayın, 4. Uygulamayı başlatın, 4. Uygulamayı servis olarak çalıştırın (+26 more)

### Community 11 - "api.ts"
Cohesion: 0.08
Nodes (29): aiApi, AIQuestion, analyticsApi, announcementApi, apiFetch(), Category, Class, ClassAnalyticsItem (+21 more)

### Community 12 - "package.json"
Cohesion: 0.07
Nodes (23): devDependencies, concurrently, playwright, @playwright/test, name, tar@<7.5.21, @tootallnate/once@<2.0.1, packageManager (+15 more)

### Community 13 - "server/package.json"
Cohesion: 0.07
Nodes (26): cross-env, dotenv-cli, esbuild, pino, pino-pretty, prisma, tsx, @types/connect-sqlite3 (+18 more)

### Community 14 - "utils.ts"
Cohesion: 0.09
Nodes (15): ButtonGroup(), ButtonGroupText(), buttonGroupVariants, Calendar(), CalendarDayButton(), HoverCardContent, PopoverContent, RadioGroup (+7 more)

### Community 15 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, allowJs, baseUrl, esModuleInterop, isolatedModules, jsx, lib (+14 more)

### Community 16 - "student-quiz.tsx"
Cohesion: 0.25
Nodes (14): AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay, AlertDialogTitle (+6 more)

### Community 17 - "Button"
Cohesion: 0.08
Nodes (156): ALL, AppRouter(), HomeRoute(), RedirectToAuth(), Role, RouteConfig, RouteGuard(), ROUTES (+148 more)

### Community 18 - "use-toast.ts"
Cohesion: 0.12
Nodes (24): Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle, toastVariants (+16 more)

### Community 19 - "QuizMaster Sunucu Kurulum Kılavuzu"
Cohesion: 0.09
Nodes (23): 10. Nginx — subdomain, 11. Nginx — alt yol, 12. IIS reverse proxy özeti, 13. Bootstrap ve tek kullanımlık web kurulum sihirbazı, 14. Log saklama ve veritabanı büyümesi, 15. Yedekleme, 16. İlk canlı kontrol listesi, 17. Güncelleme ve geri dönüş (+15 more)

### Community 20 - "quiz.ts"
Cohesion: 0.15
Nodes (16): socket.io, router, notifyAdminsAboutTeacherQuiz(), questionsArraySchema, questionSchema, quizSchema, disconnectSessionSockets(), disconnectUserSockets() (+8 more)

### Community 21 - "deployment.ts"
Cohesion: 0.18
Nodes (14): requireRuntimeChanges(), runtimeDeploymentChangesAllowed(), retentionCutoffs(), RetentionPolicy, runDataRetention(), startDataRetentionWorker(), defaultRetention, deploymentConfigPath (+6 more)

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

### Community 27 - "offline-quiz.ts"
Cohesion: 0.27
Nodes (15): getOfflineQuizList(), getOfflineSession(), markOfflineSubmit(), OfflineQuestion, OfflineQuizSession, orderQuizQuestions(), readJson(), removeOfflineSession() (+7 more)

### Community 28 - "QuizMaster Yönetici Kullanıcı Kılavuzu"
Cohesion: 0.12
Nodes (17): 10. Duyurular ve bildirimler, 11. Loglar, e-posta ve şifre talepleri, 12. Excel ve yazdırma, 13. Çevrimdışı sınav, 14. Sorun giderme, 1. Giriş ve güvenlik, 2. Yönetici menüsü, 3. Öğrenci yönetimi (+9 more)

### Community 29 - "field.tsx"
Cohesion: 0.14
Nodes (15): ButtonGroupSeparator(), Field(), FieldContent(), FieldDescription(), FieldError(), FieldGroup(), FieldLabel(), FieldLegend() (+7 more)

### Community 30 - "survey.ts"
Cohesion: 0.19
Nodes (11): canAccessSurvey(), getAccessibleSurveys(), isAssignedToStudent(), resultQuerySchema, submissionSchema, surveyQuestionSchema, surveyWriteSchema, canAccessClass() (+3 more)

### Community 31 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, cross-env, dotenv, dotenv-cli, esbuild, supertest, tsx, @types/connect-sqlite3 (+8 more)

### Community 32 - "ref_vitest"
Cohesion: 0.10
Nodes (28): nodemailer, router, changePasswordSchema, forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, router (+20 more)

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
Cohesion: 0.07
Nodes (39): helmet, buildServerEnv(), envValue(), gmailAddress, publicAppUrl(), SetupPayload, setupPayloadSchema, toDeploymentConfig() (+31 more)

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

### Community 43 - "item.tsx"
Cohesion: 0.20
Nodes (11): Item(), ItemActions(), ItemContent(), ItemDescription(), ItemFooter(), ItemGroup(), ItemHeader(), ItemMedia() (+3 more)

### Community 44 - "auth-context.tsx"
Cohesion: 0.26
Nodes (10): AuthContext, AuthContextType, AuthProvider(), UserRole, authApi, ParentStudent, refreshCsrfToken(), User (+2 more)

### Community 45 - "chart.tsx"
Cohesion: 0.27
Nodes (10): ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartStyle(), ChartTooltipContent, getPayloadConfigFromPayload() (+2 more)

### Community 46 - "command.tsx"
Cohesion: 0.20
Nodes (10): Command, CommandDialog(), CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator (+2 more)

### Community 47 - "external-request.ts"
Cohesion: 0.27
Nodes (6): fake, blocked, globalV6, isPublicAddress(), isSafeUrl(), safeExternalFetch()

### Community 48 - "pagination.tsx"
Cohesion: 0.24
Nodes (9): ButtonProps, Pagination(), PaginationContent, PaginationEllipsis(), PaginationItem, PaginationLink(), PaginationLinkProps, PaginationNext() (+1 more)

### Community 49 - "QuizMaster Graphify Mimari Haritası"
Cohesion: 0.20
Nodes (10): Bakımda güncellik kontrolü, Commit öncesi kontrol, Grafiği güncelleme, Grafiği sorgulama, Graphify kurulumu, Görsel haritayı açma, Güncellik kuralı, Neden diğer dosyalar paylaşılmıyor? (+2 more)

### Community 50 - "breadcrumb.tsx"
Cohesion: 0.22
Nodes (8): Breadcrumb, BreadcrumbEllipsis(), BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator(), @radix-ui/react-slot

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

### Community 56 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, preview, test, test:coverage, test:ui, type-check

### Community 57 - "compilerOptions"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 58 - "App"
Cohesion: 0.29
Nodes (3): App(), ErrorBoundary, react-dom

### Community 59 - "NotificationListener.tsx"
Cohesion: 0.43
Nodes (5): NotificationListener(), notificationApi, NotificationPage, prependNotification(), socket.io-client

### Community 60 - "http-error.ts"
Cohesion: 0.47
Nodes (3): handleResponse(), ApiError, isRetryableError()

### Community 61 - "queryClient.ts"
Cohesion: 0.47
Nodes (5): apiRequest(), getQueryFn(), queryClient, throwIfResNotOk(), UnauthorizedBehavior

### Community 62 - "client/vitest.config.ts"
Cohesion: 0.33
Nodes (4): origLookup, @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 63 - "sonner"
Cohesion: 0.40
Nodes (3): ToasterProps, next-themes, sonner

### Community 65 - "types.d.ts"
Cohesion: 0.50
Nodes (3): nanoid, vite, */vite.config

## Knowledge Gaps
- **561 isolated node(s):** `name`, `version`, `type`, `description`, `dev` (+556 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 826 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `sidebar.tsx`, `utils.ts`, `student-quiz.tsx`, `Button`, `use-toast.ts`, `menubar.tsx`, `field.tsx`, `class-variance-authority`, `carousel.tsx`, `form.tsx`, `item.tsx`, `chart.tsx`, `command.tsx`, `pagination.tsx`, `breadcrumb.tsx`, `drawer.tsx`, `input-group.tsx`, `navigation-menu.tsx`, `scroll-area.tsx`?**
  _High betweenness centrality (0.242) - this node is a cross-community bridge._
- **Why does `5. Verileri taşıma` connect `api.ts` to `SQLite'tan PostgreSQL'e Geçiş Rehberi`?**
  _High betweenness centrality (0.135) - this node is a cross-community bridge._
- **What connects `name`, `version`, `type` to the rest of the system?**
  _561 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `setup-bootstrap.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.05886708626434654 - nodes in this community are weakly interconnected._
- **Should `routes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0861952861952862 - nodes in this community are weakly interconnected._
- **Should `IStorage` be split into smaller, more focused modules?**
  _Cohesion score 0.02040816326530612 - nodes in this community are weakly interconnected._
- **Should `PrismaStorage` be split into smaller, more focused modules?**
  _Cohesion score 0.022727272727272728 - nodes in this community are weakly interconnected._