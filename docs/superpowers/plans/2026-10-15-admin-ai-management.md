# Admin AI Management Implementation Plan

> **For agentic workers:** Use subagent-driven-development task-by-task with failing tests, implementation and review. Track completion here.

**Goal:** Admin-only LLM configuration and multiple teacher-selectable models without changing quiz/survey behavior.
**Architecture:** Adapt the attached provider runtime into focused TypeScript services; encrypted Prisma profiles, host-authenticated APIs and native React pages. No external sibling-directory dependency.
**Tech Stack:** Existing Express, Prisma 6.19.3/SQLite, React, Zod and Vitest; existing safeExternalFetch for DNS-pinned HTTPS.

## Global constraints

- Approved spec: `docs/superpowers/specs/2026-10-15-admin-ai-management-design.md`.
- Never query, migrate, copy or run the application against live DB. Isolated synthetic fixtures only.
- Preserve user edits in `client/src/lib/api.ts` and `client/src/pages/server-setup.tsx`; add separate AI client using exported apiFetch.
- No paid external calls, keys in logs, dependency on sibling paths or automatic model fallback.
- Existing feature branch; no resets, stashes, force push or unrelated refactoring.

### Task 1: Secure profile store and provider runtime

**Files:** `server/services/ai-profiles.ts`, `ai-runtime.ts`, `ai-providers.ts`, `ai-encryption.ts`; Prisma schema and new migration; `server/tests/utils/ai-management*.test.ts`, separate unit config.
**Interfaces:** Export `AIProfileStore(db, getKey)` with async `list()`, `save(input,id?)`, `remove(id,revision)`, `setEnabled(id,revision,enabled)`, `setDefault(id|null,settingsRevision)`, `getEnabled(id)`, `getForAdmin(id)`, `recordTest(id,revision,mode,status,details)`; public list `{profiles,defaultProfileId,settingsRevision}`. Each profile has id,name,provider,model,baseURL,hasApiKey,enabled,revision,timeoutMs,maxOutputTokens,thinking,lastTests. Internal profile additionally has apiKey,transport. Export runtime `generateProfileResponse(messages,profile,{signal?,purpose?})`, `fetchProfileModels(profile)`, `classifyLLMError(error)` and catalog `PROVIDERS`. Factory key path helper accepts explicit isolated path.

- [x] Write failing tests: encrypt/decrypt, key loss, endpoint change requires new key, mandatory stale revision, multiple enabled profiles, default cleanup, revision-fenced quick tests, three protocols and upstream failure redaction.
- [x] Run `pnpm exec vitest run --config vitest.ai-management.config.ts` in server and verify missing implementation failure.
- [x] Add Prisma models AIProfile and AIConfiguration with atomic updates; use existing runtime connection dependency injected rather than opening live DB on import.
- [x] Port catalog/runtime from attached source to TS; use host safeExternalFetch, preserve HTTPS/SSRF and bounded responses; support configured 5–300 s timeout using optional host transport timeout override limited to AI callers.
- [x] Run unit tests; generate Prisma types without DB migration; review service contracts and note evidence.

### Task 2: Role-protected APIs and question production

**Files:** new `server/api-routes/ai-management.ts`, `server/services/ai-management-instance.ts`; modify `server/api-routes/ai.ts`, route registration and academic middleware narrowly; new API tests.
**Interfaces:** `/api/admin/ai/{catalog,profiles,profiles/:id,profiles/:id/enabled,profiles/:id/test,profiles/:id/models,default,import-gemini}`; `/api/ai/models` safe projection; `/api/ai/generate-questions` uses `{profileId,topic,count,difficulty,questionType?,contentType}`.

- [x] Add failing tests using injected store/runtime and actual Express auth; teacher admin-route denial, student/parent list denial, forbidden override fields, disabled selection, revision conflicts and safe errors.
- [x] Mount admin router behind host auth/role; retain host CSRF. Add per-user limit and concurrency gate for test/generation. Legacy test-config only admin or explicit retirement response.
- [x] Replace only provider resolution/call in existing question route; retain prompt, parsing, correct-answer and survey validation. New body strict schema rejects custom URL/key/model.
- [x] Preserve ongoing calls on profile snapshot; no network call inside DB transaction; cancel on connection close. Quick test success enables current revision only; sample test uses actual question prompt/parser.
- [x] Add explicit admin import of env Gemini key to fixed official provider address; never return key. Configuration unavailable does not stop exam service.
- [x] Run route tests and existing relevant question regressions adapted to managed profiles.

### Task 3: Admin page and teacher selector

**Files:** `client/src/lib/ai-management-api.ts`, `pages/ai-management.tsx`, form/table components if useful; `components/quiz/AIQuestionGenerator.tsx`, App routes and DashboardLayout; new UI tests.

- [x] Write failing component tests: no teacher secret/URL fields, model load/error/empty, selection and production, admin form key preservation and conflict.
- [x] Build same-panel admin page with profile CRUD, provider catalog/manual model/model discovery, enabled toggle/default and separate quick/sample tests.
- [x] Replace teacher advanced config with server model list; preserve title-derived topic, difficulty/count, exam/survey, callback and toast behavior.
- [x] Add loading/cancel/stale completion guards and disable duplicate writes; admin-only route/menu. AI page is installation-scoped even when academic context historical; preserve all other historical behavior.
- [x] Run component tests and client type check.

### Task 4: Maintenance, integration and acceptance

**Files:** `scripts/maintenance-lib.mjs`, backup tests, README, admin/teacher/bakım docs, isolated browser proof script if needed.

- [x] Add failing backup/restore test for encryption key preservation and allowlisted manifest.
- [x] Include only fixed `server/data/ai-encryption.key` private file beside DB snapshot; no env mutation; restore rejects unsafe target/manifest paths.
- [x] Apply all migration SQL in owned synthetic fixture and create encrypted profile; separately run production admin and teacher browser flow with mocked API boundary; no real external key/call. CLI deploy and complete backend/browser E2E are not claimed.
- [x] Run relevant server/client tests, type checks and standard build; review changes for permissions, data leakage, academic/history and quiz behavior regressions.
- [x] Update docs with setup, model management and limits. Recheck protected file/DB hashes; record actual passed checks, leave unsupported claims out.

## Progress

- Design approved by user; implementation and targeted acceptance completed. Exact evidence and limits are in the results report.

Acceptance: docs/2026-10-15-ai-management-results.md records exact tests and limits. Full live backend/provider E2E and CLI deploy rehearsal remain out of acceptance; no live DB or deployment performed.
