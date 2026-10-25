import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve('.');
const server=createServer(async(req,res)=>{try{
 const path=resolve(root,'.'+(req.url==='/'?'/index.html':req.url.split('?')[0]));
 if(!path.startsWith(root+'/'))throw Error('path');
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html'})[extname(path)]||'application/octet-stream');
 res.end(await readFile(path));
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
const results=[];
try{
 browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-webgl','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:Number(process.env.PERF_WIDTH||3008),height:1269},deviceScaleFactor:2,serviceWorkers:'block'});
 if(process.env.PERF_BASELINE_DIR)for(const name of ['app','shaders'])await page.route(`**/js/${name}.js*`,async route=>route.fulfill({contentType:'text/javascript',body:await readFile(resolve(process.env.PERF_BASELINE_DIR, `${name}.js`),'utf8')}));
 if(process.env.PERF_MIX)await page.addInitScript(()=>localStorage.setItem('phosphor-min-last-v1',JSON.stringify({look:{A:{in1:'nebula',trails:0},B:{in1:'mercury',trails:0},mix:{view:50,xab:0,xba:0}}})));
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const proto=WebGL2RenderingContext.prototype,draw=proto.drawArrays,source=proto.shaderSource,attach=proto.attachShader,use=proto.useProgram;
  const sources=new WeakMap(),labels=new WeakMap();let label='unknown',size=[0,0];
  const alloc=proto.texImage2D;proto.texImage2D=function(...args){if(window.__profile)window.__allocations++;return alloc.apply(this,args);};
  const viewport=proto.viewport;proto.viewport=function(x,y,w,h){size=[w,h];return viewport.call(this,x,y,w,h);};
  proto.shaderSource=function(shader,text){sources.set(shader,text);return source.call(this,shader,text);};
  proto.attachShader=function(program,shader){const s=sources.get(shader)||'';if(s.includes('out vec4 o'))labels.set(program,s.includes('uMusicColor')?'scene':s.includes('uPrev, uOther')?'feedback':s.includes('uWA, uWB')?'composite':s.includes('uPunch')?'display':'other');return attach.call(this,program,shader);};
  proto.useProgram=function(p){label=labels.get(p)||'other';return use.call(this,p);};
  proto.drawArrays=function(...args){
   if(window.__profile){window.__passes[label]=(window.__passes[label]||0)+1;window.__sizes[label]=size;}
   return draw.apply(this,args);
  };
 });
 await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded'});
 const hardware=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),timer:!!gl.getExtension('EXT_disjoint_timer_query_webgl2')};});
 console.log(JSON.stringify(hardware));
 for(const scene of (process.env.PERF_MIX?'crossfade':process.env.PERF_SCENES||'mercury,cubes,sponge,mandelbulb').split(','))for(const sharpness of (process.env.PERF_SHARPNESS||'standard,full').split(',')){
  if(!process.env.PERF_MIX)await page.locator('#sceneSelect').selectOption(scene);await page.locator('#pictureSharpness').selectOption(sharpness);
  await page.evaluate(()=>new Promise(resolve=>{let n=0;function tick(){if(++n>=30)resolve();else requestAnimationFrame(tick);}requestAnimationFrame(tick);}));
  const pacing=await page.evaluate(async()=>{const a=[];let last;await new Promise(resolve=>{let n=0;function tick(t){if(last)a.push(t-last);last=t;if(++n<90)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});a.sort((a,b)=>a-b);return {fps:1000/(a.reduce((s,v)=>s+v,0)/a.length),p95:a[Math.floor(a.length*.95)]};});
  const sample=await page.evaluate(async()=>{
   const intervals=[];let prev;window.__passes={};window.__sizes={};window.__allocations=0;window.__profile=true;
   await new Promise(resolve=>{let n=0;function tick(t){if(prev)intervals.push(t-prev);prev=t;if(++n<60)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});
   window.__profile=false;
   const stats=a=>{const b=a.slice().sort((a,b)=>a-b);return {mean:a.reduce((s,v)=>s+v,0)/a.length,p50:b[Math.floor(b.length*.5)],p95:b[Math.floor(b.length*.95)],n:a.length};};
   return {output:[document.querySelector('#screen').width,document.querySelector('#screen').height],sharpness:document.querySelector('#pictureSharpness').value,target:document.querySelector('#sharpNote')?.textContent,size:document.querySelector('#renderSize').textContent,frame:stats(intervals),passes:window.__passes,sizes:window.__sizes,allocations:window.__allocations};
  });
  if(process.env.PERF_MIX && sharpness==='full' && !process.env.PERF_BASELINE_DIR) {
   assert.equal(sample.allocations,0,'settled mixed-resolution crossfade must reuse its render targets');
   assert.ok(sample.passes.composite>0,'both visible loops must be composited');
  }
  const row={scene,sharpness,pacing,...sample};results.push(row);console.log(JSON.stringify(row));
 }
 if(errors.length)throw Error(errors.join('\n'));
 if(process.argv[2])await writeFile(process.argv[2],JSON.stringify({hardware,results},null,2)+'\n');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
