import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth-context';
import { apiFetch, handleResponse } from '@/lib/api';
import { orderAcademicYears, type AcademicYear } from '@/components/academic-history/history-model';
interface Context { years: AcademicYear[]; year?: AcademicYear; pending: boolean; error: string; selectYear: (id:string) => Promise<void>; reload: () => void }
const AcademicContext = createContext<Context | null>(null);
export const useAcademicYear = () => useContext(AcademicContext);
export async function historyRequest<T>(path: string, data?: unknown): Promise<T> {
  return handleResponse<T>(await apiFetch(`/api/admin/academic-history${path}`, { method:data ? 'POST' : 'GET', credentials:'include', ...(data ? {headers:{'Content-Type':'application/json'},body:JSON.stringify(data)} : {}) }));
}
export function AcademicYearProvider({ children }: { children:ReactNode }) {
  const {user,role} = useAuth();
  const client = useQueryClient();
  const [years,setYears] = useState<AcademicYear[]>([]);
  const [selected,setSelected] = useState('');
  const [pending,setPending] = useState(true);
  const [error,setError] = useState('');
  const [revision,setRevision] = useState(0);
  const [readyUser,setReadyUser] = useState('');
  useEffect(() => {
    let cancelled = false;
    if (role !== 'admin' || !user) { setPending(false);setYears([]);setSelected('');return; }
    setPending(true);setError('');
    historyRequest<{years:AcademicYear[];academicYearId:string}>('/context').then(async data => {
      const ordered = orderAcademicYears(data.years);
      if (!cancelled) setYears(ordered);
      const saved = localStorage.getItem(`academic-year:${user.id}`);
      const savedMode = localStorage.getItem(`academic-year-mode:${user.id}`);
      const id = savedMode==='historical' && saved && ordered.some(y => y.id === saved) ? saved : data.academicYearId;
      await historyRequest('/context',{academicYearId:id});
      if (!cancelled) {setYears(ordered);setSelected(id);}
    }).catch(() => { if (!cancelled) setError('Eğitim yılı bağlamı doğrulanamadı. Yıllık arşiv eksik veya erişilemiyor.'); }).finally(() => {if (!cancelled) {setPending(false);setReadyUser(user.id);}});
    return () => {cancelled=true;};
  },[role,user?.id,revision]);
  const selectYear = async (id:string) => {
    setPending(true);setError('');
    await client.cancelQueries();
    try {
      await historyRequest('/context',{academicYearId:id});
      setSelected(id);localStorage.setItem(`academic-year:${user!.id}`,id);
      localStorage.setItem(`academic-year-mode:${user!.id}`,years.find(year=>year.id===id)?.status==='closed'?'historical':'active');
      client.removeQueries({ predicate:q => !q.queryKey.includes('academic-history') && !q.queryKey.includes('auth') });
    } catch {setError('Seçilen yılın tamamlanmış yıllık arşivi bulunamadı veya bağlam değiştirilemedi.');}
    finally {setPending(false);}
  };
  return <AcademicContext.Provider value={{years,year:years.find(y=>y.id===selected),pending:role==='admin' && (pending || readyUser!==user?.id),error,selectYear,reload:()=>setRevision(r=>r+1)}}>{children}</AcademicContext.Provider>;
}
