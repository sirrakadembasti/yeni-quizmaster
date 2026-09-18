import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Card, 
  CardContent, 
  CardFooter, 
  CardHeader
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Plus,
  MoreVertical,
  Clock,
  Users,
  FileQuestion,
  Filter,
  Loader2,
  Eye,
  Edit,
  Trash2,
  X,
  Book,
  Layers,
  Printer
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { quizApi, categoryApi, classApi } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const categoryColors: { [key: string]: string } = {
  "Matematik": "bg-blue-100 text-blue-700",
  "Fen Bilimleri": "bg-emerald-100 text-emerald-700",
  "Türkçe": "bg-rose-100 text-rose-700",
  "Tarih": "bg-amber-100 text-amber-700",
  "İngilizce": "bg-purple-100 text-purple-700",
  "Genel": "bg-slate-100 dark:bg-slate-800 dark:bg-slate-800 text-slate-700 dark:text-slate-200 dark:text-slate-200"
};

export default function QuizzesPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  
  // State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [selectedClassId, setSelectedClassId] = useState("all");
  
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  // Queries
  const { data: quizzesData, isLoading: quizzesLoading } = useQuery({
    queryKey: ['quizzes'],
    queryFn: () => quizApi.getAllQuizzes(),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryApi.getAllCategories(),
  });

  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: () => role === 'teacher' ? classApi.getTeacherClasses() : classApi.getAllClasses(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => quizApi.deleteQuiz(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      toast({ title: "Başarılı", description: "Sınav silindi" });
      setDeleteModalOpen(false);
      setDeleteReason("");
      setQuizToDelete(null);
    },
    onError: () => {
      toast({ title: "Hata", description: "Sınav silinemedi", variant: "destructive" });
    }
  });

  const confirmDelete = () => {
    if (!quizToDelete) return;
    if (deleteReason.trim().length < 5) {
      toast({ title: "Uyarı", description: "Lütfen geçerli bir silme nedeni girin.", variant: "destructive" });
      return;
    }
    deleteMutation.mutate(quizToDelete);
  };

  const openDeleteModal = (id: string) => {
    setQuizToDelete(id);
    setDeleteReason("");
    setDeleteModalOpen(true);
  };

  const filteredQuizzes = useMemo(() => {
    const quizzes = quizzesData?.quizzes || [];
    return quizzes.filter(quiz => {
      const matchesSearch = !searchTerm || 
        quiz.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (quiz.description && quiz.description.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = selectedCategoryId === "all" || 
        (quiz as any).categoryId === selectedCategoryId || 
        quiz.category === selectedCategoryId;

      const matchesClass = selectedClassId === "all" || 
        quiz.assignedClasses?.some((cls: any) => cls.id === selectedClassId);

      return matchesSearch && matchesCategory && matchesClass;
    });
  }, [quizzesData, searchTerm, selectedCategoryId, selectedClassId]);

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedCategoryId("all");
    setSelectedClassId("all");
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
              Sınavlarım
            </h1>
            <p className="text-muted-foreground mt-1">Hazırladığınız sınavları listeleyin ve filtreleyin.</p>
          </div>
          <div className="flex gap-2 print:hidden">
            <Button 
              variant="outline" 
              onClick={() => window.print()}
              className="rounded-xl font-black gap-2 border-2 hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" /> Yazdır
            </Button>
            {role !== 'student' && (
              <Button onClick={() => setLocation("/create-quiz")} className="gap-2 font-bold shadow-lg shadow-primary/20">
                <Plus className="h-4 w-4" /> Yeni Sınav Oluştur
              </Button>
            )}
          </div>
        </div>

        {/* Improved Filter Bar */}
        <Card className="border-primary/10 shadow-sm dark:shadow-none overflow-visible">
          <CardContent className="p-3">
            <div className="flex flex-col space-y-4">
              <div className="relative w-full">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Sınav adı veya açıklama ile ara..." 
                  className="pl-10 h-11 bg-background"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <Button variant="ghost" size="icon" className="absolute right-1 top-1 h-9 w-9" onClick={() => setSearchTerm("")}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Ders Filtresi</Label>
                  <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                    <SelectTrigger className="h-10">
                      <div className="flex items-center gap-2">
                        <Book className="h-4 w-4 text-muted-foreground" />
                        <SelectValue placeholder="Tüm Dersler" />
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

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Sınıf Filtresi</Label>
                  <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                    <SelectTrigger className="h-10">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-muted-foreground" />
                        <SelectValue placeholder="Tüm Sınıflar" />
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

                <div className="flex items-end">
                  <Button variant="outline" onClick={resetFilters} className="w-full h-10 gap-2 font-bold">
                    <Filter className="h-4 w-4" /> Filtreleri Temizle
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {quizzesLoading ? (
          <div className="flex items-center justify-center py-24"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
        ) : filteredQuizzes.length === 0 ? (
          <Card className="border-dashed border-2 py-24 bg-muted/20">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <FileQuestion className="h-16 w-16 text-muted-foreground/20 mb-4" />
              <h3 className="text-xl font-bold">Sınav Bulunamadı</h3>
              <p className="text-muted-foreground mt-1">Kriterlere uygun bir sınav bulunamadı.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredQuizzes.map((quiz) => (
              <Card key={quiz.id} className="group hover:shadow-xl transition-all duration-300 border-primary/5 flex flex-col rounded-2xl overflow-hidden">
                <CardHeader className="space-y-4 pb-4">
                  <div className="flex justify-between items-start">
                    <Badge variant="secondary" className={`${categoryColors[quiz.category] || "bg-muted text-muted-foreground"} border-none font-bold rounded-full`}>
                      {quiz.category || 'Genel'}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground rounded-full hover:bg-muted"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        <DropdownMenuItem className="font-medium" onClick={() => setLocation(`/quizzes/${quiz.id}`)}><Edit className="mr-2 h-4 w-4" /> Düzenle</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive font-medium" onClick={() => openDeleteModal(quiz.id)}><Trash2 className="mr-2 h-4 w-4" /> Sil</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-black text-xl line-clamp-1 group-hover:text-primary transition-colors">{quiz.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">{quiz.description || "Açıklama yok."}</p>
                  </div>
                </CardHeader>
                <CardContent className="pb-4 flex-1">
                  <div className="grid grid-cols-3 gap-2 p-3 bg-muted/30 rounded-xl border border-border/50">
                    <div className="flex flex-col items-center text-center"><FileQuestion className="h-4 w-4 text-blue-500 mb-1" /><span className="text-[10px] font-black uppercase text-muted-foreground">Soru</span><span className="font-bold text-sm">{quiz.questionCount || 0}</span></div>
                    <div className="flex flex-col items-center text-center border-x border-border/50 px-2"><Clock className="h-4 w-4 text-emerald-500 mb-1" /><span className="text-[10px] font-black uppercase text-muted-foreground">Süre</span><span className="font-bold text-sm">{quiz.timeLimit ? `${quiz.timeLimit} dk` : "Yok"}</span></div>
                    <div className="flex flex-col items-center text-center"><Users className="h-4 w-4 text-purple-500 mb-1" /><span className="text-[10px] font-black uppercase text-muted-foreground">Katılım</span><span className="font-bold text-sm">{quiz.participantCount || 0}</span></div>
                  </div>
                  {/* Atanan Sınıfları Göster */}
                  <div className="mt-4 flex flex-wrap gap-1">
                    {quiz.assignedClasses?.map((cls: any) => (
                      <Badge key={cls.id} variant="outline" className="text-[9px] h-5 py-0 border-primary/20 bg-primary/5 text-primary">
                        {cls.name}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between items-center pt-2 bg-muted/10 border-t border-primary/5 p-3">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${quiz.status === 'published' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{quiz.status === 'published' ? 'Yayında' : 'Taslak'}</span>
                  </div>
                  <Button variant="outline" size="sm" className="font-bold rounded-lg h-9 px-4" onClick={() => setLocation(`/student/quiz/${quiz.id}`)}><Eye className="h-4 w-4 mr-2" /> Önizle</Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle className="text-2xl font-black text-destructive flex items-center gap-2"><Trash2 className="h-6 w-6" /> Sınavı Sil</DialogTitle><DialogDescription>Bu işlem geri alınamaz.</DialogDescription></DialogHeader>
          <div className="space-y-2 py-4"><Label className="font-bold">Silme Nedeni</Label><Textarea placeholder="Nedeni belirtin..." value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} rows={3} className="resize-none" /></div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>Vazgeç</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteMutation.isPending || deleteReason.trim().length < 5}>
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Kalıcı Olarak Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
