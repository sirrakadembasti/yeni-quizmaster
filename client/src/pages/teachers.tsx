import { AdminQueryState } from "@/components/management/AdminQueryState";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Search, UserPlus } from "lucide-react";
import { useState, useMemo } from "react";
import { userApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { UserManagementTable, type User } from "@/components/management/UserManagementTable";
import { UserFormModal } from "@/components/management/UserFormModal";
import { DeleteConfirmModal } from "@/components/management/DeleteConfirmModal";
import { useUserManagement } from "@/hooks/use-user-management";
import { useLocation } from "wouter";
import { PrintButton, PrintMeta } from "@/components/print/PrintTools";
import { downloadCsv } from "@/lib/export";

export default function TeachersPage() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const {
    isCreateOpen, setIsCreateOpen,
    isEditOpen, setIsEditOpen,
    isDeleteOpen, setIsDeleteOpen,
    selectedUser,
    createMutation,
    updateMutation,
    deleteMutation,
    handleEdit,
    handleDelete
  } = useUserManagement('teacher');

  const openDetails = (user: User) => {
    setLocation(`/teachers/${user.id}`);
  };

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.getAllUsers(),
  });

  const { data: usersData, isLoading } = usersQuery;

  const teachers = useMemo(() => {
    if (!usersData?.users) return [];
    const list = usersData.users.filter(u => u.role === 'teacher');
    return list.filter(teacher =>
      teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [usersData, searchTerm]);

  const exportTeachers = () => downloadCsv({
    filename: `ogretmen_listesi_${new Date().toISOString().slice(0, 10)}.csv`,
    title: "Öğretmen Listesi",
    filters: [{ label: "Arama", value: searchTerm || "Tümü" }, { label: "Kayıt Sayısı", value: teachers.length }],
    columns: [
      { header: "Ad Soyad", value: "name" },
      { header: "E-posta", value: "email" },
      { header: "Telefon", value: "phoneNumber" },
      { header: "Dersler", value: (teacher: any) => teacher.assignedCategories?.map((item: any) => item.name).join(", ") || "" },
      { header: "Dersine Girdiği Sınıflar", value: (teacher: any) => teacher.classes?.map((item: any) => item.name).join(", ") || "" },
      { header: "Sorumlu Sınıflar", value: (teacher: any) => teacher.responsibleForClasses?.map((item: any) => item.name).join(", ") || "" },
    ],
    rows: teachers,
  });
  const pageQueries = [usersQuery];
  if (pageQueries.some(query => query.isPending || query.isError)) return <DashboardLayout><AdminQueryState queries={pageQueries} /></DashboardLayout>;
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PrintMeta title="Öğretmen Listesi" filters={[{ label: "Arama", value: searchTerm || "Tümü" }]} />
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-heading font-bold">Öğretmen Yönetimi</h1>
            <p className="text-muted-foreground mt-1">Öğretmen hesaplarını oluşturun, düzenleyin ve silin.</p>
          </div>
          <div className="flex gap-2 print:hidden no-print">
            <Button variant="outline" onClick={exportTeachers} disabled={!teachers.length}><Download className="mr-2 h-4 w-4" />Excel</Button>
            <PrintButton />
            <Button onClick={() => setIsCreateOpen(true)} className="gap-2"><UserPlus className="h-4 w-4" />Yeni Öğretmen</Button>
          </div>
        </div>

        <div className="flex gap-4 print:hidden no-print">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Öğretmen ara"
              placeholder="Öğretmen adı veya e-posta ile ara..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <UserManagementTable
          users={teachers}
          isLoading={isLoading}
          role="teacher"
          onEdit={handleEdit}
          onDelete={handleDelete}
          onDetails={openDetails}
          canManage={true}
        />

        <UserFormModal 
          isOpen={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          mode="create"
          role="teacher"
          onSubmit={(data) => createMutation.mutate(data)}
          isPending={createMutation.isPending}
        />

        <UserFormModal 
          isOpen={isEditOpen}
          onOpenChange={setIsEditOpen}
          mode="edit"
          role="teacher"
          teacherEditScope="assignments"
          initialData={selectedUser}
          onSubmit={(data) => updateMutation.mutate(data)}
          isPending={updateMutation.isPending}
        />

        <DeleteConfirmModal 
          isOpen={isDeleteOpen}
          onOpenChange={setIsDeleteOpen}
          onConfirm={() => deleteMutation.mutate()}
          title="Öğretmeni Sil"
          description={`"${selectedUser?.name}" isimli öğretmeni silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
          isPending={deleteMutation.isPending}
        />
      </div>
    </DashboardLayout>
  );
}
