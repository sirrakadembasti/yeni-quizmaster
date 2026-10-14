import {beforeEach,describe,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({failures:0,code:'P1008',updates:0,value:false,transactions:0}));
vi.mock('@prisma/client',()=>({PrismaClient:class {
  user={update:async({data}:any)=>{state.updates++;if(state.failures-->0)throw Object.assign(new Error('synthetic lock timeout'),{code:state.code});state.value=data.notificationMuted;return {notificationMuted:state.value};}};
  $transaction=async(fn:any)=>{state.transactions++;return fn(this);};
}}));
import {storage} from '../../storage';
beforeEach(()=>{state.failures=0;state.code='P1008';state.updates=0;state.value=false;state.transactions=0;});
describe('notification preferences under a transient SQLite timeout',()=>{
 it('keeps the single boolean assignment atomic without acquiring an interactive transaction',async()=>{
   expect(await storage.updateNotificationPreferences('actor',true)).toEqual({muted:true});
   expect(state.updates).toBe(1);expect(state.transactions).toBe(0);
 });
 it.each(['P1008','P2028','P2034'])('retries an idempotent preference assignment after %s and returns its persisted value',async code=>{
   state.failures=1;state.code=code;
   expect(await storage.updateNotificationPreferences('actor',true)).toEqual({muted:true});
   expect(state.value).toBe(true);expect(state.updates).toBe(2);
 });
 it('propagates a nonretryable error without another write',async()=>{
   state.failures=1;state.code='P2002';await expect(storage.updateNotificationPreferences('actor',true)).rejects.toMatchObject({code:'P2002'});expect(state.updates).toBe(1);expect(state.value).toBe(false);
 });
 it('rejects after the bounded retries rather than acknowledging an uncommitted value',async()=>{
   state.failures=20;await expect(storage.updateNotificationPreferences('actor',true)).rejects.toMatchObject({code:'P1008'});expect(state.updates).toBe(4);expect(state.value).toBe(false);
 });
});
