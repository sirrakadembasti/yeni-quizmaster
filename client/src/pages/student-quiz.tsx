import { isRetryableError } from '@/lib/http-error';
import { useEffect, useRef, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { quizApi, refreshCsrfToken } from '@/lib/api';
import { useAuth } from '@/context/auth-context';
import { ChevronLeft, ChevronRight, AlertCircle, CheckCircle2, Eye, WifiOff, CloudUpload } from 'lucide-react';
import {
  acknowledgeOfflineAnswer,
  getOfflineSession,
  getOfflineRemainingSeconds,
  markOfflineSubmit,
  normalizeOfflineQuestions,
  reconcileOfflineSession,
  orderQuizQuestions,
  removeOfflineSession,
  saveOfflineSession,
  updateOfflineAnswers,
} from '@/lib/offline-quiz';
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
  imageUrl?: string | null;
}

export default function StudentQuiz() {
  const [, setLocation] = useLocation();
  const { quizId } = useParams<{ quizId: string }>();
  const { role, user } = useAuth();
  const isPreviewMode = role === 'teacher' || role === 'admin';
  const quizListPath = isPreviewMode ? '/quizzes' : '/student/quizzes';

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
  // 'idle' | 'saving' | 'saved' | 'error'
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [offlineMode, setOfflineMode] = useState(false);
  const [submissionQueued, setSubmissionQueued] = useState(false);
  const answerSaveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const saveAnswer = (attemptId: string, questionId: string, answer: string) => {
    const request = answerSaveQueue.current.catch(() => {}).then(() => quizApi.submitAnswer(attemptId, questionId, answer));
    answerSaveQueue.current = request;
    return request;
  };

  // Start quiz on mount
  useEffect(() => {
    const initQuiz = async () => {
      try {
        setLoading(true);
        setError(null);

        // Pre-emptive CSRF refresh for previews to prevent 403 race conditions
        if (isPreviewMode) {
          console.log("Preview mode detected, refreshing CSRF token pre-emptively");
          await refreshCsrfToken();
        }

        const data: any = await quizApi.startQuiz(quizId);

        if (!data || !data.quiz) {
          throw new Error('Quiz bilgisi alınamadı');
        }

        setQuiz(data.quiz);
        setOfflineMode(false);

        // Normalize questions - ensure options is always an array
        const normalizedQuestions = orderQuizQuestions(normalizeOfflineQuestions(data.questions || []), Boolean(data.quiz.shuffleQuestions) && !isPreviewMode, data.resultId);

        setQuestions(normalizedQuestions);
        setResultId(data.resultId);
        setAnswers(data.existingAnswers || {});
        // Convert minutes from DB to seconds for the timer
        const fallbackLimit = data.quiz?.timeLimit ? data.quiz.timeLimit * 60 : null;
        setTimeLeft(data.remainingSeconds !== undefined
          ? data.remainingSeconds
          : fallbackLimit);
        if (!isPreviewMode && user) {
          const capturedAt = new Date().toISOString();
          const session = reconcileOfflineSession({
            version: 1,
            userId: user.id,
            quizId,
            resultId: data.resultId,
            quiz: data.quiz,
            questions: normalizedQuestions,
            answers: data.existingAnswers || {},
            remainingSeconds: data.remainingSeconds ?? fallbackLimit,
            timerCapturedAt: capturedAt,
            cachedAt: capturedAt,
            pendingSubmit: false,
          }, getOfflineSession(user.id, quizId));
          setAnswers(session.answers);
          setSubmissionQueued(session.pendingSubmit);
          saveOfflineSession(session);
          if (!session.pendingSubmit) {
            for (const [questionId, answer] of Object.entries(session.pendingAnswers || {})) {
              try {
                await saveAnswer(data.resultId, questionId, answer);
                acknowledgeOfflineAnswer(user.id, quizId, data.resultId, questionId, answer, session.answerRevisions?.[questionId]);
              } catch (saveError) {
                setOfflineMode(isRetryableError(saveError));
                setSaveStatus('error');
                break; // Preserve unsent answers for retry or final submission.
              }
            }
          }
        }
      } catch (err) {
        const cached = user ? getOfflineSession(user.id, quizId) : null;
        if (!isPreviewMode && cached && isRetryableError(err)) {
          setQuiz(cached.quiz);
          setQuestions(cached.questions);
          setResultId(cached.resultId);
          setAnswers(cached.answers);
          setTimeLeft(getOfflineRemainingSeconds(cached));
          setOfflineMode(true);
          setSubmissionQueued(cached.pendingSubmit);
        } else {
          setError(err instanceof Error ? err.message : 'Quiz başlatılamadı');
        }
      } finally {
        setLoading(false);
      }
    };

    if (quizId) {
      initQuiz();
    } else {
      setError('Quiz ID bulunamadı');
      setLoading(false);
    }
  }, [quizId, role, user, isPreviewMode]);

  // Timer countdown
  useEffect(() => {
    if (!resultId || submitted || submissionQueued || timeLeft === null) return;

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
  }, [resultId, submitted, submissionQueued, timeLeft]);

  // Auto-save answer when changed
  const handleAnswerChange = async (questionId: string, option: string) => {
    if (submissionQueued) return;
    // Optimistic update: seçim anında UI'ya yansır
    const nextAnswers = { ...answers, [questionId]: option };
    setAnswers(nextAnswers);

    // In preview mode, don't save answers to server
    if (isPreviewMode) return;
    const revision = user ? updateOfflineAnswers(user.id, quizId, nextAnswers)?.[questionId] : undefined;
    if (!navigator.onLine) {
      setOfflineMode(true);
      setSaveStatus('saved');
      return;
    }

    setSaveStatus('saving');
    try {
      await saveAnswer(resultId!, questionId, option);
      if (user) acknowledgeOfflineAnswer(user.id, quizId, resultId!, questionId, option, revision);
      setOfflineMode(false);
      setSaveStatus('saved');
      // 2 sn sonra göstergeyi gizle
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      setOfflineMode(isRetryableError(err));
      setSaveStatus('error');
    }
  };

  // Hata durumunda "Yeniden Dene": mevcut sorunun cevabını sunucuya tekrar gönder
  const retryLastSave = async () => {
    const currentQuestion = questions[currentQuestionIndex];
    const currentAnswer = answers[currentQuestion?.id];
    if (!currentQuestion || !currentAnswer || !resultId) return;
    const revision = user ? getOfflineSession(user.id, quizId)?.answerRevisions?.[currentQuestion.id] : undefined;
    setSaveStatus('saving');
    try {
      await saveAnswer(resultId, currentQuestion.id, currentAnswer);
      if (user) acknowledgeOfflineAnswer(user.id, quizId, resultId, currentQuestion.id, currentAnswer, revision);
      setOfflineMode(false);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
    }
  };

  const handleSubmit = async () => {
    // In preview mode, just show a message instead of submitting
    if (isPreviewMode) {
      setSubmitted(true);
      return;
    }

    try {
      if (!navigator.onLine) {
        if (user) markOfflineSubmit(user.id, quizId, true);
        setOfflineMode(true);
        setSubmissionQueued(true);
        setShowConfirmDialog(false);
        return;
      }

      await quizApi.submitQuiz(resultId!, answers);
      if (user) removeOfflineSession(user.id, quizId);
      setSubmitted(true);
      
      // Show result
      setTimeout(() => {
        setLocation(`/student/result/${resultId}`);
      }, 2000);
    } catch (err) {
      if (!isRetryableError(err)) {
        if (user) { markOfflineSubmit(user.id, quizId, false); removeOfflineSession(user.id, quizId); }
        setSubmissionQueued(false);
        setError(err instanceof Error ? err.message : 'Sınav teslim edilemedi.');
        return;
      }
      if (user) markOfflineSubmit(user.id, quizId, true);
      setOfflineMode(true);
      setSubmissionQueued(true);
      setShowConfirmDialog(false);
    }
  };

  useEffect(() => {
    if (!submissionQueued || !resultId || !user || isPreviewMode) return;

    const syncSubmission = async () => {
      if (!navigator.onLine) return;
      const cached = getOfflineSession(user.id, quizId);
      try {
        await quizApi.submitQuiz(resultId, cached?.answers || answers);
        removeOfflineSession(user.id, quizId);
        setSubmissionQueued(false);
        setSubmitted(true);
        setTimeout(() => setLocation(`/student/result/${resultId}`), 1000);
      } catch (err) {
        if (!isRetryableError(err)) {
          markOfflineSubmit(user.id, quizId, false);
          removeOfflineSession(user.id, quizId);
          setSubmissionQueued(false);
          setError(err instanceof Error ? err.message : 'Teslim reddedildi.');
        } else setSubmissionQueued(true);
      }
    };

    window.addEventListener('online', syncSubmission);
    syncSubmission();
    return () => window.removeEventListener('online', syncSubmission);
  }, [submissionQueued, resultId, user, quizId, answers, isPreviewMode, setLocation]);

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
                <Button onClick={() => setLocation(quizListPath)}>
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
              <Button onClick={() => setLocation(quizListPath)} className="mt-4">
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
                  onClick={() => setLocation(quizListPath)}
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
        {(offlineMode || submissionQueued) && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {submissionQueued ? <CloudUpload className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {submissionQueued
              ? "Teslim yerel olarak kaydedildi. İnternet gelince otomatik gönderilecek."
              : "Çevrimdışı çalışıyorsunuz. Cevaplar bu cihazda saklanıyor."}
          </div>
        )}
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
              onClick={() => setLocation(quizListPath)}
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

        {/* Save status banner — cevap kaydetme durumu */}
        {saveStatus === 'error' && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                Cevap bu cihazda saklandı; sunucuya henüz aktarılamadı.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={retryLastSave} className="shrink-0 border-amber-400 text-amber-800 hover:bg-amber-100">
              Yeniden Dene
            </Button>
          </div>
        )}
        {saveStatus === 'saving' && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
            <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            Kaydediliyor...
          </div>
        )}
        {saveStatus === 'saved' && (
          <div className="flex items-center gap-2 text-xs text-emerald-600 px-1">
            <CheckCircle2 className="h-3 w-3" />
            Cevap kaydedildi
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
              {currentQuestion?.imageUrl && <img src={currentQuestion.imageUrl} alt="Soru görseli" className="my-4 max-h-96 max-w-full rounded-lg object-contain" />}

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
                    disabled={submissionQueued}
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
              disabled={submissionQueued}
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
