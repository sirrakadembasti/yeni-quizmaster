export interface AcademicYear { id: string; label: string; status: string; snapshotId?: string | null }
export const orderAcademicYears = (years: AcademicYear[]) => [...years].sort((a,b) => Number(b.status === 'active') - Number(a.status === 'active') || b.label.localeCompare(a.label));
export const historySections = [
  ['user','Kişiler'], ['student','Öğrenciler'], ['teacher','Öğretmenler'], ['class','Sınıflar'], ['category','Dersler'], ['teacherAssignment','Ders atamaları'], ['quiz','Sınavlar'], ['survey','Anketler'], ['question','Sorular'], ['result','Sonuçlar'], ['surveySubmission','Anket katılımları'], ['surveyAnswer','Anket cevapları'], ['guardianLink','Veli eşleştirmeleri'], ['announcement','Duyurular'], ['questionBank','Soru bankası'],
] as const;
export function historicalSection(path: string): string {
  if (path === '/survey-results') return 'surveyAnswer';
  if (path.includes('survey')) return 'survey';
  if (path.includes('result') || path.includes('statistics')) return 'result';
  if (path.includes('teacher')) return 'teacher';
  if (path.includes('class')) return 'class';
  if (path.includes('guardian')) return 'guardianLink';
  if (path.includes('announcement')) return 'announcement';
  if (path.includes('quiz')) return 'quiz';
  if (path.includes('student')) return 'student';
  return 'user';
}
export interface HistoricalRoute { section:string; view:'records'|'statistics'|'summary'|'unsupported'; title:string; notice?:string; entityId?:string; teacherId?:string; classId?:string; studentId?:string; quizId?:string }
export function historicalRoute(path:string, search=''):HistoricalRoute {
  const result:HistoricalRoute={section:historicalSection(path),view:'records',title:'Arşiv kayıtları'};
  const params=new URLSearchParams(search);
  for (const key of ['studentId','classId','teacherId','quizId'] as const) { const id=params.get(key);if(id) result[key]=id.slice(0,100); }
  const teacher=path.match(/^\/teachers\/([^/]+)$/), cls=path.match(/^\/(?:admin\/)?classes\/([^/]+)$/), detail=path.match(/^\/student\/result\/([^/]+)$/), quiz=path.match(/^\/(?:student\/quiz|quizzes)\/([^/]+)$/);
  if(teacher){result.teacherId=teacher[1].slice(0,100);result.title='Öğretmenin arşiv kayıtları';}
  if(cls){result.classId=cls[1].slice(0,100);result.title='Sınıfın arşiv kayıtları';}
  if(detail){result.entityId=detail[1].slice(0,100);result.title='Sınav sonucu ayrıntıları';}
  if(quiz){result.quizId=quiz[1].slice(0,100);result.title='Sınavın arşiv kayıtları';}
  if(path==='/statistics'){result.view='statistics';result.title='Sınıf sınav istatistikleri';}
  if(path==='/survey-results') result.title='Anket cevapları ve sonuçları';
  if(path==='/archive'){result.view='summary';result.title='Yıllık arşiv özeti';}
  if(path==='/management'){result.title='Arşivdeki iş kayıtları';result.notice='İşlem günlükleri yıllık arşive dahil değildir.';}
  if(['/settings','/server-setup'].includes(path)){result.view='unsupported';result.title='Geçmiş yıl kapsamı';result.notice='Sistem ayarları, sunucu yapılandırması, parolalar, oturumlar ve işlem günlükleri yıllık iş verisi arşivine dahil değildir. Bu geçmiş yıl ekranı salt okunurdur.';}
  return result;
}
