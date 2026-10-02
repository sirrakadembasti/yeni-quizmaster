# Admin export and print closure

Final production-preview verification including PR04: **16/16 passed**, exit 0, **227.78 seconds (3.8 minutes)**, against the guarded audit services at 5510/5511. The run started on **2026-10-01 at 16:03:58 UTC**. Raw proof: [results-export-print-pagination-final.json](results-export-print-pagination-final.json); all final workbook/PDF artifacts: [test-results-export-pagination-final](test-results-export-pagination-final/). No tests were skipped or flaky. Repeat the suite command:

```powershell
pnpm exec playwright test --config playwright.admin-audit.config.ts admin-export-print.spec.ts --workers=1
```

The audit config includes the spec in its explicit `testMatch`. Fixtures and logins target only the disposable audit database; no real database or application settings are changed.

Historical production proof before PR04 remains preserved: **15/15 passed**, exit 0, approximately 2.4 minutes, starting **2026-10-01 at 14:54:26 UTC**. Its raw results are `results-export-print-final.json` and artifacts are `test-results-export-final/`; that earlier source did not contain the teacher pagination fix.

## Scope

The original fifteen cases comprise eleven admin-reachable browser Excel/PDF entrypoints (teachers, students, class list, class details, management class details, teacher details, exam results, admin student analysis, individual result detail, class statistics, and survey results) plus four print-only actions on quizzes, management, announcements, and settings. PR04 adds one further teacher-detail fixture, bringing the final suite to sixteen cases. Student-only `/my-stats` is excluded from this admin closure.

PR04 adds a sixteenth case for teacher-detail printing with 21 quizzes; it passed in the final rebuilt production run. That PDF assertion requires an installed Python runtime with `pypdf`. Set `AUDIT_PDF_PYTHON` to that interpreter (otherwise the test invokes `python`); an unavailable interpreter/parser is an explicit failure, not a skipped assertion. On this audit machine the installed interpreter is `C:\Users\ahmet\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe`.

| Entry point | Verified output contract |
| --- | --- |
| `/teachers` | Filtered teacher row, Turkish name, course/class relationships; portrait print |
| `/students` | Filtered student row, class number and admin-only parent/contact fields; portrait print |
| `/classlist` | Filtered class count and responsible teacher; portrait print |
| `/classes/:id` | Searched roster, student number/email, visible class identity and matching count; portrait print |
| `/admin/classes/:id` | Searched management roster, student number/email, visible class identity and matching count; portrait print |
| `/teachers/:id` | Teacher metadata and its class/exam records; portrait print |
| `/results` | Selected teacher/student provenance, authorized email fallback, genuine numeric zero; portrait print |
| `/student/results?studentId=…` | Admin student identity and genuine completed zero; portrait print |
| `/student/result/:resultId` | Actual question, wrong student answer, correct answer and status; portrait print |
| `/statistics` | Real class population, completed participation and zero average; portrait chart/table |
| `/survey-results` | Real open-text response, formula-safe XLSX value and participant; all PDF pages landscape |
| `/quizzes`, `/management`, `/announcements`, `/settings` | Four print-only portrait report actions, retained titles, hidden interactive controls |

Tests create UUID-scoped fixtures only in the guarded disposable audit database, then delete those fixtures. Each workbook comes from an actual Playwright browser download. The test independently reads the ZIP central directory, parses worksheet XML, and compares cells with hand-written expectations. It checks Turkish text, XML-special characters, parent contacts, class/teacher relations, completed numeric zero, wrong-answer details, survey formula injection, and search/selector filtering.

Print checks invoke the real page action with an OS-dialog stub, emulate print media at A4 content width, check visible report text, hidden navigation/actions, repeated table headers, and horizontal table clipping. Chromium also renders an actual PDF and saves it alongside print-media PNG and layout JSON. PDF page dimensions verify portrait or survey landscape orientation. The PR04 test additionally extracts text from its actual PDF and checks all 21 titles exactly once; representative rendered-PDF visual reviews are documented separately below. These tests do not prove desktop Excel repair-free opening or physical printer behavior.

## Confirmed changes

- `/results` now records selected teacher/student names in both workbook filters and printed `PrintMeta`. Missing email in the result API's minimal student relation is completed from the already-authorized student list, preserving an email supplied by the result itself.
- Print CSS hides the dashboard chrome header while retaining report headers. This preserves the management report title.
- `/classes/:id` now has `PrintMeta` identifying its class, responsible teacher, filtered count, and search. Both class-detail E2E cases assert visible class identity and a count matching the searched roster.

## Survey landscape diagnosis and measured fix

The last full run's survey workbook cells passed; its PDF contained a 594.95996 × 841.91998 portrait page carrying only the shared masthead, followed by the 841.91998 × 594.95996 landscape report page. Applying `page: landscape` to the dashboard `main` did not fix that boundary.

A focused Chromium diagnostic read the emitted production stylesheet and computed print styles. The selector matched and `main.page` was `landscape`, but its descendants `[data-print-content]`, `.print-masthead`, and `.dashboard-page` computed `page: auto`: the page property did not propagate to the shared masthead. The `.print-landscape` report itself computed `landscape`.

Applying the plain rule `body:has(.print-landscape) { page: landscape; }` in print media produced one landscape page containing the common masthead and survey report. The diagnostic asserted the baseline contained a portrait page, then asserted every corrected PDF page was landscape and that the shared masthead no longer created an extra page. No `!important` was needed. Production CSS now assigns the named page to the document body for landscape reports; ordinary reports keep the default portrait A4 rule. The original all-pages orientation assertion remains unchanged.

Evidence is preserved in `test-results-export-landscape-recheck/computed-original.json`, `computed-body-plain-named.json`, `diagnostic-original.pdf`, and `diagnostic-body-plain-named.pdf`/`.png`. The focused browser diagnostic exited 0. The subsequent production rebuild and complete suite passed **15/15**, including the unchanged every-page landscape assertion. The regression sequence was production **14/15** with a real portrait masthead page → browser-confirmed plain document-level page rule → rebuilt production **15/15**.

## Final PDF visual and text QA

Three final PDFs and representative XLSX files were copied to durable `evidence/closure/export/` with meaningful names. Bundled Poppler `pdftoppm` rendered their first pages at 120 dpi; the authoring agent viewed all three rendered images. The bundled Poppler installation has no `pdftotext` executable, so installed `pypdf` extracted UTF-8 text instead. Whitespace was normalized only for text assertions because PDF kerning introduces extraction spaces; raw extracted text is preserved. `visual-qa.json` records page dimensions and successful Turkish title/name checks.

| Durable files | Actual visual findings |
| --- | --- |
| `teacher-list.pdf`, `.xlsx`, `teacher-list-page-1.png`, `teacher-list.txt` | One portrait page; teacher list title, search metadata, Şule İğde, Türkçe and class name readable; table fits margins |
| `class-roster.pdf`, `.xlsx`, `class-roster-page-1.png`, `class-roster.txt` | One portrait page; class/teacher/search metadata visible; filtered count 1, Çağrı Işık and student number 7 correct; signature lines and roster are unclipped |
| `survey-results.pdf`, `.xlsx`, `survey-results-page-1.png`, `survey-results.txt` | One landscape page; shared masthead and report together; date/survey metadata, participation summary, question and full response visible; table columns fit margins |

These checks verify browser downloads, workbook XML cells, Chromium PDF layout, and three representative rendered PDFs. **No physical printer was exercised and no workbook was opened in desktop Microsoft Excel.** Desktop Excel repair-free opening and physical printer-specific margins are therefore not claimed. First-page visual samples do not replace the suite's every-page orientation checks or prove arbitrary large-data pagination.

## Scope notes

- The `/results` summary-table search applies only to the summary table. Excel exports the detailed result collection controlled by the main filters. This may be intentional and is not asserted as a defect; the file's title is “Sınav Sonuçları”.
- Admin student analysis maps an absent score to numeric zero in its exporter. Main exam results export keeps absent scores blank. This discrepancy is reported for review; the current student-analysis test covers a genuine completed zero.

The server `/api/results/quiz/:quizId/export` endpoint produces CSV independently; no current client export button uses it. Its CSV contract is outside the browser XLSX entrypoint checks.

## PR04: teacher-detail print pagination

Read-only review confirmed that a teacher with more than 20 quizzes rendered only
the current ten-record page into the DOM. Excel already exported every quiz and
the printed count showed the total, while print CSS hid the page navigation.
Consequently the omitted pages could not appear in the PDF.

A 21-quiz regression in `admin-teacher-detail-export.test.tsx` first failed with
**10 title nodes instead of 21** (two existing cases passed; one new case failed).
The minimal source change maps all teacher quizzes, retains `flex` on the current
screen page and `hidden` on other rows, and applies `print:flex` to every row.
Screen pagination still selects ten records at a time and Excel still includes
all records. The subsequent focused unit run exited 0 with **3/3 passed** in
21.85 seconds:

```powershell
pnpm exec vitest run src/test/admin-teacher-detail-export.test.tsx --maxWorkers=1
```

The new browser case creates its own UUID-scoped teacher and 21 quizzes in the
guarded disposable database, removes them in `finally`, checks two disjoint
ten-record screen pages, checks all 21 workbook rows, and checks every title is
visible in print media. It extracts text from the actual generated PDF and
requires each of the 21 exact quiz titles to occur once across all PDF pages.
The final rebuilt production run passed **16/16**, including this new case.
The actual PDF contains two portrait pages; text extracted from the generated
PDF proves every one of the 21 exact quiz titles occurs once across its pages.
The raw Playwright text attachment is preserved as
`evidence/closure/export/many-quizzes.txt`, alongside the durable
`many-quizzes.pdf` and `many-quizzes.xlsx`.

Poppler rendered both pages as `many-quizzes-page-1.png` and
`many-quizzes-page-2.png`; both were viewed. Page one contains quiz titles 01–15
and page two contains 16–21. The teacher/report titles, email and Turkish
metadata are readable, and the fixture titles and quiz rows are neither clipped
nor truncated. `many-quizzes-visual-qa.json` records page dimensions and all 21
exact-once text checks. This verifies this two-page fixture; arbitrary title
lengths and larger datasets, desktop Excel opening, and physical printer output
remain outside the claim.
