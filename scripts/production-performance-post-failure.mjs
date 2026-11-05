// Close the evidence gap after a measured request timeout; never retry a request
// or turn an unacknowledged commit into a successful HTTP measurement.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {readPerformanceRuntime,ownedFile,exclusiveJson,noLinks} from './production-performance-guard.mjs';
import {verifyFixturePortsReleased} from './linux-owned-process-cleanup.mjs';
import {isolateAcademicFixture} from './academic-fixture-email.mjs';
const repo=path.resolve(import.meta.dirname,'..'),plan=path.join(repo,'.superpowers/sdd/2026-10-06-production-rehearsal-plan');
const pointer=JSON.parse(fs.readFileSync(ownedFile(plan,'task4-fixture.json',true),'utf8'));
const runtime=readPerformanceRuntime(repo,path.join(pointer.root,'runtime.json'),{runId:pointer.runId}),port=Number(new URL(runtime.origin).port);
const evidence=path.join(plan,'task4-private','post-failure-'+crypto.randomUUID());noLinks(evidence);fs.mkdirSync(evidence,{mode:0o700});
const states={};for(const file of ['/proc/net/tcp','/proc/net/tcp6'])for(const line of fs.readFileSync(file,'utf8').split('\n').slice(1)){const fields=line.trim().split(/\s+/);if(parseInt(fields[1]?.split(':')[1],16)===port)states[fields[3]]=(states[fields[3]]||0)+1;}
const released=await verifyFixturePortsReleased([port]);exclusiveJson(evidence,'port-proof.json',{port,states,released});
if(!released.every(p=>p.stopped))throw Error('Prior fixture port is still unavailable');
process.env.DATABASE_URL='file:'+runtime.database;process.env.ACADEMIC_ARCHIVE_RUNTIME=path.join(runtime.root,'runtime.json');const isolation=isolateAcademicFixture();
const req=createRequire(path.join(repo,'server/package.json')),db=new (req('@prisma/client').PrismaClient)({datasources:{db:{url:process.env.DATABASE_URL}}});
try {if(process.argv[2]==='timing'){const values=[];for(const [index,label] of [[0,'root'],[1,'base']]){const actorId=runtime.fixture.actors[2].id.slice(0,-12)+index.toString(16).padStart(12,'0');const row=await db.studentResult.findFirstOrThrow({where:{studentId:actorId,quizId:runtime.fixture.offlineQuiz},select:{timeTaken:true,startedAt:true,completedAt:true,status:true}});values.push({scenario:label,...row,durationFromOriginalAttemptSeconds:Math.floor((row.completedAt-row.startedAt)/1000),acceptanceRunnerDurationIsSeparate:true});}exclusiveJson(evidence,'result-timing-proof.json',values);console.log(JSON.stringify(values));}else for(const name of fs.readdirSync(runtime.root).filter(n=>/^after-[a-f0-9-]+-http-20\.json$/.test(n))){const result=JSON.parse(fs.readFileSync(ownedFile(runtime.root,name,true),'utf8'));let mismatch=0;for(const expected of result.expected){if(!runtime.fixture.writerActors.some(a=>a.id===expected.id))throw Error('Writer identity rejected');const actual=await db.user.findUniqueOrThrow({where:{id:expected.id},select:{notificationMuted:true}});if(actual.notificationMuted!==expected.muted)mismatch++;}result.postStopDatabaseProof={actors:result.expected.length,verified:mismatch===0,mismatch,afterOwnedProcessesAndPortStopped:true};exclusiveJson(evidence,name,result);console.log(JSON.stringify({requests:result.requests,errors:result.errors,statuses:result.statuses,p50:result.p50,p95:result.p95,p99:result.p99,max:result.max,elapsedMs:result.elapsedMs,qps:result.qps,postStopDatabaseProof:result.postStopDatabaseProof}));}}
finally {await db.$disconnect();isolation.restore();}
console.log(JSON.stringify({evidence,portReleased:true,states}));
