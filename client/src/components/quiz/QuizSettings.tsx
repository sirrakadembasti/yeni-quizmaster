import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Users, Clock } from "lucide-react";

interface QuizSettingsProps {
  title: string;
  setTitle: (val: string) => void;
  description: string;
  setDescription: (val: string) => void;
  category: string;
  setCategory: (val: string) => void;
  dbCategories: any[];
  teacherClasses: any[];
  assignedClassIds: string[];
  toggleClass: (classId: string) => void;
  timeLimitEnabled: boolean;
  setTimeLimitEnabled: (val: boolean) => void;
  timeLimit?: number;
  setTimeLimit: (val: number | undefined) => void;
  shuffleQuestions: boolean;
  setShuffleQuestions: (val: boolean) => void;
}

export function QuizSettings({
  title, setTitle,
  description, setDescription,
  category, setCategory,
  dbCategories,
  teacherClasses,
  assignedClassIds, toggleClass,
  timeLimitEnabled, setTimeLimitEnabled,
  timeLimit, setTimeLimit,
  shuffleQuestions, setShuffleQuestions
}: QuizSettingsProps) {
  return (
    <div className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
      <Card className="border-border/60 shadow-sm dark:shadow-none">
        <CardHeader>
          <CardTitle>Temel Bilgiler</CardTitle>
          <CardDescription>Sınavınızın görünümünü ve detaylarını ayarlayın.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          <div className="space-y-2">
            <Label htmlFor="title">Sınav Başlığı <span className="text-destructive">*</span></Label>
            <Input 
              id="title" 
              placeholder="Örn: 10. Sınıf Matematik 1. Dönem 1. Yazılı" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-lg font-medium"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Açıklama (Opsiyonel)</Label>
            <Textarea 
              id="description" 
              placeholder="Sınav hakkında kısa bir bilgi veya yönerge ekleyin..." 
              className="min-h-[100px] resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
            <div className="space-y-3">
              <Label>Ders</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Ders seçin" />
                </SelectTrigger>
                <SelectContent>
                  {dbCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.name}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Yayınlanacak Sınıflar
              </Label>
              <div className="grid grid-cols-2 gap-2 p-3 border rounded-lg bg-muted/20">
                {teacherClasses.length > 0 ? (
                  teacherClasses.map((cls) => (
                    <div key={cls.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`class-${cls.id}`} 
                        checked={assignedClassIds.includes(cls.id)}
                        onCheckedChange={() => toggleClass(cls.id)}
                      />
                      <label
                        htmlFor={`class-${cls.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {cls.name}
                      </label>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground italic col-span-2">Henüz bir sınıfınız bulunmuyor.</p>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">Sınıf seçilmezse sınav tüm öğrencilere açık olacaktır.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-sm dark:shadow-none">
        <CardHeader>
          <CardTitle>Sınav Kuralları</CardTitle>
          <CardDescription>Öğrencilerin sınav deneyimini şekillendirin.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
            <div className="space-y-0.5">
              <Label className="text-base font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Süre Sınırı
              </Label>
              <p className="text-sm text-muted-foreground">Sınav için maksimum süre belirleyin</p>
            </div>
            <Switch checked={timeLimitEnabled} onCheckedChange={setTimeLimitEnabled} />
          </div>
          
          {timeLimitEnabled && (
            <div className="flex items-center gap-4 p-4 border rounded-lg bg-accent/20 animate-in fade-in zoom-in duration-300">
              <Label htmlFor="timeLimit" className="whitespace-nowrap font-medium">Süre (Dakika):</Label>
              <Input 
                id="timeLimit" 
                type="number" 
                min="1" 
                className="w-24 font-mono text-center" 
                value={timeLimit || ''}
                onChange={(e) => setTimeLimit(parseInt(e.target.value) || undefined)}
              />
            </div>
          )}

          <div className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Soruları Karıştır</Label>
              <p className="text-sm text-muted-foreground">Her öğrenciye soruları farklı sırada gösterin</p>
            </div>
            <Switch checked={shuffleQuestions} onCheckedChange={setShuffleQuestions} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
