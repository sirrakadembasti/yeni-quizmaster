import { AdminQueryState } from "@/components/management/AdminQueryState";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2,
  Layers,
  Search,
  Eye,
  Users,
  Download
} from "lucide-react";
import { useState, useMemo } from "react";
import { classApi, userApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { PrintButton, PrintMeta } from "@/components/print/PrintTools";
import { downloadCsv } from "@/lib/export";

export default function ClassesPage() {
  const { role } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");

  const classesQuery = useQuery({
    queryKey: ['/api/classes'],
    queryFn: () => role === 'admin' ? classApi.getAllClasses() : classApi.getTeacherClasses(),
  });

  const usersQuery = useQuery({
    queryKey: ['/api/users'],
    queryFn: () => userApi.getAllUsers(),
  });

  const { data: classesData, isLoading: isClassesLoading } = classesQuery;
  const { data: usersData } = usersQuery;

  const classes = classesData?.classes || [];
  const students = usersData?.users.filter(u => u.role === 'student') || [];

  const filteredClasses = useMemo(() => {
    return classes.filter(cls => cls.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [classes, searchTerm]);

  const exportClasses = () => downloadCsv({
    filename: `sinif_listesi_${new Date().toISOString().slice(0, 10)}.csv`,
    title: role === "admin" ? "Okul Sınıfları" : "Sınıflarım",
    filters: [{ label: "Arama", value: searchTerm || "Tümü" }, { label: "Kayıt Sayısı", value: filteredClasses.length }],
    columns: [
      { header: "Sınıf", value: "name" },
      { header: "Açıklama", value: "description" },
      { header: "Öğrenci Sayısı", value: (item: any) => students.filter((student) => student.classId === item.id).length },
      { header: "Sorumlu Öğretmen", value: (item: any) => item.classTeacher?.name || "Atanmamış" },
      { header: "Sorumlu Öğretmen E-postası", value: (item: any) => item.classTeacher?.email || "" },
    ],
    rows: filteredClasses,
  });
  const pageQueries = [classesQuery, usersQuery];
  if (pageQueries.some(query => query.isPending || query.isError)) return <DashboardLayout><AdminQueryState queries={pageQueries} /></DashboardLayout>;
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PrintMeta title={role === "admin" ? "Okul Sınıfları" : "Sınıflarım"} filters={[{ label: "Arama", value: searchTerm || "Tümü" }]} />
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-heading font-bold tracking-tight text-foreground">
              <div className="rounded-xl bg-primary/10 p-2 text-primary ring-1 ring-primary/15">
                <Layers className="h-6 w-6" />
              </div>
              {role === 'admin' ? 'Okul Sınıfları' : 'Sınıflarım'}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {role === 'admin' ? 'Tüm akademik sınıfları ve atamaları izleyin.' : 'Sorumlu olduğunuz ve branş verdiğiniz derslikler.'}
            </p>
          </div>
          <div className="flex gap-2 print:hidden no-print">
            <Button variant="outline" onClick={exportClasses} disabled={!filteredClasses.length} className="gap-2 rounded-xl font-semibold"><Download className="h-4 w-4" />Excel</Button>
            <PrintButton className="rounded-xl" />
          </div>
        </header>

        <div className="flex flex-col gap-6">
          <div className="relative group max-w-sm">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input 
              aria-label="Sınıf ara"
              placeholder="Sınıf ara..." 
              className="rounded-xl border-input bg-card pl-10 shadow-sm transition-colors focus:border-primary/50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
            {isClassesLoading ? (
              <div className="p-8 flex justify-center items-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="border-border/60 hover:bg-transparent">
                    <TableHead className="py-4 pl-6 text-xs font-bold uppercase tracking-wider text-muted-foreground">Sınıf Adı</TableHead>
                    <TableHead className="py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Açıklama</TableHead>
                    <TableHead className="py-4 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">Öğrenci Sayısı</TableHead>
                    <TableHead className="py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Sorumlu Öğretmen</TableHead>
                    <TableHead className="py-4 pr-6 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClasses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-12 text-center text-slate-500 dark:text-slate-400 dark:text-slate-500 font-medium">
                        Görüntülenecek sınıf bulunamadı.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredClasses.map((cls: any) => {
                      const classStudents = students.filter(s => s.classId === cls.id);
                      return (
                        <TableRow key={cls.id} className="border-border/60 transition-colors hover:bg-muted/30">
                          <TableCell className="pl-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                                <Layers className="h-4 w-4" />
                              </div>
                              <span className="font-semibold text-foreground">{cls.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 text-sm text-muted-foreground">
                            {cls.description || '-'}
                          </TableCell>
                          <TableCell className="py-4 text-center">
                            <Badge variant="outline" className="border-border bg-background font-bold text-foreground">
                              <Users className="h-3 w-3 mr-1" />
                              {classStudents.length}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4">
                            {cls.classTeacher ? (
                              <Badge variant="secondary" className="border-0 bg-primary/10 font-semibold text-primary">
                                {cls.classTeacher.name}
                              </Badge>
                            ) : (
                              <span className="text-xs font-medium text-slate-400 dark:text-slate-500 italic">Atanmamış</span>
                            )}
                          </TableCell>
                          <TableCell className="py-4 text-right pr-6">
                            <Link href={`/classes/${cls.id}`}>
                              <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-bold gap-1 rounded-xl">
                                <Eye className="h-4 w-4" />
                                Detay
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
