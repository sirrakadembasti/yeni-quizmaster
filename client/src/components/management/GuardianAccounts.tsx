import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parentApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Link2, Trash2, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function GuardianAccounts({ studentId }: { studentId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [existingId, setExistingId] = useState("");
  const [relation, setRelation] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", phoneNumber: "", address: "", relation: "" });
  const linksQuery = useQuery({ queryKey: ["student-guardians", studentId], queryFn: () => parentApi.getStudentGuardians(studentId) });
  const parentsQuery = useQuery({ queryKey: ["parents"], queryFn: parentApi.getParents });
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ["student-guardians", studentId] }); queryClient.invalidateQueries({ queryKey: ["parents"] }); };
  const notifyError = (error: Error) => toast({ variant: "destructive", title: "İşlem başarısız", description: error.message });
  const createMutation = useMutation({ mutationFn: () => parentApi.createParent({ ...form, studentId }), onSuccess: () => { refresh(); setForm({ name: "", email: "", password: "", phoneNumber: "", address: "", relation: "" }); toast({ title: "Veli hesabı oluşturuldu" }); }, onError: notifyError });
  const linkMutation = useMutation({ mutationFn: () => parentApi.linkParent({ guardianId: existingId, studentId, relation }), onSuccess: () => { refresh(); setExistingId(""); setRelation(""); toast({ title: "Veli öğrenciye bağlandı" }); }, onError: notifyError });
  const unlinkMutation = useMutation({ mutationFn: (guardianId: string) => parentApi.unlinkParent(guardianId, studentId), onSuccess: refresh, onError: notifyError });
  const linkedIds = new Set((linksQuery.data?.guardians ?? []).map((link) => link.guardianId));
  const available = (parentsQuery.data?.parents ?? []).filter((parent) => !linkedIds.has(parent.id));

  return <div className="mt-4 space-y-4">
    <Card className="border-primary/15">
      <CardHeader className="pb-3"><CardTitle className="text-base">Veli Hesapları</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {(linksQuery.data?.guardians ?? []).length === 0 && <p className="text-sm text-muted-foreground">Bu öğrenciye bağlı giriş yapabilen veli hesabı yok.</p>}
        {(linksQuery.data?.guardians ?? []).map((link) => <div key={link.id} className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-bold">{link.guardian?.name}</div><div className="text-xs text-muted-foreground">{link.guardian?.email} {link.relation && <Badge variant="outline" className="ml-2">{link.relation}</Badge>}</div></div><Button size="sm" variant="destructive" onClick={() => unlinkMutation.mutate(link.guardianId)}><Trash2 className="mr-2 h-4 w-4" /> Bağlantıyı Kaldır</Button></div>)}
      </CardContent>
    </Card>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-4 w-4" /> Mevcut Veliyi Bağla</CardTitle></CardHeader><CardContent className="space-y-3"><Select value={existingId} onValueChange={setExistingId}><SelectTrigger><SelectValue placeholder="Veli hesabı seçin" /></SelectTrigger><SelectContent>{available.map((parent) => <SelectItem key={parent.id} value={parent.id}>{parent.name} · {parent.email}</SelectItem>)}</SelectContent></Select><Input value={relation} onChange={(event) => setRelation(event.target.value)} placeholder="Yakınlık: Anne, Baba, Vasi..." /><Button disabled={!existingId || linkMutation.isPending} onClick={() => linkMutation.mutate()} className="w-full">Bağla</Button></CardContent></Card>
      <Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><UserPlus className="h-4 w-4" /> Yeni Veli Hesabı</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">
        <Field label="Ad Soyad"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field><Field label="Yakınlık"><Input value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} /></Field><Field label="E-posta"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field><Field label="İlk Şifre"><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field><Field label="Telefon"><Input value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} /></Field><Field label="Adres"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field><Button className="sm:col-span-2" disabled={createMutation.isPending || !form.name || !form.email || form.password.length < 6} onClick={() => createMutation.mutate()}>Hesabı Oluştur ve Bağla</Button>
      </CardContent></Card>
    </div>
  </div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
