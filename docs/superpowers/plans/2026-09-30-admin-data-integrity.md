# Admin Data Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Preserve teacher creation assignments and question editor type/answer data.

**Architecture:** Keep existing API routes and payloads. Validate selected relation IDs at the user route and connect them inside the current Prisma user transaction. Make question state updates functional and adjust the answer index during option removal.

**Tech Stack:** React, TypeScript, Express, Prisma SQLite, Vitest, Playwright.

## Global Constraints

- Keep the hybrid terminal, `.bat`/`.sh`, and web setup flows intact.
- Run all database writes against disposable `quizmaster-test-*` SQLite databases.
- Preserve the pre-existing edits in `client/src/lib/api.ts` and `client/src/pages/server-setup.tsx`.

---

### Task 1: Teacher creation assignments

**Files:** `server/tests/api/admin-audit-people.test.ts`, `server/api-routes/user.ts`, `server/storage.ts`.

**Interfaces:** POST `/api/users` accepts `assignedCategoryIds: string[]` and `classIds: string[]` for an admin-created teacher; `storage.createUser` performs a transaction and returns the created user.

- [x] Replace the current defect characterization assertion with a desired read-after-create relation assertion; add a rejected invalid-ID case with no account created.
- [x] Run the scoped real-Prisma API test and confirm assertion failure on current behavior.
- [x] Validate arrays/IDs and teacher role in the route; connect relations in `createUser` transaction.
- [x] Run scoped real-Prisma tests (9/9) and the teacher browser flow (1/1); empty selection remains valid by the existing form/API contract.

### Task 2: Question editor data preservation

**Files:** `client/src/test/admin-audit-question-editor.test.tsx`, `client/src/pages/create-quiz.tsx`, `client/src/components/quiz/QuestionItem.tsx`.

**Interfaces:** `QuestionItem` sends updates through existing callbacks; `QuestionForm.correctAnswer` remains an index in the form, serialized to answer text on save.

- [x] Change characterization tests to expect selected survey type and unchanged answer text after deleting an earlier option; add removal-of-selected-answer validation.
- [x] Run the scoped component test and confirm the expected failures.
- [x] Use functional question state updates and adjust/clear answer selection on option deletion.
- [x] Run scoped real-component test (5/5) and client type-check. Editor page was opened in the isolated browser; the exact three corrected interactions were verified in real React component tests.

### Task 3: Verification and reporting

**Files:** `docs/admin-audit/README.md`, `docs/admin-audit/people.md`, `docs/admin-audit/quizzes.md`.

- [x] Re-run affected real API/component/browser tests and both TypeScript type-checks.
- [x] Update issue status and evidence, leaving later repair slices explicitly open.
- [x] Check diff and real database fingerprint before claiming completion; real `quiz.db` hash, size and mtime match the audit baseline.
