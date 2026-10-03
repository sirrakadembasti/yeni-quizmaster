# Admin accessibility closure coverage

Prepared 2026-10-01. The suite is `tests-e2e/admin-accessibility-closure.spec.ts`.
**Final production browser verification: 53/53 passed**, exit 0, with no skipped
or flaky cases. The run started **2026-10-01 at 17:18:02 UTC** and completed in
650.37 seconds (10.84 minutes). Raw proof: `results-accessibility-final.json`;
preserved artifacts: `test-results-accessibility-final/`.

The initial complete 53-test browser run recorded 47 passed and 6 failed.
Its raw result and artifacts are preserved as `results-accessibility-full-initial.json`
and `test-results-accessibility-full-initial`. The six failures reproduced three
defects on desktop and mobile. The final production browser recheck after the
repairs below passed all 53 cases. Unit results remain separate supporting evidence.

## Run scope

Run the browser suite through the audit configuration:

```powershell
pnpm exec playwright test --config playwright.admin-audit.config.ts admin-accessibility-closure.spec.ts
```

The suite requires the recorded disposable runtime, backend 5510 and production
preview 5511, and rejects other base URLs or database paths. It logs in using the
audit admin fixture. It opens and cancels dialogs, navigates tabs and menus, and
opens/closes a results selector; it never submits forms, deletes data, changes
notification preferences, or changes deployment configuration. Login can create
session/audit records in the disposable database.

Coverage: 23 routes at 1440x900 and 390x844; initial and reachable tab states;
computed ARIA snapshots attached to the Playwright report; computed accessible
names for exposed controls, including password fields; meaningful profile labels;
actual Tab reachability; settings arrow/Home/End tab contract; category dialog
forward/reverse focus trap and Escape restoration; results select keyboard opening,
option focus and Escape restoration; all four management log views (Kullanıcı
Logları, E-Posta Logları, Şifre Talepleri, Sistem Hata & İşlemleri) with API/loading
readiness checks before their computed-name inventories; mobile menu trap, background exclusion,
Escape restoration and keyboard link navigation. Programmatic focus sets the
starting point only in the exhaustive tab inventory; dedicated keyboard flows
reach their starting controls by Tab. Screenshots capture keyboard focus for
human review; they do not constitute an automated focus contrast test.

The control count is read once per role (and once for password fields) for each
snapshot state; each control still receives the same visibility/name check.
Full tab inventories repeat approximately 14 states on `/management` (initial,
four main tabs, five user-role tabs and four log-button views) and five states on `/settings` (initial
and four tabs). Basic-route audit tests have taken 22–33 seconds on this host,
so those two exhaustive tests explicitly allow 600 and 240 seconds respectively.
Individual assertion timeouts and network-settling checks are unchanged. These
are test-operation budgets; they do not excuse or prove application responsiveness.

The recorded desktop survey RED run in this Chromium exposed its two native
`input[type=date]` controls as unnamed `textbox` roles. The role/name inventory
therefore caught both date-label failures. This is evidence about the browser
used for the audit; it does not guarantee that every browser or accessibility API
exposes native date controls with the same role. Explicit label associations and
`getByLabelText` unit checks remain appropriate for those fields.

## Reader availability and limits

**Current scope decision, 3 October 2026:** The user removed the requirement
for actual spoken screen-reader use from this admin acceptance scope. The
existing ARIA labels, computed accessible-name checks and keyboard/focus
requirements remain in place. The historical reader attempt below is retained
as unverified evidence, not a passed check or a requirement before teacher-panel
work. Latest same-code terminal/BAT/Git SH setup acceptance passed 3/3 on
3 October; the hybrid hold is resolved. Teacher-panel auditing has not started.

Initial read-only PowerShell inventory found `C:\Windows\System32\Narrator.exe` present.
Neither `C:\Program Files\NVDA\nvda.exe` nor
`C:\Program Files (x86)\NVDA\nvda.exe` was present. Before the reader launch, no matching Narrator,
nvda, jfw, or ZoomText process appeared in `Get-Process`. No top-level matching
NVDA/Freedom/JAWS/ZoomText directory appeared in the two Program Files roots.
This is a limited installation inventory, not proof that no other reader exists.

The coordinating agent subsequently reset the Windows UI helper, successfully
listed applications, and launched `Narrator.exe`. The helper returned a Narrator
window, but `get_window_state` reported that it runs at a higher Windows integrity
level than the helper. The available screenshot was tiny and no accessibility
tree could be obtained for that window. No audio-capture capability was exposed.
**Narrator was launched, but actual speech, reading order and reader interaction
remain unverified.** This is a specific integrity-level/audio limitation, not a
claim that all native application access is disabled.

Playwright ARIA snapshots and accessible-name matchers inspect a computed
accessibility representation in the browser. They do not establish Narrator/NVDA pronunciation, announcements,
browse mode, reading order, reader-specific shortcuts, or actual screen-reader
usability. Those would require an interactive reader session, which is excluded
from the current acceptance scope by the 3 October user decision. Full WCAG conformance,
color contrast, every validation/live announcement, and every destructive workflow
are outside the assertions in this suite.

## Label repair and unit regression evidence

Source inspection found unassociated profile/password labels in
`client/src/pages/settings.tsx`; telephone, address and e-mail placeholders were
different from their visible labels. The current patch links all four profile
fields and three password fields using `htmlFor`/`id` pairs. Two regressions in
`client/src/test/admin-inventory.test.tsx` require meaningful accessible names and
clicking each visible label to focus its matching control. Label-click assertions
also catch the name field's matching-placeholder fallback. These are DOM/unit
checks, not real-reader speech validation. No complete browser-suite pass is
claimed here.

A separate report-readiness/race check uses the real API shape: the student
results endpoint returns `quiz.category` as a string, flattened in
`server/storage.ts`, not a `{ name }` object. The test fixtures were corrected to
that shape before checking the race.

From `client`, the following race command failed with exit 1 before the effect
cleanup patch; B's report metadata accompanied A's exported rows (`result-student-a`
and `Sınav A`, instead of B's row):

```powershell
pnpm exec vitest run src/test/admin-student-report-request-race.test.tsx
```

The patch clears stale rows/categories/identity at request start, ignores inactive
requests, commits results/categories/identity together, and guards stale errors
and loading completion. The subsequent serialized targeted run exited 0 with
**2 test files passed and 4 tests passed** (91.94 seconds):

```powershell
pnpm exec vitest run src/test/admin-student-report-readiness.test.tsx src/test/admin-student-report-request-race.test.tsx --maxWorkers=1
```

Those four tests cover pending report controls, loaded selected-student identity
with completed numeric zero, missing identity, and the deferred A-to-B race. They
do not verify Narrator speech; the separate final browser recheck passed 53/53.

## Final initial-run defects and focused repair evidence

AX06: desktop and mobile `/admin/archive` computed inventories exposed two
unnamed promotion comboboxes. Source labels for the source and target class were
unassociated. The repair links their visible labels to unique trigger IDs and
also links the education-year input to its visible label.

AX07: desktop and mobile `/student/results` exposed three unnamed filter
comboboxes. The repair links the category, score and sort triggers to their
visible labels, and links the exam-name search input too. Names now describe
each control's purpose independently of its selected value or placeholder.
Filter values, handlers and report request behavior are unchanged.

AX08: category-dialog Escape restoration failed on both viewports. The dialog
was opened programmatically without a Radix `DialogTrigger`; closing returned
focus to the page body. The repair captures the actual button for both new-course
and per-course edit paths and restores focus to that connected opener on close.
Existing submit and mutation behavior is unchanged.

The focused regression requires all seven meaningful label names and keyboard
Enter/Escape focus restoration for both add and edit. Before production repairs,
the following command exited 1 with **4 failed tests** (68.10 seconds): names
were empty and both close paths focused the body. After repairs it exited 0 with
**1 file passed and 4 tests passed** (39.17 seconds). From `client`:

```powershell
pnpm exec vitest run src/test/admin-accessibility-final-repairs.test.tsx --maxWorkers=1
```

`git diff --check` passed for these three source files and the new test, with
line-ending notices only. These DOM/unit results support the repairs; the final
browser matrix passed 53/53 and actual reader speech remains unverified.

The existing audit's unnamed-control check uses textContent/ARIA/title attribute
presence. That heuristic can miss broken references and placeholder-only names;
the new suite records computed snapshots and checks computed names instead.

## Initial full-run runtime evidence

The preserved initial 53-case run finished with **47 passed and 6 failed** in
822.84 seconds. This is initial evidence, not the outcome of the subsequent
rerun. The raw report is `results-accessibility-full-initial.json`; the decoded
per-route and viewport records are in
`evidence/closure/accessibility/runtime-summary-initial.json`.

All 53 runtime attachments were inspected. They recorded **0 uncaught page
errors, 1 console error, 0 API HTTP error responses, 1 failed request, and 0
aborted requests**. The console error and failed request belong to the same
incident in the passing mobile `/management` case (390 × 844): GET
`/api/admin/logs/system` failed with `net::ERR_NETWORK_CHANGED`. This is recorded
as a browser transport failure; there was no HTTP error status or uncaught
JavaScript error. Its underlying cause and subsequent recovery were not proven
by this run. The accessibility case passing does not establish that this request
succeeded.

The 53 captured document navigation samples had a median load completion of
1,342.1 ms, a 95th percentile of 3,096.2 ms, and a maximum of 3,980.2 ms. Median
DOMContentLoaded was 582.2 ms (95th percentile 1,458.8 ms; maximum 3,320.6 ms).
Median response start was 21.3 ms and median DOM interactive was 47.4 ms. These
are the last captured document navigation timings per case on this local audit
machine, not every SPA transition or a controlled performance benchmark. The
recorded 1,429-byte transfer size is the document response only, not total page
assets. The diagnostic collector records console errors rather than warnings,
API responses at HTTP 400 or above, and request failures/cancellations
separately. The durable summary preserves these measurement limits and the
individual records without credentials or token values.

## Final full-run runtime evidence

All **53 final runtime attachments** were decoded and inspected. Per-route and
viewport records are preserved in
`evidence/closure/accessibility/runtime-summary-final.json`. Actual final
counters are **0 uncaught page errors, 1 console error, 0 API HTTP error
responses, 1 failed request, and 0 aborted requests**. The two nonzero events
describe one incident in the passing mobile `/student/result/audit-result` case
(390 × 844): GET `/css2` failed with `net::ERR_NAME_NOT_RESOLVED`. The path matches
the Google Fonts stylesheet declared in `client/index.html`; attribution to that
external font request is an inference because diagnostic attachments retain
pathname rather than hostname. There was no HTTP error status or uncaught
JavaScript exception. The test passing does not prove the failed request
recovered. This final DNS incident is separate from the initial run's
`/api/admin/logs/system` transport incident described above.

Final navigation measurements include 53 positive response-start, DOM
interactive and DOMContentLoaded samples, but only **40 positive load-completion
samples**: 13 captured `loadEventEnd` values were zero, so load completion was not
measured for those cases. Median DOMContentLoaded was 431.2 ms (95th percentile
1,411.0 ms; maximum 4,695.0 ms). Among the 40 positive load-completion samples,
the median was 1,443.65 ms, the 95th percentile was 5,063.2 ms and the maximum
was 7,930.2 ms; these cannot be treated as measurements for all 53 cases.
Document transfer size was 1,428
bytes, which excludes other page assets. These are local document timings, not
a controlled performance benchmark or complete SPA-transition measurements.
Console warnings and actual assistive-reader speech remain outside this
verification; the final browser pass does not establish zero network errors.
