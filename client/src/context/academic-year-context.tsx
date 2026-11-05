import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient, type Query } from '@tanstack/react-query';
import { useAuth } from './auth-context';
import { apiFetch, handleResponse } from '@/lib/api';
import { orderAcademicYears, type AcademicYear } from '@/components/academic-history/history-model';
interface Context { years: AcademicYear[]; year?: AcademicYear; pending: boolean; error: string; selectYear: (id:string) => Promise<void>; reload: () => void }
const AcademicContext = createContext<Context | null>(null);
interface ContextData { years: AcademicYear[]; academicYearId: string; invalidSelection?: boolean }
const syncKey = 'quizmaster:academic-context';
const businessQuery = (query: Query) => !query.queryKey.some(part => typeof part === 'string' && (part === 'auth' || part.startsWith('/api/auth/') || part === 'notifications' || part === 'academic-year-context'));
export const useAcademicYear = () => useContext(AcademicContext);
export async function historyRequest<T>(path: string, data?: unknown, signal?: AbortSignal): Promise<T> {
  return handleResponse<T>(await apiFetch(`/api/admin/academic-history${path}`, { method:data ? 'POST' : 'GET', credentials:'include', signal, ...(data ? {headers:{'Content-Type':'application/json'},body:JSON.stringify(data)} : {}) }));
}
export function AcademicYearProvider({ children }: { children:ReactNode }) {
  const {user,role} = useAuth();
  const client = useQueryClient();
  const [years,setYears] = useState<AcademicYear[]>([]);
  const [selected,setSelected] = useState('');
  const [pending,setPending] = useState(true);
  const [error,setError] = useState('');
  const [readyUser,setReadyUser] = useState('');
  const userRef = useRef(user?.id); userRef.current = user?.id;
  const generation = useRef(0);
  const readController = useRef<AbortController | null>(null);
  const effective = useRef('');
  const localWrites = useRef(new Set<string>());
  const remoteWrites = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const readContext = useCallback(async (selectionError = '') => {
    if (role !== 'admin' || !user?.id) return;
    const owner = user.id, request = ++generation.current;
    readController.current?.abort();
    const controller = new AbortController(); readController.current = controller;
    try {
      const data = await historyRequest<ContextData>('/context', undefined, controller.signal);
      if (generation.current !== request || userRef.current !== owner) return;
      const ordered = orderAcademicYears(data.years);
      if (localWrites.current.size || remoteWrites.current.size) {
        // Metadata supplies explicit recovery choices if the other tab vanishes.
        // It never commits that GET's selection while a session write is pending.
        setYears(ordered); setReadyUser(owner); return;
      }
      const year = ordered.find(item => item.id === data.academicYearId);
      const valid = !data.invalidSelection && !!year && ['active','closed'].includes(year.status);
      const contextKey = valid ? `${owner}:${year.id}:${year.status}:${year.snapshotId ?? ''}` : `${owner}:invalid:${data.academicYearId}`;
      if (effective.current !== contextKey) {
        setPending(true);
        await client.cancelQueries({ predicate: businessQuery });
        if (generation.current !== request || userRef.current !== owner || localWrites.current.size || remoteWrites.current.size) return;
        client.removeQueries({ predicate: businessQuery }); effective.current = contextKey;
      }
      setYears(ordered); setSelected(valid ? year.id : '');
      setError(valid ? selectionError : 'Seçilen geçmiş yılın tamamlanmış yıllık arşivi doğrulanamadı. Aktif yıla dönün.'); setReadyUser(owner); setPending(false);
    } catch {
      if (generation.current !== request || userRef.current !== owner || localWrites.current.size || remoteWrites.current.size) return;
      setError('Eğitim yılı bağlamı doğrulanamadı. Yeniden deneyin veya aktif yıla dönün.'); setReadyUser(owner); setPending(false);
    }
  }, [client,role,user?.id]);
  useEffect(() => {
    ++generation.current; readController.current?.abort(); effective.current = '';
    localWrites.current.clear(); for (const timer of remoteWrites.current.values()) clearTimeout(timer); remoteWrites.current.clear();
    if (role !== 'admin' || !user?.id) { setPending(false);setYears([]);setSelected('');setError('');setReadyUser('');return; }
    setPending(true);setError('');void readContext();
    const refresh = () => { if (!localWrites.current.size && !remoteWrites.current.size) void readContext(); };
    const timer = setInterval(refresh,15000);
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    const receive = (event: StorageEvent) => {
      if (event.key !== syncKey || !event.newValue) return;
      let message: {userId?:unknown;phase?:unknown;nonce?:unknown};
      try { message = JSON.parse(event.newValue); } catch { return; }
      if (message.userId !== user.id || typeof message.nonce !== 'string' || !message.nonce || !['pending','settled'].includes(String(message.phase))) return;
      const nonce = message.nonce;
      ++generation.current; readController.current?.abort();
      if (message.phase === 'pending') {
        if (remoteWrites.current.has(nonce)) return;
        setPending(true);setError('');void client.cancelQueries({predicate:businessQuery});
        // A vanished tab fails closed after 30 seconds; only an explicit server
        // recheck or active selection recovers it, never a silent live fallback.
        remoteWrites.current.set(nonce,setTimeout(()=>{if(userRef.current===user.id && remoteWrites.current.has(nonce)){setReadyUser(user.id);setPending(false);setError('Başka sekmedeki yıl değişimi tamamlanmadı. Bağlamı yeniden doğrulayın veya aktif yıla dönün.');}},30000));
        void readContext();
      } else {
        const held=remoteWrites.current.get(nonce);if(held)clearTimeout(held);remoteWrites.current.delete(nonce);
        if(!remoteWrites.current.size && !localWrites.current.size)void readContext();
      }
    };
    window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',visible);window.addEventListener('storage',receive);
    return ()=>{++generation.current;readController.current?.abort();clearInterval(timer);for(const held of remoteWrites.current.values())clearTimeout(held);remoteWrites.current.clear();window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',visible);window.removeEventListener('storage',receive);};
  },[client,readContext,role,user?.id]);
  const signal = (phase:'pending'|'settled',nonce:string,userId:string) => {try{localStorage.setItem(syncKey,JSON.stringify({userId,phase,nonce}));}catch{/* Focus/poll reconcile when storage is unavailable. */}};
  const selectYear = async (id:string) => {
    if(role!=='admin'||!user?.id)return;
    const owner=user.id,nonce=`${owner}:${Date.now()}:${Math.random()}`;
    ++generation.current;readController.current?.abort();
    for(const held of remoteWrites.current.values())clearTimeout(held);remoteWrites.current.clear();
    localWrites.current.add(nonce);setPending(true);setError('');signal('pending',nonce,owner);
    await client.cancelQueries({predicate:businessQuery});
    let selectionError='';
    try {
      await historyRequest('/context',{academicYearId:id});
    } catch {selectionError='Seçilen yılın tamamlanmış yıllık arşivi bulunamadı veya bağlam değiştirilemedi.';}
    finally {localWrites.current.delete(nonce);signal('settled',nonce,owner);if(userRef.current===owner&&!localWrites.current.size&&!remoteWrites.current.size)await readContext(selectionError);}
  };
  const reload = () => {for(const held of remoteWrites.current.values())clearTimeout(held);remoteWrites.current.clear();setPending(true);setError('');void readContext();};
  return <AcademicContext.Provider value={{years,year:years.find(y=>y.id===selected),pending:role==='admin' && (pending || readyUser!==user?.id),error,selectYear,reload}}>{children}</AcademicContext.Provider>;
}
