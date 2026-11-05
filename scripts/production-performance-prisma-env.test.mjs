import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {isolateAcademicFixture} from './academic-fixture-email.mjs';
import {noLinks,ownedFile,exclusiveJson} from './production-performance-guard.mjs';
test('Prisma auto-env lookup is denied before reading an external synthetic sentinel',async()=>{
 const repo=path.resolve(import.meta.dirname,'..');if(!path.basename(repo).startsWith('quizmaster-test-performance-'))throw Error('Native Git export only');
 const sentinel=ownedFile(repo,'server/.env');assert.equal(fs.existsSync(sentinel),false,'Never overwrite an existing environment');
 const root=fs.mkdtempSync(path.join(repo,'server/data/quizmaster-test-academic-performance-env')),database=path.join(root,'server/data/academic.db'),runtimeFile=path.join(root,'runtime.json');
 fs.chmodSync(root,0o700);fs.mkdirSync(path.dirname(database),{recursive:true,mode:0o700});
 for(const file of ['.env','server/.env','server/data/academic.db'])fs.writeFileSync(ownedFile(root,file),'',{flag:'wx',mode:0o600});
 const marker='PERFORMANCE_PRIVATE_ENV_'+crypto.randomUUID().replaceAll('-','').toUpperCase(),content=marker+'=synthetic-never-import\n';
 fs.writeFileSync(sentinel,content,{flag:'wx',mode:0o600});exclusiveJson(root,'runtime.json',{root,database,runId:crypto.randomUUID()});
 const previous=process.env.DATABASE_URL;process.env.DATABASE_URL='file:'+database;
 let isolation,db,proof;
 try{
   isolation=isolateAcademicFixture(runtimeFile);
   // Guard installed BEFORE requiring the generated client or its constructor.
   const req=createRequire(path.join(repo,'server/package.json'));
   // This fresh Linux client was generated without .env and has no schemaEnvPath.
   // Exercise the real Prisma dotenv implementation with explicitly synthetic
   // metadata; neither the deployment environment nor its contents are used.
   db=new (req('@prisma/client').PrismaClient)({datasources:{db:{url:process.env.DATABASE_URL}},__internal:{configOverride:config=>({...config,relativeEnvPaths:{rootEnvPath:null,schemaEnvPath:path.relative(config.dirname,sentinel)}})}});
   assert.equal(process.env[marker],undefined);assert.equal(db._engineConfig.env[marker],undefined);assert.ok(isolation.state.deniedEnvironmentReads>=1);
   const deniedEnvironmentReads=isolation.state.deniedEnvironmentReads;
   await db.$disconnect();db=null;isolation.restore();isolation=null;
   assert.equal(fs.readFileSync(sentinel,'utf8'),content);
   proof={guardBeforeImportAndConstructor:true,syntheticEnvMetadataOverride:true,deniedEnvironmentReads,markerNotImported:true,sentinelUnchanged:true,noDatabaseQueries:true};
   const evidence=path.join(repo,'.superpowers/sdd/2026-10-06-production-rehearsal-plan/task4-private','env-negative-'+crypto.randomUUID());noLinks(evidence);fs.mkdirSync(evidence,{mode:0o700});exclusiveJson(evidence,'proof.json',proof);
 }finally{
   try{if(db)await db.$disconnect();}finally{isolation?.restore();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;fs.unlinkSync(sentinel);noLinks(root);assert.equal(path.dirname(root),path.join(repo,'server/data'));assert.ok(path.basename(root).startsWith('quizmaster-test-academic-performance-env'));fs.rmSync(root,{recursive:true});}
 }
});
