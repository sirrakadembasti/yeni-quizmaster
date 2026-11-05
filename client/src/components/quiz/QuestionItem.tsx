import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ui/image-upload";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, GripVertical, Trash2, Image as ImageIcon, X, PlusCircle } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

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
  onRemoveOption: (questionId: number | string, optionIndex: number) => void;
}

const surveyTypes = [
  { value: 'single-choice', label: 'Tek Seçim' },
  { value: 'multiple-choice', label: 'Çoklu Seçim' },
  { value: 'open-text', label: 'Açık Uçlu' },
  { value: 'rating', label: 'Derecelendirme' },
  { value: 'likert', label: 'Likert Ölçeği' },
];

export function QuestionItem({ question, index, totalQuestions, contentType, onUpdate, onRemove, onUpdateOption, onRemoveOption }: QuestionItemProps) {
  const [isImageOpen, setIsImageOpen] = useState(false);
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
    <Card data-question-id={String(question.id)} className="relative group border-border/60 hover:border-primary/40 transition-colors">
      <div className="absolute inset-y-0 left-0 w-1 rounded-l-xl bg-primary/20 group-hover:bg-primary" />
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2"><div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{index + 1}</div><CardTitle className="text-base">{isSurvey ? 'Anket Sorusu' : 'Sınav Sorusu'}</CardTitle></div>
        <div className="flex items-center gap-2"><GripVertical className="h-4 w-4 text-muted-foreground" /><Button aria-label={`${index + 1}. soruyu sil`} type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onRemove(question.id)} disabled={totalQuestions === 1}><Trash2 className="h-4 w-4" /></Button></div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isSurvey && <div className="space-y-1.5"><Label htmlFor={`question-type-${question.id}`}>Soru Türü</Label><Select value={question.type} onValueChange={changeType}><SelectTrigger id={`question-type-${question.id}`}><SelectValue /></SelectTrigger><SelectContent>{surveyTypes.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>}
        <div className="space-y-1.5"><Label htmlFor={`question-text-${question.id}`}>Soru Metni</Label><Textarea id={`question-text-${question.id}`} value={question.text} onChange={(event) => onUpdate(question.id, 'text', event.target.value)} className="min-h-[80px] resize-none" /></div>
        <Collapsible open={isImageOpen} onOpenChange={setIsImageOpen} className="border-t pt-3">
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" className="flex w-full justify-between px-2">
              <span className="flex items-center gap-2 text-muted-foreground"><ImageIcon className="h-4 w-4" />Soru Görseli (Opsiyonel){question.imageUrl && <span className="text-xs font-medium text-emerald-600">Görsel eklendi</span>}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${isImageOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <ImageUpload value={question.imageUrl} onChange={(url) => onUpdate(question.id, 'imageUrl', url)} onRemove={() => onUpdate(question.id, 'imageUrl', undefined)} />
          </CollapsibleContent>
        </Collapsible>
        {question.type === 'rating' && <div className="space-y-1.5 border-t pt-3"><Label htmlFor={"rating-" + question.id}>En Yüksek Değer</Label><Input id={"rating-" + question.id} type="number" min={3} max={10} value={question.config?.max || 5} onChange={(event) => onUpdate(question.id, 'config', { max: Math.min(10, Math.max(3, Number(event.target.value) || 5)) })} /></div>}
        {needsOptions && (
          <div className="space-y-2 border-t pt-3">
            <Label>Seçenekler</Label>
            {!isSurvey && <p className="text-xs text-muted-foreground">Doğru cevabı soldaki işaretle belirleyin.</p>}
            {question.options.map((option, optionIndex) => (
              <div key={optionIndex} className="flex items-center gap-2">
                {!isSurvey && <button type="button" aria-label={`${index + 1}. soru: ${optionIndex + 1}. seçenek doğru cevap`} aria-pressed={question.correctAnswer === optionIndex} onClick={() => onUpdate(question.id, 'correctAnswer', optionIndex)} className={"h-5 w-5 rounded-full border-2 " + (question.correctAnswer === optionIndex ? 'border-primary bg-primary' : 'border-input hover:border-primary/50')} />}
                <Input aria-label={`${index + 1}. soru: ${optionIndex + 1}. seçenek`} value={option} onChange={(event) => onUpdateOption(question.id, optionIndex, event.target.value)} placeholder={(optionIndex + 1) + ". seçenek"} />
                {question.options.length > 2 && <Button aria-label={`${index + 1}. soru: ${optionIndex + 1}. seçeneği sil`} type="button" variant="ghost" size="icon" onClick={() => onRemoveOption(question.id, optionIndex)}><X className="h-4 w-4" /></Button>}
              </div>
            ))}
            {question.options.length < 10 && <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => onUpdate(question.id, 'options', [...question.options, ''])}><PlusCircle className="h-4 w-4" />Seçenek Ekle</Button>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
