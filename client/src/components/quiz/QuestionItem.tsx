import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ui/image-upload";
import { GripVertical, Trash2, Image as ImageIcon, X } from "lucide-react";

export interface QuestionForm {
  id: number | string;
  type: string;
  text: string;
  options: string[];
  correctAnswer: number; // index of correct option
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

export function QuestionItem({
  question,
  index,
  totalQuestions,
  onUpdate,
  onRemove,
  onUpdateOption
}: QuestionItemProps) {
  return (
    <Card className="relative group border-border/60 hover:border-primary/40 transition-colors">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20 rounded-l-xl group-hover:bg-primary transition-colors" />
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-sm">
            {index + 1}
          </div>
          <CardTitle className="text-base">Soru Düzenle</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing">
            <GripVertical className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onRemove(question.id)}
            disabled={totalQuestions === 1}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Soru Metni <span className="text-destructive">*</span></Label>
          </div>
          <Textarea 
            placeholder="Sorunuzu buraya yazın..."
            value={question.text}
            onChange={(e) => onUpdate(question.id, 'text', e.target.value)}
            className="min-h-[100px] text-base resize-none"
          />
        </div>

        <div className="space-y-2 pt-2 border-t">
          <Label className="flex items-center gap-2 text-muted-foreground">
            <ImageIcon className="h-4 w-4" /> Soru Görseli (Opsiyonel)
          </Label>
          <ImageUpload 
            value={question.imageUrl} 
            onChange={(url) => onUpdate(question.id, 'imageUrl', url)}
            onRemove={() => onUpdate(question.id, 'imageUrl', undefined)}
          />
        </div>

        <div className="space-y-3 pt-4 border-t">
          <Label className="text-sm font-semibold">Seçenekler</Label>
          <p className="text-xs text-muted-foreground mb-4">Doğru cevabı belirtmek için seçeneğin yanındaki radyo butonunu işaretleyin.</p>
          
          {question.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onUpdate(question.id, 'correctAnswer', i)}
                className={`flex items-center justify-center w-6 h-6 rounded-full border-2 transition-all ${
                  question.correctAnswer === i 
                    ? 'border-primary bg-primary text-primary-foreground' 
                    : 'border-input hover:border-primary/50'
                }`}
                title={question.correctAnswer === i ? "Doğru cevap olarak seçildi" : "Doğru cevap olarak işaretle"}
              >
                {question.correctAnswer === i && <div className="w-2.5 h-2.5 bg-primary-foreground rounded-full" />}
              </button>
              
              <div className="flex-1 flex items-center gap-2">
                <span className="font-semibold text-muted-foreground w-6 text-center select-none">
                  {String.fromCharCode(65 + i)})
                </span>
                <Input 
                  placeholder={`${i + 1}. Seçeneği yazın`}
                  value={opt}
                  onChange={(e) => onUpdateOption(question.id, i, e.target.value)}
                  className={`flex-1 ${question.correctAnswer === i ? 'border-primary/50 bg-primary/5 font-medium' : ''}`}
                />
                {question.options.length > 2 && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      const newOptions = question.options.filter((_, idx) => idx !== i);
                      onUpdate(question.id, 'options', newOptions);
                      if (question.correctAnswer === i) {
                        onUpdate(question.id, 'correctAnswer', 0);
                      } else if (question.correctAnswer > i) {
                        onUpdate(question.id, 'correctAnswer', question.correctAnswer - 1);
                      }
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          
          {question.options.length < 6 && (
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2 ml-11 border-dashed text-muted-foreground hover:text-primary gap-1.5"
              onClick={() => onUpdate(question.id, 'options', [...question.options, ""])}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Seçenek Ekle
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

import { PlusCircle } from "lucide-react";
