import { expect, it } from 'vitest';
import { credentialEndpointProblem } from '../../services/ai-provider-validation';
it.each([
 ['https://token-plan-sgp.xiaomimimo.com/v1','sk-synthetic',true],
 ['https://api.xiaomimimo.com/v1','tp-synthetic',true],
 ['https://api.xiaomimimo.com/v1','ttp-synthetic',true],
 ['https://api.xiaomimimo.com/v1','sk-synthetic',false],
 ['https://token-plan-cn.xiaomimimo.com/v1','tp-synthetic',false],
 ['https://gateway.example/v1','sk-synthetic',false],
])('validates documented Xiaomi credentials for %s', (url,key,rejected)=>{
 const result=credentialEndpointProblem('xiaomi_mimo',url,key);
 expect(Boolean(result)).toBe(rejected); expect(result||'').not.toContain(key);
});
