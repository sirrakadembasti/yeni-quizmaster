import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appShellManifest} from '../client/app-shell-manifest.mjs';
test('public app shell follows only static chunks and their CSS at the deployment base',()=>{
 const bundle={'assets/main.js':{type:'chunk',fileName:'assets/main.js',isEntry:true,imports:['assets/eager.js'],dynamicImports:['assets/report.js'],viteMetadata:{importedCss:new Set(['assets/main.css'])}},'assets/eager.js':{type:'chunk',fileName:'assets/eager.js',imports:[],viteMetadata:{importedCss:new Set(['assets/eager.css'])}},'assets/report.js':{type:'chunk',fileName:'assets/report.js',imports:['assets/chart.js'],viteMetadata:{importedCss:new Set(['assets/report.css'])}},'assets/chart.js':{type:'chunk',fileName:'assets/chart.js',imports:[]}};
 assert.deepEqual(appShellManifest(bundle,'/school/').assets,['/school/assets/eager.css','/school/assets/eager.js','/school/assets/main.css','/school/assets/main.js']);
});
