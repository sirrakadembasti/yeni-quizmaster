import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, User, ArrowRight, Home } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { login, register } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [isForgotOpen, setIsForgotOpen] = useState(false);

  // Login State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register State
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");

  // Forgot Password State
  const [forgotEmail, setForgotEmail] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const success = await login(loginEmail, loginPassword);
      
      if (success) {
        toast({
          title: "Giriş Başarılı",
          description: "Yönlendiriliyorsunuz...",
          className: "bg-emerald-50 border-emerald-200 text-emerald-800"
        });
        // Biraz bekle sonra yönlendir
        setTimeout(() => setLocation("/"), 500);
      } else {
        toast({
          variant: "destructive",
          title: "Giriş Başarısız",
          description: "E-posta veya şifre hatalı.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Bir sorun oluştu, lütfen tekrar deneyin.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Şifre doğrulama
    if (regPassword !== regConfirmPassword) {
      toast({
        variant: "destructive",
        title: "Şifreler Uyuşmuyor",
        description: "Şifreleriniz eşleşmiyor, lütfen kontrol edin.",
      });
      setIsLoading(false);
      return;
    }

    if (regPassword.length < 6) {
      toast({
        variant: "destructive",
        title: "Zayıf Şifre",
        description: "Şifreniz en az 6 karakter olmalıdır.",
      });
      setIsLoading(false);
      return;
    }

    try {
      const result = await register(regName, regEmail, regPassword);
      
      if (result === true) {
        toast({
          title: "Kayıt Başarılı",
          description: "Hesabınız oluşturuldu, yönlendiriliyorsunuz...",
          className: "bg-emerald-50 border-emerald-200 text-emerald-800"
        });
        // Biraz bekle sonra yönlendir
        setTimeout(() => setLocation("/"), 500);
      } else {
        toast({
          variant: "destructive",
          title: "Kayıt Başarısız",
          description: typeof result === 'string' ? result : "Kayıt işlemi gerçekleştirilemedi.",
        });
      }
    } catch (error) {
      console.error("Register error:", error);
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Bir sorun oluştu, lütfen tekrar deneyin.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsForgotLoading(true);

    try {
      await apiRequest("POST", "/api/auth/forgot-password", { email: forgotEmail });
      
      toast({
        title: "E-posta Gönderildi",
        description: "Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.",
        className: "bg-emerald-50 border-emerald-200 text-emerald-800"
      });
      setIsForgotOpen(false);
      setForgotEmail("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Hata",
        description: error.message || "E-posta gönderilirken bir sorun oluştu.",
      });
    } finally {
      setIsForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      {/* Navigation Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-50">
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")} className="rounded-full" title="Anasayfaya Dön">
          <Home className="h-5 w-5" />
        </Button>
      </div>

      {/* Background Elements */}
      <div className="absolute inset-0 bg-grid-slate-200/50 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-800/50 -z-10" />
      <div className="absolute top-0 -left-4 w-72 h-72 bg-primary/30 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob" />
      <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000" />
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000" />

      <Card className="w-full max-w-md mx-4 shadow-2xl border-border/50 backdrop-blur-sm bg-card/90">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground mb-2 shadow-lg shadow-primary/30">
            <span className="font-heading font-bold text-2xl">Q</span>
          </div>
          <CardTitle className="text-2xl font-bold font-heading">QuizMaster</CardTitle>
          <CardDescription>
            Öğrenme ve değerlendirme platformuna hoş geldiniz.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Giriş Yap</TabsTrigger>
              <TabsTrigger value="register">Kayıt Ol</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-posta</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="email" 
                      type="text" 
                      placeholder="ad@ornek.com" 
                      className="pl-9" 
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Şifre</Label>
                    
                    <Dialog open={isForgotOpen} onOpenChange={setIsForgotOpen}>
                      <DialogTrigger asChild>
                        <button type="button" className="text-xs text-primary hover:underline">Unuttum?</button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Şifremi Unuttum</DialogTitle>
                          <DialogDescription>
                            E-posta adresinizi girin, size şifre sıfırlama bağlantısı gönderelim.
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleForgotPassword} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="forgot-email">E-posta Adresi</Label>
                            <div className="relative">
                              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input 
                                id="forgot-email" 
                                type="email" 
                                placeholder="ad@ornek.com" 
                                className="pl-9"
                                value={forgotEmail}
                                onChange={(e) => setForgotEmail(e.target.value)}
                                required 
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button className="w-full" type="submit" disabled={isForgotLoading}>
                              {isForgotLoading ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Gönderiliyor...
                                </>
                              ) : (
                                "Sıfırlama Bağlantısı Gönder"
                              )}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="password" 
                      type="password" 
                      placeholder="••••••••" 
                      className="pl-9"
                      autoComplete="current-password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required 
                    />
                  </div>
                </div>
                <Button className="w-full" type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Giriş Yapılıyor...
                    </>
                  ) : (
                    <>
                      Giriş Yap <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
                </form>
                </TabsContent>            
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-name">Ad Soyad</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="reg-name" 
                      placeholder="Adınız Soyadınız" 
                      className="pl-9" 
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">E-posta</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="reg-email" 
                      type="email" 
                      placeholder="ad@ornek.com" 
                      className="pl-9" 
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">Şifre</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="reg-password" 
                      type="password" 
                      placeholder="••••••••" 
                      className="pl-9"
                      autoComplete="new-password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-confirm-password">Şifreyi Onayla</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="reg-confirm-password" 
                      type="password" 
                      placeholder="••••••••" 
                      className="pl-9"
                      autoComplete="new-password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground text-center">
                  <p>Kayıt olduktan sonra <strong>Öğrenci</strong> rolüyle başlayacaksınız.</p>
                  <p className="mt-1">Rol değişikliği sadece yönetici tarafından yapılabilir.</p>
                </div>
                <div className="pt-2">
                  <Button className="w-full" type="submit" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Hesap Oluşturuluyor...
                      </>
                    ) : (
                      "Kayıt Ol ve Başla"
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Kayıt olarak Kullanım Koşulları ve Gizlilik Politikasını kabul etmiş olursunuz.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
