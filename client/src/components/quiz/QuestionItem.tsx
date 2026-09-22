import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ui/image-upload";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GripVertical, Trash2, Image as ImageIcon, X, PlusCircle } from "lucide-react";

export interface QuestionForm {
  id: number | string;
  type: string;
  text: string;
  options: string[];
  correctAnswer: number;
  imageUrl?: string;
  config?: { max?: number };
}

interface QuestionItemProps {
  question: QuestionForm; index: number; isFirst: boolean; totalQuestions: number;
  contentType: 'exam' | 'survey';
  onUpdate: (id: number | string, field: keyof QuestionForm, value: any) => void;
  onRemove: (id: number | string) => void;
  onUpdateOption: (questionId: number | string, optionIndex: number, value: string) => void;
}

const surveyTypes = [
  { value: 'single-choice', label: 'Tek Seçim' },
  { value: 'multiple-choice', label: 'Çoklu Seçim' },
  { value: 'open-text', label: 'Açık Uçlu' },
  { value: 'rating', label: 'Derecelendirme' },
  { value: 'likert', label: 'Likert Ölçeği' },
];

export function QuestionItem({ question, index, totalQuestions, contentType, onUpdate, onRemove, onUpdateOption }: QuestionItemProps) {
  const isSurvey = contentType === 'survey';
  const needsOptions = isSurvey ? ['single-choice', 'multiple-choice', 'likert'].includes(question.type) : true;
  const changeType = (type: string) => {
    onUpdate(question.id, 'type', type);
    if (type === 'likert') onUpdate(question.id, 'options', ['Kesinlikle katılmıyorum', 'Katılmıyorum', 'Kararsızım', 'Katılıyorum', 'Kesinlikle katılıyorum']);
    else if (type === 'open-text' || type === 'rating') onUpdate(question.id, 'options', []);
    else if (question.options.length < 2) onUpdate(question.id, 'options', ['', '', '', '']);
    if (type === 'rating') onUpdate(question.id, 'config', { max: 5 });
  };

  return (
    <Card className="relative group border-border/60 hover:border-primary/40 transition-colors">
      <div className="absolute inset-y-0 left-0 w-1 rounded-l-xl bg-primary/20 group-hover:bg-primary" />
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2"><div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{index + 1}</div><CardTitle className="text-base">{isSurvey ? 'Anket Sorusu' : 'Sınav Sorusu'}</CardTitle></div>
        <div className="flex items-center gap-2"><GripVertical className="h-4 w-4 text-muted-foreground" /><Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onRemove(question.id)} disabled={totalQuestions === 1}><Trash2 className="h-4 w-4" /></Button></div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isSurvey && <div className="space-y-1.5"><Label>Soru Türü</Label><Select value={question.type} onValueChange={changeType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{surveyTypes.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>}
        <div className="space-y-1.5"><Label>Soru Metni</Label><Textarea value={question.text} onChange={(event) => onUpdate(question.id, 'text', event.target.value)} className="min-h-[80px] resize-none" /></div>
        <div className="space-y-2 border-t pt-3"><Label className="flex items-center gap-2 text-muted-foreground"><ImageIcon className="h-4 w-4" />Soru Görseli (Opsiyonel)</Label><ImageUpload value={question.imageUrl} onChange={(url) => onUpdate(question.id, 'imageUrl', url)} onRemove={() => onUpdate(question.id, 'imageUrl', undefined)} /></div>
        {question.type === 'rating' && <div className="space-y-1.5 border-t pt-3"><Label htmlFor={"rating-" + question.id}>En Yüksek Değer</Label><Input id={"rating-" + question.id} type="number" min={3} max={10} value={question.config?.max || 5} onChange={(event) => onUpdate(question.id, 'config', { max: Math.min(10, Math.max(3, Number(event.target.value) || 5)) })} /></div>}
        {needsOptions && (
          <div className="space-y-2 border-t pt-3">
            <Label>Seçenekler</Label>
            {!isSurvey && <p className="text-xs text-muted-foreground">Doğru cevabı soldaki işaretle belirleyin.</p>}
            {question.options.map((option, optionIndex) => (
              <div key={optionIndex} className="flex items-center gap-2">
                {!isSurvey && <button type="button" aria-label="Doğru cevap" onClick={() => onUpdate(question.id, 'correctAnswer', optionIndex)} className={"h-5 w-5 rounded-full border-2 " + (question.correctAnswer === optionIndex ? 'border-primary bg-primary' : 'border-input hover:border-primary/50')} />}
                <Input value={option} onChange={(event) => onUpdateOption(question.id, optionIndex, event.target.value)} placeholder={(optionIndex + 1) + ". seçenek"} />
                {question.options.length > 2 && <Button type="button" variant="ghost" size="icon" onClick={() => onUpdate(question.id, 'options', question.options.filter((_, itemIndex) => itemIndex !== optionIndex))}><X className="h-4 w-4" /></Button>}
              </div>
            ))}
            {question.options.length < 10 && <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => onUpdate(question.id, 'options', [...question.options, ''])}><PlusCircle className="h-4 w-4" />Seçenek Ekle</Button>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
