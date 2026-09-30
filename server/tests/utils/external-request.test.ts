import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
const fake = vi.hoisted(()=>({addresses:[{address:'93.184.216.34',family:4}],status:200,options:null as any}));
vi.mock('node:dns/promises',()=>({lookup:vi.fn(async()=>fake.addresses)}));
vi.mock('node:https',()=>({request:vi.fn((_url:any,options:any,callback:any)=>{
 fake.options=options;const req=new EventEmitter() as any;
 req.setTimeout=()=>req;req.destroy=(error:any)=>req.emit('error',error);
 req.end=()=>queueMicrotask(()=>{const res=Readable.from([Buffer.from('{}')]) as any;res.statusCode=fake.status;res.headers={};callback(res);});
 return req;
})}));
import { safeExternalFetch, isPublicAddress } from '../../utils/external-request';
describe('external request transport protection',()=>{
 beforeEach(()=>{fake.addresses=[{address:'93.184.216.34',family:4}];fake.status=200;fake.options=null;});
 it('rejects a public hostname resolving to a private address',async()=>{
  fake.addresses=[{address:'169.254.169.254',family:4}];
  await expect(safeExternalFetch('https://provider.example/')).rejects.toThrow('UNSAFE_EXTERNAL_URL');
  expect(fake.options).toBeNull();
 });
 it('rejects mixed public/private DNS answers',async()=>{
  fake.addresses.push({address:'10.0.0.1',family:4});
  await expect(safeExternalFetch('https://provider.example/')).rejects.toThrow('UNSAFE_EXTERNAL_URL');
 });
 it('pins lookup even if DNS changes after validation',async()=>{
  const response=await safeExternalFetch('https://provider.example/');
  expect(response.status).toBe(200);
  fake.addresses=[{address:'127.0.0.1',family:4}];
  const callback=vi.fn();fake.options.lookup('provider.example',{},callback);
  expect(callback).toHaveBeenCalledWith(null,'93.184.216.34',4);
 });
 it('does not follow redirects with provider credentials',async()=>{
  fake.status=302;
  await expect(safeExternalFetch('https://provider.example/',{headers:{Authorization:'Bearer private-key'}})).rejects.toThrow('EXTERNAL_REDIRECT_BLOCKED');
 });
 it.each([204,205])('handles bodyless HTTP %s without crashing',async status=>{
  fake.status=status;
  const response=await safeExternalFetch('https://provider.example/');
  expect(response.status).toBe(status);
  expect(await response.text()).toBe('');
 });
 it.each(['::1','::ffff:127.0.0.1','fc01::1','fe80::1','169.254.169.254','100.64.0.1','198.18.0.1'])('blocks non-public address %s',address=>expect(isPublicAddress(address)).toBe(false));
 it.each(['93.184.216.34','2606:4700:4700::1111'])('allows public address %s',address=>expect(isPublicAddress(address)).toBe(true));
});
