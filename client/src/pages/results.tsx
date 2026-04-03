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
import { Label } from "@/components/ui/label";
import { 
  Download, 
  Trophy, 
  Loader2, 
  Search, 
  Activity, 
  Clock, 
  GraduationCap, 
  BarChart2,
  AlertCircle
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { quizApi, resultApi, classApi, categoryApi, userApi } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

export default function StatisticsPage() {
  const { role, user: currentUser } = useAuth();
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
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "reports" && role === "teacher") {
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
      
      const [quizzesResp, classesResp, categoriesResp, usersResp] = await Promise.all(promises);
      
      const loadedQuizzes = quizzesResp.quizzes || [];
      const loadedClasses = classesResp.classes || [];
      const loadedCategories = categoriesResp || [];
      const loadedUsers = usersResp?.users || [];
      
      const loadedTeachers = loadedUsers.filter((u: any) => u.role === 'teacher');
      const loadedStudents = loadedUsers.filter((u: any) => u.role === 'student');

      // Her quiz için sonuçları çek
      const resultsPromises = loadedQuizzes.map((q: any) => 
        resultApi.getQuizResults(q.id)
          .then(r => (r.results || []).map((res: any) => ({ 
            ...res, 
            quizId: q.id, 
            quizTitle: q.title,
            categoryId: q.categoryId,
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
      setLoading(false);
    } catch (error) {
      console.error("Failed to load data:", error);
      setLoading(false);
    }
  };

  const filteredResults = useMemo(() => {
    let filtered = allResults;
    
    // Rol bazlı kısıtlama
    if (role === 'teacher') {
      filtered = filtered.filter(r => r.createdBy === currentUser?.id);
    } else if (role === 'admin' && selectedTeacherId !== "all") {
      filtered = filtered.filter(r => r.createdBy === selectedTeacherId);
    }

    if (selectedClassId !== "all") {
      filtered = filtered.filter(r => r.student?.classId === selectedClassId);
    }
    
    if (selectedCategoryId !== "all") {
      filtered = filtered.filter(r => r.categoryId === selectedCategoryId);
    }

    if (selectedStudentId !== "all") {
      filtered = filtered.filter(r => r.studentId === selectedStudentId);
    }

    return filtered;
  }, [allResults, selectedClassId, selectedCategoryId, selectedTeacherId, selectedStudentId, role, currentUser]);

  const mebStats = useMemo(() => {
    const grades = {
      pekiyi: { name: 'Pekiyi (85-100)', value: 0, color: '#10b981' },
      iyi: { name: 'İyi (70-84)', value: 0, color: '#3b82f6' },
      orta: { name: 'Orta (55-69)', value: 0, color: '#f59e0b' },
      gecer: { name: 'Geçer (45-54)', value: 0, color: '#6366f1' },
      gecmez: { name: 'Geçmez (0-44)', value: 0, color: '#ef4444' }
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
    // Sadece mevcut filtrelere uygun quizi olan sonuçları grupla
    const quizStats: Record<string, any> = {};
    
    filteredResults.forEach(r => {
      if (!quizStats[r.quizId]) {
        const quizObj = quizzes.find(q => q.id === r.quizId);
        quizStats[r.quizId] = {
          id: r.quizId,
          title: r.quizTitle || quizObj?.title || 'Bilinmeyen Sınav',
          category: categories.find(c => c.id === r.categoryId)?.name || 'Genel',
          participants: 0,
          totalScore: 0
        };
      }
      quizStats[r.quizId].participants++;
      quizStats[r.quizId].totalScore += (r.score || 0);
    });

    return Object.values(quizStats)
      .map(q => ({
        ...q,
        avgScore: Math.round(q.totalScore / q.participants)
      }))
      .filter(q => 
        q.title.toLowerCase().includes(tableSearch.toLowerCase()) || 
        q.category.toLowerCase().includes(tableSearch.toLowerCase())
      )
      .sort((a, b) => b.participants - a.participants);
  }, [filteredResults, quizzes, categories, tableSearch]);

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
      link.setAttribute("download", `quiz_istatistikleri_${format(new Date(), "dd_MM_yyyy")}.csv`);
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

  const hasData = filteredResults.length > 0;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">İstatistik ve Analiz</h1>
          <p className="text-muted-foreground mt-1">Sistem genelindeki sınav performanslarını ve öğrenci verilerini analiz edin.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/50 p-1 rounded-xl w-full max-w-md">
            <TabsTrigger value="overview" className="gap-2 rounded-lg flex-1">
              <Activity className="h-4 w-4" /> Genel Bakış
            </TabsTrigger>
            {role === "teacher" && (
              <TabsTrigger value="reports" className="gap-2 rounded-lg flex-1">
                <BarChart2 className="h-4 w-4" /> Öğrenci Raporları
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="overview" className="space-y-8 animate-in fade-in-50 duration-500">
            {/* Filters Bar */}
            <div className="bg-card p-6 rounded-2xl border border-border/50 shadow-sm dark:shadow-none space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Search className="h-4 w-4 text-primary" />
                <span className="text-xs font-black uppercase tracking-widest opacity-60">Veri Filtreleme</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground ml-1">Sınıf</Label>
                  <Select value={selectedClassId} onValueChange={(val) => { setSelectedClassId(val); setSelectedStudentId("all"); }}>
                    <SelectTrigger className="rounded-xl bg-muted/30 border-transparent">
                      <SelectValue placeholder="Sınıf Seçin" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all">Tüm Sınıflar</SelectItem>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground ml-1">Ders/Kategori</Label>
                  <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                    <SelectTrigger className="rounded-xl bg-muted/30 border-transparent">
                      <SelectValue placeholder="Ders Seçin" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all">Tüm Dersler</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {role === 'admin' && (
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground ml-1">Öğretmen</Label>
                    <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                      <SelectTrigger className="rounded-xl bg-muted/30 border-transparent">
                        <SelectValue placeholder="Eğitmen Seçin" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="all">Tüm Eğitmenler</SelectItem>
                        {teachers.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground ml-1">Öğrenci</Label>
                  <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                    <SelectTrigger className="rounded-xl bg-muted/30 border-transparent">
                      <SelectValue placeholder="Öğrenci Seçin" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all">Tüm Öğrenciler</SelectItem>
                      {students
                        .filter(s => selectedClassId === 'all' || s.classId === selectedClassId)
                        .map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button onClick={handleExport} variant="outline" className="w-full gap-2 font-bold rounded-xl border-dashed">
                    <Download className="h-4 w-4" /> CSV Dışa Aktar
                  </Button>
                </div>
              </div>
            </div>

            {/* Charts Section */}
            {!hasData ? (
              <div className="py-20 text-center border-2 border-dashed rounded-3xl space-y-4">
                <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                  <AlertCircle className="h-8 w-8 text-muted-foreground opacity-20" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-lg">Görüntülenecek Veri Yok</h3>
                  <p className="text-muted-foreground text-sm max-w-xs mx-auto">Seçtiğiniz filtrelere uygun sınav sonucu bulunamadı. Lütfen filtreleri değiştirin.</p>
                </div>
                <Button variant="link" onClick={() => {
                  setSelectedClassId("all");
                  setSelectedCategoryId("all");
                  setSelectedTeacherId("all");
                  setSelectedStudentId("all");
                }}>Filtreleri Temizle</Button>
              </div>
            ) : (
              <>
                <div className="grid gap-6 md:grid-cols-2">
                  <Card className="rounded-3xl border-border/50 shadow-sm dark:shadow-none overflow-hidden">
                    <CardHeader className="bg-muted/20 border-b border-border/50">
                      <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-amber-500" /> Başarı Dağılımı (MEB)
                      </CardTitle>
                      <CardDescription>Puan aralıklarına göre öğrenci sayısı</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={mebStats}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                            <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip 
                              cursor={{fill: 'rgba(0,0,0,0.03)'}} 
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

                  <Card className="rounded-3xl border-border/50 shadow-sm dark:shadow-none overflow-hidden">
                    <CardHeader className="bg-muted/20 border-b border-border/50">
                      <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <BarChart2 className="h-5 w-5 text-blue-500" /> Sınav Ortalamaları
                      </CardTitle>
                      <CardDescription>En çok katılımlı ilk 10 sınavın başarı oranı</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={quizTableData.slice(0, 10)}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                            <XAxis 
                              dataKey="title" 
                              fontSize={9} 
                              tickLine={false} 
                              axisLine={false} 
                              interval={0} 
                              height={60}
                              tick={(props) => {
                                const { x, y, payload } = props;
                                return (
                                  <g transform={`translate(${x},${y})`}>
                                    <text x={0} y={0} dy={16} textAnchor="end" fill="#666" transform="rotate(-35)" className="text-[8px]">
                                      {payload.value.length > 15 ? payload.value.substring(0, 12) + '...' : payload.value}
                                    </text>
                                  </g>
                                );
                              }}
                            />
                            <YAxis fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                            <Tooltip 
                              cursor={{fill: 'rgba(0,0,0,0.03)'}}
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                            />
                            <Bar dataKey="avgScore" name="Ortalama Puan (%)" fill="#6366f1" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Table Section */}
                <Card className="rounded-3xl border-border/50 shadow-sm dark:shadow-none overflow-hidden">
                  <CardHeader className="bg-muted/20 border-b border-border/50">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <CardTitle className="text-xl font-black">Sınav Detayları</CardTitle>
                      <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                          placeholder="Sınav veya ders ara..." 
                          className="pl-9 h-9 rounded-xl bg-background/50 border-transparent focus:border-primary/20"
                          value={tableSearch}
                          onChange={(e) => setTableSearch(e.target.value)}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader className="bg-muted/10">
                        <TableRow className="border-border/50">
                          <TableHead className="font-bold py-4 px-6">Sınav Adı</TableHead>
                          <TableHead className="font-bold">Ders</TableHead>
                          <TableHead className="text-center font-bold">Katılımcı</TableHead>
                          <TableHead className="text-right py-4 px-6 font-bold">Genel Ortalama</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {quizTableData.map((q) => (
                          <TableRow key={q.id} className="hover:bg-primary/5 transition-colors border-border/30">
                            <TableCell className="font-bold py-4 px-6 text-foreground">{q.title}</TableCell>
                            <TableCell><Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-100">{q.category}</Badge></TableCell>
                            <TableCell className="text-center">
                              <span className="inline-flex items-center gap-1.5 font-bold">
                                <Users className="h-3.5 w-3.5 opacity-40" /> {q.participants}
                              </span>
                            </TableCell>
                            <TableCell className="text-right py-4 px-6 font-black text-indigo-600 text-lg">
                              %{q.avgScore}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* TEACHER REPORTS TAB */}
          {role === "teacher" && (
            <TabsContent value="reports" className="animate-in slide-in-from-bottom-4 duration-500">
              <Card className="rounded-3xl border-border/50 shadow-sm dark:shadow-none overflow-hidden">
                <CardHeader className="bg-muted/20 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-black">Öğrenci Sınav Karneleri</CardTitle>
                      <CardDescription>Sorumlu olduğunuz öğrencilerin detaylı performans dökümleri.</CardDescription>
                    </div>
                    <Badge variant="outline" className="gap-1.5 py-1.5 px-4 rounded-full border-emerald-200 bg-emerald-50 text-emerald-700 font-bold">
                      <GraduationCap className="h-3.5 w-3.5" /> {filteredResults.length} Toplam Sonuç
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-muted/10">
                      <TableRow className="border-border/50">
                        <TableHead className="font-bold py-4 px-6">Öğrenci</TableHead>
                        <TableHead className="font-bold">Sınav Adı</TableHead>
                        <TableHead className="text-center font-bold">Doğru/Toplam</TableHead>
                        <TableHead className="text-right py-4 px-6 font-bold">Başarı Puanı</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredResults.length > 0 ? (
                        filteredResults.map((res, i) => (
                          <TableRow key={i} className="hover:bg-muted/30 border-border/30">
                            <TableCell className="py-4 px-6">
                              <div className="flex flex-col">
                                <span className="font-bold text-sm">{res.student?.name || 'Bilinmeyen'}</span>
                                <span className="text-[10px] opacity-50">{res.student?.email}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm font-medium">{res.quizTitle || 'Sınav'}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="font-bold tabular-nums">
                                {res.correctAnswers} / {res.totalQuestions}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right py-4 px-6">
                              <Badge className={cn(
                                "font-black px-3 py-1 rounded-lg",
                                res.score >= 85 ? "bg-emerald-500" : 
                                res.score >= 70 ? "bg-blue-500" : 
                                res.score >= 55 ? "bg-amber-500" : 
                                res.score >= 45 ? "bg-orange-500" : "bg-rose-500"
                              )}>
                                {res.score}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow><TableCell colSpan={4} className="h-40 text-center text-muted-foreground italic">Filtrelere uygun karne bulunamadı.</TableCell></TableRow>
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
