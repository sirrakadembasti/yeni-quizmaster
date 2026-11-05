import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import aiRouter from '../../api-routes/ai';
vi.mock('../../storage',()=>({storage:{getUser:vi.fn(async()=>({id:'teacher',role:'teacher'}))}}));
const app=express();app.use(express.json());app.use(session({secret:'test',resave:false,saveUninitialized:false}));app.use((req,_res,next)=>{req.session.userId='teacher';next();});app.use('/ai',aiRouter);
describe('AI management privilege boundaries',()=>{
 it.each(['https://[::1]/','https://[fc01::1]/','https://169.254.169.254/','https://localhost./','https://[::ffff:127.0.0.1]/'])('rejects private endpoint %s',async(baseUrl)=>{
  const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('{}',{status:200}));
  const response=await request(app).post('/ai/test-config').send({baseUrl,apiKey:'user-key'});
  expect(response.status).toBe(403);expect(fetch).not.toHaveBeenCalled();fetch.mockRestore();
 });
});
