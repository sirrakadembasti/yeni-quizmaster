# Graph Report - Quiz-Master  (2026-09-25)

## Corpus Check
- 222 files · ~115,253 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1524 nodes · 3279 edges · 139 communities (69 shown, 70 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 46 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1ddb7f34`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ai.ts
- routes.ts
- IStorage
- PrismaStorage
- deployment.ts
- cn
- index.ts
- utils.ts
- compilerOptions
- devDependencies
- devDependencies
- QuizMaster Sunucu Kurulum Kılavuzu
- compilerOptions
- App.tsx
- field.tsx
- package.json
- menubar.tsx
- api.ts
- use-toast.ts
- pagination.tsx
- dependencies
- item.tsx
- html2canvas
- context-menu.tsx
- command.tsx
- QuizMaster Graphify Mimari Haritası
- @radix-ui/react-tooltip
- input-group.tsx
- compilerOptions
- server/package.json
- scripts
- form.tsx
- api-routes/auth.ts
- breadcrumb.tsx
- drawer.tsx
- empty.tsx
- navigation-menu.tsx
- toggle-group.tsx
- quiz.ts
- ErrorBoundary
- NotificationListener.tsx
- @prisma/client
- esbuild
- SQLite'tan PostgreSQL'e Geçiş Rehberi
- types.d.ts
- zod-validation-error
- carousel.tsx
- typescript
- useToast
- sonner.tsx
- check-users.ts
- seed.ts
- @types/cors
- clsx
- cmdk
- date-fns
- embla-carousel-react
- framer-motion
- dependencies
- input-otp
- survey.ts
- next-themes
- @radix-ui/react-accordion
- @radix-ui/react-alert-dialog
- @radix-ui/react-aspect-ratio
- createExcelBytes
- @radix-ui/react-checkbox
- @radix-ui/react-context-menu
- @radix-ui/react-dialog
- @radix-ui/react-dropdown-menu
- @radix-ui/react-hover-card
- @radix-ui/react-label
- @radix-ui/react-menubar
- @radix-ui/react-navigation-menu
- @radix-ui/react-popover
- @radix-ui/react-progress
- @radix-ui/react-radio-group
- @radix-ui/react-scroll-area
- @radix-ui/react-select
- @radix-ui/react-separator
- @radix-ui/react-slider
- @radix-ui/react-slot
- @radix-ui/react-switch
- @radix-ui/react-toggle
- email.ts
- QuizMaster Yönetici Kullanıcı Kılavuzu
- react-dom
- react-hook-form
- react-resizable-panels
- recharts
- socket.io-client
- sonner
- tailwind-merge
- tailwindcss-animate
- @tanstack/react-query
- tw-animate-css
- vaul
- QuizMaster Gmail E-Posta ve Parola Sıfırlama Kılavuzu
- zod
- QuizMaster
- QuizMaster Öğrenci Kullanıcı Kılavuzu
- QuizMaster Öğretmen Kullanıcı Kılavuzu
- sw.js
- client/vitest.config.ts
- toast.tsx
- chart.tsx
- QuizMaster Veli Kullanıcı Kılavuzu
- student-quiz.tsx
- SurveyResultsPage
- Q: uygulamayı önce incele tüm yönü. fronten backend api entegrasyonu login register ve güvenlik yönleri ile. kısaca bilgi ve sonra faz faz yapılacakalrı kritik önceliğine göre listele. kodlamaya başlama
- Q: bir öğrenci internet bağlantısı olmadığında sınavları çözebilecek mi ve uygulamada bu altyapı mevcut mu
- lucide-react
- server/vitest.config.ts
- @radix-ui/react-collapsible
- @radix-ui/react-tabs
- @radix-ui/react-toast
- react-day-picker
- create-admin.ts
- backups/README.md
- dotenv-cli
- data/README.md
- supertest
- @types/nodemailer
- tsx
- vitest
- @types/express-session

## God Nodes (most connected - your core abstractions)
1. `cn()` - 150 edges
2. `PrismaStorage` - 98 edges
3. `IStorage` - 95 edges
4. `Button` - 48 edges
5. `useToast()` - 41 edges
6. `useAuth()` - 40 edges
7. `storage` - 33 edges
8. `DashboardLayout()` - 31 edges
9. `Card` - 31 edges
10. `CardContent` - 29 edges

## Surprising Connections (you probably didn't know these)
- `BreadcrumbSeparator()` --calls--> `cn()`  [EXTRACTED]
  client/src/components/ui/breadcrumb.tsx → client/src/lib/utils.ts
- `BreadcrumbEllipsis()` --calls--> `cn()`  [EXTRACTED]
  client/src/components/ui/breadcrumb.tsx → client/src/lib/utils.ts
- `ButtonGroupText()` --calls--> `cn()`  [EXTRACTED]
  client/src/components/ui/button-group.tsx → client/src/lib/utils.ts
- `ButtonGroupSeparator()` --calls--> `cn()`  [EXTRACTED]
  client/src/components/ui/button-group.tsx → client/src/lib/utils.ts
- `CommandShortcut()` --calls--> `cn()`  [EXTRACTED]
  client/src/components/ui/command.tsx → client/src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (139 total, 70 thin omitted)

### Community 0 - "ai.ts"
Cohesion: 0.20
Nodes (6): AIResponseSchema, aiTestLimiter, QuestionSchema, router, SurveyQuestionSchema, SurveyResponseSchema

### Community 1 - "routes.ts"
Cohesion: 0.11
Nodes (28): router, querySchema, router, router, categorySchema, router, classSchema, router (+20 more)

### Community 4 - "deployment.ts"
Cohesion: 0.16
Nodes (19): detectedOrigin(), retentionCutoffs(), RetentionPolicy, runDataRetention(), startDataRetentionWorker(), setupSocket(), buildDeploymentArtifacts(), defaultRetention (+11 more)

### Community 5 - "cn"
Cohesion: 0.08
Nodes (41): Kbd(), KbdGroup(), ResizableHandle(), ResizablePanelGroup(), SheetContent, SheetContentProps, SheetDescription, SheetFooter() (+33 more)

### Community 6 - "index.ts"
Cohesion: 0.06
Nodes (34): express, registerRoutes(), router, upload, uploadStorage, app, authLimiter, deploymentConfig (+26 more)

### Community 7 - "utils.ts"
Cohesion: 0.06
Nodes (20): AccordionContent, AccordionItem, AccordionTrigger, Alert, AlertDescription, AlertTitle, alertVariants, Avatar (+12 more)

### Community 8 - "compilerOptions"
Cohesion: 0.07
Nodes (26): compilerOptions, allowImportingTsExtensions, allowJs, baseUrl, esModuleInterop, isolatedModules, jsx, lib (+18 more)

### Community 9 - "devDependencies"
Cohesion: 0.13
Nodes (15): cross-env, dotenv, devDependencies, cross-env, dotenv, @types/connect-sqlite3, @types/express, @types/multer (+7 more)

### Community 10 - "devDependencies"
Cohesion: 0.04
Nodes (48): autoprefixer, baseline-browser-mapping, description, devDependencies, autoprefixer, baseline-browser-mapping, jsdom, postcss (+40 more)

### Community 11 - "QuizMaster Sunucu Kurulum Kılavuzu"
Cohesion: 0.10
Nodes (21): 10. Nginx — subdomain, 11. Nginx — alt yol, 12. IIS reverse proxy özeti, 13. Web tabanlı Sunucu Kurulumu ekranı, 14. Log saklama ve veritabanı büyümesi, 15. Yedekleme, 16. İlk canlı kontrol listesi, 17. Güncelleme ve geri dönüş (+13 more)

### Community 12 - "compilerOptions"
Cohesion: 0.08
Nodes (23): dist, node_modules, tests, **/*.ts, compilerOptions, allowJs, declaration, declarationMap (+15 more)

### Community 13 - "App.tsx"
Cohesion: 0.10
Nodes (33): ALL, AppRouter(), HomeRoute(), Role, RouteConfig, RouteGuard(), ROUTES, RoleSwitcher() (+25 more)

### Community 14 - "field.tsx"
Cohesion: 0.13
Nodes (16): ButtonGroup(), ButtonGroupSeparator(), ButtonGroupText(), buttonGroupVariants, Field(), FieldContent(), FieldDescription(), FieldError() (+8 more)

### Community 15 - "package.json"
Cohesion: 0.11
Nodes (18): concurrently, devDependencies, concurrently, playwright, @playwright/test, name, packageManager, private (+10 more)

### Community 16 - "menubar.tsx"
Cohesion: 0.12
Nodes (11): Menubar, MenubarCheckboxItem, MenubarContent, MenubarItem, MenubarLabel, MenubarRadioItem, MenubarSeparator, MenubarShortcut() (+3 more)

### Community 17 - "api.ts"
Cohesion: 0.06
Nodes (122): AnnouncementAuthor(), AnnouncementAuthorProps, Props, State, DashboardLayout(), DashboardLayoutProps, ThemeToggle(), DeleteConfirmModal() (+114 more)

### Community 18 - "use-toast.ts"
Cohesion: 0.20
Nodes (13): Action, ActionType, actionTypes, addToRemoveQueue(), dispatch(), genId(), listeners, memoryState (+5 more)

### Community 19 - "pagination.tsx"
Cohesion: 0.18
Nodes (12): ButtonProps, buttonVariants, Calendar(), CalendarDayButton(), Pagination(), PaginationContent, PaginationEllipsis(), PaginationItem (+4 more)

### Community 20 - "dependencies"
Cohesion: 0.05
Nodes (37): bcryptjs, connect-sqlite3, cors, csrf-sync, express-rate-limit, express-session, helmet, multer (+29 more)

### Community 21 - "item.tsx"
Cohesion: 0.18
Nodes (12): Item(), ItemActions(), ItemContent(), ItemDescription(), ItemFooter(), ItemGroup(), ItemHeader(), ItemMedia() (+4 more)

### Community 23 - "context-menu.tsx"
Cohesion: 0.20
Nodes (9): ContextMenuCheckboxItem, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuRadioItem, ContextMenuSeparator, ContextMenuShortcut(), ContextMenuSubContent (+1 more)

### Community 24 - "command.tsx"
Cohesion: 0.20
Nodes (8): Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut()

### Community 25 - "QuizMaster Graphify Mimari Haritası"
Cohesion: 0.22
Nodes (9): Commit öncesi kontrol, Grafiği güncelleme, Grafiği sorgulama, Graphify kurulumu, Görsel haritayı açma, Güncellik kuralı, Neden diğer dosyalar paylaşılmıyor?, Paylaşılan çıktılar (+1 more)

### Community 27 - "input-group.tsx"
Cohesion: 0.28
Nodes (8): InputGroup(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton(), inputGroupButtonVariants, InputGroupInput(), InputGroupText(), InputGroupTextarea()

### Community 28 - "compilerOptions"
Cohesion: 0.22
Nodes (8): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include, vite.config.ts

### Community 29 - "server/package.json"
Cohesion: 0.22
Nodes (8): description, main, name, packageManager, prisma, seed, type, version

### Community 30 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, db:create-admin, db:deploy, db:generate, db:migrate, db:seed, db:status (+5 more)

### Community 31 - "form.tsx"
Cohesion: 0.18
Nodes (9): FormControl, FormDescription, FormFieldContext, FormFieldContextValue, FormItem, FormItemContext, FormItemContextValue, FormLabel (+1 more)

### Community 32 - "api-routes/auth.ts"
Cohesion: 0.18
Nodes (9): changePasswordSchema, forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, router, app, app (+1 more)

### Community 33 - "breadcrumb.tsx"
Cohesion: 0.25
Nodes (7): Breadcrumb, BreadcrumbEllipsis(), BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator()

### Community 34 - "drawer.tsx"
Cohesion: 0.25
Nodes (6): DrawerContent, DrawerDescription, DrawerFooter(), DrawerHeader(), DrawerOverlay, DrawerTitle

### Community 35 - "empty.tsx"
Cohesion: 0.29
Nodes (7): Empty(), EmptyContent(), EmptyDescription(), EmptyHeader(), EmptyMedia(), emptyMediaVariants, EmptyTitle()

### Community 36 - "navigation-menu.tsx"
Cohesion: 0.25
Nodes (7): NavigationMenu, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle, NavigationMenuViewport

### Community 37 - "toggle-group.tsx"
Cohesion: 0.33
Nodes (5): ToggleGroup, ToggleGroupContext, ToggleGroupItem, Toggle, toggleVariants

### Community 38 - "quiz.ts"
Cohesion: 0.13
Nodes (15): notifyAdminsAboutTeacherQuiz(), questionsArraySchema, questionSchema, quizSchema, router, answerSchema, quizActionLimiter, router (+7 more)

### Community 40 - "NotificationListener.tsx"
Cohesion: 0.53
Nodes (4): NotificationListener(), notificationApi, NotificationPage, prependNotification()

### Community 43 - "SQLite'tan PostgreSQL'e Geçiş Rehberi"
Cohesion: 0.13
Nodes (15): 10. Geçiş sonrası büyüme ve bakım, 11. Resmî başvuru kaynakları, 1. Mevcut uyumluluk durumu, 2. Geçişi başlatma ölçütleri, 3. Geçiş öncesi hazırlık, 4. PostgreSQL migration geçmişini oluşturma, 5. Verileri taşıma, 6. Oturum deposu (+7 more)

### Community 44 - "types.d.ts"
Cohesion: 0.50
Nodes (3): nanoid, vite, */vite.config

### Community 46 - "carousel.tsx"
Cohesion: 0.15
Nodes (12): Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext, CarouselOptions (+4 more)

### Community 48 - "useToast"
Cohesion: 0.18
Nodes (11): UnauthorizedRedirect(), ImageUpload(), ImageUploadProps, useToast(), uploadApi, ArchivePage(), AdminManagementPage(), AdminQuizzesPage() (+3 more)

### Community 58 - "dependencies"
Cohesion: 0.15
Nodes (13): class-variance-authority, dependencies, class-variance-authority, @hookform/resolvers, jspdf, @radix-ui/react-avatar, @radix-ui/react-toggle-group, wouter (+5 more)

### Community 60 - "survey.ts"
Cohesion: 0.15
Nodes (12): canAccessSurvey(), getAccessibleSurveys(), isAssignedToStudent(), resultQuerySchema, router, submissionSchema, surveyQuestionSchema, surveyWriteSchema (+4 more)

### Community 65 - "createExcelBytes"
Cohesion: 0.19
Nodes (11): columnName(), crc32(), createCsvBytes(), createCsvContent(), createExcelBytes(), CsvValue, downloadExcel(), quote() (+3 more)

### Community 84 - "email.ts"
Cohesion: 0.21
Nodes (14): hashResetToken(), issuePasswordReset(), originalEnv, original, getEmailConfiguration(), getEmailStatus(), getTransporter(), processEmailQueue() (+6 more)

### Community 85 - "QuizMaster Yönetici Kullanıcı Kılavuzu"
Cohesion: 0.13
Nodes (15): 10. Duyurular ve bildirimler, 11. Loglar, e-posta ve şifre talepleri, 12. Excel ve yazdırma, 13. Çevrimdışı sınav, 14. Sorun giderme, 1. Giriş ve güvenlik, 2. Yönetici menüsü, 3. Öğrenci yönetimi (+7 more)

### Community 97 - "QuizMaster Gmail E-Posta ve Parola Sıfırlama Kılavuzu"
Cohesion: 0.14
Nodes (14): 10. Sorun giderme tablosu, 11. Bakım notları, 1. Desteklenen servis, 2. Gmail hesabını hazırlama, 3. Ortam değişkenleri, 4. Parola sıfırlama işleyişi, 5. Outbox kuyruğu, 6. Yönetici işlemleri (+6 more)

### Community 99 - "QuizMaster"
Cohesion: 0.08
Nodes (24): 1. Bağımlılıkları kurun, 2. Ortam değişkenlerini hazırlayın, 3. Veritabanını hazırlayın, 4. Uygulamayı başlatın, Anket, E-posta ve parola sıfırlama, Excel ve yazdırma, Gereksinimler (+16 more)

### Community 100 - "QuizMaster Öğrenci Kullanıcı Kılavuzu"
Cohesion: 0.17
Nodes (12): 10. Hesap güvenliği, 11. Sorun giderme, 1. Kayıt ve giriş, 2. Öğrenci menüsü, 3. Sınavı başlatmadan önce, 4. Sınavı çözme ve teslim, 5. Anketlerim, 6. Sonuçlar ve istatistikler (+4 more)

### Community 101 - "QuizMaster Öğretmen Kullanıcı Kılavuzu"
Cohesion: 0.17
Nodes (12): 10. Çevrimdışı sınav, 11. Sorun giderme, 1. Giriş ve profil, 2. Öğretmen menüsü, 3. Sınav oluşturma, 4. Sınav yayını ve güvenlik, 5. Anket Yönetimi, 6. Sonuçlar ve sınıf istatistikleri (+4 more)

### Community 105 - "toast.tsx"
Cohesion: 0.24
Nodes (10): Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle, toastVariants (+2 more)

### Community 106 - "chart.tsx"
Cohesion: 0.12
Nodes (14): react, useCarousel(), ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartTooltipContent (+6 more)

### Community 107 - "QuizMaster Veli Kullanıcı Kılavuzu"
Cohesion: 0.25
Nodes (7): 1. Veli hesabının oluşturulması, 2. Giriş ve şifre, 3. Veli paneli, 4. Erişim sınırları, 5. Ayarlar ve bildirimler, 6. Sorun giderme, QuizMaster Veli Kullanıcı Kılavuzu

### Community 109 - "student-quiz.tsx"
Cohesion: 0.08
Nodes (45): AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay, AlertDialogTitle (+37 more)

### Community 111 - "SurveyResultsPage"
Cohesion: 0.50
Nodes (5): dateValue(), Distribution(), percent(), shorten(), SurveyResultsPage()

### Community 112 - "Q: uygulamayı önce incele tüm yönü. fronten backend api entegrasyonu login register ve güvenlik yönleri ile. kısaca bilgi ve sonra faz faz yapılacakalrı kritik önceliğine göre listele. kodlamaya başlama"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: uygulamayı önce incele tüm yönü. fronten backend api entegrasyonu login register ve güvenlik yönleri ile. kısaca bilgi ve sonra faz faz yapılacakalrı kritik önceliğine göre listele. kodlamaya başlama, Source Nodes

### Community 113 - "Q: bir öğrenci internet bağlantısı olmadığında sınavları çözebilecek mi ve uygulamada bu altyapı mevcut mu"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: bir öğrenci internet bağlantısı olmadığında sınavları çözebilecek mi ve uygulamada bu altyapı mevcut mu, Source Nodes

## Knowledge Gaps
- **563 isolated node(s):** `name`, `version`, `type`, `description`, `dev` (+558 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **70 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `utils.ts`, `App.tsx`, `field.tsx`, `menubar.tsx`, `api.ts`, `pagination.tsx`, `item.tsx`, `context-menu.tsx`, `command.tsx`, `input-group.tsx`, `form.tsx`, `breadcrumb.tsx`, `drawer.tsx`, `empty.tsx`, `navigation-menu.tsx`, `toggle-group.tsx`, `carousel.tsx`, `useToast`, `toast.tsx`, `chart.tsx`, `student-quiz.tsx`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `@radix-ui/react-tabs`, `@radix-ui/react-toast`, `react-day-picker`, `devDependencies`, `html2canvas`, `@radix-ui/react-tooltip`, `zod-validation-error`, `clsx`, `cmdk`, `date-fns`, `embla-carousel-react`, `framer-motion`, `input-otp`, `next-themes`, `@radix-ui/react-accordion`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-aspect-ratio`, `@radix-ui/react-checkbox`, `@radix-ui/react-context-menu`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-hover-card`, `@radix-ui/react-label`, `@radix-ui/react-menubar`, `@radix-ui/react-navigation-menu`, `@radix-ui/react-popover`, `@radix-ui/react-progress`, `@radix-ui/react-radio-group`, `@radix-ui/react-scroll-area`, `@radix-ui/react-select`, `@radix-ui/react-separator`, `@radix-ui/react-slider`, `@radix-ui/react-slot`, `@radix-ui/react-switch`, `@radix-ui/react-toggle`, `react-dom`, `react-hook-form`, `react-resizable-panels`, `recharts`, `socket.io-client`, `sonner`, `tailwind-merge`, `tailwindcss-animate`, `@tanstack/react-query`, `tw-animate-css`, `vaul`, `zod`, `chart.tsx`, `lucide-react`, `@radix-ui/react-collapsible`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Why does `react` connect `chart.tsx` to `useToast`, `dependencies`, `pagination.tsx`, `cn`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **What connects `name`, `version`, `type` to the rest of the system?**
  _563 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `routes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10572390572390572 - nodes in this community are weakly interconnected._
- **Should `IStorage` be split into smaller, more focused modules?**
  _Cohesion score 0.02127659574468085 - nodes in this community are weakly interconnected._
- **Should `PrismaStorage` be split into smaller, more focused modules?**
  _Cohesion score 0.022988505747126436 - nodes in this community are weakly interconnected._