import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Filter, Search, UserPlus } from "lucide-react";
import { useState, useMemo } from "react";
import { userApi, classApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserManagementTable, type User } from "@/components/management/UserManagementTable";
import { UserFormModal } from "@/components/management/UserFormModal";
import { DeleteConfirmModal } from "@/components/management/DeleteConfirmModal";
import { useUserManagement } from "@/hooks/use-user-management";
import { useLocation } from "wouter";
import { PrintButton, PrintMeta } from "@/components/print/PrintTools";
import { downloadCsv, type CsvColumn } from "@/lib/export";

export default function StudentsPage() {
  const { role, user: currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClassFilter, setSelectedClassFilter] = useState("all");

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
  } = useUserManagement('student');

  // Data Queries
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users', currentUser?.id, role],
    queryFn: () => userApi.getAllUsers(),
  });

  const { data: classesData } = useQuery({
    queryKey: ['/api/classes', currentUser?.id, role],
    queryFn: () => classApi.getAllClasses(),
  });

  const students = useMemo(() => {
    if (!usersData?.users) return [];
    let list = usersData.users.filter(u => u.role === 'student');

    // Öğretmen ise sadece kendi sınıflarındaki öğrencileri görsün
    if (role === 'teacher') {
      if (!classesData?.classes) return [];
      const myClassIds = classesData.classes.map(c => c.id);
      list = list.filter(s => s.classId && myClassIds.includes(s.classId));
    }

    return list.filter(student => {
      const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          student.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesClass = selectedClassFilter === "all" || student.classId === selectedClassFilter;
      return matchesSearch && matchesClass;
    });
  }, [usersData, role, classesData, searchTerm, selectedClassFilter]);

  const openDetails = (user: User) => {
    // Modal yerine öğrenci sonuç sayfasına yönlendiriyoruz
    setLocation(`/student/results?studentId=${user.id}`);
  };

  const exportStudents = () => {
    const columns: Array<CsvColumn<any>> = [
      { header: "Ad Soyad", value: "name" },
      { header: "E-posta", value: "email" },
      { header: "Sınıf", value: (student: any) => classesData?.classes?.find((item: any) => item.id === student.classId)?.name || "Atanmamış" },
      { header: "Öğrenci No", value: (student: any) => student.studentNo || student.classNo || "" },
      { header: "Telefon", value: "phoneNumber" },
      { header: "Adres", value: "address" },
    ];
    if (role === "admin") columns.push(
      { header: "Veli Adı", value: "parentName" },
      { header: "Yakınlık", value: "parentRelation" },
      { header: "Veli Telefonu", value: "parentPhone" },
      { header: "Veli E-postası", value: "parentEmail" },
      { header: "Veli Adresi", value: "parentAddress" },
    );
    downloadCsv({
      filename: `ogrenci_listesi_${new Date().toISOString().slice(0, 10)}.csv`,
      title: "Öğrenci Listesi",
      filters: [
        { label: "Arama", value: searchTerm || "Tümü" },
        { label: "Sınıf", value: classesData?.classes?.find((item: any) => item.id === selectedClassFilter)?.name || "Tüm sınıflar" },
        { label: "Kayıt Sayısı", value: students.length },
      ],
      columns,
      rows: students,
    });
  };
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PrintMeta
          title="Öğrenci Listesi"
          filters={[
            { label: "Arama", value: searchTerm || "Tümü" },
            { label: "Sınıf", value: classesData?.classes?.find((item: any) => item.id === selectedClassFilter)?.name || "Tüm sınıflar" },
          ]}
        />
        <div className="flex justify-between items-center print:hidden no-print">
          <div>
            <h1 className="text-3xl font-heading font-bold">Öğrenci Yönetimi</h1>
            <p className="text-muted-foreground mt-1">
              {role === 'admin' ? 'Tüm öğrencileri yönetin.' : 'Sınıflarınızdaki öğrencileri izleyin.'}
            </p>
          </div>
          {role === 'admin' && (
            <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
              <UserPlus className="h-4 w-4" /> Yeni Öğrenci
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportStudents} disabled={!students.length} className="rounded-xl"><Download className="mr-2 h-4 w-4" />CSV</Button>
            <PrintButton className="rounded-xl" />
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 print:hidden no-print">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Öğrenci ara..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full md:w-64 flex gap-2">
            <span className="sr-only">Sınıf Filtresi</span>
            <Select value={selectedClassFilter} onValueChange={setSelectedClassFilter}>
              <SelectTrigger className="bg-card">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Sınıf Seçin" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Sınıflar</SelectItem>
                {classesData?.classes?.map((cls: any) => (
                  <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <UserManagementTable
          users={students}
          isLoading={usersLoading}
          role="student"
          classes={classesData?.classes}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onDetails={openDetails}
          canManage={role === 'admin'}
        />

        <UserFormModal
          isOpen={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          mode="create"
          role="student"
          onSubmit={(data) => createMutation.mutate(data)}
          isPending={createMutation.isPending}
        />

        <UserFormModal
          isOpen={isEditOpen}
          onOpenChange={setIsEditOpen}
          mode="edit"
          role="student"
          initialData={selectedUser}
          onSubmit={(data) => updateMutation.mutate(data)}
          isPending={updateMutation.isPending}
        />

        <DeleteConfirmModal
          isOpen={isDeleteOpen}
          onOpenChange={setIsDeleteOpen}
          onConfirm={() => deleteMutation.mutate()}
          title="Öğrenciyi Sil"
          description={`"${selectedUser?.name}" isimli öğrenciyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
          isPending={deleteMutation.isPending}
        />
      </div>
    </DashboardLayout>
  );
}
