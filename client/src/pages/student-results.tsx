import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight,
  Search,
  Calendar,
  Clock,
  User as UserIcon,
  Mail,
  School,
  ChevronLeft,
  Trophy,
  List,
  Loader2,
  AlertCircle,
  Filter,
  X,
  Info,
  Users,
  Pencil
} from "lucide-react";
import { resultApi, userApi, categoryApi } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { UserFormModal } from "@/components/management/UserFormModal";
import { PrintButton, PrintMeta } from "@/components/print/PrintTools";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function StudentResultsPage() {
  const [, setLocation] = useLocation();
  const { user, role } = useAuth();
  const searchParams = new URLSearchParams(window.location.search);
  const studentId = searchParams.get('studentId') || undefined;

  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [student, setStudent] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!student) throw new Error("Öğrenci verisi bulunamadı");
      return userApi.updateUser(student.id, data);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      if (studentId) {
        try {
          const fresh = await userApi.getUser(studentId);
          if (fresh?.user) setStudent(fresh.user);
        } catch {}
      }
      toast({ title: "Başarılı", description: "Öğrenci ve veli bilgileri güncellendi." });
      setIsEditOpen(false);
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Hata", description: err.message || "Güncelleme başarısız." });
    }
  });

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterScore, setFilterScore] = useState("all"); 
  const [sortBy, setSortBy] = useState("date_desc");
  const [activeTab, setActiveTab] = useState("exams");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [resultsData, catsData] = await Promise.all([
          resultApi.getStudentResults(studentId),
          categoryApi.getAllCategories()
        ]);

        setResults(resultsData.results || []);
        setCategories(catsData || []);

        if (studentId) {
          try {
            const userData = await userApi.getUser(studentId);
            if (userData?.user) {
              setStudent(userData.user);
            }
          } catch {
            const usersData = await userApi.getAllUsers();
            const foundStudent = usersData.users.find((u: any) => u.id === studentId);
            if (foundStudent) setStudent(foundStudent);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Veriler yüklenemedi");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [studentId]);

  const filteredResults = useMemo(() => {
    // Authority based filtering
    let baseResults = [...results];
    
    if (role === 'teacher') {
      // Sorumlu Öğretmen mi kontrol et
      const isClassTeacher = student?.classTeacherId === user?.id || 
                            (student?.class?.classTeacherId === user?.id);
      
      if (!isClassTeacher) {
        // Sadece branş öğretmeni ise: Sadece kendi oluşturduğu quizleri görsün
        baseResults = baseResults.filter(r => r.quiz?.createdBy === user?.id);
      }
      // Admin veya Sınıf öğretmeni ise baseResults değişmez (hepsini görür)
    }

    return baseResults
      .filter(result => {
        const title = (result.quiz?.title || result.quizTitle || '').toLowerCase();
        const category = (result.quiz?.category || '').toLowerCase();
        const matchesSearch = title.includes(searchTerm.toLowerCase());
        const matchesCategory = filterCategory === "all" || category === filterCategory.toLowerCase();

        let matchesScore = true;
        const score = result.score || 0;
        if (filterScore === "high") matchesScore = score >= 90;
        else if (filterScore === "medium") matchesScore = score >= 70 && score < 90;
        else if (filterScore === "low") matchesScore = score < 70;

        return matchesSearch && matchesCategory && matchesScore;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "date_desc": return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
          case "date_asc": return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
          case "score_desc": return (b.score || 0) - (a.score || 0);
          case "score_asc": return (a.score || 0) - (b.score || 0);
          default: return 0;
        }
      });
  }, [results, student, user, role, searchTerm, filterCategory, filterScore, sortBy]);

  const resetFilters = () => {
    setSearchTerm("");
    setFilterCategory("all");
    setFilterScore("all");
    setSortBy("date_desc");
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-600 bg-emerald-50 border-emerald-200";
    if (score >= 70) return "text-blue-600 bg-blue-50 border-blue-200";
    if (score >= 50) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-rose-600 bg-rose-50 border-rose-200";
  };

  const renderStudentContent = () => {
    if (!student) return null;
    return (
      <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/20 border-b border-border/50 py-2.5 px-4 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <UserIcon className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-black">Öğrenci Bilgileri</CardTitle>
              <p className="text-[11px] text-muted-foreground font-medium">Öğrencinin temel kimlik, okul ve iletişim detayları.</p>
            </div>
          </div>
          {role === 'admin' && (
            <Button
              size="sm"
              variant="outline"
              className="ml-auto rounded-xl gap-2 font-bold"
              onClick={() => setIsEditOpen(true)}
            >
              <Pencil className="h-3.5 w-3.5" /> Bilgileri Düzenle
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-2.5 sm:p-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-0.5 bg-muted/20 p-2 rounded-lg border border-border/40">
              <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Adı Soyadı</Label>
              <p className="text-sm font-bold text-foreground">{student.name || "-"}</p>
            </div>
            <div className="space-y-0.5 bg-muted/20 p-2 rounded-lg border border-border/40">
              <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">E-Posta Adresi</Label>
              <p className="text-sm font-bold text-foreground">{student.email || "-"}</p>
            </div>
            <div className="space-y-0.5 bg-muted/20 p-2 rounded-lg border border-border/40">
              <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Kayıtlı Sınıf</Label>
              <p className="text-sm font-bold text-foreground">{student.class?.name || "Atanmamış"}</p>
            </div>
            <div className="space-y-0.5 bg-muted/20 p-2 rounded-lg border border-border/40">
              <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Okul No</Label>
              <p className="text-sm font-bold text-foreground">{student.studentNo || student.classNo || "-"}</p>
            </div>
            <div className="space-y-0.5 bg-muted/20 p-2 rounded-lg border border-border/40">
              <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Telefon Numarası</Label>
              <p className="text-sm font-bold text-foreground">{student.phoneNumber || "Belirtilmemiş"}</p>
            </div>
            <div className="space-y-0.5 bg-muted/20 p-2 rounded-lg border border-border/40">
              <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Kayıt Tarihi</Label>
              <p className="text-sm font-bold text-foreground">{student.createdAt ? new Date(student.createdAt).toLocaleDateString('tr-TR') : "-"}</p>
            </div>
            <div className="sm:col-span-2 lg:col-span-3 space-y-0.5 bg-muted/20 p-2 rounded-lg border border-border/40">
              <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Adres</Label>
              <p className="text-sm font-medium text-foreground">{student.address || "Belirtilmemiş"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderParentContent = () => {
    if (!student) return null;
    return (
      <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/20 border-b border-border/50 py-2.5 px-4 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-black">Veli Bilgileri</CardTitle>
              <p className="text-[11px] text-muted-foreground font-medium">Yalnızca yöneticilere açık veli iletişim detayları.</p>
            </div>
          </div>
          {role === 'admin' && (
            <Button
              size="sm"
              variant="outline"
              className="ml-auto rounded-xl gap-2 font-bold"
              onClick={() => setIsEditOpen(true)}
            >
              <Pencil className="h-3.5 w-3.5" /> Veli Bilgilerini Düzenle
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-2.5 sm:p-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-0.5 bg-muted/20 p-2 rounded-lg border border-border/40">
              <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Veli Adı Soyadı</Label>
              <p className="text-sm font-bold text-foreground">{student.parentName || "Belirtilmemiş"}</p>
            </div>
            <div className="space-y-0.5 bg-muted/20 p-2 rounded-lg border border-border/40">
              <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Yakınlık Derecesi</Label>
              <p className="text-sm font-bold text-foreground">{student.parentRelation || "Belirtilmemiş"}</p>
            </div>
            <div className="space-y-0.5 bg-muted/20 p-2 rounded-lg border border-border/40">
              <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Veli Telefonu</Label>
              <p className="text-sm font-bold text-foreground">{student.parentPhone || "Belirtilmemiş"}</p>
            </div>
            <div className="space-y-0.5 bg-muted/20 p-2 rounded-lg border border-border/40">
              <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Veli E-Postası</Label>
              <p className="text-sm font-bold text-foreground">{student.parentEmail || "Belirtilmemiş"}</p>
            </div>
            <div className="sm:col-span-2 space-y-0.5 bg-muted/20 p-2 rounded-lg border border-border/40">
              <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Veli İkametgah Adresi</Label>
              <p className="text-sm font-medium text-foreground">{student.parentAddress || "Belirtilmemiş"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-12">
        <PrintMeta
          title={studentId ? "\u00d6\u011frenci Analizi" : "S\u0131nav Sonu\u00e7lar\u0131m"}
          filters={[
            { label: "\u00d6\u011frenci", value: student?.name || user?.name },
            { label: "Arama", value: searchTerm || "T\u00fcm\u00fc" },
            { label: "Ders", value: categories.find((item: any) => item.id === filterCategory)?.name || "T\u00fcm dersler" },
          ]}
        />
        {/* Navigation & Header */}
        <div className="flex flex-col gap-4 print:hidden no-print">
          <Button
            variant="ghost"
            size="sm"
            className="w-fit gap-2 -ml-2 text-muted-foreground hover:text-foreground"
            onClick={() => setLocation(studentId ? '/students' : '/student/dashboard')}
          >
            <ChevronLeft className="h-4 w-4" />
            {studentId ? 'Öğrencilere Dön' : "Dashboard'a Dön"}
          </Button>

          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-heading font-bold text-foreground tracking-tight">
                {studentId ? 'Öğrenci Analizi' : 'Sınav Sonuçlarım'}
              </h1>
              <p className="text-muted-foreground mt-2 text-lg">
                {studentId
                  ? `${student?.name || 'Öğrenci'} için detaylı performans verileri.`
                  : 'Tamamladığınız tüm sınavların gelişmiş dökümü.'}
              </p>
            </div>
            <PrintButton className="rounded-xl" />
            {!loading && (
              <Badge variant="secondary" className="h-8 px-4 text-sm font-bold bg-primary/10 text-primary border-primary/20"> 
                Toplam {filteredResults.length} Kayıt
              </Badge>
            )}
          </div>
        </div>

        {/* Student Mini Profile */}
        {student && (
          <Card className="overflow-hidden border-primary/20 shadow-sm bg-gradient-to-br from-card to-primary/5 rounded-2xl">
            <div className="px-4 py-3 sm:py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
                  <UserIcon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">{student.name}</h2>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 text-primary/60" />
                      {student.email}
                    </div>
                    {student.class && (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <School className="h-3.5 w-3.5 text-primary/60" />
                        Sınıf: <span className="text-foreground">{student.class.name}</span>
                      </div>
                    )}
                    {student.studentNo && (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Info className="h-3.5 w-3.5 text-primary/60" />
                        No: <span className="text-foreground">{student.studentNo}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="text-right hidden sm:block mr-1">
                  <p className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">Öğrenci Kodu</p>    
                  <p className="font-mono text-xs font-bold">{student.id.substring(0, 8)}</p>
                </div>
                <div className="h-8 w-[1px] bg-border mx-1 hidden sm:block" />
                <Trophy className="h-6 w-6 text-amber-500" />
              </div>
            </div>
          </Card>
        )}

        {/* Sekmeli Görünüm: Sadece Admin ve öğrenci detayı varken 3 sekmeli yapı sunulur. Öğretmen için sadece sınav bilgileri gösterilir. */}
        {role === 'admin' && student && (
          <div className="print:hidden no-print">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="bg-muted/50 p-1 rounded-xl w-full max-w-xl grid grid-cols-3">
                <TabsTrigger value="exams" className="gap-2 rounded-lg py-2.5 font-bold text-xs sm:text-sm">
                  <Trophy className="h-4 w-4" /> 1. Sınav Bilgileri
                </TabsTrigger>
                <TabsTrigger value="student" className="gap-2 rounded-lg py-2.5 font-bold text-xs sm:text-sm">
                  <UserIcon className="h-4 w-4" /> 2. Öğrenci Bilgileri
                </TabsTrigger>
                <TabsTrigger value="parent" className="gap-2 rounded-lg py-2.5 font-bold text-xs sm:text-sm">
                  <Users className="h-4 w-4" /> 3. Veli Bilgileri
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}

        {role === 'admin' && student && activeTab === 'student' && renderStudentContent()}
        {role === 'admin' && student && activeTab === 'parent' && renderParentContent()}

        {(!(role === 'admin' && student) || activeTab === 'exams') && (
          <>
            {/* Advanced Query Panel */}
            <Card className="border-primary/10 shadow-md overflow-hidden print:hidden no-print">
          <CardHeader className="bg-muted/30 pb-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-bold uppercase tracking-wider">Gelişmiş Sorgulama Paneli</CardTitle>     
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-8 text-xs gap-2 hover:text-destructive"
              >
                <X className="h-3 w-3" /> Filtreleri Temizle
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {/* Search */}
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase opacity-60">Sınav Adı</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Başlık ile ara..."
                    className="pl-9 bg-muted/20"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase opacity-60">Ders / Kategori</Label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="bg-muted/20">
                    <SelectValue placeholder="Tüm Dersler" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm Dersler</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Success Level */}
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase opacity-60">Başarı Durumu</Label>
                <Select value={filterScore} onValueChange={setFilterScore}>
                  <SelectTrigger className="bg-muted/20">
                    <SelectValue placeholder="Tüm Puanlar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm Puanlar</SelectItem>
                    <SelectItem value="high">Pekiyi (90-100)</SelectItem>
                    <SelectItem value="medium">Başarılı (70-89)</SelectItem>
                    <SelectItem value="low">Geliştirilmeli (0-69)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sorting */}
              <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase opacity-60">Sıralama Ölçütü</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="bg-muted/20">
                    <SelectValue placeholder="Sıralama" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date_desc">En Yeni Tarih</SelectItem>
                    <SelectItem value="date_asc">En Eski Tarih</SelectItem>
                    <SelectItem value="score_desc">En Yüksek Puan</SelectItem>
                    <SelectItem value="score_asc">En Düşük Puan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Table */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground font-black tracking-widest uppercase text-xs">Veriler işleniyor...</p>      
          </div>
        ) : error ? (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="pt-10 pb-10 text-center">
              <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
              <p className="text-xl font-bold text-destructive mb-2">Sorgu Hatası</p>
              <p className="text-muted-foreground mb-8">{error}</p>
              <Button variant="outline" onClick={() => window.location.reload()} className="rounded-full px-8">
                Tekrar Dene
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-2xl font-black flex items-center gap-3">
                <div className="p-2 bg-primary rounded-lg text-primary-foreground">
                  <List className="h-5 w-5" />
                </div>
                Detaylı Sonuç Listesi
              </h2>
            </div>

            <Card className="border-border/70 shadow-sm overflow-hidden rounded-2xl">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50 text-muted-foreground uppercase text-[11px] font-black tracking-widest">
                        <th className="text-left py-5 px-8">Quiz & Ders</th>
                        <th className="text-center py-5 px-6">Tamamlama</th>
                        <th className="text-center py-5 px-6">Doğruluk</th>
                        <th className="text-center py-5 px-6">Süre</th>
                        <th className="text-center py-5 px-6">Puan</th>
                        <th className="text-right py-5 px-8">Eylem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {filteredResults.map((result) => {
                        const score = result.score || 0;
                        const scoreStyle = getScoreColor(score);

                        return (
                          <tr key={result.id} className="hover:bg-primary/5 transition-all group duration-200">
                            <td className="py-5 px-8">
                              <div className="flex flex-col gap-1">
                                <p className="font-black text-base text-foreground group-hover:text-primary transition-colors">
                                  {result.quiz?.title || result.quizTitle || "İsimsiz Sınav"}
                                </p>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0 h-5 bg-muted/50">     
                                    {result.quiz?.category || "Genel"}
                                  </Badge>
                                </div>
                              </div>
                            </td>
                            <td className="py-5 px-6">
                              <div className="flex flex-col items-center gap-1">
                                <div className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                                  <Calendar className="h-3.5 w-3.5 text-primary/60" />
                                  {result.submittedAt ? new Date(result.submittedAt).toLocaleDateString('tr-TR') : 'N/A'}     
                                </div>
                                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">   
                                  {result.submittedAt ? new Date(result.submittedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : ''}
                                </span>
                              </div>
                            </td>
                            <td className="py-5 px-6 text-center">
                              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/30 border border-border/50">
                                <span className="text-emerald-600 font-black text-sm">{result.correctAnswersCount || result.correctAnswers || 0}</span>
                                <div className="w-[1px] h-3 bg-border" />
                                <span className="text-rose-600 font-black text-sm">{result.totalQuestions - (result.correctAnswersCount || result.correctAnswers || 0)}</span>
                              </div>
                            </td>
                            <td className="py-5 px-6 text-center font-bold text-sm text-muted-foreground">
                              <div className="flex items-center justify-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                {Math.floor((result.timeTaken || 0) / 60)}dk {((result.timeTaken || 0) % 60)}sn
                              </div>
                            </td>
                            <td className="py-5 px-6 text-center">
                              <div className={`inline-flex items-center justify-center h-12 w-12 rounded-xl border-2 font-black text-lg shadow-sm dark:shadow-none ${scoreStyle}`}>
                                {score.toFixed(0)}
                              </div>
                            </td>
                            <td className="py-5 px-8 text-right">
                              <Button
                                size="sm"
                                className="h-10 px-6 rounded-xl font-bold gap-2 shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all"
                                onClick={() => setLocation(`/student/result/${result.id}`)}
                              >
                                İncele <ArrowRight className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {filteredResults.length === 0 && (
                  <div className="text-center py-24 bg-muted/10">
                    <div className="h-20 w-20 bg-muted/30 rounded-3xl flex items-center justify-center mx-auto mb-6">
                      <Search className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground">Sonuç Bulunamadı</h3>
                    <p className="text-muted-foreground mt-2 max-w-xs mx-auto">Seçtiğiniz kriterlere uygun sınav sonucu bulunmuyor. Filtreleri değiştirmeyi deneyin.</p>
                    <Button variant="link" onClick={resetFilters} className="mt-4 font-bold text-primary">
                      Tüm Filtreleri Sıfırla
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </>
    )}

        {role === 'admin' && student && (
          <UserFormModal
            isOpen={isEditOpen}
            onOpenChange={setIsEditOpen}
            mode="edit"
            role="student"
            initialData={student}
            onSubmit={(data) => updateMutation.mutate(data)}
            isPending={updateMutation.isPending}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
