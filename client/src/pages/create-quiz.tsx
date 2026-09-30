import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import {
  Save,
  Settings,
  List,
  PlusCircle,
  Loader2
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { AIQuestionGenerator } from "@/components/quiz/AIQuestionGenerator";
import { QuizSettings } from "@/components/quiz/QuizSettings";
import { QuestionItem, type QuestionForm } from "@/components/quiz/QuestionItem";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { quizApi, surveyApi, categoryApi, classApi } from "@/lib/api";
import { useLocation, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface QuizBuilderProps {
  contentTypeMode?: 'exam' | 'survey';
  embedded?: boolean;
  onSaved?: () => void;
  editIdOverride?: string | null;
}

export function QuizBuilder({ contentTypeMode = 'exam', embedded = false, onSaved, editIdOverride }: QuizBuilderProps) {
  const [, navigate] = useLocation();
  const { id: paramId } = useParams<{ id: string }>();
  const searchParams = new URLSearchParams(window.location.search);
  const queryId = searchParams.get("id");
  const editId = editIdOverride || paramId || queryId;

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryApi.getAllCategories(),
  });

  // Fetch classes
  const { data: classesData } = useQuery({
    queryKey: ['teacher-classes'],
    queryFn: () => classApi.getTeacherClasses(),
  });

  const dbCategories = categoriesData || [];
  const teacherClasses = classesData?.classes || [];

  // Quiz form state
  const contentType = contentTypeMode;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [timeLimit, setTimeLimit] = useState<number | undefined>(undefined);
  const [timeLimitEnabled, setTimeLimitEnabled] = useState(false);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [assignedClassIds, setAssignedClassIds] = useState<string[]>([]);
  const [loadedStatus, setLoadedStatus] = useState<'draft' | 'published' | 'archived'>('draft');

  const [questions, setQuestions] = useState<QuestionForm[]>([
    { id: 1, type: contentTypeMode === 'survey' ? "single-choice" : "multiple-choice", text: "", options: ["", "", "", "", ""], correctAnswer: 0 }
  ]);

  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);
  const pendingFocusQuestionId = useRef<number | string | null>(null);

  useEffect(() => {
    const id = pendingFocusQuestionId.current;
    if (id == null) return;
    pendingFocusQuestionId.current = null;
    requestAnimationFrame(() => {
      const card = document.querySelector<HTMLElement>(`[data-question-id="${CSS.escape(String(id))}"]`);
      card?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      card?.querySelector<HTMLTextAreaElement>('textarea')?.focus({ preventScroll: true });
    });
  }, [questions]);

  useEffect(() => {
    if (editId) {
      const loadQuiz = async () => {
        setIsLoadingQuiz(true);
        try {
          const quizData: any = contentTypeMode === 'survey' ? await surveyApi.getSurvey(editId) : await quizApi.getQuiz(editId);
          const quiz = quizData.quiz || quizData.survey;
          const quizQuestions = quizData.questions;
          
          if ((quiz.contentType || 'exam') !== contentTypeMode) {
            throw new Error('İçerik türü bu düzenleyiciyle uyumlu değil.');
          }
          setLoadedStatus(quiz.status === 'published' || quiz.status === 'archived' ? quiz.status : 'draft');
          setTitle(quiz.title);
          setDescription(quiz.description || '');
          setCategory(quiz.category || '');
          if (quiz.timeLimit) {
            setTimeLimitEnabled(true);
            setTimeLimit(quiz.timeLimit);
          }
          setShuffleQuestions(quiz.shuffleQuestions);
          
          if (quiz.assignedClasses) {
            setAssignedClassIds(quiz.assignedClasses.map((c: any) => c.id));
          }

          if (quizQuestions && quizQuestions.length > 0) {
            setQuestions(quizQuestions.map((q: any) => {
              const opts = Array.isArray(q.options) ? q.options : ["", "", "", "", ""];
              while (opts.length < 5) opts.push("");
              
              const correctIdx = opts.indexOf(q.correctAnswer);
              return {
                id: q.id,
                type: q.type || 'multiple-choice',
                text: q.text,
                options: opts,
                correctAnswer: correctIdx !== -1 ? correctIdx : 0,
                imageUrl: q.imageUrl,
                config: q.config || undefined,
              };
            }));
          }
        } catch (error) {
          toast({ title: 'Hata', description: 'Sınav bilgileri yüklenemedi.', variant: 'destructive' });
        } finally {
          setIsLoadingQuiz(false);
        }
      };
      loadQuiz();
    }
  }, [editId, toast, contentTypeMode]);
  const toggleClass = (classId: string) => {
    setAssignedClassIds(prev => 
      prev.includes(classId) 
        ? prev.filter(id => id !== classId) 
        : [...prev, classId]
    );
  };

  const validateQuestions = () => {
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (q.text.trim() === '') continue;

      if (['multiple-choice', 'single-choice', 'likert'].includes(q.type)) {
        const nonViewOptions = q.options.filter(o => o.trim() !== "");
        const uniqueOptions = new Set(nonViewOptions);
        if (uniqueOptions.size !== nonViewOptions.length) {
          toast({ 
            title: "Hata", 
            description: `Soru ${i + 1}: Aynı cevap seçeneği birden fazla kez kullanılamaz.`, 
            variant: "destructive" 
          });
          return false;
        }
      }
    }
    return true;
  };

  const createQuizMutation = useMutation({
    mutationFn: async (status: 'draft' | 'published') => {
      if (!validateQuestions()) throw new Error("Doğrulama hatası");

      const selectedCat = dbCategories.find(c => c.name === category);
      
      const payload = {
        title,
        description: description || undefined,
        category: category || 'General',
        categoryId: selectedCat?.id, 
        difficulty: 'medium',
        contentType,
        timeLimit: contentType === 'exam' && timeLimitEnabled ? timeLimit : undefined,
        shuffleQuestions: contentType === 'exam' ? shuffleQuestions : false,
        status,
        assignedClassIds
      };

      let quizIdToUse = editId;
      const currentStatus = editId ? loadedStatus : 'draft';
      const settingsPayload = { ...payload, status: currentStatus };

      if (editId) {
        if (contentType === 'survey') await surveyApi.updateSurvey(editId, settingsPayload);
        else await quizApi.updateQuiz(editId, settingsPayload);
      } else {
        if (contentType === 'survey') {
          const { contentType: _contentType, timeLimit: _timeLimit, shuffleQuestions: _shuffle, ...surveyPayload } = settingsPayload;
          const surveyResponse = await surveyApi.createSurvey(surveyPayload);
          quizIdToUse = surveyResponse.survey.id;
        } else {
          const quizResponse = await quizApi.createQuiz(settingsPayload);
          quizIdToUse = quizResponse.quiz.id;
        }
      }

      const validQuestions = questions.filter(q => q.text.trim() !== '');
      if (validQuestions.length > 0) {
        const questionsToAdd = validQuestions.map((q, index) => ({
          ...(typeof q.id === 'string' ? { id: q.id } : {}),
          text: q.text,
          type: q.type as any,
          options: q.options.filter(o => o.trim() !== ''),
          correctAnswer: contentType === 'survey' ? null : (q.options[q.correctAnswer] || q.options[0]),
          config: q.config,
          imageUrl: q.imageUrl,
          order: index + 1,
        }));
        if (contentType === 'survey') await surveyApi.syncQuestions(quizIdToUse as string, questionsToAdd);
        else await quizApi.addQuestions(quizIdToUse as string, questionsToAdd);
      }

      if (status !== currentStatus) {
        if (contentType === 'survey') await surveyApi.updateSurvey(quizIdToUse as string, { status });
        else await quizApi.updateQuiz(quizIdToUse as string, { status });
      }

      return quizIdToUse;
    },
    onSuccess: (_quizId, status) => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      toast({
        title: status === 'published'
          ? (contentType === 'survey' ? 'Anket yayınlandı!' : 'Sınav yayınlandı!')
          : 'Taslak kaydedildi!',
        description: `"${title}" başarıyla ${status === 'published' ? 'yayınlandı' : 'kaydedildi'}.`,
      });
      if (onSaved) onSaved();
      else navigate(contentType === 'survey' ? '/survey-results' : '/quizzes');
    },
    onError: (error: Error) => {
      if (error.message !== "Doğrulama hatası") {
        toast({ title: 'Hata', description: error.message || 'İçerik kaydedilirken bir hata oluştu.', variant: 'destructive' });
      }
    },
  });

  const addQuestion = () => {
    const id = Date.now();
    pendingFocusQuestionId.current = id;
    setQuestions((current) => [{
      id,
      type: contentType === 'survey' ? "single-choice" : "multiple-choice",
      text: "",
      options: ["", "", "", "", ""],
      correctAnswer: 0
    }, ...current]);
  };

  const handleAIGenerated = (newQuestions: any[]) => {
    const formattedQuestions = newQuestions.map((q, i) => {
      const opts = Array.isArray(q.options) ? [...q.options] : ["", "", "", "", ""];
      while (opts.length < 5) opts.push("");
      const fallbackType = contentType === 'survey' ? 'single-choice' : 'multiple-choice';
      
      return {
        id: Date.now() + i,
        type: q.type || fallbackType,
        text: q.text || '',
        options: opts,
        correctAnswer: q.correctAnswerIndex ?? 0,
        config: q.config || undefined,
      };
    });
    
    if (questions.length === 1 && questions[0].text === '') {
      setQuestions(formattedQuestions);
    } else {
      setQuestions([...questions, ...formattedQuestions]);
    }
    
    toast({
      title: "Yapay Zeka Soruları Eklendi",
      description: `${newQuestions.length} soru başarıyla eklendi.`,
    });
  };

  const removeQuestion = (id: number | string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const updateQuestion = (id: number | string, field: keyof QuestionForm, value: any) => {
    setQuestions(questions.map(q => 
      q.id === id ? { ...q, [field]: value } : q
    ));
  };

  const updateOption = (questionId: number | string, optionIndex: number, value: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        const newOptions = [...q.options];
        newOptions[optionIndex] = value;
        return { ...q, options: newOptions };
      }
      return q;
    }));
  };

  if (isLoadingQuiz) {
    const loading = <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    return embedded ? loading : <DashboardLayout>{loading}</DashboardLayout>;
  }

  const builder = (
      <div className="space-y-8 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground">
              {editId ? (contentType === 'survey' ? 'Anketi Düzenle' : 'Sınavı Düzenle') : (contentType === 'survey' ? 'Yeni Anket Oluştur' : 'Yeni Sınav Oluştur')}
            </h1>
            <p className="text-muted-foreground mt-2">{contentType === 'survey' ? 'Anket detaylarını ve sorularını belirleyin.' : 'Sınav detaylarını ve sorularını belirleyin.'}</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button 
              variant="outline" 
              className="flex-1 sm:flex-none gap-2 shadow-sm dark:shadow-none"
              onClick={() => createQuizMutation.mutate('draft')}
              disabled={createQuizMutation.isPending}
            >
              <Save className="h-4 w-4" />
              Taslak Kaydet
            </Button>
            <Button 
              className="flex-1 sm:flex-none gap-2 shadow-lg shadow-primary/20"
              onClick={() => createQuizMutation.mutate('published')}
              disabled={createQuizMutation.isPending || !title || questions.filter(q => q.text.trim() !== '').length === 0}
            >
              {createQuizMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              <Save className="h-4 w-4" />
              Yayınla
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <Tabs defaultValue="settings" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="settings" className="gap-2">
                <Settings className="h-4 w-4" />
                {contentType === 'survey' ? 'Anket Ayarları' : 'Sınav Ayarları'}
              </TabsTrigger>
              <TabsTrigger value="questions" className="gap-2">
                <List className="h-4 w-4" />
                Sorular ({questions.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="settings">
              <QuizSettings 
                contentType={contentType}
                title={title} setTitle={setTitle}
                description={description} setDescription={setDescription}
                category={category} setCategory={setCategory}
                dbCategories={dbCategories}
                teacherClasses={teacherClasses}
                assignedClassIds={assignedClassIds}
                toggleClass={toggleClass}
                timeLimitEnabled={timeLimitEnabled}
                setTimeLimitEnabled={setTimeLimitEnabled}
                timeLimit={timeLimit}
                setTimeLimit={setTimeLimit}
                shuffleQuestions={shuffleQuestions}
                setShuffleQuestions={setShuffleQuestions}
              />
            </TabsContent>

            <TabsContent value="questions" className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
              <Button 
                variant="outline" 
                className="w-full h-12 border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-all text-muted-foreground hover:text-primary font-medium"
                onClick={addQuestion}
              >
                <PlusCircle className="mr-2 h-5 w-5" />
                Soru Ekle (Üst)
              </Button>

              {questions.map((q, index) => (
                <QuestionItem 
                  key={q.id}
                  question={q}
                  index={index}
                  isFirst={index === 0}
                  totalQuestions={questions.length}
                  contentType={contentType}
                  onUpdate={updateQuestion}
                  onRemove={removeQuestion}
                  onUpdateOption={updateOption}
                />
              ))}

              <Button 
                variant="outline" 
                className="w-full h-14 border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-all text-muted-foreground hover:text-primary font-medium"
                onClick={addQuestion}
              >
                <PlusCircle className="mr-2 h-5 w-5" />
                Yeni Soru Ekle
              </Button>
            </TabsContent>
          </Tabs>

          <div className="space-y-6">
            <Card className="sticky top-6 border-primary/20 shadow-md bg-gradient-to-br from-card to-accent/20">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <span className="bg-primary/10 text-primary p-1.5 rounded-lg">✨</span>
                  Yapay Zeka
                </CardTitle>
                <CardDescription>Yapay zeka ile saniyeler içinde kaliteli sorular üretin.</CardDescription>
              </CardHeader>
              <CardContent>
                <AIQuestionGenerator 
                  onGenerate={handleAIGenerated} 
                  quizTitle={title}
                  quizDescription={description}
                contentType={contentType}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
  );
  return embedded ? builder : <DashboardLayout>{builder}</DashboardLayout>;
}

export default function CreateQuizPage() {
  return <QuizBuilder contentTypeMode="exam" />;
}
