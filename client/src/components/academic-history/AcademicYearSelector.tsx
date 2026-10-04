import { useAcademicYear } from '@/context/academic-year-context';
export function AcademicYearSelector() {
  const context = useAcademicYear();
  if (!context) return null;
  return <div className="px-4 pb-3 space-y-1"><label htmlFor="academic-year" className="block text-xs font-semibold">Eğitim yılı</label>
    <select id="academic-year" aria-label="Eğitim yılı" value={context.year?.id ?? ''} disabled={context.pending} onChange={event=>void context.selectYear(event.target.value)} className="w-full rounded-md border bg-background p-2 text-sm">
      {!context.year && <option value="">Yıl seçiniz</option>}
      {context.years.map(year=><option key={year.id} value={year.id}>{year.label} · {year.status==='active' ? 'Aktif' : 'Kapalı'}</option>)}
    </select>
    {context.year?.status==='closed' && <p className="text-xs text-amber-700 dark:text-amber-300">Geçmiş yıl · Salt okunur</p>}
  </div>;
}
