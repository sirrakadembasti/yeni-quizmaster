import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Users, Clock } from "lucide-react";

interface QuizSettingsProps {
  contentType: 'exam' | 'survey';
  title: string; setTitle: (val: string) => void;
  description: string; setDescription: (val: string) => void;
  category: string; setCategory: (val: string) => void;
  dbCategories: any[]; teacherClasses: any[]; assignedClassIds: string[];
  toggleClass: (classId: string) => void;
  timeLimitEnabled: boolean; setTimeLimitEnabled: (val: boolean) => void;
  timeLimit?: number; setTimeLimit: (val: number | undefined) => void;
  shuffleQuestions: boolean; setShuffleQuestions: (val: boolean) => void;
}

export function QuizSettings({
  contentType, title, setTitle, description, setDescription, category, setCategory,
  dbCategories, teacherClasses, assignedClassIds, toggleClass, timeLimitEnabled, setTimeLimitEnabled,
  timeLimit, setTimeLimit, shuffleQuestions, setShuffleQuestions,
}: QuizSettingsProps) {
  const isSurvey = contentType === 'survey';
  const label = isSurvey ? 'Anket' : 'Sınav';
  return (
    <div className="space-y-4 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
      <Card className="border-border/60 shadow-sm dark:shadow-none">
        <CardHeader><CardTitle>Temel Bilgiler</CardTitle><CardDescription>{label} görünümünü, hedefini ve temel ayarlarını belirleyin.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">{label} Başlığı <span className="text-destructive">*</span></Label>
              <Input id="title" placeholder={isSurvey ? "Örn: Öğrenci Memnuniyet Anketi" : "Örn: 10. Sınıf Matematik Yazılısı"} value={title} onChange={(event) => setTitle(event.target.value)} className="font-medium" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Açıklama (Opsiyonel)</Label>
            <Textarea id="description" placeholder={label + " hakkında kısa bir açıklama veya yönerge ekleyin..."} className="min-h-[88px] resize-none" value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-4 border-t pt-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Ders / Kategori</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Kategori seçin" /></SelectTrigger>
                <SelectContent>{dbCategories.map((item) => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" />Yayınlanacak Sınıflar</Label>
              <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/20 p-3">
                {teacherClasses.length > 0 ? teacherClasses.map((classroom) => (
                  <div key={classroom.id} className="flex items-center space-x-2">
                    <Checkbox id={"class-" + classroom.id} checked={assignedClassIds.includes(classroom.id)} onCheckedChange={() => toggleClass(classroom.id)} />
                    <label htmlFor={"class-" + classroom.id} className="cursor-pointer text-sm font-medium">{classroom.name}</label>
                  </div>
                )) : <p className="col-span-2 text-xs italic text-muted-foreground">Yetkili sınıf bulunmuyor.</p>}
              </div>
              <p className="text-[11px] text-muted-foreground">Sınıfı bulunan öğrenciler için en az bir hedef sınıf seçilmelidir.</p>
            </div>
          </div>
        </CardContent>
      </Card>
      {!isSurvey && (
        <Card className="border-border/60 shadow-sm dark:shadow-none">
          <CardHeader><CardTitle>Sınav Kuralları</CardTitle><CardDescription>Süre ve soru sıralaması ayarları yalnız sınavlarda uygulanır.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border bg-card p-3">
              <div><Label className="flex items-center gap-2 text-base font-medium"><Clock className="h-4 w-4 text-primary" />Süre Sınırı</Label><p className="text-sm text-muted-foreground">Sınav için maksimum süre belirleyin.</p></div>
              <Switch checked={timeLimitEnabled} onCheckedChange={setTimeLimitEnabled} />
            </div>
            {timeLimitEnabled && <div className="flex items-center gap-4 rounded-lg border bg-accent/20 p-3"><Label htmlFor="timeLimit">Süre (Dakika)</Label><Input id="timeLimit" type="number" min="1" className="w-24 text-center font-mono" value={timeLimit || ''} onChange={(event) => setTimeLimit(parseInt(event.target.value) || undefined)} /></div>}
            <div className="flex items-center justify-between rounded-lg border bg-card p-3">
              <div><Label className="text-base font-medium">Soruları Karıştır</Label><p className="text-sm text-muted-foreground">Her öğrenciye soruları farklı sırada gösterin.</p></div>
              <Switch checked={shuffleQuestions} onCheckedChange={setShuffleQuestions} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
