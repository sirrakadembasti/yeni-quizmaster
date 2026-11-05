// Read-only row verification for the explicitly authorized local installation.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const repo = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(repo, 'server/package.json'));
const SQLite = require('better-sqlite3');
const backupDirectory = path.join(repo, 'server/backups/before-ai-management-20261015');
assert.ok(fs.existsSync(path.join(backupDirectory, 'manifest.json')), 'Verified backup is required');
const directory = path.join(repo, 'server/backups/ai-management-upgrade-evidence-20261015');
fs.mkdirSync(directory,{recursive:true,mode:0o700});
const mode = process.argv[2]; assert.ok(['before','after'].includes(mode));
const quote = value => '"' + value.replaceAll('"','""') + '"';
const db = new SQLite(path.join(repo,'server/data/quiz.db'), { readonly:true,fileMustExist:true });
const checksum = value => crypto.createHash('sha256').update(JSON.stringify(value, (_k,v)=>typeof v==='bigint'?v.toString():v)).digest('hex');
try {
  if(mode==='before'){
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>r.name);
    const snapshot = {tables:[],migrations:db.prepare('SELECT migration_name,checksum FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name').all()};
    for(const migration of snapshot.migrations){
      const sql=fs.readFileSync(path.join(repo,'server/prisma/migrations',migration.migration_name,'migration.sql'));
      assert.equal(crypto.createHash('sha256').update(sql).digest('hex'),migration.checksum,'Applied migration source checksum mismatch');
    }
    for(const name of tables){
      const columns=db.prepare('PRAGMA table_info('+quote(name)+')').all().map(c=>c.name);
      const rows=db.prepare('SELECT '+columns.map(quote).join(',')+' FROM '+quote(name)).all();
      snapshot.tables.push({name,columns,count:rows.length,rowHashes:rows.map(checksum).sort()});
    }
    fs.writeFileSync(path.join(directory,'before-audit.json'),JSON.stringify(snapshot,null,2),{flag:'wx',mode:0o600});
    console.log(JSON.stringify({recordedTables:tables.length,appliedMigrations:snapshot.migrations.length,integrity:db.pragma('integrity_check',{simple:true}),foreignKeyViolations:db.pragma('foreign_key_check').length}));
  }else{
    const before=JSON.parse(fs.readFileSync(path.join(directory,'before-audit.json'),'utf8'));
    for(const table of before.tables){
      const rows=db.prepare('SELECT '+table.columns.map(quote).join(',')+' FROM '+quote(table.name)).all();
      const hashes=rows.map(checksum).sort();
      if(table.name==='_prisma_migrations') for(const old of table.rowHashes)assert.ok(hashes.includes(old),'Applied migration history changed');
      else assert.deepEqual(hashes,table.rowHashes,'Existing rows changed: '+table.name);
    }
    assert.equal(db.pragma('integrity_check',{simple:true}),'ok'); assert.deepEqual(db.pragma('foreign_key_check'),[]);
    const migrationCount=db.prepare('SELECT COUNT(*) n FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL').get().n;
    assert.equal(migrationCount,24);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM AIProfile').get().n,0);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM AIConfiguration WHERE id='singleton'").get().n,1);
    const result={passed:true,preservedExistingTables:before.tables.length,appliedMigrations:migrationCount,integrity:'ok',foreignKeyViolations:0};
    fs.writeFileSync(path.join(directory,'after-audit.json'),JSON.stringify(result,null,2),{flag:'wx',mode:0o600}); console.log(JSON.stringify(result));
  }
}finally{db.close();}
