import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Megaphone, 
  Plus, 
  Trash2, 
  Calendar, 
  User, 
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronRight
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
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

export default function AnnouncementsPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  // Form State
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targetRole, setTargetRole] = useState("all");
  const [targetClassId, setTargetClassId] = useState("none");

  const { data: announcementsData, isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const res = await fetch('/api/announcements');
      if (!res.ok) throw new Error("Duyurular yüklenemedi");
      return res.json();
    }
  });

  const { data: classesData } = useQuery({
    queryKey: ['/api/classes'],
    queryFn: async () => {
      const res = await fetch('/api/classes');
      return res.json();
    },
    enabled: role === 'admin' || role === 'teacher'
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Duyuru oluşturulamadı");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      setIsCreateOpen(false);
      setTitle("");
      setContent("");
      toast({ title: "Başarılı", description: "Duyuru yayınlandı." });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/announcements/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast({ title: "Başarılı", description: "Duyuru silindi." });
    }
  });

  const announcements = announcementsData?.announcements || [];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-100">
          <div className="flex items-center gap-6">
            <div className="h-16 w-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
              <Megaphone className="h-10 w-10" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter italic">Duyuru Merkezi</h1>
              <p className="text-indigo-100 font-bold mt-1">Önemli bilgilendirmeler ve anonslar</p>
            </div>
          </div>
          {(role === 'admin' || role === 'teacher') && (
            <Button 
              onClick={() => setIsCreateOpen(true)}
              className="bg-white text-indigo-600 hover:bg-indigo-50 rounded-2xl h-14 px-8 font-black text-lg gap-2 shadow-lg"
            >
              <Plus className="h-6 w-6" /> Yeni Duyuru Yayınla
            </Button>
          )}
        </div>

        <div className="grid gap-6">
          {isLoading ? (
            <div className="text-center py-20 font-black animate-pulse text-muted-foreground">DUYURULAR YÜKLENİYOR...</div>
          ) : announcements.length === 0 ? (
            <Card className="rounded-[2rem] border-2 border-dashed py-20 text-center bg-muted/20">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground opacity-20 mb-4" />
              <p className="text-xl font-black text-muted-foreground italic">Henüz bir duyuru yayınlanmamış.</p>
            </Card>
          ) : (
            announcements.map((ann: any) => (
              <Card key={ann.id} className="rounded-3xl border-2 border-border hover:border-indigo-500 transition-all overflow-hidden group">
                <div className="p-8">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black shadow-lg">
                        {ann.creator?.name?.[0].toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-2xl font-black tracking-tight group-hover:text-indigo-600 transition-colors">{ann.title}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <Badge variant="secondary" className="text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700">
                            {ann.creator?.role === 'admin' ? 'SİSTEM YÖNETİMİ' : 'EĞİTMEN'}
                          </Badge>
                          <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {new Date(ann.createdAt).toLocaleDateString('tr-TR')}
                          </span>
                        </div>
                      </div>
                    </div>
                    {role === 'admin' && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => deleteMutation.mutate(ann.id)}
                        className="text-muted-foreground hover:text-red-600 rounded-xl"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 italic font-medium text-slate-700 leading-relaxed">
                    {ann.content}
                  </div>

                  <div className="mt-6 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">KİMLERE:</span>
                       <Badge variant="outline" className="text-[10px] font-black rounded-lg uppercase">
                         {ann.targetRole === 'all' ? 'HERKESE' : ann.targetRole === 'student' ? 'ÖĞRENCİLERE' : 'ÖĞRETMENLERE'}
                       </Badge>
                       {ann.targetClassId && (
                         <Badge className="text-[10px] font-black rounded-lg bg-emerald-50 text-emerald-700 border-emerald-100">
                           SINIF BAZLI
                         </Badge>
                       )}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-600">
                      Okundu olarak işaretle <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* CREATE DIALOG */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="rounded-[2.5rem] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight italic flex items-center gap-3">
              <Megaphone className="h-6 w-6 text-indigo-600" />
              Yeni Duyuru Oluştur
            </DialogTitle>
            <DialogDescription className="font-bold">Kullanıcıları bilgilendirmek için bir not hazırlayın.</DialogDescription>
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
                <Select value={targetRole} onValueChange={setTargetRole}>
                  <SelectTrigger className="rounded-2xl border-2 h-12 font-bold">
                    <SelectValue placeholder="Seçiniz" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">Herkes</SelectItem>
                    <SelectItem value="teacher">Öğretmenler</SelectItem>
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
                    <SelectItem value="none">Tüm Sınıflar</SelectItem>
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
              disabled={!title || !content}
              onClick={() => createMutation.mutate({ 
                title, 
                content, 
                targetRole, 
                targetClassId: targetClassId === "none" ? null : targetClassId 
              })}
              className="w-full rounded-2xl h-14 font-black text-lg bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95"
            >
              DUYURUYU YAYINLA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}