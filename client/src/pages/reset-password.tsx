import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, ArrowLeft, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function ResetPasswordPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // URL'den token'ı al
  const queryParams = new URLSearchParams(window.location.search);
  const token = queryParams.get("token");

  useEffect(() => {
    if (!token) {
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Geçersiz veya eksik sıfırlama bağlantısı.",
      });
      setLocation("/auth");
    }
  }, [token, setLocation, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Şifreler Uyuşmuyor",
        description: "Girdiğiniz şifreler birbirleşyle eşleşmiyor.",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "Zayıf Şifre",
        description: "Yeni şifreniz en az 6 karakter olmalıdır.",
      });
      return;
    }

    setIsLoading(true);

    try {
      await apiRequest("POST", "/api/auth/reset-password", {
        token,
        password
      });
      
      setIsSuccess(true);
      toast({
        title: "Başarılı",
        description: "Şifreniz başarıyla sıfırlandı. Giriş yapabilirsiniz.",
        className: "bg-emerald-50 border-emerald-200 text-emerald-800"
      });
      
      // 3 saniye sonra giriş sayfasına yönlendir
      setTimeout(() => setLocation("/auth"), 3000);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Hata",
        description: error.message || "Şifre sıfırlanırken bir sorun oluştu.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
        <Card className="w-full max-w-md mx-4 shadow-2xl border-border/50 backdrop-blur-sm bg-card/90">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-2">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <CardTitle className="text-2xl font-bold font-heading">Şifre Sıfırlandı</CardTitle>
            <CardDescription>
              Şifreniz başarıyla güncellendi. Giriş sayfasına yönlendiriliyorsunuz...
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button className="w-full" onClick={() => setLocation("/auth")}>
              Hemen Giriş Yap
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-grid-slate-200/50 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-800/50 -z-10" />
      
      <Card className="w-full max-w-md mx-4 shadow-2xl border-border/50 backdrop-blur-sm bg-card/90">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground mb-2 shadow-lg shadow-primary/30">
            <Lock className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold font-heading">Yeni Şifre Belirle</CardTitle>
          <CardDescription>
            Lütfen hesabınız için yeni bir güvenli şifre oluşturun.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Yeni Şifre</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="••••••••" 
                  className="pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Şifreyi Onayla</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="confirm-password" 
                  type="password" 
                  placeholder="••••••••" 
                  className="pl-9"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required 
                />
              </div>
            </div>
            <Button className="w-full" type="submit" disabled={isLoading || !token}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Güncelleniyor...
                </>
              ) : (
                "Şifreyi Güncelle"
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center border-t p-4 mt-2">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/auth")} className="text-xs text-muted-foreground">
            <ArrowLeft className="mr-2 h-3 w-3" /> Giriş Sayfasına Dön
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
