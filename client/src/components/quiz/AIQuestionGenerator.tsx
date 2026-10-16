import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { teacherAI, type AIModel } from '@/lib/ai-management-api';
import { ApiError } from '@/lib/http-error';
import { useAuth } from '@/context/auth-context';
interface Props {
    onGenerate: (questions: any[]) => void;
    quizTitle?: string;
    quizDescription?: string;
    contentType?: 'exam' | 'survey';
    usageContext?: {draftId?:string;quizId?:string;quizTitle?:string;categoryId?:string|null};
}
export function AIQuestionGenerator({ onGenerate, quizTitle = '', quizDescription = '', contentType = 'exam', usageContext }: Props) {
    const { role, user } = useAuth();
    const { toast } = useToast();
    const [open, setOpen] = useState(false), [difficulty, setDifficulty] = useState('medium'), [count, setCount] = useState('3');
    const [models, setModels] = useState<AIModel[]>([]), [selected, setSelected] = useState(''), [loading, setLoading] = useState(false), [error, setError] = useState(''), [generating, setGenerating] = useState(false);
    const session = useRef<AbortController | null>(null), busy = useRef(false);
    const topic = `${quizTitle}${quizDescription ? ' - ' + quizDescription : ''}`.trim();
    const load = async (signal: AbortSignal, allowDefault = true) => { setLoading(true); setError(''); setSelected(''); try {
        const data = await teacherAI.models(signal);
        if (signal.aborted)
            return;
        setModels(data.models);
        if (allowDefault)
            setSelected(data.defaultProfileId || (data.models.length === 1 ? data.models[0].id : ''));
    }
    catch (e) {
        if (!signal.aborted) {
            setModels([]);
            setError(e instanceof Error ? e.message : 'Modeller yüklenemedi.');
        }
    }
    finally {
        if (!signal.aborted)
            setLoading(false);
    } };
    useEffect(() => { const controller = new AbortController(); session.current = controller; busy.current = false; setGenerating(false); if (open && (role === 'admin' || role === 'teacher'))
        void load(controller.signal); return () => controller.abort(); }, [open, role, user?.id]);
    const generate = async () => { const controller = session.current; if (!controller || controller.signal.aborted || busy.current || !selected || !topic)
        return; busy.current = true; setGenerating(true); try {
        const result = await teacherAI.generate({ profileId: selected, topic, count: Math.min(10, Math.max(1, parseInt(count) || 3)), difficulty, contentType, ...(usageContext ? {context:usageContext} : {}) }, controller.signal);
        if (controller.signal.aborted)
            return;
        if (!result.questions?.length)
            throw new Error('Sorular oluşturulamadı');
        onGenerate(result.questions);
        setOpen(false);
        toast({ title: 'Sorular Oluşturuldu', description: `Yapay zeka başarıyla ${result.questions.length} yeni soru oluşturdu.` });
    }
    catch (e) {
        if (controller.signal.aborted)
            return;
        toast({ title: 'Hata', description: e instanceof Error ? e.message : 'Sorular oluşturulamadı', variant: 'destructive' });
        if (e instanceof ApiError && e.status === 409)
            await load(controller.signal, false);
    }
    finally {
        if (!controller.signal.aborted) {
            busy.current = false;
            setGenerating(false);
        }
    } };
    const close = (value: boolean) => { if (!value)
        session.current?.abort(); setOpen(value); };
    return <Dialog open={open} onOpenChange={close}><DialogTrigger asChild><Button variant="outline" className="w-full h-12 gap-2"><Sparkles className="h-4 w-4"/>AI ile {contentType === 'survey' ? 'Anket Soruları' : 'Soruları'} Üret</Button></DialogTrigger><DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>AI Soru Üretici</DialogTitle><DialogDescription>Başlık ve açıklamadan {contentType === 'survey' ? 'anket' : 'sınav'} soruları oluşturun.</DialogDescription></DialogHeader><div className="space-y-4 py-4"><div className="rounded-xl bg-muted/30 p-4 border"><Label>Konu (Otomatik)</Label><p>{topic || 'Lütfen önce sınav ayarlarından başlık girin!'}</p></div><div className="grid grid-cols-2 gap-4"><div><Label htmlFor="ai-difficulty">Zorluk</Label><select id="ai-difficulty" className="flex h-10 w-full rounded-md border bg-background px-3" value={difficulty} onChange={e => setDifficulty(e.target.value)} disabled={generating}><option value="easy">Başlangıç Seviyesi</option><option value="medium">Orta Seviye</option><option value="hard">İleri Seviye</option></select></div><div><Label htmlFor="ai-count">Soru Sayısı</Label><Input id="ai-count" type="number" min={1} max={10} value={count} disabled={generating} onChange={e => setCount(e.target.value)}/></div></div><Label htmlFor="ai-model">AI modeli</Label>{loading ? <p role="status">Modeller yükleniyor…</p> : error ? <div role="alert"><p>{error}</p><Button onClick={() => session.current && void load(session.current.signal)}>Yeniden dene</Button></div> : models.length === 0 ? <p>Yöneticinize başvurun: Kullanıma açık AI modeli yok.</p> : <select id="ai-model" className="flex h-10 w-full rounded-md border bg-background px-3" value={selected} disabled={generating} onChange={e => setSelected(e.target.value)}><option value="">Model seçin</option>{models.map(m => <option key={m.id} value={m.id}>{m.name} · {m.provider} · {m.model}</option>)}</select>}</div><DialogFooter><Button variant="outline" onClick={() => close(false)}>İptal</Button><Button disabled={!topic || !selected || loading || generating} onClick={generate}>{generating ? 'Sorular Hazırlanıyor...' : contentType === 'survey' ? 'Anket Sorularını Üret' : 'Sınav Sorularını Üret'}</Button></DialogFooter></DialogContent></Dialog>;
}
