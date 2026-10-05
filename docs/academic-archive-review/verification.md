# Academic archive acceptance infrastructure

Run `node scripts/academic-archive-runner.mjs` from the repository root. Optional Playwright filters follow the command. The runner passes its private runtime path to `playwright.academic-archive.config.ts`; direct Playwright invocation without that runtime fails closed. Both `academic-archive*.spec.ts` and `academic-history.spec.ts` are included.

`node scripts/academic-archive-runner.mjs --smoke` migrates an isolated database, seeds a synthetic admin, starts owned API/UI servers, opens Chromium, authenticates the synthetic account, mounts `/archive`, and checks the education-year selector. `--startup-failure-smoke` intentionally starts a missing entry point and verifies failure detection and cleanup without migrations.

The launcher creates one `server/data/quizmaster-test-academic-*` project root. Schema/migrations are copied there so Prisma never discovers the real deployment environment. The server runs with that root as cwd: sessions, uploads, deployment files and archive artifacts stay inside it. Vite uses an isolated envDir. Only operating-system runtime environment variables are inherited. All account values are synthetic. Two available ports are allocated, distinct and strict; no existing server is reused. Cleanup proves owned process termination independently of port checks, then checks released ports and hashes of the live database and two protected user files before removing only its validated fixture root. Failed cleanup preserves the root and reports errors.

Windows runs require Python 3.8+ on PATH (standard library only; no package installation or production dependency). A supervisor creates a kernel Job Object with kill-on-close, launches the Node payload suspended, assigns it before resuming, and keeps the job handle alive after payload parent exit. Cleanup terminates the job and verifies its active-process count is zero. No live process enumeration or arbitrary PID targeting is used. Unexpected supervisor exit closes the job and kills its descendants; the runner fails closed if explicit cleanup proof was lost. Unix launches retain a dedicated session supervisor while the existing identity-checked capture/cleanup helpers discover descendants and escalate SIGTERM to SIGKILL. Cancellation and final cleanup use the same idempotent owned-process cleanup path. The API loads tsx directly with Node `--import` to avoid its CLI fork. The regression command is `node --test scripts/academic-owned-process.test.mjs` and creates only synthetic non-listening subprocesses, without database migrations.

## Measured baseline, 2026-10-05, Windows

| Command | Result | Measured duration |
| --- | --- | --- |
| `pnpm --filter quiz-master-server run test --config vitest.config.ts tests/api/archive-worker-integration.test.ts` | 8 passed, 1 timed out: restarted worker verified-artifact reuse | suite 278.64s; tests 173.58s; failing case 30.759s |
| `pnpm --filter quiz-master-server run test --config vitest.rollover-db.config.ts` | 9/9 passed, exit 0 | suite 196.13s; tests 121.56s |
| Isolated setup migration regression (root agent reproduction) | 1/1 passed, exit 0 | suite 253.34s; test 113.19s |
| `pnpm test:setup` (root agent reproduction) | 14/14 passed, exit 0 | 4.87s |
| `node scripts/academic-archive-runner.mjs --startup-failure-smoke` | Expected missing entry point detected; owned fixture removed; protected hashes preserved, exit 0 | no migration or live connection |
| Approved `node scripts/academic-archive-runner.mjs --smoke` | Chromium navigation, synthetic admin identity, archive heading and education-year selector passed; owned trees/ports/root cleaned; protected hashes preserved, exit 0 | migrations 70.562s |

The two rollover runs differ in contention: the default run overlapped the initial smoke migration; the dedicated run was serial. Their durations are not a controlled performance comparison. The assertion timeout alone does not establish a product defect. The 30s and 120s configs remain unchanged; the dedicated DB suite is the documented command for this integration fixture.

The first launcher attempt stopped at its 120s migration subprocess bound after 14 of 17 migrations; no assertion had run. Full captured stdout ended at `20260930120000_nullable_survey_answers`; stderr was empty; error was `spawnSync node.exe ETIMEDOUT`. Cleanup removed the owned fixture and preserved protected hashes. The launcher uses a separate 180s subprocess bound derived from the measured rate (17/14 * 120s plus 30s startup), and reports migration elapsed time. This does not increase Vitest test budgets. The fresh revised smoke outcome is recorded in the task report.

The setup migration regression now reports elapsed time, exit status, signal and complete stdout/stderr on child command failure. There was no migration regression failure in the reproduced run. Broader product failures remain for subsequent tasks; this infrastructure does not claim to repair them.

Windows sandbox verification identified an environment limitation: a synthetic sleeping child could not be terminated by `taskkill` (`status 1`, `ERROR: Access denied`). The same own-process probe under approved escalation returned status 0 and confirmed tree termination. The full sandbox smoke reached API/UI readiness and failed at Chromium process launch, then correctly reported denied cleanup and preserved its fixture. A separate approved run is required to verify Chromium and owned process cleanup. These are infrastructure/environment failures, not academic archive product failures. The first Vite wrapper also exposed `ReferenceError: __dirname is not defined`; the corrected runner loads the existing config through Vite's native loader before overriding envDir and ports.

The first elevated browser run migrated in 99.640s and verified owned process/port cleanup and protected hashes. Its navigation waited for the full page load and timed out at 30s. `client/index.html` dynamically injects Google Fonts; the smoke now blocks third-party resource requests and waits for DOMContentLoaded before testing the local mounted UI. The navigation/assertion budgets remain 30s. Prior denied-cleanup fixture roots were removed only after proving their exact owned ports could be bound and validating their absolute paths; unrelated temporary directories were left alone.

The final approved smoke passed with migration elapsed 70.562s and printed `Isolated Chromium navigation and admin login passed`, followed by `Owned fixture removed; protected file hashes preserved` (exit 0). Direct config invocation without a private runtime failed with `Run node scripts/academic-archive-runner.mjs; deployment servers must never be reused.` Config listing with a valid fixture runtime loaded successfully and found zero acceptance specs because those are assigned to later tasks. The initial smoke did not exercise cancellation; the review fix below verifies cancellation completion. Unix cleanup is implemented but only Windows was verified.

## Cleanup review fix verification

The initial cleanup was insufficient for descendants surviving a launcher parent. It was replaced with the owned supervisor/job mechanism above. Root-thread approved `node --test scripts/academic-owned-process.test.mjs` passed 3/3 on Windows (exit 0, total 2255.88ms): early payload-parent exit with a surviving non-listening descendant (852ms), unexpected supervisor death with kill-on-close and fail-closed proof handling (825ms), and running-payload cleanup resolving cancellation completion (321ms). The first case requires the descendant to be alive before cleanup, then a zero active-process job count and descendant absence; service-port checks are not used as process-tree proof. Earlier test failures identified Python 3.8's missing CREATE_SUSPENDED export, Windows non-detached fixture auto-kill, missing assertion-failure cleanup, and signalCode detection; all corrections retain strong behavioral assertions. Unix SIGTERM/SIGKILL remains unverified on this host. Full migration/browser smoke was not duplicated for the cleanup-only fix.

Root-thread approved `node scripts/academic-archive-runner.mjs --startup-failure-smoke` passed with the new supervisor wiring (exit 0, 2.78s): expected MODULE_NOT_FOUND, owned startup failure detected, fixture removed, protected hashes preserved. Node syntax checks and git diff --check also passed. All three protected file SHA256 values remain identical to the baseline above.

Protected baseline SHA256:

- `server/data/quiz.db`: `8210A4B79F2CFB9CF74DE6A4989F5C8A5449BA1D17B2332ABDBD018C3741A158`
- `client/src/lib/api.ts`: `DE94A69161D940DB1E10268FB95120DA5A77325DBD3B90E3B26774F30A41831C`
- `client/src/pages/server-setup.tsx`: `3E2D02A470166CC33DF798C2316B1345EA0A9E7C2467CCC6C4BDD95703B459CB`

The existing user diffs add localhost deployment mode/support. Existing graphify diffs are excluded from task staging. No live server was used. Browser artifacts are disposable; tests needing retained evidence must explicitly write sanitized evidence into the review documentation directory.
