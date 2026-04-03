import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  FileText, 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  ArrowRight,
  Loader2
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLocation } from "wouter";
import { useAuth } from "@/context/auth-context";
import { dashboardApi, quizApi, userApi, resultApi, classApi, adminApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

function formatDayLabel(date: Date) {
  return date.toLocaleDateString('tr-TR', { weekday: 'short' });
}

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { user, role } = useAuth();

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats', role],
    queryFn: () => role === 'teacher' ? dashboardApi.getTeacherStats() : dashboardApi.getAdminStats(),
  });

  const { data: classesData } = useQuery({
    queryKey: ['teacher-classes'],
    queryFn: () => classApi.getTeacherClasses(),
    enabled: role === 'teacher',
  });

  const { data: quizzesData, isLoading: quizzesLoading } = useQuery({
    queryKey: ['quizzes'],
    queryFn: () => quizApi.getAllQuizzes(),
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.getAllUsers(),
  });

  const { data: resultsData, isLoading: resultsLoading } = useQuery({
    queryKey: ['all-results'],
    queryFn: async () => {
      if (!quizzesData?.quizzes) return [];
      const resultsPerQuiz = await Promise.all(
        quizzesData.quizzes.map((q) => 
          resultApi.getQuizResults(q.id)
            .then(r => (r.results || []).map(res => ({ ...res, quizId: q.id, quizTitle: q.title })))
            .catch(() => [])
        )
      );
      return resultsPerQuiz.flat();
    },
    enabled: !!quizzesData?.quizzes,
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['admin-logs'],
    queryFn: () => adminApi.getLogs(),
    enabled: role === 'admin',
  });

  const stats = statsData?.stats;
  const isLoading = statsLoading || quizzesLoading || usersLoading || resultsLoading || logsLoading;

  const { chartData, recentQuizzes, recentLogs } = useMemo(() => {
    if (!resultsData || !quizzesData?.quizzes || !usersData?.users) {
      return { chartData: [], recentQuizzes: [], recentLogs: [] };
    }

    const totalStudentsCount = usersData.users.filter((u: any) => u.role === 'student').length;

    // Chart Data
    const last7: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      last7[d.toDateString()] = 0;
    }

    resultsData.forEach((r: any) => {
      if (!r.submittedAt) return;
      const d = new Date(r.submittedAt).toDateString();
      if (last7[d] !== undefined) last7[d]++;
    });

    const chart = Object.keys(last7).map(k => ({ 
      name: formatDayLabel(new Date(k)), 
      count: last7[k] 
    }));

    // Recent Quizzes
    const recent = quizzesData.quizzes
      .slice(0, 5)
      .map((q: any) => {
        const participants = resultsData.filter((r: any) => r.quizId === q.id).length;
        const percentage = totalStudentsCount > 0 
          ? Math.round((participants / totalStudentsCount) * 100) 
          : 0;
        
        return { title: q.title, participants, percentage };
      });

    // Recent Logs
    const logs = (logsData?.logs || []).slice(0, 5);

    return { chartData: chart, recentQuizzes: recent, recentLogs: logs };
  }, [resultsData, quizzesData, usersData, logsData]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-foreground tracking-tight">
              Hoş Geldin, <span className="text-primary">{user?.name || 'Kullanıcı'}</span> 👋
            </h1>
            <div className="flex gap-2 mt-2 flex-wrap">
              <Badge variant="outline" className="text-xs font-bold bg-primary/5 text-primary border-primary/20">
                {role === 'admin' ? 'Yönetici' : 'Öğretmen'}
              </Badge>
              {role === 'teacher' && user?.assignedCategories?.map((cat: any) => (
                <Badge key={cat.id} variant="secondary" className="text-xs font-medium bg-blue-50 text-blue-700">
                  Ders: {cat.name}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            {role === "teacher" && (
              <Button onClick={() => setLocation("/create-quiz")} className="gap-2 font-bold shadow-lg shadow-primary/20">
                <FileText className="h-4 w-4" /> Yeni Sınav Oluştur
              </Button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-primary/10 shadow-sm dark:shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold">Toplam Sınav</CardTitle>
              <FileText className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black">{stats?.totalQuizzes || 0}</div>
            </CardContent>
          </Card>
          <Card className="border-primary/10 shadow-sm dark:shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold">Aktif Öğrenci</CardTitle>
              <Users className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black">{stats?.totalStudents || 0}</div>
            </CardContent>
          </Card>
          <Card className="border-primary/10 shadow-sm dark:shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold">Toplam Katılım</CardTitle>
              <CheckCircle className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black">{stats?.totalResults || 0}</div>
            </CardContent>
          </Card>
          <Card className="border-primary/10 shadow-sm dark:shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold">Başarı Oranı</CardTitle>
              <TrendingUp className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black">{stats?.averageStudentScore || 0}%</div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid gap-6 md:grid-cols-7">
          <Card className="col-span-4 border-primary/10 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Haftalık Katılım</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} />
                    <Bar dataKey="count" name="Katılımcı" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-3 border-primary/10 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Sınav Katılım Oranları</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                {recentQuizzes.map((item, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-bold truncate max-w-[150px]">{item.title}</span>
                      <span className="font-black text-primary">%{item.percentage}</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${item.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Section */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Activity Logs (Only for Admin) */}
          <Card className="border-primary/10 shadow-md">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-orange-500" /> Son Aktiviteler
                </CardTitle>
                <CardDescription>Sistemdeki son işlemler</CardDescription>
              </div>
              {role === 'admin' && (
                <Button variant="ghost" size="sm" onClick={() => setLocation("/results?tab=logs")} className="text-primary font-bold">
                  Detaylar <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-4 pt-2">
                {recentLogs.map((log: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50/50 dark:bg-slate-900/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 dark:border-slate-700">
                    <div className="mt-1.5 h-2 w-2 rounded-full bg-primary" />
                    <div className="flex-1 space-y-0.5">
                      <p className="text-sm font-bold text-foreground leading-tight">{log.action}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{log.details}</p>
                      <div className="flex items-center gap-2 pt-1 text-[10px]">
                        <span className="text-muted-foreground">{new Date(log.createdAt).toLocaleTimeString('tr-TR')}</span>
                        <span className="text-primary font-bold uppercase">{log.user?.name || 'Sistem'}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {recentLogs.length === 0 && <div className="text-center py-10 text-muted-foreground italic">Henüz kayıt yok.</div>}
              </div>
            </CardContent>
          </Card>

          {/* Quick Info Card */}
          <Card className="border-primary/10 shadow-md bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Sistem Bilgisi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm text-muted-foreground">
                <p><strong>QuizMaster v2.0</strong> sürümünü kullanıyorsunuz.</p>
                <p>Yapay zeka desteği ile sınavlarınızı daha hızlı oluşturabilir ve analiz edebilirsiniz.</p>
                <div className="pt-4">
                  <Button variant="outline" className="w-full" onClick={() => setLocation("/settings")}>Ayarları Yönet</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}