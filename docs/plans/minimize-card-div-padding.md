# Implementation Plan: Minimize Card and Div Inner Spacing

## Overview
Reduce excessive inner padding and margin inside cards, divs, and the text elements within them across the Quiz-Master frontend application. Remove legacy hardcoded padding that was preventing prior minimization attempts from taking effect.

## Global Constraints
- Do not break existing responsive layouts, navigation, or data display.
- Keep cards aesthetically clean, readable, and functional.
- The build script for verification MUST be executed via: `powershell -ExecutionPolicy Bypass -File D:\dnm\start-project.ps1 -ProjectPath D:\dnm\quiz\Quiz-Master -Script build`.
- Preserve existing theme colors, dark mode support, and print styles.

---

### Task 1: Minimize Base Card Component Padding
**Files**: `client/src/components/ui/card.tsx`
**Action**:
- In `CardHeader`: change `p-4 sm:p-5 space-y-1` to `p-2.5 sm:p-3 space-y-0.5`.
- In `CardTitle`: ensure tracking and compact font styling.
- In `CardContent`: change `p-4 sm:p-5 pt-0` to `p-2.5 sm:p-3 pt-0`.
- In `CardFooter`: change `p-4 sm:p-5 pt-0` to `p-2.5 sm:p-3 pt-0`.
- Run frontend unit tests to verify `card.tsx` renders properly.

---

### Task 2: Enhance Global CSS Rules for Cards, Divs, and Typography
**Files**: `client/src/index.css`
**Action**:
- In `client/src/index.css`, under `.dashboard-page`, add utility classes and card slot overrides:
  - `[data-slot="card-header"]`: ensure default padding is compact `0.625rem 0.75rem`.
  - `[data-slot="card-content"]`: ensure default padding is `0 0.75rem 0.625rem 0.75rem`.
  - `[data-slot="card-footer"]`: ensure default padding is `0 0.75rem 0.625rem 0.75rem`.
- Add compact text rules for cards (`leading-snug`, reduced margins on headings and paragraphs).
- Update `.data-panel` from `p-4 / sm:p-5` to `p-2.5 / sm:p-3` and `.data-panel-compact` to `p-2`.

---

### Task 3: Refactor High Hardcoded Padding on Divs and Cards Across Pages
**Files**:
- `client/src/pages/dashboard.tsx`
- `client/src/pages/student-dashboard.tsx`
- `client/src/pages/student-results.tsx`
- `client/src/pages/quizzes.tsx`
- `client/src/pages/admin-class-detail.tsx`
- `client/src/pages/admin-management.tsx`
- `client/src/pages/announcements.tsx`
- `client/src/pages/results.tsx`
**Action**:
- Replace instances where `<CardContent className="p-6">` or `p-5` overrides base card padding with compact classes (`p-3` or `p-2.5`).
- Replace outer card-like `div` elements with `p-6` or `p-5` or `p-8` with `p-3` to `p-4`.
- Reduce vertical spacing between inner elements (`space-y-6` / `space-y-8` -> `space-y-3` / `space-y-4`, `gap-6` -> `gap-3` / `gap-4`).

---

### Task 4: Complete Build and Test Verification
**Files**: Whole repository
**Action**:
- Run `powershell -ExecutionPolicy Bypass -File D:\dnm\start-project.ps1 -ProjectPath D:\dnm\quiz\Quiz-Master -Script build`.
- Run frontend unit tests with pnpm / vitest.
- Ensure zero regression, clean build, and verify all modified pages bundle properly.
