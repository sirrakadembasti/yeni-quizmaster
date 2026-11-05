import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Users, BarChart3, Zap, ArrowRight } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default function HomePage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex flex-col bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-indigo-950">
      {/* Navigation */}
      <nav className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/20">
              Q
            </div>
            <span className="font-bold text-xl hidden sm:inline tracking-tight">QuizMaster</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="h-6 w-[1px] bg-border mx-1" />
            <Button variant="ghost" className="font-bold" onClick={() => setLocation("/auth")}>
              Giriş Yap
            </Button>
            <Button className="font-bold shadow-lg shadow-indigo-500/20" onClick={() => setLocation("/auth")}>
              Kayıt Ol
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-20">
        <div className="max-w-3xl text-center space-y-6">
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold font-heading bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Öğrenmeyi Yeniden Tanımla
            </h1>
            <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300">
              QuizMaster ile eğitim platformunuzda sınav ve değerlendirme sistemini modernleştirin. Öğrencileri değerlendirin, başarılarını takip edin.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button 
              size="lg" 
              onClick={() => setLocation("/auth")}
              className="text-base h-12 px-8 gap-2"
            >
              Başlayın <ArrowRight className="w-5 h-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setLocation("/demo")}
              className="text-base h-12 px-8 gap-2 border-indigo-200 dark:border-indigo-800"
            >
              Canlı Demo Vitrin (4 Rol)
            </Button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-white dark:bg-slate-900/50 dark:bg-slate-800/50 backdrop-blur-sm border-t">
        <div className="max-w-6xl mx-auto px-4 py-20">
          <h2 className="text-3xl font-bold text-center mb-12">
            Neler Sunuyoruz?
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="space-y-2">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center">
                  <Zap className="w-6 h-6 text-indigo-600" />
                </div>
                <CardTitle>Hızlı & Kolay</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Sınavları dakikalar içinde oluşturun ve yönetin. Sezgisel arayüz ile herkes kullanabilir.
                </CardDescription>
              </CardContent>
            </Card>

            {/* Feature 2 */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="space-y-2">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-purple-600" />
                </div>
                <CardTitle>Detaylı Raporlar</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Öğrenci başarısını gerçek zamanlı izleyin. Detaylı analiz ve raporlarla gelişimi takip edin.
                </CardDescription>
              </CardContent>
            </Card>

            {/* Feature 3 */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="space-y-2">
                <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-pink-600" />
                </div>
                <CardTitle>Çoklu Kullanıcı</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Öğretmen, öğrenci ve yönetici rolleri ile esnek yönetim. Her rol için özel dashboard.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="border-t bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-6">
          <h2 className="text-3xl font-bold">Hemen Başlamaya Hazır mısınız?</h2>
          <p className="text-lg text-indigo-100">
            Ücretsiz olarak kaydolun ve Quiz Master'ın tüm özelliklerinden yararlanın.
          </p>
          <Button 
            size="lg"
            variant="secondary"
            onClick={() => setLocation("/auth")}
            className="text-base h-12 px-8 gap-2"
          >
            Kayıt Ol <CheckCircle className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t bg-white dark:bg-slate-900/80 backdrop-blur-sm py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-slate-600 dark:text-slate-300 dark:text-slate-400 dark:text-slate-500">
          <p>&copy; 2025 QuizMaster. Tüm hakları saklıdır.</p>
        </div>
      </footer>
    </div>
  );
}
