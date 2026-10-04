# Academic archive implementation plan

> **For agentic workers:** Use executing-plans to implement task-by-task; each completed task ends with tests and a commit.

**Goal:** Safe manual/yearly archive, durable July15 rollover and read-only historical admin browsing.

**Architecture:** SQLite persistent jobs and immutable snapshot rows; background exports outside short transactions. A verified artifact precedes the atomic yearly promotion/activation. Historical admin views consume snapshot data.

**Tech Stack:** Existing Prisma/SQLite, Express, React, Vitest and Playwright; no required Redis/Mongo.

## Global constraints
- Never migrate/test real server/data/quiz.db; isolate test DB and artifacts.
- Preserve pre-existing client/src/lib/api.ts and server-setup.tsx changes; add new year/archive client helpers separately.
- Europe/Istanbul July15 00:05; no fabricated pre-install historical periods.
- Password/token/session/provider secrets excluded from export.
- API/DB immutable archives; files verified before rollover; teacher assignments unchanged.

## Task0 — Approved contract
- [x] Save design and this tracked plan; review manual vs annual behavior, checksum and history scope.
- [x] Commit `docs: define academic archive contract` —74bab4d.

## Task1 — Persistent year/snapshot/job model
Files: server/prisma/schema.prisma; new migration; server/services/academic-year.ts; server/tests/api/academic-year.test.ts.
Interfaces: getOrCreateActiveYear(db, now), getYearSchedule(label), snapshot/job models and explicit transition rules.
- [x] RED: expect(getYearSchedule('2025-2026').toISOString()).toBe('2026-07-14T21:05:00.000Z'); invalid label rejects; duplicate annual job rejected by DB; isolated migration preserves old data.
- [x] GREEN: add active/closed years, snapshot rows, lease/retries, unique annual key, graduation fields, explicit class transition rules; generate Prisma client only.
- [x] Verify16/16 focused tests + focused type-check; independent review approved. Commit `feat: persist academic years and archive jobs`.

## Task2 — Immutable capture and API/DB guards
Files: new archive capture/guard services and API middleware; migration triggers; existing quiz/content/survey/result mutations; tests.
- [x] RED: missing capture module; active result reparent bypass; unrelated manual user inclusion; absent capturedAt marker reproduced before their fixes.
- [x] GREEN: transactional selected-scope copy with immutable business context, capture marker and lease fence; SQLite/API guards and audited denials; legacy direct archive/promotion/purge closed. Authoritative preview follows in Task3.
- [x] Verify13/13 isolated SQLite/API tests, focused strict TypeScript and independent scoped review; commit `feat: enforce immutable archive snapshots`.

## Task3 — Files and protected admin endpoints
Files: archive exporter/packer; archive router; artifact verification tests; export dependencies only when required.
- [x] RED: missing exporter; relation-shaped course omission, foreign/null-class participant omission, input budget and public client/dist backup-root bypass reproduced before fixes.
- [x] GREEN: four CSV groups, frozen JSON, hierarchical PDF, manifest/meta/ZIP; bounded capture/export; safe backup root + atomic publication; admin password/session-scoped verified downloads; scoped preview and jobs API. Playwright is a production dependency and Chromium preparation runs at install.
- [x] Verify13/13 exporter tests including real Chromium,16/16 API tests,9/9 isolated DB integration, server build; independently extract/render all4 controlled PDF pages and verify ZIP CRC/SHA-256 (fixture ZIP9363ce2132011b96047718f3e0839944c1390a033a634b2a0261a9c754bcbbf5). Commit `feat: export protected archive packages`.

## Task4 — Durable worker and annual rollover
Files: archive worker; academic transition service; server/index.ts worker wiring; clock/DB tests.
- [ ] RED: July boundary, restart catch-up, competing claims, stale lease, bounded exponential retry, file failure prevents promotion; mapping chain moves each initial student once, graduation and teacher links preserved.
- [ ] GREEN: durable leases/year locks, verified-before-transition state machine, atomic year closing/promotion/new-year creation; failure notifications and audit; auto mode internal only.
- [ ] Verify transaction fault injection and isolated restart; commit `feat: automate durable annual rollover`.

## Task5 — Archive and promotion UI
Files: new client archive helper; admin/archive.tsx; progress/list/mapping UI; frontend/E2E tests.
- [ ] RED: explicit scope preview, pending/error/retry, missing mapping blocks annual run, correct snapshot status, protected download challenge; normal navigation remains usable.
- [ ] GREEN: manual/annual controls and snapshot statuses, persistent mapping and completed progression in promotion tab.
- [ ] Verify real Chromium flows and focused frontend tests; commit `feat: manage yearly archive and promotions`.

## Task6 — Historical admin year selector
Files: academic year context/selector; DashboardLayout; snapshot-backed historical screens/API reads and mutation middleware; tests.
- [ ] RED: active first/default, previous period immutable names/classes/results after live mutations, refresh retains selection, missing snapshot not falsely shown; UI and direct HTTP writes blocked in historical mode.
- [ ] GREEN: year selector and explicit snapshot-backed history views for people/class/course/content/results; no cross-year query cache reuse; current panels continue their existing routes.
- [ ] Verify browser year switching/refresh and API authorization; commit `feat: browse historical academic years`.

## Task7 — Regression and failure acceptance
- [ ] Full frontend/backend, type-check/build; real isolated capture/export/rollover/restart/history browser flows, checksum and actual PDF; verify real DB hash/user diffs preserved.
- [ ] Repair any verified failure with RED/GREEN; commit acceptance tests and evidence `test: verify archive rollover and history`.

## Task8 — Documentation and Graphify closure
- [ ] Update README/admin/setup/backup/security docs and exact tested/untested scope; record task commit ids.
- [ ] Graphify update/diagnose after final sources; secret scan durable evidence/artifacts; final diff check.
- [ ] Commit `docs: document yearly archives and refresh graph` and verify only protected user changes remain.
