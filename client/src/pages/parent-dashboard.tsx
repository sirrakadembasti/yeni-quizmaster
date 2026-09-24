import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { parentApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookOpenCheck, Clock3, GraduationCap, ShieldCheck, Trophy, Users } from "lucide-react";

export default function ParentDashboardPage() {
  const [studentId, setStudentId] = useState("");
  const studentsQuery = useQuery({ queryKey: ["parent", "students"], queryFn: parentApi.getStudents });
  const students = studentsQuery.data?.students ?? [];

  useEffect(() => {
    if (!studentId && students[0]?.id) setStudentId(students[0].id);
  }, [studentId, students]);

  const overviewQuery = useQuery({
    queryKey: ["parent", "overview", studentId],
    queryFn: () => parentApi.getStudentOverview(studentId),
    enabled: Boolean(studentId),
  });
  const overview = overviewQuery.data;
  const completed = overview?.results ?? [];
  const pending = (overview?.quizzes ?? []).filter((quiz) => !quiz.completed);
  const average = useMemo(() => completed.length
    ? Math.round(completed.reduce((sum, result) => sum + Number(result.score || 0), 0) / completed.length)
    : 0, [completed]);

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-10">
        <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
          <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-primary"><ShieldCheck className="h-4 w-4" /> Veli Paneli</div>
              <h1 className="text-2xl font-black">Öğrenci Takibi</h1>
              <p className="mt-1 text-sm text-muted-foreground">Bağlı öğrencilerinizin sınav durumlarını salt okunur olarak izleyin.</p>
            </div>
            {students.length > 0 && (
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger className="w-full md:w-72"><SelectValue placeholder="Öğrenci seçin" /></SelectTrigger>
                <SelectContent>{students.map((student) => <SelectItem key={student.id} value={student.id}>{student.name} {student.class?.name ? `· ${student.class.name}` : ""}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        {!studentsQuery.isLoading && students.length === 0 && (
          <Card><CardContent className="flex flex-col items-center gap-3 py-14 text-center"><Users className="h-10 w-10 text-muted-foreground" /><h2 className="font-bold">Hesabınıza bağlı öğrenci bulunmuyor</h2><p className="text-sm text-muted-foreground">Okul yöneticinizden veli hesabınızı öğrenciyle ilişkilendirmesini isteyin.</p></CardContent></Card>
        )}

        {overview && (
          <>
            <Card><CardContent className="flex flex-wrap items-center gap-4 p-4"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10"><GraduationCap className="h-6 w-6 text-primary" /></div><div><h2 className="font-black">{overview.student.name}</h2><p className="text-sm text-muted-foreground">{overview.student.class?.name || "Sınıf atanmamış"} · {overview.student.email}</p></div></CardContent></Card>
            <div className="grid gap-4 md:grid-cols-3">
              <Metric icon={Trophy} label="Ortalama Başarı" value={`%${average}`} />
              <Metric icon={BookOpenCheck} label="Tamamlanan Sınav" value={completed.length} />
              <Metric icon={Clock3} label="Bekleyen Sınav" value={pending.length} />
            </div>
            <Card>
              <CardHeader><CardTitle className="text-lg">Sınav Sonuçları</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table><TableHeader><TableRow><TableHead>Sınav</TableHead><TableHead>Ders</TableHead><TableHead>Puan</TableHead><TableHead>Tarih</TableHead></TableRow></TableHeader><TableBody>
                  {completed.length === 0 ? <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Tamamlanmış sınav bulunmuyor.</TableCell></TableRow> : completed.map((result) => <TableRow key={result.id}><TableCell className="font-semibold">{result.quiz?.title || result.quizTitle || "Sınav"}</TableCell><TableCell>{typeof result.quiz?.category === "string" ? result.quiz.category : (result.quiz?.category as any)?.name || "-"}</TableCell><TableCell><Badge variant="secondary">%{result.score ?? 0}</Badge></TableCell><TableCell>{result.submittedAt ? new Date(result.submittedAt).toLocaleDateString("tr-TR") : "-"}</TableCell></TableRow>)}
                </TableBody></Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">Atanmış Sınavlar</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table><TableHeader><TableRow><TableHead>Sınav</TableHead><TableHead>Ders</TableHead><TableHead>Durum</TableHead></TableRow></TableHeader><TableBody>
                  {(overview.quizzes ?? []).length === 0 ? <TableRow><TableCell colSpan={3} className="h-24 text-center text-muted-foreground">Atanmış sınav bulunmuyor.</TableCell></TableRow> : overview.quizzes.map((quiz) => <TableRow key={quiz.id}><TableCell className="font-semibold">{quiz.title}</TableCell><TableCell>{typeof quiz.category === "string" ? quiz.category : (quiz.category as any)?.name || "-"}</TableCell><TableCell><Badge variant={quiz.completed ? "secondary" : "outline"}>{quiz.completed ? "Tamamlandı" : "Bekliyor"}</Badge></TableCell></TableRow>)}
                </TableBody></Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Trophy; label: string; value: string | number }) {
  return <Card><CardContent className="flex items-center gap-4 p-5"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10"><Icon className="h-5 w-5 text-primary" /></div><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="text-2xl font-black">{value}</p></div></CardContent></Card>;
}
