import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Loader2,
  Mail,
  Phone,
  MapPin,
  BookOpen,
  GraduationCap,
  FileText,
  Users,
  CalendarDays,
  ShieldAlert,
  Pencil,
  Trash2,
  Download
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userApi, quizApi, classApi } from "@/lib/api";
import { Link, useParams, useLocation } from "wouter";
import { useMemo, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { UserFormModal } from "@/components/management/UserFormModal";
import { DeleteConfirmModal } from "@/components/management/DeleteConfirmModal";
import { PrintButton, PrintMeta } from "@/components/print/PrintTools";
import { downloadCsv } from "@/lib/export";

export default function TeacherDetailPage() {
  const params = useParams<{ id: string }>();
  const teacherId = params.id;
  const { role } = useAuth();
  const [, setLocation] = useLocation();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => userApi.getAllUsers(),
  });

  const { data: quizzesData } = useQuery({
    queryKey: ["quizzes"],
    queryFn: () => quizApi.getAllQuizzes(),
  });

  const { data: classesData } = useQuery({
    queryKey: ["/api/classes"],
    queryFn: () => classApi.getAllClasses(),
  });

  const teacher = useMemo(
    () => usersData?.users.find((u) => u.id === teacherId),
    [usersData, teacherId]
  );

  const updateMutation = useMutation({
    mutationFn: (data: any) => userApi.updateUser(teacher!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Başarılı", description: "Öğretmen bilgileri güncellendi." });
      setIsEditOpen(false);
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Hata", description: err.message || "Güncelleme başarısız." });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => userApi.deleteUser(teacher!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Başarılı", description: "Öğretmen silindi." });
      setIsDeleteOpen(false);
      setLocation("/teachers");
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Hata", description: err.message || "Silme işlemi başarısız." });
    }
  });

  const teacherQuizzes = useMemo(
    () => quizzesData?.quizzes?.filter((q: any) => q.createdBy === teacherId || q.creator?.id === teacherId) ?? [],
    [quizzesData, teacherId]
  );

  const teacherClasses = useMemo(
    () =>
      classesData?.classes?.filter(
        (c: any) =>
          c.classTeacherId === teacherId ||
          (c.teachers as any[])?.some((t: any) => t.id === teacherId) ||
          (c.teacherAssignments as any[])?.some((ta: any) => ta.teacherId === teacherId)
      ) ?? [],
    [classesData, teacherId]
  );

  const exportTeacher = () => {
    if (!teacher) return;
    downloadCsv({
      filename: `${teacher.name}-ogretmen-detayi.csv`,
      title: "Öğretmen Detayı",
      filters: [
        { label: "Öğretmen", value: teacher.name },
        { label: "E-posta", value: teacher.email },
        { label: "Oluşturduğu sınav", value: teacherQuizzes.length },
      ],
      rows: [
        ...teacherClasses.map((item: any) => ({ type: "Sınıf", name: item.name, detail: item.classTeacherId === teacherId ? "Sorumlu öğretmen" : "Dersine girdiği sınıf" })),
        ...teacherQuizzes.map((item: any) => ({ type: "Sınav", name: item.title, detail: item.status || "-" })),
      ],
      columns: [
        { header: "Kayıt Türü", value: (row: any) => row.type },
        { header: "Ad", value: (row: any) => row.name },
        { header: "Açıklama", value: (row: any) => row.detail },
      ],
    });
  };
  if (usersLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-32 flex-col gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground font-black animate-pulse">YÜKLENIYOR...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!teacher) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <ShieldAlert className="h-12 w-12 text-destructive" />
          <p className="text-xl font-black text-foreground">Öğretmen bulunamadı.</p>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/teachers"><ArrowLeft className="h-4 w-4 mr-2" /> Geri Dön</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <PrintMeta title="Öğretmen Detayı" filters={[{ label: "Öğretmen", value: teacher.name }, { label: "E-posta", value: teacher.email }]} />
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild className="rounded-xl border-2">
              <Link href="/teachers"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div>
              <h1 className="text-3xl font-black tracking-tighter text-foreground">{teacher.name}</h1>
              <p className="text-sm text-muted-foreground font-medium mt-0.5">Öğretmen Profili</p>
            </div>
          </div>
          {role === 'admin' && (
            <div className="flex items-center gap-2.5 ml-auto">
              <Button variant="outline" size="sm" className="rounded-xl font-bold gap-2" onClick={exportTeacher}><Download className="h-4 w-4" /> Excel Uyumlu CSV</Button>
              <PrintButton className="rounded-xl" />
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl font-bold gap-2 border-border hover:bg-muted"
                onClick={() => setIsEditOpen(true)}
              >
                <Pencil className="h-4 w-4" /> Öğretmeni Düzenle
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="rounded-xl font-bold gap-2"
                onClick={() => setIsDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4" /> Öğretmeni Sil
              </Button>
            </div>
          )}
        </header>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Left Column: Profile Card */}
          <div className="md:col-span-1 space-y-6">
            {/* Profile */}
            <Card className="rounded-[2rem] border-2 border-border overflow-hidden">
              <div className="bg-gradient-to-br from-indigo-600 to-indigo-400 p-8 flex flex-col items-center text-white">
                <div className="h-20 w-20 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center font-black text-3xl shadow-xl mb-4">
                  {teacher.name[0].toUpperCase()}
                </div>
                <h2 className="text-lg font-black text-center leading-tight">{teacher.name}</h2>
                <Badge className="mt-2 bg-white/20 border-white/30 text-white text-[10px] font-black uppercase tracking-widest">
                  Branş Öğretmeni
                </Badge>
              </div>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-indigo-500 shrink-0" />
                  <span className="text-foreground font-medium truncate">{teacher.email}</span>
                </div>
                {(teacher as any).phoneNumber && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-indigo-500 shrink-0" />
                    <span className="text-foreground font-medium">{(teacher as any).phoneNumber}</span>
                  </div>
                )}
                {(teacher as any).address && (
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="h-4 w-4 text-indigo-500 shrink-0" />
                    <span className="text-foreground font-medium">{(teacher as any).address}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <CalendarDays className="h-4 w-4 text-indigo-500 shrink-0" />
                  <span className="text-muted-foreground font-medium">
                    {new Date((teacher as any).createdAt).toLocaleDateString("tr-TR")} tarihinde katıldı
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Details */}
          <div className="md:col-span-2 space-y-6">
            {/* Branches */}
            <Card className="rounded-[2rem] border-2 border-border overflow-hidden">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-indigo-500" /> Branş Bilgileri
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-5">
                {teacher.assignedCategories && teacher.assignedCategories.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {teacher.assignedCategories.map((cat) => (
                      <Badge key={cat.id} className="rounded-full px-4 py-1.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold text-sm">
                        {cat.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Henüz branş atanmamış.</p>
                )}
              </CardContent>
            </Card>

            {/* Classes (Homeroom) */}
            <Card className="rounded-[2rem] border-2 border-border overflow-hidden">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-emerald-500" /> Sınıf Öğretmenliği (Sorumlu Sınıflar)
                  <Badge variant="outline" className="ml-auto font-black text-xs rounded-full px-2.5 py-0.5">
                    {teacherClasses.filter((c: any) => c.classTeacherId === teacherId).length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-5">
                {teacherClasses.filter((c: any) => c.classTeacherId === teacherId).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {teacherClasses.filter((c: any) => c.classTeacherId === teacherId).map((cls: any) => (
                      <Link key={cls.id} href={`/admin/classes/${cls.id}`}>
                        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-sm cursor-pointer hover:bg-emerald-100 transition-colors">
                          <Users className="h-3.5 w-3.5" />
                          {cls.name}
                          {cls._count && (
                            <span className="bg-emerald-100 dark:bg-emerald-900 px-1.5 py-0.5 rounded-full text-[10px] font-black">
                              {cls._count.students}
                            </span>
                          )}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Henüz sorumlu sınıf atanmamış.</p>
                )}
              </CardContent>
            </Card>

            {/* Classes (Assigned/Branch) */}
            <Card className="rounded-[2rem] border-2 border-border overflow-hidden">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-500" /> Dersine Girdiği Sınıflar
                  <Badge variant="outline" className="ml-auto font-black text-xs rounded-full px-2.5 py-0.5">
                    {teacherClasses.filter((c: any) => c.classTeacherId !== teacherId).length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-5">
                {teacherClasses.filter((c: any) => c.classTeacherId !== teacherId).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {teacherClasses.filter((c: any) => c.classTeacherId !== teacherId).map((cls: any) => (
                      <Link key={cls.id} href={`/admin/classes/${cls.id}`}>
                        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold text-sm cursor-pointer hover:bg-blue-100 transition-colors">
                          <Users className="h-3.5 w-3.5" />
                          {cls.name}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Henüz ders ataması yapılmamış.</p>
                )}
              </CardContent>
            </Card>

            {/* Quizzes */}
            <Card className="rounded-[2rem] border-2 border-border overflow-hidden">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-purple-500" /> Oluşturduğu Sınavlar
                  <Badge variant="outline" className="ml-auto font-black text-xs rounded-full px-2.5 py-0.5">
                    {teacherQuizzes.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-5">
                {teacherQuizzes.length > 0 ? (
                  <div className="space-y-2">
                    {teacherQuizzes.slice(0, 10).map((quiz: any) => (
                      <div key={quiz.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-purple-500 shrink-0" />
                          <span className="text-sm font-bold text-foreground truncate">{quiz.title}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {quiz.category && (
                            <Badge variant="secondary" className="text-[10px] font-bold">{typeof quiz.category === 'string' ? quiz.category : quiz.category?.name}</Badge>
                          )}
                          <span className="text-[11px] text-muted-foreground font-medium">{quiz.participantCount ?? 0} katılım</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Henüz sınav oluşturulmamış.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {role === 'admin' && teacher && (
        <>
          <UserFormModal
            isOpen={isEditOpen}
            onOpenChange={setIsEditOpen}
            mode="edit"
            role="teacher"
            initialData={teacher}
            onSubmit={(data) => updateMutation.mutate(data)}
            isPending={updateMutation.isPending}
          />
          <DeleteConfirmModal
            isOpen={isDeleteOpen}
            onOpenChange={setIsDeleteOpen}
            onConfirm={() => deleteMutation.mutate()}
            title="Öğretmeni Sil"
            description={`"${teacher.name}" isimli öğretmeni silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
            isPending={deleteMutation.isPending}
          />
        </>
      )}
    </DashboardLayout>
  );
}
