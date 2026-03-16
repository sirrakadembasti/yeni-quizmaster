import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/auth-context";
import { classApi } from '@/lib/api';
import { 
  Bell, 
  User, 
  Shield, 
  Palette,
  Moon,
  Sun
} from "lucide-react";
import { authApi } from "@/lib/api";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState('system');
  
  // Profile state
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });

  const [className, setClassName] = useState<string | null>(null);

  // Password state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Notification preferences
  const [notifications, setNotifications] = useState({
    quizCompleted: true,
    newStudent: true,
    weeklyReport: false,
  });

  useEffect(() => {
    // Load theme preference
    const savedTheme = localStorage.getItem('theme') || 'system';
    setTheme(savedTheme);
    // load assigned class name if present
    (async () => {
      if (user?.classId) {
        try {
          const resp = await classApi.getClass(user.classId);
          setClassName(resp.class?.name || null);
        } catch (e) {
          setClassName(null);
        }
      }
    })();
  }, []);
  return (
    <DashboardLayout>
      <div className="space-y-8 pb-20">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Ayarlar</h1>
          <p className="text-muted-foreground mt-2">Hesap, bildirim ve görünüm tercihlerini yönet.</p>
        </div>

        <Tabs defaultValue="profile" className="flex flex-col md:flex-row gap-8">
          <aside className="w-full md:w-64 shrink-0">
            <TabsList className="flex flex-col h-auto bg-transparent p-0 space-y-1">
              <TabsTrigger 
                value="profile" 
                className="w-full justify-start gap-2 px-3 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
              >
                <User className="h-4 w-4" />
                Profil ve Ayarlar
              </TabsTrigger>
              <TabsTrigger 
                value="notifications" 
                className="w-full justify-start gap-2 px-3 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
              >
                <Bell className="h-4 w-4" />
                Bildirimler
              </TabsTrigger>
              <TabsTrigger 
                value="appearance" 
                className="w-full justify-start gap-2 px-3 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
              >
                <Palette className="h-4 w-4" />
                Görünüm
              </TabsTrigger>
              <TabsTrigger 
                value="security" 
                className="w-full justify-start gap-2 px-3 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
              >
                <Shield className="h-4 w-4" />
                Güvenlik
              </TabsTrigger>
              
            </TabsList>
          </aside>

          <div className="flex-1 space-y-6">
            {/* Profile Settings */}
            <TabsContent value="profile" className="space-y-6 mt-0 animate-in fade-in-50 duration-500">
              <Card>
                <CardHeader>
                  <CardTitle>Profil Bilgileri</CardTitle>
                  <CardDescription>
                    Bu bilgiler profilinde herkese açık olarak görüntülenecektir.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <Avatar className="h-24 w-24 border-2 border-border">
                      <AvatarImage src="https://github.com/shadcn.png" />
                      <AvatarFallback>AD</AvatarFallback>
                    </Avatar>
                    <div className="space-y-2 text-center sm:text-left">
                        <Button variant="outline" size="sm">Fotoğrafı Değiştir</Button>
                        {className && (
                          <p className="text-sm text-muted-foreground mt-2">Sınıfınız: {className}</p>
                        )}
                      <p className="text-xs text-muted-foreground">
                        JPG, GIF veya PNG. Maksimum 1MB.
                      </p>
                    </div>
                  </div>
                  
                  <Separator />

                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        setLoading(true);
                        await authApi.updateProfile(profileData.name, profileData.email);
                        window.location.reload();
                      } catch (error) {
                        alert('Profil güncellenirken hata oluştu.');
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">Ad</Label>
                        <Input 
                          id="firstName" 
                          value={profileData.name}
                          onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">E-posta</Label>
                        <Input 
                          id="email" 
                          type="email" 
                          value={profileData.email}
                          onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                      <Button 
                        type="button"
                        variant="ghost"
                        onClick={() => setProfileData({ name: user?.name || '', email: user?.email || '' })}
                      >
                        İptal
                      </Button>
                      <Button type="submit" disabled={loading}>
                        {loading ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notifications Settings */}
            <TabsContent value="notifications" className="space-y-6 mt-0 animate-in fade-in-50 duration-500">
              <Card>
                <CardHeader>
                  <CardTitle>Bildirim Tercihleri</CardTitle>
                  <CardDescription>
                    Hangi durumlarda bildirim almak istediğinizi seçin.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between space-x-2">
                    <div className="space-y-0.5">
                      <Label className="text-base">Quiz Tamamlandı</Label>
                      <p className="text-sm text-muted-foreground">
                        Bir öğrenci quiz tamamladığında bildirim al.
                      </p>
                    </div>
                    <Switch 
                      checked={notifications.quizCompleted}
                      onCheckedChange={(checked) => setNotifications({...notifications, quizCompleted: checked})}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between space-x-2">
                    <div className="space-y-0.5">
                      <Label className="text-base">Yeni Öğrenci Kaydı</Label>
                      <p className="text-sm text-muted-foreground">
                        Sınıfına yeni bir öğrenci katıldığında bildir.
                      </p>
                    </div>
                    <Switch 
                      checked={notifications.newStudent}
                      onCheckedChange={(checked) => setNotifications({...notifications, newStudent: checked})}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between space-x-2">
                    <div className="space-y-0.5">
                      <Label className="text-base">Haftalık Rapor</Label>
                      <p className="text-sm text-muted-foreground">
                        Her Pazartesi haftalık performans özetini e-posta ile al.
                      </p>
                    </div>
                    <Switch 
                      checked={notifications.weeklyReport}
                      onCheckedChange={(checked) => setNotifications({...notifications, weeklyReport: checked})}
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2 border-t bg-muted/20 px-6 py-4">
                  <Button
                    onClick={() => {
                      localStorage.setItem('notifications', JSON.stringify(notifications));
                      alert('Bildirim tercihleri kaydedildi.');
                    }}
                  >
                    Tercihleri Kaydet
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            {/* Appearance Settings */}
            <TabsContent value="appearance" className="space-y-6 mt-0 animate-in fade-in-50 duration-500">
              <Card>
                <CardHeader>
                  <CardTitle>Görünüm</CardTitle>
                  <CardDescription>
                    Uygulamanın temasını ve görünümünü özelleştir.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-base">Tema</Label>
                    <p className="text-sm text-muted-foreground mb-4">
                      Arayüz için bir tema seçin.
                    </p>
                    <div className="grid grid-cols-3 gap-4 max-w-md">
                      <div 
                        onClick={() => {
                          setTheme('light');
                          localStorage.setItem('theme', 'light');
                          document.documentElement.classList.remove('dark');
                        }}
                        className={`cursor-pointer space-y-2 transition-transform hover:scale-105 ${theme === 'light' ? 'ring-2 ring-primary rounded-lg' : ''}`}
                      >
                        <div className="h-24 rounded-lg bg-slate-100 border-2 border-primary p-2 flex items-center justify-center">
                          <div className="h-16 w-full bg-white rounded shadow-sm flex items-center justify-center">
                            <Sun className="h-6 w-6 text-slate-900" />
                          </div>
                        </div>
                        <span className="block text-center text-sm font-medium">Aydınlık</span>
                      </div>
                      <div 
                        onClick={() => {
                          setTheme('dark');
                          localStorage.setItem('theme', 'dark');
                          document.documentElement.classList.add('dark');
                        }}
                        className={`cursor-pointer space-y-2 transition-transform hover:scale-105 ${theme === 'dark' ? 'ring-2 ring-primary rounded-lg' : ''}`}
                      >
                         <div className="h-24 rounded-lg bg-slate-950 border-2 border-transparent hover:border-border p-2 flex items-center justify-center">
                          <div className="h-16 w-full bg-slate-900 rounded shadow-sm flex items-center justify-center">
                            <Moon className="h-6 w-6 text-slate-100" />
                          </div>
                        </div>
                        <span className="block text-center text-sm font-medium">Karanlık</span>
                      </div>
                      <div 
                        onClick={() => {
                          setTheme('system');
                          localStorage.setItem('theme', 'system');
                        }}
                        className={`cursor-pointer space-y-2 transition-transform hover:scale-105 ${theme === 'system' ? 'ring-2 ring-primary rounded-lg' : ''}`}
                      >
                         <div className="h-24 rounded-lg bg-slate-100 border-2 border-transparent hover:border-border p-2 flex items-center justify-center">
                          <div className="h-16 w-full bg-slate-900 rounded shadow-sm flex items-center justify-center relative overflow-hidden">
                             <div className="absolute left-0 top-0 bottom-0 w-1/2 bg-white"></div>
                             <Sun className="h-4 w-4 text-slate-900 absolute left-3 z-10" />
                             <Moon className="h-4 w-4 text-slate-100 absolute right-3 z-10" />
                          </div>
                        </div>
                        <span className="block text-center text-sm font-medium">Sistem</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
             {/* Security Settings - Placeholder */}
            <TabsContent value="security" className="space-y-6 mt-0 animate-in fade-in-50 duration-500">
               <Card>
                <CardHeader>
                  <CardTitle>Şifre ve Güvenlik</CardTitle>
                  <CardDescription>
                    Şifreni güncelle ve oturumlarını yönet.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!passwordData.currentPassword) {
                        alert('Lütfen mevcut şifrenizi girin.');
                        return;
                      }
                      if (!passwordData.newPassword) {
                        alert('Lütfen yeni şifre girin.');
                        return;
                      }
                      if (passwordData.newPassword !== passwordData.confirmPassword) {
                        alert('Şifreler eşleşmiyor. Lütfen kontrol edin.');
                        return;
                      }
                      try {
                        setLoading(true);
                        await authApi.changePassword(passwordData.currentPassword, passwordData.newPassword);
                        alert('Şifre başarıyla güncellendi. Lütfen tekrar giriş yapın.');
                        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                        logout();
                      } catch (error: any) {
                        alert(error?.message || 'Şifre güncellenirken hata oluştu.');
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="current-pass">Mevcut Şifre</Label>
                        <Input 
                          id="current-pass" 
                          type="password"
                          autoComplete="current-password"
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-pass">Yeni Şifre</Label>
                        <Input 
                          id="new-pass" 
                          type="password"
                          autoComplete="new-password"
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirm-pass">Yeni Şifre (Tekrar)</Label>
                        <Input 
                          id="confirm-pass" 
                          type="password"
                          autoComplete="new-password"
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-6 pt-4 border-t">
                      <div className="text-sm text-muted-foreground">Son olarak 3 ay önce değiştirildi.</div>
                      <Button type="submit" disabled={loading}>
                        {loading ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            
          </div>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
