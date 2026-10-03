# Linux setup and teacher audit plan

> For agentic workers: Execute with supervised subagents and evidence checkpoints.

**Goal:** Verify a real Linux/WSL SH hybrid installation, then audit every teacher page and tab using isolated data.

**Architecture:** Ubuntu 22.04 WSL2 runs native Node 22 and pnpm 9.15.1. A source-only Linux staging copy supplies the existing real wizard/browser harness; fresh fixtures have independent dependencies, SQLite data and ports. Linux cleanup requires observed process identities and descendants, not only the parent PID. Teacher audit begins after the Linux acceptance result is recorded.

**Constraints:** Preserve production data and original api.ts/server-setup.tsx edits. Do not reuse Windows native dependencies. Do not count unrun checks as passed. No broad process termination or system WSL configuration changes.

- [x] Inventory WSL and source/test prerequisites: Ubuntu 22.04 exists; Linux Node is missing and inherited pnpm is Windows-only.
- [x] Prepare isolated Linux Node/pnpm and Chromium tooling; verified Node 22.23.2 checksum, native linux/x64, pnpm 9.15.1 and Linux Chromium download.
- [x] Add and run real Linux descendant cleanup regression: native RED 0/9 → GREEN 9/9; expanded process/port suite 13/13 with zero skips. Windows metadata/handle regressions 10/10.
- [x] Run actual kurulum.sh install → web wizard → migrations/admin/persistence/reentry → production API and browser login: native full acceptance 1/1.
- [x] Verify fresh-setup owned processes and fixture ports closed, and protected source hashes unchanged; retain sanitized results/screenshots.
- [x] Update installation/audit docs and Graphify: 2317 nodes/6260 edges/122 communities; diagnose and actual Chromium visual passed.
- [x] Inventory teacher routes, tabs and operations; create 29-row page-based tracking checklist.
- [x] Run isolated teacher functional/API/E2E and desktop/mobile/keyboard checks; record console/network and empty/error/loading states. Per-case evidence and failed cohorts retained; this does not mean every variant passed.
- [x] Report verified defects separately from UX/new-feature suggestions, with reproduction, evidence, priority and acceptance criteria.
- [ ] Five-type survey edit/reopen complete acceptance: initial create/publish/API type readback reached; named final retry blocked by WSL unavailability. See teacher verification report.
- [x] Verify privacy/diff/source preservation and stage only owned files for the audit commit; no user client changes staged.
