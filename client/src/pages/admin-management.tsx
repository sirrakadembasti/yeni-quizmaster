import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Settings, 
  Users, 
  BookOpen, 
  Shield,
  Loader2,
  AlertCircle,
  Layers,
  Search,
  X,
  History,
  Info
} from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { categoryApi, classApi, userApi, adminApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
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

export default function AdminManagementPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // States for Category Dialog
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDesc, setNewCategoryDesc] = useState("");

  // States for Class Dialog
  const [isClassDialogOpen, setIsClassDialogOpen] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassDesc, setNewClassDesc] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  // New States
  const [classCategoryFilter, setClassCategoryFilter] = useState<string>("all");
  const [selectedTeacherForDetails, setSelectedTeacherForDetails] = useState<string | null>(null);

  // Fetch Data
  const { data: categories, isLoading: catsLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryApi.getAllCategories(),
  });

  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classApi.getAllClasses(),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.getAllUsers(),
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['admin-logs'],
    queryFn: () => adminApi.getLogs(),
  });

  const teachers = usersData?.users.filter(u => u.role === 'teacher') || [];
  const students = usersData?.users.filter(u => u.role === 'student') || [];
  const classes = classesData?.classes || [];
  const logs = logsData?.logs || [];

  // Mutations
  const createCategoryMutation = useMutation({
    mutationFn: () => categoryApi.createCategory(newCategoryName, newCategoryDesc),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setIsCategoryDialogOpen(false);
      setNewCategoryName("");
      setNewCategoryDesc("");
      toast({ title: "Başarılı", description: "Ders oluşturuldu." });
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => categoryApi.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: "Başarılı", description: "Ders silindi." });
    }
  });

  const createClassMutation = useMutation({
    mutationFn: () => classApi.createClass({ 
      name: newClassName, 
      description: newClassDesc,
      teacherId: selectedTeacherId 
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setIsClassDialogOpen(false);
      setNewClassName("");
      setNewClassDesc("");
      setSelectedTeacherId("");
      toast({ title: "Başarılı", description: "Sınıf oluşturuldu." });
    }
  });

  const assignStudentMutation = useMutation({
    mutationFn: ({ classId, studentId }: { classId: string, studentId: string }) => 
      classApi.assignStudentToClass(classId, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({ title: "Başarılı", description: "Öğrenci sınıfa atandı." });
    }
  });

  const removeStudentMutation = useMutation({
    mutationFn: ({ classId, studentId }: { classId: string, studentId: string }) => 
      classApi.removeStudentFromClass(classId, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({ title: "Başarılı", description: "Öğrenci sınıftan çıkarıldı." });
    }
  });

  const assignCategoryToClassMutation = useMutation({
    mutationFn: ({ classId, categoryId }: { classId: string, categoryId: string }) =>
      classApi.assignCategoryToClass(classId, categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({ title: "Başarılı", description: "Ders sınıfa atandı." });
    }
  });

  const removeCategoryFromClassMutation = useMutation({
    mutationFn: ({ classId, categoryId }: { classId: string, categoryId: string }) =>
      classApi.removeCategoryFromClass(classId, categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({ title: "Başarılı", description: "Ders sınıftan çıkarıldı." });
    }
  });

  const assignCategoryToTeacherMutation = useMutation({
    mutationFn: ({ userId, categoryId }: { userId: string, categoryId: string }) =>
      userApi.assignCategoryToTeacher(userId, categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: "Başarılı", description: "Ders öğretmene atandı." });
    }
  });

  const removeCategoryFromTeacherMutation = useMutation({
    mutationFn: ({ userId, categoryId }: { userId: string, categoryId: string }) =>
      userApi.removeCategoryFromTeacher(userId, categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: "Başarılı", description: "Ders öğretmenden çıkarıldı." });
    }
  });

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const unassignedStudents = students.filter(s => !s.classId || s.classId !== selectedClassId);
  const selectedTeacher = teachers.find(t => t.id === selectedTeacherForDetails);

  const filteredClasses = useMemo(() => {
    if (classCategoryFilter === "all") return classes;
    return classes.filter(cls => {
      const assigned = cls.assignedCategories || [];
      return assigned.some((cat: any) => {
        // Handle both object with id or direct id string
        const catId = typeof cat === 'string' ? cat : cat.id;
        return catId === classCategoryFilter;
      });
    });
  }, [classes, classCategoryFilter]);

  const unassignedCategoriesForClass = categories?.filter(cat => 
    !selectedClass?.assignedCategories?.some((assigned: any) => (typeof assigned === 'string' ? assigned : assigned.id) === cat.id)
  ) || [];

  const unassignedCategoriesForTeacher = categories?.filter(cat => 
    !selectedTeacher?.assignedCategories?.some((assigned: any) => (typeof assigned === 'string' ? assigned : assigned.id) === cat.id)
  ) || [];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Sistem Yönetimi</h1>
          <p className="text-muted-foreground mt-1">Platform ayarlarını, Dersleri, öğretmenleri ve sanal sınıfları buradan yönetin.</p>
        </div>

        <Tabs defaultValue="categories" className="w-full">
          <TabsList className="flex flex-wrap w-full max-w-4xl mb-8 bg-muted/50 p-1 rounded-lg">
            <TabsTrigger value="categories" className="gap-2 flex-1 min-w-[120px]">
              <BookOpen className="h-4 w-4" />
              Dersler ({categories?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="classes" className="gap-2 flex-1 min-w-[120px]">
              <Layers className="h-4 w-4" />
              Sanal Sınıflar ({classes.length})
            </TabsTrigger>
            <TabsTrigger value="teachers" className="gap-2 flex-1 min-w-[120px]">
              <Users className="h-4 w-4" />
              Öğretmenler ({teachers.length})
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2 flex-1 min-w-[120px]">
              <History className="h-4 w-4" />
              Sistem Logları
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2 flex-1 min-w-[120px]">
              <Shield className="h-4 w-4" />
              Güvenlik
            </TabsTrigger>
          </TabsList>

          {/* Categories Tab */}
          <TabsContent value="categories" className="animate-in fade-in-50 duration-500">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Quiz Dersleri</CardTitle>
                  <CardDescription>Quizlerin atanabileceği konu başlıklarını yönetin.</CardDescription>
                </div>
                <Button onClick={() => setIsCategoryDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Yeni Ders
                </Button>
              </CardHeader>
              <CardContent>
                {catsLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Ders Adı</TableHead>
                          <TableHead>Açıklama</TableHead>
                          <TableHead className="text-right">İşlemler</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categories?.map((cat) => (
                          <TableRow key={cat.id} className="hover:bg-muted/30">
                            <TableCell className="font-medium">{cat.name}</TableCell>
                            <TableCell className="text-muted-foreground">{cat.description || '-'}</TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive hover:bg-destructive/10" 
                                onClick={() => {
                                  if(confirm('Bu dersi silmek istediğinize emin misiniz?')) {
                                    deleteCategoryMutation.mutate(cat.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {categories?.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-12 text-muted-foreground italic">
                              Henüz Ders oluşturulmadı.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Classes Tab */}
          <TabsContent value="classes" className="animate-in fade-in-50 duration-500 space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Mevcut Sınıflar</CardTitle>
                    <CardDescription>Sanal sınıflar ve atanan öğretmenler.</CardDescription>
                  </div>
                  <div className="flex items-center gap-4">
                    <Select value={classCategoryFilter} onValueChange={setClassCategoryFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Ders Filtresi" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tüm Dersler</SelectItem>
                        {categories?.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={() => setIsClassDialogOpen(true)} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Yeni Sınıf
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {classesLoading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {filteredClasses.map((cls) => (
                        <Card 
                          key={cls.id} 
                          className={`cursor-pointer transition-all hover:shadow-md ${selectedClassId === cls.id ? 'ring-2 ring-primary border-transparent' : ''}`}
                          onClick={() => setSelectedClassId(cls.id)}
                        >
                          <CardContent className="p-4 flex items-center justify-between">
                            <div className="space-y-1">
                              <h3 className="font-bold text-lg">{cls.name}</h3>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Users className="h-3 w-3" />
                                <span>{students.filter(s => s.classId === cls.id).length} Öğrenci</span>
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                      {filteredClasses.length === 0 && (
                        <div className="col-span-2 text-center py-12 text-muted-foreground italic border rounded-lg">
                          Bu kritere uygun sınıf bulunamadı.
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Class Details / Assignment Logic */}
              <Card className={!selectedClassId ? 'opacity-50 grayscale pointer-events-none' : ''}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Sınıf Detayı</CardTitle>
                    {selectedClassId && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedClassId(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <CardDescription>
                    {selectedClass ? `${selectedClass.name} yönetimi.` : 'Bir sınıf seçin.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {selectedClass && (
                    <>
                      {/* Atanan Dersler */}
                      <div className="space-y-4">
                        <Label className="text-xs uppercase tracking-wider font-bold opacity-70">Atanan Dersler</Label>
                        <div className="flex flex-wrap gap-2">
                          {selectedClass.assignedCategories && selectedClass.assignedCategories.length > 0 ? (
                            selectedClass.assignedCategories.map((cat: any) => (
                              <Badge key={cat.id || cat} variant="secondary" className="flex items-center gap-1 py-1 px-2">
                                {cat.name || categories?.find(c => c.id === cat)?.name || 'Bilinmeyen Ders'}
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeCategoryFromClassMutation.mutate({ classId: selectedClass.id, categoryId: cat.id || cat });
                                  }}
                                  className="ml-1 text-muted-foreground hover:text-destructive focus:outline-none"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground italic w-full">Henüz ders atanmamış.</p>
                          )}
                        </div>
                        {unassignedCategoriesForClass.length > 0 && (
                          <div className="flex items-center gap-2 mt-2">
                            <Select onValueChange={(val) => assignCategoryToClassMutation.mutate({ classId: selectedClass.id, categoryId: val })}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Yeni Ders Ata" />
                              </SelectTrigger>
                              <SelectContent>
                                {unassignedCategoriesForClass.map(cat => (
                                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>

                      <div className="h-px bg-border my-4"></div>

                      <div className="space-y-4">
                        <Label className="text-xs uppercase tracking-wider font-bold opacity-70">Atanan Öğrenciler</Label>
                        <div className="space-y-2">
                          {students.filter(s => s.classId === selectedClassId).map(student => (
                            <div key={student.id} className="flex items-center justify-between p-2 rounded bg-secondary/50 text-sm">
                              <span>{student.name}</span>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 text-destructive"
                                onClick={() => removeStudentMutation.mutate({ classId: selectedClassId, studentId: student.id })}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                          {students.filter(s => s.classId === selectedClassId).length === 0 && (
                            <p className="text-xs text-muted-foreground italic">Bu sınıfta henüz öğrenci yok.</p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <Label className="text-xs uppercase tracking-wider font-bold opacity-70">Öğrenci Ekle</Label>
                        <div className="space-y-2">
                          <Select onValueChange={(val) => assignStudentMutation.mutate({ classId: selectedClassId, studentId: val })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Öğrenci Seç" />
                            </SelectTrigger>
                            <SelectContent>
                              {unassignedStudents.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.name} {s.classId ? '(Sınıf Değiştir)' : ''}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[10px] text-muted-foreground italic">
                            * Öğrenciler sadece bir sınıfa ait olabilir. Başka sınıftaki bir öğrenciyi eklerseniz mevcut sınıfından ayrılacaktır.
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Teachers Tab */}
          <TabsContent value="teachers" className="animate-in fade-in-50 duration-500 space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Öğretmenler</CardTitle>
                  <CardDescription>Öğretmenleri ve sorumlu oldukları dersleri yönetin.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {teachers.map((teacher) => (
                      <Card 
                        key={teacher.id} 
                        className={`cursor-pointer transition-all hover:shadow-md ${selectedTeacherForDetails === teacher.id ? 'ring-2 ring-primary border-transparent' : ''}`}
                        onClick={() => setSelectedTeacherForDetails(teacher.id)}
                      >
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="space-y-1">
                            <h3 className="font-bold text-lg">{teacher.name}</h3>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{teacher.email}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] mt-2 flex-wrap">
                              {teacher.assignedCategories && teacher.assignedCategories.length > 0 ? (
                                teacher.assignedCategories.map((cat: any) => (
                                  <span key={cat.id || cat} className="bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                    {cat.name || categories?.find(c => c.id === cat)?.name || 'Ders'}
                                  </span>
                                ))
                              ) : (
                                <span className="text-muted-foreground italic">Ders atanmamış</span>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {teachers.length === 0 && (
                      <div className="col-span-2 text-center py-12 text-muted-foreground italic border rounded-lg">
                        Sistemde kayıtlı öğretmen bulunmuyor.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Teacher Details / Assignment Logic */}
              <Card className={!selectedTeacherForDetails ? 'opacity-50 grayscale pointer-events-none' : ''}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Öğretmen Detayı</CardTitle>
                    {selectedTeacherForDetails && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedTeacherForDetails(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <CardDescription>
                    {selectedTeacher ? `${selectedTeacher.name} için ders atamaları.` : 'Bir öğretmen seçin.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {selectedTeacher && (
                    <div className="space-y-4">
                      <Label className="text-xs uppercase tracking-wider font-bold opacity-70">Yetkili Olduğu Dersler</Label>
                      <div className="flex flex-wrap gap-2">
                        {selectedTeacher.assignedCategories && selectedTeacher.assignedCategories.length > 0 ? (
                          selectedTeacher.assignedCategories.map((cat: any) => (
                            <Badge key={cat.id || cat} variant="secondary" className="flex items-center gap-1 py-1 px-2">
                              {cat.name || categories?.find(c => c.id === cat)?.name || 'Bilinmeyen Ders'}
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeCategoryFromTeacherMutation.mutate({ userId: selectedTeacher.id, categoryId: cat.id || cat });
                                }}
                                className="ml-1 text-muted-foreground hover:text-destructive focus:outline-none"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground italic w-full">Bu öğretmene henüz ders atanmamış.</p>
                        )}
                      </div>
                      
                      <div className="pt-2">
                        <Label className="text-xs uppercase tracking-wider font-bold opacity-70 mb-2 block">Yeni Ders Ata</Label>
                        {unassignedCategoriesForTeacher.length > 0 ? (
                          <Select onValueChange={(val) => assignCategoryToTeacherMutation.mutate({ userId: selectedTeacher.id, categoryId: val })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Ders Seç" />
                            </SelectTrigger>
                            <SelectContent>
                              {unassignedCategoriesForTeacher.map(cat => (
                                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Tüm dersler atanmış.</p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="animate-in fade-in-50 duration-500">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Sistem Aktiviteleri</CardTitle>
                    <CardDescription>Öğretmen ve öğrencilerin gerçekleştirdiği işlemler.</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-logs'] })}>
                    Yenile
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Tarih</TableHead>
                          <TableHead>Kullanıcı</TableHead>
                          <TableHead>Rol</TableHead>
                          <TableHead>İşlem</TableHead>
                          <TableHead>Detay</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs?.map((log: any) => (
                          <TableRow key={log.id} className="hover:bg-muted/30">
                            <TableCell className="text-xs whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleString('tr-TR')}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{log.user?.name}</div>
                              <div className="text-[10px] text-muted-foreground">{log.user?.email}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] uppercase">
                                {log.user?.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-200">
                                {log.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {log.details}
                            </TableCell>
                          </TableRow>
                        ))}
                        {logs?.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic">
                              Henüz log kaydı bulunmuyor.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Security Tab (Empty for now based on original structure) */}
          <TabsContent value="security" className="animate-in fade-in-50 duration-500">
            <Card>
              <CardHeader>
                <CardTitle>Güvenlik Ayarları</CardTitle>
                <CardDescription>Güvenlik politikalarını yönetin.</CardDescription>
              </CardHeader>
              <CardContent className="py-12 text-center text-muted-foreground">
                Güvenlik ayarları henüz geliştirme aşamasındadır.
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Ders Ekle</DialogTitle>
            <DialogDescription>Quizleri organize etmek için yeni bir başlık oluşturun.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="catName">Ders Adı</Label>
              <Input id="catName" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Örn: Modern JavaScript" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catDesc">Açıklama</Label>
              <Input id="catDesc" value={newCategoryDesc} onChange={(e) => setNewCategoryDesc(e.target.value)} placeholder="Kısa bir açıklama..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>İptal</Button>
            <Button onClick={() => createCategoryMutation.mutate()} disabled={!newCategoryName || createCategoryMutation.isPending}>
              {createCategoryMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Dersi Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Class Dialog */}
      <Dialog open={isClassDialogOpen} onOpenChange={setIsClassDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Sanal Sınıf</DialogTitle>
            <DialogDescription>Eğitim verilecek yeni bir grup oluşturun.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="className">Sınıf Adı</Label>
              <Input id="className" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} placeholder="Örn: 11-B Web Tasarım" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="classDesc">Açıklama</Label>
              <Textarea id="classDesc" value={newClassDesc} onChange={(e) => setNewClassDesc(e.target.value)} placeholder="Sınıf hakkında detaylar..." />
            </div>
            <div className="space-y-2">
              <Label>Sorumlu Öğretmen</Label>
              <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                <SelectTrigger>
                  <SelectValue placeholder="Öğretmen seçin" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsClassDialogOpen(false)}>İptal</Button>
            <Button onClick={() => createClassMutation.mutate()} disabled={!newClassName || !selectedTeacherId || createClassMutation.isPending}>
              {createClassMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sınıfı Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </DashboardLayout>
      );
      }