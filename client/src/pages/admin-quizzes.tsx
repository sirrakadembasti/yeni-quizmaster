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
      queryClient.invalidateQueries({ queryKey: ['admin-quizzes'] });
      toast({ title: "Ba�ar�l�", description: "S�nav silindi." });
      setIsDeleteOpen(false);
    }
  });

  const filteredQuizzes = quizzes.filter(q =>
    q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-heading font-bold flex items-center gap-2">
              <FileText className="h-8 w-8 text-primary" />
              S�nav Y�netimi (Admin)
            </h1>
            <p className="text-muted-foreground mt-1">Sistemdeki t�m ��retmenlerin olu�turdu�u s�navlar� y�netin.</p> 
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="S�nav ba�l��� veya ders ile ara..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="border rounded-lg bg-card overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-bold">S�nav Ba�l���</TableHead>
                <TableHead className="font-bold">��retmen (Olu�turan)</TableHead>
                <TableHead className="font-bold">Ders / Kategori</TableHead>
                <TableHead className="font-bold">S�n�f</TableHead>
                <TableHead className="font-bold">Durum</TableHead>
                <TableHead className="font-bold">Olu�turulma Tarihi</TableHead>
                <TableHead className="text-right font-bold">��lemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isQuizzesLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredQuizzes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground font-medium">
                    S�nav bulunamad�.
                  </TableCell>
                </TableRow>
              ) : (
                filteredQuizzes.map((quiz) => {
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
                            <span className="text-xs text-muted-foreground italic">Atanmam��</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={quiz.status === 'published' ? 'default' : 'secondary'} className={quiz.status === 'published' ? 'bg-emerald-600' : ''}>
                          {quiz.status === 'published' ? 'Yay�nland�' : 'Taslak'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(quiz.createdAt), "dd MMM yyyy")}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>��lemler</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setLocation(`/quizzes/${quiz.id}`)} className="cursor-pointer">  
                              <Edit2 className="h-4 w-4 mr-2" /> D�zenle
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
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-destructive font-black">S�nav� Sil</DialogTitle>
              <DialogDescription className="font-medium pt-2">
                <strong>{selectedQuiz?.title}</strong> isimli s�nav� ve ona ba�l� t�m sorular� silmek istedi�inize emin misiniz? Bu i�lem geri al�namaz.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="pt-4 gap-2">
              <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="rounded-xl">�ptal</Button>
              <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="rounded-xl px-8 shadow-lg shadow-red-100">      
                {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Evet, Kal�c� Olarak Sil
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
