# Quiz Master Deficiencies Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address identified security, stability, and code quality deficiencies in the Quiz Master application.

**Architecture:** Implement persistent session storage, robust AI parsing, and improved TypeScript type safety.

**Tech Stack:** Express, Prisma, connect-sqlite3, TypeScript.

---

### Task 1: Session Persistence

**Files:**
- Modify: `Quiz-Master/server/index.ts`

- [ ] **Step 1: Update imports and configure SQLite session store**

```typescript
import session from "express-session";
import connectSqlite3 from "connect-sqlite3";

const SQLiteStore = connectSqlite3(session);

// Inside (async () => { ... }) before app.use(session(...))
app.use(session({
  store: new SQLiteStore({
    db: "sessions.db",
    dir: "./",
  }) as any,
  secret: process.env.SESSION_SECRET || "quiz-master-secret-key",
  // ... rest of config
}));
```

- [ ] **Step 2: Verify server starts and sessions.db is created**

Run: `pnpm --filter quiz-master-server dev`
Expected: Server starts, `sessions.db` appears in `server/` directory.

### Task 2: Robust AI Response Parsing

**Files:**
- Modify: `Quiz-Master/server/api-routes/ai.ts`

- [ ] **Step 1: Implement robust JSON extraction logic**

```typescript
function extractJsonArray(content: string): any[] {
  try {
    // Try direct parse first
    return JSON.parse(content.trim());
  } catch (e) {
    // Try to extract from markdown blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      return JSON.parse(jsonMatch[1].trim());
    }
    // Try to find the first [ and last ]
    const startBracket = content.indexOf('[');
    const endBracket = content.lastIndexOf(']');
    if (startBracket !== -1 && endBracket !== -1) {
      return JSON.parse(content.substring(startBracket, endBracket + 1).trim());
    }
    throw new Error("Could not extract JSON array from AI response");
  }
}
```

- [ ] **Step 2: Update `generate-questions` route to use new extraction logic**

### Task 3: TypeScript Type Safety (Auth & Sessions)

**Files:**
- Modify: `Quiz-Master/server/middleware/auth.ts`
- Modify: `Quiz-Master/server/api-routes/auth.ts`

- [ ] **Step 1: Properly extend SessionData and Request types**
- [ ] **Step 2: Remove `@ts-ignore` comments and use type casting where necessary**

### Task 4: File Upload Security

**Files:**
- Modify: `Quiz-Master/server/api-routes/upload.ts`

- [ ] **Step 1: Add file type and size validation to Multer configuration**
- [ ] **Step 2: Implement cleanup for temporary or failed uploads**
