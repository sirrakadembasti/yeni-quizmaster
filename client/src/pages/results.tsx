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
import { Label } from "@/components/ui/label";
import { 
  Download, 
  Trophy, 
  Loader2, 
  Search, 
  Activity, 
  GraduationCap, 
  BarChart2,
  AlertCircle,
  Users
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { quizApi, resultApi, classApi, categoryApi, userApi, type StudentResult } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { PrintButton, PrintMeta } from "@/components/print/PrintTools";
import { downloadCsv } from "@/lib/export";

export default function StatisticsPage() {
  const { role, user: currentUser } = useAuth();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [allResults, setAllResults] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [selectedQuizId, setSelectedQuizId] = useState<string>("all");
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("all");
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [tableSearch, setTableSearch] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    document.title = "Sınav Sonuçları | Quiz Master";
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
        role === 'admin' ? quizApi.getAllAdminQuizzes() : quizApi.getAllQuizzes(),
        role === 'teacher' ? classApi.getTeacherClasses() : classApi.getAllClasses(),
        categoryApi.getAllCategories(),
        userApi.getAllUsers(),
        resultApi.getFilteredResults()
      ];
      
      const [quizzesResp, classesResp, categoriesResp, usersResp, resultsResp] = await Promise.all(promises);
      
      const loadedQuizzes = (quizzesResp.quizzes || []).filter((quiz: any) => quiz.contentType !== 'survey');
      const loadedClasses = classesResp.classes || [];
      const loadedCategories = categoriesResp || [];
      const loadedUsers = usersResp?.users || [];
      
      const loadedTeachers = loadedUsers.filter((u: any) => u.role === 'teacher');
      const loadedStudents = loadedUsers.filter((u: any) => u.role === 'student');

      const combinedResults = (resultsResp?.results || []).map((result: any) => ({
        ...result,
        quizId: result.quizId || result.quiz?.id,
        quizTitle: result.quiz?.title || result.quizTitle,
        categoryId: result.quiz?.categoryId || result.categoryId,
        createdBy: result.quiz?.createdBy || result.createdBy,
      }));
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
      filtered = filtered.filter(r => (r.createdBy || r.quiz?.createdBy) === currentUser?.id);
    } else if (role === 'admin' && selectedTeacherId !== "all") {
      filtered = filtered.filter(r => (r.createdBy || r.quiz?.createdBy) === selectedTeacherId);
    }

    if (selectedClassId !== "all") {
      filtered = filtered.filter(r => (r.student?.classId || r.student?.class?.id) === selectedClassId);
    }
    
    if (selectedCategoryId !== "all") {
      filtered = filtered.filter(r => (r.categoryId || r.quiz?.categoryId || r.quiz?.category?.id) === selectedCategoryId);
    }
    if (selectedQuizId !== "all") {
      filtered = filtered.filter(r => (r.quizId || r.quiz?.id) === selectedQuizId);
    }

    if (selectedStudentId !== "all") {
      filtered = filtered.filter(r => (r.studentId || r.student?.id) === selectedStudentId);
    }

    return filtered;
  }, [allResults, selectedClassId, selectedCategoryId, selectedQuizId, selectedTeacherId, selectedStudentId, role, currentUser]);

  const gradedResults = useMemo(() => filteredResults.filter(
    r => r.status === 'completed' && typeof r.score === 'number' && Number.isFinite(r.score)
  ), [filteredResults]);

  const mebStats = useMemo(() => {
    const grades = {
      pekiyi: { name: 'Pekiyi (85-100)', value: 0, color: '#10b981' },
      iyi: { name: 'İyi (70-84)', value: 0, color: '#3b82f6' },
      orta: { name: 'Orta (55-69)', value: 0, color: '#f59e0b' },
      gecer: { name: 'Geçer (45-54)', value: 0, color: '#6366f1' },
      gecmez: { name: 'Geçmez (0-44)', value: 0, color: '#ef4444' }
    };

    gradedResults.forEach(r => {
      const score = r.score;
      if (score >= 85) grades.pekiyi.value++;
      else if (score >= 70) grades.iyi.value++;
      else if (score >= 55) grades.orta.value++;
      else if (score >= 45) grades.gecer.value++;
      else grades.gecmez.value++;
    });

    return Object.values(grades);
  }, [gradedResults]);

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
          graded: 0,
          totalScore: 0
        };
      }
      quizStats[r.quizId].participants++;
      if (r.status === 'completed' && typeof r.score === 'number' && Number.isFinite(r.score)) {
        quizStats[r.quizId].graded++;
        quizStats[r.quizId].totalScore += r.score;
      }
    });

    return Object.values(quizStats)
      .map(q => ({
        ...q,
        avgScore: q.graded > 0 ? Math.round(q.totalScore / q.graded) : null
      }))
      .filter(q => 
        q.title.toLowerCase().includes(tableSearch.toLowerCase()) || 
        q.category.toLowerCase().includes(tableSearch.toLowerCase())
      )
      .sort((a, b) => b.participants - a.participants);
  }, [filteredResults, quizzes, categories, tableSearch]);

  const handleExport = () => {
    const categoryName = categories.find((category: any) => category.id === selectedCategoryId)?.name || "Tüm Dersler";
    const quizName = quizzes.find((quiz: any) => quiz.id === selectedQuizId)?.title || "Tüm Sınavlar";
    const className = classes.find((item: any) => item.id === selectedClassId)?.name || "Tüm Sınıflar";
    downloadCsv({
      filename: `sinav_sonuclari_${format(new Date(), "dd_MM_yyyy")}.csv`,
      title: "Sınav Sonuçları",
      filters: [
        { label: "Ders", value: categoryName },
        { label: "Sınav", value: quizName },
        { label: "Sınıf", value: className },
        { label: "Öğretmen", value: teachers.find((teacher: any) => teacher.id === selectedTeacherId)?.name || "Tüm Öğretmenler" },
        { label: "Öğrenci", value: students.find((student: any) => student.id === selectedStudentId)?.name || "Tüm Öğrenciler" },
        { label: "Kayıt Sayısı", value: filteredResults.length },
      ],
      columns: [
        { header: "Sınav Adı", value: (row: any) => row.quizTitle || row.quiz?.title },
        { header: "Ders", value: (row: any) => row.quiz?.category?.name || categories.find((c: any) => c.id === row.categoryId)?.name || "Genel" },
        { header: "Öğrenci", value: (row: any) => row.student?.name },
        { header: "E-posta", value: (row: any) => row.student?.email || students.find((student: any) => student.id === (row.studentId || row.student?.id))?.email || "" },
        { header: "Sınıf", value: (row: any) => row.student?.class?.name || row.student?.classNo },
        { header: "Durum", value: (row: any) => row.status === "completed" ? "Tamamlandı" : "Devam Ediyor" },
        { header: "Puan", value: (row: any) => row.score ?? "" },
        { header: "Doğru", value: (row: any) => row.correctAnswersCount ?? row.correctAnswers ?? "" },
        { header: "Toplam Soru", value: (row: any) => row.totalQuestions ?? "" },
        { header: "Süre (sn)", value: (row: any) => row.timeTaken ?? "" },
        { header: "Tamamlanma Tarihi", value: (row: any) => row.submittedAt ? new Date(row.submittedAt) : "" },
      ],
      rows: filteredResults,
    });
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
      <div className="space-y-5">
        <PrintMeta
          title="Sınav Sonuçları"
          filters={[
            { label: "Kategori", value: categories.find((c: any) => c.id === selectedCategoryId)?.name || "Tümü" },
            { label: "Sınıf", value: classes.find((c: any) => c.id === selectedClassId)?.name || "Tümü" },
            { label: "Sınav", value: quizzes.find((q: any) => q.id === selectedQuizId)?.title || "Tümü" },
            { label: "Öğretmen", value: teachers.find((teacher: any) => teacher.id === selectedTeacherId)?.name || "Tüm Öğretmenler" },
            { label: "Öğrenci", value: students.find((student: any) => student.id === selectedStudentId)?.name || "Tüm Öğrenciler" },
          ]}
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden no-print">
          <div>
            <h1 className="text-3xl font-black text-foreground tracking-tight">Sınav Sonuçları</h1>
            <p className="text-muted-foreground mt-1 text-sm">Sistem genelindeki sınav sonuçlarını ve başarı performanslarını analiz edin.</p>
          </div>
          <div className="flex gap-2">
            <PrintButton className="rounded-xl" />
          </div>
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
            <div className="bg-card p-3.5 rounded-xl border border-border/50 shadow-sm dark:shadow-none space-y-2.5">
              <div className="flex items-center gap-2 mb-2">
                <Search className="h-4 w-4 text-primary" />
                <span className="text-xs font-black uppercase tracking-widest opacity-60">Veri Filtreleme</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="results-class" className="text-[10px] font-bold text-muted-foreground ml-1">Sınıf</Label>
                  <Select value={selectedClassId} onValueChange={(val) => { setSelectedClassId(val); setSelectedStudentId("all"); }}>
                    <SelectTrigger id="results-class" className="rounded-xl bg-muted/30 border-transparent">
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
                  <Label htmlFor="results-category" className="text-[10px] font-bold text-muted-foreground ml-1">Ders/Kategori</Label>
                  <Select value={selectedCategoryId} onValueChange={(value) => { setSelectedCategoryId(value); setSelectedQuizId("all"); }}>
                    <SelectTrigger id="results-category" className="rounded-xl bg-muted/30 border-transparent">
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

                <div className="space-y-1.5">
                  <Label htmlFor="results-quiz" className="text-[10px] font-bold text-muted-foreground ml-1">Sınav Adı</Label>
                  <Select value={selectedQuizId} onValueChange={setSelectedQuizId}>
                    <SelectTrigger id="results-quiz" className="rounded-xl bg-muted/30 border-transparent">
                      <SelectValue placeholder="Sınav Seçin" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all">Tüm Sınavlar</SelectItem>
                      {quizzes
                        .filter((quiz: any) => quiz.contentType !== 'survey')
                        .filter((quiz: any) => selectedCategoryId === "all" || quiz.categoryId === selectedCategoryId)
                        .filter((quiz: any) => role !== "teacher" || quiz.createdBy === currentUser?.id)
                        .map((quiz: any) => (
                          <SelectItem key={quiz.id} value={quiz.id}>{quiz.title}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                {role === 'admin' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="results-teacher" className="text-[10px] font-bold text-muted-foreground ml-1">Öğretmen</Label>
                    <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                      <SelectTrigger id="results-teacher" className="rounded-xl bg-muted/30 border-transparent">
                        <SelectValue placeholder="Öğretmen Seçin" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="all">Tüm Öğretmenler</SelectItem>
                        {teachers.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="results-student" className="text-[10px] font-bold text-muted-foreground ml-1">Öğrenci</Label>
                  <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                    <SelectTrigger id="results-student" className="rounded-xl bg-muted/30 border-transparent">
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
                    <Download className="h-4 w-4" /> Excel
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
                  setSelectedQuizId("all");
                  setSelectedTeacherId("all");
                  setSelectedStudentId("all");
                }}>Filtreleri Temizle</Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground" role="status">
                  Notlandırılan: {gradedResults.length} · Devam eden: {filteredResults.filter(r => r.status === 'in_progress').length} ·
                  {' '}Diğer / puanı bulunmayan: {filteredResults.length - gradedResults.length - filteredResults.filter(r => r.status === 'in_progress').length}.
                  {' '}Başarı dağılımı ve ortalamalar yalnız puanı bulunan tamamlanmış sınavlardan hesaplanır.
                </p>
                <div className="grid gap-6 md:grid-cols-2">
                  <Card className="rounded-3xl border-border/50 shadow-sm dark:shadow-none overflow-hidden">
                    <CardHeader className="bg-muted/20 border-b border-border/50">
                      <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-amber-500" /> Başarı Dağılımı (MEB)
                      </CardTitle>
                      <CardDescription>Tamamlanan ve notlandırılan sınavların puan dağılımı</CardDescription>
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
                          <BarChart data={quizTableData.filter(q => q.avgScore !== null).slice(0, 10)}>
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
                          <TableHead className="text-center font-bold">Notlandırılan</TableHead>
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
                            <TableCell className="text-center font-bold">{q.graded}</TableCell>
                            <TableCell className="text-right py-4 px-6 font-black text-indigo-600 text-lg">
                              {q.avgScore === null ? 'Henüz yok' : `%${q.avgScore}`}
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
                        filteredResults.map((res: StudentResult, i) => (
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
                                {res.correctAnswersCount ?? res.correctAnswers ?? '—'} / {res.totalQuestions}
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
