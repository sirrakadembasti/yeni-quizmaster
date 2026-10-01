import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  User as UserIcon, 
  Mail, 
  Phone,
  MapPin,
  Shield, 
  Key, 
  Loader2, 
  Save, 
  Bell, 
  CheckCircle2, 
  XCircle, 
  Clock,
  History,
  Printer,
  Trash2,
  Volume2,
  VolumeX,
  AlertTriangle
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/auth-context";
import { authApi, notificationApi, adminApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, subMonths } from "date-fns";
import { tr } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { useLocation, useSearch } from "wouter";
import { removeNotification, type NotificationPage } from "@/lib/notification-cache";

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const search = useSearch();
  
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [notificationPage, setNotificationPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyStartDate] = useState(() => subMonths(new Date(), 6).toISOString());
  
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
  const { data: notificationsData, isLoading: notificationsLoading, isError: notificationsError, error: notificationError, refetch: retryNotifications } = useQuery({
    queryKey: ["notifications", "all", notificationPage],
    queryFn: () => notificationApi.getUserNotifications(notificationPage, 20),
    enabled: !!user
  });

  const { data: notificationPreferences } = useQuery({
    queryKey: ["notifications", "preferences"],
    queryFn: () => notificationApi.getPreferences(),
    enabled: !!user
  });

  // Logs Query (6 months)
  const { data: logsData, isLoading: logsLoading, isError: logsError, error: logError, refetch: retryLogs } = useQuery({
    queryKey: ['settings-logs', user?.id, historyPage, historyStartDate],
    queryFn: () => adminApi.getLogsMe({ page: historyPage, limit: 50, startDate: historyStartDate }),
    enabled: !!user && activeTab === "logs"
  });

  const notifications = notificationsData?.notifications || [];
  const logs = logsData?.logs || [];
  const historyTotalPages = Math.max(1, logsData?.pagination?.totalPages ?? 1);

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast({ title: "Başarılı", description: "Tüm bildirimler okundu işaretlendi." });
    }
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (id: string) => notificationApi.deleteNotification(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previous = queryClient.getQueriesData({ queryKey: ["notifications"] });
      queryClient.setQueriesData<NotificationPage>(
        { queryKey: ["notifications"] },
        current => removeNotification(current, id)
      );
      return { previous };
    },
    onSuccess: () => {
      if (notifications.length === 1 && notificationPage > 1) {
        setNotificationPage(page => page - 1);
      }
      toast({ title: "Bildirim silindi" });
    },
    onError: (_error, _id, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast({ title: "Hata", description: "Bildirim silinemedi.", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.refetchQueries({ queryKey: ["notifications"], type: "active" });
    }
  });

  const muteNotificationsMutation = useMutation({
    mutationFn: (muted: boolean) => notificationApi.updatePreferences(muted),
    onSuccess: (preferences) => {
      queryClient.setQueryData(["notifications", "preferences"], preferences);
      toast({
        title: preferences.muted ? "Bildirimler sessize alındı" : "Bildirimlerin sesi açıldı"
      });
    },
    onError: () => toast({ title: "Hata", description: "Bildirim tercihleri güncellenemedi. Lütfen tekrar deneyin.", variant: "destructive" })
  });

  const notificationsMuted = notificationPreferences?.muted ?? false;

  useEffect(() => {
    const params = new URLSearchParams(search);
    const tab = params.get("tab");
    setActiveTab(tab && ["profile", "notifications", "logs", "security"].includes(tab) ? tab : "profile");
  }, [search]);

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
    if (user?.role === 'student') return;
    if (!isProfileChanged) {
       return toast({ title: "Bilgi", description: "Herhangi bir değişiklik yapmadınız." });
    }
    
    setLoading(true);
    try {
      const { user: updatedUser } = await authApi.updateProfile(formData);
      updateUser(updatedUser);
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

        <Tabs value={activeTab} onValueChange={(tab) => { setActiveTab(tab); setLocation(`/settings?tab=${tab}`); }} className="space-y-6">
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
                    {user?.role === 'student' && (
                      <div className="mb-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-amber-900 dark:text-amber-200">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-bold">Bilgilendirme</p>
                          <p className="font-medium text-xs mt-0.5">Kişisel ve iletişim bilgilerinizde değişiklik yapmak istiyorsanız lütfen okul yönetimi ile iletişime geçiniz.</p>
                        </div>
                      </div>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-muted-foreground uppercase ml-1">Ad Soyad</Label>
                        <div className="relative">
                          <UserIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input 
                            disabled={user?.role === 'student'}
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            className="pl-10 rounded-xl disabled:opacity-80 disabled:cursor-not-allowed disabled:bg-muted/30" 
                            placeholder="Ad Soyad" 
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-muted-foreground uppercase ml-1">E-posta</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input 
                            disabled={user?.role === 'student'}
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                            className="pl-10 rounded-xl disabled:opacity-80 disabled:cursor-not-allowed disabled:bg-muted/30" 
                            placeholder="email@example.com" 
                            type="email"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-muted-foreground uppercase ml-1">Telefon</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input disabled={user?.role === 'student'} value={formData.phoneNumber} onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})} className="pl-10 rounded-xl disabled:opacity-80 disabled:cursor-not-allowed disabled:bg-muted/30" placeholder="05xx xxx xx xx" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-muted-foreground uppercase ml-1">Adres</Label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input disabled={user?.role === 'student'} value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} className="pl-10 rounded-xl disabled:opacity-80 disabled:cursor-not-allowed disabled:bg-muted/30" placeholder="İletişim adresi" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  {user?.role !== 'student' && (
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
                  )}
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
                      <Badge variant="secondary" className="capitalize">{user?.role === 'teacher' ? 'Öğretmen' : user?.role === 'admin' ? 'Yönetici' : user?.role === 'parent' ? 'Veli' : 'Öğrenci'}</Badge>
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
                        <span className="font-bold">{user?.studentNo ?? "-"}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {user?.role === 'student' && (
              <Card className="rounded-3xl border-border/50 shadow-sm overflow-hidden mt-6">
                <CardHeader className="bg-muted/20 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-black">Veli Bilgileri</CardTitle>
                      <CardDescription>Kayıtlı veli ve iletişim bilgileriniz (Salt Okunur).</CardDescription>
                    </div>
                    <Badge variant="outline" className="text-xs font-bold text-muted-foreground">Düzenlenemez</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground uppercase ml-1">Veli Adı Soyadı</Label>
                      <Input 
                        disabled 
                        value={user.parentName || "Belirtilmemiş"} 
                        className="rounded-xl bg-muted/30 cursor-not-allowed opacity-80" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground uppercase ml-1">Yakınlık Derecesi</Label>
                      <Input 
                        disabled 
                        value={user.parentRelation || "Belirtilmemiş"} 
                        className="rounded-xl bg-muted/30 cursor-not-allowed opacity-80" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground uppercase ml-1">Veli Telefonu</Label>
                      <Input 
                        disabled 
                        value={user.parentPhone || "Belirtilmemiş"} 
                        className="rounded-xl bg-muted/30 cursor-not-allowed opacity-80" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground uppercase ml-1">Veli E-Postası</Label>
                      <Input 
                        disabled 
                        value={user.parentEmail || "Belirtilmemiş"} 
                        className="rounded-xl bg-muted/30 cursor-not-allowed opacity-80" 
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground uppercase ml-1">Veli Adresi</Label>
                      <Input 
                        disabled 
                        value={user.parentAddress || "Belirtilmemiş"} 
                        className="rounded-xl bg-muted/30 cursor-not-allowed opacity-80" 
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
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
                <div className="flex items-center justify-between gap-4 border-b border-border/50 bg-card p-4 sm:p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      {notificationsMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                    </div>
                    <div>
                      <Label htmlFor="notification-sound" className="font-semibold">Bildirim sesi</Label>
                      <p className="text-xs text-muted-foreground">
                        {notificationsMuted ? "Anlık bildirim uyarıları sessiz." : "Anlık bildirim uyarıları açık."}
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="notification-sound"
                    checked={!notificationsMuted}
                    disabled={muteNotificationsMutation.isPending}
                    onCheckedChange={(enabled) => muteNotificationsMutation.mutate(!enabled)}
                    aria-label="Bildirim sesini aç veya kapat"
                  />
                </div>
                <ScrollArea className="h-[400px]">
                  {notificationsLoading ? (
                    <p role="status" className="py-12 text-center text-muted-foreground">Bildirimler yükleniyor...</p>
                  ) : notificationsError ? (
                    <div role="alert" className="space-y-3 p-6 text-center">
                      <p>Bildirimler yüklenemedi. {notificationError instanceof Error ? notificationError.message : "Lütfen tekrar deneyin."}</p>
                      <Button variant="outline" onClick={() => retryNotifications()}>Tekrar dene</Button>
                    </div>
                  ) : notifications.length > 0 ? (
                    <div className="divide-y divide-border/50">
                      {notifications.map((notification: any) => (
                        <div key={notification.id} className={cn(
                          "p-4 hover:bg-muted/30 transition-colors flex items-start gap-4",
                          !notification.isRead && "bg-primary/5"
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
                            <p className="text-xs text-muted-foreground leading-relaxed">{notification.message || notification.content}</p>
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {format(new Date(notification.createdAt), "d MMMM yyyy, HH:mm", { locale: tr })}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Bildirimi sil"
                            disabled={deleteNotificationMutation.isPending}
                            onClick={() => deleteNotificationMutation.mutate(notification.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
                {(notificationsData?.pagination?.totalPages ?? 1) > 1 && (
                  <div className="flex items-center justify-between border-t border-border/50 px-4 py-3">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={notificationPage <= 1}
                      onClick={() => setNotificationPage(page => Math.max(1, page - 1))}
                    >
                      Önceki
                    </Button>
                    <span className="text-xs font-medium text-muted-foreground">
                      Sayfa {notificationPage} / {notificationsData?.pagination?.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={notificationPage >= (notificationsData?.pagination?.totalPages ?? 1)}
                      onClick={() => setNotificationPage(page => page + 1)}
                    >
                      Sonraki
                    </Button>
                  </div>
                )}
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
                    <History className="h-3.5 w-3.5" /> {logsData?.pagination?.total ?? logs.length} İşlem
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {logsLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
                  </div>
                ) : logsError ? (
                  <div role="alert" className="space-y-3 p-6 text-center">
                    <p>İşlem geçmişi yüklenemedi. {logError instanceof Error ? logError.message : "Lütfen tekrar deneyin."}</p>
                    <Button variant="outline" onClick={() => retryLogs()}>Tekrar dene</Button>
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
                                  {format(new Date(log.createdAt ?? log.timestamp), "d MMM yyyy", { locale: tr })}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-medium">
                                  {format(new Date(log.createdAt ?? log.timestamp), "HH:mm:ss")}
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
                {!logsLoading && !logsError && historyTotalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-border/50 px-4 py-3">
                    <Button variant="outline" size="sm" disabled={historyPage <= 1} onClick={() => setHistoryPage(page => Math.max(1, page - 1))}>Önceki</Button>
                    <span className="text-xs font-medium text-muted-foreground">Sayfa {historyPage} / {historyTotalPages}</span>
                    <Button variant="outline" size="sm" disabled={historyPage >= historyTotalPages} onClick={() => setHistoryPage(page => page + 1)}>Sonraki</Button>
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
