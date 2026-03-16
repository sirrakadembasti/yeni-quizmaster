import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription 
} from "@/components/ui/card";
import { 
  Search, 
  ChevronRight,
  Loader2,
  Users,
  X,
  School,
  Layers,
  User
} from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { classApi, userApi } from "@/lib/api";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ClassesPage() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClassFilter, setSelectedClassFilter] = useState("all");

  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ['teacher-classes'],
    queryFn: () => classApi.getTeacherClasses(),
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => userApi.getAllUsers(),
  });

  const classes = classesData?.classes || [];
  const allStudents = usersData?.users.filter(u => u.role === 'student') || [];

  // Group students by class
  const classGroups = useMemo(() => {
    const groups: Record<string, { classInfo: any, students: any[] }> = {};
    
    // Initialize groups with classes teacher manages
    classes.forEach(cls => {
      groups[cls.id] = { classInfo: cls, students: [] };
    });

    // Distribute students into groups
    allStudents.forEach(student => {
      if (student.classId && groups[student.classId]) {
        if (
          student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (student.classNo || "").toLowerCase().includes(searchTerm.toLowerCase())
        ) {
          groups[student.classId].students.push(student);
        }
      }
    });

    return groups;
  }, [classes, allStudents, searchTerm]);

  const filteredClassIds = useMemo(() => {
    if (selectedClassFilter === "all") return Object.keys(classGroups);
    return [selectedClassFilter];
  }, [selectedClassFilter, classGroups]);

  const isLoading = classesLoading || usersLoading;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-foreground flex items-center gap-3 tracking-tight">
              <Layers className="h-8 w-8 text-primary" />
              Sınıf Yönetimi
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Sınıflarınızdaki öğrenci listelerini ve performanslarını takip edin.
            </p>
          </div>
          <Badge variant="outline" className="w-fit h-8 px-4 font-black bg-primary/5 text-primary border-primary/20">
            Toplam {classes.length} Sınıf | {allStudents.length} Öğrenci
          </Badge>
        </div>

        {/* Filter Bar */}
        <Card className="border-primary/10 shadow-md">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Öğrenci adı veya no ile ara..." 
                  className="pl-10 h-11 bg-background"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2 min-w-[240px]">
                <Select value={selectedClassFilter} onValueChange={setSelectedClassFilter}>
                  <SelectTrigger className="h-11">
                    <div className="flex items-center gap-2 font-bold">
                      <School className="h-4 w-4 text-primary" />
                      <SelectValue placeholder="Sınıf Seçin" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm Sınıflar</SelectItem>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(searchTerm || selectedClassFilter !== "all") && (
                  <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => { setSearchTerm(""); setSelectedClassFilter("all"); }}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Classes & Students Lists */}
        <div className="space-y-12">
          {filteredClassIds.length > 0 ? (
            filteredClassIds.map(classId => {
              const group = classGroups[classId];
              if (!group) return null;
              if (searchTerm && group.students.length === 0 && selectedClassFilter === "all") return null;

              return (
                <div key={classId} className="space-y-4 animate-in fade-in-50 duration-500">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-black shadow-lg shadow-primary/20">
                        {group.classInfo.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h2 className="text-2xl font-black text-foreground tracking-tight">{group.classInfo.name}</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{group.students.length} ÖĞRENCİ</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Card className="border-none shadow-xl overflow-hidden rounded-3xl border-primary/5">
                    <Table>
                      <TableHeader className="bg-muted/50 border-b border-border/50">
                        <TableRow>
                          <TableHead className="w-[60px] text-center font-black uppercase text-[11px] tracking-widest">S.No</TableHead>
                          <TableHead className="w-[120px] font-black uppercase text-[11px] tracking-widest">Öğrenci No</TableHead>
                          <TableHead className="font-black uppercase text-[11px] tracking-widest">Öğrenci Adı Soyadı</TableHead>
                          <TableHead className="text-right font-black uppercase text-[11px] tracking-widest">İşlemler</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.students.length > 0 ? (
                          group.students.map((student, idx) => (
                            <TableRow key={student.id} className="hover:bg-primary/5 transition-all group">
                              <TableCell className="text-center font-bold text-muted-foreground text-xs">
                                {idx + 1}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="font-mono text-sm font-black bg-primary/10 text-primary border-none">
                                  {student.classNo || "-"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                    <User className="h-4 w-4" />
                                  </div>
                                  <span className="font-black text-foreground group-hover:text-primary transition-colors">{student.name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button 
                                  size="sm" 
                                  className="rounded-xl font-bold gap-2 shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all h-9"
                                  onClick={() => setLocation(`/student/results?studentId=${student.id}`)}
                                >
                                  Detayları Gör
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-16 text-muted-foreground italic">
                              <div className="flex flex-col items-center gap-2">
                                <Users className="h-8 w-8 opacity-20" />
                                <p>Bu sınıfta öğrenci bulunamadı.</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </Card>
                </div>
              );
            })
          ) : (
            <Card className="border-dashed border-2 py-24 rounded-3xl bg-muted/20">
              <CardContent className="flex flex-col items-center justify-center text-center">
                <Users className="h-20 w-20 text-muted-foreground/20 mb-6" />
                <h3 className="text-2xl font-black text-foreground tracking-tight">Sınıf Bulunamadı</h3>
                <p className="text-muted-foreground mt-2 max-w-sm mx-auto font-medium">
                  Henüz bir sınıfınız bulunmuyor veya arama kriterleri ile eşleşen sonuç yok.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
