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
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  MoreHorizontal, 
  Loader2,
  Trash2,
  Edit2,
  BookOpen,
  FileText
} from "lucide-react";
import { useState } from "react";
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
  
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<any | null>(null);

  const { data: quizzesData, isLoading: isQuizzesLoading } = useQuery({
    queryKey: ['admin-quizzes'],
    queryFn: () => quizApi.getAllAdminQuizzes(),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.getAllUsers(),
  });

  const quizzes = quizzesData?.quizzes || [];
  const users = usersData?.users || [];

  const deleteMutation = useMutation({
    mutationFn: () => quizApi.deleteQuiz(selectedQuiz!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      toast({ title: "Başarılı", description: "Sınav silindi." });
      setIsDeleteOpen(false);
    }
  });

  const filteredQuizzes = quizzes.filter(q =>
    q.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              placeholder="Sınav başlığı ile ara..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="border rounded-lg bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sınav Başlığı</TableHead>
                <TableHead>Öğretmen (Oluşturan)</TableHead>
                <TableHead>Ders / Kategori</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Oluşturulma Tarihi</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isQuizzesLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredQuizzes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    Sınav bulunamadı.
                  </TableCell>
                </TableRow>
              ) : (
                filteredQuizzes.map((quiz) => {
                  const creator = users.find(u => u.id === quiz.createdBy);
                  return (
                    <TableRow key={quiz.id}>
                      <TableCell className="font-bold">{quiz.title}</TableCell>
                      <TableCell>{creator ? creator.name : 'Bilinmeyen'}</TableCell>
                      <TableCell>{quiz.category}</TableCell>
                      <TableCell>
                        <Badge variant={quiz.status === 'published' ? 'default' : 'secondary'} className={quiz.status === 'published' ? 'bg-green-600' : ''}>
                          {quiz.status === 'published' ? 'Yayınlandı' : 'Taslak'}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(new Date(quiz.createdAt), "dd MMM yyyy")}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>İşlemler</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setLocation(`/quizzes/${quiz.id}`)} className="cursor-pointer">
                              <Edit2 className="h-4 w-4 mr-2" /> Düzenle
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedQuiz(quiz); setIsDeleteOpen(true); }} className="cursor-pointer text-destructive focus:text-destructive">
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
        </div>

        {/* DELETE MODAL */}
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-destructive">Sınavı Sil</DialogTitle>
              <DialogDescription>
                <strong>{selectedQuiz?.title}</strong> isimli sınavı ve ona bağlı tüm soruları silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>İptal</Button>
              <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sil
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}