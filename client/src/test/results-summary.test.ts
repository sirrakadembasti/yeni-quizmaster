import { expect, it, vi } from 'vitest';
import { getStatisticsResults } from '../lib/results-summary';

const transport = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/lib/api', () => ({ resultApi: { getFilteredResults: transport.request } }));

it('requests the lightweight projection through the existing authenticated API and retains every result', async () => {
  const results = Array.from({ length: 200 }, (_, index) => ({ id: `${index}`, quizId: 'q', status: 'completed', score: 0 }));
  transport.request.mockResolvedValue({ results });
  const response = await getStatisticsResults({ teacherId: 'teacher', classId: 'class' });
  expect(response.results).toHaveLength(200);
  expect(new Set(response.results.map(row => row.id))).toEqual(new Set(results.map(row => row.id)));
  expect(transport.request).toHaveBeenCalledWith({ teacherId: 'teacher', classId: 'class', projection: 'summary', limit: '500' });
});

it('collects all 1200 paged rows and restores submitted date order for statistics and exports', async () => {
  transport.request.mockReset();
  const rows = Array.from({ length: 1200 }, (_, index) => ({ id: String(index).padStart(4, '0'), submittedAt: index % 2 ? '2026-10-02' : null, score: 0 }));
  transport.request.mockResolvedValueOnce({ results: rows.slice(0, 500), nextCursor: 'cursor-1' })
    .mockResolvedValueOnce({ results: rows.slice(500, 1000), nextCursor: 'cursor-2' })
    .mockResolvedValueOnce({ results: rows.slice(1000), nextCursor: null });
  const response = await getStatisticsResults();
  expect(response.results).toHaveLength(1200);
  expect(response.results[0].id).toBe('1199');
  expect(response.results[599].id).toBe('0001');
  expect(response.results[600].id).toBe('1198');
  expect(transport.request.mock.calls.map(([filters]) => filters.cursor)).toEqual([undefined, 'cursor-1', 'cursor-2']);
});

it('rejects repeated cursors rather than looping forever', async () => {
  transport.request.mockReset();
  transport.request.mockResolvedValue({ results: [], nextCursor: 'same-cursor' });
  await expect(getStatisticsResults()).rejects.toThrow(/cursor/i);
  expect(transport.request).toHaveBeenCalledTimes(2);
});
