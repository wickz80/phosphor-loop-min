import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import vm from 'node:vm';
import {packageSite} from '../tools/deploy/package.mjs';

test('deployment contains browser assets, keeps relative URLs and stamps cache revisions',async()=>{
 const parent=await mkdtemp(join(tmpdir(),'phosphor-package-'));
 try{
  const out=await packageSite(join(parent,'site'),{revision:'abcdef1234567'});
  assert.deepEqual((await readdir(out)).sort(),['index.html','sw.js','icon-180.png','icon-192.png','styles','js','vendor','nature'].sort());
  const html=await readFile(join(out,'index.html'),'utf8');
  assert.match(html,/js\/render-quality\.js\?v=abcdef1234567/);
  assert.doesNotMatch(html,/(?:src|href)="\/(?:js|styles)\//);
  assert.match(await readFile(join(out,'sw.js'),'utf8'),/app-abcdef1234567/);
  assert.match(await readFile(join(out,'js/audio/rhythm.js'),'utf8'),/new Worker\('js\/audio\/tempo-worker\.js'/);
  assert.ok((await readFile(join(out,'vendor/essentia/essentia-wasm.es.js'))).length>1000);
  await assert.rejects(packageSite(out),/empty/);
  await assert.rejects(packageSite('js/deploy-output'),/outside/);
 }finally{await rm(parent,{recursive:true,force:true});}
});

test('the /loop/ service worker deletes only obsolete caches from its own scope',async()=>{
 const source=await readFile(new URL('../sw.js',import.meta.url),'utf8');
 const handlers={},deleted=[];let work;
 const names=['gatsby-cache','pl-nature','phosphor-loop:/:app-old','phosphor-loop:/other/:app-old',
  'phosphor-loop:/loop/:app-old','phosphor-loop:/loop/:nature'];
 vm.runInNewContext(source,{
  URL,setTimeout,Request:class {constructor(url){this.url=new URL(url,'https://wix.fyi/loop/').href;}},fetch:async()=>({ok:false}),
  self:{registration:{scope:'https://wix.fyi/loop/'},location:{origin:'https://wix.fyi'},clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(name,fn)=>{handlers[name]=fn;}},
  caches:{open:async name=>{names.push(name);return {addAll:async()=>{}};},keys:async()=>names,delete:async name=>{deleted.push(name);}},
 });
 handlers.install({waitUntil:promise=>{work=promise;}});await work;
 handlers.activate({waitUntil:promise=>{work=promise;}});await work;
 assert.deepEqual(deleted,['phosphor-loop:/loop/:app-old']);
});
