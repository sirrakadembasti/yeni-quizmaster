import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Search,
  Plus,
  MoreVertical,
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
import { useEffect, useState, useMemo } from "react";
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
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  
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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategoryId, selectedClassId]);

  const totalPages = Math.max(1, Math.ceil(filteredQuizzes.length / pageSize));
  const paginatedQuizzes = filteredQuizzes.slice((currentPage - 1) * pageSize, currentPage * pageSize);
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
          <Card className="overflow-hidden border-border/60">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead>Sınav</TableHead>
                    <TableHead>Ders</TableHead>
                    <TableHead>Sınıflar</TableHead>
                    <TableHead className="text-center">Soru</TableHead>
                    <TableHead className="text-center">Süre</TableHead>
                    <TableHead className="text-center">Katılım</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedQuizzes.map((quiz) => (
                    <TableRow key={quiz.id}>
                      <TableCell className="min-w-[220px]">
                        <p className="font-bold">{quiz.title}</p>
                        <p className="max-w-[300px] truncate text-xs text-muted-foreground">{quiz.description || "Açıklama yok."}</p>
                      </TableCell>
                      <TableCell><Badge variant="secondary" className={categoryColors[quiz.category] || ""}>{quiz.category || "Genel"}</Badge></TableCell>
                      <TableCell className="min-w-[160px]">
                        <div className="flex flex-wrap gap-1">{quiz.assignedClasses?.length
                          ? quiz.assignedClasses.map((cls: any) => <Badge key={cls.id} variant="outline" className="text-[10px]">{cls.name}</Badge>)
                          : <span className="text-xs text-muted-foreground">Atanmamış</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-center tabular-nums">{quiz.questionCount || 0}</TableCell>
                      <TableCell className="text-center tabular-nums">{quiz.timeLimit ? `${quiz.timeLimit} dk` : "-"}</TableCell>
                      <TableCell className="text-center tabular-nums">{quiz.participantCount || 0}</TableCell>
                      <TableCell><Badge variant={quiz.status === "published" ? "default" : "outline"}>{quiz.status === "published" ? "Yayında" : "Taslak"}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="outline" size="sm" onClick={() => setLocation(`/student/quiz/${quiz.id}`)}><Eye className="mr-1 h-4 w-4" />Önizle</Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setLocation(`/quizzes/${quiz.id}`)}><Edit className="mr-2 h-4 w-4" />Düzenle</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => openDeleteModal(quiz.id)}><Trash2 className="mr-2 h-4 w-4" />Sil</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-col gap-2 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">{filteredQuizzes.length} kayıt · Sayfa {currentPage}/{totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((page) => page - 1)}>Önceki</Button>
                <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((page) => page + 1)}>Sonraki</Button>
              </div>
            </div>
          </Card>
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
