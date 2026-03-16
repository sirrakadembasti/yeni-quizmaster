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
  Settings,
  BookOpen
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useLocation } from "wouter";
import { useAuth } from "@/context/auth-context";
import { dashboardApi, quizApi, userApi, resultApi, classApi } from "@/lib/api";
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

  const stats = statsData?.stats;
  const isLoading = statsLoading || quizzesLoading || usersLoading || resultsLoading;

  const { chartData, recentQuizzes } = useMemo(() => {
    if (!resultsData || !quizzesData?.quizzes || !usersData?.users) {
      return { chartData: [], recentQuizzes: [] };
    }

    const totalStudentsCount = usersData.users.filter((u: any) => u.role === 'student').length;

    // Chart Data: Last 7 days participation
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

    // Recent Quizzes with participation percentage
    const recent = quizzesData.quizzes
      .slice(0, 5)
      .map((q: any) => {
        const participants = resultsData.filter((r: any) => r.quizId === q.id).length;
        const percentage = totalStudentsCount > 0 
          ? Math.round((participants / totalStudentsCount) * 100) 
          : 0;
        
        return {
          title: q.title,
          participants,
          percentage
        };
      });

    return { chartData: chart, recentQuizzes: recent };
  }, [resultsData, quizzesData, usersData]);

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
              Hoş Geldin, <span className="text-primary">{user?.name || 'Öğretmen'}</span> 👋
            </h1>
            <div className="flex gap-2 mt-2 flex-wrap">
              <Badge variant="outline" className="text-xs font-bold bg-primary/5 text-primary border-primary/20">
                {role === 'admin' ? 'Yönetici' : 'Öğretmen'}
              </Badge>
              {role === 'teacher' && user?.assignedCategories?.map((cat: any) => (
                <Badge key={cat.id} variant="secondary" className="text-xs font-medium bg-blue-50 text-blue-700 border-blue-200">
                  Ders: {cat.name}
                </Badge>
              ))}
              {role === 'teacher' && classesData?.classes?.map((cls: any) => (
                <Badge key={cls.id} variant="secondary" className="text-xs font-medium bg-emerald-50 text-emerald-700 border-emerald-200">
                  Sınıf: {cls.name}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            {role === "teacher" && (
              <Button
                onClick={() => setLocation("/create-quiz")}
                className="gap-2 font-bold shadow-lg shadow-primary/20"
              >
                <FileText className="h-4 w-4" />
                Yeni Sınav Oluştur
              </Button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-primary/10 shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold">Toplam Sınav</CardTitle>
              <FileText className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black">{stats?.totalQuizzes || 0}</div>
              <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-bold">Hazırlanan Sınavlar</p>
            </CardContent>
          </Card>
          <Card className="border-primary/10 shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold">Aktif Öğrenci</CardTitle>
              <Users className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black">{stats?.totalStudents || 0}</div>
              <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-bold">Sınıf Toplamı</p>
            </CardContent>
          </Card>
          <Card className="border-primary/10 shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold">Toplam Katılım</CardTitle>
              <CheckCircle className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black">{stats?.totalResults || 0}</div>
              <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-bold">Çözülen Sınavlar</p>
            </CardContent>
          </Card>
          <Card className="border-primary/10 shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold">Başarı Oranı</CardTitle>
              <TrendingUp className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black">{stats?.averageStudentScore || 0}%</div>
              <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-bold">Genel Ortalama</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4 border-primary/10 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Haftalık Katılım Özeti</CardTitle>
              <CardDescription>Son 7 gündeki sınav katılım sayıları</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      cursor={{fill: 'rgba(0,0,0,0.05)'}}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="count" name="Katılımcı" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={35} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-3 border-primary/10 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Son Sınav Aktiviteleri</CardTitle>
              <CardDescription>Sınavların öğrenci katılım oranları</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                {recentQuizzes.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Henüz sınav bulunmuyor.</p>
                ) : (
                  recentQuizzes.map((item, i) => (
                    <div key={i} className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black truncate max-w-[200px]">{item.title}</span>
                        <Badge variant="outline" className="font-mono text-[10px] font-black border-primary/20 text-primary">
                          %{item.percentage} Katılım
                        </Badge>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden border border-border/50">
                        <div 
                          className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-1000 ease-out" 
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">
                        <span>{item.participants} ÖĞRENCİ ÇÖZDÜ</span>
                        <span>HEDEF %100</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
