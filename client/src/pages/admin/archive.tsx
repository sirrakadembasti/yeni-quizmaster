import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AdminQueryState } from '@/components/management/AdminQueryState';
import { classApi, quizApi } from '@/lib/api';
import { archiveApi, type ArchiveJob, type TransitionRule } from '@/lib/archive-api';
import { useAcademicYear } from '@/context/academic-year-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const statuses: Record<string, string> = { queued: 'Sırada', capturing: 'Veriler kopyalanıyor', files_generating: 'Dosyalar hazırlanıyor', verified: 'Dosyalar doğrulandı', completed: 'Tamamlandı', retry_wait: 'Yeniden deneme bekleniyor', failed: 'Başarısız', cancelled: 'Kopyalama başlamadan iptal edildi' };
const running = (status: string) => !['completed', 'failed', 'cancelled'].includes(status);
const ruleLocked = (status: string) => ['capturing', 'files_generating', 'verified'].includes(status);

export default function ArchivePage() {
  const queryClient = useQueryClient();
  const academic = useAcademicYear();
  const academicRef = useRef(academic);
  const [selected, setSelected] = useState<string[]>([]);
  const [previewIds, setPreviewIds] = useState<string[]>([]);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [rulesDirty, setRulesDirty] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [focusJob, setFocusJob] = useState<string | null>(null);
  const [downloadJob, setDownloadJob] = useState<ArchiveJob | null>(null);
  const [password, setPassword] = useState('');
  const [page, setPage] = useState(1);
  const completedJobs = useRef(new Set<string>());
  const years = useQuery({ queryKey: ['archive-years'], queryFn: archiveApi.years, refetchInterval: 15000 });
  const classesQuery = useQuery({ queryKey: ['/api/classes'], queryFn: () => classApi.getAllClasses() });
  const quizzesQuery = useQuery({ queryKey: ['/api/admin/quizzes'], queryFn: () => quizApi.getAllAdminQuizzes() });
  const jobs = useQuery({ queryKey: ['archive-jobs'], queryFn: archiveApi.jobs, refetchInterval: query => query.state.data?.jobs.some(job => running(job.status)) ? 2000 : false });
  const active = years.data?.years.find(year => year.status === 'active');
  const classes = classesQuery.data?.classes ?? [];
  const quizzes = (quizzesQuery.data?.quizzes ?? []).filter(quiz => quiz.status !== 'archived' && !(quiz as any).academicYear);
  const rules = useQuery({ queryKey: ['archive-rules', active?.id], queryFn: () => archiveApi.rules(active!.id), enabled: !!active });
  const preview = useQuery({ queryKey: ['archive-preview', active?.id, previewIds], queryFn: ({ signal }) => archiveApi.preview(previewIds, active?.id, signal), enabled: previewIds.length > 0 && !!active });
  const jobQuery = useQuery({ queryKey: ['archive-job', focusJob], queryFn: () => archiveApi.job(focusJob!), enabled: !!focusJob, refetchInterval: query => query.state.data && running(query.state.data.job.status) ? 2000 : false });
  const logs = useQuery({ queryKey: ['archive-job-logs', focusJob], queryFn: () => archiveApi.logs(focusJob!), enabled: !!focusJob, refetchInterval: focusJob && running(jobQuery.data?.job.status ?? 'queued') ? 2000 : false });
  useEffect(() => { academicRef.current = academic; }, [academic]);
  useEffect(() => { const timer = setTimeout(() => setPreviewIds(selected), 200); return () => clearTimeout(timer); }, [selected]);
  useEffect(() => { setRulesDirty(false); setTargets({}); setSelected([]); }, [active?.id]);
  useEffect(() => { if (rules.data && !rulesDirty) setTargets(Object.fromEntries(rules.data.rules.map(rule => [rule.fromClassId, rule.graduate ? 'graduate' : rule.toClassId ?? '']))); }, [rules.data, rulesDirty, active?.id]);
  useEffect(() => {
    const completed = jobs.data?.jobs.filter(job => job.status === 'completed' && !completedJobs.current.has(job.id)) ?? [];
    if (!completed.length) return;
    completed.forEach(job => completedJobs.current.add(job.id));
    void queryClient.invalidateQueries({ queryKey: ['archive-years'] });
    void queryClient.invalidateQueries({ queryKey: ['/api/admin/quizzes'] });
    void queryClient.invalidateQueries({ queryKey: ['/api/classes'] });
    void queryClient.invalidateQueries({ queryKey: ['archive-jobs'] });
    if (completed.some(job => job.mode === 'annual')) {
      void queryClient.invalidateQueries({ queryKey: ['academic-year-context'] });
      academicRef.current?.reload();
    }
  }, [jobs.data?.jobs, queryClient]);
  const fail = (err: Error) => { setError(err.message); setFeedback(''); };
  const refreshJob = (id: string) => { void queryClient.invalidateQueries({ queryKey: ['archive-jobs'] }); void queryClient.invalidateQueries({ queryKey: ['archive-job', id] }); void queryClient.invalidateQueries({ queryKey: ['archive-job-logs', id] }); };
  const acceptJob = ({ job }: { job: ArchiveJob }) => { setError(''); setSelected([]); setFeedback('Arşiv işlemi kuyruğa alındı. İlerlemeyi aşağıdan izleyebilirsiniz.'); setFocusJob(job.id); refreshJob(job.id); };
  const create = useMutation({ mutationFn: () => archiveApi.create(selected, active?.id), onSuccess: acceptJob, onError: fail });
  const close = useMutation({ mutationFn: () => archiveApi.closeYear(active!.id), onSuccess: acceptJob, onError: fail });
  const retry = useMutation({ mutationFn: (id: string) => archiveApi.retry(id), onSuccess: acceptJob, onError: fail });
  const cancel = useMutation({ mutationFn: (id: string) => archiveApi.cancel(id), onSuccess: ({ job }) => { setError(''); setFocusJob(job.id); setFeedback('Kopyalama başlamadan arşiv iptal edildi. İş verileri korunur; yıllık arşiv devam edebilir.'); refreshJob(job.id); }, onError: fail });
  const missing = classes.filter(cls => !targets[cls.id]);
  const ruleValues: TransitionRule[] = classes.map(cls => ({ fromClassId: cls.id, toClassId: targets[cls.id] === 'graduate' ? null : targets[cls.id], graduate: targets[cls.id] === 'graduate' }));
  const save = useMutation({ mutationFn: () => archiveApi.saveRules(active!.id, ruleValues), onSuccess: data => { queryClient.setQueryData(['archive-rules', active?.id], data); setRulesDirty(false); setError(''); setFeedback('Sınıf geçiş kuralları kaydedildi. Öğrenciler doğrulanmış yıl sonu arşivinden sonra taşınacak.'); }, onError: fail });
  const download = useMutation({ mutationFn: async () => { await archiveApi.authorizeDownload(downloadJob!.id, password); setPassword(''); await archiveApi.download(downloadJob!.id); }, onSuccess: () => { setDownloadJob(null); setError(''); setFeedback('Doğrulanmış arşiv indirmesi başlatıldı.'); }, onError: err => { setPassword(''); fail(err); } });
  const queries = [years, classesQuery, quizzesQuery, jobs];
  if (queries.some(query => query.isPending || query.isError)) return <DashboardLayout><AdminQueryState queries={queries} /></DashboardLayout>;
  const busy = create.isPending || close.isPending || retry.isPending || cancel.isPending;
  const previewReady = selected.length > 0 && selected === previewIds && preview.isSuccess && !preview.isFetching;
  const rulesReady = rules.isSuccess && !rulesDirty && missing.length === 0;
  const due = !!active?.canClose;
  const annualRunning = jobs.data?.jobs.some(job => job.academicYearId === active?.id && job.mode === 'annual' && running(job.status));
  const rulesLocked = jobs.data?.jobs.some(job => job.academicYearId === active?.id && job.mode === 'annual' && ruleLocked(job.status));
  const allJobs = jobs.data?.jobs ?? [];
  const focusedJob = jobQuery.data?.job;
  const blockers = allJobs.filter(job => job.mode === 'annual' && job.academicYearId === active?.id).flatMap(job => job.blockers ?? []);
  const pages = Math.max(1, Math.ceil(allJobs.length / 20));
  return <DashboardLayout><div className="space-y-4">
    <h1 className="text-2xl font-bold">Yıl Sonu ve Arşiv İşlemleri</h1>
    <p className="text-muted-foreground">Aktif eğitim yılı: {active?.label ?? 'Bulunamadı'}. Arşiv PDF ve CSV iş verilerini içerir.</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}{feedback && <p role="status">{feedback}</p>}
    <Tabs defaultValue="manual"><TabsList className="flex flex-wrap h-auto"><TabsTrigger value="manual">Manuel Arşiv</TabsTrigger><TabsTrigger value="annual">Yıl Sonu</TabsTrigger><TabsTrigger value="history">Geçmiş ve İşler</TabsTrigger><TabsTrigger value="rules">Sınıf Geçişi</TabsTrigger></TabsList>
      <TabsContent value="manual"><Card><CardHeader><CardTitle>İçerikleri Seçin</CardTitle></CardHeader><CardContent className="space-y-3">
        <p>Yalnız seçilen sınav ve anketler ile ilişkili iş verileri arşivlenir. Bu işlem yılı kapatmaz ve öğrenci taşımaz.</p>
        {!quizzes.length && <p>Arşivlenebilir içerik bulunmuyor.</p>}
        <div className="max-h-80 overflow-auto space-y-2">{quizzes.map(quiz => <label key={quiz.id} className="flex items-center gap-3 rounded-lg border p-3"><input type="checkbox" checked={selected.includes(quiz.id)} onChange={event => setSelected(ids => event.target.checked ? [...ids, quiz.id] : ids.filter(id => id !== quiz.id))} />{quiz.title} ({quiz.contentType === 'survey' ? 'Anket' : 'Sınav'})</label>)}</div>
        {selected.length > 0 && <div aria-live="polite">{previewReady ? <p>{preview.data.quizzes} içerik, {preview.data.results} sınav sonucu, {preview.data.surveySubmissions} anket yanıtı, {preview.data.questions ?? 0} soru seçildi.</p> : preview.isError ? <div role="alert">{preview.error.message} <Button onClick={() => void preview.refetch()}>Ön İzlemeyi Yenile</Button></div> : <p>Seçim ön izlemesi yükleniyor...</p>}</div>}
        <Button disabled={!active || !previewReady || busy} onClick={() => create.mutate()}>Seçilenleri Arşivle</Button>
      </CardContent></Card></TabsContent>
      <TabsContent value="annual"><Card><CardHeader><CardTitle>Eğitim Yılını Kapat</CardTitle></CardHeader><CardContent className="space-y-3">
        <p>Otomatik kapanış 15 Temmuz 00:05 (Europe/Istanbul). Bu yılın sınırı: {active ? new Date(active.scheduledCloseAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) : '—'}.</p>
        <p>Yılın bütün iş verileri arşivlenir. Dosyalar doğrulandıktan sonra kayıtlı sınıf geçişleri uygulanır ve yeni eğitim yılı açılır. Öğretmen atamaları değişmez.</p>
        {!due && <p>Kapanış zamanı henüz gelmedi.</p>}{!rulesReady && <p role="status">Yıl sonu için bütün sınıfların geçiş kurallarını kaydedin.</p>}
        {blockers.length > 0 && <div role="status" className="space-y-2"><p>Yıllık arşiv aşağıdaki manuel işlerin tamamlanmasını bekliyor:</p>{blockers.map(blocker => <div key={blocker.id}><p>İş {blocker.id}: {blocker.reason} {blocker.remedy}</p><Button variant="outline" aria-label={`İşi Aç: ${blocker.id}`} onClick={() => setFocusJob(blocker.id)}>İşi Aç</Button></div>)}</div>}
        <Button disabled={!due || !rulesReady || busy || annualRunning} onClick={() => close.mutate()}>Yılı Kapat</Button>
      </CardContent></Card></TabsContent>
      <TabsContent value="history" className="space-y-3">
        <Card><CardHeader><CardTitle>Tamamlanan Eğitim Yılları</CardTitle></CardHeader><CardContent>{years.data?.years.filter(year => year.status === 'closed').map(year => <p key={year.id}>{year.label} — Tamamlandı{year.closedAt ? ` (${new Date(year.closedAt).toLocaleDateString('tr-TR')})` : ''}</p>)}{!years.data?.years.some(year => year.status === 'closed') && <p>Henüz tamamlanan eğitim yılı yok.</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Arşiv İşleri</CardTitle></CardHeader><CardContent className="space-y-3">
          {!allJobs.length && <p>Henüz arşiv işi yok.</p>}{allJobs.slice((Math.min(page, pages) - 1) * 20, Math.min(page, pages) * 20).map(job => <div key={job.id} className="border rounded-lg p-3 space-y-2">
            <p>{job.label} — {job.mode === 'annual' ? 'Yıllık' : 'Manuel'} — {statuses[job.status] ?? job.status}</p>
            <p className="text-xs text-muted-foreground">İş {job.id} · {job.createdAt && new Date(job.createdAt).toLocaleString('tr-TR')} · Bu döngüde deneme: {job.attempts} · Toplam deneme: {job.lifetimeAttempts ?? job.attempts} · Yönetici kurtarması: {job.recoveryCount ?? 0}</p>
            {job.error && <p role="alert">{job.error}</p>}
            {job.blockers?.map(blocker => <p key={blocker.id}>Beklenen iş {blocker.id}: {blocker.reason} {blocker.remedy}</p>)}
            {job.status === 'failed' && <p>Yeniden Dene aynı dondurulmuş verilerle yeni, sınırlı bir deneme döngüsü başlatır. Bozuk tamamlanmamış paket gerekçesiyle karantinaya alınır.</p>}
            <Button variant="outline" onClick={() => setFocusJob(job.id)}>İlerleme ve Kayıtlar</Button> {job.status === 'failed' && <Button disabled={retry.isPending || cancel.isPending} onClick={() => retry.mutate(job.id)}>Yeniden Dene</Button>} {job.status === 'failed' && job.canCancel && <Button variant="outline" disabled={cancel.isPending || retry.isPending} onClick={() => cancel.mutate(job.id)}>Kopyalama başlamadan iptal</Button>} {job.status === 'completed' && <Button onClick={() => { setPassword(''); setError(''); setDownloadJob(job); }}>Arşivi İndir</Button>}
          </div>)}
          {pages > 1 && <div className="flex gap-3"><Button disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Önceki</Button><span>{Math.min(page, pages)} / {pages}</span><Button disabled={page >= pages} onClick={() => setPage(value => value + 1)}>Sonraki</Button></div>}
        </CardContent></Card>
      </TabsContent>
      <TabsContent value="rules"><Card><CardHeader><CardTitle>Kalıcı Sınıf Geçiş Kuralları</CardTitle></CardHeader><CardContent className="space-y-3">
        <p>Her kaynak sınıf için açıkça hedef sınıf veya mezuniyet seçin. Öğrenci hesapları mezuniyette korunur. Öğretmen atamaları değişmez.</p><AdminQueryState queries={active ? [rules] : []} />
        {classes.map(cls => <div key={cls.id} className="flex flex-wrap items-center gap-3"><Label htmlFor={`target-${cls.id}`}>{cls.name} hedefi</Label><select id={`target-${cls.id}`} className="border rounded-md p-2 bg-background" disabled={!active || rulesLocked || save.isPending} value={targets[cls.id] ?? ''} onChange={event => { setRulesDirty(true); setTargets(values => ({ ...values, [cls.id]: event.target.value })); }}><option value="">Hedef seçin</option><option value="graduate">Mezuniyet</option>{classes.filter(target => target.id !== cls.id).map(target => <option key={target.id} value={target.id}>{target.name}</option>)}</select><span className="text-muted-foreground text-sm">{cls._count?.students ?? 0} öğrenci</span></div>)}
        {missing.length > 0 && <p>{missing.length} sınıfın hedefi eksik.</p>}<Button disabled={!active || !rules.isSuccess || missing.length > 0 || !rulesDirty || save.isPending || rulesLocked} onClick={() => save.mutate()}>Geçiş Kurallarını Kaydet</Button>
      </CardContent></Card></TabsContent>
    </Tabs>
    {focusJob && <Card role="region" aria-label="Seçilen arşiv işi"><CardHeader><CardTitle>İş İlerlemesi</CardTitle></CardHeader><CardContent className="space-y-2">
      <AdminQueryState queries={[jobQuery, logs]} />
      {focusedJob && <><p>İş {focusedJob.id}</p><p role="status">{statuses[focusedJob.status] ?? focusedJob.status}</p></>}
      {focusedJob?.error && <p role="alert">{focusedJob.error}</p>}
      {jobQuery.isSuccess && focusedJob?.status === 'failed' && <div className="flex flex-wrap gap-2">
        <Button aria-label={`Yeniden Dene: ${focusedJob.id}`} disabled={busy || jobQuery.isFetching} onClick={() => retry.mutate(focusedJob.id)}>Yeniden Dene</Button>
        {focusedJob.canCancel && <Button variant="outline" aria-label={`Kopyalama başlamadan iptal: ${focusedJob.id}`} disabled={busy || jobQuery.isFetching} onClick={() => cancel.mutate(focusedJob.id)}>Kopyalama başlamadan iptal</Button>}
      </div>}
      {logs.data?.logs.map(log => <p key={log.id} className="text-sm">{new Date(log.createdAt).toLocaleString('tr-TR')} — {log.action}</p>)}
    </CardContent></Card>}
    <Dialog open={!!downloadJob} onOpenChange={open => { if (!open && !download.isPending) { setDownloadJob(null); setPassword(''); } }}><DialogContent><DialogTitle>Arşiv İndirme Doğrulaması</DialogTitle><DialogDescription>Tamamlanan arşivi indirmek için yönetici şifrenizi tekrar doğrulayın.</DialogDescription><form className="space-y-3" onSubmit={event => { event.preventDefault(); if (password && downloadJob?.status === 'completed') download.mutate(); }}><Label htmlFor="archive-password">Yönetici şifresi</Label><Input id="archive-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} disabled={download.isPending} />{error && <p role="alert">{error}</p>}<Button type="submit" disabled={!password || download.isPending}>Şifreyi Doğrula ve İndir</Button></form></DialogContent></Dialog>
  </div></DashboardLayout>;
}
