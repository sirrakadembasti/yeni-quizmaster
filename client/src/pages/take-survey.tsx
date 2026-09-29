import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { surveyApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { ClipboardCheck, Loader2 } from "lucide-react";

export default function TakeSurveyPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const { data, isLoading } = useQuery({ queryKey: ['survey', id], queryFn: () => surveyApi.getSurvey(id!) , enabled: Boolean(id) });
  const mutation = useMutation({
    mutationFn: () => surveyApi.submitSurvey(id!, answers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-surveys'] });
      toast({ title: 'Anket gönderildi', description: 'Yanıtlarınız başarıyla kaydedildi.' });
      navigate('/student/surveys');
    },
    onError: (error: Error) => toast({ title: 'Anket gönderilemedi', description: error.message, variant: 'destructive' }),
  });

  if (isLoading) return <DashboardLayout><div className="p-8 text-center text-muted-foreground">Anket yükleniyor...</div></DashboardLayout>;
  if (!data) return <DashboardLayout><div className="p-8 text-center text-destructive">Anket bulunamadı.</div></DashboardLayout>;

  const setAnswer = (questionId: string, value: unknown) => setAnswers((current) => ({ ...current, [questionId]: value }));
  const toggleMultiple = (questionId: string, option: string) => {
    const current = Array.isArray(answers[questionId]) ? answers[questionId] as string[] : [];
    setAnswer(questionId, current.includes(option) ? current.filter((item) => item !== option) : [...current, option]);
  };
  const canSubmit = data.questions.length > 0 && data.questions.every((question) => {
    const value = answers[question.id];
    return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== '';
  });

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl page-stack">
        <div><h1 className="flex items-center gap-2 text-2xl font-bold"><ClipboardCheck className="h-7 w-7 text-primary" />{data.survey.title}</h1><p className="mt-1 text-sm text-muted-foreground">{data.survey.description || 'Tüm soruları yanıtlayıp anketi gönderin.'}</p></div>
        {data.submitted ? <Card><CardContent className="p-8 text-center">Bu anketi daha önce yanıtladınız.</CardContent></Card> :
          data.questions.map((question, index) => (
            <Card key={question.id}>
              <CardHeader className="pb-2"><CardTitle className="text-base">{index + 1}. {question.text}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {question.type === 'open-text' && <Textarea maxLength={5000} className="min-h-[110px]" value={(answers[question.id] as string) || ''} onChange={(event) => setAnswer(question.id, event.target.value)} />}
                {question.type === 'rating' && <div className="flex flex-wrap gap-2">{Array.from({ length: Number(question.config?.max || 5) }, (_, item) => item + 1).map((value) => <Button key={value} type="button" variant={answers[question.id] === value ? 'default' : 'outline'} size="sm" onClick={() => setAnswer(question.id, value)}>{value}</Button>)}</div>}
                {question.type === 'multiple-choice' && question.options?.map((option) => <label key={option} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"><Checkbox checked={Array.isArray(answers[question.id]) && (answers[question.id] as string[]).includes(option)} onCheckedChange={() => toggleMultiple(question.id, option)} /><span>{option}</span></label>)}
                {['single-choice', 'likert'].includes(question.type) && question.options?.map((option) => <button key={option} type="button" className={"w-full rounded-lg border p-3 text-left transition-colors " + (answers[question.id] === option ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted')} onClick={() => setAnswer(question.id, option)}>{option}</button>)}
              </CardContent>
            </Card>
          ))
        }
        {!data.submitted && <Button size="lg" disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Anketi Gönder</Button>}
      </div>
    </DashboardLayout>
  );
}
