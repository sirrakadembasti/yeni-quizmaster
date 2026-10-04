import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Megaphone, 
  Plus, 
  Trash2, 
  Bell,
  ChevronRight,
  Printer
} from "lucide-react";
import { AnnouncementAuthor } from "@/components/announcements/AnnouncementAuthor";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { refreshCsrfToken } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { announcementApi, classApi } from "@/lib/api";

const announcementAudienceLabels: Record<string, string> = {
  all: 'HERKESE',
  student: 'ÖĞRENCİLERE',
  teacher: 'ÖĞRETMENLERE',
  parent: 'VELİLERE',
};

export default function AnnouncementsPage() {
  const { role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] = useState<{ id: string; title: string } | null>(null);

  // Sayfa açıldığında CSRF token'ı yenile — stale token nedeniyle oluşabilecek
  // 403 hatalarını önlemek için. (Sunucu yeniden başlatıldığında session değişebilir.)
  useEffect(() => {
    refreshCsrfToken().catch(() => {/* sessiz hata — formda yeniden denenecek */});
  }, []);

  // Form State
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targetRole, setTargetRole] = useState("all");
  const [targetClassId, setTargetClassId] = useState("none");
  const isTeacher = role === "teacher";

  const openCreateDialog = () => {
    setTargetRole(isTeacher ? "student" : "all");
    setTargetClassId("none");
    setIsCreateOpen(true);
  };

  const { data: announcementsData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => announcementApi.getAllAnnouncements()
  });

  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classApi.getAllClasses(),
    enabled: role === 'admin' || role === 'teacher'
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => announcementApi.createAnnouncement(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      setIsCreateOpen(false);
      setTitle("");
      setContent("");
      setTargetRole(isTeacher ? "student" : "all");
      setTargetClassId("none");
      toast({ title: "Başarılı", description: "Duyuru yayınlandı." });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Hata", description: error.message || "Duyuru oluşturulamadı" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => announcementApi.deleteAnnouncement(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      setAnnouncementToDelete(null);
      toast({ title: "Başarılı", description: "Duyuru silindi." });
    },
    onError: (error: Error) => toast({ title: "Duyuru silinemedi", description: `${error.message || "Silme işlemi başarısız."} Lütfen tekrar deneyin.`, variant: "destructive" })
  });

  const announcements = announcementsData?.announcements || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-3.5 sm:p-4">
          <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <Megaphone className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Duyuru Merkezi</h1>
              <p className="mt-1 text-sm text-muted-foreground">Önemli bilgilendirmeler ve güncel duyurular</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row print:hidden">
            <Button 
              variant="outline" 
              onClick={() => window.print()}
              className="h-10 gap-2 rounded-xl px-4 font-semibold"
            >
              <Printer className="h-4 w-4" /> Yazdır
            </Button>
            {(role === 'admin' || role === 'teacher') && (
              <Button 
                onClick={openCreateDialog}
                className="h-10 gap-2 rounded-xl px-5 font-semibold shadow-sm"
              >
                <Plus className="h-4 w-4" /> Yeni Duyuru
              </Button>
            )}
          </div>
          </div>
          <div className="pointer-events-none absolute -right-14 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        </section>

        <div className="grid gap-4">
          {isLoading ? (
            <div className="text-center py-20 font-black animate-pulse text-muted-foreground">DUYURULAR YÜKLENİYOR...</div>
          ) : isError ? (
            <Card role="alert" className="space-y-3 p-6 text-center">
              <p>Duyurular yüklenemedi. {error instanceof Error ? error.message : "Lütfen tekrar deneyin."}</p>
              <Button variant="outline" onClick={() => refetch()}>Tekrar dene</Button>
            </Card>
          ) : announcements.length === 0 ? (
            <Card className="border-dashed bg-card py-16 text-center">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground opacity-20 mb-4" />
              <p className="text-lg font-semibold text-muted-foreground">Henüz bir duyuru yayınlanmamış.</p>
            </Card>
          ) : (
            announcements.map((ann: any) => (
              <Card key={ann.id} className="group overflow-hidden transition-colors hover:border-primary/40">
                <div className="p-3 sm:p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <AnnouncementAuthor creator={ann.creator} createdAt={ann.createdAt} />
                    {role === 'admin' && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => { deleteMutation.reset(); setAnnouncementToDelete({ id: ann.id, title: ann.title }); }}
                        disabled={deleteMutation.isPending}
                        className="rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0"
                        aria-label="Duyuruyu sil"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    )}
                  </div>

                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-foreground transition-colors group-hover:text-primary mb-2">
                      {ann.title}
                    </h3>
                    <div className="rounded-xl border border-border/60 bg-muted/35 p-2.5 sm:p-3 text-sm font-medium leading-snug text-foreground whitespace-pre-wrap">
                      {ann.content}
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                       <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Hedef:</span>
                       <Badge variant="outline" className="rounded-lg text-[10px] font-bold uppercase">
                          {announcementAudienceLabels[ann.targetRole] || 'HEDEF BELİRTİLMEMİŞ'}
                       </Badge>
                       {ann.targetClassId && (
                         <Badge variant="outline" className="rounded-lg border-emerald-500/25 bg-emerald-500/10 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                           SINIF BAZLI
                         </Badge>
                       )}
                    </div>
                    <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                      Duyuru <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      <Dialog open={!!announcementToDelete} onOpenChange={(open) => { if (!open && !deleteMutation.isPending) setAnnouncementToDelete(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duyuruyu sil</DialogTitle>
            <DialogDescription>“{announcementToDelete?.title}” duyurusu kalıcı olarak silinecek. Devam etmek istiyor musunuz?</DialogDescription>
          </DialogHeader>
          {deleteMutation.isError && <p role="alert" className="text-sm text-destructive">{deleteMutation.error.message || "Duyuru silinemedi."} Lütfen tekrar deneyin.</p>}
          <DialogFooter>
            <Button variant="outline" disabled={deleteMutation.isPending} onClick={() => setAnnouncementToDelete(null)}>İptal</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => { if (announcementToDelete && !deleteMutation.isPending) deleteMutation.mutate(announcementToDelete.id); }}>{deleteMutation.isPending ? "Siliniyor..." : "Sil"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CREATE DIALOG */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="rounded-2xl border-border/70 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl font-bold tracking-tight">
              <Megaphone className="h-6 w-6 text-indigo-600" />
              Yeni Duyuru Oluştur
            </DialogTitle>
            <DialogDescription>
              {isTeacher
                ? "Yalnızca dersine girdiğiniz sınıflardaki öğrencilere duyuru gönderebilirsiniz."
                : "Kullanıcıları bilgilendirmek için bir duyuru hazırlayın."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-6">
            <div className="space-y-2">
              <Label className="font-black text-xs uppercase tracking-widest text-muted-foreground pl-1">Duyuru Başlığı</Label>
              <Input 
                value={title} 
                onChange={e => setTitle(e.target.value.toLocaleUpperCase('tr-TR'))} 
                className="rounded-2xl border-2 h-12 font-bold" 
                placeholder="ÖRN: SINAV TAKVİMİ GÜNCELLEMESİ"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-black text-xs uppercase tracking-widest text-muted-foreground pl-1">Duyuru İçeriği</Label>
              <Textarea 
                value={content} 
                onChange={e => setContent(e.target.value)} 
                className="rounded-2xl border-2 min-h-[120px] font-medium" 
                placeholder="Duyuru detaylarını buraya yazın..."
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-black text-xs uppercase tracking-widest text-muted-foreground pl-1">Hedef Kitle</Label>
                <Select value={isTeacher ? "student" : targetRole} onValueChange={setTargetRole} disabled={isTeacher}>
                  <SelectTrigger className="rounded-2xl border-2 h-12 font-bold">
                    <SelectValue placeholder="Seçiniz" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {!isTeacher && <SelectItem value="all">Herkes</SelectItem>}
                    {!isTeacher && <SelectItem value="teacher">Öğretmenler</SelectItem>}
                    {!isTeacher && <SelectItem value="parent">Veliler</SelectItem>}
                    <SelectItem value="student">Öğrenciler</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-black text-xs uppercase tracking-widest text-muted-foreground pl-1">Sınıf Filtresi</Label>
                <Select value={targetClassId} onValueChange={setTargetClassId}>
                  <SelectTrigger className="rounded-2xl border-2 h-12 font-bold">
                    <SelectValue placeholder="Seçiniz" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {isTeacher
                      ? <SelectItem value="none" disabled>Sınıf seçiniz</SelectItem>
                      : <SelectItem value="none">Tüm Sınıflar</SelectItem>}
                    {classesData?.classes?.map((cls: any) => (
                      <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              disabled={!title || !content || createMutation.isPending || (isTeacher && targetClassId === "none")}
              onClick={() => createMutation.mutate({ 
                title, 
                content, 
                targetRole: isTeacher ? "student" : targetRole,
                targetClassId: targetClassId === "none" ? null : targetClassId 
              })}
                className="h-11 w-full rounded-xl font-semibold shadow-sm"
            >
              Duyuruyu Yayınla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
