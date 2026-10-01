import { useEffect, useMemo, useRef, useState } from "react";
import { AdminQueryState } from '@/components/management/AdminQueryState';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clipboard, Database, HardDrive, RefreshCw, Save, ServerCog, ShieldAlert, XCircle } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { deploymentApi, type DeploymentConfig } from "@/lib/api";
import { toast } from "sonner";

const emptyConfig: DeploymentConfig = {
  mode: "subdomain",
  publicUrl: "https://sinav.ornek.kurum.tr",
  basePath: "/",
  allowedOrigins: ["https://sinav.ornek.kurum.tr"],
  trustProxyHops: 1,
  retention: {
    enabled: false,
    actionLogDays: 365,
    readNotificationDays: 180,
    emailLogDays: 90,
    passwordResetDays: 90,
  },
};

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${ok ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"}`}>
      {ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
      <span>{label}</span>
    </div>
  );
}

function CodeBlock({ title, value }: { title: string; value: string }) {
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    toast.success(`${title} panoya kopyalandı.`);
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label>{title}</Label>
        <Button type="button" variant="outline" size="sm" onClick={copy}><Clipboard className="mr-2 h-4 w-4" />Kopyala</Button>
      </div>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border bg-slate-950 p-4 text-xs leading-5 text-slate-100">{value}</pre>
    </div>
  );
}

export default function ServerSetupPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<DeploymentConfig>(emptyConfig);
  const [originsText, setOriginsText] = useState(emptyConfig.allowedOrigins.join("\n"));
  const baseline = useRef<DeploymentConfig | null>(null);
  const origins = useMemo(() => originsText.split(/[\n,]/).map((value) => value.trim()).filter(Boolean), [originsText]);
  const dirty = baseline.current !== null && JSON.stringify({ ...form, allowedOrigins: origins }) !== JSON.stringify(baseline.current);

  const statusQuery = useQuery({
    queryKey: ["deployment-status"],
    queryFn: deploymentApi.getStatus,
    staleTime: 0,
  });

  useEffect(() => {
    if (!statusQuery.data) return;
    if (dirty) return;
    baseline.current = statusQuery.data.config;
    setForm(statusQuery.data.config);
    setOriginsText(statusQuery.data.config.allowedOrigins.join("\n"));
  }, [statusQuery.data]);

  const saveMutation = useMutation({
    mutationFn: deploymentApi.saveConfiguration,
    onSuccess: (data) => {
      baseline.current = data.config;
      setForm(data.config);
      setOriginsText(data.config.allowedOrigins.join("\n"));
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["deployment-status"] });
    },
    onError: (error: Error) => toast.error(error.message || "Yapılandırma kaydedilemedi."),
  });

  const retentionMutation = useMutation({
    mutationFn: deploymentApi.runRetention,
    onSuccess: (data) => toast.success(data.message, { description: `İşlem logu: ${data.result.actionLogs ?? 0}; okunmuş bildirim: ${data.result.readNotifications ?? 0}; e-posta: ${data.result.emailLogs ?? 0}; parola talebi: ${data.result.passwordResets ?? 0} kayıt silindi.` }),
    onError: (error: Error) => toast.error(error.message || "Bakım işi çalıştırılamadı."),
  });

  const artifacts = statusQuery.data?.artifacts;
  const changesAllowed = statusQuery.data?.runtimeChangesAllowed === true;
  const policyMatchesSaved = JSON.stringify(form.retention) === JSON.stringify(statusQuery.data?.config.retention);
  const cleanupReady = !dirty && policyMatchesSaved && !statusQuery.isFetching && !statusQuery.isError && statusQuery.data?.config.retention.enabled === true;

  const save = () => {
    if (form.mode === "subdomain" && form.basePath !== "/") {
      toast.error("Subdomain kurulumunda alt yol / olmalıdır.");
      return;
    }
    if (origins.length === 0) {
      toast.error("En az bir izinli origin girin.");
      return;
    }
    saveMutation.mutate({ ...form, allowedOrigins: origins });
  };

  const runRetention = () => {
    if (!cleanupReady) {
      toast.error("Önce saklama politikasını etkinleştirip kaydedin.");
      return;
    }
    if (window.confirm(`İşlem logu ${form.retention.actionLogDays}, okunmuş bildirim ${form.retention.readNotificationDays}, e-posta ${form.retention.emailLogDays}, tamamlanmış parola talebi ${form.retention.passwordResetDays} günden eskiyse kalıcı silinecek. Devam edilsin mi?`)) {
      retentionMutation.mutate();
    }
  };

  if (!statusQuery.data && (statusQuery.isPending || statusQuery.isError)) return <DashboardLayout><AdminQueryState queries={[statusQuery]} /></DashboardLayout>;
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        {statusQuery.isError && <AdminQueryState queries={[statusQuery]} />}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-black"><ServerCog className="h-8 w-8 text-primary" />Sunucu Durumu</h1>
            <p className="mt-1 text-muted-foreground">Domain, reverse proxy, alt yol ve veri saklama yapılandırmasını denetleyin.</p>
          </div>
          <Button variant="outline" onClick={() => statusQuery.refetch()} disabled={statusQuery.isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${statusQuery.isFetching ? "animate-spin" : ""}`} />Sunucuyu Yeniden Algıla
          </Button>
        </div>

        <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20">
          <CardContent className="flex gap-3 p-4 text-sm text-amber-900 dark:text-amber-200">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <p>Bu ekran gizli anahtarları göstermez veya değiştirmez. `DATABASE_URL`, `SESSION_SECRET` ve Gmail uygulama parolası sunucunun `.env`/secret yöneticisinde tutulmalıdır. Kaydedilen ağ ayarları yeniden başlatmada; alt yol ise ayrıca frontend yeniden derlendiğinde etkinleşir.</p>
          </CardContent>
        </Card>

        {!changesAllowed && (
          <Card className="border-sky-200 bg-sky-50/60 dark:border-sky-900 dark:bg-sky-950/20">
            <CardContent className="p-4 text-sm text-sky-900 dark:text-sky-200">
              Bu ekran salt okunur durumdadır. İlk kurulum ayrı ve tek kullanımlık <code>pnpm setup</code> sihirbazıyla yapılır. Çalışan sistemde profil yazma ve kalıcı temizlik yalnız sunucu yöneticisi <code>ALLOW_RUNTIME_DEPLOYMENT_CHANGES=true</code> değerini bilinçli olarak etkinleştirirse açılır.
            </CardContent>
          </Card>
        )}

        {statusQuery.data && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatusBadge ok={statusQuery.data.checks.databaseReady} label="Veritabanı erişilebilir" />
            <StatusBadge ok={statusQuery.data.checks.uploadsWritable} label="Yükleme alanı yazılabilir" />
            <StatusBadge ok={statusQuery.data.checks.sessionSecretConfigured} label="Oturum anahtarı tanımlı" />
            <StatusBadge ok={statusQuery.data.checks.httpsDetected || !statusQuery.data.checks.productionMode} label="HTTPS algılandı" />
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Dağıtım Profili</CardTitle><CardDescription>Subdomain önerilir; alt yol mevcut kurum sitesiyle servis yollarını paylaşır.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Kurulum biçimi</Label><Select value={form.mode} onValueChange={(mode: DeploymentConfig['mode']) => setForm((current) => ({ ...current, mode, basePath: mode === 'subdomain' ? '/' : current.basePath }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="subdomain">Subdomain</SelectItem><SelectItem value="subpath">Kurum sitesi altında alt yol</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Güvenilir proxy sayısı</Label><Input type="number" min={0} max={5} value={form.trustProxyHops} onChange={(event) => setForm((current) => ({ ...current, trustProxyHops: Number(event.target.value) }))} /></div>
              </div>
              <div className="space-y-2"><Label>Herkese açık kurum adresi</Label><Input value={form.publicUrl} onChange={(event) => setForm((current) => ({ ...current, publicUrl: event.target.value }))} placeholder="https://sinav.kurum.gov.tr" /></div>
              <div className="space-y-2"><Label>Uygulama alt yolu</Label><Input value={form.basePath} disabled={form.mode === 'subdomain'} onChange={(event) => setForm((current) => ({ ...current, basePath: event.target.value }))} placeholder="/quizmaster" /></div>
              <div className="space-y-2"><Label>İzinli origin adresleri</Label><Textarea value={originsText} onChange={(event) => setOriginsText(event.target.value)} rows={4} placeholder="Her satıra bir https:// adresi" /></div>
              <Button onClick={save} disabled={saveMutation.isPending || !changesAllowed}><Save className="mr-2 h-4 w-4" />Profili Kaydet</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Algılanan Sunucu</CardTitle><CardDescription>Reverse proxy tarafından uygulamaya iletilen güvenli özet.</CardDescription></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {Object.entries(statusQuery.data?.detected || {}).map(([key, value]) => <div key={key} className="flex items-start justify-between gap-4 border-b pb-2"><span className="text-muted-foreground">{key}</span><span className="break-all text-right font-medium">{String(value ?? '—')}</span></div>)}
              <div className="grid gap-2 pt-2 sm:grid-cols-2">
                <div className="rounded-lg border p-3"><Database className="mb-2 h-5 w-5 text-primary" /><div className="font-semibold">Yapılandırma kaynağı</div><div className="text-muted-foreground">{statusQuery.data?.source || '—'}</div></div>
                <div className="rounded-lg border p-3"><HardDrive className="mb-2 h-5 w-5 text-primary" /><div className="font-semibold">Gmail</div><div className="text-muted-foreground">{statusQuery.data?.checks.email.authConfigured ? 'Hazır' : 'Eksik'}</div></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Veri Saklama Politikası</CardTitle><CardDescription>Varsayılan olarak kapalıdır. Yalnız süresi dolmuş operasyon kayıtlarını temizler; sınav ve anket sonuçlarına dokunmaz.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border p-4"><div><div className="font-semibold">Otomatik günlük bakım</div><div className="text-sm text-muted-foreground">Okunmuş bildirim, tamamlanmış e-posta/parola talepleri ve işlem logları</div></div><Switch checked={form.retention.enabled} onCheckedChange={(enabled) => setForm((current) => ({ ...current, retention: { ...current.retention, enabled } }))} /></div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {([
                ['actionLogDays', 'İşlem logu (gün)'],
                ['readNotificationDays', 'Okunmuş bildirim (gün)'],
                ['emailLogDays', 'E-posta logu (gün)'],
                ['passwordResetDays', 'Parola talebi (gün)'],
              ] as const).map(([key, label]) => <div className="space-y-2" key={key}><Label>{label}</Label><Input type="number" min={key === 'actionLogDays' ? 30 : 7} max={3650} value={form.retention[key]} onChange={(event) => setForm((current) => ({ ...current, retention: { ...current.retention, [key]: Number(event.target.value) } }))} /></div>)}
            </div>
            <div className="flex flex-wrap gap-3"><Button onClick={save} disabled={saveMutation.isPending || !changesAllowed}><Save className="mr-2 h-4 w-4" />Politikayı Kaydet</Button><Button variant="destructive" onClick={runRetention} disabled={retentionMutation.isPending || !cleanupReady || !changesAllowed}>Şimdi Temizle</Button></div>
            {dirty && <p role="status" className="text-sm text-muted-foreground">Kaydedilmemiş değişiklikler var. Temizlikten önce politikayı kaydedin.</p>}
            {!dirty && !policyMatchesSaved && statusQuery.data && <div role="status"><p>Kaydedilen politika değişti. Temizlikten önce güncel profili yükleyin.</p><Button variant="outline" onClick={() => { const config = statusQuery.data!.config; baseline.current = config; setForm(config); setOriginsText(config.allowedOrigins.join('\n')); }}>Kaydedilen Profili Yükle</Button></div>}
          </CardContent>
        </Card>

        {artifacts && <div className="grid gap-6 xl:grid-cols-2"><Card><CardHeader><CardTitle>Ortam Değişkeni Şablonu</CardTitle></CardHeader><CardContent><CodeBlock title=".env.production" value={artifacts.envText} /></CardContent></Card><Card><CardHeader><CardTitle>Nginx Reverse Proxy Şablonu</CardTitle></CardHeader><CardContent><CodeBlock title="Nginx yapılandırması" value={artifacts.nginxText} /></CardContent></Card><Card className="xl:col-span-2"><CardHeader><CardTitle>Derleme Komutu</CardTitle><CardDescription>Alt yol değiştiğinde bu komutla yeniden derleyin.</CardDescription></CardHeader><CardContent><CodeBlock title="PowerShell" value={artifacts.buildCommand} /></CardContent></Card></div>}
      </div>
    </DashboardLayout>
  );
}
