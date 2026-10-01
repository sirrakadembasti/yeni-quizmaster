# Admin audit: route inventory, management, settings, server, archive, announcements

> **Historical audit snapshot (30 September 2026).** Findings, source line references and open-status statements below describe the original audit and earlier repair notes, not the current tree. See [repair contracts](./repair-contracts.md) for the accepted behavior and [remaining repairs verification](./remaining-repairs-verification.md) for the current evidence and limitations. Current confirmed client result: 19 files, 117/117 tests. The server thread run hit a Prisma native Tokio panic; its fork rerun is in progress. New E2E checks have not run. The teacher-panel audit has not started.

Date: 2026-09-30. Method: read-only source review of the current working tree. This document does not claim browser execution or database mutation. Existing changes to `client/src/lib/api.ts` and `client/src/pages/server-setup.tsx` were inspected but preserved. No AGENTS.md was found at the repository/client/src/pages/docs ancestor locations checked.

## Complete admin route inventory

Registry: `client/src/App.tsx:82-127`. Sidebar: `client/src/components/layout/DashboardLayout.tsx:120-153`.

| Admin sidebar label | Route | Admin access |
|---|---|---|
| Dashboard | `/` | Authenticated home renders DashboardPage |
| Sınav Yönetimi | `/admin-quizzes` | Admin only |
| Sınavlar | `/quizzes` | Teacher + admin |
| Sınıf İstatistikleri | `/statistics` | Teacher + admin |
| Sınav Sonuçları | `/results` | Teacher + admin |
| Anket Yönetimi | `/survey-results` | Teacher + admin |
| Öğrenciler | `/students` | Teacher + admin |
| Öğretmenler | `/teachers` | Admin only |
| Veli Eşleştirme | `/guardian-management` | Admin only |
| Sınıflar | `/classlist` | Teacher + admin |
| Yönetim | `/management` | Admin only |
| Arşiv | `/archive` | Admin only |
| Sunucu Durumu | `/server-setup` | Admin only |
| Duyurular | `/announcements` | All authenticated roles |
| Ayarlar | `/settings` | All authenticated roles |

Additional admin-accessible routes needing coverage: `/create-quiz`, `/quizzes/:id`, `/classes/:id`, `/admin/classes/:id`, `/teachers/:id`, `/student/quiz/:quizId`, `/student/result/:resultId`, `/student/results`. Public `/auth` redirects an authenticated admin to `/`; `/reset-password` remains public. Legacy `/student-quizzes/:quizId` redirects to `/student/quiz/:quizId`. Student/parent-only routes are deliberately outside admin scope.

## Tab inventory

| Page | Tabs / nested tabs | Source |
|---|---|---|
| Yönetim | Dersler (`categories`), Sınıflar (`classes`), Kullanıcılar (`users`), Loglar (`logs`) | admin-management.tsx:395-398 |
| Yönetim / Kullanıcılar | Tümü, Yöneticiler, Öğretmenler, Öğrenciler, Veliler | admin-management.tsx:548-552 |
| Yönetim / Loglar | Kullanıcı Logları, E-Posta Logları, Şifre Talepleri, Sistem Hata & İşlemleri (button-controlled subviews) | admin-management.tsx:624-657 |
| Ayarlar | Profil, Bildirimler, İşlem Geçmişi, Güvenlik | settings.tsx:223-234 |
| Arşiv | Sınav Arşivi, Sınıf Atlatma | admin/archive.tsx:108-109 |
| Sınav Sonuçları | Genel Bakış (`overview`), Raporlar (`reports`, conditional) | results.tsx:265-271 |
| Sınav oluştur/düzenle | Sınav Ayarları (`settings`), Sorular (`questions`) | create-quiz.tsx:347-354 |
| Anket Yönetimi | Sonuçlar, Anket Oluştur | survey-results.tsx:283-284 |
| Öğrenci sonuçları (admin-accessible) | Sınavlar (`exams`), Öğrenci (`student`), Veli (`parent`) | student-results.tsx:411-419 |

Announcements and server status have cards/forms rather than tabs. Dashboard, teacher, class, people and quiz findings belong to companion audit reports.

## Confirmed code defects and acceptance criteria

### INV-01 — P2: successful profile save leaves admin identity stale

Evidence: `settings.tsx:171-174` calls `authApi.updateProfile(formData)` then invalidates `['/api/auth/me']`. `auth-context.tsx:22-24` stores user in React state; its initial fetch at `auth-context.tsx:43-45` runs only on mount. The context exposes login/register/logout, no refresh/updateUser and no React Query subscription (`auth-context.tsx:9-18`, `:108-118`). `settings.tsx:139-159` refills form and computes dirty state from that unchanged user.

Reproduction in disposable data: change an admin profile name, save successfully, inspect header and save-button dirty state, navigate away and back. The header/context retains the old name, save remains dirty, and revisiting can restore old values despite persisted server data. Full reload masks the issue.

Acceptance: returned/refetched user updates auth context immediately; header and profile fields show the persisted name, dirty state clears, navigation retains it, and offline user cache is synchronized.

### INV-02 — P2: management log history silently stops at the first page

Evidence: `admin-management.tsx:158-198` supplies filters without page/limit to user, email, reset and system log queries; renderers map the returned arrays with no next/previous controls (`:731`, `:794`, `:902`, `:1022`). APIs support pagination but default to 100 user/email/system entries (`server/api-routes/admin.ts:133`, `:158`, `:237`) and 50 reset requests (`:73-75`). The response includes totalPages, which the page ignores. Counts are displayed as the current array length.

Reproduction: use a fixture with 101 matching log rows or 51 reset requests; select All Time and a filter matching all. The older row cannot be reached without narrowing the filter/API access. Shared date filter also does not affect password reset requests (`admin-management.tsx:183-186`), despite being displayed above all log subviews (`:666-684`).

Acceptance: pagination or load-more exposes all matching rows, shows total/page information and resets page on filter changes; date filtering is supported consistently or hidden for reset requests.

### INV-03 — P2: archive history hard-capped at 20

Evidence: `client/src/pages/admin/archive.tsx:189` applies `.slice(0, 20)` to archived quizzes. No search, academic-year filter, pagination or detail link exists. The summary can report more archived quizzes than the table makes reachable.

Reproduction: fixture with 21 archived quizzes; row 21 is absent and cannot be reached.

Acceptance: every archived quiz is discoverable through paging/year/search; visible count and total are distinguished; link to read-only details is available where intended.

### INV-04 — P1: archive batch can partially commit

Evidence: `server/storage.ts:1456-1465` performs quiz updateMany then results updateMany outside a transaction. If the second write fails, quizzes are archived while results retain null academicYear; API reports failure (`server/api-routes/admin.ts:278-291`). This is a confirmed non-atomic code path; no real database failure was injected.

Acceptance: both updates and essential audit record execute atomically, or recovery/idempotency is explicit; a test injecting the result-update failure verifies no partial archive remains.

### INV-05 — P2: archive preview and mutation select different data

Evidence: UI active count uses `status !== 'archived'` (`admin/archive.tsx:42`) and says all active exams will be locked (`:129`, `:279`). Storage selects `academicYear: null` (`server/storage.ts:1458`) without status filter. A nonarchived quiz with an academicYear is counted but unchanged; an archived quiz with null academicYear is included in the mutation despite being excluded from the count. This is conditional on such records existing; not a claim about current data.

Acceptance: server provides exact candidate counts using the same selection as the mutation and the confirmation uses them; status/year invariant is enforced or migration repairs inconsistent historical rows.

### INV-06 — P2: announcement deletion is immediate and errors are silent

Evidence: `announcements.tsx:154` calls deleteMutation directly from the trash icon; deletion mutation (`:91-97`) handles success only, with no confirmation, pending guard, rollback/undo or onError. API deletion is permanent (`server/api-routes/announcement.ts:103-110`).

Reproduction without mutation: inspect trash handler and missing confirmation; in a disposable fixture, cancel a hypothetical delete is impossible. For failure UX, block the DELETE request: row remains but no error/retry message is provided.

Acceptance: confirmation names the announcement and supports cancel; mutation disables repeat submission; failure shows actionable error; successful deletion updates the list. An undo mechanism may replace confirmation if backend supports it.

### INV-07 — P2: request failures are presented as empty/default content

Evidence: announcements destructures only data/isLoading (`announcements.tsx:64-67`) then defaults to an empty list (`:99`) and renders 'Henüz bir duyuru...' (`:137-144`). Archive queries (`admin/archive.tsx:29-40`) default to empty arrays and show zero counts without error state; archiving is still offered. Management log renderers similarly have only loading/empty branches. Server status uses an example emptyConfig (`server-setup.tsx:15-28`, `:63-64`), `changesAllowed=false` and empty detected cards on a failed initial status GET, without isError UI.

Reproduction: block the corresponding GET and wait for retries. An outage appears to be zero records/default configuration rather than a load failure. Current source does not distinguish an actual read-only server policy from a failed status fetch.

Acceptance: explicit loading/error/empty/success states; retry control and useful error text; destructive archive remains disabled until authoritative candidates are loaded; sample values are not presented as detected configuration.

### INV-08 — P2: server refresh can discard unsaved edits; retention runs saved policy rather than displayed draft

Evidence: status-data effect overwrites form and origins on each updated query result (`server-setup.tsx:72-76`); manual refetch at `:135` has no dirty guard. The retention button is enabled from local `form.retention.enabled` (`:203`) but `runRetention` sends no draft (`:117-123`); `server/api-routes/deployment.ts` calls runDataRetention using saved configuration. Displayed unsaved days can differ from the actual deletion policy; toggling enabled locally on a disabled saved policy produces 409.

Reproduction in read-only review: edit a field, click Sunucuyu Yeniden Algıla; values are replaced on fetch success. In a disposable environment with runtime changes enabled, edit retention days without saving then inspect the run POST: displayed values are not sent.

Acceptance: keep dirty edits or warn before refresh; 'Şimdi Temizle' requires saved, unchanged policy and confirmation displays persisted thresholds; successful execution displays per-record deletion counts.

### INV-09 — P2: server/header notification toast calls have no mounted renderer

Evidence: `server-setup.tsx:13` and `DashboardLayout.tsx:53` import toast from `sonner`; server copy/save/run handlers call toast.success/error (`server-setup.tsx:49`, `:81-90`, `:99-119`). `NotificationListener.tsx:4` also uses Sonner. `App.tsx:5` imports the different Radix renderer from `components/ui/toaster` and mounts it at `:255`. `main.tsx:7-11` renders only App. A full client-source scan found `components/ui/sonner.tsx` defining Sonner's renderer but no import/mount of that component. Consequently Sonner events do not have a visible toast host. This can obscure server validation and request failures as well as realtime notification feedback.

Acceptance: mount the Sonner renderer or consolidate all callers on the active toast mechanism; verify visible success and failure messages for copy, validation, failed status mutation, notification mute/delete failure and realtime announcement receipt.

### INV-10 — P2: personal settings history contradicts its six-month completeness claim

Evidence: `settings.tsx:78-88` fetches getLogsMe without pagination and locally filters the returned rows to six months. `server/api-routes/admin.ts:14-25` defaults to the newest 50 entries and returns pagination; `api.ts:1033-1037` discards the pagination contract. `settings.tsx:523` promises all system actions in the last six months, but has no next-page controls. This differs from INV-02 because the personal page fetches and filters only 50 records, regardless of the six-month interval.

Acceptance: fetch the actual six-month range server-side with pagination; allow every matching row to be reached and display total/page information. A fixture with 51 actions in six months must expose the oldest action.

## Additional risks requiring targeted verification

- Promotion sends no academicYear (`api.ts:1048-1053`) while backend supports stamping completed results before class changes (`storage.ts:1478-1479`). Verify whether archive-before-promotion is an enforced business requirement; otherwise historical results may appear under the new class. Do not promote real students during audit.
- Promotion and archive confirmation buttons are not disabled when their mutations are pending (`admin/archive.tsx:284`, `:317-320`); repeated archive requests can create duplicate audit logs, repeated promotion commonly reports zero the second time. Verify click/failure behavior in disposable fixtures.
- Labels frequently omit htmlFor and inputs lack ids in archive/server/announcement forms; icon-only category edit/delete and user edit/delete buttons lack accessible names (`admin-management.tsx:444-447`, `:600-603`). Verify accessible names with browser DOM and keyboard/screen-reader checks. Confirm-before-delete exists for management categories/classes/users.
- `settings.tsx:135-138` accepts any query-string `tab` value without allowlist. `/settings?tab=unknown` activates no panel. Acceptance: unsupported tab falls back to profile; valid deep links open the requested tab and back/forward behavior is consistent.
- Subtabs in management logs are regular buttons; verify mobile horizontal overflow and focus order, particularly four buttons plus date filter.
- Announcement targets allow all/teacher/student but no dedicated parent option (`announcements.tsx:237-239`) although parent is supported by backend read policy. This is a product-scope question, not a proven defect; decide whether administrators need parent-only announcements.

## Read-only browser checklist

Status values: SOURCE = inspected in source, LIVE = browser executed by main audit, MUTATION = requires isolated fixture/explicit operational authorization. This subreport sets SOURCE only; no mutation was performed.

| Route/view | Read-only checks and action inventory | Status |
|---|---|---|
| Global sidebar/header | 15 admin links, active item, browser back, mobile drawer, theme, notifications popover/read/mute/delete, account menu/settings/logout | SOURCE |
| /management / Dersler | Load/empty/error, list counts; open/cancel create and edit; required name, description; open/cancel delete; print/refresh | SOURCE; commit/delete MUTATION |
| /management / Sınıflar | Cards and count; click detail; menu edit/detail/delete; open/cancel form; level/section/teacher/description; no-teacher choice | SOURCE; save/delete MUTATION |
| /management / Kullanıcılar | Each of five role tabs, counts and empty state; create/edit/delete dialogs; required fields/parent phone-address; guardian-link navigation | SOURCE; save/delete MUTATION |
| /management / Kullanıcı Logları | Date all/year/30 days/year; role all/admin/teacher/student/parent; action search; row content/date; 101-record completeness | SOURCE |
| /management / E-Posta Logları | Date/status/search/count badges; refresh/5s polling; open body/details; pending/sent/failed; resend/delete affordances, email-view close | SOURCE; resend/delete MUTATION |
| /management / Şifre Talepleri | Status/search/counts; 5s polling; email input; pending/completed/cancelled/expired; renew/cancel availability; date consistency and 51-row completeness | SOURCE; send/renew/cancel MUTATION |
| /management / Sistem Hata & İşlemleri | Date/search, JSON/detail readability, severity, loading/empty/error, 101-row completeness | SOURCE |
| /settings / Profil | Existing name/email/phone/address, dirty-state button, form validation, profile summary, print | SOURCE; save MUTATION |
| /settings / Bildirimler | Read/unread styles, all-read, mute switch, delete icon, 20/page previous-next/count; empty/error; nav-popover coherence | SOURCE; mark/mute/delete MUTATION |
| /settings / İşlem Geçmişi | Six-month wording, 50-row API cap vs displayed completeness, action/details/dates, error vs empty | SOURCE |
| /settings / Güvenlik | Current/new/confirm password, show/hide if present, mismatch, minimum length, pending, cleared fields on success | SOURCE; password change MUTATION |
| /archive / Sınav Arşivi | Counts, year label, whitespace/short year validation, confirmation content/cancel, 21-row completeness | SOURCE; archive MUTATION |
| /archive / Sınıf Atlatma | Source counts/loading, destination excludes source, graduate option, level warning, confirmation/cancel, source change after destination selection | SOURCE; promotion MUTATION |
| /server-setup | Status GET and refresh; policy-source read-only message; four health badges; detected summary; mode/url/origin/proxy validation; pending-restart text; retention fields; template copy; failed fetch | SOURCE; profile save/retention MUTATION |
| /announcements | Listing/author/date/role/class badges, print, create dialog/cancel, uppercase Turkish title, content, audience/class choices, validation/pending/error, trash accessible label | SOURCE; publish/delete MUTATION |

Cross-cutting acceptance for every listed view: usable at desktop and 390px mobile without clipped primary actions; keyboard focus visible and dialogs trap/restore focus; loading/error/empty distinguishable; search and filters retain consistent counts; print output omits navigation and includes the currently intended content. Browser evidence must supplement these source findings before marking LIVE/pass.


## Browser verification addendum — 2026-09-30

### INV-11 — P2: unknown settings tab leaves no active panel

Status: real Chromium E2E reproduced. `GET /settings?tab=unknown` after admin login; expected profile tab fallback, actual page has no `tabpanel`. Evidence: `docs/admin-audit/results-route-initial.json` and `docs/admin-audit/evidence/settings-unknown-tab.png`. Impact: a mistyped/shared deep link opens a blank settings body. Fix: validate query `tab` against profile/notifications/logs/security, normalize invalid values to profile. Acceptance: invalid tab activates profile and history navigation retains valid tabs.

### INV-12 — P2: mobile navigation does not close on Escape

Status: real Chromium E2E and 390px UI observation. Open mobile menu with Menüyü aç, press Escape. Expected overlay closes and focus returns to trigger; actual Menüyü kapat backdrop remains visible after 20 seconds. Evidence: `docs/admin-audit/results-route-initial.json` and `docs/admin-audit/evidence/live-mobile-after-escape.png`. Fix: modal drawer semantics, Escape handler and focus return/trap. Acceptance: Escape closes drawer, focus returns to menu button, Tab cycles only relevant controls while open.

### INV-13 — P2: malformed deployment URL returns HTTP 500

Status: real isolated browser/API E2E. On /server-setup, type `not-an-origin` in public URL and click Profili Kaydet. Expected HTTP 400 with field issue and visible validation message; actual HTTP 500. `server/utils/deployment-config.ts` superRefine calls `new URL(value.publicUrl)` for localhost without guarding a value already rejected by originSchema; route catches it as server failure. Evidence: `docs/admin-audit/flow-failures/admin-audit-system-flows-d-063f6-r-instead-of-silent-failure/error-context.md` and later targeted result. Fix: guard URL construction inside superRefine, return Zod field issue; mount the toast renderer for visible error. Acceptance: malformed input gives 400, no config written, field-specific visible message, form remains editable.
