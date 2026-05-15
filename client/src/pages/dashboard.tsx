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
  Settings,
  BookOpen,
  GraduationCap,
  Activity,
  ChevronRight,
  PlusCircle,
  RefreshCw,
  Trash2,
  ShieldCheck
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLocation } from "wouter";
import { useAuth } from "@/context/auth-context";
import { dashboardApi, quizApi, userApi, resultApi, classApi, adminApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

function formatDayLabel(date: Date) {
  return date.toLocaleDateString('tr-TR', { weekday: 'short' });
}

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';
  const isTeacher = role === 'teacher';
  const isStudent = role === 'student';

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats', role],
    queryFn: () => role === 'teacher' ? dashboardApi.getTeacherStats() : dashboardApi.getAdminStats(),
    enabled: !!user && !isStudent,
  });

  const { data: quizzesData, isLoading: quizzesLoading } = useQuery({
    queryKey: ['quizzes'],
    queryFn: () => quizApi.getAllQuizzes(),
    enabled: !isStudent,
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.getAllUsers(),
    enabled: isAdmin,
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
    enabled: !!quizzesData?.quizzes && !isStudent,
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['dashboard-logs', user?.id],
    queryFn: () => isAdmin ? adminApi.getLogs({ limit: 5 }) : adminApi.getLogsMe(),
    enabled: !!user,
  });

  // Teacher: fetch classes assigned to this teacher
  const { data: teacherClassesData } = useQuery({
    queryKey: ['teacher-classes'],
    queryFn: () => classApi.getTeacherClasses(),
    enabled: role === 'teacher',
  });

  const stats = statsData?.stats;
  const isLoading = statsLoading || (isAdmin && (quizzesLoading || usersLoading || resultsLoading)) || (isTeacher && (quizzesLoading || resultsLoading)) || logsLoading;

  const { chartData, recentQuizzes, adminStats } = useMemo(() => {
    if (isStudent || !resultsData || !quizzesData?.quizzes) {
      return { chartData: [], recentQuizzes: [], adminStats: null };
    }

    const totalStudentsCount = usersData?.users?.filter((u: any) => u.role === 'student').length || 0;
    const totalTeachersCount = usersData?.users?.filter((u: any) => u.role === 'teacher').length || 0;

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

    return { 
      chartData: chart, 
      recentQuizzes: recent,
      adminStats: isAdmin ? {
        totalStudents: totalStudentsCount,
        totalTeachers: totalTeachersCount,
        totalQuizzes: quizzesData.quizzes.length,
        totalResults: resultsData.length
      } : null
    };
  }, [resultsData, quizzesData, usersData, isAdmin, isStudent]);

  const logs = (logsData?.logs || []).slice(0, 5);

  const getLogIcon = (action: string) => {
    if (action.includes('CREATE')) return <PlusCircle className="h-4 w-4 text-emerald-500" />;
    if (action.includes('UPDATE')) return <RefreshCw className="h-4 w-4 text-blue-500" />;
    if (action.includes('DELETE')) return <Trash2 className="h-4 w-4 text-rose-500" />;
    if (action.includes('LOGIN')) return <ShieldCheck className="h-4 w-4 text-indigo-500" />;
    return <Activity className="h-4 w-4 text-slate-400" />;
  };

  const getLogLink = () => {
    if (isAdmin) return "/management?tab=logs";
    if (isTeacher || isStudent) return "/settings?tab=logs";
    return "#";
  };

  if (isLoading && !isStudent) {
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
      <div className="space-y-8 animate-in fade-in duration-700">
        {/* Modern Header */}
        <div className="flex flex-col gap-6 bg-gradient-to-r from-primary/10 via-transparent to-transparent p-6 rounded-3xl border border-primary/10">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-black text-foreground tracking-tighter">
                {isAdmin ? 'Yönetim Paneli' : isTeacher ? 'Eğitmen Paneli' : 'Öğrenci Paneli'}
              </h1>
              <div className="flex items-center gap-3 mt-3">
                <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-lg shadow-slate-200">
                  {user?.name?.[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground leading-none">{user?.name}</p>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">{user?.email}</p>
                </div>
                <Badge variant={isAdmin ? "destructive" : "default"} className="ml-2 px-3 py-0.5 rounded-full text-[10px] uppercase font-black tracking-widest">
                  {isAdmin ? 'SİSTEM ADMİN' : isTeacher ? 'BRANŞ EĞİTMENİ' : 'ÖĞRENCİ'}
                </Badge>
              </div>
            </div>
            <div className="flex gap-3 shrink-0 print:hidden">
              <Button 
                variant="outline" 
                onClick={() => window.print()}
                className="rounded-2xl font-black gap-2 border-2 hover:bg-slate-50 transition-all active:scale-95"
              >
                <Printer className="h-4 w-4" /> Yazdır
              </Button>
              {isAdmin ? (
                <>
                  <Button onClick={() => setLocation("/management")} variant="outline" className="rounded-2xl font-black gap-2 border-2">
                    <Settings className="h-4 w-4" /> Sistem Ayarları
                  </Button>
                  <Button onClick={() => setLocation("/teachers")} className="rounded-2xl font-black gap-2 shadow-xl shadow-primary/20">
                    <UserCheck className="h-4 w-4" /> Eğitmenleri Yönet
                  </Button>
                </>
              ) : isTeacher ? (
                <Button onClick={() => setLocation("/create-quiz")} className="rounded-2xl font-black gap-2 shadow-xl shadow-primary/20 h-12 px-8 text-lg transition-all active:scale-95">
                  <FileText className="h-5 w-5" /> Yeni Sınav Oluştur
                </Button>
              ) : (
                <Button onClick={() => setLocation("/quizzes")} className="rounded-2xl font-black gap-2 shadow-xl shadow-primary/20 h-12 px-8 text-lg transition-all active:scale-95">
                  <BookOpen className="h-5 w-5" /> Sınavlara Göz At
                </Button>
              )}
            </div>
          </div>

          {isTeacher && (
            <div className="grid gap-4 sm:grid-cols-2 border-t border-primary/10 pt-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-2">
                  <BookOpen className="h-3.5 w-3.5 text-indigo-500" /> Branşlarım
                </p>
                <div className="flex flex-wrap gap-2">
                  {user?.assignedCategories && user.assignedCategories.length > 0 ? (
                    user.assignedCategories.map((cat) => (
                      <Badge key={cat.id} className="rounded-full px-3 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold text-xs">
                        {cat.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Branş atanmamış</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-2">
                  <GraduationCap className="h-3.5 w-3.5 text-emerald-500" /> Sorumlu Sınıflarım
                </p>
                <div className="flex flex-wrap gap-2">
                  {teacherClassesData?.classes && teacherClassesData.classes.length > 0 ? (
                    teacherClassesData.classes.map((cls) => (
                      <button
                        key={cls.id}
                        onClick={() => setLocation(`/classes/${cls.id}`)}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-xs hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
                      >
                        <Users className="h-3 w-3" />
                        {cls.name}
                        {cls._count && (
                          <span className="bg-emerald-100 dark:bg-emerald-900 px-1.5 py-0.5 rounded-full text-[10px] font-black">
                            {cls._count.students}
                          </span>
                        )}
                      </button>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Sınıf atanmamış</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Stats Grid */}
        {!isStudent && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <StatCard 
              title="Toplam Sınav" 
              value={isAdmin ? adminStats?.totalQuizzes : stats?.totalQuizzes} 
              loading={statsLoading}
              icon={<FileText className="h-6 w-6 text-indigo-600" />}
              color="bg-indigo-50"
              description="Sistemdeki toplam materyal"
            />
            <StatCard 
              title={isAdmin ? "Toplam Öğrenci" : "Aktif Öğrenci"} 
              value={isAdmin ? adminStats?.totalStudents : stats?.totalStudents} 
              loading={statsLoading}
              icon={<Users className="h-6 w-6 text-emerald-600" />}
              color="bg-emerald-50"
              description="Sistemdeki kayıtlı öğrenciler"
            />
            <StatCard 
              title="Toplam Katılım" 
              value={isAdmin ? adminStats?.totalResults : stats?.totalResults} 
              loading={statsLoading}
              icon={<CheckCircle className="h-6 w-6 text-purple-600" />}
              color="bg-purple-50"
              description="Tamamlanan sınav sayısı"
            />
            <StatCard 
              title={isAdmin ? "Eğitmen Sayısı" : "Başarı Oranı"} 
              value={isAdmin ? adminStats?.totalTeachers : `${stats?.averageStudentScore || 0}%`} 
              loading={statsLoading}
              icon={isAdmin ? <ShieldAlert className="h-6 w-6 text-orange-600" /> : <TrendingUp className="h-6 w-6 text-rose-600" />}
              color={isAdmin ? "bg-orange-50" : "bg-rose-50"}
              description={isAdmin ? "Aktif yetkili eğitmenler" : "Genel başarı ortalaması"}
            />
          </div>
        )}

        {/* Charts & Popular Section */}
        {!isStudent && (
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
                      <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} fontWeight={700} />
                      <YAxis fontSize={11} tickLine={false} axisLine={false} fontWeight={700} />
                      <Tooltip 
                        cursor={{fill: 'rgba(0,0,0,0.02)'}}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="count" name="Katılım" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} barSize={40} />
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
                        <div className="h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${item.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                {isAdmin && (
                  <Button variant="outline" onClick={() => setLocation("/admin-quizzes")} className="w-full mt-8 rounded-xl font-bold border-2 border-primary/20 hover:bg-primary/5">
                    Tüm Sınavları Görüntüle <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Refactored Logs Section */}
        <div className="lg:col-span-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-slate-50 uppercase tracking-tight">
                  {isAdmin ? "Sistem Logları & Aktiviteler" : "Son İşlemlerim"}
                </h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Son 5 Hareket</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              onClick={() => setLocation(getLogLink())}
              className="text-indigo-600 hover:text-indigo-700 font-bold gap-2 rounded-xl group"
            >
              Tümünü Gör <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          <div className="space-y-3">
            {logsLoading ? (
              Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)
            ) : logs.length > 0 ? (
              logs.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 hover:border-indigo-200 hover:shadow-md transition-all group">
                  <div className="flex items-center gap-5">
                    <div className="h-12 w-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform">
                      {getLogIcon(log.action)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 dark:text-slate-50 tracking-tight">{log.action}</span>
                        {isAdmin && log.user && (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-slate-500">
                            {log.user.name}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-slate-500 line-clamp-1">{log.details || 'Açıklama belirtilmemiş.'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-black text-slate-900 dark:text-slate-50">{format(new Date(log.createdAt), "HH:mm")}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">{format(new Date(log.createdAt), "dd MMM yyyy", { locale: tr })}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center bg-slate-50 dark:bg-slate-900/50 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                <Activity className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-400 font-bold italic">Henüz bir aktivite kaydı bulunmuyor.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ title, value, loading, icon, color, description }: any) {
  return (
    <Card className="rounded-[2rem] border-2 border-border hover:border-primary transition-all group overflow-hidden bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">{title}</CardTitle>
        <div className={`p-2 ${color} rounded-xl group-hover:bg-primary group-hover:text-white transition-colors`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-10 w-24" />
        ) : (
          <div className="text-4xl font-black tracking-tighter">{value || 0}</div>
        )}
        <p className="text-[10px] font-bold text-primary mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}
