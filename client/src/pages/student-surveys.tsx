import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { surveyApi } from "@/lib/api";
import { ClipboardList, CheckCircle2, ArrowRight } from "lucide-react";

export default function StudentSurveysPage() {
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery({ queryKey: ['student-surveys'], queryFn: () => surveyApi.getSurveys() });
  const surveys = data?.surveys || [];

  return (
    <DashboardLayout>
      <div className="page-stack">
        <div className="page-toolbar">
          <div><h1 className="flex items-center gap-2 text-2xl font-bold"><ClipboardList className="h-7 w-7 text-primary" />Anketlerim</h1><p className="text-sm text-muted-foreground">Sınıfınıza atanmış güncel anketler.</p></div>
        </div>
        {isLoading ? <Card><CardContent className="p-6 text-center text-muted-foreground">Anketler yükleniyor...</CardContent></Card> :
          surveys.length === 0 ? <Card className="border-dashed"><CardContent className="p-8 text-center text-muted-foreground">Yanıtlamanız gereken anket bulunmuyor.</CardContent></Card> :
          <div className="grid gap-3 md:grid-cols-2">
            {surveys.map((survey) => (
              <Card key={survey.id}>
                <CardHeader className="pb-2"><div className="flex items-start justify-between gap-3"><CardTitle className="text-lg">{survey.title}</CardTitle><Badge variant={survey.submitted ? 'secondary' : 'default'}>{survey.submitted ? 'Yanıtlandı' : 'Bekliyor'}</Badge></div></CardHeader>
                <CardContent className="space-y-3"><p className="text-sm text-muted-foreground">{survey.description || 'Açıklama eklenmemiş.'}</p><Button className="w-full gap-2" variant={survey.submitted ? 'outline' : 'default'} disabled={survey.submitted} onClick={() => navigate('/student/survey/' + survey.id)}>{survey.submitted ? <CheckCircle2 className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}{survey.submitted ? 'Tamamlandı' : 'Anketi Yanıtla'}</Button></CardContent>
              </Card>
            ))}
          </div>
        }
      </div>
    </DashboardLayout>
  );
}
