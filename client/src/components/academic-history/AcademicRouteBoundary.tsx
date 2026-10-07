import type { ReactNode } from 'react';
import { useAuth } from '@/context/auth-context';
import { useAcademicYear } from '@/context/academic-year-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useLocation } from 'wouter';
export function AcademicRouteBoundary({children}:{children:ReactNode}) {
  const {role} = useAuth();
  const context = useAcademicYear();
  const [path] = useLocation();
  if(path==='/reset-password')return <>{children}</>;
  if (role==='admin' && context && (context.pending || context.error || context.year?.status==='closed')) return <DashboardLayout><></></DashboardLayout>;
  return <>{children}</>;
}
