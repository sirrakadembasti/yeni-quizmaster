import {afterEach,describe,expect,it,vi} from 'vitest';
import express from 'express';
import request from 'supertest';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
vi.mock('../services/archive-db',()=>({archiveDb:{}}));
vi.mock('../middleware/auth',()=>({requireAuth:(req:any,res:any,next:any)=>{if(!req.headers['x-role'])return res.sendStatus(401);req.user={id:'synthetic-asset-user',role:req.headers['x-role']};next();},requireRole:(roles:string[])=>(req:any,res:any,next:any)=>roles.includes(req.user.role)?next():res.sendStatus(403)}));
import {createAcademicHistoryRouter} from '../api-routes/academic-history';
const yearId='00000000-0000-4000-8000-000000000001',snapshotId='00000000-0000-4000-8000-000000000002';
const roots:string[]=[];
afterEach(async()=>{await Promise.all(roots.splice(0).map(root=>rm(root,{recursive:true,force:true})));});
async function setup(){
  const root=await mkdtemp(path.join(tmpdir(),'archive-asset-api-'));roots.push(root);
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF7sAAAAASUVORK5CYII=','base64');
  const name=createHash('sha256').update(bytes).digest('hex')+'.png';const directory=path.join(root,'2025-2026',snapshotId);await mkdir(path.join(directory,'images'),{recursive:true});
  await writeFile(path.join(directory,'images',name),bytes);await writeFile(path.join(directory,'manifest.json'),JSON.stringify({files:[{path:'images/'+name,bytes:bytes.length,sha256:name.slice(0,64)}]}));
  const db:any={academicYear:{findUnique:vi.fn(async()=>({id:yearId,label:'2025-2026',status:'closed',snapshotId}))},archiveSnapshot:{findUnique:vi.fn(async()=>({id:snapshotId,academicYearId:yearId,label:'2025-2026',mode:'annual',status:'completed',artifactPath:path.join(directory,'archive.zip'),zipSha256:'a'.repeat(64)}))},archiveSnapshotRow:{findMany:vi.fn(async()=>[])}};
  const verifyArtifact=vi.fn(async()=>({artifactPath:path.join(directory,'archive.zip'),zipSha256:'a'.repeat(64),sizeBytes:1,meta:{}}));
  const app=express();app.use('/history',createAcademicHistoryRouter({db,backupRoot:root,verifyArtifact} as any));
  return {app,db,bytes,name,directory,verifyArtifact};
}
describe('authenticated frozen question images',()=>{
  it('serves only the verified completed-year package raster with safe response headers',async()=>{
    const {app,name,bytes}=await setup();const response=await request(app).get(`/history/years/${yearId}/assets/${name}`).set('x-role','admin');
    expect(response.status).toBe(200);expect(response.headers['content-type']).toMatch(/^image\/png/);expect(response.headers['x-content-type-options']).toBe('nosniff');expect(response.headers['cache-control']).toContain('no-store');expect(response.body).toEqual(bytes);
  });
  it('preserves admin authorization for frozen assets',async()=>{
    const {app,name}=await setup();const url=`/history/years/${yearId}/assets/${name}`;
    expect((await request(app).get(url)).status).toBe(401);expect((await request(app).get(url).set('x-role','teacher')).status).toBe(403);expect((await request(app).get(url).set('x-role','student')).status).toBe(403);
  });
  it.each(['missing','failed','manual','wrong-year','wrong-label'])('rejects an asset whose annual snapshot becomes %s',async condition=>{
    const {app,name,db}=await setup();db.archiveSnapshot.findUnique.mockResolvedValue(condition==='missing'?null:{id:snapshotId,academicYearId:condition==='wrong-year'?'other':yearId,label:condition==='wrong-label'?'2024-2025':'2025-2026',mode:condition==='manual'?'manual':'annual',status:condition==='failed'?'failed':'completed'});
    expect((await request(app).get(`/history/years/${yearId}/assets/${name}`).set('x-role','admin')).status).toBe(409);
  });
  it('refuses a modified packaged image and arbitrary filenames',async()=>{
    const {app,name,directory}=await setup();await writeFile(path.join(directory,'images',name),'tampered raster');
    expect((await request(app).get(`/history/years/${yearId}/assets/${name}`).set('x-role','admin')).status).toBe(409);
    for(const unsafe of ['private.txt','%2E%2E%5Cprivate.txt','a'.repeat(64)+'.svg'])expect((await request(app).get(`/history/years/${yearId}/assets/${unsafe}`).set('x-role','admin')).status).toBe(400);
  });
});
