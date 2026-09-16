import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Loader2, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  Wand2,
  Settings2,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Database,
  Info
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { aiApi } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

interface AIQuestionGeneratorProps {
  onGenerate: (questions: any[]) => void;
  quizTitle?: string;
  quizDescription?: string;
}

export function AIQuestionGenerator({ 
  onGenerate, 
  quizTitle = "", 
  quizDescription = "" 
}: AIQuestionGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [difficulty, setDifficulty] = useState("medium");
  const [model, setModel] = useState("gemini-3.8-flash");
  const [count, setCount] = useState("3");
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Custom Config States
  const [showCustomConfig, setShowCustomConfig] = useState(false);
  const [customBaseUrl, setCustomBaseUrl] = useState("https://generativelanguage.googleapis.com/v1beta/openai/");
  const [customApiKey, setCustomApiKey] = useState("");
  const [customModel, setCustomModel] = useState("");
  
  // Test States
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  
  const { toast } = useToast();

  // Combined topic from title and description
  const topic = `${quizTitle}${quizDescription ? ' - ' + quizDescription : ''}`.trim();

  const isConfigTested = () => {
    if (!showCustomConfig) return true;
    return testResult?.success === true;
  };

  const handleTestConfig = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const activeModel = model === "custom" ? customModel : model;
      const response = await aiApi.testAIConfig({
        baseUrl: customBaseUrl,
        apiKey: customApiKey || undefined,
        model: activeModel
      });
      
      setTestResult({
        success: response.success,
        message: response.message
      });

      if (response.success) {
        toast({ title: "Başarılı", description: "AI yapılandırması doğrulandı." });
      } else {
        toast({ title: "Hata", description: response.details || "Bağlantı kurulamadı.", variant: "destructive" });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: "Bağlantı hatası."
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleGenerate = async () => {
    if (!topic) {
      toast({ 
        title: "Hata", 
        description: "Lütfen önce sınav başlığı veya açıklaması girin", 
        variant: "destructive" 
      });
      return;
    }

    if (showCustomConfig && !isConfigTested()) {
      toast({ title: "Uyarı", description: "Lütfen önce yapılandırmayı test edin.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    try {
      const numCount = Math.min(Math.max(parseInt(count) || 3, 1), 10);
      const activeModel = model === "custom" ? customModel : model;
      
      const response = await aiApi.generateQuestions(
        topic, 
        numCount, 
        difficulty, 
        activeModel,
        showCustomConfig ? customBaseUrl : undefined,
        showCustomConfig ? customApiKey : undefined
      );

      const generatedQuestions = response.questions || [];

      if (generatedQuestions && generatedQuestions.length > 0) {
        onGenerate(generatedQuestions);
        setIsOpen(false);
        toast({
          title: "Sorular Oluşturuldu",
          description: `Yapay zeka başarıyla ${generatedQuestions.length} yeni soru oluşturdu.`,
        });
        resetForm();
      } else {
        toast({
          title: "Hata",
          description: "Sorular oluşturulamadı",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Hata",
        description: error instanceof Error ? error.message : "Sorular oluşturulamadı", variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const resetForm = () => {
    setTestResult(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full gap-2 border-primary/20 text-primary hover:bg-primary/5 hover:text-primary shadow-sm dark:shadow-none h-12">
          <Sparkles className="h-4 w-4" />
          AI ile Soruları Üret
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-heading">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Wand2 className="h-6 w-6 text-primary" />
            </div>
            AI Soru Üretici
          </DialogTitle>
          <DialogDescription className="text-base font-medium text-foreground/80">
            Sınav ayarlarındaki başlık ve açıklamayı temel alarak sorular üretilir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Main Topic Section */}
          <div className="space-y-3 p-4 rounded-xl bg-muted/30 border border-border/50">
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[11px] font-bold uppercase tracking-widest opacity-60">
                Sınav Konusu (Otomatik)
              </Label>
              <Badge variant="outline" className="text-[9px] h-4 bg-background px-1.5 opacity-70">Salt Okunur</Badge>
            </div>
            <div className="text-sm font-medium text-foreground line-clamp-3">
              {topic || (
                <span className="text-destructive font-bold italic">
                  Lütfen önce sınav ayarlarından başlık girin!
                </span>
              )}
            </div>
            <div className="flex items-start gap-2 mt-3 pt-3 border-t border-border/40">
              <Info className="h-3.5 w-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-muted-foreground leading-relaxed italic">
                Bu konu başlığını değiştirmek için ana formdaki <span className="font-bold text-foreground">Sınav Ayarları</span> sekmesine dönerek Başlık veya Açıklama kısımlarını güncelleyin.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label className="text-sm font-bold uppercase tracking-wider opacity-70">Zorluk</Label>
              <Select value={difficulty} onValueChange={setDifficulty} disabled={isGenerating}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Başlangıç Seviyesi</SelectItem>
                  <SelectItem value="medium">Orta Seviye</SelectItem>
                  <SelectItem value="hard">İleri Seviye</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label htmlFor="count" className="text-sm font-bold uppercase tracking-wider opacity-70">Soru Sayısı</Label>
              <Input 
                id="count"
                type="number" 
                min="1" 
                max="10" 
                className="h-11"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                disabled={isGenerating}
              />
            </div>
          </div>

          {/* Model Selection */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-bold uppercase tracking-wider opacity-70">AI Modeli</Label>
              <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-tighter bg-primary/5 text-primary border-primary/20">
                Gemini 3.8 / 2.5 Destekli
              </Badge>
            </div>
            <Select value={model} onValueChange={setModel} disabled={isGenerating}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini-3.8-flash">Gemini 3.8 Flash (Önerilen & Güncel)</SelectItem>
                <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                <SelectItem value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</SelectItem>
                <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                <SelectItem value="custom" className="text-primary font-bold">--- Manuel Model Gir ---</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Config Toggle */}
          <div className="pt-2 border-t border-border">
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-between hover:bg-primary/5 text-muted-foreground font-medium"
              onClick={() => setShowCustomConfig(!showCustomConfig)}
            >
              <span className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Gelişmiş Yapılandırma (Özel API/URL)
              </span>
              {showCustomConfig ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>

            {showCustomConfig && (
              <div className="mt-4 p-4 rounded-xl border border-primary/10 bg-primary/5 space-y-4 animate-in slide-in-from-top-2 duration-300">
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-primary/70">Base URL</Label>
                  <Input 
                    value={customBaseUrl} 
                    onChange={(e) => setCustomBaseUrl(e.target.value)}
                    placeholder="https://.../v1/"
                    className="bg-background"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-primary/70">API Anahtarı (Opsiyonel)</Label>
                  <Input 
                    type="password"
                    value={customApiKey} 
                    onChange={(e) => setCustomApiKey(e.target.value)}
                    placeholder="Girilmezse sunucu anahtarı kullanılır"
                    className="bg-background"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-primary/70">Model ID</Label>
                  <Input 
                    value={model === "custom" ? customModel : model} 
                    onChange={(e) => {
                      if (model === "custom") setCustomModel(e.target.value);
                      else {
                        setModel("custom");
                        setCustomModel(e.target.value);
                      }
                    }}
                    placeholder="Örn: gpt-4o, claude-3-opus..."
                    className="bg-background"
                  />
                  <p className="text-[10px] text-muted-foreground italic mt-1">
                    * Modeli yukarıdaki listeden seçebilir veya buradan manuel ID girebilirsiniz.
                  </p>
                </div>

                <div className="flex items-center justify-between gap-4 pt-2">
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="flex-1 gap-2 bg-background border shadow-sm dark:shadow-none hover:shadow-md transition-all font-bold"
                    onClick={handleTestConfig}
                    disabled={isTesting || isGenerating}
                  >
                    {isTesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <FlaskConical className="h-3 w-3 text-primary" />}
                    Yapılandırmayı Test Et
                  </Button>
                  
                  {testResult && (
                    <div className={`flex items-center gap-1.5 text-xs font-black ${testResult.success ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                      {testResult.success ? 'HAZIR' : 'HATA'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-3">
          <Button 
            variant="outline" 
            onClick={() => setIsOpen(false)}
            disabled={isGenerating}
            className="sm:flex-1"
          >
            İptal
          </Button>
          <Button 
            onClick={handleGenerate} 
            disabled={!topic || isGenerating || (showCustomConfig && !isConfigTested())}
            className="sm:flex-[2] gap-2 h-12 text-base shadow-lg shadow-primary/20 dark:shadow-none"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Sorular Hazırlanıyor...
              </>
            ) : (
              <>
                <Database className="h-5 w-5" />
                Sınav Sorularını Üret
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
