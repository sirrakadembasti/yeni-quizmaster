import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi, classApi, quizApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Archive, GraduationCap, AlertCircle, Loader2, ArrowRight, ShieldAlert, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function ArchivePage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [academicYear, setAcademicYear] = useState("");
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);

  // Student Promotion State
  const [promotionFromClassId, setPromotionFromClassId] = useState("");
  const [promotionToClassId, setPromotionToClassId] = useState("graduate");
  const [isPromoteConfirmOpen, setIsPromoteConfirmOpen] = useState(false);

  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ['/api/classes'],
    queryFn: () => classApi.getAllClasses(),
  });

  const { data: quizzesData, isLoading: quizzesLoading } = useQuery({
    queryKey: ['/api/admin/quizzes'],
    queryFn: () => quizApi.getAllAdminQuizzes(),
  });

  const classes = classesData?.classes || [];
  const quizzes = quizzesData?.quizzes || [];

  const activeQuizzesCount = quizzes.filter((q: any) => q.status !== 'archived').length;
  const archivedQuizzesCount = quizzes.filter((q: any) => q.status === 'archived').length;

  const archiveMutation = useMutation({
    mutationFn: (year: string) => adminApi.archiveYear(year),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/quizzes'] });
      setIsArchiveConfirmOpen(false);
      setAcademicYear("");
      toast({
        title: "Arşivleme Tamamlandı",
        description: `${data.quizzesArchived} sınav ve ${data.resultsArchived} sonuç arşivlendi.`,
        className: "bg-emerald-50 border-emerald-200 text-emerald-800"
      });
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: "Hata", description: e.message });
    }
  });

  const promoteMutation = useMutation({
    mutationFn: (data: { fromClassId: string, toClassId: string | null }) => 
      adminApi.promoteStudents([data]),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsPromoteConfirmOpen(false);
      setPromotionFromClassId("");
      setPromotionToClassId("graduate");
      toast({
        title: "Sınıf Atlatma Başarılı",
        description: `${data.totalPromoted} öğrenci yeni sınıfına aktarıldı.`,
        className: "bg-emerald-50 border-emerald-200 text-emerald-800"
      });
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: "Hata", description: e.message });
    }
  });

  const handleArchive = () => {
    if (!academicYear || academicYear.length < 4) {
      toast({ variant: "destructive", title: "Hata", description: "Lütfen geçerli bir eğitim yılı girin (örn: 2025-2026)." });
      return;
    }
    setIsArchiveConfirmOpen(true);
  };

  const handlePromote = () => {
    if (!promotionFromClassId) {
      toast({ variant: "destructive", title: "Hata", description: "Lütfen kaynak sınıfı seçin." });
      return;
    }
    setIsPromoteConfirmOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Yıl Sonu ve Arşiv İşlemleri</h1>
          <p className="text-muted-foreground mt-1">Eğitim yılı sonu yedeklemeleri ve öğrenci sınıf atlatma işlemleri buradan yönetilir.</p>
        </div>

        <Tabs defaultValue="archive" className="w-full">
          <TabsList className="bg-muted p-1 rounded-xl mb-6">
            <TabsTrigger value="archive" className="rounded-lg font-bold px-6">Sınav Arşivi</TabsTrigger>
            <TabsTrigger value="promote" className="rounded-lg font-bold px-6">Sınıf Atlatma</TabsTrigger>
          </TabsList>

          {/* ARCHIVE TAB */}
          <TabsContent value="archive" className="space-y-6 m-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="rounded-3xl border-border bg-card shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl font-black">
                    <Archive className="h-5 w-5 text-primary" /> Yeni Arşiv Oluştur
                  </CardTitle>
                  <CardDescription>
                    Aktif olan tüm sınavları ve sonuçları belirlediğiniz eğitim yılı altına arşivler.
                    Arşivlenen sınavlar öğretmen panellerinde salt okunur görünür.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-xl border border-amber-100 dark:border-amber-900/50 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
                      Bu işlem sistemdeki <span className="font-black">{activeQuizzesCount}</span> aktif sınavı "Arşivlendi" statüsüne geçirecektir. İşlem geri alınamaz.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold">Eğitim Yılı Etiketi</Label>
                    <Input 
                      placeholder="Örn: 2025-2026 Eğitim Yılı" 
                      value={academicYear}
                      onChange={e => setAcademicYear(e.target.value)}
                      className="rounded-xl border-border focus:border-primary"
                    />
                  </div>
                  <Button 
                    className="w-full rounded-xl font-bold bg-primary text-primary-foreground shadow-md dark:shadow-none"
                    onClick={handleArchive}
                    disabled={archiveMutation.isPending}
                  >
                    {archiveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Archive className="h-4 w-4 mr-2" />}
                    Sistemi Arşivle
                  </Button>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-border bg-card shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl font-black">Arşiv Durumu</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center p-4 bg-muted rounded-xl border border-border">
                      <span className="font-bold text-muted-foreground">Aktif Sınavlar</span>
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 text-lg py-1 px-3 shadow-none border-none">{activeQuizzesCount}</Badge>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-muted rounded-xl border border-border">
                      <span className="font-bold text-muted-foreground">Arşivlenmiş Sınavlar</span>
                      <Badge className="bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-lg py-1 px-3 shadow-none border-none">{archivedQuizzesCount}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-3xl border-border bg-card shadow-sm overflow-hidden">
               <CardHeader className="bg-muted/50 border-b border-border">
                 <CardTitle className="text-lg font-black">Geçmiş Arşiv Kayıtları</CardTitle>
               </CardHeader>
               <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="font-black text-xs uppercase tracking-widest pl-6">Sınav Adı</TableHead>
                      <TableHead className="font-black text-xs uppercase tracking-widest">Eğitim Yılı</TableHead>
                      <TableHead className="font-black text-xs uppercase tracking-widest text-center">Durum</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quizzes.filter((q: any) => q.status === 'archived').length === 0 ? (
                       <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-muted-foreground italic">Henüz arşivlenmiş sınav bulunmuyor.</TableCell>
                       </TableRow>
                    ) : (
                      quizzes.filter((q: any) => q.status === 'archived').slice(0, 20).map((quiz: any) => (
                        <TableRow key={quiz.id} className="border-border">
                          <TableCell className="pl-6 font-bold">{quiz.title}</TableCell>
                          <TableCell><Badge variant="outline">{quiz.academicYear || 'Eski Kayıt'}</Badge></TableCell>
                          <TableCell className="text-center"><Badge className="bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-none shadow-none">Arşivlendi</Badge></TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
               </Table>
            </Card>
          </TabsContent>

          {/* PROMOTE TAB */}
          <TabsContent value="promote" className="space-y-6 m-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="rounded-3xl border-border bg-card shadow-sm max-w-2xl mx-auto">
              <CardHeader className="text-center pb-2">
                <div className="h-16 w-16 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-100 dark:border-indigo-900/50">
                  <GraduationCap className="h-8 w-8" />
                </div>
                <CardTitle className="text-2xl font-black">Toplu Sınıf Atlatma</CardTitle>
                <CardDescription className="px-4">
                  Öğrencileri mevcut sınıflarından bir üst sınıfa toplu olarak aktarın veya mezun edin.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8 p-8">
                <div className="space-y-3">
                  <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Mevcut Sınıf (Kaynak)</Label>
                  <Select value={promotionFromClassId} onValueChange={setPromotionFromClassId}>
                    <SelectTrigger className="h-14 rounded-xl border-2 border-border focus:border-indigo-500 bg-muted/30">
                      <SelectValue placeholder="Öğrencilerin bulunduğu sınıfı seçin..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {classes.map((c: any) => (
                         <SelectItem key={c.id} value={c.id}>
                           {c.name} ({c._count?.students || 0} Öğrenci)
                         </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-center">
                  <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center border-4 border-card z-10 text-muted-foreground shadow-sm dark:shadow-none">
                    <ArrowRight className="h-5 w-5 rotate-90 md:rotate-0" />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Yeni Sınıf (Hedef)</Label>
                  <Select value={promotionToClassId} onValueChange={setPromotionToClassId}>
                    <SelectTrigger className="h-14 rounded-xl border-2 border-border focus:border-indigo-500 bg-muted/30">
                      <SelectValue placeholder="Hedef sınıfı seçin..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="graduate" className="text-emerald-600 font-bold focus:text-emerald-700">
                        🎓 Mezun Et (Sınıf Bağlantısını Kopar)
                      </SelectItem>
                      {classes.filter((c: any) => c.id !== promotionFromClassId).map((c: any) => (
                         <SelectItem key={c.id} value={c.id}>
                           {c.name}
                         </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  className="w-full h-14 rounded-xl font-bold text-lg bg-indigo-600 hover:bg-indigo-700 shadow-xl dark:shadow-none"
                  onClick={handlePromote}
                  disabled={!promotionFromClassId || classesLoading || promoteMutation.isPending}
                >
                  {promoteMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <GraduationCap className="h-5 w-5 mr-2" />}
                  İşlemi Başlat
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Confirmation Dialogs */}
      <Dialog open={isArchiveConfirmOpen} onOpenChange={setIsArchiveConfirmOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md bg-card border-border">
          <div className="py-6 text-center space-y-4">
            <div className="h-16 w-16 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-2 border border-red-100 dark:border-red-900/50">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <DialogTitle className="text-xl font-black">Arşivleme Onayı</DialogTitle>
            <DialogDescription className="text-sm font-medium">
              Bu işlem geri alınamaz. <strong>{academicYear}</strong> etiketiyle tüm aktif sınavlar kilitlenecek. Devam etmek istiyor musunuz?
            </DialogDescription>
          </div>
          <DialogFooter className="flex gap-2 p-4 pt-0 sm:justify-center">
            <Button variant="outline" onClick={() => setIsArchiveConfirmOpen(false)} className="rounded-xl flex-1 font-bold">Vazgeç</Button>
            <Button variant="destructive" onClick={() => archiveMutation.mutate(academicYear)} className="rounded-xl flex-1 font-bold shadow-md dark:shadow-none">Evet, Arşivle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPromoteConfirmOpen} onOpenChange={setIsPromoteConfirmOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md bg-card border-border">
          <div className="py-6 text-center space-y-4">
            <div className="h-16 w-16 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-2 border border-indigo-100 dark:border-indigo-900/50">
              <Users className="h-8 w-8" />
            </div>
            <DialogTitle className="text-xl font-black">Toplu Sınıf Aktarımı</DialogTitle>
            <DialogDescription className="text-sm font-medium space-y-2">
              <p>Seçilen sınıftaki tüm öğrenciler hedef sınıfa aktarılacak.</p>
              {(() => {
                const fromClass = classes.find(c => c.id === promotionFromClassId);
                const toClass = classes.find(c => c.id === promotionToClassId);
                const fromLevel = fromClass?.name.split("-")[0] || "Seviyesiz";
                const toLevel = promotionToClassId === "graduate" ? "Mezuniyet" : toClass?.name.split("-")[0] || "Seviyesiz";

                if (fromLevel !== toLevel) {
                  return (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 rounded-xl text-amber-800 dark:text-amber-300 font-bold mt-2">
                      ⚠️ Öğrenciler mevcut sınıf seviyesinden ({fromLevel}) farklı bir seviyeye ({toLevel}) geçirilecektir. Bunu onaylıyor musunuz?
                    </div>
                  );
                }
                return null;
              })()}
            </DialogDescription>
          </div>
          <DialogFooter className="flex gap-2 p-4 pt-0 sm:justify-center">
            <Button variant="outline" onClick={() => setIsPromoteConfirmOpen(false)} className="rounded-xl flex-1 font-bold">Vazgeç</Button>
            <Button className="rounded-xl flex-1 font-bold bg-indigo-600 hover:bg-indigo-700 shadow-md dark:shadow-none text-white" onClick={() => promoteMutation.mutate({
              fromClassId: promotionFromClassId,
              toClassId: promotionToClassId === "graduate" ? null : promotionToClassId
            })}>Evet, İşlemi Yap</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}