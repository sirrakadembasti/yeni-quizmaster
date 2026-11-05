import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { parentApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Eye, Users, XCircle } from "lucide-react";

export default function ParentResultsPage() {
  const [location, navigate] = useLocation();
  const search = useSearch();
  const requestedStudentId = new URLSearchParams(search).get("studentId") || "";
  const [selection, setSelection] = useState<{ studentId: string; resultId: string } | null>(null);
  const studentsQuery = useQuery({ queryKey: ["parent", "students"], queryFn: parentApi.getStudents });
  const students = studentsQuery.data?.students || [];
  const studentId = students.find(student => student.id === requestedStudentId)?.id || students[0]?.id || "";
  const selectStudent = (id: string, replace = false) => {
    setSelection(null);
    const params = new URLSearchParams(search);
    if (id) params.set("studentId", id); else params.delete("studentId");
    navigate(`${location}${params.size ? `?${params}` : ""}`, { replace });
  };
  useEffect(() => {
    if (studentsQuery.isSuccess && requestedStudentId && requestedStudentId !== studentId) selectStudent(studentId, true);
  }, [studentsQuery.isSuccess, requestedStudentId, studentId, search, location]);
  useEffect(() => { setSelection(null); }, [studentId]);

  const overviewQuery = useQuery({
    queryKey: ["parent", "overview", studentId],
    queryFn: () => parentApi.getStudentOverview(studentId),
    enabled: studentsQuery.isSuccess && Boolean(studentId),
  });
  const overview = overviewQuery.data;
  const results = overview?.student.id === studentId ? overview.results || [] : [];
  const resultId = selection?.studentId === studentId ? selection.resultId : "";
  const detailQuery = useQuery({
    queryKey: ["parent", "result", studentId, resultId],
    queryFn: () => parentApi.getResult(resultId),
    enabled: studentsQuery.isSuccess && overviewQuery.isSuccess && Boolean(resultId) && results.some(result => result.id === resultId),
  });
  const loading = (message: string) => <Card><CardContent role="status" className="p-6 text-center text-muted-foreground">{message}</CardContent></Card>;
  const failure = (message: string, error: unknown, retry: () => unknown, pending: boolean) => (
    <Card role="alert"><CardContent className="space-y-3 p-6 text-center"><p>{message} {error instanceof Error ? error.message : "Lütfen tekrar deneyin."}</p><Button variant="outline" disabled={pending} onClick={retry}>Tekrar dene</Button></CardContent></Card>
  );

  let content;
  if (studentsQuery.isLoading) content = loading("Öğrenciler yükleniyor...");
  else if (studentsQuery.isError) content = failure("Öğrenci listesi getirilemedi.", studentsQuery.error, () => studentsQuery.refetch(), studentsQuery.isFetching);
  else if (students.length === 0) content = <Card><CardContent className="flex flex-col items-center gap-3 py-14 text-center"><Users className="h-10 w-10 text-muted-foreground" /><h2 className="font-bold">Hesabınıza bağlı öğrenci bulunmuyor</h2><p className="text-sm text-muted-foreground">Okul yöneticinizden veli hesabınızı öğrenciyle ilişkilendirmesini isteyin.</p></CardContent></Card>;
  else if (overviewQuery.isError) content = failure("Öğrenci bilgileri getirilemedi.", overviewQuery.error, () => overviewQuery.refetch(), overviewQuery.isFetching);
  else if (!overview || overview.student.id !== studentId) content = loading("Sınav sonuçları yükleniyor...");
  else if (resultId) {
    const back = <Button variant="ghost" onClick={() => setSelection(null)}><ArrowLeft className="mr-2 h-4 w-4" />Sonuç listesine dön</Button>;
    if (detailQuery.isError) content = <div className="space-y-4">{back}{failure("Sonuç detayları getirilemedi.", detailQuery.error, () => detailQuery.refetch(), detailQuery.isFetching)}</div>;
    else if (!detailQuery.data || !("studentId" in detailQuery.data.result) || detailQuery.data.result.studentId !== studentId) content = <div className="space-y-4">{back}{loading("Sonuç detayları yükleniyor...")}</div>;
    else content = <ResultDetail data={detailQuery.data} onBack={() => setSelection(null)} />;
  } else content = (
    <Card>
      <CardHeader><CardTitle>Tamamlanan Sınavlar</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table><TableHeader><TableRow><TableHead>Sınav</TableHead><TableHead>Ders</TableHead><TableHead>Puan</TableHead><TableHead>Tarih</TableHead><TableHead className="text-right">İşlem</TableHead></TableRow></TableHeader><TableBody>
          {results.length === 0 ? <TableRow><TableCell colSpan={5} className="h-28 text-center text-muted-foreground">Tamamlanmış sınav bulunmuyor.</TableCell></TableRow> : results.map(result => (
            <TableRow key={result.id}>
              <TableCell className="font-bold">{result.quiz?.title || result.quizTitle || "Sınav"}</TableCell>
              <TableCell>{typeof result.quiz?.category === "string" ? result.quiz.category : (result.quiz?.category as any)?.name || "-"}</TableCell>
              <TableCell><Badge>%{result.score ?? 0}</Badge></TableCell>
              <TableCell>{result.submittedAt ? new Date(result.submittedAt).toLocaleDateString("tr-TR") : "-"}</TableCell>
              <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setSelection({ studentId, resultId: result.id })}><Eye className="mr-2 h-4 w-4" />Detay</Button></TableCell>
            </TableRow>
          ))}
        </TableBody></Table>
      </CardContent>
    </Card>
  );

  return <DashboardLayout><div className="space-y-5">
    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
      <div><h1 className="text-3xl font-black">Sınav Sonuçları</h1><p className="text-muted-foreground">Bağlı öğrencilerinizin sınav listesini ve cevap detaylarını görüntüleyin.</p></div>
      {studentsQuery.isSuccess && students.length > 0 && <Select value={studentId} onValueChange={selectStudent}><SelectTrigger aria-label="Öğrenci seçin" className="w-full md:w-72"><SelectValue placeholder="Öğrenci seçin" /></SelectTrigger><SelectContent>{students.map(student => <SelectItem key={student.id} value={student.id}>{student.name} · {student.class?.name || "Sınıfsız"}</SelectItem>)}</SelectContent></Select>}
    </div>
    {content}
  </div></DashboardLayout>;
}

function ResultDetail({ data, onBack }: { data: any; onBack: () => void }) {
  return <div className="space-y-4">
    <Button variant="ghost" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" />Sonuç listesine dön</Button>
    <Card><CardHeader><CardTitle>{data.quiz.title}</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-3"><Badge>Puan: %{data.result.score ?? 0}</Badge><Badge variant="outline">Doğru: {data.result.correctAnswersCount ?? 0}/{data.result.totalQuestions ?? data.questions.length}</Badge></CardContent></Card>
    <div className="space-y-3">{data.questions.map((question: any, index: number) => {
      const unanswered = question.studentAnswer == null || question.studentAnswer === "";
      return <Card key={question.id}><CardContent className="p-4"><div className="flex gap-3">
        {question.isCorrect ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <XCircle className="h-5 w-5 shrink-0 text-rose-600" />}
        <div className="min-w-0 space-y-2">
          <div className="break-words font-bold">{index + 1}. {question.text}</div>
          <p className="text-sm font-semibold">Yanıt durumu: {unanswered ? "Yanıtsız" : question.isCorrect ? "Doğru" : "Yanlış"}</p>
          {question.imageUrl && <QuestionImage source={question.imageUrl} number={index + 1} />}
          <div className="break-words text-sm"><span className="text-muted-foreground">Öğrencinin cevabı:</span> {String(question.studentAnswer ?? "Cevap yok")}</div>
          <div className="break-words text-sm"><span className="text-muted-foreground">Doğru cevap:</span> {String(question.correctAnswer ?? "-")}</div>
        </div>
      </div></CardContent></Card>;
    })}</div>
  </div>;
}

function QuestionImage({ source, number }: { source: string; number: number }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  // Raster data images and existing upload paths are supported. SVG/HTML data
  // and executable schemes must not become image sources in result review.
  const allowed = /^data:image\/(?:png|jpe?g|gif|webp|bmp|avif);base64,[A-Za-z0-9+/=\s]+$/i.test(source)
    || /^\/?(?:[^?#:]+\/)*uploads\/[^?#]+(?:[?#].*)?$/.test(source)
    || /^https?:\/\//i.test(source);
  if (!allowed || failedSource === source) return <p role="status" className="text-sm text-muted-foreground">Soru {number} görseli yüklenemedi.</p>;
  return <img src={source} alt={`Soru ${number} görseli`} className="my-3 max-h-96 max-w-full rounded-lg object-contain" onError={() => setFailedSource(source)} />;
}
