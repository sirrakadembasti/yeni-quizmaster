import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertCircle, BarChart3, CalendarDays, ClipboardList, Download, FileQuestion, ListChecks, Loader2, MessageSquareText, RefreshCcw, Star, Target, Users } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PrintButton, PrintMeta } from "@/components/print/PrintTools";
import { surveyApi, type SurveyQuestionResult, type SurveyResultSummary } from "@/lib/api";
import { downloadCsv } from "@/lib/export";

const COLORS = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6"];
const TYPE_LABELS: Record<string, string> = {
  "single-choice": "Tek seçim",
  "multiple-choice": "Çoklu seçim",
  "open-text": "Açık uçlu",
  rating: "Derecelendirme",
  likert: "Likert ölçeği",
};
const dateValue = (date: Date) => date.toISOString().slice(0, 10);
const percent = (value: number, total: number) => total > 0 ? Math.round((value / total) * 100) : 0;
const shorten = (value: string, max = 27) => value.length > max ? value.slice(0, max - 1) + "…" : value;

function EmptyData({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{text}</div>;
}

function ParticipationDonut({ survey }: { survey: SurveyResultSummary }) {
  const data = [
    { name: "Katılan", value: survey.participantCount },
    { name: "Bekleyen", value: Math.max(survey.audienceSize - survey.participantCount, 0) },
  ];
  return (
    <div className="relative h-36 w-36 shrink-0" aria-label={"Katılım oranı yüzde " + survey.participationRate}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={43} outerRadius={60}
            startAngle={90} endAngle={-270} paddingAngle={2} stroke="none" isAnimationActive={false}>
            <Cell fill="#6366f1" /><Cell fill="hsl(var(--muted))" />
          </Pie>
          <Tooltip formatter={(value) => [String(Number(value)) + " kişi", ""]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <strong className="text-xl tabular-nums">%{survey.participationRate}</strong>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Katılım</span>
      </div>
    </div>
  );
}

function OpenAnswerTable({ question }: { question: SurveyQuestionResult }) {
  if (!question.openAnswers?.length) return <EmptyData text="Bu soruya henüz açık uçlu yanıt verilmedi." />;
  return (
    <Table>
      <TableHeader><TableRow><TableHead className="w-40">Katılımcı</TableHead><TableHead>Yanıt</TableHead><TableHead className="w-40">Yanıt zamanı</TableHead></TableRow></TableHeader>
      <TableBody>{question.openAnswers.map((answer, index) => (
        <TableRow key={answer.studentName + answer.submittedAt + index}>
          <TableCell className="font-medium">{answer.studentName}</TableCell>
          <TableCell className="min-w-[280px] whitespace-pre-wrap leading-relaxed">{String(answer.value)}</TableCell>
          <TableCell className="text-xs text-muted-foreground">{new Date(answer.submittedAt).toLocaleString("tr-TR")}</TableCell>
        </TableRow>
      ))}</TableBody>
    </Table>
  );
}

function Distribution({ question }: { question: SurveyQuestionResult }) {
  const data = useMemo(() => {
    const values = [...(question.distribution || [])];
    if (question.type === "rating") values.sort((a, b) => Number(a.label) - Number(b.label));
    return values.map((item) => ({ ...item, rate: percent(item.count, question.responseCount) }));
  }, [question]);

  if (!question.responseCount || !data.length) {
    return <EmptyData text="Bu soru için henüz dağılım oluşturacak yanıt bulunmuyor." />;
  }

  return (
    <div className="survey-chart-table grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <div className="rounded-xl border bg-muted/15 p-2" style={{ height: Math.max(230, data.length * 48) }}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 28, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.35} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="label" width={125} tick={{ fontSize: 11 }}
              tickFormatter={(value) => shorten(String(value), 22)} />
            <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.45)" }}
              formatter={(value, _name, item) => [String(Number(value)) + " yanıt · %" + String(item?.payload?.rate ?? 0), "Dağılım"]} />
            <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={28} isAnimationActive={false}>
              {data.map((item, index) => <Cell key={item.label + index} fill={COLORS[index % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader><TableRow><TableHead>Seçenek</TableHead><TableHead className="w-20 text-right">Yanıt</TableHead><TableHead className="w-20 text-right">Oran</TableHead></TableRow></TableHeader>
          <TableBody>{data.map((item, index) => (
            <TableRow key={item.label + index}>
              <TableCell><div className="flex items-start gap-2">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <div className="min-w-0 flex-1"><span className="break-words font-medium">{item.label}</span><Progress value={item.rate} className="mt-1.5 h-1.5" /></div>
              </div></TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{item.count}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">%{item.rate}</TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
        {question.type === "multiple-choice" && <p className="border-t bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
          Birden fazla seçenek işaretlenebildiği için oranların toplamı %100'ü aşabilir.
        </p>}
      </div>
    </div>
  );
}

function QuestionCard({ question, index }: { question: SurveyQuestionResult; index: number }) {
  return (
    <section className="survey-question-card rounded-xl border bg-card">
      <div className="flex items-start gap-3 border-b bg-muted/20 p-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">{index + 1}</span>
        <div className="min-w-0"><h3 className="font-semibold leading-snug">{question.text}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="secondary">{TYPE_LABELS[question.type] || question.type}</Badge>
            <Badge variant="outline">{question.responseCount} yanıtlayan</Badge>
            {question.type === "rating" && question.averageValue != null && <Badge className="gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-300">
              <Star className="h-3 w-3 fill-current" /> Ortalama {question.averageValue}/{Number(question.config?.max || 5)}
            </Badge>}
          </div>
        </div>
      </div>
      <div className="p-3">{question.type === "open-text" ? <OpenAnswerTable question={question} /> : <Distribution question={question} />}</div>
    </section>
  );
}

function SurveyCard({ survey }: { survey: SurveyResultSummary }) {
  return (
    <Card className="survey-result-card overflow-hidden">
      <CardHeader className="border-b bg-gradient-to-r from-primary/[0.08] via-transparent to-transparent">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 flex-1"><CardTitle className="break-words text-xl">{survey.title}</CardTitle>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{new Date(survey.createdAt).toLocaleDateString("tr-TR")}</span>
              <span className="flex items-center gap-1.5"><FileQuestion className="h-4 w-4" />{survey.questionResults.length} soru</span>
              <span className="flex items-center gap-1.5"><Users className="h-4 w-4" />{survey.participantCount} / {survey.audienceSize} katılımcı</span>
            </div>
            <div className="mt-3 max-w-xl"><div className="mb-1 flex justify-between text-xs"><span>Katılım ilerlemesi</span><strong>%{survey.participationRate}</strong></div>
              <Progress value={survey.participationRate} className="h-2.5" /></div>
          </div>
          <ParticipationDonut survey={survey} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-3">{survey.questionResults.map((question, index) =>
        <QuestionCard key={question.id} question={question} index={index} />)}
      </CardContent>
    </Card>
  );
}

export default function SurveyResultsPage() {
  const initialStart = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return dateValue(date);
  }, []);
  const today = useMemo(() => dateValue(new Date()), []);
  const [surveyId, setSurveyId] = useState("all");
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(today);

  const listQuery = useQuery({ queryKey: ["survey-list"], queryFn: () => surveyApi.getSurveys() });
  const resultsQuery = useQuery({
    queryKey: ["survey-results", surveyId, startDate, endDate],
    queryFn: () => surveyApi.getResults({ surveyId, startDate, endDate }),
  });
  const selectedTitle = listQuery.data?.surveys.find((survey) => survey.id === surveyId)?.title || "Tüm anketler";
  const results = resultsQuery.data?.surveys || [];
  const totals = useMemo(() => {
    const participants = results.reduce((sum, item) => sum + item.participantCount, 0);
    const audience = results.reduce((sum, item) => sum + item.audienceSize, 0);
    return {
      participants,
      audience,
      rate: percent(participants, audience),
      questions: results.reduce((sum, item) => sum + item.questionResults.length, 0),
    };
  }, [results]);
  const comparison = useMemo(() => results.map((item) => ({
    title: shorten(item.title, 30),
    fullTitle: item.title,
    rate: item.participationRate,
    participants: item.participantCount,
    audience: item.audienceSize,
  })), [results]);

  const resetFilters = () => {
    setSurveyId("all");
    setStartDate(initialStart);
    setEndDate(today);
  };

  const exportCsv = () => {
    const rows: Array<{
      survey: string; question: string; type: string; option: string;
      count: number; rate: string; participant: string; responseDate: string; average: string;
    }> = [];
    results.forEach((survey) => survey.questionResults.forEach((question) => {
      if (question.type === "open-text") {
        (question.openAnswers || []).forEach((answer) => rows.push({
          survey: survey.title,
          question: question.text,
          type: TYPE_LABELS[question.type],
          option: String(answer.value),
          count: 1,
          rate: "",
          participant: answer.studentName,
          responseDate: new Date(answer.submittedAt).toLocaleString("tr-TR"),
          average: "",
        }));
      } else {
        (question.distribution || []).forEach((item) => rows.push({
          survey: survey.title,
          question: question.text,
          type: TYPE_LABELS[question.type] || question.type,
          option: item.label,
          count: item.count,
          rate: "%" + percent(item.count, question.responseCount),
          participant: `${question.responseCount} yanıtlayan`,
          responseDate: "",
          average: question.averageValue == null ? "" : String(question.averageValue),
        }));
      }
    }));

    downloadCsv({
      filename: `anket_sonuclari_${today}.csv`,
      title: "Anket Sonuçları",
      filters: [
        { label: "Anket", value: selectedTitle },
        { label: "Başlangıç", value: startDate },
        { label: "Bitiş", value: endDate },
        { label: "Toplam Katılım", value: totals.participants },
        { label: "Genel Katılım Oranı", value: `%${totals.rate}` },
      ],
      columns: [
        { header: "Anket", value: "survey" },
        { header: "Soru", value: "question" },
        { header: "Soru Türü", value: "type" },
        { header: "Seçenek / Yanıt", value: "option" },
        { header: "Yanıt Sayısı", value: "count" },
        { header: "Oran", value: "rate" },
        { header: "Ortalama", value: "average" },
        { header: "Katılımcı / Yanıtlayan", value: "participant" },
        { header: "Yanıt Tarihi", value: "responseDate" },
      ],
      rows,
    });
  };
  return (
    <DashboardLayout>
      <div className="page-stack print-landscape">
        <PrintMeta title="Anket Sonuçları" filters={[
          { label: "Anket", value: selectedTitle },
          { label: "Başlangıç", value: startDate },
          { label: "Bitiş", value: endDate },
        ]} />

        <div className="page-toolbar no-print print:hidden">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold"><ClipboardList className="h-7 w-7 text-primary" />Anket Sonuçları</h1>
            <p className="text-sm text-muted-foreground">Katılımı karşılaştırın; her soruyu grafik ve tabloyla birlikte inceleyin.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv} disabled={!results.length}><Download className="mr-2 h-4 w-4" />CSV</Button>
            <PrintButton />
          </div>
        </div>

        <Card className="no-print print:hidden">
          <CardContent className="grid gap-3 p-3 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-end">
            <div className="space-y-1.5"><Label>Anket</Label>
              <Select value={surveyId} onValueChange={setSurveyId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="all">Tüm anketler</SelectItem>
                {listQuery.data?.surveys.map((survey) => <SelectItem key={survey.id} value={survey.id}>{survey.title}</SelectItem>)}
              </SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label>Başlangıç</Label><Input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} /></div>
            <div className="space-y-1.5"><Label>Bitiş</Label><Input type="date" value={endDate} min={startDate} max={today} onChange={(event) => setEndDate(event.target.value)} /></div>
            <Button variant="ghost" onClick={resetFilters}><RefreshCcw className="mr-2 h-4 w-4" />Sıfırla</Button>
          </CardContent>
        </Card>

        {resultsQuery.isLoading ? (
          <Card><CardContent className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />Sonuçlar hazırlanıyor...
          </CardContent></Card>
        ) : resultsQuery.isError ? (
          <Card className="border-destructive/40"><CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div><p className="font-semibold">Anket sonuçları alınamadı</p><p className="text-sm text-muted-foreground">Bağlantıyı kontrol edip tekrar deneyin.</p></div>
            <Button variant="outline" onClick={() => resultsQuery.refetch()}>Tekrar Dene</Button>
          </CardContent></Card>
        ) : !results.length ? (
          <Card className="border-dashed"><CardContent className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
            <ClipboardList className="h-10 w-10 opacity-50" />
            <p className="font-medium text-foreground">Bu filtrelerde sonuç bulunamadı</p>
            <p className="text-sm">Tarih aralığını veya seçili anketi değiştirin.</p>
          </CardContent></Card>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Görüntülenen Anket", value: results.length, detail: selectedTitle, icon: ClipboardList, color: "text-indigo-500" },
                { label: "Toplam Katılım", value: totals.participants, detail: "Filtrelenen yanıtlama sayısı", icon: Users, color: "text-cyan-500" },
                { label: "Hedef Katılımcı", value: totals.audience, detail: "Anketlere atanmış öğrenci", icon: Target, color: "text-emerald-500" },
                { label: "Genel Katılım Oranı", value: "%" + totals.rate, detail: totals.questions + " soru analiz edildi", icon: BarChart3, color: "text-amber-500" },
              ].map((item) => (
                <Card key={item.label} className="print-break-avoid"><CardContent className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums">{item.value}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  <item.icon className={"h-6 w-6 shrink-0 " + item.color} />
                </CardContent></Card>
              ))}
            </div>

            {comparison.length > 1 && (
              <Card className="print-break-avoid">
                <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base">
                  <ListChecks className="h-5 w-5 text-primary" />Anketlere Göre Katılım Karşılaştırması
                </CardTitle></CardHeader>
                <CardContent><div style={{ height: Math.max(230, comparison.length * 52) }}>
                  <ResponsiveContainer><BarChart data={comparison} layout="vertical" margin={{ top: 8, right: 35, bottom: 8, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.35} />
                    <XAxis type="number" domain={[0, 100]} unit="%" />
                    <YAxis type="category" dataKey="title" width={150} tick={{ fontSize: 11 }} />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0].payload as (typeof comparison)[number];
                      return <div className="rounded-lg border bg-background p-2 text-xs shadow-lg">
                        <p className="font-semibold">{item.fullTitle}</p>
                        <p className="mt-1 text-muted-foreground">{item.participants}/{item.audience} kişi · %{item.rate}</p>
                      </div>;
                    }} />
                    <Bar dataKey="rate" fill="#6366f1" radius={[0, 6, 6, 0]} maxBarSize={30} isAnimationActive={false} />
                  </BarChart></ResponsiveContainer>
                </div></CardContent>
              </Card>
            )}

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageSquareText className="h-4 w-4" />Grafiklerde adet ve oran birlikte gösterilir; ayrıntılı değerler yan tablodadır.
            </div>
            {results.map((survey) => <SurveyCard key={survey.id} survey={survey} />)}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
