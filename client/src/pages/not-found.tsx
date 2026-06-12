import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/auth-context";

export default function NotFound() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800">
      <div className="text-center space-y-6 px-4 max-w-md">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="h-24 w-24 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center border-2 border-red-100 dark:border-red-900/50">
            <AlertCircle className="h-12 w-12 text-red-500" />
          </div>
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h1 className="text-6xl font-black text-slate-900 dark:text-slate-50 tracking-tight">404</h1>
          <p className="text-xl font-bold text-slate-700 dark:text-slate-200">Sayfa Bulunamadı</p>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Aradığınız sayfa mevcut değil veya taşınmış olabilir.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="outline"
            className="gap-2 rounded-xl font-bold"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="h-4 w-4" /> Geri Dön
          </Button>
          <Button
            className="gap-2 rounded-xl font-bold"
            onClick={() => navigate(isAuthenticated ? '/' : '/auth')}
          >
            <Home className="h-4 w-4" />
            {isAuthenticated ? 'Dashboard\'a Git' : 'Giriş Sayfası'}
          </Button>
        </div>
      </div>
    </div>
  );
}
