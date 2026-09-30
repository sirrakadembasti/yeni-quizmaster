# Admin data integrity: first repair slice

The approved admin audit identified two independent data-loss paths to repair first: teacher creation drops selected assignments, and the question editor loses survey type or shifts the correct answer when options change. This slice changes those paths while preserving the existing admin routes, API response shapes, hybrid terminal/web setup, and unrelated user edits.

Teacher creation will validate admin-provided category and class ID arrays before writing. The existing `createUser` transaction will create the teacher and connect the selected relations together. Empty selections remain valid. Invalid IDs, malformed arrays, or assignments supplied for a non-teacher are rejected without creating an account. A read after creation must show the same relationships that the form submitted.

The question editor will apply consecutive updates to the current React state, so type/options/config changes from one event accumulate. Removing an option will adjust the selected answer index if an earlier option was removed; removing the selected answer will require a new selection before saving. The form's existing API contract remains unchanged.

Real Prisma/API tests and real React component tests will first fail on the desired behavior, then pass after the minimal repairs. The isolated audit browser environment remains available for a final admin workflow check. Later repair slices cover old teacher access, atomic quiz/archive writes, result calculations, and broader UX issues in the audit report.
