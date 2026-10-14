import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import {prepareOfflineSession} from './offline-preparation';
import {saveOfflineSession,saveOfflineUser,clearOfflineUser,getOfflineSession,updateOfflineAnswers,markOfflineSubmit,reconcileOfflineSession,isOfflineSessionPrepared,type OfflineQuizSession} from './offline-quiz';
const session:OfflineQuizSession={version:1,userId:'student',quizId:'quiz',resultId:'attempt',quiz:{},questions:[{id:'q',text:'Şekil',type:'multiple-choice',options:['A','B'],imageUrl:'/uploads/diagram.png'}],answers:{},remainingSeconds:null,timerCapturedAt:'2026-10-14T00:00:00Z',cachedAt:'2026-10-14T00:00:00Z',pendingSubmit:false};
// Small valid PNG signature/IHDR fixture; Chromium acceptance independently decodes a 240x160 diagram.
const bytes=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,6,0,0,0]);
const response=(data:Uint8Array=bytes,contentType='image/png')=>new Response(data as any,{headers:{'content-type':contentType}});
const options=()=>({ensureShell:async()=>{},signal:new AbortController().signal});
beforeEach(()=>{localStorage.clear();saveOfflineUser({id:'student',role:'student'} as any);vi.stubGlobal('fetch',vi.fn(async()=>response()));});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('private offline preparation',()=>{
 it('persists a same-origin upload privately and retains it after the online start response',async()=>{
   const stored=await prepareOfflineSession(session,options());
   expect(stored.questions[0].imageUrl).toMatch(/^data:image\/png;base64,/);expect(stored.questions[0].offlineImageSource).toBe('/uploads/diagram.png');
   expect(stored.offlinePrepared).toBe(true);expect(getOfflineSession('student','quiz')).toEqual(stored);
   expect(isOfflineSessionPrepared(stored)).toBe(true);expect(isOfflineSessionPrepared({...stored,offlineEntry:'old-v2-or-entry'})).toBe(false);
   expect(reconcileOfflineSession(session,stored).questions[0].imageUrl).toBe(stored.questions[0].imageUrl);
 });
 it.each(['https://foreign.example/image.png','/api/auth/me','/uploads/file.svg','data:image/svg+xml;base64,AAAA','javascript:alert(1)','http://user:pass@localhost/uploads/a.png'])('rejects unsupported or foreign image %s without a ready session',async imageUrl=>{
   await expect(prepareOfflineSession({...session,questions:[{...session.questions[0],imageUrl}]},options())).rejects.toThrow();
   expect(getOfflineSession('student','quiz')).toBeNull();expect(fetch).not.toHaveBeenCalled();
 });
 it.each([404,500])('rejects failed image status %d',async status=>{
   vi.mocked(fetch).mockResolvedValue(new Response('',{status}));await expect(prepareOfflineSession(session,options())).rejects.toThrow();expect(getOfflineSession('student','quiz')).toBeNull();
 });
 it('rejects wrong MIME, malformed bytes and actual oversized bodies despite a small advertised length',async()=>{
   for(const value of [response(bytes,'text/html'),response(new Uint8Array([1,2,3])),new Response(new Uint8Array(800000),{headers:{'content-type':'image/png','content-length':'1'}})]){
     vi.mocked(fetch).mockResolvedValue(value);await expect(prepareOfflineSession(session,options())).rejects.toThrow();expect(getOfflineSession('student','quiz')).toBeNull();
   }
 });
 it('keeps queued revisions changed while images are still preparing',async()=>{
   saveOfflineSession(session);let resolve!:(value:Response)=>void;vi.mocked(fetch).mockReturnValue(new Promise(r=>resolve=r));
   const pending=prepareOfflineSession(session,options());await vi.waitFor(()=>expect(fetch).toHaveBeenCalled());
   updateOfflineAnswers('student','quiz',{q:'A'});updateOfflineAnswers('student','quiz',{q:'B'});markOfflineSubmit('student','quiz',true);resolve(response());
   const stored=await pending;expect(stored).toMatchObject({answers:{q:'B'},pendingAnswers:{q:'B'},answerRevisions:{q:2},pendingSubmit:true});
 });
 it('fails shell readiness before publishing preparation and keeps the old attempt',async()=>{
   saveOfflineSession({...session,pendingSubmit:true,answers:{q:'B'}});const previous=getOfflineSession('student','quiz');
   await expect(prepareOfflineSession(session,{...options(),ensureShell:async()=>{throw Error('shell unavailable');}})).rejects.toThrow();expect(getOfflineSession('student','quiz')).toEqual(previous);
 });
 it.each(['quota','noop'])('never treats a %s storage failure as successful because an old attempt exists',async mode=>{
   saveOfflineSession({...session,pendingSubmit:true,answers:{q:'B'}});const previous=getOfflineSession('student','quiz');
   vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{if(mode==='quota')throw new DOMException('quota','QuotaExceededError');});
   await expect(prepareOfflineSession(session,options())).rejects.toThrow();expect(getOfflineSession('student','quiz')).toEqual(previous);
 });
 it('cancels completion after logout even without an unmount',async()=>{
   let resolve!:(value:Response)=>void;vi.mocked(fetch).mockReturnValue(new Promise(r=>resolve=r));
   const pending=prepareOfflineSession(session,options());const rejected=expect(pending).rejects.toThrow();await vi.waitFor(()=>expect(fetch).toHaveBeenCalled());clearOfflineUser();resolve(response());await rejected;expect(getOfflineSession('student','quiz')).toBeNull();
 });
 it('cancels persistence on abort and refuses another attempt or user image reuse',async()=>{
   const controller=new AbortController();controller.abort();await expect(prepareOfflineSession(session,{...options(),signal:controller.signal})).rejects.toThrow();expect(getOfflineSession('student','quiz')).toBeNull();
 });
});
