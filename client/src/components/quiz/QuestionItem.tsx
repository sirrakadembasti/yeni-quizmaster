import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ui/image-upload";
import { GripVertical, Trash2, Image as ImageIcon, X, PlusCircle } from "lucide-react";

export interface QuestionForm {
  id: number | string;
  type: string;
  text: string;
  options: string[];
  correctAnswer: number;
  imageUrl?: string;
}

interface QuestionItemProps {
  question: QuestionForm;
  index: number;
  isFirst: boolean;
  totalQuestions: number;
  onUpdate: (id: number | string, field: keyof QuestionForm, value: any) => void;
  onRemove: (id: number | string) => void;
  onUpdateOption: (questionId: number | string, optionIndex: number, value: string) => void;
}

export function QuestionItem({ question, index, totalQuestions, onUpdate, onRemove, onUpdateOption }: QuestionItemProps) {
  return (
    <Card className="relative group border-border/60 hover:border-primary/40 transition-colors">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20 rounded-l-xl group-hover:bg-primary transition-colors" />
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{index + 1}</div>
          <CardTitle className="text-base">Soru Düzenle</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onRemove(question.id)} disabled={totalQuestions === 1}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Soru Metni</Label>
          <Textarea value={question.text} onChange={(event) => onUpdate(question.id, 'text', event.target.value)} className="min-h-[90px] resize-none" />
        </div>
        <div className="space-y-2 border-t pt-3">
          <Label className="flex items-center gap-2 text-muted-foreground"><ImageIcon className="h-4 w-4" />Soru Görseli (Opsiyonel)</Label>
          <ImageUpload value={question.imageUrl} onChange={(url) => onUpdate(question.id, 'imageUrl', url)} onRemove={() => onUpdate(question.id, 'imageUrl', undefined)} />
        </div>

        <div className="space-y-3 border-t pt-3">
          <Label>Seçenekler</Label>
          <p className="text-xs text-muted-foreground">Doğru cevabı soldaki yuvarlak işaretle belirleyin.</p>
          {question.options.map((option, optionIndex) => (
            <div key={optionIndex} className="flex items-center gap-2">
              <button 
                type="button" 
                aria-label="Doğru cevap" 
                onClick={() => onUpdate(question.id, 'correctAnswer', optionIndex)} 
                className={`h-5 w-5 rounded-full border-2 transition-colors ${question.correctAnswer === optionIndex ? 'border-primary bg-primary' : 'border-input hover:border-primary/50'}`} 
              />
              <Input value={option} onChange={(event) => onUpdateOption(question.id, optionIndex, event.target.value)} placeholder={`${optionIndex + 1}. seçenek`} />
              {question.options.length > 2 && (
                <Button variant="ghost" size="icon" onClick={() => onUpdate(question.id, 'options', question.options.filter((_, itemIndex) => itemIndex !== optionIndex))}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {question.options.length < 7 && (
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => onUpdate(question.id, 'options', [...question.options, ''])}>
              <PlusCircle className="h-4 w-4" />Seçenek Ekle
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}