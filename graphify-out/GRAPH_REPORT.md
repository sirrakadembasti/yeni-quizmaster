# Graph Report - yeni-quizmaster-main  (2026-09-29)

## Corpus Check
- 236 files · ~128,975 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 3, .bat 2, .example 2)

## Summary
- 1680 nodes · 4978 edges · 73 communities (56 shown, 17 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 57 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d2fb55e1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- setup-bootstrap.mjs
- routes.ts
- IStorage
- PrismaStorage
- quiz.ts
- sidebar.tsx
- index.ts
- utils.ts
- compilerOptions
- devDependencies
- devDependencies
- QuizMaster Sunucu Kurulum Kılavuzu
- compilerOptions
- command.tsx
- item.tsx
- package.json
- menubar.tsx
- Button
- use-toast.ts
- pagination.tsx
- dependencies
- queryClient.ts
- field.tsx
- cn
- button.test.tsx
- QuizMaster Graphify Mimari Haritası
- input-group.tsx
- compilerOptions
- server/package.json
- scripts
- form.tsx
- ref_vitest
- drawer.tsx
- ai.ts
- navigation-menu.tsx
- server.ts
- survey.ts
- scripts
- NotificationListener.tsx
- App
- SQLite'tan PostgreSQL'e Geçiş Rehberi
- types.d.ts
- input-otp.tsx
- carousel.tsx
- client/vitest.config.ts
- api.ts
- collapsible.tsx
- @testing-library/jest-dom
- deployment.ts
- QuizMaster Veli Kullanıcı Kılavuzu
- dependencies
- export.ts
- email.ts
- QuizMaster Yönetici Kullanıcı Kılavuzu
- QuizMaster Gmail E-Posta ve Parola Sıfırlama Kılavuzu
- QuizMaster
- QuizMaster Öğrenci Kullanıcı Kılavuzu
- QuizMaster Öğretmen Kullanıcı Kılavuzu
- sw.js
- chart.tsx
- client/package.json
- backups/README.md
- kurulum.sh
- data/README.md
- class-variance-authority

## God Nodes (most connected - your core abstractions)
1. `cn()` - 285 edges
2. `Button` - 106 edges
3. `PrismaStorage` - 99 edges
4. `IStorage` - 96 edges
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

## Communities (73 total, 17 thin omitted)

### Community 0 - "setup-bootstrap.mjs"
Cohesion: 0.06
Nodes (54): holder, finder, scriptDir, appendLog(), authenticated(), authorizeMutation(), cookies(), csrfValue (+46 more)

### Community 1 - "routes.ts"
Cohesion: 0.11
Nodes (30): express, querySchema, router, categorySchema, router, classSchema, router, router (+22 more)

### Community 4 - "quiz.ts"
Cohesion: 0.19
Nodes (13): socket.io, router, notifyAdminsAboutTeacherQuiz(), questionsArraySchema, questionSchema, quizSchema, getIO(), setupSocket() (+5 more)

### Community 5 - "sidebar.tsx"
Cohesion: 0.06
Nodes (37): SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay, SheetTitle, sheetVariants (+29 more)

### Community 6 - "index.ts"
Cohesion: 0.06
Nodes (36): connect-sqlite3, cors, csrf-sync, helmet, pino-http, sharp, router, upload (+28 more)

### Community 7 - "utils.ts"
Cohesion: 0.10
Nodes (14): Calendar(), CalendarDayButton(), HoverCardContent, ScrollArea, ScrollBar, Slider, Spinner(), clsx (+6 more)

### Community 8 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, allowJs, baseUrl, esModuleInterop, isolatedModules, jsx, lib (+14 more)

### Community 9 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, cross-env, dotenv, dotenv-cli, esbuild, supertest, tsx, @types/connect-sqlite3 (+9 more)

### Community 10 - "devDependencies"
Cohesion: 0.11
Nodes (18): devDependencies, autoprefixer, baseline-browser-mapping, jsdom, postcss, tailwindcss, @tailwindcss/postcss, @tailwindcss/vite (+10 more)

### Community 11 - "QuizMaster Sunucu Kurulum Kılavuzu"
Cohesion: 0.09
Nodes (22): 10. Nginx — subdomain, 11. Nginx — alt yol, 12. IIS reverse proxy özeti, 13. Bootstrap ve tek kullanımlık web kurulum sihirbazı, 14. Log saklama ve veritabanı büyümesi, 15. Yedekleme, 16. İlk canlı kontrol listesi, 17. Güncelleme ve geri dönüş (+14 more)

### Community 12 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, lib, module (+10 more)

### Community 13 - "command.tsx"
Cohesion: 0.18
Nodes (11): Command, CommandDialog(), CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator (+3 more)

### Community 14 - "item.tsx"
Cohesion: 0.08
Nodes (27): Breadcrumb, BreadcrumbEllipsis(), BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator(), ButtonGroup() (+19 more)

### Community 15 - "package.json"
Cohesion: 0.08
Nodes (19): devDependencies, concurrently, playwright, @playwright/test, name, packageManager, private, scripts (+11 more)

### Community 16 - "menubar.tsx"
Cohesion: 0.11
Nodes (12): Menubar, MenubarCheckboxItem, MenubarContent, MenubarItem, MenubarLabel, MenubarRadioItem, MenubarSeparator, MenubarShortcut() (+4 more)

### Community 17 - "Button"
Cohesion: 0.07
Nodes (162): ALL, AppRouter(), HomeRoute(), RedirectToAuth(), Role, RouteConfig, RouteGuard(), ROUTES (+154 more)

### Community 18 - "use-toast.ts"
Cohesion: 0.12
Nodes (24): Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle, toastVariants (+16 more)

### Community 19 - "pagination.tsx"
Cohesion: 0.24
Nodes (9): ButtonProps, Pagination(), PaginationContent, PaginationEllipsis(), PaginationItem, PaginationLink(), PaginationLinkProps, PaginationNext() (+1 more)

### Community 20 - "dependencies"
Cohesion: 0.10
Nodes (21): dependencies, bcryptjs, connect-sqlite3, cors, csrf-sync, express, express-rate-limit, express-session (+13 more)

### Community 21 - "queryClient.ts"
Cohesion: 0.60
Nodes (4): apiRequest(), getQueryFn(), throwIfResNotOk(), UnauthorizedBehavior

### Community 22 - "field.tsx"
Cohesion: 0.18
Nodes (11): Field(), FieldContent(), FieldDescription(), FieldError(), FieldGroup(), FieldLabel(), FieldLegend(), FieldSeparator() (+3 more)

### Community 23 - "cn"
Cohesion: 0.07
Nodes (43): AccordionContent, AccordionItem, AccordionTrigger, Avatar, AvatarFallback, AvatarImage, ContextMenuCheckboxItem, ContextMenuContent (+35 more)

### Community 25 - "QuizMaster Graphify Mimari Haritası"
Cohesion: 0.20
Nodes (9): Commit öncesi kontrol, Grafiği güncelleme, Grafiği sorgulama, Graphify kurulumu, Görsel haritayı açma, Güncellik kuralı, Neden diğer dosyalar paylaşılmıyor?, Paylaşılan çıktılar (+1 more)

### Community 27 - "input-group.tsx"
Cohesion: 0.28
Nodes (8): InputGroup(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton(), inputGroupButtonVariants, InputGroupInput(), InputGroupText(), InputGroupTextarea()

### Community 28 - "compilerOptions"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 29 - "server/package.json"
Cohesion: 0.05
Nodes (34): cross-env, dotenv, dotenv-cli, esbuild, multer, nodemailer, pino, pino-pretty (+26 more)

### Community 30 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, db:create-admin, db:deploy, db:generate, db:migrate, db:seed, db:status (+6 more)

### Community 31 - "form.tsx"
Cohesion: 0.19
Nodes (12): FormControl, FormDescription, FormFieldContext, FormFieldContextValue, FormItem, FormItemContext, FormItemContextValue, FormLabel (+4 more)

### Community 32 - "ref_vitest"
Cohesion: 0.09
Nodes (17): bcryptjs, express-session, supertest, changePasswordSchema, forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema (+9 more)

### Community 34 - "drawer.tsx"
Cohesion: 0.25
Nodes (7): DrawerContent, DrawerDescription, DrawerFooter(), DrawerHeader(), DrawerOverlay, DrawerTitle, vaul

### Community 35 - "ai.ts"
Cohesion: 0.18
Nodes (7): express-rate-limit, AIResponseSchema, aiTestLimiter, QuestionSchema, router, SurveyQuestionSchema, SurveyResponseSchema

### Community 36 - "navigation-menu.tsx"
Cohesion: 0.28
Nodes (8): NavigationMenu, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle, NavigationMenuViewport, @radix-ui/react-navigation-menu

### Community 37 - "server.ts"
Cohesion: 0.08
Nodes (37): buildServerEnv(), envValue(), gmailAddress, publicAppUrl(), SetupPayload, setupPayloadSchema, toDeploymentConfig(), APPLY_STEPS (+29 more)

### Community 38 - "survey.ts"
Cohesion: 0.15
Nodes (13): canAccessSurvey(), getAccessibleSurveys(), isAssignedToStudent(), resultQuerySchema, router, submissionSchema, surveyQuestionSchema, surveyWriteSchema (+5 more)

### Community 39 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, preview, test, test:coverage, test:ui, type-check

### Community 40 - "NotificationListener.tsx"
Cohesion: 0.24
Nodes (7): NotificationListener(), ToasterProps, NotificationPage, prependNotification(), next-themes, socket.io-client, sonner

### Community 42 - "App"
Cohesion: 0.29
Nodes (3): App(), ErrorBoundary, react-dom

### Community 43 - "SQLite'tan PostgreSQL'e Geçiş Rehberi"
Cohesion: 0.15
Nodes (13): 10. Geçiş sonrası büyüme ve bakım, 11. Resmî başvuru kaynakları, 1. Mevcut uyumluluk durumu, 2. Geçişi başlatma ölçütleri, 3. Geçiş öncesi hazırlık, 4. PostgreSQL migration geçmişini oluşturma, 6. Oturum deposu, 7. JSON alanları için ikinci aşama (+5 more)

### Community 44 - "types.d.ts"
Cohesion: 0.50
Nodes (3): nanoid, vite, */vite.config

### Community 45 - "input-otp.tsx"
Cohesion: 0.33
Nodes (5): InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot, input-otp

### Community 46 - "carousel.tsx"
Cohesion: 0.17
Nodes (14): Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext, CarouselOptions (+6 more)

### Community 47 - "client/vitest.config.ts"
Cohesion: 0.33
Nodes (4): origLookup, @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 48 - "api.ts"
Cohesion: 0.05
Nodes (65): AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay, AlertDialogTitle (+57 more)

### Community 52 - "deployment.ts"
Cohesion: 0.17
Nodes (15): requireRuntimeChanges(), router, runtimeDeploymentChangesAllowed(), retentionCutoffs(), RetentionPolicy, runDataRetention(), startDataRetentionWorker(), defaultRetention (+7 more)

### Community 54 - "QuizMaster Veli Kullanıcı Kılavuzu"
Cohesion: 0.25
Nodes (7): 1. Veli hesabının oluşturulması, 2. Giriş ve şifre, 3. Veli paneli, 4. Erişim sınırları, 5. Ayarlar ve bildirimler, 6. Sorun giderme, QuizMaster Veli Kullanıcı Kılavuzu

### Community 58 - "dependencies"
Cohesion: 0.04
Nodes (56): dependencies, class-variance-authority, clsx, cmdk, date-fns, embla-carousel-react, framer-motion, @hookform/resolvers (+48 more)

### Community 65 - "export.ts"
Cohesion: 0.21
Nodes (14): columnName(), crc32(), createCsvBytes(), createCsvContent(), createExcelBytes(), CsvColumn, CsvExportOptions, CsvValue (+6 more)

### Community 84 - "email.ts"
Cohesion: 0.19
Nodes (16): router, hashResetToken(), issuePasswordReset(), originalEnv, original, getEmailConfiguration(), getEmailStatus(), getTransporter() (+8 more)

### Community 85 - "QuizMaster Yönetici Kullanıcı Kılavuzu"
Cohesion: 0.12
Nodes (16): 10. Duyurular ve bildirimler, 11. Loglar, e-posta ve şifre talepleri, 12. Excel ve yazdırma, 13. Çevrimdışı sınav, 14. Sorun giderme, 1. Giriş ve güvenlik, 2. Yönetici menüsü, 3. Öğrenci yönetimi (+8 more)

### Community 97 - "QuizMaster Gmail E-Posta ve Parola Sıfırlama Kılavuzu"
Cohesion: 0.14
Nodes (14): 10. Sorun giderme tablosu, 11. Bakım notları, 1. Desteklenen servis, 2. Gmail hesabını hazırlama, 3. Ortam değişkenleri, 4. Parola sıfırlama işleyişi, 5. Outbox kuyruğu, 6. Yönetici işlemleri (+6 more)

### Community 99 - "QuizMaster"
Cohesion: 0.06
Nodes (33): 1. Depoyu indirin, 1. Sunucuyu hazırlayın ve depoyu indirin, 2. Güvenli ön kontrolü ve bootstrap ekranını başlatın, 2. Kurulum başlatıcısını çalıştırın, 3. Grafik kurulum akışını tamamlayın, 3. Sihirbaz adımlarını tamamlayın, 4. Uygulamayı başlatın, 4. Uygulamayı servis olarak çalıştırın (+25 more)

### Community 100 - "QuizMaster Öğrenci Kullanıcı Kılavuzu"
Cohesion: 0.17
Nodes (12): 10. Hesap güvenliği, 11. Sorun giderme, 1. Kayıt ve giriş, 2. Öğrenci menüsü, 3. Sınavı başlatmadan önce, 4. Sınavı çözme ve teslim, 5. Anketlerim, 6. Sonuçlar ve istatistikler (+4 more)

### Community 101 - "QuizMaster Öğretmen Kullanıcı Kılavuzu"
Cohesion: 0.15
Nodes (12): 10. Çevrimdışı sınav, 11. Sorun giderme, 1. Giriş ve profil, 2. Öğretmen menüsü, 3. Sınav oluşturma, 4. Sınav yayını ve güvenlik, 5. Anket Yönetimi, 6. Sonuçlar ve sınıf istatistikleri (+4 more)

### Community 106 - "chart.tsx"
Cohesion: 0.27
Nodes (10): ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartStyle(), ChartTooltipContent, getPayloadConfigFromPayload() (+2 more)

### Community 120 - "client/package.json"
Cohesion: 0.06
Nodes (33): description, @types/node, typescript, vitest, zod, zod-validation-error, name, packageManager (+25 more)

### Community 143 - "class-variance-authority"
Cohesion: 0.18
Nodes (12): Alert, AlertDescription, AlertTitle, alertVariants, ToggleGroup, ToggleGroupContext, ToggleGroupItem, Toggle (+4 more)

## Knowledge Gaps
- **540 isolated node(s):** `name`, `version`, `type`, `description`, `dev` (+535 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 798 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `drawer.tsx`, `navigation-menu.tsx`, `sidebar.tsx`, `utils.ts`, `chart.tsx`, `command.tsx`, `item.tsx`, `class-variance-authority`, `api.ts`, `Button`, `carousel.tsx`, `input-otp.tsx`, `menubar.tsx`, `pagination.tsx`, `field.tsx`, `use-toast.ts`, `input-group.tsx`, `form.tsx`?**
  _High betweenness centrality (0.218) - this node is a cross-community bridge._
- **Why does `SQLite'tan PostgreSQL'e Geçiş Rehberi` connect `SQLite'tan PostgreSQL'e Geçiş Rehberi` to `api.ts`, `README.md`?**
  _High betweenness centrality (0.144) - this node is a cross-community bridge._
- **What connects `name`, `version`, `type` to the rest of the system?**
  _540 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `setup-bootstrap.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.06237424547283702 - nodes in this community are weakly interconnected._
- **Should `routes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10885341074020319 - nodes in this community are weakly interconnected._
- **Should `IStorage` be split into smaller, more focused modules?**
  _Cohesion score 0.021052631578947368 - nodes in this community are weakly interconnected._
- **Should `PrismaStorage` be split into smaller, more focused modules?**
  _Cohesion score 0.02197802197802198 - nodes in this community are weakly interconnected._