import { useMemo, useState } from "react";
import { AdminQueryState } from '@/components/management/AdminQueryState';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { parentApi, userApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Trash2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Relation = "Anne" | "Baba" | "Diğer";

export default function GuardianManagementPage() {
  const initialStudent = new URLSearchParams(window.location.search).get("studentId") || "";
  const [search, setSearch] = useState("");
  const [guardianId, setGuardianId] = useState("");
  const [studentId, setStudentId] = useState(initialStudent);
  const [relation, setRelation] = useState<Relation>("Anne");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const usersQuery = useQuery({ queryKey: ["users", "guardian-management"], queryFn: userApi.getAllUsers });
  const parentsQuery = useQuery({ queryKey: ["parents"], queryFn: parentApi.getParents });
  const linksQuery = useQuery({ queryKey: ["parent-students", guardianId], queryFn: () => parentApi.getParentStudents(guardianId), enabled: Boolean(guardianId) });
  const students = useMemo(() => (usersQuery.data?.users || []).filter((user) => user.role === "student" && `${user.name} ${user.email} ${user.class?.name || ""} ${user.studentNo || ""}`.toLocaleLowerCase("tr-TR").includes(search.toLocaleLowerCase("tr-TR"))), [usersQuery.data, search]);
  const linkedIds = new Set((linksQuery.data?.students || []).map((link) => link.studentId));
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["parent-students", guardianId] });
  const linkMutation = useMutation({ mutationFn: () => parentApi.linkParent({ guardianId, studentId, relation }), onSuccess: () => { refresh(); toast({ title: "Veli-öğrenci bağı oluşturuldu" }); }, onError: (error: Error) => toast({ variant: "destructive", title: "Bağlantı kurulamadı", description: error.message }) });
  const unlinkMutation = useMutation({ mutationFn: (id: string) => parentApi.unlinkParent(guardianId, id), onSuccess: refresh, onError: (error: Error) => toast({ variant: "destructive", title: "Bağlantı kaldırılamadı", description: error.message || "İşlem başarısız. Tekrar deneyin." }) });

  const isLinkPending = linkMutation.isPending || unlinkMutation.isPending;
  const linksUnavailable = Boolean(guardianId) && (linksQuery.isPending || linksQuery.isError);

  if ([usersQuery, parentsQuery].some(query => query.isPending || query.isError)) return <DashboardLayout><AdminQueryState queries={[usersQuery, parentsQuery]} /></DashboardLayout>;

  return <DashboardLayout><div className="space-y-5">
    <div><h1 className="text-3xl font-black">Veli-Öğrenci Eşleştirme</h1><p className="text-muted-foreground">Veliyi seçin, yüzlerce öğrenci arasında hızlı arama yapıp bağlantıları yönetin.</p></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Veli ve öğrenci seçimi</CardTitle></CardHeader><CardContent className="grid gap-4 lg:grid-cols-3">
      <Select value={guardianId} onValueChange={setGuardianId} disabled={isLinkPending}><SelectTrigger aria-label="Veli hesabı"><SelectValue placeholder="Veli hesabı seçin" /></SelectTrigger><SelectContent>{(parentsQuery.data?.parents || []).map((parent) => <SelectItem key={parent.id} value={parent.id}>{parent.name} · {parent.email}</SelectItem>)}</SelectContent></Select>
      <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Öğrenci ara" className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Öğrenci adı, e-posta, sınıf veya no ara" /></div>
      <Select value={studentId} onValueChange={setStudentId} disabled={isLinkPending || linksUnavailable}><SelectTrigger aria-label="Öğrenci"><SelectValue placeholder="Öğrenci seçin" /></SelectTrigger><SelectContent>{students.map((student) => <SelectItem key={student.id} value={student.id}>{student.name} · {student.class?.name || "Sınıfsız"} · No {student.studentNo || "-"}</SelectItem>)}</SelectContent></Select>
      <Select value={relation} onValueChange={(value) => setRelation(value as Relation)} disabled={isLinkPending}><SelectTrigger aria-label="Yakınlık derecesi"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Anne">Anne</SelectItem><SelectItem value="Baba">Baba</SelectItem><SelectItem value="Diğer">Diğer</SelectItem></SelectContent></Select>
      <Button disabled={!guardianId || !studentId || linkedIds.has(studentId) || isLinkPending || linksUnavailable} onClick={() => linkMutation.mutate()}>Öğrenciyi Veliye Bağla</Button>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Seçili Veliye Bağlı Öğrenciler</CardTitle></CardHeader><CardContent className="space-y-2">{guardianId && <AdminQueryState queries={[linksQuery]} />}{!guardianId && <p className="text-sm text-muted-foreground">Önce bir veli hesabı seçin.</p>}{guardianId && !linksQuery.isPending && !linksQuery.isError && (linksQuery.data?.students || []).length === 0 && <p className="text-sm text-muted-foreground">Bu veliye bağlı öğrenci yok.</p>}{(linksQuery.data?.students || []).map((link) => <div key={link.id} className="flex items-center justify-between rounded-xl border p-3"><div><div className="font-bold">{link.student?.name}</div><div className="text-xs text-muted-foreground">{link.student?.class?.name || "Sınıfsız"} · No {link.student?.studentNo || "-"} <Badge variant="outline" className="ml-2">{link.relation || "Diğer"}</Badge></div></div><Button variant="destructive" size="sm" aria-label={`${link.student?.name} veli bağlantısını kaldır`} disabled={isLinkPending || linksUnavailable} onClick={() => unlinkMutation.mutate(link.studentId)}><Trash2 className="mr-2 h-4 w-4" />Bağlantıyı Kaldır</Button></div>)}</CardContent></Card>
  </div></DashboardLayout>;
}
