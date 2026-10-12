import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {expect,it} from 'vitest';
import {warmHistoryProjection,HISTORY_PROJECTION_VERSION} from '../../services/archive-history-projection';
const require=createRequire(import.meta.url);
const sqlite3=require(createRequire(require.resolve('connect-sqlite3')).resolve('sqlite3'));

it('seeks each legacy page from the composite cursor instead of rescanning the snapshot prefix',async()=>{
  const connection=new sqlite3.Database(':memory:');
  const run=(sql:string,values:any[]=[])=>new Promise<number>((resolve,reject)=>connection.run(sql,values,function(this:any,error:any){error?reject(error):resolve(this.changes);}));
  const query=(sql:string,values:any[]=[])=>new Promise<any[]>((resolve,reject)=>connection.all(sql,values,(error:any,rows:any[])=>error?reject(error):resolve(rows)));
  const exec=(sql:string)=>new Promise<void>((resolve,reject)=>connection.exec(sql,(error:any)=>error?reject(error):resolve()));
  const plans:string[][]=[];
  const page=async(sql:string,values:any[])=>{
    plans.push((await query('EXPLAIN QUERY PLAN '+sql,values)).map(row=>row.detail));
    return query(sql,values);
  };
  const db:any={
    $queryRawUnsafe:(sql:string,...values:any[])=>sql.includes('ORDER BY entityType,entityId LIMIT')?page(sql,values):query(sql,values),
    $executeRawUnsafe:(sql:string,...values:any[])=>run(sql,values),
    archiveSnapshotRow:{findMany:({where,take}:any)=>page('SELECT * FROM ArchiveSnapshotRow WHERE snapshotId=? AND (entityType>? OR (entityType=? AND entityId>?)) ORDER BY entityType,entityId LIMIT ?',[where.snapshotId,where.OR[0].entityType.gt,where.OR[1].entityType,where.OR[1].entityId.gt,take])},
    $transaction:async(callback:any)=>{await exec('BEGIN');try{const value=await callback(db);await exec('COMMIT');return value;}catch(error){await exec('ROLLBACK');throw error;}},
  };
  try{
    await exec('CREATE TABLE ArchiveSnapshot(id TEXT PRIMARY KEY,capturedAt INTEGER); CREATE TABLE ArchiveSnapshotRow(id TEXT PRIMARY KEY,snapshotId TEXT,entityType TEXT,entityId TEXT,dataJson TEXT); CREATE UNIQUE INDEX cursor_index ON ArchiveSnapshotRow(snapshotId,entityType,entityId);');
    await exec(await readFile(new URL('../../prisma/migrations/20261009_archive_history_projection/migration.sql',import.meta.url),'utf8'));
    await run('INSERT INTO ArchiveSnapshot VALUES (?,?)',['snapshot',Date.now()]);
    await exec('BEGIN');
    for(let index=0;index<600;index++){
      const type=['quiz','result','user'][index%3],id=(index%7===0?"İ'":"a")+String(index).padStart(5,'0');
      await run('INSERT INTO ArchiveSnapshotRow VALUES (?,?,?,?,?)',['row-'+index,'snapshot',type,id,JSON.stringify({id,name:'İZMİR '+index})]);
    }
    await exec('COMMIT');
    await warmHistoryProjection(db,'snapshot');
    expect((await query('SELECT rowCount FROM ArchiveHistoryReady'))[0].rowCount).toBe(600);
    expect((await query('SELECT count(*) AS n FROM ArchiveHistoryProjection'))[0].n).toBe(600);
    expect(plans).toHaveLength(4);
    expect(plans.every(plan=>plan.some(detail=>/\(entityType,entityId\)>/.test(detail)))).toBe(true);
  }finally{await new Promise<void>((resolve,reject)=>connection.close((error:any)=>error?reject(error):resolve()));}
});

it('rolls back a failed bounded legacy chunk and resumes without publishing partial readiness',async()=>{
  const connection=new sqlite3.Database(':memory:');
  const run=(sql:string,values:any[]=[])=>new Promise<number>((resolve,reject)=>connection.run(sql,values,function(this:any,error:any){error?reject(error):resolve(this.changes);}));
  const query=(sql:string,values:any[]=[])=>new Promise<any[]>((resolve,reject)=>connection.all(sql,values,(error:any,rows:any[])=>error?reject(error):resolve(rows)));
  const exec=(sql:string)=>new Promise<void>((resolve,reject)=>connection.exec(sql,(error:any)=>error?reject(error):resolve()));
  const source=Array.from({length:4350},(_,i)=>({id:'row-'+String(i).padStart(5,'0'),snapshotId:'snapshot',entityType:'user',entityId:String(i).padStart(5,'0'),dataJson:JSON.stringify({id:String(i).padStart(5,'0'),name:'İZMİR '+i})}));
  let fail=true,committedChunks=0;
  const db:any={
    $queryRawUnsafe:(sql:string,...values:any[])=>query(sql,values),
    $executeRawUnsafe:async(sql:string,...values:any[])=>{
      expect(values.length).toBeLessThanOrEqual(999);
      if(fail&&sql.startsWith('INSERT OR IGNORE INTO ArchiveHistoryProjection')&&values.some(value=>value==='row-04300')){fail=false;throw new Error('Synthetic second chunk write failure');}
      return run(sql,values);
    },
    archiveSnapshotRow:{findMany:async({where,take}:any)=>{
      expect(take).toBeLessThanOrEqual(256);
      return query('SELECT * FROM ArchiveSnapshotRow WHERE snapshotId=? AND (entityType>? OR (entityType=? AND entityId>?)) ORDER BY entityType,entityId LIMIT ?',[where.snapshotId,where.OR[0].entityType.gt,where.OR[1].entityType,where.OR[1].entityId.gt,take]);
    }},
    $transaction:async(callback:any,options:any)=>{
      expect(options.timeout).toBe(120000);
      await exec('BEGIN');try{const value=await callback(db);await exec('COMMIT');committedChunks++;return value;}catch(error){await exec('ROLLBACK');throw error;}
    },
  };
  try{
    await exec('CREATE TABLE ArchiveSnapshot(id TEXT PRIMARY KEY,capturedAt INTEGER); CREATE TABLE ArchiveSnapshotRow(id TEXT PRIMARY KEY,snapshotId TEXT,entityType TEXT,entityId TEXT,dataJson TEXT);');
    await exec(await readFile(new URL('../../prisma/migrations/20261009_archive_history_projection/migration.sql',import.meta.url),'utf8'));
    await run('INSERT INTO ArchiveSnapshot VALUES (?,?)',['snapshot',Date.now()]);
    await exec('BEGIN');for(const row of source)await run('INSERT INTO ArchiveSnapshotRow VALUES (?,?,?,?,?)',Object.values(row));await exec('COMMIT');
    await expect(warmHistoryProjection(db,'snapshot')).rejects.toThrow('Synthetic second chunk');
    expect(committedChunks).toBe(1);
    expect((await query('SELECT count(*) AS n FROM ArchiveHistoryProjection'))[0].n).toBe(4096);
    expect(await query('SELECT * FROM ArchiveHistoryReady')).toEqual([]);
    await warmHistoryProjection(db,'snapshot');
    expect((await query('SELECT count(*) AS n FROM ArchiveHistoryProjection WHERE version=?',[HISTORY_PROJECTION_VERSION]))[0].n).toBe(source.length);
    expect((await query('SELECT rowCount FROM ArchiveHistoryReady'))[0].rowCount).toBe(source.length);
    expect(await query('SELECT * FROM ArchiveSnapshotRow ORDER BY entityType,entityId')).toEqual(source);
  }finally{await new Promise<void>((resolve,reject)=>connection.close((error:any)=>error?reject(error):resolve()));}
});
