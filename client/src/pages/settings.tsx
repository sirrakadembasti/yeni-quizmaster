import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  User as UserIcon, 
  Mail, 
  Shield, 
  Phone, 
  MapPin, 
  Key, 
  Loader2, 
  Save, 
  GraduationCap, 
  Briefcase,
  Layers,
  Bell,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/auth-context";
import { userApi, authApi, notificationApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    address: ""
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  // Notifications Query
  const { data: notificationsData } = useQuery({
    queryKey: ['/api/notifications'],
    queryFn: () => notificationApi.getUserNotifications(),
    enabled: !!user
  });

  const notifications = notificationsData?.notifications || [];

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      toast({ title: "Başarılı", description: "Tüm bildirimler okundu işaretlendi." });
    }
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        phoneNumber: user.phoneNumber || "",
        address: user.address || ""
      });
    }
  }, [user]);

  const isProfileChanged = useMemo(() => {
    if (!user) return false;
    return formData.name !== user.name || 
           formData.email !== user.email || 
           formData.phoneNumber !== (user.phoneNumber || "") || 
           formData.address !== (user.address || "");
  }, [formData, user]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isProfileChanged) {
       return toast({ title: "Bilgi", description: "Herhangi bir değişiklik yapmadınız." });
    }
    
    setLoading(true);
    try {
      await userApi.updateUser(user!.id, formData);
      // Profil güncellendiğinde user verisini her yerde yenilemek için sayfayı reload edebilir veya context'i zorlayabiliriz
      toast({ title: "Başarılı", description: "Profil bilgileriniz güncellendi. Değişikliklerin yansıması için sayfa yenilenebilir." });
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Hata", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!passwordData.currentPassword || !passwordData.newPassword) {
      return toast({ variant: "destructive", title: "Hata", description: "Lütfen tüm şifre alanlarını doldurun." });
    }

    if (passwordData.newPassword.length < 8) {
      return toast({ variant: "destructive", title: "Güvenlik", description: "Yeni şifre en az 8 karakter olmalıdır." });
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      return toast({ variant: "destructive", title: "Hata", description: "Yeni şifreler birbiriyle eşleşmiyor." });
    }

    setLoading(true);
    try {
      await authApi.changePassword(passwordData.currentPassword, passwordData.newPassword);
      toast({ title: "Başarılı", description: "Şifreniz başarıyla değiştirildi." });
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Hata", description: error.message || "Şifre güncellenemedi." });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-700">
        <header>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Hesap Ayarları</h1>
          <p className="text-muted-foreground font-medium">Profilinizi, güvenliğinizi ve bildirimlerinizi buradan yönetin.</p>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/50 p-1.5 rounded-2xl w-fit border border-border/50">
            <TabsTrigger value="profile" className="rounded-xl px-6 font-bold gap-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm dark:shadow-none">
              <UserIcon className="h-4 w-4" /> Profil
            </TabsTrigger>
            <TabsTrigger value="security" className="rounded-xl px-6 font-bold gap-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm dark:shadow-none">
              <Shield className="h-4 w-4" /> Güvenlik
            </TabsTrigger>
            <TabsTrigger value="notifications" className="rounded-xl px-6 font-bold gap-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm dark:shadow-none">
              <Bell className="h-4 w-4" /> Bildirimler
              {notifications.some((n: any) => !n.isRead) && <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />}
            </TabsTrigger>
          </TabsList>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-4 space-y-4">
              <Card className="rounded-3xl border-border/50 shadow-sm dark:shadow-none bg-indigo-50/30 dark:bg-indigo-950/10 border-2 border-dashed border-indigo-100/50 dark:border-indigo-900/20 overflow-hidden">
                <CardContent className="p-6 space-y-6">
                   <div className="flex items-center gap-4">
                      <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary font-black text-2xl border border-primary/20">
                        {user.name?.[0]}
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-foreground leading-tight">{user.name}</h3>
                        <p className="text-xs font-bold text-muted-foreground">{user.email}</p>
                      </div>
                   </div>

                   <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Akademik Durum</Label>
                      <div className="grid grid-cols-1 gap-2">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-border/50">
                           <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><Layers className="h-3.5 w-3.5 text-indigo-500" /> Rol</div>
                           <Badge variant="secondary" className="text-[10px] font-black uppercase bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">{user.role}</Badge>
                        </div>
                        
                        {user.role === 'student' && (
                          <>
                            <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-border/50">
                               <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><GraduationCap className="h-3.5 w-3.5 text-emerald-500" /> Sınıf</div>
                               <span className="text-xs font-black">{user.class?.name || 'Atanmamış'}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-border/50">
                               <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><Shield className="h-3.5 w-3.5 text-rose-500" /> Öğrenci No</div>
                               <span className="text-xs font-black">#{user.studentNo || 'N/A'}</span>
                            </div>
                          </>
                        )}

                        {user.role === 'teacher' && (
                          <div className="p-3 rounded-xl bg-background border border-border/50 space-y-2">
                             <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><Briefcase className="h-3.5 w-3.5 text-indigo-500" /> Branşlar</div>
                             <div className="flex flex-wrap gap-1">
                               {user.assignedCategories?.map((cat: any) => (
                                 <Badge key={cat.id} className="text-[9px] font-bold py-0">{cat.name}</Badge>
                               )) || <span className="text-[10px] italic opacity-50">Atanmamış</span>}
                             </div>
                          </div>
                        )}
                      </div>
                   </div>
                </CardContent>
              </Card>

              <div className="p-5 rounded-3xl bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 flex gap-3">
                 <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                 <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400 leading-relaxed">Güvenliğiniz için şifrenizi en az 3 ayda bir değiştirmenizi ve iletişim bilgilerinizi güncel tutmanızı öneririz.</p>
              </div>
            </div>

            <div className="lg:col-span-8">
               <TabsContent value="profile" className="m-0 animate-in slide-in-from-right-4 duration-500">
                  <Card className="rounded-3xl border-border/50 shadow-sm dark:shadow-none bg-card overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b border-border/50 p-6">
                      <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2"><UserIcon className="h-5 w-5 text-primary" /> Kişisel Bilgiler</CardTitle>
                      <CardDescription>Uygulama genelinde görünen iletişim detaylarınız.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                      <form id="profile-form" onSubmit={handleProfileUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold ml-1">Tam Adınız</Label>
                          <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="rounded-xl border-border bg-background/50 h-11 font-medium" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold ml-1">E-Posta Adresi</Label>
                          <Input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="rounded-xl border-border bg-background/50 h-11 font-medium" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold ml-1">Telefon Numarası</Label>
                          <Input value={formData.phoneNumber} onChange={e => setFormData({...formData, phoneNumber: e.target.value})} placeholder="05XX XXX XX XX" className="rounded-xl border-border bg-background/50 h-11 font-medium" />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label className="text-xs font-bold ml-1">Adres Bilgisi</Label>
                          <Textarea value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Açık adresiniz..." className="rounded-xl border-border bg-background/50 min-h-[100px] resize-none font-medium" />
                        </div>
                      </form>
                    </CardContent>
                    <CardFooter className="p-6 bg-muted/20 border-t border-border/50 flex justify-end">
                      <Button form="profile-form" disabled={loading || !isProfileChanged} className="rounded-xl px-8 font-black gap-2 shadow-lg shadow-primary/10 transition-all">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Değişiklikleri Kaydet
                      </Button>
                    </CardFooter>
                  </Card>
               </TabsContent>

               <TabsContent value="security" className="m-0 animate-in slide-in-from-right-4 duration-500">
                  <Card className="rounded-3xl border-border/50 shadow-sm dark:shadow-none bg-card overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b border-border/50 p-6">
                      <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2"><Key className="h-5 w-5 text-primary" /> Şifre Güncelleme</CardTitle>
                      <CardDescription>Hesap güvenliğiniz için güçlü bir şifre belirleyin.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                      <form id="password-form" onSubmit={handlePasswordUpdate} className="space-y-6 max-w-md">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold ml-1">Mevcut Şifre</Label>
                          <Input type="password" value={passwordData.currentPassword} onChange={e => setPasswordData({...passwordData, currentPassword: e.target.value})} className="rounded-xl border-border bg-background/50 h-11" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold ml-1 flex justify-between">Yeni Şifre <span className="text-[10px] text-muted-foreground uppercase">Min. 8 Karakter</span></Label>
                          <Input type="password" value={passwordData.newPassword} onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})} className="rounded-xl border-border bg-background/50 h-11" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold ml-1">Yeni Şifre (Tekrar)</Label>
                          <Input type="password" value={passwordData.confirmPassword} onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})} className="rounded-xl border-border bg-background/50 h-11" />
                        </div>
                      </form>
                    </CardContent>
                    <CardFooter className="p-6 bg-muted/20 border-t border-border/50 flex justify-end">
                      <Button form="password-form" disabled={loading} className="rounded-xl px-8 font-black gap-2 bg-slate-900 text-white hover:bg-slate-800 transition-all">
                         Güncelle
                      </Button>
                    </CardFooter>
                  </Card>
               </TabsContent>

               <TabsContent value="notifications" className="m-0 animate-in slide-in-from-right-4 duration-500">
                  <Card className="rounded-3xl border-border/50 shadow-sm dark:shadow-none bg-card overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b border-border/50 p-6 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2"><Bell className="h-5 w-5 text-primary" /> Bildirim Geçmişi</CardTitle>
                        <CardDescription>Sizinle paylaşılan son güncellemeler.</CardDescription>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => markAllReadMutation.mutate()} className="text-[10px] font-black uppercase text-primary hover:bg-primary/5 rounded-lg">Hepsini Okundu İşaretle</Button>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className="h-[450px]">
                        {notifications.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                             <Bell className="h-12 w-12 mb-4" />
                             <p className="font-bold text-sm italic">Henüz bir bildirim bulunmuyor.</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-border/30">
                            {notifications.map((n: any) => (
                              <div key={n.id} className={cn(
                                "p-6 transition-colors flex gap-4 items-start",
                                !n.isRead ? "bg-primary/5 dark:bg-primary/10" : "hover:bg-muted/30"
                              )}>
                                <div className={cn(
                                  "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border-2",
                                  !n.isRead ? "bg-white dark:bg-slate-900 border-primary/20 text-primary shadow-sm dark:shadow-none" : "bg-muted text-muted-foreground border-transparent"
                                )}>
                                  {n.type === 'quiz' ? <Layers className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
                                </div>
                                <div className="space-y-1">
                                  <h4 className="font-black text-sm text-foreground">{n.title}</h4>
                                  <p className="text-xs text-muted-foreground font-medium leading-relaxed">{n.message}</p>
                                  <div className="flex items-center gap-3 pt-1 text-[10px] font-bold text-muted-foreground/60">
                                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {format(new Date(n.createdAt), "dd MMMM HH:mm", { locale: tr })}</span>
                                    {!n.isRead && <Badge className="h-1.5 w-1.5 p-0 rounded-full bg-primary border-0" />}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>
               </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
