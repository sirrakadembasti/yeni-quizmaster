import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { quizApi } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { Clock, ChevronLeft, ChevronRight, AlertCircle, CheckCircle2, Eye } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Question {
  id: string;
  text: string;
  type: string;
  options?: string[];
}

export default function StudentQuiz() {
  const [, setLocation] = useLocation();
  const { quizId } = useParams<{ quizId: string }>();
  const { role, user } = useAuth();
  const isPreviewMode = role === 'teacher' || role === 'admin';

  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [resultId, setResultId] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Start quiz on mount
  useEffect(() => {
    console.debug('StudentQuiz mounted, quizId=', quizId, 'role=', role);
    const startQuiz = async () => {
      try {
        setLoading(true);
        setError(null);

        const resp = await fetch(`/api/student/quiz/${quizId}/start`, {
          method: 'POST',
          credentials: 'include',
        });

        const raw = await resp.text();
        console.debug('API Response:', resp.status, raw.substring(0, 200));
        
        let data: any = null;
        try {
          data = raw ? JSON.parse(raw) : null;
        } catch (e) {
          console.error('JSON parse error:', e);
          data = null;
        }

        if (!resp.ok) {
          const body = raw || `HTTP ${resp.status}`;
          throw new Error(`Başlatma hatası (${resp.status}): ${body}`);
        }

        if (!data) {
          throw new Error('Sunucudan beklenmeyen yanıt alındı: ' + raw);
        }

        if (!data.quiz) {
          throw new Error('Quiz bilgisi alınamadı');
        }

        setQuiz(data.quiz);

        // Normalize questions - ensure options is always an array
        const normalizedQuestions = (data.questions || []).map((q: any) => {
          let options = q.options;
          if (typeof options === 'string') {
            try {
              options = JSON.parse(options);
            } catch (e) {
              options = [];
            }
          } else if (!Array.isArray(options)) {
            options = [];
          }
          return { ...q, options };
        });

        setQuestions(normalizedQuestions);
        setResultId(data.resultId);
        setAnswers(data.existingAnswers || {});
        // Convert minutes from DB to seconds for the timer
        const limitInSeconds = data.quiz?.timeLimit ? data.quiz.timeLimit * 60 : null;
        setTimeLeft(limitInSeconds); 
      } catch (err) {
        console.error('Quiz start error:', err);
        setError(err instanceof Error ? err.message : 'Quiz başlatılamadı');
      } finally {
        setLoading(false);
      }
    };

    if (quizId) {
      startQuiz();
    } else {
      setError('Quiz ID bulunamadı');
      setLoading(false);
    }
  }, [quizId, role]);

  // Timer countdown
  useEffect(() => {
    if (!resultId || submitted || timeLeft === null) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev! <= 1) {
          // Auto-submit when time's up
          handleSubmit();
          return 0;
        }
        return prev! - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [resultId, submitted, timeLeft]);

  // Auto-save answer when changed
  const handleAnswerChange = async (questionId: string, option: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: option }));
    
    // In preview mode, don't save answers to server
    if (isPreviewMode) return;
    
    try {
      await quizApi.submitAnswer(resultId!, questionId, option);
    } catch (err) {
      console.error('Cevap kaydedilemedi:', err);
    }
  };

  const handleSubmit = async () => {
    // In preview mode, just show a message instead of submitting
    if (isPreviewMode) {
      setSubmitted(true);
      return;
    }

    try {
      const result = await quizApi.submitQuiz(resultId!);
      setSubmitted(true);
      
      // Show result
      setTimeout(() => {
        setLocation(`/student/result/${resultId}`);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Quiz gönderilemedi');
    }
  };

  if (loading) {
    return (
      <DashboardLayout hideNavigation>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Quiz yükleniyor...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout hideNavigation>
        <div className="max-w-2xl mx-auto mt-8">
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                Hata Oluştu
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <div className="flex gap-2">
                <Button onClick={() => setLocation('/quizzes')}>
                  Quizlere Dön
                </Button>
                <Button variant="outline" onClick={() => window.location.reload()}>
                  Yeniden Dene
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (submitted) {
    return (
      <DashboardLayout hideNavigation>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4 max-w-md">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <h2 className="text-2xl font-bold">
              {isPreviewMode ? 'Önizleme Tamamlandı!' : 'Quiz Tamamlandı!'}
            </h2>
            <p className="text-muted-foreground">
              {isPreviewMode 
                ? 'Bu bir önizleme idi. Sonuçlar kaydedilmedi.' 
                : 'Sonucunuza yönlendiriliyorsunuz...'}
            </p>
            {isPreviewMode && (
              <Button onClick={() => setLocation('/quizzes')} className="mt-4">
                Quizlere Dön
              </Button>
            )}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!quiz || questions.length === 0) {
    const isNoQuestions = quiz && questions.length === 0;

    return (
      <DashboardLayout hideNavigation>
        <div className="max-w-2xl mx-auto mt-12">
          <Card className={isNoQuestions ? "border-blue-200 bg-blue-50" : "border-amber-200 bg-amber-50"}>
            <CardHeader>
              <CardTitle className={isNoQuestions ? "text-blue-900 flex items-center gap-2" : "text-amber-900 flex items-center gap-2"}>
                <AlertCircle className="h-5 w-5" />
                {isNoQuestions ? 'Quizde Soru Yok' : 'Quiz Bilgileri Yüklenemedi'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className={isNoQuestions ? "text-sm text-blue-800" : "text-sm text-amber-800"}>
                {!quiz 
                  ? 'Quiz bilgileri alınamadı.' 
                  : isPreviewMode 
                    ? 'Bu quizde henüz hiç soru bulunmuyor. Önizleme yapabilmek için lütfen quize soru ekleyin.'
                    : 'Bu quizde henüz soru bulunmuyor.'}
              </p>
              <div className={`text-xs p-3 rounded border ${isNoQuestions ? 'text-blue-700 bg-blue-50/50 dark:bg-blue-900/20 border-blue-300' : 'text-amber-700 bg-amber-50/50 dark:bg-amber-900/20 border-amber-300'}`}>
                <p>Quiz ID: {quizId || 'N/A'}</p>
                <p>Sorular: {questions.length}</p>
                <p>Rol: {role}</p>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => setLocation('/quizzes')}
                  className={isNoQuestions ? "bg-blue-600 hover:bg-blue-700" : "bg-amber-600 hover:bg-amber-700"}
                >
                  Quizlere Geri Dön
                </Button>
                {!isNoQuestions && (
                  <Button 
                    variant="outline"
                    onClick={() => window.location.reload()}
                  >
                    Yeniden Dene
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <DashboardLayout hideNavigation>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Preview Banner for Teachers */}
        {isPreviewMode && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <Eye className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900">Önizleme Modu</h3>
              <p className="text-sm text-amber-800 mt-1">
                Bu quiz'i önizleme modunda görüntülüyorsunuz. Sonuçlar kaydedilmeyecektir.
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setLocation('/quizzes')}
            >
              Quizlere Dön
            </Button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{quiz.title}</h1>
            <p className="text-muted-foreground mt-1">{quiz.description}</p>
          </div>
          <div className={`text-2xl font-bold ${timeLeft! <= 60 ? 'text-red-500' : 'text-foreground'}`}>
            {timeLeft !== null ? formatTime(timeLeft) : '--:--'}
          </div>
        </div>

        {/* Timer warning */}
        {timeLeft !== null && timeLeft <= 60 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-800">Zamanın bitmek üzere. Acele et!</p>
          </div>
        )}

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">
              Soru {currentQuestionIndex + 1} / {questions.length}
            </span>
            <Badge variant="outline">
              {Object.keys(answers).length} cevaplandı
            </Badge>
          </div>
          <Progress value={progress} />
        </div>

        {/* Question Card */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-xl">{currentQuestion.text}</CardTitle>
            {currentQuestion.type === 'multiple_choice' && (
              <CardDescription>Doğru seçeneği seçin</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {currentQuestion.options && currentQuestion.options.length > 0 ? (
              <div className="space-y-3">
                {currentQuestion.options.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswerChange(currentQuestion.id, option)}
                    className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                      answers[currentQuestion.id] === option
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          answers[currentQuestion.id] === option
                            ? 'border-primary bg-primary'
                            : 'border-border'
                        }`}
                      >
                        {answers[currentQuestion.id] === option && (
                          <div className="w-2 h-2 bg-primary-foreground rounded-full" />
                        )}
                      </div>
                      <span className="font-bold text-muted-foreground min-w-[20px]">
                        {String.fromCharCode(65 + idx)})
                      </span>
                      <span className="text-sm font-medium">{option}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">Bu soru için seçenek bulunmuyor.</p>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between items-center pt-4">
          <Button
            variant="outline"
            onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
            disabled={currentQuestionIndex === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Önceki
          </Button>

          {currentQuestionIndex === questions.length - 1 ? (
            <Button
              onClick={() => setShowConfirmDialog(true)}
              size="lg"
              className={isPreviewMode ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}
            >
              {isPreviewMode ? 'Önizlemeyi Bitir' : 'Quizi Bitir'}
            </Button>
          ) : (
            <Button
              onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
            >
              Sonraki
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>

        {/* Question Navigator */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sorular</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
              {questions.map((q, idx) => (
                <button
                  key={q.id}
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={`w-full aspect-square rounded-lg font-medium text-sm transition-all ${
                    idx === currentQuestionIndex
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary'
                      : answers[q.id]
                      ? 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sınavı Bitirmek İstiyor musunuz?</AlertDialogTitle>
              <AlertDialogDescription>
                Sınavı bitirdiğinizde cevaplarınız kaydedilecek ve sonuç sayfasına yönlendirileceksiniz.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-primary text-primary-foreground hover:bg-primary/90">
                Hayır, Devam Et
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleSubmit}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Evet, Bitir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}

