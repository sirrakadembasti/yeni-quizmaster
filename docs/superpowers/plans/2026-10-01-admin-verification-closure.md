# Admin verification closure implementation plan

> **For agentic workers:** Execute this plan task by task with independent delegated inspections and serialized verification runners.

**Goal:** Verify the remaining admin exports, printing, accessibility and fresh hybrid setup before starting the teacher panel audit.

**Architecture:** Browser tests exercise the isolated audit runtime. Fresh setup must run from a separate project directory so generated credentials, deployment configuration and SQLite files cannot target the working installation. Accessibility tree and print rendering evidence are reported separately from physical screen reader and printer access.

**Tech Stack:** Playwright Chromium, Node test runner, OOXML, pnpm, Windows BAT and Bash SH launchers.

## Global constraints

- Preserve existing user changes in client/src/lib/api.ts and client/src/pages/server-setup.tsx.
- Never mutate server/data/quiz.db or actual installation secrets/configuration.
- Serialize browser, installer, build and Graphify runners.
- Do not count unavailable or unrun checks as passed; remain in admin scope.

## Export and print verification

- [x] Inventory each admin export and print entry point.
- [x] Add tests-e2e/admin-export-print.spec.ts with real download content assertions and print media/layout evidence.
- [x] Run the new spec against isolated data and retain named results and artifacts.
- [x] Investigate failures and apply regression-tested fixes; final production export/print run passed 16/16, including exact text in a 21-quiz PDF.

## Accessibility verification

**Scope decision, 3 October 2026:** The user removed actual spoken screen-reader
use from current admin acceptance. Existing ARIA labels and computed-name,
keyboard and focus checks remain required. The historical Narrator attempt
stays unverified and is not counted as a pass. No manual reader acceptance or
reader-related hold remains. Latest fresh hybrid acceptance passed 3/3;
teacher-panel work has not started.

- [x] Inventory available screen reader access and browser accessibility checks.
- [x] Add tests-e2e/admin-accessibility-closure.spec.ts for named controls, keyboard focus and tab flows.
- [x] Run the initial full spec (47/53), review page-specific findings and distinguish actual reader coverage from automated evidence.
- [x] Repair verified defects with focused regressions and recheck all 53 production browser scenarios; real reader coverage remains explicitly unavailable.

## Fresh hybrid setup

**Latest, 3 October 2026:** Second BAT full run passed exit 0,
13:07:32.905–13:14:43.008 UTC, including real install/builds/14 migrations,
admin/persistence/reentry, production API/Vite UI login and verified cleanup
with unchanged protected source hashes. Historical acceptance totals: BAT 1/2,
terminal 1/10, Git SH 1/2. Terminal attempt nine passed every product phase but
failed cleanup using the previous PID-zero snapshot; it remains failed full
acceptance. Second Git SH full run passed exit 0, 13:59:05.376–14:09:50.009 UTC, with install/wizard/API/Vite UI login, cleanup and protected hashes verified. [SH full pass](../../admin-audit/evidence/closure/hybrid/sh-second-passed/result.json). Tenth terminal full run passed exit 0, 14:10:59.825–14:16:26.729 UTC: wizard/API/Vite admin login, cleanup and protected hashes verified. [Terminal full pass](../../admin-audit/evidence/closure/hybrid/terminal-tenth-passed/result.json). Latest same-code terminal/BAT/Git SH acceptance is 3/3; historical failures remain. Git SH is not Linux/WSL evidence.
Real CIM isolated System Idle PID 0 as the only invalid snapshot row; the fix
excludes only numeric zero and retains fail-closed positive identity checks.
Unconditional handle release is separate from process-stop proof. Focused VM
and handle tests RED 7 pass/3 fail → GREEN 10/10 (543.600 → 463.488 ms), not
fresh-install proof. [Retry evidence](../../admin-audit/evidence/closure/hybrid/retry-2026-10-03-process-cleanup.json)
and [BAT full pass](../../admin-audit/evidence/closure/hybrid/bat-second-passed/result.json).

- [x] Inspect terminal, BAT/SH and web wizard prerequisites and isolation boundaries.
- [x] Prepare a fresh disposable project with no production DB or credentials.
- [x] Exercise terminal, BAT and Git SH launchers through the real wizard and API/UI login; latest same-code matrix passed 3/3; Linux/WSL remains outside verified coverage.
- [x] Check generated settings, persistence, reentry guards and owned cleanup; all three latest runs passed with unchanged protected source hashes.

**Actual matrix, 2 October 2026:** Terminal completed eight isolated full attempts, BAT one, Git SH one; full acceptance is **0/8, 0/1, 0/1**. Terminal attempt seven, BAT and SH completed real installation, both builds, migration/first admin, generated config/env/lock and persisted settings/reentry guards. BAT additionally passed production API admin login, then failed real UI `/auth` DOM navigation at 30 seconds. SH failed the API startup single-check bound before API/UI login. BAT/SH cleanup remained unverified and source protected-file hashes were unchanged. [Preserved results and stage evidence](../../admin-audit/hybrid-setup-closure.md) distinguish these passed stages from failed full acceptance.

The 2 October decision not to retry is historical. On 3 October, the coordinator investigated Windows harness metadata and completed real terminal/BAT/Git SH setup retries. The prospective 120-second fresh-login navigation budget was not reached in the recorded SH run and proves no success or performance repair. The latest same-code hybrid matrix has now passed 3/3, so this acceptance hold is resolved; teacher-panel work has not started. Actual reader speech/interaction remains historically unverified and is excluded from current acceptance by the user decision above. Git SH is not Linux/WSL evidence. The fresh-setup checkboxes are complete based on the three latest API/UI and cleanup passes, not on historical partial runs.

## Integration and report

Verified matrix limits: Windows terminal/BAT/Git SH with controlled `--no-open`;
native Linux/WSL, default OS browser opener, wizard dev-start button, physical
printer, actual desktop Excel and SMTP delivery remain outside this proof.
The reader requirement was excluded by the user, not passed. Teacher-panel
auditing has not started.

- [x] Update README and relevant admin/setup documentation with evidence and explicit limits.
- [x] Run appropriate checks for changed code and independently review changes; retain the failed combined run separately from the passing focused retry.
- [x] Update Graphify, diagnose generated outputs and verify the actual browser graph/search/info panel.
- [x] Confirm the final production DB fingerprint before commit: SHA256 8210a4b79f2cfb9cf74de6a4989f5c8a5449ba1d17b2332abdbd018c3741a158, unchanged.
- [x] Prepare an explicit owned-file commit list and preserve the user's unstaged API/localhost setup edits; report the resulting commit separately.

Current integration state: the completed combined Node run had 31 tests, 30 passed/1 failed, exit 1, total 108.821 seconds. Startup case took 50.352 seconds: native PNG passed but no CSRF arrived within the 30-second API deadline; lifecycle spawned=true/exited=false/closed=false and only pnpm invocation output do not prove an app cause. The earlier combined interrupted run remains INCOMPLETE (2 pass/1 fail, rest unrun, Ctrl+C exit1; startup110.48s). Earlier startup1/1green17.84s and real BAT API/login green remain separate evidence. Test-only finally/pipe-unref/stop-proof fixture cleanup RED0/3→GREEN3/3 and error-output sentinel RED3pass1fail767.411ms→GREEN4/4 462.748ms preserve ownership and suppress sensitive error output. The separate final native-only run passed1/1 exit0, test71.9360927s/total72.6083536s, with API deadline120s instead of30s and unchanged native PNG/CSRF/file assertions. Command: pnpm exec node --test --test-concurrency=1 scripts/server-build-startup.test.mjs with CHECKPOINT_DISABLE=1. This does not turn the combined30/31 run into31/31, and is no performance/fresh claim. Graphify update/diagnose and actual visual checks are complete as recorded below; final DB fingerprint is unchanged; the commit is reported separately. The former no-retry decision is historical; real terminal/BAT/Git SH retries completed with latest same-code acceptance 3/3 on 3 October 2026.

**Graphify, 3 October 2026:** update/diagnose exited 0; 2206 nodes, 6030 edges,
114 communities, 0 missing/dangling/exact-duplicate/unverified records and 3
self-loops in the generated graph. Real CDN/Chromium visual run exited 0:
visible canvas, matching graph counts, UI search-selected `deploySetupDatabase()`
source and degree 6, no page/console/request failures, owned browser/server closed.
[Durable update/diagnostic limits](../../admin-audit/evidence/closure/graphify/graph-update-diagnostic.json)
and [actual visual result](../../admin-audit/evidence/closure/graphify/result.json)
remain separate from application/fresh-install acceptance. Local AST omitted 14
SQL files and PDF text; no LLM semantic refresh/relabel ran. Worktree user
localhost edits were included in the map but stay outside the owned commit.
The precommit `built_at_commit` 5b83a1163e6a49d7d2c392350813823d2e91172f is not
standalone freshness proof. The resulting commit is identified by Git and the final response rather than embedded in generation-time evidence.
