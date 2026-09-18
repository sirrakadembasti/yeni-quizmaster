# Admin CRUD, Student Settings Notice, Class Roster Avatar, and Teacher Detail Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement admin CRUD for student and parent tabs on student detail page, read-only restriction and school admin notice for student profile, remove initial avatar in class roster, and add admin edit/delete actions on teacher detail page.

**Architecture:** 
- In `client/src/pages/class-detail.tsx`, remove the avatar initial box before the student name in the "Sınıf Mevcudu" table.
- In `client/src/pages/settings.tsx`, restrict student profile editing when `user.role === 'student'`, make personal & parent fields read-only/disabled, and display the official contact notice.
- In `client/src/pages/student-results.tsx`, integrate `UserFormModal` and `useUserManagement('student')` to allow admins to edit student & parent details in Tab 2 and Tab 3, updating and invalidating data on save.
- In `client/src/pages/teacher-detail.tsx`, integrate `UserFormModal` and `DeleteConfirmModal` for admin users to edit or delete the teacher directly from the detail view.

**Tech Stack:** React, TypeScript, Wouter, TanStack Query, TailwindCSS, Lucide-React, Shadcn UI.

**Spec:** `ORIGINAL_REQUEST.md`

## Global Constraints

- Preserve all existing routes, styling conventions, Turkish labels, and TypeScript type safety.
- Use `UserFormModal` (`client/src/components/management/UserFormModal.tsx`) and `DeleteConfirmModal` (`client/src/components/management/DeleteConfirmModal.tsx`) without breaking changes.
- In `client/src/pages/settings.tsx`, notice text MUST match: "Kişisel ve iletişim bilgilerinizde değişiklik yapmak istiyorsanız lütfen okul yönetimi ile iletişime geçiniz."
- Verification must pass: client vitest tests and TypeScript compilation.

---

### Task 1: Remove Leading Student Avatar Icon in Class Detail Roster

**Files:**
- Modify: `client/src/pages/class-detail.tsx:174-184`

**Interfaces:**
- Consumes: `filteredStudents` list in `ClassDetailPage`
- Produces: Clean student name and number display in table without circular/square initial avatar

- [ ] **Step 1: Locate avatar box in student roster table**
In `client/src/pages/class-detail.tsx`, find lines 176-181:
```tsx
<TableCell className="py-2">
  <div className="flex items-center gap-2.5">
    <div className="h-7 w-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-sm group-hover:scale-105 transition-transform print:hidden">
      {s.name[0].toUpperCase()}
    </div>
    <span className="font-bold text-sm text-foreground tracking-tight">{s.name}</span>
  </div>
</TableCell>
```

- [ ] **Step 2: Remove the avatar div and display name directly**
Update to:
```tsx
<TableCell className="py-2">
  <span className="font-bold text-sm text-foreground tracking-tight">{s.name}</span>
</TableCell>
```

- [ ] **Step 3: Verify TypeScript and styling**
Ensure no unused variables and table row renders cleanly.

- [ ] **Step 4: Commit**
```bash
git add client/src/pages/class-detail.tsx
git commit -m "feat(class-detail): remove leading student avatar box from roster table"
```

---

### Task 2: Student Profile Read-Only Restriction and Notice in Settings

**Files:**
- Modify: `client/src/pages/settings.tsx:45-70, 230-370`

**Interfaces:**
- Consumes: `user` from `useAuth()`, checks `user?.role === 'student'`
- Produces: Disabled form fields for student, hidden save button, and warning banner with exact text:
  `Kişisel ve iletişim bilgilerinizde değişiklik yapmak istiyorsanız lütfen okul yönetimi ile iletişime geçiniz.`

- [ ] **Step 1: Check user role in SettingsPage**
Determine `const isStudent = user?.role === 'student';`.

- [ ] **Step 2: Add Student Read-Only Notice Box**
In the profile tab when `isStudent` is true, render an alert/callout:
```tsx
{isStudent && (
  <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-amber-900 dark:text-amber-200">
    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
    <div className="text-sm font-medium">
      <p className="font-bold">Bilgilendirme</p>
      <p>Kişisel ve iletişim bilgilerinizde değişiklik yapmak istiyorsanız lütfen okul yönetimi ile iletişime geçiniz.</p>
    </div>
  </div>
)}
```

- [ ] **Step 3: Disable personal inputs for students & hide save button**
For `isStudent`:
- Make `name`, `email`, and any personal contact inputs `disabled` / read-only with appropriate styling (`cursor-not-allowed bg-muted/40`).
- If `isStudent`, do not render the "Değişiklikleri Kaydet" submit button in `CardFooter` (or disable it completely).

- [ ] **Step 4: Verify settings view and commit**
```bash
git add client/src/pages/settings.tsx
git commit -m "feat(settings): restrict student profile editing with admin contact notice"
```

---

### Task 3: Admin Student & Parent Details CRUD in Student Detail Page

**Files:**
- Modify: `client/src/pages/student-results.tsx:135-245, 325-350`

**Interfaces:**
- Consumes: `student` object, `useUserManagement('student')` or custom mutation calling `userApi.updateUser`
- Produces: Edit button on Tab 2 ("Öğrenci Bilgileri") and Tab 3 ("Veli Bilgileri") when logged in as admin, opening `UserFormModal`, and refreshing data upon save.

- [ ] **Step 1: Add edit state and mutation to student-results.tsx**
Import `UserFormModal` and setup state:
```tsx
const [isEditOpen, setIsEditOpen] = useState(false);
const queryClient = useQueryClient();
```
Add refetch handler after successful save.

- [ ] **Step 2: Add "Bilgileri Düzenle" buttons to headers of Tab 2 and Tab 3**
In `renderStudentContent`:
Add an "Öğrenci Bilgilerini Düzenle" button in `CardHeader` when `role === 'admin'`.
In `renderParentContent`:
Add a "Veli Bilgilerini Düzenle" button in `CardHeader` when `role === 'admin'`.

- [ ] **Step 3: Render UserFormModal with initialData and submission logic**
Pass `student` as `initialData` into `UserFormModal` with `mode="edit"` and `role="student"`.
On submit, call `userApi.updateUser(student.id, data)`:
- Invalidate query / re-fetch student.
- Update `student` state with the response.
- Display toast notification.

- [ ] **Step 4: Commit**
```bash
git add client/src/pages/student-results.tsx
git commit -m "feat(student-results): add admin student and parent edit modals"
```

---

### Task 4: Teacher CRUD in Teacher Detail Page

**Files:**
- Modify: `client/src/pages/teacher-detail.tsx:90-145`

**Interfaces:**
- Consumes: `teacher` object, `useAuth()` (`role === 'admin'`), `userApi.updateUser`, `userApi.deleteUser`
- Produces: "Öğretmeni Düzenle" and "Öğretmeni Sil" buttons in header/profile card for admins, with `UserFormModal` and `DeleteConfirmModal`. Redirect to `/teachers` on delete.

- [ ] **Step 1: Import modals and auth**
Import `useAuth`, `UserFormModal`, `DeleteConfirmModal`, `useMutation`, `useQueryClient`, `useToast`.

- [ ] **Step 2: Add Edit and Delete buttons for admin**
In `TeacherDetailPage`:
If `role === 'admin'`, display buttons:
- "Öğretmeni Düzenle" (opens `isEditOpen`)
- "Öğretmeni Sil" (opens `isDeleteOpen`)

- [ ] **Step 3: Connect update and delete handlers**
- On update: mutate `userApi.updateUser(teacher.id, data)`, invalidate `["users"]`, close modal, show toast.
- On delete: mutate `userApi.deleteUser(teacher.id)`, invalidate `["users"]`, close modal, show toast, `setLocation('/teachers')`.

- [ ] **Step 4: Commit**
```bash
git add client/src/pages/teacher-detail.tsx
git commit -m "feat(teacher-detail): add admin edit and delete actions"
```

---

### Task 5: Final Verification & Test Execution

- [ ] **Step 1: Run client Vitest suite**
Run: `powershell -ExecutionPolicy Bypass -Command ". D:\dnm\use-node.ps1; cd client; pnpm test run"`
Verify all tests pass.

- [ ] **Step 2: Run TypeScript build**
Run: `powershell -ExecutionPolicy Bypass -Command ". D:\dnm\use-node.ps1; cd client; pnpm build"`
Verify build succeeds with zero errors.
