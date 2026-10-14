import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {saveOfflineUser,getOfflineSession,clearOfflineUser,saveOfflineSession} from '@/lib/offline-quiz';
import StudentQuizzesPage from './student-quizzes';
const fixture=vi.hoisted(()=>({user:{id:'student',role:'student',name:'Öğrenci'},quiz:{id:'quiz',title:'Şekil sınavı'},response:{resultId:'attempt',quiz:{id:'quiz'},questions:[{id:'q',text:'Şekil',type:'multiple-choice',options:['A','B'],imageUrl:'/uploads/diagram.png'}],existingAnswers:{},preparedAt:'2026-10-14T10:00:00Z'},prepare:vi.fn()}));
vi.mock('@/context/auth-context',()=>({useAuth:()=>({user:fixture.user})}));
vi.mock('@/components/layout/DashboardLayout',()=>({DashboardLayout:({children}:any)=><div>{children}</div>}));
vi.mock('@/lib/api',()=>({quizApi:{getStudentQuizzes:async()=>({quizzes:[fixture.quiz]}),prepareQuizOffline:fixture.prepare},resultApi:{getStudentResults:async()=>({results:[]})}}));
vi.mock('@/lib/offline-shell',()=>({ensureOfflineShell:async()=>{}}));
beforeEach(()=>{localStorage.clear();saveOfflineUser(fixture.user as any);fixture.prepare.mockResolvedValue(fixture.response);});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
describe('offline preparation publication',()=>{
 it('reports a storage quota failure and preserves an existing queued attempt',async()=>{
   const previous:any={version:1,userId:'student',quizId:'quiz',resultId:'attempt',quiz:{},questions:fixture.response.questions,answers:{q:'B'},pendingAnswers:{q:'B'},answerRevisions:{q:3},pendingSubmit:true,started:true,remainingSeconds:null,timerCapturedAt:fixture.response.preparedAt,cachedAt:fixture.response.preparedAt};
   saveOfflineSession(previous);
   const actual=Storage.prototype.setItem;
   vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(this:Storage,key,value){if(key.startsWith('quiz-master:offline-session:'))throw new DOMException('quota','QuotaExceededError');return actual.call(this,key,value);});
   render(<StudentQuizzesPage/>);
   fireEvent.click(await screen.findByRole('button',{name:/Çevrimdışı Hazır/}));
   await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent(/saklanamadı|kota|hazırlanamadı/i));
   expect(getOfflineSession('student','quiz')).toEqual(previous);
   expect(screen.queryByRole('button',{name:'Çevrimdışı Hazır'})).toBeNull();
 });
 it('does not recreate private data when logout occurs during preparation',async()=>{
   let finish!:(response:any)=>void;fixture.prepare.mockReturnValue(new Promise(r=>finish=r));
   const view=render(<StudentQuizzesPage/>);fireEvent.click(await screen.findByRole('button',{name:'Çevrimdışı Hazırla'}));
   clearOfflineUser();view.unmount();finish(fixture.response);
   await new Promise(r=>setTimeout(r,30));expect(getOfflineSession('student','quiz')).toBeNull();
 });
});
