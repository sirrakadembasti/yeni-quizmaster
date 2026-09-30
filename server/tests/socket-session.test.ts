import { describe, it, expect, vi } from 'vitest';
import { validateSocketSession } from '../socket';
vi.mock('../storage',()=>({storage:{getUser:vi.fn(async()=>({id:'user',isActive:true,sessionVersion:2}))}}));
describe('socket session validation',()=>{
 it('rejects an old session after password change',async()=>{
  const socket={request:{session:{userId:'user',sessionVersion:1,reload:(cb:any)=>cb(null)}}} as any;
  expect(await validateSocketSession(socket)).toBeNull();
 });
 it('rejects removed sessions',async()=>{
  expect(await validateSocketSession({request:{session:{userId:'user',reload:(cb:any)=>cb(new Error('removed'))}}} as any)).toBeNull();
 });
 it('rejects expired sessions',async()=>{
  expect(await validateSocketSession({request:{session:{userId:'user',sessionVersion:2,cookie:{expires:new Date(0)},reload:(cb:any)=>cb(null)}}} as any)).toBeNull();
 });
 it('validates the reloaded session instead of a stale object',async()=>{
  const socket={request:{session:{} as any}} as any;
  socket.request.session={userId:'user',sessionVersion:2,reload:(cb:any)=>{socket.request.session={userId:'user',sessionVersion:1};cb(null);}};
  expect(await validateSocketSession(socket)).toBeNull();
 });
});
