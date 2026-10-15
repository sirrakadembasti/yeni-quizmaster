# Capacity and School Exam Implementation Plan

> **For agentic workers:** Use subagent-driven-development for independent bounded tasks; root owns integration and schedules heavy tests serially. Existing user modifications must not be staged or overwritten.

**Goal:** Fix non-HDD capacity causes preserving QuizMaster contracts, and measure the four-class/80-student/20-question/30-minute exam scenario.

**Architecture:** Patched SQLite runtime behind shared startup/client helpers; revision-checked preferences; aggregate dashboard and bounded results reads with whole-filter summaries/export. Existing role, session, academic archive, quiz timing and idempotency remain.

**Tech Stack:** Existing React/Express/Prisma/pnpm/Vitest/Playwright; select compatible patched SQLite dependencies with actual version/timestamp proof before WAL activation.

## Global Constraints

- No live DB SQL/copy/install/migration/start; only protected SHA check.
- Protected client API/setup user files remain byte-identical. Other user docs modifications/deletions remain untouched.
- Existing branch/working checkout retained; no stash/reset/branch switch/staging/commit of user changes.
- All backend/browser/seed/build heavy tasks serial. Independent source work may run in agents with exclusive ownership.
- Each required production behavior has RED/GREEN verification. Hardware/network capacity claims are limited to measured environment.

## Task 1 — Patched SQLite and deterministic startup

- [x] Research exact patched driver versions, Node compatibility, Prisma API/schema-engine and timestamp implications.
- [x] Write runtime startup tests: WAL/FULL/busy handling, wrong provider/path rejection, no unverified DB create, repeat startup, actual SQLite version floor.
- [x] Implement runtime helpers and dependency changes; retain migration format and Unix epoch timestamp storage.
- [x] Verify session expiry/touch/destroy, setup/maintenance and active/archived DB behavior in owned fixtures.

## Task 2 — Revision checked preference writes

- [x] Agent owns new notification-preferences service, route, UI helper/settings and scoped tests; parent owns storage/schema wiring.
- [x] RED: stale or retried expected revision must not overwrite newer value; JSON compatibility and ETag correctness.
- [x] GREEN: CAS plus bounded retries; ambiguous UI outcome reloads authoritative state; add operational-only revision migration.
- [x] Verify revision update does not alter academic capture semantics or business identities.

## Task 3 — Aggregate dashboard

- [x] Agent owns new dashboard service, route and scoped mock/fixture tests; parent wires storage getter.
- [x] RED/GREEN exact admin/teacher counts; archive/year filters; active students, all teachers, complete/null/zero score; no N+1/materialized result list.
- [x] Verify actual API response equality on realistic fixture (exact teacher stats and all 8,082 result identities/scores).

## Task 4 — Bounded result listing

- [x] RED: authorized bounded paging, deterministic order and total/full-filter summary; filter/export correctness, null/zero scores.
- [x] Add service/storage/route with backward compatible existing callers and new query helper.
- [x] Update results page to bounded rows while retaining whole-filter summaries and explicit full export/print. Preserve historical read adapter.
- [x] Typecheck and targeted frontend/real browser filtering, tables, charts, Excel/print checks (production browser: 100 screen rows, 282 Excel/print rows, filtered 82; page two reachable).

## Task 5 — Four-class live exam acceptance

- [x] Seed fresh owned DB: four classes ×20 students, one history exam ×20 questions, timeLimit=30; known expected scores, outsider/control student.
- [x] Use real sessions/CSRF and 80 distinct student actors; barrier start, answer waves and simultaneous submit with teacher observation.
- [x] Validate no missing/duplicated results, exact answer/score counts, no answer key before completion, timer and retry idempotency.
- [x] Measure p50/p95/p99/max/errors per phase; result and dashboard latency during answering and after submission.
- [x] Check before/after deadline behavior separately and label accelerated stress/soak scope honestly. Retest 20 actor preference contention.
- [x] Verify private fixture integrity/FK, source/user/live hashes, owned process/port release; review integrated changes; publish outcome report and concrete response to user (final owned school proof `7CGFKi`, completed true; 4,334 measured requests, zero errors).

## Additional findings resolved during acceptance

- [x] Route answer validation performs one atomic save instead of three duplicate pre-reads.
- [x] Independent readonly storage reads see only committed state and do not queue behind unrelated writes.
- [x] Adapter gate prevents unscoped single create/update from joining unrelated transactions; commit failure and active timeout recovery proven. Upstream maxWait limitation recorded without cancellation claims.
- [x] Trusted body-complete server receipt time prevents server queue delay from consuming the strict exam cutoff; no client timestamp/grace accepted.
- [x] Durable grading sends student HTTP response before best-effort teacher notification work; real HTTP response and later persist→emit verified.
- [x] Final fresh acceptance after notification response-order fix, including all 82 persisted teacher notifications and end-of-run integrity/FK.
- [x] Correct shared test TCP transport to independent actor pools; model each actor's own submit→2 seconds→detail, without retries. Configure finite 65-second server keep-alive and verify socket reuse after 6.25 seconds.
- [x] Reproduce SQLite BUSY adapter/library error mismatch, narrowly normalize to supported P2034, retain diagnostics and bound notification transaction retries (29/29 native; 64/64 archive regression).

**Capacity boundary:** The accelerated loopback acceptance passed. Actual school Wi-Fi, 80 full browsers, initial-login/JS download burst, and a 30-minute wall-clock soak remain unmeasured. Simultaneous durable writes still queue on the current machine; no zero-latency or universal capacity guarantee is made. Live deployment/migration was not performed.
