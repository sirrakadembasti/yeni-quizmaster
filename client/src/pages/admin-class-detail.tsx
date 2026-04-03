import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { classApi, userApi, categoryApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ArrowLeft,
  Users,
  Plus,
  Trash2,
  UserPlus,
  Loader2,
  Search,
  Mail,
  Briefcase,
  GraduationCap,
  BookOpen
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
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function AdminClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudentToAdd, setSelectedStudentToAdd] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedResponsibleTeacherId, setSelectedResponsibleTeacherId] = useState("");

  // Level Warning States
  const [isLevelChangeOpen, setIsLevelChangeOpen] = useState(false);
  const [pendingStudentId, setPendingStudentId] = useState<string | null>(null);
  const [fromLevel, setFromLevel] = useState("");

  // Data Fetching — standart key'ler: ['classes', id], ['users'], ['categories'], ['classes']
  const { data: classData, isLoading: classLoading } = useQuery({
    queryKey: ['classes', id],
    queryFn: () => classApi.getClass(id as string),
    enabled: !!id,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.getAllUsers(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryApi.getAllCategories(),
  });

  const { data: allClassesData } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classApi.getAllClasses(),
  });

  const cls = classData?.class;
  const classStudents = classData?.students || [];
  const students = useMemo(() => usersData?.users.filter(u => u.role === 'student') || [], [usersData]);
  const teachers = useMemo(() => usersData?.users.filter(u => u.role === 'teacher') || [], [usersData]);

  // FILTER & SORT: Unclassed + Same Level, Unclassed First
  const availableStudents = useMemo(() => {
    if (!cls) return [];
    const targetLevel = cls.name.split("-")[0];
    
    return students
      .filter(s => {
        if (s.classId === id) return false;
        if (!s.classId) return true;
        const sLevel = s.class?.name.split("-")[0];
        return sLevel === targetLevel;
      })
      .sort((a, b) => {
        if (!a.classId && b.classId) return -1;
        if (a.classId && !b.classId) return 1;
        return 0;
      });
  }, [students, id, cls]);

  const assignStudentMutation = useMutation({
    mutationFn: (studentId: string) => classApi.assignStudentToClass(id as string, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSelectedStudentToAdd("");
      setIsLevelChangeOpen(false);
      setPendingStudentId(null);
      toast({ title: "Başarılı", description: "Öğrenci sınıfa eklendi." });
    }
  });

  const handleStudentAssignment = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student || !cls) return;

    const currentLevel = student.classId ? 
      allClassesData?.classes.find(c => c.id === student.classId)?.name.split("-")[0] || "Seviyesiz" : 
      "Seviyesiz";
    
    const targetLevel = cls.name.split("-")[0];

    if (currentLevel !== "Seviyesiz" && currentLevel !== targetLevel) {
      setFromLevel(currentLevel);
      setPendingStudentId(studentId);
      setIsLevelChangeOpen(true);
    } else {
      assignStudentMutation.mutate(studentId);
    }
  };

  const removeStudentMutation = useMutation({
    mutationFn: (studentId: string) => classApi.removeStudentFromClass(studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: "Başarılı", description: "Öğrenci sınıftan çıkarıldı." });
    }
  });

  const assignTeacherMutation = useMutation({
    mutationFn: (data: { teacherId: string, categoryId: string }) =>
      classApi.assignTeacherToClassWithCourse(id as string, data.teacherId, data.categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setSelectedTeacherId("");
      setSelectedCategoryId("");
      toast({ title: "Başarılı", description: "Öğretmen atandı." });
    }
  });

  const removeTeacherMutation = useMutation({
    mutationFn: (assignmentId: string) => classApi.removeTeacherFromClassWithCourse(assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({ title: "Başarılı", description: "Öğretmen ataması kaldırıldı." });
    }
  });

  // Sorumlu öğretmen güncelleme (classTeacherId)
  const updateResponsibleTeacherMutation = useMutation({
    mutationFn: (teacherId: string | null) =>
      classApi.updateClass(id as string, { classTeacherId: teacherId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSelectedResponsibleTeacherId("");
      toast({ title: "Başarılı", description: "Sorumlu öğretmen güncellendi." });
    },
    onError: () => toast({ variant: "destructive", title: "Hata", description: "Güncelleme başarısız." })
  });

  if (classLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!cls) return <div className="p-8">Sınıf bulunamadı.</div>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild className="rounded-xl">
              <Link href="/management"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div>
              <h1 className="text-3xl font-black text-foreground tracking-tight">Sınıf Yönetimi: {cls.name}</h1>
              <p className="text-muted-foreground font-medium">Bu sayfadan sınıfın tüm operasyonel atamalarını gerçekleştirebilirsiniz.</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Assignment Controls */}
          <div className="space-y-6">

            {/* Sorumlu Öğretmen Kartı */}
            <Card className="rounded-3xl border-border bg-card shadow-sm overflow-hidden border-2 border-violet-100 dark:border-violet-950">
              <CardHeader className="bg-violet-600 text-white pb-3">
                <CardTitle className="text-lg font-black flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" /> Sorumlu Öğretmen
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {/* Mevcut sorumlu öğretmeni göster */}
                <div className="p-3 bg-muted/50 rounded-xl border border-border">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-1">Şu An Atanmış</p>
                  <p className="font-bold text-foreground">
                    {(cls as any).classTeacher?.name || (
                      <span className="text-muted-foreground italic font-medium">Atanmamış</span>
                    )}
                  </p>
                </div>
                {/* Değiştirme dropdown'u */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Yeni Öğretmen Seç</Label>
                  <Select value={selectedResponsibleTeacherId} onValueChange={setSelectedResponsibleTeacherId}>
                    <SelectTrigger className="rounded-xl border-border bg-muted/30">
                      <SelectValue placeholder="Öğretmen seçin..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="none">— Atamayı Kaldır —</SelectItem>
                      {teachers.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full rounded-xl font-bold bg-violet-600 hover:bg-violet-700 h-11"
                  disabled={!selectedResponsibleTeacherId || updateResponsibleTeacherMutation.isPending}
                  onClick={() =>
                    updateResponsibleTeacherMutation.mutate(
                      selectedResponsibleTeacherId === "none" ? null : selectedResponsibleTeacherId
                    )
                  }
                >
                  {updateResponsibleTeacherMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kaydet"}
                </Button>
              </CardContent>
            </Card>

            {/* Student Assignment */}
            <Card className="rounded-3xl border-border bg-card shadow-sm overflow-hidden border-2 border-emerald-100 dark:border-emerald-950">
              <CardHeader className="bg-emerald-600 text-white">
                <CardTitle className="text-lg font-black flex items-center gap-2">
                  <UserPlus className="h-5 w-5" /> Öğrenci Nakil / Atama
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Seviyeye Uygun Öğrenciler</Label>
                  <Select value={selectedStudentToAdd} onValueChange={setSelectedStudentToAdd}>
                    <SelectTrigger className="rounded-xl h-11 border-border bg-muted/30">
                      <SelectValue placeholder="Öğrenci seçin..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl max-h-[250px]">
                      {availableStudents.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} {!s.classId ? "(Sınıfsız)" : `(${s.class?.name})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  className="w-full rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 h-11 transition-all"
                  disabled={!selectedStudentToAdd || assignStudentMutation.isPending}
                  onClick={() => handleStudentAssignment(selectedStudentToAdd)}
                >
                  {assignStudentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sınıfa Dahil Et"}
                </Button>
              </CardContent>
            </Card>

            {/* Teacher Assignment */}
            <Card className="rounded-3xl border-border bg-card shadow-sm overflow-hidden border-2 border-indigo-100 dark:border-indigo-950">
              <CardHeader className="bg-indigo-600 text-white">
                <CardTitle className="text-lg font-black flex items-center gap-2">
                  <Briefcase className="h-5 w-5" /> Branş Öğretmeni Ata
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Ders Seçin</Label>
                    <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                      <SelectTrigger className="rounded-xl border-border bg-muted/30"><SelectValue placeholder="Ders..." /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {categories.map((cat: any) => (<SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Öğretmen Seçin</Label>
                    <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                      <SelectTrigger className="rounded-xl border-border bg-muted/30"><SelectValue placeholder="Öğretmen..." /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {teachers.map(t => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    className="w-full rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 h-11"
                    disabled={!selectedTeacherId || !selectedCategoryId || assignTeacherMutation.isPending}
                    onClick={() => assignTeacherMutation.mutate({ teacherId: selectedTeacherId, categoryId: selectedCategoryId })}
                  >
                    Atamayı Kaydet
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lists View */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="rounded-3xl border-border bg-card shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/30 border-b py-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-black flex items-center gap-2"><Users className="h-5 w-5 text-indigo-600" /> Aktif Öğrenci Listesi</CardTitle>
                  <div className="relative w-48">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input placeholder="Ara..." className="pl-8 h-8 rounded-lg text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  </div>
                </div>
              </CardHeader>
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="pl-6 font-black text-[10px] uppercase py-3">Öğrenci</TableHead>
                    <TableHead className="text-right pr-6 font-black text-[10px] uppercase py-3">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classStudents.length === 0 ? (
                    <TableRow><TableCell colSpan={2} className="h-32 text-center text-muted-foreground italic">Sınıf henüz boş.</TableCell></TableRow>
                  ) : (
                    classStudents.filter((s:any) => s.name.toLowerCase().includes(searchTerm.toLowerCase())).map((s: any) => (
                      <TableRow key={s.id} className="group hover:bg-muted/30">
                        <TableCell className="pl-6">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[10px]">{s.name[0]}</div>
                            <div>
                              <p className="font-bold text-sm leading-none">{s.name}</p>
                              <p className="text-[10px] text-muted-foreground mt-1">{s.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500" onClick={() => removeStudentMutation.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>

            <Card className="rounded-3xl border-border bg-card shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/30 border-b py-4">
                <CardTitle className="text-lg font-black flex items-center gap-2"><Briefcase className="h-5 w-5 text-amber-600" /> Atanmış Branş Öğretmenleri</CardTitle>
              </CardHeader>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {cls.teacherAssignments?.map((ta: any) => (
                  <div key={ta.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-2xl border border-border group">
                    <div className="flex gap-3">
                      <div className="h-10 w-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center border border-border shadow-sm"><BookOpen className="h-5 w-5 text-indigo-600" /></div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-indigo-600">{ta.category?.name}</p>
                        <p className="text-sm font-bold text-foreground">{ta.teacher?.name}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500" onClick={() => removeTeacherMutation.mutate(ta.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Level Warning Dialog */}
      <Dialog open={isLevelChangeOpen} onOpenChange={setIsLevelChangeOpen}>
        <DialogContent className="rounded-3xl max-w-sm">
          <DialogHeader className="sr-only"><DialogTitle>Seviye Değişimi</DialogTitle><DialogDescription>Onay gerekli</DialogDescription></DialogHeader>
          <div className="py-6 text-center space-y-4">
            <div className="h-16 w-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto border-2 border-amber-100">
              <GraduationCap className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-black">Seviye Farkı!</h2>
            <p className="text-sm text-muted-foreground font-medium px-4">
              Öğrenci mevcut sınıf seviyesinden ({fromLevel}) farklı bir seviyeye ({cls.name.split("-")[0]}) nakledilecektir. Onaylıyor musunuz?
            </p>
          </div>
          <DialogFooter className="flex gap-2 p-4 pt-0">
            <Button variant="outline" onClick={() => { setIsLevelChangeOpen(false); setPendingStudentId(null); }} className="rounded-xl flex-1 font-bold">Vazgeç</Button>
            <Button onClick={() => assignStudentMutation.mutate(pendingStudentId!)} className="rounded-xl flex-1 font-bold bg-indigo-600 hover:bg-indigo-700">Onayla</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
