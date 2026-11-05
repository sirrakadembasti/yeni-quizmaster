import { createRequire } from 'node:module';
import { enrichFrozenRow } from '../../services/archive-history-enrichment';
import { frozenLookup, HISTORY_PROJECTION_VERSION } from '../../services/archive-history-projection';
// sqlite3 already ships with the application's session store. This fixture runs
// production parameterized SQLite queries without a second migration process.
const require=createRequire(import.meta.url);
const sqlite3=require(createRequire(require.resolve('connect-sqlite3')).resolve('sqlite3'));
export function historySqlFixture(source:()=>Promise<any[]>){
  const transfers:any[]=[];
  const connection=new sqlite3.Database(':memory:');
  const run=(sql:string,values:any[]=[])=>new Promise<void>((resolve,reject)=>connection.run(sql,values,(error:any)=>error?reject(error):resolve()));
  const all=(sql:string,values:any[]=[])=>new Promise<any[]>((resolve,reject)=>connection.all(sql,values,(error:any,rows:any[])=>error?reject(error):resolve(rows)));
  let loading:Promise<void>|undefined;
  const load=()=>loading??=(async()=>{
    await run('CREATE TABLE ArchiveSnapshotRow(id TEXT PRIMARY KEY,snapshotId TEXT,entityType TEXT,entityId TEXT,dataJson TEXT)');await run('CREATE TABLE ArchiveHistoryProjection(sourceRowId TEXT,version TEXT,snapshotId TEXT,sourceJson TEXT,searchText TEXT)');await run('CREATE TABLE ArchiveHistoryReady(snapshotId TEXT,version TEXT,rowCount INTEGER)');
    const rows=(await source()).map((row,index)=>({id:'row-'+index,snapshotId:'snapshot',...row})),lookup=frozenLookup(rows);
    await run('BEGIN');
    for(const row of rows){await run('INSERT INTO ArchiveSnapshotRow VALUES (?,?,?,?,?)',[row.id,row.snapshotId,row.entityType,row.entityId,row.dataJson]);await run('INSERT INTO ArchiveHistoryProjection VALUES (?,?,?,?,?)',[row.id,HISTORY_PROJECTION_VERSION,row.snapshotId,row.dataJson,JSON.stringify(enrichFrozenRow(JSON.parse(row.dataJson),lookup)).toLocaleLowerCase('tr')]);}
    await run('INSERT INTO ArchiveHistoryReady VALUES (?,?,?)',['snapshot',HISTORY_PROJECTION_VERSION,rows.length]);await run('COMMIT');
  })();
  return {
    transfers,
    query:async(sql:string,...values:any[])=>{await load();const rows=await all(sql,values);transfers.push(...rows.filter(row=>typeof row.dataJson==='string'));return rows;},
    find:async({where}:any)=>{await load();const conditions=['snapshotId=?','entityType=?'],values=[where.snapshotId,where.entityType];if(where.entityId?.in){conditions.push(`entityId IN (${where.entityId.in.map(()=>'?').join(',')})`);values.push(...where.entityId.in);}const rows=await all('SELECT * FROM ArchiveSnapshotRow WHERE '+conditions.join(' AND '),values);transfers.push(...rows);return rows;},
    close:async()=>{await loading;return new Promise<void>((resolve,reject)=>connection.close((error:any)=>error?reject(error):resolve()));},
  };
}
