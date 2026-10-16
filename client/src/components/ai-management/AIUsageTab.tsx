import { useEffect, useState } from 'react';
import { adminAI, type AIUsageFilters, type AIUsageResult } from '@/lib/ai-management-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
const fields = [['from', 'Başlangıç tarihi', 'date'], ['to', 'Bitiş tarihi', 'date'], ['teacher', 'Öğretmen ara', 'text'], ['course', 'Ders ara', 'text'], ['quiz', 'Sınav adı ara', 'text'], ['model', 'Model ara', 'text']] as const;
const statuses: Record<string, string> = {pending:'İşleniyor',success:'Başarılı',invalid:'Geçersiz soru',error:'Sağlayıcı hatası',timeout:'Süre aşımı',cancelled:'İptal',unknown:'Sonucu bilinmiyor',unknown_outcome:'Sonucu bilinmiyor'};
const number = (n: number | null) => n == null ? 'Bilinmiyor' : n.toLocaleString('tr-TR');
export function AIUsageTab({active, onLoaded}: {active: boolean; onLoaded?: (data: AIUsageResult) => void}) {
    const [draft, setDraft] = useState<AIUsageFilters>({page:1,pageSize:25});
    const [filters, setFilters] = useState<AIUsageFilters>({page:1,pageSize:25});
    const [data, setData] = useState<AIUsageResult | null>(null);
    const [loading, setLoading] = useState(false), [error, setError] = useState(''), [reload, setReload] = useState(0);
    useEffect(() => {
        if (!active) return;
        const controller = new AbortController();
        setLoading(true); setError(''); setData(null);
        adminAI.usage(filters, controller.signal).then(next => { if (!controller.signal.aborted) { setData(next); onLoaded?.({...next, averages: next.averages.map(a => ({...a, from: a.from || filters.from || 'takip başlangıcı', to: a.to || filters.to || 'bugün'}))}); } }).catch(e => {if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Kullanım bilgileri yüklenemedi.');}).finally(() => {if (!controller.signal.aborted) setLoading(false);});
        return () => controller.abort();
    }, [active, filters, reload, onLoaded]);
    return <div className="space-y-5"><div><h1 className="text-2xl font-bold">Öğretmen AI kullanımı</h1><p className="text-sm text-muted-foreground">Her satır bir üretim isteğidir. Adlar ve model, üretim anındaki bilgilerle gösterilir. Düşünme tokenı çıktının alt kalemidir; tekrar toplanmaz.</p></div>
        <form className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={e => {e.preventDefault();setFilters({...draft,page:1});}}>
            {fields.map(([key,label,type]) => <div key={key}><Label htmlFor={'usage-'+key}>{label}</Label><Input id={'usage-'+key} type={type} value={draft[key] || ''} onChange={e => setDraft(prev => ({...prev,[key]:e.target.value}))}/></div>)}
            <div><Label htmlFor="usage-status">Sonuç</Label><select id="usage-status" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.status || ''} onChange={e => setDraft(prev => ({...prev,status:e.target.value}))}><option value="">Tüm sonuçlar</option>{Object.entries(statuses).filter(([key]) => key !== 'unknown_outcome').map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></div>
            <div><Label htmlFor="usage-size">Sayfa başına</Label><select id="usage-size" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.pageSize} onChange={e => setDraft(prev => ({...prev,pageSize:Number(e.target.value)}))}>{[25,50,100].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
            <Button type="submit" disabled={loading}>Filtrele</Button><Button type="button" variant="outline" disabled={loading} onClick={() => {setDraft({page:1,pageSize:25});setFilters({page:1,pageSize:25});}}>Filtreleri temizle</Button>
        </form>
        {error && <div role="alert"><p>{error}</p><Button onClick={() => setReload(n => n+1)}>Yeniden dene</Button></div>}
        {loading && <p role="status">Kullanım bilgileri yükleniyor…</p>}
        {data && !error && <><dl className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-4"><div><dt>Filtrelenen istek</dt><dd>{number(data.summary.requests)}</dd></div><div><dt>Bilinen girdi tokenı toplamı</dt><dd>{number(data.summary.inputTokens)}</dd></div><div><dt>Bilinen çıktı tokenı toplamı</dt><dd>{number(data.summary.outputTokens)}</dd></div><div><dt>Token bilgisi eksik istek</dt><dd>{number(data.summary.unknownUsageRequests)}</dd></div></dl>
        <p className="text-sm text-muted-foreground">Eksik tüketim sıfır sayılmaz. Süre aşımı veya iptal, tüketim olmadığı anlamına gelmez. Token sayıları ücret veya kalan kota değildir.</p>
        {!data.rows.length ? <p>Bu filtrelerde kullanım kaydı yok. Takip başlamadan önceki tüketim geçmiş kayıtlardan hesaplanamaz.</p> : <div className="max-w-full overflow-x-auto rounded-xl border" role="region" aria-label="Öğretmen kullanım tablosu" tabIndex={0}><table className="w-full min-w-[1300px] text-sm"><caption className="sr-only">Üretim anındaki öğretmen, ders, sınav ve sağlayıcı tüketimi</caption><thead><tr>{['Tarih / saat','Öğretmen','Ders','Sınav / anket','Profil','Sağlayıcı / model','Soru (istenen / geçerli)','Girdi tokenı','Çıktı tokenı','Düşünme tokenı (çıktının içinde)','Süre','Sonuç'].map(label => <th key={label} scope="col" className="p-3 text-left">{label}</th>)}</tr></thead><tbody>{data.rows.map(row => <tr key={row.id} className="border-t"><td className="p-3 whitespace-nowrap">{new Date(row.createdAt).toLocaleString('tr-TR')}</td><td className="p-3"><p>{row.teacherName}</p><p className="text-xs text-muted-foreground">{row.teacherEmail}</p></td><td className="p-3">{row.courseName || 'Ders seçilmedi'}</td><td className="p-3"><p>{row.quizTitle || 'Başlıksız'}</p><p className="text-xs text-muted-foreground">{row.contentType === 'survey' ? 'Anket' : 'Sınav'} · <span>{row.quizId ? 'Kayıtlı' : 'Taslak'}</span></p></td><td className="p-3">{row.profileName}</td><td className="p-3">{row.provider} · {row.model}</td><td className="p-3">{row.questionCount} / {number(row.validQuestionCount)}</td><td className="p-3">{number(row.inputTokens)}</td><td className="p-3">{number(row.outputTokens)}</td><td className="p-3">{number(row.reasoningTokens)}</td><td className="p-3">{row.durationMs == null ? 'Bilinmiyor' : `${number(row.durationMs)} ms`}</td><td className="p-3">{statuses[row.status] || 'Sonucu bilinmiyor'}</td></tr>)}</tbody></table></div>}
        <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={loading || filters.page! <= 1} onClick={() => setFilters(prev => ({...prev,page:(prev.page || 1)-1}))}>Önceki</Button><p aria-live="polite">Sayfa {data.page} / {Math.max(1,Math.ceil(data.total/data.pageSize))} · {data.total} kayıt</p><Button variant="outline" disabled={loading || (filters.page || 1)*data.pageSize >= data.total} onClick={() => setFilters(prev => ({...prev,page:(prev.page || 1)+1}))}>Sonraki</Button></div></>}
    </div>;
}
