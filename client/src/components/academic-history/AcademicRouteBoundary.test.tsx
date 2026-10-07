import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/context/auth-context',()=>({useAuth:()=>({user:{id:'admin-1'},role:'admin'})}));
vi.mock('@/components/layout/DashboardLayout',()=>({DashboardLayout:()=> <p>Historical boundary</p>}));
vi.mock('@/lib/api',()=>({apiFetch:vi.fn(),handleResponse:async(response:any)=>response.json()}));
import { apiFetch } from '@/lib/api';
import { AcademicYearProvider, useAcademicYear } from '@/context/academic-year-context';
import { AcademicRouteBoundary } from './AcademicRouteBoundary';
afterEach(()=>{cleanup();localStorage.clear();vi.clearAllMocks();});
const years=[{id:'active',label:'2026-2027',status:'active'},{id:'past',label:'2025-2026',status:'closed'}];
function Probe(){const context=useAcademicYear();return <p>Current page {context?.year?.label}</p>;}
function mount(){render(<QueryClientProvider client={new QueryClient()}><AcademicYearProvider><AcademicRouteBoundary><Probe/></AcademicRouteBoundary></AcademicYearProvider></QueryClientProvider>);}
describe('route boundary refresh safety',()=>{
  it('does not mount live children while validating default active context',async()=>{
    let resolve:any; vi.mocked(apiFetch).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
    mount();expect(screen.queryByText(/Current page/)).not.toBeInTheDocument();
    vi.mocked(apiFetch).mockResolvedValue({json:async()=>({academicYearId:'active'})} as Response);
    resolve({json:async()=>({years,academicYearId:'active'})});
    expect(await screen.findByText('Current page 2026-2027')).toBeInTheDocument();
  });
  it('honors the same-session server past choice before any direct route mounts',async()=>{
    localStorage.setItem('academic-year:other-user','active');localStorage.setItem('academic-year:admin-1','past');
    localStorage.setItem('academic-year-mode:admin-1','historical');
    vi.mocked(apiFetch).mockResolvedValue({json:async()=>({years,academicYearId:'past'})} as Response);
    mount();await waitFor(()=>expect(apiFetch).toHaveBeenCalledTimes(1));
    expect(vi.mocked(apiFetch).mock.calls[0][1]!.method).toBe('GET');
    expect(screen.queryByText(/Current page/)).not.toBeInTheDocument();
  });
});
