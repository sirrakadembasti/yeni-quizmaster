import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { resultApi } from '@/lib/api';
import { ArrowLeft, CheckCircle2, XCircle, Clock, AlertCircle, Printer, Download, HelpCircle } from 'lucide-react';

interface Question {
  id: string;
  text: string;
  type: string;
  options?: string[];
  correctAnswer: string;
  studentAnswer?: string;
  isCorrect: boolean;
}

export default function QuizResultDetail() {
  const [, setLocation] = useLocation();
  const { resultId } = useParams<{ resultId: string }>();

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        setLoading(true);
        const data = await resultApi.getResultDetail(resultId!);
        setResult(data.result);
        setQuiz(data.quiz);

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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Sonuç yüklenemedi');
      } finally {
        setLoading(false);
      }
    };

    if (resultId) fetchResult();
  }, [resultId]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-muted-foreground">Sonuç yükleniyor...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
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
              <Button onClick={() => setLocation('/student/results')}>
                Sonuçlara Dön
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!result || !quiz) return null;

  const correctCount = result.correctAnswersCount ?? result.correctAnswers ?? 0;
  const totalCount = result.totalQuestions ?? 0;
  const wrongAnswers = Math.max(0, totalCount - correctCount);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6" id="print-area">
        {/* Header */}
        <div className="flex justify-between items-center print:hidden">
          <Button
            variant="ghost"
            onClick={() => setLocation('/student/results')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Sonuçlara Dön
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4 mr-2" />
              Yazdır / PDF
            </Button>
            <Button
              onClick={() => {
                try {
                  const csvHeaders = ['Soru No', 'Soru', 'Öğrencinin Cevabı', 'Doğru Cevap', 'Durum'];
                  const csvData = questions.map((q, idx) => [
                    idx + 1,
                    `"${q.text.replace(/"/g, '""')}"`,
                    `"${(q.studentAnswer || '').replace(/"/g, '""')}"`,
                    `"${q.correctAnswer.replace(/"/g, '""')}"`,
                    q.isCorrect ? 'Doğru' : 'Yanlış',
                  ]);
                  
                  let csv = '\uFEFF'; // BOM
                  csv += `Sınav Adı:;"${quiz.title.replace(/"/g, '""')}"\n`;
                  csv += `Puan:;${(result.score || 0).toFixed(0)}\n`;
                  csv += `Doğru Sayısı:;${correctCount}/${totalCount}\n\n`;
                  csv += csvHeaders.join(';') + '\n';
                  csv += csvData.map(row => row.join(';')).join('\n');

                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const link = document.createElement('a');
                  const url = URL.createObjectURL(blob);
                  link.setAttribute('href', url);
                  link.setAttribute('download', `${quiz.title || 'quiz-result'}.csv`);
                  link.style.visibility = 'hidden';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                } catch (e) {
                  console.error(e);
                  alert('CSV oluşturulurken hata oluştu');
                }
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Excel (CSV) İndir
            </Button>
          </div>
        </div>

        {/* Result Summary */}
        <Card className="print:shadow-none print:border-gray-300 border-primary/20 bg-card shadow-lg">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{quiz.title}</CardTitle>
                <CardDescription className="mt-2">{quiz.description}</CardDescription>
              </div>
              <div className="text-primary/40">
                <CheckCircle2 className="h-8 w-8" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Score Display */}
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
              <div className="bg-muted/30 rounded-xl p-4 border print:border-gray-300 shadow-sm dark:shadow-none">
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Puan</p>
                <p className="text-3xl font-black mt-2 text-primary">
                  {(result.score || 0).toFixed(0)}
                </p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-4 border border-emerald-100 dark:border-emerald-900/30 print:border-gray-300 shadow-sm dark:shadow-none">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Doğru</p>
                <p className="text-3xl font-black mt-2 text-emerald-600">
                  {correctCount}
                </p>
              </div>
              <div className="bg-rose-50 dark:bg-rose-950/20 rounded-xl p-4 border border-rose-100 dark:border-rose-900/30 print:border-gray-300 shadow-sm dark:shadow-none">
                <p className="text-xs text-rose-600 dark:text-rose-400 font-bold uppercase tracking-wider">Yanlış</p>
                <p className="text-3xl font-black mt-2 text-rose-600">
                  {wrongAnswers}
                </p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-xl p-4 border border-blue-100 dark:border-blue-900/30 print:border-gray-300 shadow-sm dark:shadow-none">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">Süre</p>
                <p className="text-3xl font-black mt-2 text-blue-600">
                  {Math.floor((result.timeTaken || 0) / 60)}:{((result.timeTaken || 0) % 60).toString().padStart(2, '0')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Questions Review */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mt-12 mb-6">
            <HelpCircle className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">Soru İncelemesi</h2>
          </div>

          {questions.map((question, idx) => (
            <Card key={question.id} className={`print:break-inside-avoid print:shadow-none print:border-gray-300 ${question.isCorrect ? 'border-emerald-200' : 'border-red-200'} shadow-sm dark:shadow-none transition-all hover:shadow-md`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 w-full">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-muted-foreground">Soru {idx + 1}</span>
                      {question.isCorrect ? (
                        <Badge className="bg-emerald-600 print:bg-white dark:bg-slate-900 print:text-emerald-700 print:border-emerald-600 print:border">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Doğru
                        </Badge>
                      ) : (
                        <Badge className="bg-red-600 print:bg-white dark:bg-slate-900 print:text-red-700 print:border-red-600 print:border">
                          <XCircle className="h-3 w-3 mr-1" />
                          Yanlış
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-base mt-2 leading-relaxed">{question.text}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Options */}
                {question.options && (
                  <div className="space-y-2">
                    {question.options.map((option, optIdx) => {
                      const isCorrectAnswer = option === question.correctAnswer;
                      const isStudentAnswer = option === question.studentAnswer;
                      const isWrongAnswer = isStudentAnswer && !isCorrectAnswer;

                      return (
                        <div
                          key={optIdx}
                          className={`p-3 rounded-lg border-2 transition-all print:border-gray-200 print:bg-transparent ${
                            isCorrectAnswer
                              ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20'
                              : isWrongAnswer
                              ? 'border-red-300 bg-red-50 dark:bg-red-900/20'
                              : 'border-border bg-card'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5">
                              {isCorrectAnswer && (
                                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                              )}
                              {isWrongAnswer && (
                                <XCircle className="h-5 w-5 text-red-600" />
                              )}
                              {!isCorrectAnswer && !isWrongAnswer && (
                                <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                              )}
                            </div>
                            <div className="flex-1">
                              <p className={`text-sm font-medium ${
                                isCorrectAnswer
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : isWrongAnswer
                                  ? 'text-red-700 dark:text-red-400'
                                  : 'text-foreground'
                              }`}>
                                {option}
                              </p>
                              <div className="flex gap-2 mt-1">
                                {isCorrectAnswer && (
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded">
                                    Doğru Cevap
                                  </span>
                                )}
                                {isStudentAnswer && (
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                    Senin Cevabın
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

