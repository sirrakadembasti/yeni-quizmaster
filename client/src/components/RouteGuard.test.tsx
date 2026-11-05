import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {lazy} from 'react';
import {RouteLoadBoundary} from './RouteLoadBoundary';
import {RouteGuard} from '../App';
const auth=vi.hoisted(()=>({isAuthenticated:true,role:'student'}));
vi.mock('@/context/auth-context',()=>({useAuth:()=>auth,AuthProvider:({children}:any)=>children}));
afterEach(()=>{cleanup();window.history.replaceState(null,'','/');});
describe('guarded lazy routes',()=>{
 it('does not execute a page import for the wrong role',()=>{
   window.history.replaceState(null,'','/results');auth.role='student';auth.isAuthenticated=true;
   const imported=vi.fn(async()=>({default:()=><h1>Özel sonuçlar</h1>})),Page=lazy(imported);
   render(<RouteLoadBoundary route="/results"><RouteGuard path="/results" roles={['teacher','admin']} component={Page}/></RouteLoadBoundary>);
   expect(imported).not.toHaveBeenCalled();expect(screen.queryByText('Özel sonuçlar')).toBeNull();
 });
 it('loads a protected page only after authorization',async()=>{
   auth.role='teacher';auth.isAuthenticated=true;
   const imported=vi.fn(async()=>({default:()=><h1>Özel sonuçlar</h1>})),Page=lazy(imported);
   render(<RouteLoadBoundary route="/results"><RouteGuard path="/results" roles={['teacher','admin']} component={Page}/></RouteLoadBoundary>);
   expect(await screen.findByRole('heading')).toHaveTextContent('Özel sonuçlar');expect(imported).toHaveBeenCalledTimes(1);
 });
});
