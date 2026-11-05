import path from 'node:path';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { MAX_PACKAGE_BYTES, sha256 } from './archive-package';
import type { ArchiveManifest } from './archive-export';

/** Recorded paths identify immutable jobs; only the current configured root is read.
 * A restore may move that root, including between Windows and Unix hosts. */
export function archiveArtifactLocation(snapshot:{id:string;label:string;artifactPath:string|null},backupRoot:string):string{
  if(!snapshot.artifactPath||!/^[A-Za-z0-9_-]+$/.test(snapshot.id)||!/^\d{4}-\d{4}$/.test(snapshot.label))throw new Error('Archive identity mismatch');
  const parts=snapshot.artifactPath.replace(/\\/g,'/').split('/');
  if(parts.some(part=>part==='.'||part==='..')||parts.slice(-3).join('/')!==`${snapshot.label}/${snapshot.id}/archive.zip`)throw new Error('Archive path mismatch');
  return path.resolve(backupRoot,snapshot.label,snapshot.id,'archive.zip');
}

/** The immutable completed-job ZIP hash authenticates its embedded manifest.
 * Read only directory metadata plus ZIP bytes; never load snapshot business rows. */
export async function verifiedImageManifest(snapshot:{id:string;label:string;artifactPath:string|null;zipSha256:string|null},backupRoot:string):Promise<ArchiveManifest|null>{
  if(!snapshot.artifactPath||!snapshot.zipSha256)throw new Error('Archive artifact missing');
  const expected=archiveArtifactLocation(snapshot,backupRoot);
  const parsed=path.parse(expected);let directory=parsed.root;
  for(const component of path.dirname(expected).slice(parsed.root.length).split(path.sep).filter(Boolean)){
    directory=path.join(directory,component);const stat=await lstat(directory);if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error('Unsafe archive path');
  }
  const stat=await lstat(expected);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>MAX_PACKAGE_BYTES)throw new Error('Unsafe archive ZIP');
  const hash=createHash('sha256');for await(const chunk of createReadStream(expected))hash.update(chunk);
  if(hash.digest('hex')!==snapshot.zipSha256)throw new Error('Archive ZIP checksum mismatch');
  const handle=await open(expected,'r');let manifest:Buffer|undefined,meta:Buffer|undefined,checksums:Buffer|undefined;
  try{
    let offset=0;
    while(offset+30<=stat.size){
      const header=Buffer.alloc(30);await handle.read(header,0,30,offset);
      if(header.readUInt32LE(0)!==0x04034b50)break;
      if(header.readUInt16LE(8)!==0||header.readUInt16LE(6)&8)throw new Error('Unsupported archive ZIP entry');
      const bytes=header.readUInt32LE(18),nameLength=header.readUInt16LE(26),extraLength=header.readUInt16LE(28);
      const nameBytes=Buffer.alloc(nameLength);await handle.read(nameBytes,0,nameLength,offset+30);const name=nameBytes.toString('utf8');
      const start=offset+30+nameLength+extraLength;if(start+bytes>stat.size)throw new Error('Invalid archive ZIP entry');
      if(['manifest.json','meta.json','checksums.json'].includes(name)){
        if(bytes>16*1024*1024)throw new Error('Archive manifest size limit');
        const data=Buffer.alloc(bytes);await handle.read(data,0,bytes,start);
        if(name==='manifest.json')manifest=data;else if(name==='meta.json')meta=data;else checksums=data;
      }
      offset=start+bytes;
    }
  }finally{await handle.close();}
  if(!meta)throw new Error('Archive metadata missing');
  const metadata=JSON.parse(meta.toString('utf8'));
  if(metadata.snapshotId!==snapshot.id||metadata.academicYear!==snapshot.label)throw new Error('Archive metadata mismatch');
  if(metadata.formatVersion===1)return null;
  if(metadata.formatVersion!==2||!manifest||!checksums||JSON.parse(checksums.toString('utf8'))['manifest.json']!==sha256(manifest))throw new Error('Archive manifest mismatch');
  const result:ArchiveManifest=JSON.parse(manifest.toString('utf8'));
  if(result.formatVersion!==2||!Array.isArray(result.images)||!Array.isArray(result.files))throw new Error('Invalid archive image manifest');
  return result;
}
