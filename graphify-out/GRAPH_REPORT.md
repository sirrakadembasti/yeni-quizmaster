# Graph Report - Quiz-Master  (2026-09-24)

## Corpus Check
- 210 files · ~107,407 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1432 nodes · 3104 edges · 135 communities (66 shown, 69 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 44 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0a63b382`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- storage.ts
- routes.ts
- IStorage
- PrismaStorage
- student-quizzes.tsx
- cn
- index.ts
- utils.ts
- compilerOptions
- devDependencies
- devDependencies
- student-quiz.tsx
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
- carousel.tsx
- api-routes/auth.ts
- breadcrumb.tsx
- drawer.tsx
- empty.tsx
- navigation-menu.tsx
- sheet.tsx
- quiz.ts
- ErrorBoundary
- NotificationListener.tsx
- @prisma/client
- esbuild
- input-otp.tsx
- types.d.ts
- zod-validation-error
- @types/node
- typescript
- image-upload.tsx
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
- export.ts
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
- toggle-group.tsx
- QuizMaster Veli Kullanıcı Kılavuzu
- parent.ts
- auth-context.tsx
- Q: uygulamayı önce incele tüm yönü. fronten backend api entegrasyonu login register ve güvenlik yönleri ile. kısaca bilgi ve sonra faz faz yapılacakalrı kritik önceliğine göre listele. kodlamaya başlama
- Q: bir öğrenci internet bağlantısı olmadığında sınavları çözebilecek mi ve uygulamada bu altyapı mevcut mu
- lucide-react
- server/vitest.config.ts
- @radix-ui/react-collapsible
- @radix-ui/react-tabs
- @radix-ui/react-toast
- react-day-picker
- dotenv
- dotenv-cli
- @types/connect-sqlite3
- @types/nodemailer
- @types/supertest
- vitest

## God Nodes (most connected - your core abstractions)
1. `cn()` - 150 edges
2. `PrismaStorage` - 95 edges
3. `IStorage` - 92 edges
4. `Button` - 47 edges
5. `useToast()` - 41 edges
6. `useAuth()` - 40 edges
7. `storage` - 31 edges
8. `DashboardLayout()` - 30 edges
9. `Card` - 30 edges
10. `Badge()` - 28 edges

## Surprising Connections (you probably didn't know these)
- `RoleSwitcher()` --calls--> `useAuth()`  [EXTRACTED]
  client/src/components/layout/RoleSwitcher.tsx → client/src/context/auth-context.tsx
- `BreadcrumbSeparator()` --calls--> `cn()`  [EXTRACTED]
  client/src/components/ui/breadcrumb.tsx → client/src/lib/utils.ts
- `BreadcrumbEllipsis()` --calls--> `cn()`  [EXTRACTED]
  client/src/components/ui/breadcrumb.tsx → client/src/lib/utils.ts
- `ButtonGroupText()` --calls--> `cn()`  [EXTRACTED]
  client/src/components/ui/button-group.tsx → client/src/lib/utils.ts
- `ButtonGroupSeparator()` --calls--> `cn()`  [EXTRACTED]
  client/src/components/ui/button-group.tsx → client/src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (135 total, 69 thin omitted)

### Community 0 - "storage.ts"
Cohesion: 0.28
Nodes (6): router, hashResetToken(), issuePasswordReset(), prisma, storage, sendResetPasswordEmail()

### Community 1 - "routes.ts"
Cohesion: 0.12
Nodes (22): router, AIResponseSchema, aiTestLimiter, QuestionSchema, router, SurveyQuestionSchema, SurveyResponseSchema, querySchema (+14 more)

### Community 4 - "student-quizzes.tsx"
Cohesion: 0.27
Nodes (17): getOfflineQuizList(), getOfflineRemainingSeconds(), getOfflineSession(), markOfflineSubmit(), normalizeOfflineQuestions(), OfflineQuestion, OfflineQuizSession, readJson() (+9 more)

### Community 5 - "cn"
Cohesion: 0.09
Nodes (36): Kbd(), KbdGroup(), ResizableHandle(), ResizablePanelGroup(), SheetHeader(), Sidebar(), SidebarContent(), SidebarContext (+28 more)

### Community 6 - "index.ts"
Cohesion: 0.06
Nodes (34): express, registerRoutes(), router, upload, uploadStorage, app, authLimiter, httpLogger (+26 more)

### Community 7 - "utils.ts"
Cohesion: 0.08
Nodes (16): AccordionContent, AccordionItem, AccordionTrigger, Alert, AlertDescription, AlertTitle, alertVariants, Avatar (+8 more)

### Community 8 - "compilerOptions"
Cohesion: 0.07
Nodes (26): compilerOptions, allowImportingTsExtensions, allowJs, baseUrl, esModuleInterop, isolatedModules, jsx, lib (+18 more)

### Community 9 - "devDependencies"
Cohesion: 0.15
Nodes (13): cross-env, devDependencies, cross-env, supertest, tsx, @types/express, @types/express-session, @types/multer (+5 more)

### Community 10 - "devDependencies"
Cohesion: 0.04
Nodes (48): autoprefixer, baseline-browser-mapping, description, devDependencies, autoprefixer, baseline-browser-mapping, jsdom, postcss (+40 more)

### Community 11 - "student-quiz.tsx"
Cohesion: 0.26
Nodes (10): AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay, AlertDialogTitle (+2 more)

### Community 12 - "compilerOptions"
Cohesion: 0.08
Nodes (23): dist, node_modules, tests, **/*.ts, compilerOptions, allowJs, declaration, declarationMap (+15 more)

### Community 13 - "App.tsx"
Cohesion: 0.10
Nodes (37): ALL, HomeRoute(), Role, RouteConfig, RouteGuard(), Router(), ROUTES, UnauthorizedRedirect() (+29 more)

### Community 14 - "field.tsx"
Cohesion: 0.18
Nodes (11): Field(), FieldContent(), FieldDescription(), FieldError(), FieldGroup(), FieldLabel(), FieldLegend(), FieldSeparator() (+3 more)

### Community 15 - "package.json"
Cohesion: 0.11
Nodes (18): concurrently, devDependencies, concurrently, playwright, @playwright/test, name, packageManager, private (+10 more)

### Community 16 - "menubar.tsx"
Cohesion: 0.12
Nodes (11): Menubar, MenubarCheckboxItem, MenubarContent, MenubarItem, MenubarLabel, MenubarRadioItem, MenubarSeparator, MenubarShortcut() (+3 more)

### Community 17 - "api.ts"
Cohesion: 0.05
Nodes (125): AnnouncementAuthor(), AnnouncementAuthorProps, Props, State, DashboardLayout(), DashboardLayoutProps, RoleSwitcher(), ThemeToggle() (+117 more)

### Community 18 - "use-toast.ts"
Cohesion: 0.12
Nodes (23): Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle, toastVariants (+15 more)

### Community 19 - "pagination.tsx"
Cohesion: 0.18
Nodes (12): ButtonProps, buttonVariants, Calendar(), CalendarDayButton(), Pagination(), PaginationContent, PaginationEllipsis(), PaginationItem (+4 more)

### Community 20 - "dependencies"
Cohesion: 0.05
Nodes (37): bcryptjs, connect-sqlite3, cors, csrf-sync, express-rate-limit, express-session, helmet, multer (+29 more)

### Community 21 - "item.tsx"
Cohesion: 0.13
Nodes (17): ButtonGroup(), ButtonGroupSeparator(), ButtonGroupText(), buttonGroupVariants, Item(), ItemActions(), ItemContent(), ItemDescription() (+9 more)

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
Cohesion: 0.22
Nodes (9): scripts, build, db:generate, db:migrate, db:seed, dev, postinstall, start (+1 more)

### Community 31 - "carousel.tsx"
Cohesion: 0.05
Nodes (33): react, Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext (+25 more)

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

### Community 37 - "sheet.tsx"
Cohesion: 0.25
Nodes (7): SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetOverlay, SheetTitle, sheetVariants

### Community 38 - "quiz.ts"
Cohesion: 0.13
Nodes (16): router, notifyAdminsAboutTeacherQuiz(), questionsArraySchema, questionSchema, quizSchema, router, answerSchema, quizActionLimiter (+8 more)

### Community 43 - "input-otp.tsx"
Cohesion: 0.40
Nodes (4): InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot

### Community 44 - "types.d.ts"
Cohesion: 0.50
Nodes (3): nanoid, vite, */vite.config

### Community 48 - "image-upload.tsx"
Cohesion: 0.50
Nodes (3): ImageUpload(), ImageUploadProps, uploadApi

### Community 58 - "dependencies"
Cohesion: 0.15
Nodes (13): class-variance-authority, dependencies, class-variance-authority, @hookform/resolvers, jspdf, @radix-ui/react-avatar, @radix-ui/react-toggle-group, wouter (+5 more)

### Community 60 - "survey.ts"
Cohesion: 0.13
Nodes (15): classSchema, router, canAccessSurvey(), getAccessibleSurveys(), isAssignedToStudent(), resultQuerySchema, router, submissionSchema (+7 more)

### Community 65 - "export.ts"
Cohesion: 0.24
Nodes (14): columnName(), crc32(), createCsvBytes(), createCsvContent(), createExcelBytes(), CsvColumn, CsvExportOptions, CsvValue (+6 more)

### Community 84 - "email.ts"
Cohesion: 0.28
Nodes (11): originalEnv, original, getEmailConfiguration(), getEmailStatus(), getTransporter(), processEmailQueue(), queueEmail(), sendDirectEmail() (+3 more)

### Community 85 - "QuizMaster Yönetici Kullanıcı Kılavuzu"
Cohesion: 0.13
Nodes (15): 10. Duyurular ve bildirimler, 11. Loglar, e-posta ve şifre talepleri, 12. Excel ve yazdırma, 13. Çevrimdışı sınav, 14. Sorun giderme, 1. Giriş ve güvenlik, 2. Yönetici menüsü, 3. Öğrenci yönetimi (+7 more)

### Community 97 - "QuizMaster Gmail E-Posta ve Parola Sıfırlama Kılavuzu"
Cohesion: 0.14
Nodes (14): 10. Sorun giderme tablosu, 11. Bakım notları, 1. Desteklenen servis, 2. Gmail hesabını hazırlama, 3. Ortam değişkenleri, 4. Parola sıfırlama işleyişi, 5. Outbox kuyruğu, 6. Yönetici işlemleri (+6 more)

### Community 99 - "QuizMaster"
Cohesion: 0.09
Nodes (23): 1. Bağımlılıkları kurun, 2. Ortam değişkenlerini hazırlayın, 3. Veritabanını hazırlayın, 4. Uygulamayı başlatın, Anket, E-posta ve parola sıfırlama, Excel ve yazdırma, Gereksinimler (+15 more)

### Community 100 - "QuizMaster Öğrenci Kullanıcı Kılavuzu"
Cohesion: 0.17
Nodes (12): 10. Hesap güvenliği, 11. Sorun giderme, 1. Kayıt ve giriş, 2. Öğrenci menüsü, 3. Sınavı başlatmadan önce, 4. Sınavı çözme ve teslim, 5. Anketlerim, 6. Sonuçlar ve istatistikler (+4 more)

### Community 101 - "QuizMaster Öğretmen Kullanıcı Kılavuzu"
Cohesion: 0.17
Nodes (12): 10. Çevrimdışı sınav, 11. Sorun giderme, 1. Giriş ve profil, 2. Öğretmen menüsü, 3. Sınav oluşturma, 4. Sınav yayını ve güvenlik, 5. Anket Yönetimi, 6. Sonuçlar ve sınıf istatistikleri (+4 more)

### Community 106 - "toggle-group.tsx"
Cohesion: 0.33
Nodes (5): ToggleGroup, ToggleGroupContext, ToggleGroupItem, Toggle, toggleVariants

### Community 107 - "QuizMaster Veli Kullanıcı Kılavuzu"
Cohesion: 0.29
Nodes (7): 1. Veli hesabının oluşturulması, 2. Giriş ve şifre, 3. Veli paneli, 4. Erişim sınırları, 5. Ayarlar ve bildirimler, 6. Sorun giderme, QuizMaster Veli Kullanıcı Kılavuzu

### Community 108 - "parent.ts"
Cohesion: 0.33
Nodes (3): createParentSchema, linkSchema, router

### Community 109 - "auth-context.tsx"
Cohesion: 0.14
Nodes (18): AuthContext, AuthContextType, AuthProvider(), UserRole, apiFetch(), getCsrfToken(), ParentStudent, refreshCsrfToken() (+10 more)

### Community 112 - "Q: uygulamayı önce incele tüm yönü. fronten backend api entegrasyonu login register ve güvenlik yönleri ile. kısaca bilgi ve sonra faz faz yapılacakalrı kritik önceliğine göre listele. kodlamaya başlama"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: uygulamayı önce incele tüm yönü. fronten backend api entegrasyonu login register ve güvenlik yönleri ile. kısaca bilgi ve sonra faz faz yapılacakalrı kritik önceliğine göre listele. kodlamaya başlama, Source Nodes

### Community 113 - "Q: bir öğrenci internet bağlantısı olmadığında sınavları çözebilecek mi ve uygulamada bu altyapı mevcut mu"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: bir öğrenci internet bağlantısı olmadığında sınavları çözebilecek mi ve uygulamada bu altyapı mevcut mu, Source Nodes

## Knowledge Gaps
- **515 isolated node(s):** `name`, `version`, `type`, `description`, `dev` (+510 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **69 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `utils.ts`, `student-quiz.tsx`, `App.tsx`, `field.tsx`, `menubar.tsx`, `api.ts`, `use-toast.ts`, `pagination.tsx`, `item.tsx`, `context-menu.tsx`, `command.tsx`, `input-group.tsx`, `carousel.tsx`, `breadcrumb.tsx`, `drawer.tsx`, `empty.tsx`, `navigation-menu.tsx`, `sheet.tsx`, `input-otp.tsx`, `toggle-group.tsx`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `@radix-ui/react-tabs`, `@radix-ui/react-toast`, `react-day-picker`, `devDependencies`, `html2canvas`, `@radix-ui/react-tooltip`, `carousel.tsx`, `zod-validation-error`, `clsx`, `cmdk`, `date-fns`, `embla-carousel-react`, `framer-motion`, `input-otp`, `next-themes`, `@radix-ui/react-accordion`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-aspect-ratio`, `@radix-ui/react-checkbox`, `@radix-ui/react-context-menu`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-hover-card`, `@radix-ui/react-label`, `@radix-ui/react-menubar`, `@radix-ui/react-navigation-menu`, `@radix-ui/react-popover`, `@radix-ui/react-progress`, `@radix-ui/react-radio-group`, `@radix-ui/react-scroll-area`, `@radix-ui/react-select`, `@radix-ui/react-separator`, `@radix-ui/react-slider`, `@radix-ui/react-slot`, `@radix-ui/react-switch`, `@radix-ui/react-toggle`, `react-dom`, `react-hook-form`, `react-resizable-panels`, `recharts`, `socket.io-client`, `sonner`, `tailwind-merge`, `tailwindcss-animate`, `@tanstack/react-query`, `tw-animate-css`, `vaul`, `zod`, `lucide-react`, `@radix-ui/react-collapsible`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **Why does `react` connect `carousel.tsx` to `App.tsx`, `dependencies`, `pagination.tsx`, `cn`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **What connects `name`, `version`, `type` to the rest of the system?**
  _515 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `routes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11561561561561562 - nodes in this community are weakly interconnected._
- **Should `IStorage` be split into smaller, more focused modules?**
  _Cohesion score 0.02197802197802198 - nodes in this community are weakly interconnected._
- **Should `PrismaStorage` be split into smaller, more focused modules?**
  _Cohesion score 0.022222222222222223 - nodes in this community are weakly interconnected._