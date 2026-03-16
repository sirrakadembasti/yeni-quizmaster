import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  Legend
} from 'recharts';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Download, Trophy, Loader2, Search, Users } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { quizApi, resultApi, classApi, categoryApi } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

export default function ResultsPage() {
  const { role } = useAuth();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [allResults, setAllResults] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [tableSearch, setTableSearch] = useState("");

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [quizzesResp, classesResp, categoriesResp] = await Promise.all([
        quizApi.getAllQuizzes(),
        role === 'teacher' ? classApi.getTeacherClasses() : classApi.getAllClasses(),
        categoryApi.getAllCategories()
      ]);
      
      const loadedQuizzes = quizzesResp.quizzes || [];
      const loadedClasses = classesResp.classes || [];
      const loadedCategories = categoriesResp || [];
      
      const resultsPromises = loadedQuizzes.map(q => 
        resultApi.getQuizResults(q.id)
          .then(r => (r.results || []).map((res: any) => ({ ...res, quizId: q.id, quizTitle: q.title })))
          .catch(() => [])
      );
      
      const resultsArrays = await Promise.all(resultsPromises);
      const combinedResults = resultsArrays.flat();

      setQuizzes(loadedQuizzes);
      setClasses(loadedClasses);
      setCategories(loadedCategories);
      setAllResults(combinedResults);
      setLoading(false);
    } catch (error) {
      console.error("Failed to load data:", error);
      setLoading(false);
    }
  };

  const filteredResults = useMemo(() => {
    let filtered = allResults;
    if (selectedClassId !== "all") {
      filtered = filtered.filter(r => r.student?.classId === selectedClassId);
    }
    if (selectedCategoryId !== "all") {
      filtered = filtered.filter(r => {
        const quiz = quizzes.find(q => q.id === r.quizId);
        return quiz && quiz.categoryId === selectedCategoryId;
      });
    }
    return filtered;
  }, [allResults, selectedClassId, selectedCategoryId, quizzes]);

  const mebStats = useMemo(() => {
    const grades = {
      pekiyi: { name: 'Pekiyi', value: 0, color: '#10b981' },
      iyi: { name: 'İyi', value: 0, color: '#3b82f6' },
      orta: { name: 'Orta', value: 0, color: '#f59e0b' },
      gecer: { name: 'Geçer', value: 0, color: '#6366f1' },
      gecmez: { name: 'Geçmez', value: 0, color: '#ef4444' }
    };

    filteredResults.forEach(r => {
      const score = r.score || 0;
      if (score >= 85) grades.pekiyi.value++;
      else if (score >= 70) grades.iyi.value++;
      else if (score >= 55) grades.orta.value++;
      else if (score >= 45) grades.gecer.value++;
      else grades.gecmez.value++;
    });

    return Object.values(grades);
  }, [filteredResults]);

  const quizTableData = useMemo(() => {
    let activeQuizzes = quizzes;
    if (selectedCategoryId !== "all") {
      activeQuizzes = activeQuizzes.filter(q => q.categoryId === selectedCategoryId);
    }

    const data = activeQuizzes.map(q => {
      const resultsForQuiz = filteredResults.filter(r => r.quizId === q.id);
      const totalParticipants = resultsForQuiz.length;
      const avgScore = totalParticipants > 0 
        ? Math.round(resultsForQuiz.reduce((sum, r) => sum + (r.score || 0), 0) / totalParticipants)
        : 0;
      
      const categoryName = categories.find(c => c.id === q.categoryId)?.name || 'Genel';
      
      return {
        id: q.id,
        title: q.title,
        category: categoryName,
        participants: totalParticipants,
        avgScore
      };
    });

    return data.filter(q => 
      q.participants > 0 &&
      (q.title.toLowerCase().includes(tableSearch.toLowerCase()) || 
      q.category.toLowerCase().includes(tableSearch.toLowerCase()))
    ).sort((a, b) => b.participants - a.participants);
  }, [quizzes, filteredResults, tableSearch, selectedCategoryId, categories]);

  const handleExport = () => {
    try {
      const headers = ['Sınav Adı', 'Ders', 'Katılımcı Sayısı', 'Ortalama Puan'];
      const rows = quizTableData.map(q => [
        `"${q.title.replace(/"/g, '""')}"`,
        `"${q.category}"`,
        q.participants,
        q.avgScore
      ]);

      const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(";")).join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `sinav_istatistikleri_${new Date().toLocaleDateString('tr-TR')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Export failed", e);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-foreground tracking-tight">Sınav Analiz Merkezi</h1>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger className="w-[180px] bg-background border-primary/20">
                <SelectValue placeholder="Sınıf Seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Sınıflar</SelectItem>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
              <SelectTrigger className="w-[180px] bg-background border-primary/20">
                <SelectValue placeholder="Ders Seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Dersler</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleExport} className="gap-2 font-bold shadow-lg shadow-primary/20">
              <Download className="h-4 w-4" />
              Dışa Aktar (CSV)
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* MEB Distribution Chart */}
          <Card className="border-primary/10 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                Öğrenci Başarı Dağılımı
              </CardTitle>
              <CardDescription>MEB standartlarına göre sınıf genel tablosu</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mebStats} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      cursor={{fill: 'rgba(0,0,0,0.05)'}}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="value" name="Öğrenci Sayısı" radius={[6, 6, 0, 0]}>
                      {mebStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Average Scores Chart */}
          <Card className="border-primary/10 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Sınav Puan Ortalamaları</CardTitle>
              <CardDescription>Sınav bazlı genel başarı grafiği</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={quizTableData.slice(0, 10)} margin={{ top: 20, right: 30, left: 0, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                    <XAxis 
                      dataKey="title" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip 
                      cursor={{fill: 'rgba(0,0,0,0.05)'}}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="avgScore" name="Ortalama Puan" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Table List */}
        <Card className="border-primary/10 shadow-md overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-black">Sınav İstatistikleri Listesi</CardTitle>
                <CardDescription>Tüm sınavların katılım ve başarı dökümü</CardDescription>
              </div>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Sınav veya Ders ara..." 
                  className="pl-9 bg-background"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="font-bold py-4 px-6">Sınav Adı</TableHead>
                  <TableHead className="font-bold">Ders</TableHead>
                  <TableHead className="text-center font-bold">Katılımcı Sayısı</TableHead>
                  <TableHead className="text-right py-4 px-6 font-bold">Ortalama Puan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quizTableData.length > 0 ? (
                  quizTableData.map((q) => (
                    <TableRow key={q.id} className="hover:bg-primary/5 transition-colors group">
                      <TableCell className="font-bold py-4 px-6 group-hover:text-primary transition-colors">
                        {q.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-medium bg-muted/50">{q.category}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5 font-bold">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          {q.participants}
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-4 px-6">
                        <div className={`inline-flex items-center justify-center h-9 w-12 rounded-lg font-black text-sm border-2 ${
                          q.avgScore >= 85 ? 'text-emerald-600 border-emerald-100 bg-emerald-50' :
                          q.avgScore >= 70 ? 'text-blue-600 border-blue-100 bg-blue-50' :
                          q.avgScore >= 45 ? 'text-amber-600 border-amber-100 bg-amber-50' :
                          'text-rose-600 border-rose-100 bg-rose-50'
                        }`}>
                          {q.avgScore}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic">
                      Arama kriterlerine uygun sınav bulunamadı.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
