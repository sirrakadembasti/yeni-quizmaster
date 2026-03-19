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
  Cell
} from 'recharts';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Download, Trophy, Loader2, Search, Users, Activity, ClipboardList, Clock, GraduationCap, BarChart2 } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { quizApi, resultApi, classApi, categoryApi, adminApi } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

export default function StatisticsPage() {
  const { role, user } = useAuth();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [allResults, setAllResults] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("all");
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [tableSearch, setTableSearch] = useState("");
  const [logs, setLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "logs" && role === "admin") {
      setActiveTab("logs");
    } else if (tab === "reports" && role === "teacher") {
      setActiveTab("reports");
    }
    loadAllData();
  }, [role]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const promises: any[] = [
        quizApi.getAllQuizzes(),
        role === 'teacher' ? classApi.getTeacherClasses() : classApi.getAllClasses(),
        categoryApi.getAllCategories(),
        userApi.getAllUsers()
      ];

      if (role === "admin") {
        promises.push(adminApi.getLogs());
      }
      
      const [quizzesResp, classesResp, categoriesResp, usersResp, logsResp] = await Promise.all(promises);
      
      const loadedQuizzes = quizzesResp.quizzes || [];
      const loadedClasses = classesResp.classes || [];
      const loadedCategories = categoriesResp || [];
      const loadedUsers = usersResp?.users || [];
      const loadedLogs = logsResp?.logs || [];
      
      const loadedTeachers = loadedUsers.filter((u: any) => u.role === 'teacher');
      const loadedStudents = loadedUsers.filter((u: any) => u.role === 'student');

      const resultsPromises = loadedQuizzes.map((q: any) => 
        resultApi.getQuizResults(q.id)
          .then(r => (r.results || []).map((res: any) => ({ 
            ...res, 
            quizId: q.id, 
            quizTitle: q.title,
            createdBy: q.createdBy 
          })))
          .catch(() => [])
      );
      
      const resultsArrays = await Promise.all(resultsPromises);
      const combinedResults = resultsArrays.flat();

      setQuizzes(loadedQuizzes);
      setClasses(loadedClasses);
      setCategories(loadedCategories);
      setTeachers(loadedTeachers);
      setStudents(loadedStudents);
      setAllResults(combinedResults);
      setLogs(loadedLogs);
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

    if (selectedTeacherId !== "all") {
      filtered = filtered.filter(r => r.createdBy === selectedTeacherId);
    }

    if (selectedStudentId !== "all") {
      filtered = filtered.filter(r => r.studentId === selectedStudentId);
    }

    // Role specific restrictions
    if (role === 'teacher') {
      filtered = filtered.filter(r => r.createdBy === user?.id);
    }

    return filtered;
  }, [allResults, selectedClassId, selectedCategoryId, selectedTeacherId, selectedStudentId, quizzes, role, user]);

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
      link.setAttribute("download", `istatistikler_${new Date().toLocaleDateString('tr-TR')}.csv`);
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
            <h1 className="text-3xl font-black text-foreground tracking-tight">İstatistikler</h1>
            <p className="text-muted-foreground mt-1">Sınav performansları ve veri analizleri.</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="overview" className="gap-2">
              <Activity className="h-4 w-4" /> Genel Bakış
            </TabsTrigger>
            {role === "admin" ? (
              <TabsTrigger value="logs" className="gap-2">
                <ClipboardList className="h-4 w-4" /> Sistem Aktiviteleri
              </TabsTrigger>
            ) : (
              <TabsTrigger value="reports" className="gap-2">
                <BarChart2 className="h-4 w-4" /> Öğrenci Raporları
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            <div className="flex flex-col md:flex-row gap-4 items-end justify-between bg-card p-4 rounded-xl border shadow-sm">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Sınıf</Label>
                  <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Sınıf Seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tüm Sınıflar</SelectItem>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Ders</Label>
                  <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Ders Seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tüm Dersler</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {role === 'admin' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Öğretmen</Label>
                    <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Öğretmen Seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tüm Öğretmenler</SelectItem>
                        {teachers.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Öğrenci</Label>
                  <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Öğrenci Seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tüm Öğrenciler</SelectItem>
                      {students
                        .filter(s => selectedClassId === 'all' || s.classId === selectedClassId)
                        .map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleExport} variant="outline" className="gap-2 font-bold">
                <Download className="h-4 w-4" /> Dışa Aktar
              </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card className="border-primary/10 shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-500" /> Başarı Dağılımı
                  </CardTitle>
                  <CardDescription>MEB standartlarına göre sınıf genel tablosu</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={mebStats}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} />
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

              <Card className="border-primary/10 shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg font-bold">Sınav Ortalamaları</CardTitle>
                  <CardDescription>Sınav bazlı genel başarı grafiği</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={quizTableData.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                        <XAxis dataKey="title" fontSize={10} tickLine={false} axisLine={false} interval={0} height={50} />
                        <YAxis fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                        <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} />
                        <Bar dataKey="avgScore" name="Ortalama Puan" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-primary/10 shadow-md overflow-hidden">
              <CardHeader className="bg-muted/30 border-b">
                <div className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-xl font-black">Sınav Listesi</CardTitle>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Sınav ara..." 
                      className="pl-9 h-9"
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
                      <TableHead className="text-center font-bold">Katılımcı</TableHead>
                      <TableHead className="text-right py-4 px-6 font-bold">Ortalama</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quizTableData.map((q) => (
                      <TableRow key={q.id} className="hover:bg-primary/5 transition-colors">
                        <TableCell className="font-bold py-4 px-6">{q.title}</TableCell>
                        <TableCell><Badge variant="secondary">{q.category}</Badge></TableCell>
                        <TableCell className="text-center font-bold">{q.participants}</TableCell>
                        <TableCell className="text-right py-4 px-6 font-black text-primary">{q.avgScore}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ADMIN LOGS TAB */}
          {role === "admin" && (
            <TabsContent value="logs" className="space-y-6">
              <Card className="border-primary/10 shadow-md overflow-hidden">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-black">Sistem Aktiviteleri</CardTitle>
                      <CardDescription>Sistemdeki tüm kayıtların dökümü</CardDescription>
                    </div>
                    <Badge variant="outline" className="gap-1.5 py-1 px-3">
                      <Clock className="h-3.5 w-3.5" /> Toplam {logs.length} Kayıt
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="font-bold py-4 px-6">Tarih</TableHead>
                        <TableHead className="font-bold">Kullanıcı</TableHead>
                        <TableHead className="font-bold">İşlem</TableHead>
                        <TableHead className="font-bold">Detay</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log, i) => (
                        <TableRow key={i}>
                          <TableCell className="py-4 px-6 text-xs">{format(new Date(log.createdAt), "dd MMM yyyy, HH:mm", { locale: tr })}</TableCell>
                          <TableCell className="font-bold text-sm">{log.user?.name || 'Sistem'}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px] font-bold">{log.action}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{log.details}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* TEACHER REPORTS TAB - Yeni eklenen öğrenci bazlı rapor alanı */}
          {role === "teacher" && (
            <TabsContent value="reports" className="space-y-6">
              <Card className="border-primary/10 shadow-md overflow-hidden">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-black">Öğrenci Sınav Dökümleri</CardTitle>
                      <CardDescription>Öğrencilerin sınavlarındaki detaylı performans dökümleri.</CardDescription>
                    </div>
                    <Badge variant="outline" className="gap-1.5 py-1 px-3">
                      <GraduationCap className="h-3.5 w-3.5" /> {filteredResults.length} Sonuç
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="font-bold py-4 px-6">Öğrenci</TableHead>
                        <TableHead className="font-bold">Sınav Adı</TableHead>
                        <TableHead className="text-center font-bold">Doğru/Toplam</TableHead>
                        <TableHead className="text-right py-4 px-6 font-bold">Puan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredResults.filter(r => r.createdBy === user?.id).length > 0 ? (
                        filteredResults.filter(r => r.createdBy === user?.id).map((res, i) => (
                          <TableRow key={i} className="hover:bg-muted/30">
                            <TableCell className="py-4 px-6 font-bold">{res.student?.name || 'Bilinmeyen'}</TableCell>
                            <TableCell className="text-sm">{res.quizTitle || 'Sınav'}</TableCell>
                            <TableCell className="text-center font-medium">
                              {res.correctAnswers} / {res.totalQuestions}
                            </TableCell>
                            <TableCell className="text-right py-4 px-6">
                              <Badge className={res.score >= 70 ? "bg-emerald-500" : res.score >= 45 ? "bg-amber-500" : "bg-rose-500"}>
                                {res.score}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground">Henüz bir sınav sonucu bulunmuyor.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function Label({ children, className }: { children: React.ReactNode, className?: string }) {
  return <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}>{children}</label>;
}
