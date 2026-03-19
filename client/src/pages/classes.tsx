import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  MoreHorizontal, 
  Loader2,
  Trash2,
  Edit2,
  Layers,
  Plus,
  Users,
  UserPlus,
  Book,
  X
} from "lucide-react";
import { useState, useMemo } from "react";
import { classApi, userApi, categoryApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/auth-context";

export default function ClassesPage() {
  const { role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isManageTeachersOpen, setIsManageTeachersOpen] = useState(false);
  const [isManageStudentsOpen, setIsManageStudentsOpen] = useState(false);

  // Selections
  const [selectedClass, setSelectedClass] = useState<any | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [formData, setFormData] = useState({ name: "", description: "" });

  // Data Queries
  const { data: classesData, isLoading: isClassesLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: () => role === 'teacher' ? classApi.getTeacherClasses() : classApi.getAllClasses(),
  });

  const { data: usersData, isLoading: isUsersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.getAllUsers(),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryApi.getAllCategories(),
  });

  const classes = classesData?.classes || [];
  const teachers = usersData?.users.filter(u => u.role === 'teacher') || [];
  const students = usersData?.users.filter(u => u.role === 'student') || [];

  // Filtreleme Mantığı (Ders ve Arama bazlı)
  const filteredClasses = useMemo(() => {
    return classes.filter(cls => {
      const matchesSearch = cls.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategoryFilter === "all" || 
                             cls.assignedCategories?.some((cat: any) => cat.id === selectedCategoryFilter);
      return matchesSearch && matchesCategory;
    });
  }, [classes, searchTerm, selectedCategoryFilter]);

  // Mutations (Sadece Admin İçin)
  const createMutation = useMutation({
    mutationFn: () => classApi.createClass({ ...formData, teacherId: selectedTeacherId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({ title: "Başarılı", description: "Sınıf oluşturuldu." });
      setIsCreateOpen(false);
      setSelectedTeacherId("");
    }
  });

  const updateMutation = useMutation({
    mutationFn: () => classApi.updateClass(selectedClass.id, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({ title: "Başarılı", description: "Sınıf güncellendi." });
      setIsEditOpen(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => classApi.deleteClass(selectedClass.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({ title: "Başarılı", description: "Sınıf silindi." });
      setIsDeleteOpen(false);
    }
  });

  const assignTeacherMutation = useMutation({
    mutationFn: (teacherId: string) => classApi.assignTeacherToClass(selectedClass.id, teacherId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({ title: "Başarılı", description: "Öğretmen atandı." });
    }
  });

  const removeTeacherMutation = useMutation({
    mutationFn: (teacherId: string) => classApi.removeTeacherFromClass(selectedClass.id, teacherId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({ title: "Başarılı", description: "Öğretmen çıkarıldı." });
    }
  });

  const assignStudentMutation = useMutation({
    mutationFn: (studentId: string) => classApi.assignStudentToClass(selectedClass.id, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({ title: "Başarılı", description: "Öğrenci atandı." });
    }
  });

  const removeStudentMutation = useMutation({
    mutationFn: (studentId: string) => classApi.removeStudentFromClass(selectedClass.id, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({ title: "Başarılı", description: "Öğrenci çıkarıldı." });
    }
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-heading font-bold flex items-center gap-2">
              <Layers className="h-8 w-8 text-primary" />
              {role === 'admin' ? 'Sınıf Yönetimi' : 'Sınıflarım'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {role === 'admin' ? 'Sanal sınıflar oluşturun ve atamaları yönetin.' : 'Sorumlu olduğunuz sınıflar ve derslerin listesi.'}
            </p>
          </div>
          {role === 'admin' && (
            <Button onClick={() => { setFormData({ name: "", description: "" }); setIsCreateOpen(true); }} className="gap-2 font-bold shadow-lg shadow-primary/20">
              <Plus className="h-4 w-4" /> Yeni Sınıf
            </Button>
          )}
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col md:flex-row gap-4 bg-card p-4 rounded-xl border shadow-sm">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Sınıf adı ile ara..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full md:w-64">
            <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
              <SelectTrigger>
                <div className="flex items-center gap-2 font-medium">
                  <Book className="h-4 w-4 text-primary" />
                  <SelectValue placeholder="Ders Seçin" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Dersler</SelectItem>
                {categoriesData?.map((cat: any) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border rounded-xl bg-card overflow-hidden shadow-md">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-bold py-4 px-6">Sınıf Adı</TableHead>
                <TableHead className="font-bold">Atanan Dersler</TableHead>
                <TableHead className="font-bold text-center">Öğrenci Sayısı</TableHead>
                <TableHead className="text-right py-4 px-6 font-bold">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isClassesLoading ? (
                <TableRow><TableCell colSpan={4} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
              ) : filteredClasses.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic">Aranan kriterlerde sınıf bulunamadı.</TableCell></TableRow>
              ) : (
                filteredClasses.map((cls) => {
                  const classStudents = students.filter(s => s.classId === cls.id);
                  return (
                    <TableRow key={cls.id} className="hover:bg-primary/5 transition-colors">
                      <TableCell className="font-black py-4 px-6 text-slate-800 dark:text-slate-100">{cls.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {cls.assignedCategories?.map((cat: any) => (
                            <Badge key={cat.id} variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100 font-bold">
                              {cat.name}
                            </Badge>
                          ))}
                          {(!cls.assignedCategories || cls.assignedCategories.length === 0) && <span className="text-muted-foreground text-xs italic">Ders Atanmamış</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-bold">{classStudents.length} Öğrenci</TableCell>
                      <TableCell className="text-right py-4 px-6">
                        {role === 'admin' ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="rounded-full"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl">
                              <DropdownMenuLabel>Yönetim</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => { setSelectedClass(cls); setIsManageTeachersOpen(true); }} className="cursor-pointer">
                                <Users className="h-4 w-4 mr-2" /> Öğretmenleri Yönet
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSelectedClass(cls); setIsManageStudentsOpen(true); }} className="cursor-pointer">
                                <UserPlus className="h-4 w-4 mr-2" /> Öğrencileri Yönet
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => { setSelectedClass(cls); setFormData({ name: cls.name, description: cls.description || "" }); setIsEditOpen(true); }} className="cursor-pointer">
                                <Edit2 className="h-4 w-4 mr-2" /> Düzenle
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSelectedClass(cls); setIsDeleteOpen(true); }} className="cursor-pointer text-destructive focus:text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" /> Sil
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 uppercase text-[10px] font-black tracking-widest">
                            Aktif
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* ADMIN ONLY MODALS */}
        {role === 'admin' && (
          <>
            {/* Create Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogContent className="rounded-3xl">
                <DialogHeader><DialogTitle className="text-2xl font-black">Yeni Sınıf Ekle</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="font-bold">Sınıf Adı</Label>
                    <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Örn: 9-A Matematik" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold">Açıklama</Label>
                    <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold">Sorumlu Öğretmen</Label>
                    <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Öğretmen Seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    onClick={() => createMutation.mutate()} 
                    disabled={createMutation.isPending || !formData.name || !selectedTeacherId}
                    className="font-bold rounded-xl px-8 shadow-lg shadow-primary/20"
                  >
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Oluştur
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
              <DialogContent className="rounded-3xl">
                <DialogHeader><DialogTitle className="text-2xl font-black">Sınıfı Düzenle</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="font-bold">Sınıf Adı</Label>
                    <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold">Açıklama</Label>
                    <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    onClick={() => updateMutation.mutate()} 
                    disabled={updateMutation.isPending || !formData.name}
                    className="font-bold rounded-xl px-8"
                  >
                    {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Güncelle
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Delete Dialog */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
              <DialogContent className="rounded-3xl">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black text-destructive">Sınıfı Sil</DialogTitle>
                  <DialogDescription>
                    "{selectedClass?.name}" sınıfını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>İptal</Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sınıfı Sil
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Manage Teachers Dialog */}
            <Dialog open={isManageTeachersOpen} onOpenChange={setIsManageTeachersOpen}>
              <DialogContent className="rounded-3xl sm:max-w-[500px]">
                <DialogHeader><DialogTitle className="text-2xl font-black">Öğretmenleri Yönet: {selectedClass?.name}</DialogTitle></DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="space-y-3">
                    <Label className="font-bold text-xs uppercase tracking-wider opacity-70">Atanan Öğretmenler</Label>
                    <div className="space-y-2">
                      {selectedClass?.teachers?.map((t: any) => (
                        <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/10">
                          <div className="font-bold">{t.name}</div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeTeacherMutation.mutate(t.id)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {(!selectedClass?.teachers || selectedClass.teachers.length === 0) && (
                        <div className="text-center py-4 text-muted-foreground italic text-sm">Henüz öğretmen atanmamış.</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <Label className="font-bold text-xs uppercase tracking-wider opacity-70">Yeni Öğretmen Ata</Label>
                    <Select onValueChange={(val) => assignTeacherMutation.mutate(val)}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Öğretmen Seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.filter(t => !selectedClass?.teachers?.some((at: any) => at.id === t.id)).map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Manage Students Dialog */}
            <Dialog open={isManageStudentsOpen} onOpenChange={setIsManageStudentsOpen}>
              <DialogContent className="rounded-3xl sm:max-w-[500px]">
                <DialogHeader><DialogTitle className="text-2xl font-black">Öğrencileri Yönet: {selectedClass?.name}</DialogTitle></DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="space-y-3">
                    <Label className="font-bold text-xs uppercase tracking-wider opacity-70">Sınıf Öğrencileri ({students.filter(s => s.classId === selectedClass?.id).length})</Label>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                      {students.filter(s => s.classId === selectedClass?.id).map((s: any) => (
                        <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-blue-50 border border-blue-100">
                          <div className="font-bold text-blue-900">{s.name}</div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeStudentMutation.mutate(s.id)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {students.filter(s => s.classId === selectedClass?.id).length === 0 && (
                        <div className="text-center py-4 text-muted-foreground italic text-sm">Bu sınıfta henüz öğrenci yok.</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <Label className="font-bold text-xs uppercase tracking-wider opacity-70">Öğrenci Ekle</Label>
                    <Select onValueChange={(val) => assignStudentMutation.mutate(val)}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Öğrenci Seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {students.filter(s => s.classId !== selectedClass?.id).map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} {s.classId ? '(Sınıf Değiştir)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground italic">* Öğrenciler sadece bir sınıfa ait olabilir.</p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
