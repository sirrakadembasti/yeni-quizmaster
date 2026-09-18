# Original User Request

## 2026-09-18T13:54:59Z

Admin student detail page CRUD for student and parent tabs, student profile read-only notice, remove student leading icon in class list, and teacher CRUD in teacher detail page.

Working directory: D:\dnm\quiz\Quiz-Master
Integrity mode: development

## Requirements

### R1. Admin Student & Parent Details CRUD
On the student detail page (`/students/:id`, `client/src/pages/student-results.tsx`), when logged in as admin, the admin must be able to perform edit operations on "2. Öğrenci Bilgileri" and "3. Veli Bilgileri" tabs. Integrate the existing `UserFormModal` (`client/src/components/management/UserFormModal.tsx`) to edit both student details and parent details (`parentName`, `parentRelation`, `parentPhone`, `parentEmail`, `parentAddress`). Data must refresh upon save via query invalidation.

### R2. Student Profile Read-Only Restriction
When a student views their own profile page (`/settings`, `client/src/pages/settings.tsx`), their personal and contact information (phone, address) must be disabled / read-only. A clear warning notice must be displayed instructing the student: "Kişisel ve iletişim bilgilerinizde değişiklik yapmak istiyorsanız lütfen okul yönetimi ile iletişime geçiniz."

### R3. Remove Leading Student Icon in Class Detail
On the class detail page (`/classes/:id`, `client/src/pages/class-detail.tsx`), in the student roster table ("Sınıf Mevcudu"), remove the circular/square leading avatar badge containing the first letter of the student's name before their name. Display only the student's name and number cleanly.

### R4. Teacher CRUD in Teacher Detail Page
On the teacher detail page (`/teachers/:id`, `client/src/pages/teacher-detail.tsx`), add "Öğretmeni Düzenle" (Edit) and "Öğretmeni Sil" (Delete) action buttons for admin users. Use existing `UserFormModal` and `DeleteConfirmModal` so admin can manage teacher info directly from the detail view.

## Acceptance Criteria

### Verification & Integrity
- [x] TypeScript build passes without any errors using `powershell -ExecutionPolicy Bypass -File D:\dnm\start-project.ps1 -ProjectPath D:\dnm\quiz\Quiz-Master -Script build`.
- [x] Existing client unit tests pass via `powershell -ExecutionPolicy Bypass -Command ". D:\dnm\use-node.ps1; cd client; pnpm test run"`.
- [x] Existing app architecture, schemas, and routing remain unbroken.
