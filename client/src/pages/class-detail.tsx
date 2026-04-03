import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { classApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  ArrowLeft, 
  Users, 
  BookOpen, 
  Mail,
  ShieldCheck,
  Search,
  GraduationCap
} from "lucide-react";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: classData, isLoading: classLoading } = useQuery({
    queryKey: ['classes', id],
    queryFn: () => classApi.getClass(id as string),
    enabled: !!id,
  });

  const cls = classData?.class;
  const initialStudents = classData?.students || [];

  const filteredStudents = useMemo(() => 
    initialStudents.filter((s: any) => s.name.toLowerCase().includes(searchTerm.toLowerCase())), 
    [initialStudents, searchTerm]
  );

  if (classLoading) return <div className="flex h-screen items-center justify-center font-bold text-muted-foreground animate-pulse">Sınıf verileri yükleniyor...</div>;
  if (!cls) return <div className="p-8 text-center font-black text-red-500">Sınıf bulunamadı.</div>;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild className="rounded-xl border-2 border-border">
              <Link href="/classlist"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div>
              <h1 className="text-4xl font-black text-foreground tracking-tighter">{cls.name}</h1>
              <p className="text-muted-foreground font-semibold">{cls.description || "Genel Akademik Sınıf Görünümü"}</p>
            </div>
          </div>
          <Badge className="px-6 py-2 rounded-full font-black text-lg bg-indigo-600 text-white shadow-xl shadow-indigo-100 dark:shadow-none">
            {initialStudents.length} Öğrenci
          </Badge>
        </header>

        {/* TOP SECTION: TEACHERS (Rich View) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Class Teacher Card */}
          <Card className="rounded-[2rem] border-2 border-indigo-600 bg-indigo-600 text-white shadow-2xl shadow-indigo-200 dark:shadow-none overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                  <ShieldCheck className="h-8 w-8" />
                </div>
                <div>
                  <CardTitle className="text-xs font-black uppercase tracking-[0.2em] opacity-80">Sorumlu Öğretmen</CardTitle>
                  <h3 className="text-xl font-black mt-1 leading-tight">{cls.classTeacher?.name || "Atanmamış"}</h3>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-white/10 p-3 rounded-xl border border-white/10 backdrop-blur-sm flex items-center gap-2">
                <Mail className="h-4 w-4 opacity-70" />
                <span className="text-sm font-bold truncate">{cls.classTeacher?.email || "E-posta belirtilmemiş"}</span>
              </div>
            </CardContent>
          </Card>

          {/* Subject Teachers Grid */}
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cls.teacherAssignments?.map((ta: any) => (
              <Card key={ta.id} className="rounded-3xl border-2 border-border bg-card hover:border-indigo-500 transition-all group overflow-hidden">
                <div className="p-5 flex items-center gap-4">
                  <div className="h-12 w-12 bg-muted group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950 rounded-2xl flex items-center justify-center border-2 border-border group-hover:border-indigo-200 transition-colors">
                    <BookOpen className="h-6 w-6 text-muted-foreground group-hover:text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">{ta.category?.name}</p>
                    <h4 className="text-base font-black text-foreground leading-tight mt-0.5">{ta.teacher?.name}</h4>
                  </div>
                </div>
              </Card>
            ))}
            {(!cls.teacherAssignments || cls.teacherAssignments.length === 0) && (
              <div className="col-span-full h-full flex flex-col items-center justify-center bg-muted/30 border-2 border-dashed border-border rounded-3xl p-8 text-muted-foreground font-bold italic">
                <GraduationCap className="h-8 w-8 mb-2 opacity-20" />
                Henüz branş öğretmeni atanmamış.
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM SECTION: STUDENTS LIST TABLE */}
        <Card className="rounded-[2.5rem] border-2 border-border bg-card shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 border-b-2 border-border py-6 px-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
                  <Users className="h-6 w-6" />
                </div>
                <CardTitle className="text-2xl font-black tracking-tight">Sınıf Mevcudu</CardTitle>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Öğrenci ismine göre filtrele..." 
                  className="pl-10 h-10 rounded-xl border-2 border-border bg-background focus:border-indigo-500"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50 border-b-2 border-border">
                <TableRow>
                  <TableHead className="pl-8 font-black text-xs uppercase tracking-widest py-5">Öğrenci Profili</TableHead>
                  <TableHead className="font-black text-xs uppercase tracking-widest py-5">Okul Numarası</TableHead>
                  <TableHead className="font-black text-xs uppercase tracking-widest py-5">İletişim Bilgisi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="h-48 text-center text-muted-foreground italic font-black text-lg">Bu sınıfta kayıtlı öğrenci bulunamadı.</TableCell></TableRow>
                ) : (
                  filteredStudents.map((s: any) => (
                    <TableRow key={s.id} className="hover:bg-muted/30 border-border transition-colors group">
                      <TableCell className="pl-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-sm shadow-lg group-hover:scale-110 transition-transform">
                            {s.name[0].toUpperCase()}
                          </div>
                          <span className="font-black text-lg text-foreground">{s.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-lg font-black text-sm bg-background border-2">{s.studentNo || "YOK"}</Badge>
                      </TableCell>
                      <TableCell className="text-sm font-bold text-muted-foreground italic">{s.email}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
