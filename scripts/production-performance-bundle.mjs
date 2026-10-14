import fs from 'node:fs';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {ownedFile,noLinks} from './production-performance-guard.mjs';
export function bundleMetrics(dist) {
  const manifest=JSON.parse(fs.readFileSync(ownedFile(dist,'.vite/manifest.json',true),'utf8'));
  const entry=Object.keys(manifest).filter(k=>manifest[k].isEntry);
  const keys=new Set();
  function visit(key){if(keys.has(key))return;keys.add(key);for(const dependency of manifest[key].imports||[])visit(dependency);}
  entry.forEach(visit);
  const metrics=file=>{const bytes=fs.readFileSync(ownedFile(dist,file,true));return {file,bytes:bytes.length,gzip:gzipSync(bytes).length};};
  const staticJs=[...keys].map(k=>manifest[k].file).filter(f=>f.endsWith('.js')).map(metrics);
  const distributed=[];
  const walk=directory=>{noLinks(directory);for(const entry of fs.readdirSync(directory,{withFileTypes:true})){if(entry.isSymbolicLink())throw Error('Linked distribution asset rejected');const target=path.join(directory,entry.name);if(entry.isDirectory())walk(target);else if(entry.isFile())distributed.push(path.relative(dist,target).split(path.sep).join('/'));}};walk(dist);
  const manifestJs=[...new Set(Object.values(manifest).map(k=>k.file).filter(f=>f.endsWith('.js')))],allJs=distributed.filter(f=>/\.[cm]?js$/.test(f)).map(metrics);
  const css=distributed.filter(f=>f.endsWith('.css')).map(metrics),publicJs=allJs.filter(f=>!manifestJs.includes(f.file));
  return {entry,staticJs,initialBytes:staticJs.reduce((a,b)=>a+b.bytes,0),initialGzip:staticJs.reduce((a,b)=>a+b.gzip,0),manifestJsBytes:manifestJs.map(metrics).reduce((a,b)=>a+b.bytes,0),publicJs,totalJsBytes:allJs.reduce((a,b)=>a+b.bytes,0),totalJsGzip:allJs.reduce((a,b)=>a+b.gzip,0),totalJsScope:'all guarded distribution .js/.mjs/.cjs files including public worker, deduplicated paths; CSS all distribution .css',css,largestChunks:allJs.sort((a,b)=>b.bytes-a.bytes).slice(0,8)};
}
if(process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)console.log(JSON.stringify(bundleMetrics(path.resolve(process.argv[2]))));
