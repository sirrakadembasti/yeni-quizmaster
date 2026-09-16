import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PrintButton, PrintMeta } from "@/components/print/PrintTools";
import { analyticsApi, classApi } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { BarChart3, Users, CheckCircle2, TrendingUp, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function ClassStatisticsPage() {
  const { user, role } = useAuth();
  useEffect(() => {
    document.title = "Sınıf İstatistikleri | Quiz Master";
  }, []);
  const initialStart = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return dateInputValue(date);
  }, []);
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(dateInputValue(new Date()));
  const [classId, setClassId] = useState("all");

  const classesQuery = useQuery({
    queryKey: ["statistics-classes", user?.id, role],
    queryFn: () => classApi.getAllClasses(),
    enabled: Boolean(user),
  });

  const analyticsQuery = useQuery({
    queryKey: ["class-analytics", user?.id, role, classId, startDate, endDate],
    queryFn: () => analyticsApi.getClassAnalytics({ classId, startDate, endDate }),
    enabled: Boolean(user && startDate && endDate),
  });

  const selectedClass = classesQuery.data?.classes.find((item) => item.id === classId)?.name;
  const data = analyticsQuery.data?.classes || [];

  // KPI Calculations
  const totals = useMemo(() => {
    if (data.length === 0) {
      return { totalStudents: 0, totalParticipants: 0, avgParticipation: 0, avgScore: 0 };
    }
    const totalStudents = data.reduce((acc, c) => acc + c.studentCount, 0);
    const totalParticipants = data.reduce((acc, c) => acc + c.participantCount, 0);
    const avgParticipation = Math.round(data.reduce((acc, c) => acc + c.participationRate, 0) / data.length);
    const avgScore = Math.round(data.reduce((acc, c) => acc + c.averageScore, 0) / data.length);
    return { totalStudents, totalParticipants, avgParticipation, avgScore };
  }, [data]);

  return (
    <DashboardLayout>
      <div className="page-stack pb-8">
        <PrintMeta
          title={"Sınıf İstatistikleri"}
          filters={[
            { label: "Baslangic", value: startDate },
            { label: "Bitis", value: endDate },
            { label: "Sinif", value: selectedClass || "Tum siniflar" },
          ]}
        />

        <div className="page-toolbar print:hidden no-print">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <BarChart3 className="h-7 w-7 text-primary" />
              Sınıf İstatistikleri
            </h1>
            <p className="text-sm text-muted-foreground">Yetkili sınıfların katılım ve başarı analizi.</p>
          </div>
          <PrintButton />
        </div>

        {/* Filters */}
        <Card className="print:hidden no-print">
          <CardContent className="grid gap-3 p-3.5 sm:p-4 md:grid-cols-3">
            <div className="section-stack">
              <Label htmlFor="stats-start" className="text-xs font-semibold">Başlangıç Tarihi</Label>
              <Input id="stats-start" type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div className="section-stack">
              <Label htmlFor="stats-end" className="text-xs font-semibold">Bitiş Tarihi</Label>
              <Input id="stats-end" type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
            <div className="section-stack">
              <Label className="text-xs font-semibold">Sınıf Seçimi</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Sınıflar</SelectItem>
                  {classesQuery.data?.classes.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Toplam Öğrenci</p>
                <p className="text-xl font-bold text-foreground">{totals.totalStudents}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Katılımcı</p>
                <p className="text-xl font-bold text-foreground">{totals.totalParticipants}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Katılım Oranı</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">%{totals.avgParticipation}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Ortalama Başarı</p>
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400">%{totals.avgScore}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              {selectedClass ? `${selectedClass} Sınıfı Analizi` : "Sınıf Analiz Grafiği"}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[320px] p-2 sm:p-4">
            {analyticsQuery.isLoading ? (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm">Veriler yükleniyor...</div>
            ) : data.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed text-center text-muted-foreground text-sm">
                Seçilen kriterlerde gösterilecek veri bulunamadı.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} barGap={6} barCategoryGap="20%" margin={{ top: 12, right: 16, left: -10, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.4} />
                  <XAxis dataKey="className" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                  <Tooltip 
                    formatter={(value: any, name: any) => [`%${value}`, name]}
                    contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                  <Bar dataKey="participationRate" name="Katılım Oranı" fill="#6366f1" maxBarSize={38} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="averageScore" name="Ortalama Başarı" fill="#10b981" maxBarSize={38} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Per-Class Detailed Breakdown */}
        {data.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Sınıf Bazında Detaylar</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.map((c) => (
                <Card key={c.classId} className="border-border/60 hover:shadow-sm transition-shadow">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base font-bold text-foreground">{c.className}</CardTitle>
                    <Badge variant="outline" className="text-xs font-semibold">
                      {c.studentCount} Öğrenci
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-2.5 text-xs">
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Sınava Katılan:</span>
                      <span className="font-semibold text-foreground">{c.participantCount} öğrenci</span>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-muted-foreground">Katılım Oranı:</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">%{c.participationRate}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${Math.min(c.participationRate, 100)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-muted-foreground">Ortalama Başarı:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">%{c.averageScore}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div className="bg-emerald-600 h-1.5 rounded-full" style={{ width: `${Math.min(c.averageScore, 100)}%` }} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
