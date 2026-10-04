# AI integration audit

Historical pre-repair audit. The answer fallback, input/output validation and stale readiness findings below were subsequently addressed; current acceptance and live-provider recheck are recorded in [defect-repairs.md](defect-repairs.md). Original failing results are retained under `before-repairs/` and original offline characterization results remain unchanged.

## Evidence and scope

`ai-offline-results.json`: 22/22 cases passed with actual Express/auth/AI routes and provider responses mocked at `safeExternalFetch`. No application database or external provider calls. Three cases characterize current defects; passing does not mean these defects are repaired. These are route integration tests, not live Google/TLS tests.

The separately guarded `ai-live.test.ts` makes at most two real official-Google requests: a five-token connection probe followed, only on success, by one synthetic arithmetic question. It loads key configuration in application precedence order, uses the backend default model, mocks only storage/logging, and validates generated count/type/options/correct answer index. It writes sanitized status-only evidence. It does not save generated questions or user data.

The authorized real Google test ran on 2026-10-04 after the user updated the key. `ai-live-evidence.json` records credentials configured = true, two provider requests, connection probe HTTP 200 and generation HTTP 200. `ai-live-results.json` records **1 failed test, 0 passed**: generated answer/index consistency failed. The selected option was the synthetic number `83` while `correctAnswer` was the letter `A`. This reproduces the answer-index fallback defect with the real provider; successful HTTP responses do not mean valid generated scoring data.

The earlier key's HTTP 402 connection rejection remains separately recorded in `ai-live-previous-key.json`. Missing-key observations from initial inspection are superseded by the actual successful connection and generation requests.

## Cases

| Area | Exercised |
| --- | --- |
| Access | Unauthenticated, student and parent blocked before provider call |
| Credentials | Official endpoint fallback; custom endpoint never receives server key; explicit custom key |
| Endpoint security | HTTP, localhost and loopback blocked |
| Responses | Raw array, questions wrapper, markdown JSON and explanatory text fallback |
| Exam semantics | Option shuffling retains correct answer reference |
| Survey semantics | Rating config and null correct answer preserved |
| Failures | Malformed schema, unparseable JSON, empty message, provider 429 and abort |
| Defect observations | Empty array accepted, missing answer selects option zero, unchecked topic/count reaches provider |

## Findings

1. `server/api-routes/ai.ts:306`: a provider answer absent from options falls back to index zero. Invalid AI questions can therefore be saved with a wrong scoring answer. Reproduced both offline and with the authorized real Google generation: numeric options were paired with a letter answer and the validator failed.
2. `server/api-routes/ai.ts:183`: no incoming request schema checks topic/count/difficulty/model. Missing topic and negative count reach the provider. Reproduced offline.
3. `server/api-routes/ai.ts:55`: response arrays have no minimum/count constraint. Empty array returns HTTP 200. Reproduced offline; UI later displays an error.
4. `client/src/components/quiz/AIQuestionGenerator.tsx:288`, `:299`, `:310`: changing custom base URL/key/model does not clear successful `testResult`; readiness remains attached to previous settings. Source observation, not browser reproduced here.
5. `server/api-routes/ai.ts:121`, `:187`: default is `gemini-3.8-flash`. The real connection and generation requests both returned HTTP 200 using this exact default. Google also documents this model at [Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash). Model availability is verified for the tested key and run.

## Re-run

From repository root (PowerShell):

```powershell
pnpm --filter quiz-master-server exec vitest run --config F:/projeler/yeni-quizmaster-main/docs/integration-audit/ai-offline.config.mts --root F:/projeler/yeni-quizmaster-main --reporter=json --outputFile=F:/projeler/yeni-quizmaster-main/docs/integration-audit/ai-offline-results.json
```

For the authorized live test, configure `GEMINI_API_KEY` locally in `server/.env`, root `.env`, or process environment without putting the key in command arguments or logs. Then:

```powershell
$env:LIVE_AI='1'
pnpm --filter quiz-master-server exec vitest run --config F:/projeler/yeni-quizmaster-main/docs/integration-audit/ai-live.config.mts --root F:/projeler/yeni-quizmaster-main --reporter=json --outputFile=F:/projeler/yeni-quizmaster-main/docs/integration-audit/ai-live-results.json
Remove-Item Env:LIVE_AI
```

Skipped live test means blocked, never a successful real provider integration. The live route harness bypasses application session persistence and CSRF by building a synthetic authenticated Express app; full browser session/CSRF integration is a separate audit.
