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
  Loader2,
  ShieldAlert,
  BarChart3,
  UserCheck,
  BrainCircuit,
  Settings
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
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

  const { chartData, recentQuizzes, recentLogs, adminStats } = useMemo(() => {
    if (!resultsData || !quizzesData?.quizzes || !usersData?.users) {
      return { chartData: [], recentQuizzes: [], recentLogs: [], adminStats: null };
    }

    const totalStudentsCount = usersData.users.filter((u: any) => u.role === 'student').length;
    const totalTeachersCount = usersData.users.filter((u: any) => u.role === 'teacher').length;

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
    const logs = (logsData?.logs || []).slice(0, 8);

    return { 
      chartData: chart, 
      recentQuizzes: recent, 
      recentLogs: logs,
      adminStats: {
        totalStudents: totalStudentsCount,
        totalTeachers: totalTeachersCount,
        totalQuizzes: quizzesData.quizzes.length,
        totalResults: resultsData.length
      }
    };
  }, [resultsData, quizzesData, usersData, logsData]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-32 flex-col gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground font-black animate-pulse">VERİLER HAZIRLANIYOR...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Modern Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-primary/10 via-transparent to-transparent p-6 rounded-3xl border border-primary/10">
          <div>
            <h1 className="text-4xl font-black text-foreground tracking-tighter">
              {role === 'admin' ? 'Yönetim Paneli' : 'Eğitmen Paneli'}
            </h1>
            <div className="flex items-center gap-3 mt-3">
              <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-lg shadow-slate-200">
                {user?.name?.[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold text-foreground leading-none">{user?.name}</p>
                <p className="text-xs text-muted-foreground mt-1 font-medium">{user?.email}</p>
              </div>
              <Badge variant={role === 'admin' ? "destructive" : "default"} className="ml-2 px-3 py-0.5 rounded-full text-[10px] uppercase font-black tracking-widest">
                {role === 'admin' ? 'SİSTEM ADMİN' : 'BRANŞ EĞİTMENİ'}
              </Badge>
            </div>
          </div>
          <div className="flex gap-3">
            {role === 'admin' ? (
              <>
                <Button onClick={() => setLocation("/management")} variant="outline" className="rounded-2xl font-black gap-2 border-2">
                  <Settings className="h-4 w-4" /> Sistem Ayarları
                </Button>
                <Button onClick={() => setLocation("/teachers")} className="rounded-2xl font-black gap-2 shadow-xl shadow-primary/20">
                  <UserCheck className="h-4 w-4" /> Eğitmenleri Yönet
                </Button>
              </>
            ) : (
              <Button onClick={() => setLocation("/create-quiz")} className="rounded-2xl font-black gap-2 shadow-xl shadow-primary/20 h-12 px-8 text-lg transition-all active:scale-95">
                <FileText className="h-5 w-5" /> Yeni Sınav Oluştur
              </Button>
            )}
          </div>
        </div>

        {/* Dynamic Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-[2rem] border-2 border-border hover:border-blue-500 transition-all group overflow-hidden bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Toplam Sınav</CardTitle>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <FileText className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black tracking-tighter">{role === 'admin' ? adminStats?.totalQuizzes : stats?.totalQuizzes || 0}</div>
              <p className="text-[10px] font-bold text-blue-600 mt-1">Sistemdeki toplam materyal</p>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-2 border-border hover:border-emerald-500 transition-all group overflow-hidden bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                {role === 'admin' ? 'Toplam Öğrenci' : 'Aktif Öğrenci'}
              </CardTitle>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Users className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black tracking-tighter">{role === 'admin' ? adminStats?.totalStudents : stats?.totalStudents || 0}</div>
              <p className="text-[10px] font-bold text-emerald-600 mt-1">Sistemdeki kayıtlı öğrenciler</p>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-2 border-border hover:border-purple-500 transition-all group overflow-hidden bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Toplam Katılım</CardTitle>
              <div className="p-2 bg-purple-50 text-purple-600 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <CheckCircle className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black tracking-tighter">{role === 'admin' ? adminStats?.totalResults : stats?.totalResults || 0}</div>
              <p className="text-[10px] font-bold text-purple-600 mt-1">Tamamlanan sınav sayısı</p>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-2 border-border hover:border-orange-500 transition-all group overflow-hidden bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                {role === 'admin' ? 'Eğitmen Sayısı' : 'Başarı Oranı'}
              </CardTitle>
              <div className="p-2 bg-orange-50 text-orange-600 rounded-xl group-hover:bg-orange-600 group-hover:text-white transition-colors">
                {role === 'admin' ? <ShieldAlert className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black tracking-tighter">
                {role === 'admin' ? adminStats?.totalTeachers : (stats?.averageStudentScore || 0) + '%'}
              </div>
              <p className="text-[10px] font-bold text-orange-600 mt-1">
                {role === 'admin' ? 'Aktif yetkili eğitmenler' : 'Genel başarı ortalaması'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid gap-6 md:grid-cols-7">
          <Card className="col-span-4 rounded-[2.5rem] border-2 border-border shadow-md overflow-hidden bg-white">
            <CardHeader className="border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-black flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" /> Haftalık Aktivite Grafiği
                </CardTitle>
                <Badge variant="outline" className="font-bold">Son 7 Gün</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-8">
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.05} />
                    <XAxis 
                      dataKey="name" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false} 
                      fontFamily="Inter"
                      fontWeight={700}
                    />
                    <YAxis 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false}
                      fontFamily="Inter"
                      fontWeight={700}
                    />
                    <Tooltip 
                      cursor={{fill: 'rgba(0,0,0,0.02)'}}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar 
                      dataKey="count" 
                      name="Katılım" 
                      fill="hsl(var(--primary))" 
                      radius={[8, 8, 0, 0]} 
                      barSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-3 rounded-[2.5rem] border-2 border-border shadow-md overflow-hidden bg-white">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="text-lg font-black flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-indigo-600" /> Popüler Sınavlar
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-6">
                {recentQuizzes.map((item, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-bold truncate max-w-[180px] text-foreground">{item.title}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{item.participants} Katılım</span>
                        <span className="font-black text-primary bg-primary/5 px-2 py-0.5 rounded-lg">%{item.percentage}</span>
                      </div>
                    </div>
                    <div className="w-full h-3 bg-muted rounded-full overflow-hidden border">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full transition-all duration-1000"
                        style={{ width: `${item.percentage}%` }}
                      />                    </div>
                  </div>
                ))}
              </div>
              {role === 'admin' && (
                <Button variant="outline" onClick={() => setLocation("/admin-quizzes")} className="w-full mt-8 rounded-xl font-bold border-2 border-primary/20 hover:bg-primary/5">
                  Tüm Sınavları Görüntüle <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Admin Specific Activities or Logs */}
        <Card className="rounded-[2.5rem] border-2 border-border shadow-xl overflow-hidden bg-white">
          <CardHeader className="border-b bg-muted/20 pb-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl font-black flex items-center gap-2">
                <Clock className="h-6 w-6 text-orange-500" /> 
                {role === 'admin' ? 'Sistem Logları & Aktiviteler' : 'Son İşlemlerim'}
              </CardTitle>
              <CardDescription className="font-bold text-xs uppercase tracking-widest mt-1 opacity-70">Sistem üzerindeki en yeni 8 kayıt</CardDescription>
            </div>
            {role === 'admin' && (
              <Button variant="ghost" size="sm" onClick={() => setLocation("/results?tab=logs")} className="text-primary font-black uppercase text-xs tracking-widest hover:bg-primary/5">
                TÜMÜNÜ GÖR <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-x divide-y border-t">
              {recentLogs.map((log: any, i: number) => (
                <div key={i} className="p-6 hover:bg-slate-50 transition-colors group">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline" className="rounded-full h-2 w-2 p-0 bg-primary border-primary animate-pulse" />
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{new Date(log.createdAt).toLocaleTimeString('tr-TR')}</span>
                  </div>
                  <p className="text-sm font-black text-foreground group-hover:text-primary transition-colors line-clamp-1">{log.action}</p>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2 h-8 font-medium italic">"{log.details}"</p>
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-dashed">
                    <div className="h-6 w-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-black">
                      {log.user?.name?.[0]}
                    </div>
                    <span className="text-[11px] font-bold text-foreground">{log.user?.name || 'Sistem'}</span>
                    <Badge className="ml-auto text-[9px] font-black bg-slate-100 text-slate-600 hover:bg-slate-200">
                      {log.user?.role?.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              ))}
              {recentLogs.length === 0 && (
                <div className="col-span-full text-center py-20 text-muted-foreground italic font-bold">
                  Sistemde henüz kayıtlı bir aktivite bulunmuyor.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
