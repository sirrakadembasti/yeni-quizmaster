import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { classApi, userApi, categoryApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  ArrowLeft, 
  Users, 
  GraduationCap, 
  BookOpen, 
  Plus, 
  Trash2, 
  UserPlus,
  Loader2,
  ChevronRight,
  ShieldCheck,
  Search
} from "lucide-react";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudentToAdd, setSelectedStudentToAdd] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");

  const { data: cls, isLoading: classLoading } = useQuery({
    queryKey: [`/api/classes/${id}`],
    queryFn: () => classApi.getClass(id),
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['/api/users'],
    queryFn: () => userApi.getAllUsers(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['/api/categories'],
    queryFn: () => categoryApi.getAllCategories(),
  });

  const students = useMemo(() => usersData?.users.filter(u => u.role === 'student') || [], [usersData]);
  const teachers = useMemo(() => usersData?.users.filter(u => u.role === 'teacher') || [], [usersData]);

  const classStudents = useMemo(() => 
    students.filter(s => s.classId === id && s.name.toLowerCase().includes(searchTerm.toLowerCase())), 
    [students, id, searchTerm]
  );

  const availableStudents = useMemo(() => 
    students.filter(s => s.classId !== id),
    [students, id]
  );

  const assignStudentMutation = useMutation({
    mutationFn: (studentId: string) => classApi.assignStudentToClass(id, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: [`/api/classes/${id}`] });
      setSelectedStudentToAdd("");
      toast({ title: "Başarılı", description: "Öğrenci sınıfa eklendi." });
    }
  });

  const removeStudentMutation = useMutation({
    mutationFn: (studentId: string) => classApi.removeStudentFromClass(studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: [`/api/classes/${id}`] });
      toast({ title: "Başarılı", description: "Öğrenci sınıftan çıkarıldı." });
    }
  });

  const assignTeacherMutation = useMutation({
    mutationFn: (data: { teacherId: string, categoryId: string }) => 
      classApi.assignTeacherToClassWithCourse(id, data.teacherId, data.categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/classes/${id}`] });
      setSelectedTeacherId("");
      setSelectedCategoryId("");
      toast({ title: "Başarılı", description: "Öğretmen atandı." });
    }
  });

  const removeTeacherMutation = useMutation({
    mutationFn: (assignmentId: string) => classApi.removeTeacherFromClassWithCourse(assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/classes/${id}`] });
      toast({ title: "Başarılı", description: "Öğretmen ataması kaldırıldı." });
    }
  });

  if (classLoading || usersLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!cls) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold">Sınıf bulunamadı.</h2>
          <Button asChild className="mt-4">
            <Link href="/admin-management">Geri Dön</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="rounded-full">
              <Link href="/admin-management"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-black tracking-tight">{cls.name}</h1>
                <Badge variant="outline" className="rounded-lg font-bold uppercase tracking-widest text-[10px] py-1 bg-primary/5 text-primary border-primary/20">
                  {classStudents.length} Öğrenci
                </Badge>
              </div>
              <p className="text-muted-foreground font-medium">{cls.description || "Açıklama belirtilmemiş"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="flex flex-col items-end">
                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Sorumlu Öğretmen</span>
                <span className="font-bold text-foreground">{cls.classTeacher?.name || "Atanmamış"}</span>
             </div>
             <div className="h-10 w-10 rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
                <ShieldCheck className="h-5 w-5" />
             </div>
          </div>
        </header>

        <Tabs defaultValue="students" className="w-full">
          <TabsList className="bg-muted p-1 rounded-xl mb-6">
            <TabsTrigger value="students" className="rounded-lg font-bold px-8">Öğrenci Yönetimi</TabsTrigger>
            <TabsTrigger value="teachers" className="rounded-lg font-bold px-8">Öğretmen & Branş Atamaları</TabsTrigger>
          </TabsList>

          <TabsContent value="students" className="space-y-6 m-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Add Student Sidebar */}
              <Card className="rounded-3xl border-border bg-card h-fit">
                <CardHeader>
                  <CardTitle className="text-lg font-black">Öğrenci Ekle</CardTitle>
                  <CardDescription>Bu sınıfa yeni bir öğrenci dahil edin.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Öğrenci Seçin</Label>
                    <Select value={selectedStudentToAdd} onValueChange={setSelectedStudentToAdd}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Sistemden öğrenci seçin..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {availableStudents.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} {s.class?.name ? `(${s.class.name})` : "(Sınıfsız)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    className="w-full rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white" 
                    disabled={!selectedStudentToAdd || assignStudentMutation.isPending}
                    onClick={() => assignStudentMutation.mutate(selectedStudentToAdd)}
                  >
                    {assignStudentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
                    Sınıfa Kaydet
                  </Button>
                </CardContent>
              </Card>

              {/* Student List */}
              <Card className="lg:col-span-2 rounded-3xl border-border bg-card overflow-hidden">
                <CardHeader className="border-b border-border pb-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <CardTitle className="text-lg font-black">Sınıf Mevcudu</CardTitle>
                    <div className="relative w-full md:w-64">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Öğrenci ara..." 
                        className="pl-9 rounded-xl bg-muted border-transparent"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-20 pl-6 font-black text-[10px] uppercase tracking-widest text-muted-foreground">No</TableHead>
                        <TableHead className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Öğrenci</TableHead>
                        <TableHead className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">E-Posta</TableHead>
                        <TableHead className="text-right pr-6 font-black text-[10px] uppercase tracking-widest text-muted-foreground">İşlem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {classStudents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic">
                            Bu sınıfta öğrenci bulunamadı.
                          </TableCell>
                        </TableRow>
                      ) : (
                        classStudents.map((student) => (
                          <TableRow key={student.id} className="group hover:bg-muted/50 border-border transition-colors">
                            <TableCell className="pl-6 font-black text-indigo-600 dark:text-indigo-400">
                              #{student.studentNo || "-"}
                            </TableCell>
                            <TableCell className="font-bold">{student.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground font-medium">{student.email}</TableCell>
                            <TableCell className="text-right pr-6">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                onClick={() => removeStudentMutation.mutate(student.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="teachers" className="space-y-6 m-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Assign Teacher Card */}
              <Card className="rounded-3xl border-border bg-card h-fit">
                <CardHeader>
                  <CardTitle className="text-lg font-black">Branş Öğretmeni Ata</CardTitle>
                  <CardDescription>Sınıfa ders ve sorumlu öğretmen atayın.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Ders (Kategori)</Label>
                    <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Ders seçin..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Öğretmen</Label>
                    <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Öğretmen seçin..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {teachers.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    className="w-full rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white" 
                    disabled={!selectedTeacherId || !selectedCategoryId || assignTeacherMutation.isPending}
                    onClick={() => assignTeacherMutation.mutate({ teacherId: selectedTeacherId, categoryId: selectedCategoryId })}
                  >
                    {assignTeacherMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                    Atamayı Kaydet
                  </Button>
                </CardContent>
              </Card>

              {/* Assigned Teachers List */}
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                {cls.teacherAssignments?.map((ta: any) => (
                  <Card key={ta.id} className="rounded-3xl border-border bg-card group hover:border-primary/30 transition-all overflow-hidden">
                    <div className="p-5 flex justify-between items-start">
                      <div className="flex gap-4">
                        <div className="h-12 w-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                          <BookOpen className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest">{ta.category?.name}</p>
                          <h4 className="text-base font-black text-foreground">{ta.teacher?.name}</h4>
                          <p className="text-xs font-medium text-muted-foreground">{ta.teacher?.email}</p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        onClick={() => removeTeacherMutation.mutate(ta.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
                {(!cls.teacherAssignments || cls.teacherAssignments.length === 0) && (
                  <div className="col-span-full py-12 text-center bg-muted/30 rounded-3xl border-2 border-dashed border-border italic text-muted-foreground font-medium">
                    Henüz branş öğretmeni atanmamış.
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
