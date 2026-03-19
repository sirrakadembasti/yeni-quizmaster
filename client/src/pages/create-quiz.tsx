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
import { useState, useEffect } from "react";
import { AIQuestionGenerator } from "@/components/quiz/AIQuestionGenerator";
import { QuizSettings } from "@/components/quiz/QuizSettings";
import { QuestionItem, type QuestionForm } from "@/components/quiz/QuestionItem";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { quizApi, categoryApi, classApi } from "@/lib/api";
import { useLocation, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function CreateQuizPage() {
  const [, navigate] = useLocation();
  const { id: paramId } = useParams<{ id: string }>();
  const searchParams = new URLSearchParams(window.location.search);
  const queryId = searchParams.get("id");
  const editId = paramId || queryId;

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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [timeLimit, setTimeLimit] = useState<number | undefined>(undefined);
  const [timeLimitEnabled, setTimeLimitEnabled] = useState(false);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [assignedClassIds, setAssignedClassIds] = useState<string[]>([]);

  const [questions, setQuestions] = useState<QuestionForm[]>([
    { id: 1, type: "multiple-choice", text: "", options: ["", "", "", "", ""], correctAnswer: 0 }
  ]);

  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);

  useEffect(() => {
    if (editId) {
      const loadQuiz = async () => {
        setIsLoadingQuiz(true);
        try {
          const quizData = await quizApi.getQuiz(editId);
          const quiz = quizData.quiz;
          const quizQuestions = quizData.questions;
          
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
  }, [editId, toast]);

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
        timeLimit: timeLimitEnabled ? timeLimit : undefined,
        shuffleQuestions,
        status,
        assignedClassIds
      };

      let quizIdToUse = editId;

      if (editId) {
        await quizApi.updateQuiz(editId, payload);
      } else {
        const quizResponse = await quizApi.createQuiz(payload);
        quizIdToUse = quizResponse.quiz.id;
      }

      const validQuestions = questions.filter(q => q.text.trim() !== '');
      if (validQuestions.length > 0) {
        const questionsToAdd = validQuestions.map((q, index) => ({
          text: q.text,
          type: q.type as any,
          options: q.type === 'multiple-choice' ? q.options.filter(o => o.trim() !== '') : undefined,
          correctAnswer: q.type === 'multiple-choice' ? q.options[q.correctAnswer] || q.options[0] : '',
          imageUrl: q.imageUrl,
          order: index + 1,
        }));
        await quizApi.addQuestions(quizIdToUse as string, questionsToAdd);
      }

      return quizIdToUse;
    },
    onSuccess: (quizId, status) => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      toast({
        title: status === 'published' ? 'Sınav yayınlandı!' : 'Taslak kaydedildi!',
        description: `"${title}" başarıyla ${status === 'published' ? 'yayınlandı' : 'kaydedildi'}.`,
      });
      navigate('/quizzes');
    },
    onError: (error: Error) => {
      if (error.message !== "Doğrulama hatası") {
        toast({ title: 'Hata', description: error.message || 'Sınav kaydedilirken bir hata oluştu.', variant: 'destructive' });
      }
    },
  });

  const addQuestion = () => {
    setQuestions([...questions, {
      id: Date.now(),
      type: "multiple-choice",
      text: "",
      options: ["", "", "", "", ""],
      correctAnswer: 0
    }]);
  };

  const handleAIGenerated = (newQuestions: any[]) => {
    const formattedQuestions = newQuestions.map((q, i) => {
      const opts = Array.isArray(q.options) ? [...q.options] : ["", "", "", "", ""];
      while (opts.length < 5) opts.push("");
      
      return {
        id: Date.now() + i,
        type: q.type || "multiple-choice",
        text: q.text || '',
        options: opts,
        correctAnswer: q.correctAnswerIndex ?? 0,
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
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground">
              {editId ? 'Sınavı Düzenle' : 'Yeni Sınav Oluştur'}
            </h1>
            <p className="text-muted-foreground mt-2">Sınav detaylarını ve sorularını belirleyin.</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button 
              variant="outline" 
              className="flex-1 sm:flex-none gap-2 shadow-sm"
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
                Sınav Ayarları
              </TabsTrigger>
              <TabsTrigger value="questions" className="gap-2">
                <List className="h-4 w-4" />
                Sorular ({questions.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="settings">
              <QuizSettings 
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
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
