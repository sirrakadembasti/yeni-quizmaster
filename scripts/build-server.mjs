import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const repo=path.resolve(import.meta.dirname,'..');
const {build}=createRequire(path.join(repo,'server/package.json'))('esbuild');

export async function buildServer(projectRoot=repo){
  return build({
    absWorkingDir:projectRoot,
    entryPoints:[path.join(projectRoot,'server/index.ts')],
    bundle:true,platform:'node',target:'node20',
    outfile:path.join(projectRoot,'dist/index.cjs'),
    external:['@prisma/client','sqlite3','better-sqlite3','sharp','playwright'],
    // dist lives at repository root; pnpm installs externals in server/node_modules.
    // Resolve relative to the deployed bundle rather than cwd or the build machine.
    banner:{js:"require = require('node:module').createRequire(require('node:path').join(__dirname, '../server/package.json'));"},
    logLevel:'info',
  });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  await buildServer();
}
