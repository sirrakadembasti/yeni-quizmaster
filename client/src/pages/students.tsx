import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  UserPlus,
  Loader2,
  BookOpen,
  Filter
} from "lucide-react";
import { useState, useMemo } from "react";
import { userApi, classApi, resultApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserManagementTable, type User } from "@/components/management/UserManagementTable";
import { UserFormModal } from "@/components/management/UserFormModal";
import { DeleteConfirmModal } from "@/components/management/DeleteConfirmModal";
import { useUserManagement } from "@/hooks/use-user-management";

export default function StudentsPage() {
  const { role, user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClassFilter, setSelectedClassFilter] = useState("all");
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  
  const {
    isCreateOpen, setIsCreateOpen,
    isEditOpen, setIsEditOpen,
    isDeleteOpen, setIsDeleteOpen,
    selectedUser, setSelectedUser,
    createMutation,
    updateMutation,
    deleteMutation,
    handleEdit,
    handleDelete
  } = useUserManagement('student');

  // Data Queries
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.getAllUsers(),
  });

  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: () => role === 'teacher' ? classApi.getTeacherClasses() : classApi.getAllClasses(),
  });

  const { data: studentResults, isLoading: resultsLoading } = useQuery({
    queryKey: ['student-results', selectedUser?.id],
    queryFn: () => resultApi.getStudentResults(selectedUser?.id),
    enabled: !!selectedUser && isDetailsOpen,
  });

  const students = useMemo(() => {
    if (!usersData?.users) return [];
    let list = usersData.users.filter(u => u.role === 'student');
    
    // Öğretmen ise sadece kendi sınıflarındaki öğrencileri görsün
    if (role === 'teacher' && classesData?.classes) {
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
    setSelectedUser(user);
    setIsDetailsOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
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
        </div>

        <div className="flex flex-col md:flex-row gap-4">
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

        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                {selectedUser?.name} - Sınav Sonuçları
              </DialogTitle>
              <DialogDescription>Öğrencinin performans dökümü aşağıdadır.</DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sınav Adı</TableHead>
                    <TableHead className="text-center">Puan</TableHead>
                    <TableHead className="text-center">Doğru/Yanlış</TableHead>
                    <TableHead className="text-right">Tarih</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultsLoading ? (
                    <TableRow><TableCell colSpan={4} className="h-20 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></TableCell></TableRow>
                  ) : studentResults?.results?.filter((r: any) => role === 'admin' || r.quiz?.createdBy === user?.id).length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="h-20 text-center text-muted-foreground">Sonuç bulunamadı.</TableCell></TableRow>
                  ) : (
                    studentResults?.results?.filter((r: any) => role === 'admin' || r.quiz?.createdBy === user?.id).map((result: any) => (
                      <TableRow key={result.id}>
                        <TableCell className="font-bold">{result.quizTitle || result.quiz?.title}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={result.score >= 70 ? "bg-emerald-500" : result.score >= 45 ? "bg-amber-500" : "bg-rose-500"}>
                            {result.score}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {result.correctAnswers} / {result.totalQuestions}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {new Date(result.submittedAt).toLocaleDateString('tr-TR')}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>

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
