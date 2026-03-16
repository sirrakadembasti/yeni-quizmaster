import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  BookOpen,
  Play,
  Search,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { quizApi, resultApi } from "@/lib/api";

export default function StudentQuizzesPage() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [quizzesData, resultsData] = await Promise.all([
          quizApi.getStudentQuizzes(),
          resultApi.getStudentResults(),
        ]);
        setQuizzes(quizzesData.quizzes || []);
        setResults(resultsData.results || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sınavlar yüklenemedi");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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
          <div className="space-y-6">
            {/* Pending Quizzes */}
            {filteredQuizzes.filter(q => getQuizStatus(q.id) === "pending").length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-heading font-semibold">Yapılacak Sınavlar</h2>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {filteredQuizzes.filter(q => getQuizStatus(q.id) === "pending").map((quiz) => (
                    <Card key={quiz.id} className="group hover:border-primary/50 transition-colors flex flex-col">
                      <CardHeader>
                        <div className="flex justify-between items-start mb-2">
                          <Badge variant="secondary" className="font-normal">{quiz.category || 'Genel'}</Badge>
                          <Badge 
                            variant={quiz.difficulty === 'hard' || quiz.difficulty === 'Hard' ? 'destructive' : quiz.difficulty === 'medium' || quiz.difficulty === 'Medium' ? 'default' : 'secondary'}
                            className="text-[10px]"
                          >
                            {quiz.difficulty === 'hard' || quiz.difficulty === 'Hard' ? 'Zor' : quiz.difficulty === 'medium' || quiz.difficulty === 'Medium' ? 'Orta' : 'Kolay'}
                          </Badge>
                        </div>
                        <CardTitle className="text-lg group-hover:text-primary transition-colors">{quiz.title}</CardTitle>
                        <CardDescription className="text-sm">{quiz.description}</CardDescription>
                        <div className="flex items-center gap-4 text-xs mt-3 text-muted-foreground">
                          {quiz.timeLimit && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {Math.floor(quiz.timeLimit / 60)} dk
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <BookOpen className="h-3 w-3" /> {quiz.questionCount || 0} Soru
                          </span>
                        </div>
                      </CardHeader>
                      <CardFooter className="flex-1 flex flex-col justify-end pt-4">
                        <Button 
                          className="w-full gap-2 shadow-sm"
                          onClick={() => setLocation(`/student/quiz/${quiz.id}`)}
                        >
                          <Play className="h-4 w-4" />
                          Quize Başla
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Completed Quizzes */}
            {filteredQuizzes.filter(q => getQuizStatus(q.id) === "completed").length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-heading font-semibold">Tamamlanan Sınavlar</h2>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {filteredQuizzes.filter(q => getQuizStatus(q.id) === "completed").map((quiz) => {
                    const result = results.find(r => r.quizId === quiz.id);
                    return (
                      <Card key={quiz.id} className="group hover:border-primary/50 transition-colors opacity-75 flex flex-col">
                        <CardHeader>
                          <div className="flex justify-between items-start mb-2">
                            <Badge variant="secondary" className="font-normal">{quiz.category || 'Genel'}</Badge>
                            <Badge variant="outline" className="text-[10px] text-emerald-600">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Tamamlandı
                            </Badge>
                          </div>
                          <CardTitle className="text-lg group-hover:text-primary transition-colors">{quiz.title}</CardTitle>
                          <CardDescription className="text-sm">{quiz.description}</CardDescription>
                          {result && (
                            <div className="flex items-center gap-2 mt-3">
                              <div className="text-lg font-bold text-emerald-600">
                                {result.score?.toFixed(1) || '0'}%
                              </div>
                            </div>
                          )}
                        </CardHeader>
                        <CardFooter className="flex-1 flex flex-col justify-end pt-4">
                          <Button 
                            variant="outline" 
                            className="w-full gap-2"
                            onClick={() => setLocation(`/student/result/${result?.id}`)}
                          >
                            Detayları Gör
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {filteredQuizzes.length === 0 && (
              <Card className="text-center py-12">
                <CardContent>
                  <p className="text-muted-foreground mb-4">Aradığınız sınav bulunamadı.</p>
                  <Button variant="outline" onClick={() => { setSearchTerm(""); setFilterStatus("all"); }}>
                    Filtreleri Sıfırla
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

