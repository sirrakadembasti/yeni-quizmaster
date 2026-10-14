// Vite's emitted static import closure, never the dynamic/report chunk graph.
export function appShellManifest(bundle,base='/') {
  const files=new Set(),visited=new Set();
  function visit(file){if(visited.has(file))return;visited.add(file);const chunk=bundle[file];if(!chunk||chunk.type!=='chunk')return;files.add(file);for(const css of chunk.viteMetadata?.importedCss||[])files.add(css);for(const imported of chunk.imports||[])visit(imported);}
  for(const chunk of Object.values(bundle))if(chunk.type==='chunk'&&chunk.isEntry)visit(chunk.fileName);
  return {version:1,assets:[...files].sort().map(file=>base+file)};
}
export function appShellPlugin() {
  let base='/';return {name:'quizmaster-public-app-shell',enforce:'post',configResolved(config){base=config.base;},generateBundle(_options,bundle){this.emitFile({type:'asset',fileName:'app-shell-assets.json',source:JSON.stringify(appShellManifest(bundle,base))});}};
}
