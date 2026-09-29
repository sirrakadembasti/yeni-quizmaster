import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Play,
  Search,
  CheckCircle2,
  AlertCircle,
  Download,
  WifiOff,
} from "lucide-react";
import { quizApi, resultApi } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import {
  getOfflineQuizList,
  getOfflineSession,
  normalizeOfflineQuestions,
  saveOfflineQuizList,
  saveOfflineSession,
} from "@/lib/offline-quiz";

export default function StudentQuizzesPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [preparingId, setPreparingId] = useState<string | null>(null);
  const [preparedIds, setPreparedIds] = useState<Set<string>>(new Set());
  const [offlineView, setOfflineView] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [quizzesData, resultsData] = await Promise.all([
          quizApi.getStudentQuizzes(),
          resultApi.getStudentResults(),
        ]);
        const nextQuizzes = quizzesData.quizzes || [];
        setQuizzes(nextQuizzes);
        setResults(resultsData.results || []);
        setOfflineView(false);
        setError(null);
        if (user) {
          saveOfflineQuizList(user.id, nextQuizzes);
          setPreparedIds(new Set(nextQuizzes
            .filter(quiz => getOfflineSession(user.id, quiz.id))
            .map(quiz => quiz.id)));
        }
      } catch (err) {
        const cachedQuizzes = user ? getOfflineQuizList(user.id) : [];
        if (cachedQuizzes.length > 0) {
          setQuizzes(cachedQuizzes);
          setResults([]);
          setPreparedIds(new Set(cachedQuizzes
            .filter(quiz => getOfflineSession(user!.id, quiz.id))
            .map(quiz => quiz.id)));
          setOfflineView(true);
        } else {
          setError(err instanceof Error ? err.message : "Sınavlar yüklenemedi");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const prepareOffline = async (quizId: string) => {
    if (!user) return;
    try {
      setPreparingId(quizId);
      setActionError(null);
      const data = await quizApi.prepareQuizOffline(quizId);
      saveOfflineSession({
        version: 1,
        userId: user.id,
        quizId,
        resultId: data.resultId,
        quiz: data.quiz,
        questions: normalizeOfflineQuestions(data.questions),
        answers: data.existingAnswers || {},
        remainingSeconds: null,
        timerCapturedAt: data.preparedAt,
        cachedAt: data.preparedAt,
        pendingSubmit: false,
      });
      setPreparedIds(previous => new Set(previous).add(quizId));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Sınav çevrimdışı kullanım için hazırlanamadı");
    } finally {
      setPreparingId(null);
    }
  };

  const getQuizStatus = (quizId: string) => {
    const result = results.find(r => r.quizId === quizId);
    if (result?.status === 'completed') return 'completed';
    return 'pending';
  };

  const filteredQuizzes = quizzes.filter(quiz => {
    const matchesSearch = quiz.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (quiz.category && quiz.category.toLowerCase().includes(searchTerm.toLowerCase()));
    const status = getQuizStatus(quiz.id);
    const matchesFilter = filterStatus === "all" || status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  useEffect(() => setCurrentPage(1), [searchTerm, filterStatus]);
  const totalPages = Math.max(1, Math.ceil(filteredQuizzes.length / pageSize));
  const paginatedQuizzes = filteredQuizzes.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pendingCount = quizzes.filter(q => getQuizStatus(q.id) === "pending").length;
  const completedCount = quizzes.filter(q => getQuizStatus(q.id) === "completed").length;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Sınavlarım</h1>
          <p className="text-muted-foreground mt-2">Size atanan sınavları buradan görebilir ve çözebilirsiniz.</p>
        </div>

        {offlineView && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <WifiOff className="h-4 w-4" />
            Çevrimdışısınız. Yalnızca önceden hazırlanmış sınavlar açılabilir.
          </div>
        )}

        {actionError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {actionError}
          </div>
        )}

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Çözülecek Sınavlar</CardTitle>
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{pendingCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Yapılması gereken sınavlar</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tamamlanan Sınavlar</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{completedCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Bitirilen sınavlar</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Sınav adı veya konu ara..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="md:w-48">
              <SelectValue placeholder="Duruma göre filtrele" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="pending">Yapılacak</SelectItem>
              <SelectItem value="completed">Tamamlanan</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quizzes Grid */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Sınavlar yükleniyor...</p>
          </div>
        ) : error ? (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive mb-4">{error}</p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Yeniden Yükle
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead>Sınav</TableHead>
                    <TableHead>Ders / Öğretmen</TableHead>
                    <TableHead className="text-center">Zorluk</TableHead>
                    <TableHead className="text-center">Soru</TableHead>
                    <TableHead className="text-center">Süre</TableHead>
                    <TableHead>Durum / Puan</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedQuizzes.map((quiz) => {
                    const status = getQuizStatus(quiz.id);
                    const result = results.find((item) => item.quizId === quiz.id);
                    const difficulty = quiz.difficulty === "hard" || quiz.difficulty === "Hard"
                      ? "Zor" : quiz.difficulty === "medium" || quiz.difficulty === "Medium" ? "Orta" : "Kolay";
                    return (
                      <TableRow key={quiz.id} className={status === "completed" ? "opacity-75" : ""}>
                        <TableCell className="min-w-[230px]">
                          <p className="font-bold">{quiz.title}</p>
                          <p className="max-w-[320px] truncate text-xs text-muted-foreground">{quiz.description || "Açıklama yok."}</p>
                        </TableCell>
                        <TableCell><p className="font-medium">{quiz.category || "Genel"}</p><p className="text-xs text-muted-foreground">{quiz.creator?.name || "Bilinmiyor"}</p></TableCell>
                        <TableCell className="text-center"><Badge variant={difficulty === "Zor" ? "destructive" : "secondary"}>{difficulty}</Badge></TableCell>
                        <TableCell className="text-center tabular-nums">{quiz.questionCount || 0}</TableCell>
                        <TableCell className="text-center tabular-nums">{quiz.timeLimit ? `${quiz.timeLimit} dk` : "Süresiz"}</TableCell>
                        <TableCell>
                          {status === "completed"
                            ? <div><Badge variant="outline" className="text-emerald-600">Tamamlandı</Badge><p className="mt-1 text-sm font-bold text-emerald-600">%{result?.score?.toFixed(1) || "0"}</p></div>
                            : <Badge variant="secondary">Yapılacak</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            {status === "pending" ? <>
                              {!quiz.timeLimit && <Button variant="outline" size="sm" disabled={preparingId === quiz.id || offlineView} onClick={() => prepareOffline(quiz.id)}>
                                <Download className="mr-1 h-4 w-4" />{preparedIds.has(quiz.id) ? "Çevrimdışı Hazır" : preparingId === quiz.id ? "Hazırlanıyor" : "Çevrimdışı Hazırla"}
                              </Button>}
                              <Button size="sm" disabled={offlineView && !preparedIds.has(quiz.id)} onClick={() => setLocation(`/student/quiz/${quiz.id}`)}><Play className="mr-1 h-4 w-4" />Başla</Button>
                            </> : <Button variant="outline" size="sm" onClick={() => setLocation(`/student/result/${result?.id}`)}>Detayları Gör</Button>}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {paginatedQuizzes.length === 0 && <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">Aradığınız sınav bulunamadı.</TableCell></TableRow>}
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
    </DashboardLayout>
  );
}

