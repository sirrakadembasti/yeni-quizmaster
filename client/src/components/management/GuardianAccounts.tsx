import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parentApi, type GuardianLink } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Link2, Pencil, Save, Trash2, UserPlus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Relation = "Anne" | "Baba" | "Diğer";
const RELATIONS: Relation[] = ["Anne", "Baba", "Diğer"];

export function GuardianAccounts({ studentId }: { studentId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [existingId, setExistingId] = useState("");
  const [relation, setRelation] = useState<Relation>("Anne");
  const [editing, setEditing] = useState<GuardianLink | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", phoneNumber: "", address: "", relation: "Anne" as Relation });
  const [form, setForm] = useState({ name: "", email: "", password: "", phoneNumber: "", address: "", relation: "Anne" as Relation });

  const linksQuery = useQuery({ queryKey: ["student-guardians", studentId], queryFn: () => parentApi.getStudentGuardians(studentId) });
  const parentsQuery = useQuery({ queryKey: ["parents"], queryFn: parentApi.getParents });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["student-guardians", studentId] });
    queryClient.invalidateQueries({ queryKey: ["parents"] });
  };
  const notifyError = (error: Error) => toast({ variant: "destructive", title: "İşlem başarısız", description: error.message });
  const createMutation = useMutation({
    mutationFn: () => parentApi.createParent({ ...form, studentId }),
    onSuccess: () => { refresh(); setForm({ name: "", email: "", password: "", phoneNumber: "", address: "", relation: "Anne" }); toast({ title: "Veli hesabı oluşturuldu" }); },
    onError: notifyError,
  });
  const linkMutation = useMutation({
    mutationFn: () => parentApi.linkParent({ guardianId: existingId, studentId, relation }),
    onSuccess: () => { refresh(); setExistingId(""); setRelation("Anne"); toast({ title: "Veli öğrenciye bağlandı" }); },
    onError: notifyError,
  });
  const unlinkMutation = useMutation({ mutationFn: (guardianId: string) => parentApi.unlinkParent(guardianId, studentId), onSuccess: refresh, onError: notifyError });
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editing?.guardian) throw new Error("Veli bulunamadı.");
      await parentApi.updateParent(editing.guardianId, { name: editForm.name, email: editForm.email, phoneNumber: editForm.phoneNumber, address: editForm.address });
      await parentApi.updateRelation(editing.guardianId, studentId, editForm.relation);
    },
    onSuccess: () => { refresh(); setEditing(null); toast({ title: "Veli bilgileri güncellendi" }); },
    onError: notifyError,
  });
  const linkedIds = new Set((linksQuery.data?.guardians ?? []).map((link) => link.guardianId));
  const available = (parentsQuery.data?.parents ?? []).filter((parent) => !linkedIds.has(parent.id));
  const createValid = form.name.trim().length >= 2 && /.+@.+\..+/.test(form.email) && form.password.length >= 6 && form.phoneNumber.trim().length >= 7 && form.address.trim().length >= 5;
  const editValid = editForm.name.trim().length >= 2 && /.+@.+\..+/.test(editForm.email) && editForm.phoneNumber.trim().length >= 7 && editForm.address.trim().length >= 5;

  const startEdit = (link: GuardianLink) => {
    setEditing(link);
    setEditForm({
      name: link.guardian?.name || "", email: link.guardian?.email || "", phoneNumber: link.guardian?.phoneNumber || "",
      address: link.guardian?.address || "", relation: (RELATIONS.includes(link.relation as Relation) ? link.relation : "Diğer") as Relation,
    });
  };

  return <div className="mt-4 space-y-4">
    <Card className="border-primary/15">
      <CardHeader className="pb-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><CardTitle className="text-base">Giriş Yapabilen Veli Hesapları</CardTitle><p className="text-xs text-muted-foreground">Bu bağlar veli panelinde hangi öğrencilerin görülebileceğini belirler.</p></div><Button asChild variant="outline" size="sm"><Link href={`/guardian-management?studentId=${studentId}`}><ExternalLink className="mr-2 h-4 w-4" />Eşleştirme Sayfası</Link></Button></div></CardHeader>
      <CardContent className="space-y-3">
        {(linksQuery.data?.guardians ?? []).length === 0 && <p className="text-sm text-muted-foreground">Bu öğrenciye bağlı giriş yapabilen veli hesabı yok.</p>}
        {(linksQuery.data?.guardians ?? []).map((link) => <div key={link.id} className="rounded-xl border p-3">
          {editing?.id === link.id ? <div className="grid gap-3 md:grid-cols-2">
            <Field label="Ad Soyad *"><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></Field>
            <Field label="Yakınlık *"><RelationSelect value={editForm.relation} onChange={(value) => setEditForm({ ...editForm, relation: value })} /></Field>
            <Field label="E-posta *"><Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></Field>
            <Field label="Telefon *"><Input value={editForm.phoneNumber} onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })} /></Field>
            <Field label="Adres *"><Input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} /></Field>
            <div className="flex items-end justify-end gap-2"><Button variant="ghost" onClick={() => setEditing(null)}><X className="mr-2 h-4 w-4" />Vazgeç</Button><Button disabled={!editValid || updateMutation.isPending} onClick={() => updateMutation.mutate()}><Save className="mr-2 h-4 w-4" />Kaydet</Button></div>
          </div> : <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-bold">{link.guardian?.name} <Badge variant="outline" className="ml-2">{link.relation || "Diğer"}</Badge></div><div className="text-xs text-muted-foreground">{link.guardian?.email} · {link.guardian?.phoneNumber || "Telefon yok"}</div><div className="mt-1 text-xs text-muted-foreground">{link.guardian?.address || "Adres yok"}</div></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => startEdit(link)}><Pencil className="mr-2 h-4 w-4" />Düzenle</Button><Button size="sm" variant="destructive" onClick={() => unlinkMutation.mutate(link.guardianId)}><Trash2 className="mr-2 h-4 w-4" />Bağlantıyı Kaldır</Button></div></div>}
        </div>)}
      </CardContent>
    </Card>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-4 w-4" />Mevcut Veliyi Bağla</CardTitle></CardHeader><CardContent className="space-y-3"><Select value={existingId} onValueChange={setExistingId}><SelectTrigger><SelectValue placeholder="Veli hesabı seçin" /></SelectTrigger><SelectContent>{available.map((parent) => <SelectItem key={parent.id} value={parent.id}>{parent.name} · {parent.email}</SelectItem>)}</SelectContent></Select><RelationSelect value={relation} onChange={setRelation} /><Button disabled={!existingId || linkMutation.isPending} onClick={() => linkMutation.mutate()} className="w-full">Bağla</Button></CardContent></Card>
      <Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><UserPlus className="h-4 w-4" />Yeni Veli Hesabı Ekle</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">
        <Field label="Ad Soyad *"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field><Field label="Yakınlık *"><RelationSelect value={form.relation} onChange={(value) => setForm({ ...form, relation: value })} /></Field><Field label="E-posta *"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field><Field label="İlk Şifre *"><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field><Field label="Telefon *"><Input value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} /></Field><Field label="Adres *"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field><Button className="sm:col-span-2" disabled={createMutation.isPending || !createValid} onClick={() => createMutation.mutate()}>Hesabı Oluştur ve Bağla</Button>
      </CardContent></Card>
    </div>
  </div>;
}

function RelationSelect({ value, onChange }: { value: Relation; onChange: (value: Relation) => void }) {
  return <Select value={value} onValueChange={(next) => onChange(next as Relation)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{RELATIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
