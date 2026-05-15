import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  User as UserIcon, 
  Mail, 
  Shield, 
  Key, 
  Loader2, 
  Save, 
  Bell, 
  CheckCircle2, 
  XCircle, 
  Clock,
  History,
  Printer
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/auth-context";
import { userApi, authApi, notificationApi, adminApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, isAfter, subMonths } from "date-fns";
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

  // Logs Query (6 months)
  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['dashboard-logs', user?.id],
    queryFn: () => adminApi.getLogsMe(),
    enabled: !!user && activeTab === "logs"
  });

  const notifications = notificationsData?.notifications || [];
  const logs = useMemo(() => {
    if (!logsData?.logs) return [];
    const sixMonthsAgo = subMonths(new Date(), 6);
    return logsData.logs.filter((log: any) => isAfter(new Date(log.timestamp), sixMonthsAgo));
  }, [logsData]);

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      toast({ title: "Başarılı", description: "Tüm bildirimler okundu işaretlendi." });
    }
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab) {
      setActiveTab(tab);
    }

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
           formData.email !== user.email;
  }, [formData, user]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isProfileChanged) {
       return toast({ title: "Bilgi", description: "Herhangi bir değişiklik yapmadınız." });
    }
    
    setLoading(true);
    try {
      await authApi.updateProfile(formData.name, formData.email);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      toast({ title: "Başarılı", description: "Profil bilgileriniz güncellendi." });
    } catch (error: any) {
      toast({ title: "Hata", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      return toast({ title: "Hata", description: "Yeni şifreler uyuşmuyor.", variant: "destructive" });
    }
    
    setLoading(true);
    try {
      await authApi.changePassword(passwordData.currentPassword, passwordData.newPassword);
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast({ title: "Başarılı", description: "Şifreniz değiştirildi." });
    } catch (error: any) {
      toast({ title: "Hata", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-foreground tracking-tight">Hesap Ayarları</h1>
            <p className="text-muted-foreground mt-1 font-medium">Profilinizi, güvenliğinizi ve bildirimlerinizi buradan yönetin.</p>
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
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/50 p-1 rounded-xl w-full max-w-2xl overflow-x-auto h-auto">
            <TabsTrigger value="profile" className="gap-2 rounded-lg py-2 px-4 whitespace-nowrap">
              <UserIcon className="h-4 w-4" /> Profil Bilgileri
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2 rounded-lg py-2 px-4 whitespace-nowrap">
              <Bell className="h-4 w-4" /> Bildirimler
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2 rounded-lg py-2 px-4 whitespace-nowrap">
              <History className="h-4 w-4" /> İşlem Geçmişi
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2 rounded-lg py-2 px-4 whitespace-nowrap">
              <Shield className="h-4 w-4" /> Güvenlik
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="animate-in fade-in-50 duration-500">
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="md:col-span-2 rounded-3xl border-border/50 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/20 border-b border-border/50">
                  <CardTitle className="text-xl font-black">Kişisel Bilgiler</CardTitle>
                  <CardDescription>Adınız ve iletişim bilgileriniz.</CardDescription>
                </CardHeader>
                <form onSubmit={handleProfileUpdate}>
                  <CardContent className="space-y-4 pt-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-muted-foreground uppercase ml-1">Ad Soyad</Label>
                        <div className="relative">
                          <UserIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input 
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            className="pl-10 rounded-xl" 
                            placeholder="Ad Soyad" 
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-muted-foreground uppercase ml-1">E-posta</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input 
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                            className="pl-10 rounded-xl" 
                            placeholder="email@example.com" 
                            type="email"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-muted/10 border-t border-border/50 py-4">
                    <Button 
                      type="submit" 
                      disabled={loading || !isProfileChanged}
                      className="rounded-xl font-bold ml-auto gap-2"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Değişiklikleri Kaydet
                    </Button>
                  </CardFooter>
                </form>
              </Card>

              <Card className="rounded-3xl border-border/50 shadow-sm overflow-hidden flex flex-col">
                <CardHeader className="bg-primary/5 border-b border-primary/10">
                  <CardTitle className="text-xl font-black text-primary">Hesap Bilgileri</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6 flex-1">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <UserIcon className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-black text-lg">{user?.name}</h4>
                      <Badge variant="secondary" className="capitalize">{user?.role === 'teacher' ? 'Öğretmen' : user?.role === 'admin' ? 'Yönetici' : 'Öğrenci'}</Badge>
                    </div>
                  </div>
                  
                  <div className="space-y-4 pt-4 border-t border-border/50">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground font-medium">Katılma Tarihi</span>
                      <span className="font-bold">{user?.createdAt ? format(new Date(user.createdAt), "d MMMM yyyy", { locale: tr }) : "-"}</span>
                    </div>
                    {user?.role === 'student' && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground font-medium">Sınıf No</span>
                        <span className="font-bold">{user?.classNo || "-"}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="animate-in fade-in-50 duration-500">
            <Card className="rounded-3xl border-border/50 shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/20 border-b border-border/50 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-black">Son Bildirimler</CardTitle>
                  <CardDescription>Hesabınızla ilgili tüm güncel aktiviteler.</CardDescription>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="rounded-xl font-bold"
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending || notifications.length === 0}
                >
                  Tümünü Okundu İşaretle
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  {notifications.length > 0 ? (
                    <div className="divide-y divide-border/50">
                      {notifications.map((notification: any) => (
                        <div key={notification.id} className={cn(
                          "p-4 hover:bg-muted/30 transition-colors flex items-start gap-4",
                          !notification.read && "bg-primary/5"
                        )}>
                          <div className={cn(
                            "mt-1 p-2 rounded-lg",
                            notification.type === 'success' ? "bg-emerald-100 text-emerald-600" :
                            notification.type === 'error' ? "bg-rose-100 text-rose-600" :
                            "bg-blue-100 text-blue-600"
                          )}>
                            {notification.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> :
                             notification.type === 'error' ? <XCircle className="h-4 w-4" /> :
                             <Bell className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 space-y-1">
                            <p className="text-sm font-bold leading-none">{notification.title}</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">{notification.content}</p>
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {format(new Date(notification.createdAt), "d MMMM yyyy, HH:mm", { locale: tr })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Bell className="h-6 w-6 text-muted-foreground opacity-30" />
                      </div>
                      <p className="text-muted-foreground font-medium">Henüz bir bildirim bulunmuyor.</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="animate-in fade-in-50 duration-500">
            <Card className="rounded-3xl border-border/50 shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/20 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-black">İşlem Geçmişi</CardTitle>
                    <CardDescription>Son 6 ay içinde gerçekleştirdiğiniz tüm sistem hareketleri.</CardDescription>
                  </div>
                  <Badge variant="outline" className="gap-1.5 py-1.5 px-4 rounded-full border-blue-200 bg-blue-50 text-blue-700 font-bold">
                    <History className="h-3.5 w-3.5" /> {logs.length} İşlem
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {logsLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
                  </div>
                ) : logs.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead className="bg-muted/10">
                        <tr className="border-b border-border/50">
                          <th className="text-left py-4 px-6 text-xs font-black uppercase tracking-wider text-muted-foreground">İşlem</th>
                          <th className="text-left py-4 px-6 text-xs font-black uppercase tracking-wider text-muted-foreground">Detay</th>
                          <th className="text-right py-4 px-6 text-xs font-black uppercase tracking-wider text-muted-foreground">Tarih</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {logs.map((log: any) => (
                          <tr key={log.id} className="hover:bg-muted/20 transition-colors group">
                            <td className="py-4 px-6">
                              <Badge variant="outline" className={cn(
                                "rounded-lg font-bold px-2 py-0.5 border-transparent",
                                log.action.includes('CREATE') ? "bg-emerald-50 text-emerald-700" :
                                log.action.includes('DELETE') ? "bg-rose-50 text-rose-700" :
                                log.action.includes('UPDATE') ? "bg-amber-50 text-amber-700" :
                                "bg-slate-100 text-slate-700"
                              )}>
                                {log.action}
                              </Badge>
                            </td>
                            <td className="py-4 px-6 text-sm text-foreground/80 font-medium">
                              {log.details || "-"}
                            </td>
                            <td className="py-4 px-6 text-right">
                              <div className="flex flex-col items-end">
                                <span className="text-sm font-bold text-foreground">
                                  {format(new Date(log.timestamp), "d MMM yyyy", { locale: tr })}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-medium">
                                  {format(new Date(log.timestamp), "HH:mm:ss")}
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <History className="h-8 w-8 text-muted-foreground opacity-20" />
                    </div>
                    <p className="text-muted-foreground font-bold">Herhangi bir işlem geçmişi bulunamadı.</p>
                    <p className="text-xs text-muted-foreground max-w-xs mt-1">Sistemdeki hareketleriniz burada listelenecektir.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="animate-in fade-in-50 duration-500">
            <Card className="rounded-3xl border-border/50 shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/20 border-b border-border/50">
                <CardTitle className="text-xl font-black">Şifre Değiştir</CardTitle>
                <CardDescription>Hesabınızı güvende tutmak için şifrenizi düzenli olarak güncelleyin.</CardDescription>
              </CardHeader>
              <form onSubmit={handlePasswordChange}>
                <CardContent className="space-y-4 pt-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase ml-1">Mevcut Şifre</Label>
                    <div className="relative">
                      <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input 
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                        type="password" 
                        className="pl-10 rounded-xl" 
                        placeholder="••••••••" 
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground uppercase ml-1">Yeni Şifre</Label>
                      <div className="relative">
                        <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input 
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                          type="password" 
                          className="pl-10 rounded-xl" 
                          placeholder="••••••••" 
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground uppercase ml-1">Yeni Şifre (Tekrar)</Label>
                      <div className="relative">
                        <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input 
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                          type="password" 
                          className="pl-10 rounded-xl" 
                          placeholder="••••••••" 
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/10 border-t border-border/50 py-4">
                  <Button 
                    type="submit" 
                    disabled={loading || !passwordData.newPassword || !passwordData.currentPassword}
                    className="rounded-xl font-bold ml-auto gap-2"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                    Şifreyi Güncelle
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
