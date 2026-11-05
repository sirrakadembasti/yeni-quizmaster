import { Button } from '@/components/ui/button';

type QueryState = { isPending: boolean; isError: boolean; refetch: () => unknown };

export function AdminQueryState({ queries }: { queries: QueryState[] }) {
  const failed = queries.filter(query => query.isError);
  if (failed.length) return <div role="alert" className="rounded-xl border border-destructive/40 p-4 space-y-2">
    <p>Veriler yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.</p>
    <Button variant="outline" onClick={() => failed.forEach(query => { void query.refetch(); })}>Tekrar Dene</Button>
  </div>;
  if (queries.some(query => query.isPending)) return <p role="status" className="p-4 text-muted-foreground">Veriler yükleniyor...</p>;
  return null;
}
