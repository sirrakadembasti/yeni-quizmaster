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
  Printer
} from "lucide-react";
import { useState, useMemo } from "react";
import { classApi, userApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function ClassesPage() {
  const { role } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: classesData, isLoading: isClassesLoading } = useQuery({
    queryKey: ['/api/classes'],
    queryFn: () => role === 'admin' ? classApi.getAllClasses() : classApi.getTeacherClasses(),
  });

  const { data: usersData } = useQuery({
    queryKey: ['/api/users'],
    queryFn: () => userApi.getAllUsers(),
  });

  const classes = classesData?.classes || [];
  const students = usersData?.users.filter(u => u.role === 'student') || [];

  const filteredClasses = useMemo(() => {
    return classes.filter(cls => cls.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [classes, searchTerm]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-heading font-black text-slate-900 dark:text-slate-50 tracking-tight flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-200">
                <Layers className="h-6 w-6" />
              </div>
              {role === 'admin' ? 'Okul Sınıfları' : 'Sınıflarım'}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
              {role === 'admin' ? 'Tüm akademik sınıfları ve atamaları izleyin.' : 'Sorumlu olduğunuz ve branş verdiğiniz derslikler.'}
            </p>
          </div>
          <div className="flex gap-2 print:hidden">
            <Button 
              variant="outline" 
              onClick={() => window.print()}
              className="rounded-xl font-black gap-2 border-2 hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" /> Yazdır
            </Button>
          </div>
        </header>

        <div className="flex flex-col gap-6">
          <div className="relative group max-w-sm">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500 group-focus-within:text-indigo-500 transition-colors" />
            <Input 
              placeholder="Sınıf ara..." 
              className="pl-10 rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none overflow-hidden">
            {isClassesLoading ? (
              <div className="p-8 flex justify-center items-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50 dark:bg-slate-800/50">
                  <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
                    <TableHead className="font-black text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest py-4 pl-6">Sınıf Adı</TableHead>
                    <TableHead className="font-black text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest py-4">Açıklama</TableHead>
                    <TableHead className="font-black text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest py-4 text-center">Öğrenci Sayısı</TableHead>
                    <TableHead className="font-black text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest py-4">Sorumlu Öğretmen</TableHead>
                    <TableHead className="font-black text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest py-4 text-right pr-6">İşlemler</TableHead>
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
                        <TableRow key={cls.id} className="hover:bg-slate-50/80 transition-colors border-slate-100 dark:border-slate-800">
                          <TableCell className="pl-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600">
                                <Layers className="h-4 w-4" />
                              </div>
                              <span className="font-bold text-slate-900 dark:text-slate-50">{cls.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 text-slate-500 dark:text-slate-400 dark:text-slate-500 text-sm">
                            {cls.description || '-'}
                          </TableCell>
                          <TableCell className="py-4 text-center">
                            <Badge variant="outline" className="font-black text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                              <Users className="h-3 w-3 mr-1" />
                              {classStudents.length}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4">
                            {cls.classTeacher ? (
                              <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-0 font-bold">
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
