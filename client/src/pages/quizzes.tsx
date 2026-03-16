import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Card, 
  CardContent, 
  CardFooter, 
  CardHeader,
  CardTitle,
  CardDescription
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
  X
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
import { Textarea } from "@/components/ui/textarea";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { quizApi } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const categoryColors: { [key: string]: string } = {
  "Matematik": "bg-blue-100 text-blue-700",
  "Fen Bilimleri": "bg-emerald-100 text-emerald-700",
  "Türkçe": "bg-rose-100 text-rose-700",
  "Tarih": "bg-amber-100 text-amber-700",
  "İngilizce": "bg-purple-100 text-purple-700",
  "Genel": "bg-slate-100 text-slate-700"
};

export default function QuizzesPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  const { data: quizzesData, isLoading } = useQuery({
    queryKey: ['quizzes'],
    queryFn: () => quizApi.getAllQuizzes(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => quizApi.deleteQuiz(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      toast({
        title: "Başarılı",
        description: "Sınav silindi"
      });
      setDeleteModalOpen(false);
      setDeleteReason("");
      setQuizToDelete(null);
    },
    onError: () => {
      toast({
        title: "Hata",
        description: "Sınav silinemedi",
        variant: "destructive"
      });
    }
  });

  const confirmDelete = () => {
    if (!quizToDelete) return;
    if (deleteReason.trim().length < 5) {
      toast({
        title: "Uyarı",
        description: "Lütfen geçerli bir silme nedeni girin (en az 5 karakter).",
        variant: "destructive"
      });
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
    if (!searchTerm) return quizzes;
    
    const lowerSearch = searchTerm.toLowerCase();
    return quizzes.filter(quiz =>
      quiz.title.toLowerCase().includes(lowerSearch) ||
      (quiz.description && quiz.description.toLowerCase().includes(lowerSearch)) ||
      (quiz.category && quiz.category.toLowerCase().includes(lowerSearch))
    );
  }, [quizzesData, searchTerm]);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
              Sınavlarım
            </h1>
            <p className="text-muted-foreground mt-1">Hazırladığınız tüm sınavları buradan yönetin.</p>
          </div>
          {role !== 'student' && (
            <Button onClick={() => setLocation("/create-quiz")} className="gap-2 font-bold shadow-lg shadow-primary/20">
              <Plus className="h-4 w-4" />
              Yeni Sınav Oluştur
            </Button>
          )}
        </div>

        {/* Search Bar */}
        <Card className="border-primary/10 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Sınav adı, açıklama veya Ders ile ara..." 
                  className="pl-10 h-11 bg-background"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute right-1 top-1 h-9 w-9 text-muted-foreground"
                    onClick={() => setSearchTerm("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Button variant="outline" className="h-11 font-bold gap-2">
                <Filter className="h-4 w-4" />
                Filtrele
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : filteredQuizzes.length === 0 ? (
          <Card className="border-dashed border-2 py-24 bg-muted/20">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <FileQuestion className="h-16 w-16 text-muted-foreground/20 mb-4" />
              <h3 className="text-xl font-bold">Sınav Bulunamadı</h3>
              <p className="text-muted-foreground mt-1">Henüz bir sınav oluşturmadınız veya arama kriterine uygun sonuç yok.</p>
              {role !== 'student' && (
                <Button variant="link" className="mt-4 font-bold" onClick={() => setLocation("/create-quiz")}>
                  Hemen bir tane oluşturun →
                </Button>
              )}
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
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground rounded-full hover:bg-muted transition-colors">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        <DropdownMenuItem className="font-medium" onClick={() => setLocation(`/quizzes/${quiz.id}`)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Düzenle
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive font-medium" onClick={() => openDeleteModal(quiz.id)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Sil
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-black text-xl line-clamp-1 group-hover:text-primary transition-colors">
                      {quiz.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
                      {quiz.description || "Bu sınav için bir açıklama bulunmuyor."}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="pb-4 flex-1">
                  <div className="grid grid-cols-3 gap-2 p-3 bg-muted/30 rounded-xl border border-border/50">
                    <div className="flex flex-col items-center justify-center text-center">
                      <FileQuestion className="h-4 w-4 text-blue-500 mb-1" />
                      <span className="text-[10px] font-black uppercase text-muted-foreground">Soru</span>
                      <span className="font-bold text-sm">{quiz.questionCount || 0}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center text-center border-x border-border/50 px-2">
                      <Clock className="h-4 w-4 text-emerald-500 mb-1" />
                      <span className="text-[10px] font-black uppercase text-muted-foreground">Süre</span>
                      <span className="font-bold text-sm">{quiz.timeLimit ? `${quiz.timeLimit} dk` : "Yok"}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center text-center">
                      <Users className="h-4 w-4 text-purple-500 mb-1" />
                      <span className="text-[10px] font-black uppercase text-muted-foreground">Katılım</span>
                      <span className="font-bold text-sm">{quiz.participantCount || 0}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between items-center pt-2 bg-muted/10 border-t border-primary/5 p-4">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full animate-pulse ${
                      quiz.status === 'published' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 
                      quiz.status === 'draft' ? 'bg-amber-500' : 'bg-slate-400'
                    }`} />
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {quiz.status === 'published' ? 'Yayında' : 'Taslak'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="font-bold rounded-lg h-9 px-4 border-primary/20 hover:bg-primary/5"
                      onClick={() => setLocation(`/student/quiz/${quiz.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Önizle
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-destructive flex items-center gap-2">
              <Trash2 className="h-6 w-6" />
              Sınavı Sil
            </DialogTitle>
            <DialogDescription className="text-base">
              Bu sınavı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve sınav ait tüm öğrenci sonuçları silinir.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2 py-4">
            <Label className="font-bold">Silme Nedeni (Gerekli)</Label>
            <Textarea 
              placeholder="Lütfen neden sildiğinizi kısaca belirtin..." 
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">En az 5 karakter girilmelidir.</p>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" className="font-bold rounded-xl" onClick={() => setDeleteModalOpen(false)}>
              Vazgeç
            </Button>
            <Button 
              variant="destructive" 
              className="font-bold rounded-xl px-6 shadow-lg shadow-destructive/20"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending || deleteReason.trim().length < 5}
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Kalıcı Olarak Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
