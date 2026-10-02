import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { classApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ArrowLeft, 
  Users, 
  BookOpen,
  Mail,
  ShieldCheck,
  Search,
  GraduationCap,
  Printer,
  Download
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
import { downloadCsv } from "@/lib/export";
import { PrintMeta } from "@/components/print/PrintTools";

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

  const exportStudents = () => downloadCsv({
    filename: `${cls?.name || "sinif"}-ogrenci-listesi.csv`,
    title: `${cls?.name || "Sınıf"} Öğrenci Listesi`,
    filters: [
      { label: "Sorumlu öğretmen", value: cls?.classTeacher?.name || "Atanmamış" },
      { label: "Öğrenci sayısı", value: filteredStudents.length },
      { label: "Arama", value: searchTerm || "Tümü" },
    ],
    rows: filteredStudents,
    columns: [
      { header: "Sıra", value: (_row: any, index: number) => index + 1 },
      { header: "Öğrenci Adı Soyadı", value: (row: any) => row.name },
      { header: "Sınıf No", value: (row: any) => row.studentNo || "-" },
      { header: "E-posta", value: (row: any) => row.email || "-" },
    ],
  });
  const handlePrint = () => {
    window.print();
  };

  if (classLoading) return <div className="flex h-screen items-center justify-center font-bold text-muted-foreground animate-pulse">Sınıf verileri yükleniyor...</div>;
  if (!cls) return <div className="p-8 text-center font-black text-red-500">Sınıf bulunamadı.</div>;

  return (
    <DashboardLayout>
      <div className="space-y-8 print-content">
        <PrintMeta title="Sınıf Öğrenci Listesi" filters={[
          { label: "Sınıf", value: cls.name },
          { label: "Sorumlu öğretmen", value: cls.classTeacher?.name || "Atanmamış" },
          { label: "Öğrenci sayısı", value: filteredStudents.length },
          { label: "Arama", value: searchTerm || "Tümü" },
        ]} />
        {/* Header Section — hidden on print */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild className="rounded-xl border-2 border-border">
              <Link href="/classlist" aria-label="Sınıf listesine dön"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div>
              <h1 className="text-4xl font-black text-foreground tracking-tighter">{cls.name}</h1>
              <p className="text-muted-foreground font-semibold">{cls.description || "Genel Akademik Sınıf Görünümü"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={exportStudents}
              variant="outline"
              className="rounded-xl border-2 border-emerald-600 text-emerald-700 font-black gap-2"
            >
              <Download className="h-4 w-4" /> Excel
            </Button>
            <Button 
              onClick={handlePrint}
              variant="outline" 
              className="rounded-xl border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-black gap-2 transition-all active:scale-95"
            >
              <Printer className="h-4 w-4" />
              Yazdır
            </Button>
            <Badge className="px-6 py-2 rounded-full font-black text-lg bg-indigo-600 text-white shadow-xl shadow-indigo-100 dark:shadow-none">
              {initialStudents.length} Öğrenci
            </Badge>
          </div>
        </header>

        {/* TOP SECTION: TEACHERS (Rich View) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          {/* Class Teacher Card */}
          <Card className="rounded-2xl border-2 border-indigo-600 bg-indigo-600 text-white shadow-md dark:shadow-none overflow-hidden card-print">
            <CardHeader className="p-3 sm:p-3.5 pb-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md no-print">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Sorumlu Öğretmen</CardTitle>
                  <h3 className="text-base font-black mt-0.5 leading-tight">{cls.classTeacher?.name || "Atanmamış"}</h3>        
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-3.5 pt-0">
              <div className="bg-white/10 p-2 rounded-lg border border-white/10 backdrop-blur-sm flex items-center gap-2">    
                <Mail className="h-3.5 w-3.5 opacity-70" />
                <span className="text-xs font-bold truncate">{cls.classTeacher?.email || "E-posta belirtilmemiş"}</span>     
              </div>
            </CardContent>
          </Card>

          {/* Subject Teachers Grid */}
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {cls.teacherAssignments && cls.teacherAssignments.length > 0 ? (
              cls.teacherAssignments.map((ta: any) => (
                <Card key={ta.id} className="rounded-2xl border border-border bg-card hover:border-indigo-500 transition-all group overflow-hidden card-print">
                  <div className="p-2.5 sm:p-3 flex items-center gap-3">
                    <div className="h-9 w-9 bg-muted group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950 rounded-xl flex items-center justify-center border border-border group-hover:border-indigo-200 transition-colors print:hidden">
                      <BookOpen className="h-4 w-4 text-muted-foreground group-hover:text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest truncate">{ta.category?.name || ta.course?.name || "Ders Bilgisi"}</p>   
                      <h4 className="text-sm font-black text-foreground leading-tight mt-0.5 truncate">{ta.teacher?.name || "Bilinmeyen Öğretmen"}</h4>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <div className="col-span-full h-full flex flex-col items-center justify-center bg-muted/30 border border-dashed border-border rounded-2xl p-4 text-muted-foreground font-bold italic text-xs">
                <GraduationCap className="h-6 w-6 mb-1 opacity-20" />
                Henüz branş öğretmeni atanmamış.
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM SECTION: STUDENTS LIST TABLE */}
        <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden card-print">
          <CardHeader className="bg-muted/30 border-b border-border py-2.5 px-4 print:hidden">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">       
                  <Users className="h-4 w-4" />
                </div>
                <CardTitle className="text-lg font-black tracking-tight">Sınıf Mevcudu</CardTitle>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  aria-label="Sınıf öğrencilerini ara"
                  placeholder="Öğrenci ismine göre filtrele..."
                  className="pl-9 h-8 rounded-lg border border-border bg-background focus:border-indigo-500 text-xs"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          
          {/* Print Title (Visible only when printing) */}
          <div className="hidden print:block p-4 text-center border-b mb-3">
            <h2 className="text-2xl font-black tracking-tighter uppercase">{cls.name} ÖĞRENCİ LİSTESİ</h2>
            <p className="text-muted-foreground font-bold text-xs">{new Date().toLocaleDateString('tr-TR')} tarihinde oluşturuldu</p>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50 border-b border-border">
                <TableRow>
                  <TableHead className="pl-4 font-black text-[10px] uppercase tracking-widest py-2 w-16 text-center">S.No</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest py-2">Öğrenci Adı Soyadı</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest py-2 text-right pr-4">Sınıf No</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="h-32 text-center text-muted-foreground italic font-black text-sm">Bu sınıfta kayıtlı öğrenci bulunamadı.</TableCell></TableRow>
                ) : (
                  filteredStudents.map((s: any, index: number) => (
                    <TableRow key={s.id} className="hover:bg-muted/30 border-border transition-colors group">
                      <TableCell className="pl-4 py-2 font-bold text-muted-foreground text-center text-xs">{index + 1}</TableCell>
                      <TableCell className="py-2">
                        <span className="font-bold text-sm text-foreground tracking-tight">{s.name}</span>
                      </TableCell>
                      <TableCell className="text-right pr-4 py-2">
                        <Badge variant="outline" className="rounded-md font-black text-xs bg-background border px-2 py-0.5">{s.studentNo || "YOK"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          <div className="hidden print:block p-8 mt-12 border-t-2">
            <div className="flex justify-between">
              <div className="text-center w-48">
                <p className="font-bold border-b pb-12 mb-2">Sınıf Öğretmeni</p>
                <p>{cls.classTeacher?.name || "................"}</p>
              </div>
              <div className="text-center w-48">
                <p className="font-bold border-b pb-12 mb-2">Okul Müdürü</p>
                <p>................</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
