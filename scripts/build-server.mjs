import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const repo=path.resolve(import.meta.dirname,'..');
const {build}=createRequire(path.join(repo,'server/package.json'))('esbuild');

export async function buildServer(projectRoot=repo,outfile=path.join(projectRoot,'dist/index.cjs')){
  return build({
    absWorkingDir:projectRoot,
    entryPoints:[path.join(projectRoot,'server/index.ts')],
    bundle:true,platform:'node',target:'node20',
    outfile,
    external:['@prisma/client','sqlite3','better-sqlite3','sharp','playwright'],
    // dist lives at repository root; npm installs externals in node_modules (hoisted) or server/node_modules.
    // Resolve relative to the deployed bundle rather than cwd or the build machine.
    banner:{js:"require = require('node:module').createRequire(require('node:path').join(__dirname, '../server/package.json'));"},
    logLevel:'info',
  });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  // İsteğe bağlı: --outfile=<yol> (yalıtılmış derleme testleri normal dist/index.cjs'e dokunmaz).
  const outfileArg=process.argv.slice(2).find(arg=>arg.startsWith('--outfile='));
  await buildServer(repo,outfileArg?path.resolve(outfileArg.slice('--outfile='.length)):undefined);
}
