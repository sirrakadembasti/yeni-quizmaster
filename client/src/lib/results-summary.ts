import { resultApi, type StudentResult } from '@/lib/api';

type ResultFilters = Parameters<typeof resultApi.getFilteredResults>[0];

/** Collect small pages so metrics, Excel and print always use the full population. */
export async function getStatisticsResults(filters: ResultFilters = {}): Promise<{ results: StudentResult[] }> {
  const results: StudentResult[] = [];
  const seenCursors = new Set<string>();
  let paged = false;
  let cursor: string | undefined;
  do {
    const requestFilters = { ...filters, projection: 'summary', limit: '500', ...(cursor ? { cursor } : {}) };
    const page = await resultApi.getFilteredResults(requestFilters) as { results: StudentResult[]; nextCursor?: string | null };
    if (page.nextCursor !== undefined) paged = true;
    results.push(...page.results);
    // Historical and legacy adapters return the full response without a cursor.
    if (page.nextCursor == null) break;
    if (!page.nextCursor || seenCursors.has(page.nextCursor)) throw new Error('Results summary cursor did not advance');
    seenCursors.add(page.nextCursor);
    cursor = page.nextCursor;
  } while (cursor);

  if (paged) {
    const submittedTime = (row: StudentResult) => row.submittedAt ? new Date(row.submittedAt).getTime() : -Infinity;
    results.sort((a, b) => {
      const first = submittedTime(a);
      const second = submittedTime(b);
      return first === second ? b.id.localeCompare(a.id) : second - first;
    });
  }
  return { results };
}
