import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteQuizWithReason } from "@/lib/quiz-delete";
import { invalidateQuizData } from "@/lib/admin-cache";
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
import { Badge } from "@/components/ui/badge";
import {
  Search,
  MoreHorizontal,
  Loader2,
  Trash2,
  Edit2,
  FileText
} from "lucide-react";
import { useEffect, useState } from "react";
import { quizApi, userApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";

export default function AdminQuizzesPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<any | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  const { data: quizzesData, isLoading: isQuizzesLoading, isError: quizzesError, refetch: retryQuizzes } = useQuery({
    queryKey: ['admin-quizzes'],
    queryFn: () => quizApi.getAllAdminQuizzes(),
  });

  const { data: usersData, isError: usersError, refetch: retryUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.getAllUsers(),
  });

  const quizzes = quizzesData?.quizzes || [];
  const users = usersData?.users || [];

  const deleteMutation = useMutation({
    mutationFn: () => deleteQuizWithReason(selectedQuiz!.id, deleteReason),
    onSuccess: () => {
      invalidateQuizData(queryClient);
      toast({ title: "Başarılı", description: "Sınav silindi." });
      setIsDeleteOpen(false);
      setDeleteReason("");
    },
    onError: (error: Error) => toast({ title: "Sınav silinemedi", description: error.message, variant: "destructive" }),
  });

  const filteredQuizzes = quizzes.filter(q =>
    q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => setCurrentPage(1), [searchTerm]);
  const totalPages = Math.max(1, Math.ceil(filteredQuizzes.length / pageSize));
  useEffect(() => setCurrentPage(page => Math.min(page, totalPages)), [totalPages]);
  const paginatedQuizzes = filteredQuizzes.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-heading font-bold flex items-center gap-2">
              <FileText className="h-8 w-8 text-primary" />
              Sınav Yönetimi (Admin)
            </h1>
            <p className="text-muted-foreground mt-1">Sistemdeki tüm öğretmenlerin oluşturduğu sınavları yönetin.</p> 
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Sınav başlığı veya ders ile ara"
              placeholder="Sınav başlığı veya ders ile ara..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {usersError && <div role="alert" className="rounded-lg border p-3">Öğretmen bilgileri yüklenemedi. {usersData && 'Son yüklenen öğretmen bilgileri gösteriliyor.'} <Button variant="outline" onClick={() => retryUsers()}>Öğretmenleri yeniden yükle</Button></div>}

        <div className="border rounded-lg bg-card overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-bold">Sınav Başlığı</TableHead>
                <TableHead className="font-bold">Öğretmen (Oluşturan)</TableHead>
                <TableHead className="font-bold">Ders / Kategori</TableHead>
                <TableHead className="font-bold">Sınıf</TableHead>
                <TableHead className="font-bold">Durum</TableHead>
                <TableHead className="font-bold">Oluşturulma Tarihi</TableHead>
                <TableHead className="text-right font-bold print:hidden">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isQuizzesLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : quizzesError ? (
                <TableRow><TableCell colSpan={7}><div role="alert" className="space-y-2 py-6 text-center"><p>Sınavlar yüklenemedi.</p><Button variant="outline" onClick={() => retryQuizzes()}>Yeniden dene</Button></div></TableCell></TableRow>
              ) : filteredQuizzes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground font-medium">
                    Sınav bulunamadı.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedQuizzes.map((quiz) => {
                  const creator = users.find(u => u.id === quiz.createdBy);
                  const assignedClasses = (quiz as any).assignedClasses || [];
                  
                  return (
                    <TableRow key={quiz.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-bold">{quiz.title}</TableCell>
                      <TableCell className="text-sm">{creator ? creator.name : 'Bilinmeyen'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-bold bg-indigo-50/50 text-indigo-700 border-indigo-200">
                          {quiz.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {assignedClasses.length > 0 ? (
                            assignedClasses.map((cls: any) => (
                              <Badge key={cls.id} variant="secondary" className="text-[10px] bg-slate-100 text-slate-700 border-slate-200">
                                {cls.name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Atanmamış</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={quiz.status === 'published' ? 'default' : quiz.status === 'archived' ? 'outline' : 'secondary'} className={quiz.status === 'published' ? 'bg-emerald-600' : ''}>
                          {quiz.status === 'published' ? 'Yayınlandı' : quiz.status === 'archived' ? 'Arşivlenmiş' : 'Taslak'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(quiz.createdAt), "dd MMM yyyy")}</TableCell>
                      <TableCell className="text-right print:hidden">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-label={`${quiz.title} işlemleri`} variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>İşlemler</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setLocation(`/quizzes/${quiz.id}`)} className="cursor-pointer">  
                              <Edit2 className="h-4 w-4 mr-2" /> Düzenle
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedQuiz(quiz); setDeleteReason(""); setIsDeleteOpen(true); }} className="cursor-pointer text-destructive focus:text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" /> Sil
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {!isQuizzesLoading && !quizzesError && filteredQuizzes.length > 0 && (
            <div className="flex flex-col gap-2 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">{filteredQuizzes.length} kayıt · Sayfa {currentPage}/{totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((page) => page - 1)}>Önceki</Button>
                <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((page) => page + 1)}>Sonraki</Button>
              </div>
            </div>
          )}
        </div>

        {/* DELETE MODAL */}
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-destructive font-black">Sınavı Sil</DialogTitle>
              <DialogDescription className="font-medium pt-2">
                <strong>{selectedQuiz?.title}</strong> isimli sınav, tüm soruları ve öğrenci sonuçları kalıcı olarak silinir. Bu işlem geri alınamaz.
                {typeof selectedQuiz?.participantCount === 'number' && <span className="block mt-2">Listede {selectedQuiz.participantCount} öğrenci sonucu bulunuyor.</span>}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2"><Label htmlFor="admin-delete-reason">Silme Nedeni</Label><Textarea id="admin-delete-reason" value={deleteReason} onChange={event => setDeleteReason(event.target.value)} placeholder="En az 5 karakterle nedeni belirtin" /></div>
            <DialogFooter className="pt-4 gap-2">
              <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="rounded-xl">İptal</Button>
              <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending || deleteReason.trim().length < 5} className="rounded-xl px-8 shadow-lg shadow-red-100">
                {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Evet, Kalıcı Olarak Sil
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
