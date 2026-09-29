import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { parentApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Eye, XCircle } from "lucide-react";

export default function ParentResultsPage() {
  const [studentId, setStudentId] = useState("");
  const [resultId, setResultId] = useState("");
  const studentsQuery = useQuery({ queryKey: ["parent", "students"], queryFn: parentApi.getStudents });
  const students = studentsQuery.data?.students || [];
  useEffect(() => { if (!studentId && students[0]?.id) setStudentId(students[0].id); }, [studentId, students]);
  const overviewQuery = useQuery({ queryKey: ["parent", "overview", studentId], queryFn: () => parentApi.getStudentOverview(studentId), enabled: Boolean(studentId) });
  const detailQuery = useQuery({ queryKey: ["parent", "result", resultId], queryFn: () => parentApi.getResult(resultId), enabled: Boolean(resultId) });
  const results = overviewQuery.data?.results || [];
  return <DashboardLayout><div className="space-y-5"><div className="flex flex-col justify-between gap-3 md:flex-row md:items-end"><div><h1 className="text-3xl font-black">Sınav Sonuçları</h1><p className="text-muted-foreground">Bağlı öğrencilerinizin sınav listesini ve cevap detaylarını görüntüleyin.</p></div>{students.length > 0 && <Select value={studentId} onValueChange={(value) => { setStudentId(value); setResultId(""); }}><SelectTrigger className="w-full md:w-72"><SelectValue placeholder="Öğrenci seçin" /></SelectTrigger><SelectContent>{students.map((student) => <SelectItem key={student.id} value={student.id}>{student.name} · {student.class?.name || "Sınıfsız"}</SelectItem>)}</SelectContent></Select>}</div>{resultId && detailQuery.data ? <ResultDetail data={detailQuery.data} onBack={() => setResultId("")} /> : <Card><CardHeader><CardTitle>Tamamlanan Sınavlar</CardTitle></CardHeader><CardContent className="overflow-x-auto p-0"><Table><TableHeader><TableRow><TableHead>Sınav</TableHead><TableHead>Ders</TableHead><TableHead>Puan</TableHead><TableHead>Tarih</TableHead><TableHead className="text-right">İşlem</TableHead></TableRow></TableHeader><TableBody>{results.length === 0 ? <TableRow><TableCell colSpan={5} className="h-28 text-center text-muted-foreground">Tamamlanmış sınav bulunmuyor.</TableCell></TableRow> : results.map((result) => <TableRow key={result.id}><TableCell className="font-bold">{result.quiz?.title || result.quizTitle || "Sınav"}</TableCell><TableCell>{typeof result.quiz?.category === "string" ? result.quiz.category : (result.quiz?.category as any)?.name || "-"}</TableCell><TableCell><Badge>%{result.score ?? 0}</Badge></TableCell><TableCell>{result.submittedAt ? new Date(result.submittedAt).toLocaleDateString("tr-TR") : "-"}</TableCell><TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setResultId(result.id)}><Eye className="mr-2 h-4 w-4" />Detay</Button></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>}</div></DashboardLayout>;
}

function ResultDetail({ data, onBack }: { data: any; onBack: () => void }) {
  return <div className="space-y-4"><Button variant="ghost" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" />Sonuç listesine dön</Button><Card><CardHeader><CardTitle>{data.quiz.title}</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-3"><Badge>Puan: %{data.result.score ?? 0}</Badge><Badge variant="outline">Doğru: {data.result.correctAnswersCount ?? 0}/{data.result.totalQuestions ?? data.questions.length}</Badge></CardContent></Card><div className="space-y-3">{data.questions.map((question: any, index: number) => <Card key={question.id}><CardContent className="p-4"><div className="flex gap-3">{question.isCorrect ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <XCircle className="h-5 w-5 text-rose-600" />}<div className="space-y-2"><div className="font-bold">{index + 1}. {question.text}</div><div className="text-sm"><span className="text-muted-foreground">Öğrencinin cevabı:</span> {String(question.studentAnswer ?? "Cevap yok")}</div><div className="text-sm"><span className="text-muted-foreground">Doğru cevap:</span> {String(question.correctAnswer ?? "-")}</div></div></div></CardContent></Card>)}</div></div>;
}
