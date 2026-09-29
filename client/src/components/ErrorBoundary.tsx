import { Component, type ErrorInfo, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900/80 dark:bg-slate-800/80 p-4">
          <Card className="max-w-md w-full border-destructive/50 shadow-xl">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="text-2xl font-bold text-slate-900 dark:text-slate-50">Bir Şeyler Yanlış Gitti</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <p className="text-slate-600 dark:text-slate-300">
                Uygulama yüklenirken beklenmeyen bir hata oluştu. Lütfen sayfayı yenilemeyi deneyin.
              </p>
              
              {process.env.NODE_ENV === 'development' && (
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded text-left overflow-auto max-h-32">
                  <code className="text-xs text-destructive">{this.state.error?.toString()}</code>
                </div>
              )}

              <Button 
                onClick={() => window.location.reload()} 
                className="w-full gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Sayfayı Yenile
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
