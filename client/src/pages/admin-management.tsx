import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Plus,
  Trash2,
  Edit2,
  Users,
  BookOpen,
  Loader2,
  Layers,
  Search,
  X,
  History,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  UserPlus,
  ArrowRight,
  MoreHorizontal,
  GraduationCap,
  ShieldCheck,
  Briefcase,
  Printer
} from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { categoryApi, classApi, userApi, adminApi, type Category } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

export default function AdminManagementPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("categories");
  
  // States
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isEditCategoryMode, setIsEditCategoryMode] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDesc, setCategoryDesc] = useState("");
  const [isDeleteCategoryOpen, setIsDeleteCategoryOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const [isClassDialogOpen, setIsClassDialogOpen] = useState(false);
  const [isEditClassMode, setIsEditClassMode] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [classLevel, setClassLevel] = useState("");
  const [classSection, setClassSection] = useState("");
  const [classDesc, setClassNameDesc] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedTeacherCourseId, setSelectedTeacherCourseId] = useState("");
  const [selectedStudentToAssign, setSelectedStudentToAssign] = useState("");
  const [isDeleteClassOpen, setIsDeleteClassOpen] = useState(false);

  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isEditUserMode, setIsEditUserMode] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isDeleteUserOpen, setIsDeleteUserOpen] = useState(false);
  const [userRoleFilter, setUserRoleFilter] = useState("all");

  const [isLevelChangeOpen, setIsLevelChangeOpen] = useState(false);
  const [pendingPromotionData, setPendingPromotionData] = useState<{studentId: string, fromLevel: string, toLevel: string} | null>(null);

  // Fetch Data
  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryApi.getAllCategories(),
  });

  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ['/api/classes'],
    queryFn: () => classApi.getAllClasses(),
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.getAllUsers(),
  });

  // Filters for Logs
  const [logRoleFilter, setLogRoleFilter] = useState("all");
  const [logActionSearch, setLogActionSearch] = useState("");
  const [logDateFilter, setLogDateFilter] = useState("academic-year");

  const logDateRange = useMemo(() => {
    const now = new Date();
    const startDate = new Date();
    const endDate = new Date();

    if (logDateFilter === "academic-year") {
      // Academic year starts on July 1st
      if (now.getMonth() >= 6) { // July is 6
        startDate.setFullYear(now.getFullYear(), 6, 1);
      } else {
        startDate.setFullYear(now.getFullYear() - 1, 6, 1);
      }
      startDate.setHours(0, 0, 0, 0);
      return { startDate: startDate.toISOString(), endDate: now.toISOString() };
    } else if (logDateFilter === "last-30") {
      startDate.setDate(now.getDate() - 30);
      return { startDate: startDate.toISOString(), endDate: now.toISOString() };
    } else if (logDateFilter === "last-year") {
      startDate.setFullYear(now.getFullYear() - 1);
      return { startDate: startDate.toISOString(), endDate: now.toISOString() };
    }
    return { startDate: undefined, endDate: undefined };
  }, [logDateFilter]);

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['/api/admin/logs', logRoleFilter, logActionSearch, logDateRange],
    queryFn: () => adminApi.getLogs({
      role: logRoleFilter === "all" ? undefined : logRoleFilter,
      action: logActionSearch || undefined,
      startDate: logDateRange.startDate,
      endDate: logDateRange.endDate
    }),
  });

  const teachers = usersData?.users.filter(u => u.role === 'teacher') || [];
  const classes = classesData?.classes || [];
  const students = usersData?.users.filter(u => u.role === 'student') || [];
  const logs = logsData?.logs || [];

  // Mutations - User Management
  const createUserMutation = useMutation({
    mutationFn: (data: any) => userApi.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsUserDialogOpen(false);
      toast({ title: "Başarılı", description: "Yeni kullanıcı oluşturuldu." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Hata", description: e.message })
  });

  const updateUserMutation = useMutation({
    mutationFn: (data: any) => userApi.updateUser(data.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsUserDialogOpen(false);
      toast({ title: "Başarılı", description: "Kullanıcı güncellendi." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Hata", description: e.message })
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => userApi.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsDeleteUserOpen(false);
      toast({ title: "Başarılı", description: "Kullanıcı silindi." });
    }
  });

  // Mutations - Categories
  const createCategoryMutation = useMutation({
    mutationFn: () => categoryApi.createCategory(categoryName, categoryDesc),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setIsCategoryDialogOpen(false);
      setCategoryName("");
      setCategoryDesc("");
      toast({ title: "Başarılı", description: "Ders başarıyla oluşturuldu." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Hata", description: e.message })
  });

  const updateCategoryMutation = useMutation({
    mutationFn: (data: { id: string, name: string, description?: string }) =>
      categoryApi.updateCategory(data.id, data.name, data.description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setIsCategoryDialogOpen(false);
      setEditingCategory(null);
      setCategoryName("");
      setCategoryDesc("");
      toast({ title: "Başarılı", description: "Ders güncellendi." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Hata", description: e.message })
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => categoryApi.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setIsDeleteCategoryOpen(false);
      toast({ title: "Başarılı", description: "Ders silindi." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Hata", description: e.message })
  });

// Mutations - Classes & Assignments
const createClassMutation = useMutation({
  mutationFn: (data: any) => classApi.createClass(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
    setIsClassDialogOpen(false);
    toast({ title: "Başarılı", description: "Sınıf başarıyla oluşturuldu." });
  },
  onError: (e: any) => {
    const msg = e.message || "Sınıf oluşturulamadı.";
    toast({ variant: "destructive", title: "Hata", description: msg });
  }
});

const updateClassMutation = useMutation({
  mutationFn: (data: any) => classApi.updateClass(data.id, data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
    // Sorumlu öğretmen değişmiş olabilir — öğretmenlerin responsibleForClasses'ını güncelle
    queryClient.invalidateQueries({ queryKey: ['users'] });
    setIsClassDialogOpen(false);
    setIsEditClassMode(false);
    toast({ title: "Başarılı", description: "Sınıf güncellendi." });
  },
  onError: (e: any) => {
    const msg = e.message || "Sınıf güncellenemedi.";
    toast({ variant: "destructive", title: "Hata", description: msg });
  }
});

const deleteClassMutation = useMutation({
  mutationFn: (id: string) => classApi.deleteClass(id),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
    queryClient.invalidateQueries({ queryKey: ['users'] });
    setIsDeleteClassOpen(false);
    toast({ title: "Başarılı", description: "Sınıf başarıyla silindi." });
  },
  onError: (e: any) => {
    toast({ variant: "destructive", title: "Hata", description: e.message });
  }
});

const assignTeacherMutation = useMutation({
  mutationFn: (data: { teacherId: string, categoryId: string }) =>
    classApi.assignTeacherToClassWithCourse(selectedClassId!, data.teacherId, data.categoryId),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
    queryClient.invalidateQueries({ queryKey: ['users'] });
    setSelectedTeacherCourseId("");
    toast({ title: "Başarılı", description: "Branş öğretmeni atandı." });
  }
});

const removeTeacherMutation = useMutation({
  mutationFn: (assignmentId: string) => classApi.removeTeacherFromClassWithCourse(assignmentId),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
    queryClient.invalidateQueries({ queryKey: ['users'] });
    toast({ title: "Başarılı", description: "Atama kaldırıldı." });
  }
});

  const assignStudentMutation = useMutation({
    mutationFn: (studentId: string) => classApi.assignStudentToClass(selectedClassId!, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
      setSelectedStudentToAssign("");
      setIsLevelChangeOpen(false);
      setPendingPromotionData(null);
      toast({ title: "Başarılı", description: "Öğrenci sınıfa eklendi." });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Hata", description: e.message })
  });

  // Active Contexts
  const activeClass = useMemo(() => classes.find(c => c.id === selectedClassId), [classes, selectedClassId]);
  const activeClassStudents = useMemo(() => students.filter(s => s.classId === selectedClassId), [students, selectedClassId]);

  const handleStudentAssignment = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    const targetClass = classes.find(c => c.id === selectedClassId);
    
    if (!student || !targetClass) return;

    const currentClass = classes.find(c => c.id === student.classId);
    const fromLevel = currentClass?.name.split("-")[0] || "Seviyesiz";
    const toLevel = targetClass.name.split("-")[0];

    if (fromLevel !== toLevel) {
      setPendingPromotionData({ studentId, fromLevel, toLevel });
      setIsLevelChangeOpen(true);
    } else {
      assignStudentMutation.mutate(studentId);
    }
  };

  const teacherCourseOptions = useMemo(() => {
    const options: any[] = [];
    teachers.forEach(t => {
      (t.assignedCategories || []).forEach((cat: any) => {
        if (!activeClass?.teacherAssignments?.some((ta: any) => ta.teacherId === t.id && ta.categoryId === cat.id)) {
          options.push({ id: `${t.id}-${cat.id}`, teacherId: t.id, categoryId: cat.id, label: `${t.name} (${cat.name})` });
        }
      });
    });
    return options;
  }, [teachers, activeClass]);

  const filteredUsers = useMemo(() => {
    return usersData?.users.filter(u => userRoleFilter === "all" || u.role === userRoleFilter) || [];
  }, [usersData, userRoleFilter]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-heading font-black text-slate-900 dark:text-slate-50 tracking-tight">Yönetim Paneli</h1>
            <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500 font-medium">Okul kaynaklarını ve akademik yapıyı buradan koordine edin.</p>
          </div>
          <div className="flex gap-2 bg-card p-1.5 rounded-2xl border border-border print:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="rounded-xl font-bold gap-2 border-2 hover:bg-slate-50 transition-all"
            >
              <Printer className="h-4 w-4" /> Yazdır
            </Button>
            <Button variant="ghost" size="sm" className="rounded-xl font-bold gap-2 text-muted-foreground hover:text-primary hover:bg-accent" onClick={() => queryClient.invalidateQueries()}>
              <Activity className="h-4 w-4" /> Verileri Yenile
            </Button>
          </div>
        </header>

        <Tabs defaultValue="categories" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-muted p-1.5 rounded-2xl border border-border mb-6 flex w-fit gap-1">
            <TabsTrigger value="categories" className="rounded-xl font-bold px-6 py-2.5 data-[state=active]:bg-secondary data-[state=active]:text-primary transition-all">Dersler</TabsTrigger>
            <TabsTrigger value="classes" className="rounded-xl font-bold px-6 py-2.5 data-[state=active]:bg-secondary data-[state=active]:text-primary transition-all">Sınıflar</TabsTrigger>
            <TabsTrigger value="users" className="rounded-xl font-bold px-6 py-2.5 data-[state=active]:bg-secondary data-[state=active]:text-primary transition-all">Kullanıcılar</TabsTrigger>
            <TabsTrigger value="logs" className="rounded-xl font-bold px-6 py-2.5 data-[state=active]:bg-secondary data-[state=active]:text-primary transition-all">Loglar</TabsTrigger>
          </TabsList>

          {/* CATEGORIES TAB */}
          <TabsContent value="categories" className="mt-6 space-y-6">
            <div className="bg-card p-5 rounded-3xl border border-border flex flex-col md:flex-row justify-between items-center gap-6">
               <h2 className="text-xl font-black text-foreground">Ders Yönetimi</h2>
               <Button onClick={() => { setIsEditCategoryMode(false); setCategoryName(""); setCategoryDesc(""); setIsCategoryDialogOpen(true); }} className="rounded-xl font-bold gap-2 bg-primary text-primary-foreground hover:opacity-90">
                 <Plus className="h-4 w-4" /> Yeni Ders Ekle
               </Button>
            </div>

            <div className="bg-card rounded-3xl border border-border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted border-b border-border">
                  <TableRow>
                    <TableHead className="font-black text-[10px] text-muted-foreground uppercase tracking-widest py-4 pl-6 w-[30%]">Ders Adı</TableHead>
                    <TableHead className="font-black text-[10px] text-muted-foreground uppercase tracking-widest py-4 w-[40%]">Açıklama</TableHead>
                    <TableHead className="font-black text-[10px] text-muted-foreground uppercase tracking-widest py-4 text-center">Oluşturulma</TableHead>
                    <TableHead className="text-right px-6 py-4 font-black text-[10px] text-muted-foreground uppercase tracking-widest">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-12 text-center text-muted-foreground font-medium">Kayıtlı ders bulunamadı.</TableCell>
                    </TableRow>
                  ) : (
                    categories.map((cat: any) => (
                      <TableRow key={cat.id} className="hover:bg-muted/30 transition-colors border-border group">
                        <TableCell className="pl-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                              <BookOpen className="h-5 w-5" />
                            </div>
                            <span className="font-bold text-foreground text-sm">{cat.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-xs font-medium text-muted-foreground line-clamp-1 max-w-sm">{cat.description || "Açıklama belirtilmemiş."}</p>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-xs font-bold text-foreground">{new Date(cat.createdAt).toLocaleDateString('tr-TR')}</span>
                        </TableCell>
                        <TableCell className="text-right px-6">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-indigo-600" onClick={() => { setEditingCategory(cat); setCategoryName(cat.name); setCategoryDesc(cat.description || ""); setIsEditCategoryMode(true); setIsCategoryDialogOpen(true); }}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={() => { setSelectedCategoryId(cat.id); setIsDeleteCategoryOpen(true); }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* CLASSES TAB - GRID ONLY */}
          <TabsContent value="classes" className="m-0 space-y-6">
            <div className="flex items-center justify-between bg-card p-4 rounded-2xl border border-border">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Sınıf ara..." className="pl-10 rounded-xl bg-muted border-transparent focus:bg-background focus:border-input" />
              </div>
              <Button onClick={() => { setIsEditClassMode(false); setClassLevel(""); setClassSection(""); setClassNameDesc(""); setSelectedTeacherId("none"); setIsClassDialogOpen(true); }} className="rounded-xl font-bold bg-primary text-primary-foreground">
                <Plus className="h-4 w-4 mr-2" /> Yeni Sınıf
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {classes.map((cls: any) => (
                <div 
                  key={cls.id} 
                  onClick={() => setLocation(`/admin/classes/${cls.id}`)}
                  className="group p-6 rounded-3xl border-2 border-border hover:border-indigo-500 transition-all cursor-pointer bg-card relative overflow-hidden shadow-sm hover:shadow-indigo-100 dark:hover:shadow-none"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-2xl text-indigo-600 dark:text-indigo-400 mb-2">
                      <Layers className="h-6 w-6" />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        <DropdownMenuItem onClick={(e) => { 
                          e.stopPropagation();
                          setSelectedClassId(cls.id); 
                          const nameParts = cls.name.split("-");
                          if(nameParts.length === 2) {
                            setClassLevel(nameParts[0]);
                            setClassSection(nameParts[1]);
                          } else {
                            setClassLevel("");
                            setClassSection("");
                          }
                          setClassNameDesc(cls.description || "");
                          setSelectedTeacherId(cls.classTeacherId || "none");
                          setIsEditClassMode(true); 
                          setIsClassDialogOpen(true); 
                        }}>Hızlı Düzenle</DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setLocation(`/admin/classes/${cls.id}`); }}>
                          Yönetim Sayfası
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setSelectedClassId(cls.id); setIsDeleteClassOpen(true); }}>Sınıfı Sil</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <h3 className="text-xl font-black text-foreground leading-tight">{cls.name}</h3>
                  <p className="text-xs font-medium text-muted-foreground mt-2 line-clamp-2 h-8">{cls.description || 'Açıklama belirtilmemiş'}</p>
                  
                  <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                    <div className="flex items-center gap-2">
                       <div className="h-8 w-8 rounded-full bg-muted border border-border flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                         <Users className="h-4 w-4" />
                       </div>
                       <div className="flex flex-col">
                         <span className="text-[11px] font-black text-foreground leading-none">{cls._count?.students || 0}</span>
                         <span className="text-[9px] font-bold text-muted-foreground uppercase">Öğrenci</span>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Sorumlu</p>
                       <Badge variant="secondary" className="bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold py-0 px-2 rounded-md">
                         {cls.classTeacher?.name?.split(' ')[0] || 'YOK'}
                       </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* USERS TAB - WITH ROLE SPECIFIC TABS & DIRECT ROLE CHANGE */}
          <TabsContent value="users" className="mt-6 space-y-6">
            <div className="bg-card p-5 rounded-3xl border border-border flex flex-col md:flex-row justify-between items-center gap-6">
               <h2 className="text-xl font-black text-foreground">Kullanıcı Yönetimi</h2>
               <Button onClick={() => { setIsEditUserMode(false); setSelectedUser({ name: "", email: "", role: "student", password: "password123" }); setIsUserDialogOpen(true); }} className="rounded-xl font-bold gap-2 bg-primary text-primary-foreground hover:opacity-90 transition-all">
                 <UserPlus className="h-4 w-4" /> Yeni Kullanıcı Oluştur
               </Button>
            </div>

            <Tabs defaultValue="all" value={userRoleFilter} onValueChange={setUserRoleFilter} className="w-full">
              <TabsList className="bg-muted p-1 rounded-xl flex gap-1 w-fit mb-4">
                <TabsTrigger value="all" className="rounded-lg text-xs font-bold px-4 py-1.5 data-[state=active]:bg-background data-[state=active]:text-primary">Tümü</TabsTrigger>
                <TabsTrigger value="admin" className="rounded-lg text-xs font-bold px-4 py-1.5 data-[state=active]:bg-background data-[state=active]:text-primary">Yöneticiler</TabsTrigger>
                <TabsTrigger value="teacher" className="rounded-lg text-xs font-bold px-4 py-1.5 data-[state=active]:bg-background data-[state=active]:text-primary">Öğretmenler</TabsTrigger>
                <TabsTrigger value="student" className="rounded-lg text-xs font-bold px-4 py-1.5 data-[state=active]:bg-background data-[state=active]:text-primary">Öğrenciler</TabsTrigger>
              </TabsList>

              <div className="bg-card rounded-3xl border border-border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted border-b border-border">
                    <TableRow>
                      <TableHead className="font-black text-[10px] text-muted-foreground uppercase tracking-widest py-4 pl-6">Kullanıcı Bilgileri</TableHead>
                      <TableHead className="font-black text-[10px] text-muted-foreground uppercase tracking-widest py-4">Sistem Rolü</TableHead>
                      <TableHead className="font-black text-[10px] text-muted-foreground uppercase tracking-widest py-4">İletişim</TableHead>
                      <TableHead className="text-right px-6 py-4 font-black text-[10px] text-muted-foreground uppercase tracking-widest">İşlemler</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-12 text-center text-muted-foreground font-medium">Bu kategoride kullanıcı bulunamadı.</TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((u: any) => (
                        <TableRow key={u.id} className="hover:bg-muted/30 transition-colors border-border group">
                          <TableCell className="pl-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center rounded-xl font-black text-xs border border-indigo-100 dark:border-indigo-900/50">
                                {u.name?.[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-foreground text-sm">{u.name}</p>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{u.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn(
                              "rounded-lg font-bold text-[10px] px-3 py-1 border-2 uppercase tracking-widest",
                              u.role === 'admin' ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/50" :
                              u.role === 'teacher' ? "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/50" :
                              "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50"
                            )}>
                              {u.role === 'admin' ? 'Yönetici' : u.role === 'teacher' ? 'Öğretmen' : 'Öğrenci'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-medium text-muted-foreground italic">
                            {u.phoneNumber || "No yok"}
                          </TableCell>
                          <TableCell className="text-right px-6">
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-indigo-600" onClick={() => { setSelectedUser(u); setIsEditUserMode(true); setIsUserDialogOpen(true); }}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={() => { setSelectedUser(u); setIsDeleteUserOpen(true); }}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Tabs>
          </TabsContent>
          
          {/* LOGS TAB - ADVANCED FILTERED TABLE */}
          <TabsContent value="logs" className="mt-6 space-y-6">
            <div className="bg-card p-5 rounded-3xl border border-border flex flex-col md:flex-row justify-between items-center gap-6">
               <div className="flex items-center gap-4 flex-1 w-full">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="İşlem ara (örn: create, delete)..." 
                      className="pl-10 rounded-xl bg-muted border-transparent focus:bg-background focus:border-input" 
                      value={logActionSearch}
                      onChange={e => setLogActionSearch(e.target.value)}
                    />
                  </div>
                  <Select value={logRoleFilter} onValueChange={setLogRoleFilter}>
                    <SelectTrigger className="w-40 rounded-xl border-border bg-muted/30">
                      <SelectValue placeholder="Rol Filtrele" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all">Tüm Roller</SelectItem>
                      <SelectItem value="admin">Yöneticiler</SelectItem>
                      <SelectItem value="teacher">Öğretmenler</SelectItem>
                      <SelectItem value="student">Öğrenciler</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={logDateFilter} onValueChange={setLogDateFilter}>
                    <SelectTrigger className="w-48 rounded-xl border-border bg-muted/30">
                      <SelectValue placeholder="Tarih Aralığı" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all">Tüm Zamanlar</SelectItem>
                      <SelectItem value="academic-year">Bu Eğitim Yılı (1 Tem'den)</SelectItem>
                      <SelectItem value="last-30">Son 30 Gün</SelectItem>
                      <SelectItem value="last-year">Son 1 Yıl</SelectItem>
                    </SelectContent>
                  </Select>
               </div>
               <div className="flex items-center gap-2">
                  <Badge variant="outline" className="rounded-lg font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border-indigo-100">
                    {logs.length} Kayıt Listeleniyor
                  </Badge>
               </div>
            </div>

             <Card className="rounded-3xl border border-border overflow-hidden bg-card shadow-sm">
                <Table>
                  <TableHeader className="bg-muted border-b border-border">
                    <TableRow>
                      <TableHead className="font-black text-[10px] text-muted-foreground uppercase tracking-widest py-4 pl-6">Zaman</TableHead>
                      <TableHead className="font-black text-[10px] text-muted-foreground uppercase tracking-widest py-4">Kullanıcı & Rol</TableHead>
                      <TableHead className="font-black text-[10px] text-muted-foreground uppercase tracking-widest py-4">İşlem</TableHead>
                      <TableHead className="font-black text-[10px] text-muted-foreground uppercase tracking-widest py-4">Detaylar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logsLoading ? (
                      <TableRow><TableCell colSpan={4} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                    ) : logs.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic font-medium">Kayıt bulunamadı.</TableCell></TableRow>
                    ) : (
                      logs.map((log: any) => (
                        <TableRow key={log.id} className="hover:bg-muted/30 border-border transition-colors group">
                          <TableCell className="pl-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-foreground">{new Date(log.createdAt).toLocaleDateString('tr-TR')}</span>
                              <span className="text-[10px] font-medium text-muted-foreground">{new Date(log.createdAt).toLocaleTimeString('tr-TR')}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-foreground">{log.user?.name}</span>
                                <span className={cn(
                                  "text-[9px] font-black uppercase tracking-tighter",
                                  log.user?.role === 'admin' ? "text-red-500" :
                                  log.user?.role === 'teacher' ? "text-amber-500" : "text-emerald-500"
                                )}>
                                  {log.user?.role}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn(
                              "rounded-lg font-black text-[9px] px-2 py-0.5 border-none shadow-none uppercase tracking-widest",
                              log.action.includes('delete') ? "bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400" :
                              log.action.includes('create') || log.action.includes('add') ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400" :
                              log.action.includes('update') ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400" :
                              "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                            )}>
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-medium text-muted-foreground max-w-md truncate">
                            {log.details || "-"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
             </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* USER DIALOG - FOR CREATE & ROLE CHANGE */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md bg-card">
          <DialogHeader><DialogTitle className="text-xl font-bold">{isEditUserMode ? "Kullanıcıyı Güncelle" : "Yeni Kullanıcı Kaydı"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label className="font-bold text-foreground">Ad Soyad</Label><Input value={selectedUser?.name || ""} onChange={e => setSelectedUser({...selectedUser, name: e.target.value})} className="rounded-xl border-border" placeholder="Örn: Mehmet Can" /></div>
            <div className="space-y-2"><Label className="font-bold text-foreground">E-posta</Label><Input value={selectedUser?.email || ""} onChange={e => setSelectedUser({...selectedUser, email: e.target.value})} className="rounded-xl border-border" placeholder="mehmet@okul.com" /></div>
            {!isEditUserMode && <div className="space-y-2"><Label className="font-bold text-foreground">Şifre</Label><Input type="password" value={selectedUser?.password || ""} onChange={e => setSelectedUser({...selectedUser, password: e.target.value})} className="rounded-xl border-border" /></div>}
            
            <div className="space-y-2">
              <Label className="font-bold text-foreground">Sistem Rolü (Dönüştür)</Label>
              <Select value={selectedUser?.role || "student"} onValueChange={val => setSelectedUser({...selectedUser, role: val})}>
                <SelectTrigger className="rounded-xl border-border"><SelectValue placeholder="Rol seçin" /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="student">Öğrenci (Öğrenim Görebilir)</SelectItem>
                  <SelectItem value="teacher">Öğretmen (Ders Verebilir)</SelectItem>
                  <SelectItem value="admin">Yönetici (Tüm Sistem Yetkisi)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedUser?.role === 'teacher' && (
              <div className="space-y-2 p-4 bg-muted rounded-2xl border border-border">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-2 block">Uzmanlık Alanları (Branşlar)</Label>
                <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto pr-2 custom-scrollbar">
                  {categories.map((cat: any) => (
                    <div key={cat.id} className="flex items-center space-x-2 bg-card p-2 rounded-lg border border-border">
                      <input type="checkbox" id={`ucat-${cat.id}`} checked={selectedUser?.assignedCategoryIds?.includes(cat.id) || selectedUser?.assignedCategories?.some((c: any) => c.id === cat.id)} onChange={(e) => {
                          const currentIds = selectedUser?.assignedCategoryIds || selectedUser?.assignedCategories?.map((c: any) => c.id) || [];
                          const newIds = e.target.checked ? [...currentIds, cat.id] : currentIds.filter((id: string) => id !== cat.id);
                          setSelectedUser({...selectedUser, assignedCategoryIds: newIds});
                        }} className="rounded-md border-input text-indigo-600 focus:ring-indigo-500" />
                      <label htmlFor={`ucat-${cat.id}`} className="text-xs font-bold text-muted-foreground cursor-pointer">{cat.name}</label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => isEditUserMode ? updateUserMutation.mutate(selectedUser) : createUserMutation.mutate(selectedUser)} className="rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 w-full shadow-lg dark:shadow-none">
              {isEditUserMode ? "Değişiklikleri Kaydet" : "Kullanıcıyı Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CLASS CRUD DIALOG */}
      <Dialog open={isClassDialogOpen} onOpenChange={setIsClassDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md bg-card">
          <DialogHeader><DialogTitle className="text-xl font-bold">{isEditClassMode ? "Sınıfı Güncelle" : "Yeni Sınıf Oluştur"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold text-foreground">Sınıf Seviyesi</Label>
                <Select value={classLevel} onValueChange={setClassLevel}>
                  <SelectTrigger className="rounded-xl border-border"><SelectValue placeholder="Seviye Seç" /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Hazırlık">Hazırlık Sınıfı</SelectItem>
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"].map(level => (
                      <SelectItem key={level} value={level}>{level}. Sınıf</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-foreground">Şube Adı</Label>
                <Select value={classSection} onValueChange={setClassSection}>
                  <SelectTrigger className="rounded-xl border-border"><SelectValue placeholder="Şube Seç" /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ").map(letter => (
                      <SelectItem key={letter} value={letter}>{letter} Şubesi</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label className="font-bold text-foreground">Açıklama</Label><Textarea value={classDesc} onChange={e => setClassNameDesc(e.target.value)} className="rounded-xl border-border" /></div>
            <div className="space-y-2">
              <Label className="font-bold text-foreground">Sorumlu Öğretmen</Label>
              <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                <SelectTrigger className="rounded-xl border-border"><SelectValue placeholder="Öğretmen Seçin" /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="none">Atanmamış</SelectItem>
                  {teachers.map(t => (<SelectItem key={t.id} value={t.id}>{t.name} ({t.assignedCategories?.map((c: any) => c.name).join(', ') || 'Branş Yok'})</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button 
              disabled={!classLevel || !classSection}
              onClick={() => {
                const formattedClassName = `${classLevel}-${classSection}`;
                isEditClassMode 
                  ? updateClassMutation.mutate({ id: selectedClassId!, name: formattedClassName, description: classDesc, classTeacherId: selectedTeacherId === "none" ? null : selectedTeacherId }) 
                  : createClassMutation.mutate({ name: formattedClassName, description: classDesc, classTeacherId: selectedTeacherId === "none" ? undefined : selectedTeacherId })
              }} 
              className="rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 w-full shadow-lg dark:shadow-none"
            >
              Sınıfı Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATIONS (Class & User) */}
      <Dialog open={isDeleteClassOpen} onOpenChange={setIsDeleteClassOpen}>
        <DialogContent className="rounded-3xl max-w-sm bg-card">
          <DialogHeader className="sr-only">
            <DialogTitle>Sınıfı Sil</DialogTitle>
            <DialogDescription>Sınıf silme onayı</DialogDescription>
          </DialogHeader>
          <div className="py-8 text-center space-y-4">
            <div className={cn(
              "h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4 border-2 shadow-lg dark:shadow-none",
              (activeClass?._count?.students || 0) > 0 || (activeClass?.teachers?.length || 0) > 0 || (activeClass?.teacherAssignments?.length || 0) > 0
                ? "bg-amber-50 text-amber-500 border-amber-100"
                : "bg-red-50 text-red-500 border-red-100"
            )}>
              {(activeClass?._count?.students || 0) > 0 || (activeClass?.teachers?.length || 0) > 0 || (activeClass?.teacherAssignments?.length || 0) > 0
                ? <AlertCircle className="h-8 w-8" />
                : <Trash2 className="h-8 w-8" />
              }
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-slate-50">
              {(activeClass?._count?.students || 0) > 0 || (activeClass?.teachers?.length || 0) > 0 || (activeClass?.teacherAssignments?.length || 0) > 0
                ? "Sınıf Silinemez!"
                : "Sınıfı Sil?"
              }
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 font-medium px-4">
              {(activeClass?._count?.students || 0) > 0 || (activeClass?.teachers?.length || 0) > 0 || (activeClass?.teacherAssignments?.length || 0) > 0
                ? "Sınıf kapatılamaz/silinemez. Önce sınıf içerisindeki öğretmen ve öğrencilerin boşaltılması gerekmektedir."
                : "Bu sınıf ve tüm atamaları kalıcı olarak silinecek. Emin misiniz?"
              }
            </p>
          </div>
          <DialogFooter className="flex gap-2 p-4 pt-0">
            <Button variant="outline" onClick={() => setIsDeleteClassOpen(false)} className="rounded-xl flex-1 font-bold">Vazgeç</Button>
            {(activeClass?._count?.students || 0) === 0 && (
              <Button variant="destructive" onClick={() => deleteClassMutation.mutate(selectedClassId!)} className="rounded-xl flex-1 font-bold shadow-lg dark:shadow-none">Evet, Sil</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Level Change Confirmation */}
      <Dialog open={isLevelChangeOpen} onOpenChange={setIsLevelChangeOpen}>
        <DialogContent className="rounded-3xl max-w-sm bg-card">
          <DialogHeader className="sr-only">
            <DialogTitle>Seviye Değişikliği Onayı</DialogTitle>
            <DialogDescription>Sınıf seviyesi değişim uyarısı</DialogDescription>
          </DialogHeader>
          <div className="py-8 text-center space-y-4">
            <div className="h-16 w-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-amber-100 shadow-lg dark:shadow-none">
              <GraduationCap className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-slate-50">Seviye Değişimi!</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 font-medium px-4">
              Öğrenci mevcut sınıf seviyesinden ({pendingPromotionData?.fromLevel}) farklı bir seviyeye ({pendingPromotionData?.toLevel}) geçirilecektir. Bunu onaylıyor musunuz?
            </p>
          </div>
          <DialogFooter className="flex gap-2 p-4 pt-0">
            <Button variant="outline" onClick={() => { setIsLevelChangeOpen(false); setPendingPromotionData(null); }} className="rounded-xl flex-1 font-bold">Vazgeç</Button>
            <Button onClick={() => assignStudentMutation.mutate(pendingPromotionData!.studentId)} className="rounded-xl flex-1 font-bold bg-indigo-600 hover:bg-indigo-700 shadow-lg dark:shadow-none">Evet, Onayla</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteUserOpen} onOpenChange={setIsDeleteUserOpen}>
        <DialogContent className="rounded-3xl max-w-sm bg-card">
          <DialogHeader className="sr-only">
            <DialogTitle>Kullanıcıyı Sil</DialogTitle>
            <DialogDescription>Kullanıcı silme onayı</DialogDescription>
          </DialogHeader>
          <div className="py-8 text-center space-y-4">
            <div className="h-16 w-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-red-100 shadow-lg dark:shadow-none">
              <Trash2 className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-slate-50">Kullanıcıyı Sil?</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 font-medium px-4">"{selectedUser?.name}" isimli kullanıcı sistemden tamamen kaldırılacak.</p>
          </div>
          <DialogFooter className="flex gap-2 p-4 pt-0">
            <Button variant="outline" onClick={() => setIsDeleteUserOpen(false)} className="rounded-xl flex-1 font-bold">Vazgeç</Button>
            <Button variant="destructive" onClick={() => deleteUserMutation.mutate(selectedUser?.id)} className="rounded-xl flex-1 font-bold shadow-lg dark:shadow-none dark:shadow-none">Evet, Sil</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteCategoryOpen} onOpenChange={setIsDeleteCategoryOpen}>
        <DialogContent className="rounded-3xl max-w-sm bg-card">
          <DialogHeader className="sr-only">
            <DialogTitle>Dersi Sil</DialogTitle>
            <DialogDescription>Ders silme onayı</DialogDescription>
          </DialogHeader>
          <div className="py-8 text-center space-y-4">
            <div className="h-16 w-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-red-100 shadow-lg dark:shadow-none">
              <Trash2 className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-slate-50">Dersi Sil?</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium px-4">Bu ders silindiğinde buna bağlı sınavlar ve veriler etkilenebilir. Emin misiniz?</p>
          </div>
          <DialogFooter className="flex gap-2 p-4 pt-0">
            <Button variant="outline" onClick={() => setIsDeleteCategoryOpen(false)} className="rounded-xl flex-1 font-bold">Vazgeç</Button>
            <Button variant="destructive" onClick={() => deleteCategoryMutation.mutate(selectedCategoryId!)} className="rounded-xl flex-1 font-bold">Evet, Sil</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CATEGORY DIALOG */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader><DialogTitle className="text-xl font-bold">{isEditCategoryMode ? "Dersi Güncelle" : "Yeni Ders Kaydı"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label className="font-bold text-slate-700 dark:text-slate-200">Ders Başlığı</Label><Input value={categoryName} onChange={e => setCategoryName(e.target.value.toLocaleUpperCase('tr-TR'))} className="rounded-xl border-slate-200 dark:border-slate-700" placeholder="Örn: GÖRSEL PROGRAMLAMA" /></div>
            <div className="space-y-2"><Label className="font-bold text-slate-700 dark:text-slate-200">İçerik Açıklaması</Label><Textarea value={categoryDesc} onChange={e => setCategoryDesc(e.target.value)} className="rounded-xl border-slate-200 dark:border-slate-700" /></div>
          </div>
          <DialogFooter><Button onClick={() => isEditCategoryMode ? updateCategoryMutation.mutate({ id: editingCategory!.id, name: categoryName, description: categoryDesc }) : createCategoryMutation.mutate()} className="rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 w-full shadow-lg dark:shadow-none dark:shadow-none">Dersi Kaydet</Button></DialogFooter>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}
