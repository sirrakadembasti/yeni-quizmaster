import type { QueryClient } from '@tanstack/react-query';

// Legacy API URL keys and named keys coexist. Keep both coherent when relations
// change, including counts and teacher/class selectors on previously visited pages.
const relationRoots = new Set([
  'users', '/api/users', 'classes', '/api/classes', 'categories', '/api/categories',
  'teacher-classes', 'statistics-classes', 'class-analytics',
]);

export function invalidateAdminRelations(client: QueryClient) {
  return client.invalidateQueries({
    predicate: query => relationRoots.has(String(query.queryKey[0])),
  });
}
