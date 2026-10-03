# Teacher defect repair plan

**Goal:** Close the two approved functional findings and finish five-type survey edit/reopen acceptance with isolated data.

**Design:** Preserve the existing API and hybrid setup. Bind the report to the API's `correctAnswersCount`, retaining zero. Set reset loading before the request and use a synchronous pending guard so repeated form submissions cannot race; release the guard in `finally` and preserve retry. Reuse the teacher fixture and real Chromium/API flows. WSL is probed with a 15-second bound; if unavailable, use native Windows tooling without restarting WSL or altering OS configuration.

**Constraints:** Do not change production data, existing api.ts/server-setup.tsx edits, unrelated UX findings, reset API/password rules or survey type contracts. Earlier report acceptance criteria and the user's instruction to solve these findings authorize this implementation.

- [x] Extend component regressions for correct-answer zero/positive values and pending reset/retry; observe RED.
- [x] Apply the smallest report/reset changes and observe GREEN.
- [x] Run actual browser report/API/export/print and pending reset/retry flows on disposable servers.
- [x] Run the named five-type survey GUI create/publish/reopen/edit/reload test; diagnose and fix a product defect only if reproduced.
- [x] Verify owned process shutdown, fixture ports and protected database hash.
- [x] Update findings/checklist/README and Graphify; inspect only this work's files for staging and commit.
