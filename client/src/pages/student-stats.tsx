import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import { 
  Trophy, 
  TrendingUp, 
  Clock, 
  BookOpen,
  Download,
  BarChart2
} from "lucide-react";
import { resultApi } from "@/lib/api";

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function StudentStats() {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);
        const data = await resultApi.getStudentResults();
        setResults(data.results || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Veriler yüklenemedi");
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, []);

  // Calculate statistics
  const completedResults = results.filter(r => r.status === 'completed');
  const totalQuizzes = completedResults.length;
  const averageScore = totalQuizzes > 0
    ? Math.round(completedResults.reduce((sum, r) => sum + (r.score || 0), 0) / totalQuizzes)
    : 0;
  const totalTime = completedResults.reduce((sum, r) => sum + (r.timeTaken || 0), 0);
  const passCount = completedResults.filter(r => (r.score || 0) >= 70).length;
  const passRate = totalQuizzes > 0 ? Math.round((passCount / totalQuizzes) * 100) : 0;

  // Prepare Quiz Based Data
  const quizBasedData = completedResults
    .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())
    .slice(-10)
    .map((r, i) => ({
      name: r.quizTitle || r.quiz?.title || `Quiz ${i + 1}`,
      score: r.score || 0,
      lesson: r.quiz?.category || 'Genel'
    }));

  // Prepare Lesson Based Data (Averages per category)
  const lessonStats: Record<string, { totalScore: number; count: number }> = {};
  completedResults.forEach(r => {
    const lesson = r.quiz?.category || 'Genel';
    if (!lessonStats[lesson]) {
      lessonStats[lesson] = { totalScore: 0, count: 0 };
    }
    lessonStats[lesson].totalScore += (r.score || 0);
    lessonStats[lesson].count += 1;
  });

  const lessonBasedData = Object.entries(lessonStats).map(([lesson, stats]) => ({
    name: lesson,
    averageScore: Math.round(stats.totalScore / stats.count)
  }));

  const exportToExcel = () => {
    // Create CSV content with BOM for UTF-8 Excel support
    let csv = '\uFEFF';
    csv += 'Quiz İstatistikleri\n\n';
    csv += 'Genel İstatistikler\n';
    csv += `Toplam Quiz,${totalQuizzes}\n`;
    csv += `Ortalama Puan,${averageScore}%\n`;
    csv += `Geçme Oranı,${passRate}%\n`;
    csv += `Toplam Süre,${Math.round(totalTime / 60)} dakika\n\n`;
    
    csv += 'Quiz Sonuçları\n';
    csv += 'Quiz Adı,Ders Adı,Skor,Durum,Tarih\n';
    completedResults.forEach(r => {
      const quizName = `"${(r.quizTitle || r.quiz?.title || r.quizId).replace(/"/g, '""')}"`;
      const lessonName = `"${(r.quiz?.category || 'Genel').replace(/"/g, '""')}"`;
      csv += `${quizName},${lessonName},${r.score}%,${r.status},${new Date(r.submittedAt).toLocaleDateString('tr-TR')}\n`;
    });

    // Download as CSV
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `istatistikler_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    window.print();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground animate-pulse">İstatistikler yükleniyor...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-10" id="stats-content">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground flex items-center gap-2">
              <BarChart2 className="w-8 h-8 text-primary" />
              İstatistikler
            </h1>
            <p className="text-muted-foreground mt-2">Quiz performansınızın detaylı analizi</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              onClick={exportToExcel}
              className="gap-2 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/20"
            >
              <Download className="h-4 w-4" />
              CSV İndir
            </Button>
            <Button 
              variant="outline" 
              onClick={exportToPDF}
              className="gap-2 border-red-200 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20 print:hidden"
            >
              <Download className="h-4 w-4" />
              PDF İndir
            </Button>
          </div>
        </div>

        {error && (
          <Card className="border-destructive/50 bg-destructive/10">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-card shadow-sm dark:shadow-none hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tamamlanan Quiz</CardTitle>
              <BookOpen className="h-5 w-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalQuizzes}</div>
              <p className="text-xs text-muted-foreground mt-1">toplam katılım</p>
            </CardContent>
          </Card>

          <Card className="bg-card shadow-sm dark:shadow-none hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ortalama Puan</CardTitle>
              <Trophy className="h-5 w-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{averageScore}%</div>
              <p className="text-xs text-muted-foreground mt-1">genel başarı ortalaması</p>
            </CardContent>
          </Card>

          <Card className="bg-card shadow-sm dark:shadow-none hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Geçme Oranı</CardTitle>
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{passRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">{passCount} başarılı sonuç</p>
            </CardContent>
          </Card>

          <Card className="bg-card shadow-sm dark:shadow-none hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Toplam Süre</CardTitle>
              <Clock className="h-5 w-5 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{Math.round(totalTime / 60)}</div>
              <p className="text-xs text-muted-foreground mt-1">harcanan dakika</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Quiz Based Bar Chart */}
          <Card className="col-span-1 shadow-sm dark:shadow-none">
            <CardHeader>
              <CardTitle>Quiz Bazlı Başarı</CardTitle>
              <CardDescription>Son katıldığınız quizlerin puanları</CardDescription>
            </CardHeader>
            <CardContent>
              {quizBasedData.length > 0 ? (
                <div style={{ width: '100%', height: 350 }}>
                  <ResponsiveContainer>
                    <BarChart data={quizBasedData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="name" 
                        fontSize={12} 
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis 
                        domain={[0, 100]} 
                        fontSize={12} 
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '8px',
                          color: 'hsl(var(--foreground))'
                        }}
                        itemStyle={{ color: 'hsl(var(--primary))' }}
                      />
                      <Bar 
                        dataKey="score" 
                        name="Puan" 
                        fill="hsl(var(--primary))" 
                        radius={[4, 4, 0, 0]} 
                        maxBarSize={50}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[350px] flex items-center justify-center text-muted-foreground border border-dashed rounded-lg">
                  Henüz grafik için yeterli veri yok
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lesson Based Bar Chart */}
          <Card className="col-span-1 shadow-sm dark:shadow-none">
            <CardHeader>
              <CardTitle>Ders Bazlı Ortalama Başarı</CardTitle>
              <CardDescription>Derslere göre ortalama performansınız</CardDescription>
            </CardHeader>
            <CardContent>
              {lessonBasedData.length > 0 ? (
                <div style={{ width: '100%', height: 350 }}>
                  <ResponsiveContainer>
                    <BarChart data={lessonBasedData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="name" 
                        fontSize={12} 
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis 
                        domain={[0, 100]} 
                        fontSize={12} 
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '8px',
                          color: 'hsl(var(--foreground))'
                        }}
                        itemStyle={{ color: 'hsl(var(--chart-2))' }}
                      />
                      <Bar 
                        dataKey="averageScore" 
                        name="Ortalama Puan" 
                        fill="hsl(var(--chart-2))" 
                        radius={[4, 4, 0, 0]} 
                        maxBarSize={50}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[350px] flex items-center justify-center text-muted-foreground border border-dashed rounded-lg">
                  Henüz grafik için yeterli veri yok
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Results Table */}
        {completedResults.length > 0 ? (
          <Card className="shadow-sm dark:shadow-none">
            <CardHeader>
              <CardTitle>Son Quiz Sonuçları</CardTitle>
              <CardDescription>En son tamamladığınız {Math.min(completedResults.length, 10)} quiz ve detayları</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="py-3 px-4 font-medium">Quiz Adı</th>
                      <th className="py-3 px-4 font-medium">Ders Adı</th>
                      <th className="py-3 px-4 font-medium text-center">Puan</th>
                      <th className="py-3 px-4 font-medium">Durum</th>
                      <th className="py-3 px-4 font-medium">Tarih</th>
                      <th className="py-3 px-4 font-medium text-right">Süre</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {completedResults.slice(-10).reverse().map((result, idx) => (
                      <tr key={idx} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-medium text-foreground">
                          {result.quizTitle || result.quiz?.title || result.quizId.substring(0, 8)}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="bg-background">
                            {result.quiz?.category || 'Genel'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center justify-center font-bold px-2 py-1 rounded-md ${(result.score || 0) >= 70 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                            {result.score}%
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <div className={`w-1.5 h-1.5 rounded-full ${result.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                            {result.status === 'completed' ? 'Tamamlandı' : 'Devam Ediyor'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {new Date(result.submittedAt).toLocaleDateString('tr-TR')}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-right">
                          {Math.round((result.timeTaken || 0) / 60)} dk
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed bg-muted/10">
            <CardContent className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <BookOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-medium mb-2">Henüz Veri Yok</h3>
              <p className="text-muted-foreground max-w-md">
                İstatistiklerinizin burada görünmesi için önce birkaç quizi tamamlamanız gerekiyor.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
