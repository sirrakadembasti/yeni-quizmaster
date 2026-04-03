import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BookOpen, 
  Clock, 
  Trophy, 
  Star,
  ArrowRight,
  CheckCircle2,
  Play,
  AlertCircle,
  Loader2,
  TrendingUp,
  Target
} from "lucide-react";
import { quizApi, resultApi, authApi } from "@/lib/api";

export default function StudentDashboard() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [className, setClassName] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const [userData, quizzesData, resultsData] = await Promise.all([
          authApi.getCurrentUser(),
          quizApi.getStudentQuizzes(),
          resultApi.getStudentResults(),
        ]);
        setUser(userData.user);
        if (userData.user?.classId) {
          try {
            const classResp = await (await import('@/lib/api')).classApi.getClass(userData.user.classId);
            setClassName(classResp.class?.name || null);
          } catch (e) {
            setClassName(null);
          }
        }
        setQuizzes(quizzesData.quizzes || []);
        setResults(resultsData.results || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Veriler yüklenemedi");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const pendingQuizzes = quizzes.filter(q => 
    !results.find(r => r.quizId === q.id && r.status === 'completed')
  );
  const completedResults = results.filter(r => r.status === 'completed');
  const averageScore = completedResults.length > 0
    ? Math.round(completedResults.reduce((sum, r) => sum + (r.score || 0), 0) / completedResults.length)
    : 0;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground font-medium">Dashboard yükleniyor...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-10">
        {/* Welcome Section - Modernized */}
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/10 p-8 sm:p-10">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <Target className="w-4 h-4" />
                <span>Öğrenci Paneli</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-heading font-bold text-foreground tracking-tight">
                Hoş Geldin, <span className="text-primary">{user?.name?.split(' ')[0] || 'Öğrenci'}</span> 👋
              </h1>
              <p className="text-muted-foreground text-lg max-w-xl">
                Öğrenme yolculuğuna kaldığın yerden devam et. Yeni başarılar seni bekliyor.
              </p>
              {className && (
                <div className="pt-2 flex gap-2 flex-wrap">
                  <Badge variant="outline" className="text-sm font-medium border-primary/20 bg-background/50 backdrop-blur-sm">
                    Sınıf: {className}
                  </Badge>
                  {user?.classNo && (
                    <Badge variant="outline" className="text-sm font-medium border-primary/20 bg-background/50 backdrop-blur-sm">
                      Sınıf No: {user.classNo}
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <div className="flex-shrink-0">
              <Button 
                size="lg"
                onClick={() => setLocation('/student/quizzes')} 
                className="gap-2 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 transition-all text-base px-8 h-14 rounded-xl"
              >
                <Play className="h-5 w-5 fill-current" /> Sınavlara Git
              </Button>
            </div>
          </div>
          {/* Decorative background elements */}
          <div className="absolute right-0 top-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="absolute left-0 bottom-0 w-48 h-48 bg-blue-500/5 rounded-full blur-2xl translate-y-1/3 -translate-x-1/4" />
        </div>

        {error && (
          <Card className="border-destructive/50 bg-destructive/10">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid - Modernized Cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="relative overflow-hidden border border-border/50 shadow-sm dark:shadow-none hover:shadow-md hover:border-blue-500/30 transition-all duration-300 bg-card group">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-muted-foreground text-sm font-medium">Ortalama Başarı</p>
                  <p className="text-4xl font-bold tracking-tight text-foreground">{averageScore}%</p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-xl group-hover:scale-110 group-hover:bg-blue-500/20 transition-all duration-300">
                  <Trophy className="h-6 w-6 text-blue-500" />
                </div>
              </div>
              <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <span>{completedResults.length} sınav baz alındı</span>
              </div>
            </CardContent>
          </Card>
          
          <Card className="relative overflow-hidden border border-border/50 shadow-sm dark:shadow-none hover:shadow-md hover:border-emerald-500/30 transition-all duration-300 bg-card group">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-muted-foreground text-sm font-medium">Tamamlanan</p>
                  <p className="text-4xl font-bold tracking-tight text-foreground">{completedResults.length}</p>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-xl group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all duration-300">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                </div>
              </div>
              <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium text-emerald-500">Harika gidiyorsun!</span> Toplam katılım
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border border-border/50 shadow-sm dark:shadow-none hover:shadow-md hover:border-amber-500/30 transition-all duration-300 bg-card group sm:col-span-2 lg:col-span-1">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-muted-foreground text-sm font-medium">Bekleyen</p>
                  <p className="text-4xl font-bold tracking-tight text-foreground">{pendingQuizzes.length}</p>
                </div>
                <div className="p-3 bg-amber-500/10 rounded-xl group-hover:scale-110 group-hover:bg-amber-500/20 transition-all duration-300">
                  <Star className="h-6 w-6 text-amber-500" />
                </div>
              </div>
              <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                <span>Çözülmeyi bekleyen sınavların var</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Quizzes & Recent Results Section */}
        <div className="grid gap-8 lg:grid-cols-3">
          
          {/* Left Column: Pending Quizzes */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-heading font-bold tracking-tight">Sıradaki Sınavlar</h2>
              {pendingQuizzes.length > 2 && (
                <Button variant="ghost" className="text-primary hover:text-primary/80 group text-sm" onClick={() => setLocation('/student/quizzes')}>
                  Tümünü Gör <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              )}
            </div>

            {pendingQuizzes.length === 0 ? (
              <Card className="bg-muted/10 border-dashed border-2">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Tüm Sınavları Tamamladın!</h3>
                  <p className="text-muted-foreground max-w-sm mb-6">Şu an atanmış yeni bir sınavın bulunmuyor. Geçmiş sınavlarını inceleyebilirsin.</p>
                  <Button onClick={() => setLocation('/student/quizzes')} variant="outline" className="rounded-full px-6">
                    Geçmiş Sınavları Gör
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {pendingQuizzes.slice(0, 4).map((quiz) => (
                  <Card key={quiz.id} className="group hover:border-primary/50 transition-all duration-300 hover:shadow-lg flex flex-col bg-card overflow-hidden">
                    <div className="h-2 w-full bg-gradient-to-r from-primary/40 to-primary/10" />
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-start mb-3">
                        <Badge variant="secondary" className="bg-secondary/50 font-medium">{quiz.category || 'Genel'}</Badge>
                      </div>
                      <CardTitle className="text-lg group-hover:text-primary transition-colors line-clamp-1">{quiz.title}</CardTitle>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground font-medium mt-3">
                        {quiz.timeLimit && (
                          <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md"><Clock className="h-3.5 w-3.5" /> {Math.floor(quiz.timeLimit / 60)} dk</span>
                        )}
                        <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md"><BookOpen className="h-3.5 w-3.5" /> {quiz.questionCount || 0} Soru</span>
                      </div>
                    </CardHeader>
                    <CardContent className="mt-auto pt-0">
                      <Button 
                        className="w-full gap-2 rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300"
                        variant="secondary"
                        onClick={() => setLocation(`/student/quiz/${quiz.id}`)}
                      >
                        <Play className="h-4 w-4 fill-current" /> Sınava Başla
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Recent Results */}
          <div className="space-y-6">
            <h2 className="text-2xl font-heading font-bold tracking-tight">Sonuçların</h2>
            
            {completedResults.length === 0 ? (
              <Card className="bg-muted/10 border-dashed">
                <CardContent className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">Henüz tamamlanmış sınavın yok.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {completedResults.slice(0, 4).map((result) => {
                  const score = result.score || 0;
                  const isSuccess = score >= 50;
                  
                  return (
                    <Card key={result.id} className="hover:border-primary/30 transition-all hover:shadow-md group bg-card">
                      <CardContent className="p-5 flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${isSuccess ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                          {isSuccess ? <Trophy className="h-6 w-6" /> : <Target className="h-6 w-6" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {result.quiz?.title || result.quizTitle || 'İsimsiz Sınav'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(result.submittedAt).toLocaleDateString('tr-TR')}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className={`text-xl font-black tracking-tight ${
                              score >= 70 ? 'text-emerald-500' : score >= 50 ? 'text-amber-500' : 'text-rose-500'
                            }`}>
                              {score.toFixed(0)}
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-primary/5 hover:bg-primary/10 hover:text-primary h-8 w-8"
                            onClick={() => setLocation(`/student/result/${result.id}`)}
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                
                {completedResults.length > 4 && (
                  <Button variant="outline" className="w-full text-sm" onClick={() => setLocation('/student/statistics')}>
                    Tüm Sonuçları Gör
                  </Button>
                )}
              </div>
            )}
          </div>
          
        </div>
      </div>
    </DashboardLayout>
  );
}
